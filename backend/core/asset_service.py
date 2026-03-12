from __future__ import annotations

import mimetypes
from dataclasses import dataclass
from pathlib import Path

from backend.core.errors import http_error
from backend.core.graph_service import _ID_CANDIDATE
from backend.core.index_service import apply_project_server_write_to_index, build_mounts, ensure_index
from backend.core.io import write_json
from backend.core.models import ProjectConfig
from backend.core.vfs import Mount, read_json_from_mount


def _ensure_no_parent_segments(vfs_path: str) -> None:
    parts = [p for p in vfs_path.replace("\\", "/").split("/") if p]
    if any(p == ".." for p in parts):
        raise http_error(422, "PATH_INVALID", "Path must not contain '..' segments", {"path": vfs_path})


@dataclass(frozen=True)
class ResolvedServerJson:
    asset_key: str
    server_id: str
    vfs_path: str
    origin: str
    mount: Mount


def resolve_server_json(
    cfg: ProjectConfig,
    asset_key: str,
    index=None,
) -> ResolvedServerJson:
    # Ensure index present (memory or disk cache or rebuild)
    if index is None:
        index = ensure_index(cfg.project.id, cfg)

    if asset_key.startswith("server-path:"):
        vfs_path = asset_key.split(":", 1)[1].strip().replace("\\", "/").lstrip("/")
        if not vfs_path.lower().startswith("server/") or not vfs_path.lower().endswith(".json"):
            raise http_error(422, "PATH_INVALID", "server-path must target a Server/*.json asset", {"path": vfs_path})
        if vfs_path not in index.effective_mount_by_vfs_path:
            raise http_error(404, "ASSET_NOT_FOUND", "Server asset path not found", {"path": vfs_path})
        server_id = Path(vfs_path).stem
    elif asset_key.startswith("server:"):
        server_id = asset_key.split(":", 1)[1].strip()
        if not server_id or not _ID_CANDIDATE.match(server_id):
            raise http_error(422, "ID_INVALID", "Invalid server id", {"id": server_id})

        paths = index.server_id_to_all_paths.get(server_id)
        if not paths:
            raise http_error(404, "ASSET_NOT_FOUND", "Server asset not found", {"id": server_id})
        if len(paths) != 1:
            raise http_error(409, "ID_AMBIGUOUS", "Server ID resolves to multiple JSON paths", {"id": server_id, "paths": paths})

        vfs_path = paths[0]
    else:
        raise http_error(422, "KEY_INVALID", "Only server:* and server-path:* are supported", {"key": asset_key})

    _ensure_no_parent_segments(vfs_path)

    mount_id = index.effective_mount_by_vfs_path.get(vfs_path)
    if not mount_id:
        raise http_error(500, "MOUNT_MISSING", "Index is missing mount for resolved path", {"path": vfs_path})

    mounts = build_mounts(cfg)
    mounts_by_id = {m.mount_id: m for m in mounts}
    mount = mounts_by_id[mount_id]

    origin = index.origin_by_server_path.get(vfs_path, "vanilla")

    return ResolvedServerJson(
        asset_key=asset_key,
        server_id=server_id,
        vfs_path=vfs_path,
        origin=origin,
        mount=mount,
    )


def read_server_json(cfg: ProjectConfig, asset_key: str) -> dict:
    index = ensure_index(cfg.project.id, cfg)
    resolved = resolve_server_json(cfg, asset_key, index=index)
    return {
        "assetKey": resolved.asset_key,
        "resolvedPath": resolved.vfs_path,
        "origin": resolved.origin,
        "json": read_json_from_mount(resolved.mount, resolved.vfs_path),
    }


