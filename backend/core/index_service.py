from __future__ import annotations

import hashlib
import json
import logging
from collections import defaultdict
from dataclasses import asdict
from pathlib import Path

from backend.core.errors import http_error
from backend.core.io import read_json, write_json
from backend.core.models import ProjectConfig
from backend.core.state import PROJECT_INDEX, ProjectIndexState
from backend.core.vfs import Mount, mount_from_source


_INDEX_CACHE_SCHEMA_VERSION = 1

# Uvicorn configures its own loggers by default; using uvicorn.error ensures
# these messages show up without requiring additional logging setup.
logger = logging.getLogger("uvicorn.error")


def _index_cache_path(cfg: ProjectConfig) -> Path:
    project_root = Path(cfg.project.rootPath)
    return project_root / ".studio_cache" / "index.json"


def _index_fingerprint(cfg: ProjectConfig) -> str:
    # MVP: fingerprint is based on project config only (does not detect external file changes).
    from backend.core.pydantic_compat import model_dump

    data = {
        "projectId": cfg.project.id,
        "assetsWritePath": cfg.project.assetsWritePath,
        "vanilla": model_dump(cfg.vanilla),
        "layers": [model_dump(l) for l in cfg.layers],
    }
    raw = json.dumps(data, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha1(raw).hexdigest()


def _save_index_cache(cfg: ProjectConfig, state: ProjectIndexState) -> None:
    path = _index_cache_path(cfg)
    payload = {
        "schemaVersion": _INDEX_CACHE_SCHEMA_VERSION,
        "fingerprint": _index_fingerprint(cfg),
        "state": asdict(state),
    }
    write_json(path, payload)


def _load_index_cache(cfg: ProjectConfig) -> ProjectIndexState | None:
    path = _index_cache_path(cfg)
    if not path.exists():
        return None

    try:
        payload = read_json(path)
    except Exception:
        logger.info("index_cache unreadable; rebuilding", extra={"path": str(path)})
        return None

    if payload.get("schemaVersion") != _INDEX_CACHE_SCHEMA_VERSION:
        logger.info(
            "index_cache schema mismatch; rebuilding",
            extra={"path": str(path), "schemaVersion": payload.get("schemaVersion")},
        )
        return None

    if payload.get("fingerprint") != _index_fingerprint(cfg):
        logger.info("index_cache fingerprint mismatch; rebuilding", extra={"path": str(path)})
        return None

    state_dict = payload.get("state")
    if not isinstance(state_dict, dict):
        return None

    try:
        return ProjectIndexState(**state_dict)
    except Exception:
        logger.info("index_cache state invalid; rebuilding", extra={"path": str(path)})
        return None


def build_mounts(cfg: ProjectConfig) -> list[Mount]:
    mounts: list[Mount] = []

    # vanilla (lowest)
    mounts.append(
        mount_from_source(
            mount_id="vanilla",
            origin="vanilla",
            source_type=cfg.vanilla.sourceType,
            path=cfg.vanilla.path,
        )
    )

    # dependencies (middle, ordered)
    for layer in cfg.layers:
        if not layer.enabled:
            continue
        mounts.append(
            mount_from_source(
                mount_id=f"layer:{layer.id}",
                origin="dependency",
                source_type=layer.sourceType,
                path=layer.path,
            )
        )

    # project (highest)
    mounts.append(
        mount_from_source(
            mount_id="project",
            origin="project",
            source_type="folder",
            path=cfg.project.assetsWritePath,
        )
    )

    return mounts


def rebuild_project_index(project_id: str, cfg: ProjectConfig) -> ProjectIndexState:
    mounts = build_mounts(cfg)

    # Build effective VFS mapping with shadowing by vfs path.
    effective_mount_by_vfs_path: dict[str, str] = {}
    origin_by_vfs_path: dict[str, str] = {}

    # keep mount lookup
    mounts_by_id = {m.mount_id: m for m in mounts}

    for mount in mounts:
        for rel in mount.list_files():
            vfs_path = rel.replace("\\", "/").lstrip("/")
            effective_mount_by_vfs_path[vfs_path] = mount.mount_id
            origin_by_vfs_path[vfs_path] = mount.origin

    # Server JSON only
    effective_server_paths = {
        p: mid
        for p, mid in effective_mount_by_vfs_path.items()
        if p.lower().startswith("server/") and p.lower().endswith(".json")
    }

    server_id_to_all_paths: dict[str, list[str]] = defaultdict(list)
    for vfs_path in sorted(effective_server_paths.keys()):
        stem = Path(vfs_path).stem
        server_id_to_all_paths[stem].append(vfs_path)

    server_id_to_path: dict[str, str] = {
        k: v[0] for k, v in server_id_to_all_paths.items() if len(v) == 1
    }

    origin_by_server_path = {p: origin_by_vfs_path[p] for p in effective_server_paths.keys()}

    state = ProjectIndexState(
        projectId=project_id,
        server_json_count=len(effective_server_paths),
        common_file_count=len([p for p in effective_mount_by_vfs_path if p.lower().startswith("common/")]),
        origin_by_vfs_path=origin_by_vfs_path,
        origin_by_server_path=origin_by_server_path,
        effective_mount_by_vfs_path=effective_mount_by_vfs_path,
        server_id_to_path=server_id_to_path,
        server_id_to_all_paths=dict(server_id_to_all_paths),
    )

    PROJECT_INDEX[project_id] = state

    # Best-effort disk cache (does not break runtime if it fails)
    try:
        _save_index_cache(cfg, state)
        logger.info(
            "index_cache saved",
            extra={
                "projectId": project_id,
                "path": str(_index_cache_path(cfg)),
                "serverJsonCount": state.server_json_count,
                "commonFileCount": state.common_file_count,
            },
        )
    except Exception:
        pass

    return state


def ensure_index(project_id: str, cfg: ProjectConfig) -> ProjectIndexState:
    # Prefer in-memory
    if project_id in PROJECT_INDEX:
        logger.debug("index_cache hit (memory)", extra={"projectId": project_id})
        return PROJECT_INDEX[project_id]

    cached = _load_index_cache(cfg)
    if cached is not None:
        PROJECT_INDEX[project_id] = cached
        logger.info(
            "index_cache hit (disk)",
            extra={
                "projectId": project_id,
                "path": str(_index_cache_path(cfg)),
                "serverJsonCount": cached.server_json_count,
                "commonFileCount": cached.common_file_count,
            },
        )
        return cached

    logger.info("index_cache miss; rebuilding", extra={"projectId": project_id})
    return rebuild_project_index(project_id, cfg)


def require_index(project_id: str) -> ProjectIndexState:
    if project_id not in PROJECT_INDEX:
        raise http_error(409, "INDEX_MISSING", "Index not built. Call rebuild first.")
    return PROJECT_INDEX[project_id]
