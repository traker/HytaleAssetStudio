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
from backend.core.perf import timed
from backend.core.state import PROJECT_INDEX, PROJECT_INDEX_FINGERPRINT, ProjectIndexState, _INDEX_LOCK
from backend.core.vfs import Mount, mount_from_source


_INDEX_CACHE_SCHEMA_VERSION = 2

# Uvicorn configures its own loggers by default; using uvicorn.error ensures
# these messages show up without requiring additional logging setup.
logger = logging.getLogger("uvicorn.error")


def _index_cache_path(cfg: ProjectConfig) -> Path:
    project_root = Path(cfg.project.rootPath)
    return project_root / ".studio_cache" / "index.json"


def _iter_project_signature_files(project_root: Path) -> list[Path]:
    files: list[Path] = []

    manifest_path = project_root / "manifest.json"
    if manifest_path.is_file():
        files.append(manifest_path)

    for top_dir in (project_root / "Common", project_root / "Server"):
        if not top_dir.exists():
            continue
        for path in top_dir.rglob("*"):
            if path.is_file():
                files.append(path)

    return sorted(files)


def _project_content_signature(cfg: ProjectConfig) -> dict[str, object]:
    with timed("index.project_signature"):
        project_root = Path(cfg.project.assetsWritePath)
        if not project_root.exists():
            return {"exists": False, "files": []}

        entries: list[dict[str, object]] = []
        for path in _iter_project_signature_files(project_root):
            stat = path.stat()
            entries.append(
                {
                    "path": str(path.relative_to(project_root)).replace("\\", "/"),
                    "size": stat.st_size,
                    "mtimeNs": stat.st_mtime_ns,
                }
            )

        return {"exists": True, "files": entries}


def _index_fingerprint(cfg: ProjectConfig) -> str:
    with timed("index.fingerprint"):
        data = {
            "projectId": cfg.project.id,
            "assetsWritePath": cfg.project.assetsWritePath,
            "vanilla": cfg.vanilla.model_dump(),
            "layers": [l.model_dump() for l in cfg.layers],
            "projectContent": _project_content_signature(cfg),
        }
        raw = json.dumps(data, sort_keys=True, ensure_ascii=False).encode("utf-8")
        return hashlib.sha1(raw).hexdigest()


def _save_index_cache(cfg: ProjectConfig, state: ProjectIndexState, fingerprint: str) -> None:
    with timed("index.cache_save"):
        path = _index_cache_path(cfg)
        payload = {
            "schemaVersion": _INDEX_CACHE_SCHEMA_VERSION,
            "fingerprint": fingerprint,
            "state": asdict(state),
        }
        write_json(path, payload)


def _load_index_cache(cfg: ProjectConfig, fingerprint: str) -> ProjectIndexState | None:
    with timed("index.cache_load"):
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

        if payload.get("fingerprint") != fingerprint:
            logger.info("index_cache fingerprint mismatch; rebuilding", extra={"path": str(path)})
            return None

        state_dict = payload.get("state")
        if not isinstance(state_dict, dict):
            return None

        if "lower_layer_vfs_paths" not in state_dict or "lower_layer_server_ids" not in state_dict:
            logger.info("index_cache missing lower-layer metadata; rebuilding", extra={"path": str(path)})
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
    with timed("index.rebuild"):
        fingerprint = _index_fingerprint(cfg)
        mounts = build_mounts(cfg)

        # Build effective VFS mapping with shadowing by vfs path.
        effective_mount_by_vfs_path: dict[str, str] = {}
        origin_by_vfs_path: dict[str, str] = {}
        lower_layer_vfs_paths: dict[str, bool] = {}
        lower_layer_server_ids: dict[str, bool] = {}

        # keep mount lookup
        mounts_by_id = {m.mount_id: m for m in mounts}

        for mount in mounts:
            for rel in mount.list_files():
                vfs_path = rel.replace("\\", "/").lstrip("/")
                if mount.origin != "project":
                    lower_layer_vfs_paths[vfs_path] = True
                    if vfs_path.lower().startswith("server/") and vfs_path.lower().endswith(".json"):
                        lower_layer_server_ids[Path(vfs_path).stem] = True
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
            lower_layer_vfs_paths=lower_layer_vfs_paths,
            lower_layer_server_ids=lower_layer_server_ids,
        )

        with _INDEX_LOCK:
            PROJECT_INDEX[project_id] = state
            PROJECT_INDEX_FINGERPRINT[project_id] = fingerprint

        # Best-effort disk cache (does not break runtime if it fails)
        try:
            _save_index_cache(cfg, state, fingerprint)
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


def invalidate_project_index(project_id: str) -> None:
    with _INDEX_LOCK:
        PROJECT_INDEX.pop(project_id, None)
        PROJECT_INDEX_FINGERPRINT.pop(project_id, None)


def apply_project_server_write_to_index(project_id: str, cfg: ProjectConfig, vfs_path: str) -> None:
    normalized_path = vfs_path.replace("\\", "/").lstrip("/")
    server_id = Path(normalized_path).stem
    # Compute fingerprint outside the lock to avoid holding it during I/O.
    new_fingerprint = _index_fingerprint(cfg)
    with _INDEX_LOCK:
        state = PROJECT_INDEX.get(project_id)
        if state is None:
            return

        state.effective_mount_by_vfs_path[normalized_path] = "project"
        state.origin_by_vfs_path[normalized_path] = "project"

        if normalized_path.lower().startswith("server/") and normalized_path.lower().endswith(".json"):
            state.origin_by_server_path[normalized_path] = "project"
            paths = list(state.server_id_to_all_paths.get(server_id, []))
            if normalized_path not in paths:
                paths.append(normalized_path)
                paths.sort()
                state.server_id_to_all_paths[server_id] = paths
                state.server_json_count = len(
                    [
                        path
                        for path in state.effective_mount_by_vfs_path
                        if path.lower().startswith("server/") and path.lower().endswith(".json")
                    ]
                )
            if len(state.server_id_to_all_paths[server_id]) == 1:
                state.server_id_to_path[server_id] = normalized_path
            else:
                state.server_id_to_path.pop(server_id, None)

        PROJECT_INDEX_FINGERPRINT[project_id] = new_fingerprint


def ensure_index(project_id: str, cfg: ProjectConfig) -> ProjectIndexState:
    with timed("index.ensure"):
        fingerprint = _index_fingerprint(cfg)

        # Prefer in-memory
        if project_id in PROJECT_INDEX:
            cached_fingerprint = PROJECT_INDEX_FINGERPRINT.get(project_id)
            if cached_fingerprint == fingerprint:
                logger.debug("index_cache hit (memory)", extra={"projectId": project_id})
                return PROJECT_INDEX[project_id]

            logger.info("index_cache memory fingerprint mismatch; rebuilding", extra={"projectId": project_id})
            with _INDEX_LOCK:
                PROJECT_INDEX.pop(project_id, None)
                PROJECT_INDEX_FINGERPRINT.pop(project_id, None)

        cached = _load_index_cache(cfg, fingerprint)
        if cached is not None:
            with _INDEX_LOCK:
                PROJECT_INDEX[project_id] = cached
                PROJECT_INDEX_FINGERPRINT[project_id] = fingerprint
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