def write_server_json_copy(cfg: ProjectConfig, asset_key: str, new_id: str, payload_json: dict) -> dict:
    """Write a new asset derived from an existing one, using a different ID (stem)."""
    if not new_id or not _ID_CANDIDATE.match(new_id):
        raise http_error(422, "ID_INVALID", "newId must be a valid server asset ID (alphanumeric + underscore)", {"newId": new_id})

    index = ensure_index(cfg.project.id, cfg)
    resolved = resolve_server_json(cfg, asset_key, index=index)

    if not resolved.vfs_path.lower().startswith("server/"):
        raise http_error(500, "RESOLVE_INVALID", "Resolved path is not under Server/", {"path": resolved.vfs_path})

    # Same directory as the source, but new filename
    source_path = Path(resolved.vfs_path)
    new_vfs_path = (source_path.parent / f"{new_id}.json").as_posix()

    project_root = Path(cfg.project.assetsWritePath)
    dst = (project_root / new_vfs_path).resolve()

    try:
        dst.relative_to(project_root.resolve())
    except Exception:
        raise http_error(422, "PATH_INVALID", "Resolved path escapes project root", {"path": str(dst)})

    if new_id in index.server_id_to_all_paths:
        raise http_error(
            409,
            "ID_CONFLICT",
            "newId already exists in the effective asset graph",
            {"newId": new_id, "paths": index.server_id_to_all_paths[new_id]},
        )

    if new_vfs_path in index.effective_mount_by_vfs_path or dst.exists():
        raise http_error(
            409,
            "PATH_CONFLICT",
            "Target asset path already exists",
            {"newId": new_id, "path": new_vfs_path},
        )

    if not isinstance(payload_json, dict):
        raise http_error(422, "PAYLOAD_INVALID", "json must be an object", {})

    write_json(dst, payload_json)
    apply_project_server_write_to_index(cfg.project.id, cfg, new_vfs_path)

    return {
        "ok": True,
        "assetKey": f"server:{new_id}",
        "resolvedPath": new_vfs_path,
        "origin": "project",
    }


def write_server_json_override(cfg: ProjectConfig, asset_key: str, payload_json: dict) -> dict:
    resolved = resolve_server_json(cfg, asset_key)

    # En override, on écrit toujours dans le projet actif, au même chemin VFS.
    if not resolved.vfs_path.lower().startswith("server/"):
        raise http_error(500, "RESOLVE_INVALID", "Resolved path is not under Server/", {"path": resolved.vfs_path})

    project_root = Path(cfg.project.assetsWritePath)
    dst = (project_root / resolved.vfs_path).resolve()

    # Safety: ensure destination stays under project_root
    try:
        dst.relative_to(project_root.resolve())
    except Exception:
        raise http_error(422, "PATH_INVALID", "Resolved path escapes project root", {"path": str(dst)})

    if not isinstance(payload_json, dict):
        raise http_error(422, "PAYLOAD_INVALID", "json must be an object", {})

    write_json(dst, payload_json)

    # Update the in-memory index immediately so subsequent reads do not trigger a full rebuild.
    apply_project_server_write_to_index(cfg.project.id, cfg, resolved.vfs_path)

    return {
        "ok": True,
        "assetKey": resolved.asset_key,
        "resolvedPath": resolved.vfs_path,
        "origin": "project",
    }


@dataclass(frozen=True)
class ResolvedCommonResource:
    asset_key: str
    vfs_path: str
    origin: str
    mount: Mount
    media_type: str | None


def resolve_common_resource(cfg: ProjectConfig, asset_key: str) -> ResolvedCommonResource:
    if not asset_key.startswith("common:"):
        raise http_error(422, "KEY_INVALID", "Only common:* is supported", {"key": asset_key})

    rel = asset_key.split(":", 1)[1].lstrip("/")
    vfs_path = f"Common/{rel}" if not rel.startswith("Common/") else rel
    vfs_path = vfs_path.replace("\\", "/")
    _ensure_no_parent_segments(vfs_path)

    # Ensure index present (memory or disk cache or rebuild)
    index = ensure_index(cfg.project.id, cfg)

    mount_id = index.effective_mount_by_vfs_path.get(vfs_path)
    if not mount_id:
        raise http_error(404, "RESOURCE_NOT_FOUND", "Common resource not found", {"path": vfs_path})

    mounts = build_mounts(cfg)
    mounts_by_id = {m.mount_id: m for m in mounts}
    mount = mounts_by_id[mount_id]

    origin = index.origin_by_vfs_path.get(vfs_path, "vanilla")
    media_type, _ = mimetypes.guess_type(Path(vfs_path).name)

    return ResolvedCommonResource(
        asset_key=asset_key,
        vfs_path=vfs_path,
        origin=origin,
        mount=mount,
        media_type=media_type,
    )
