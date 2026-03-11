from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import Response

from backend.core.asset_service import read_server_json, resolve_common_resource, write_server_json_copy, write_server_json_override
from backend.core.config import Settings, get_settings
from backend.core.errors import http_error
from backend.core.index_service import ensure_index
from backend.core.models import AssetPutRequest, AssetPutResponse, ModifiedAssetEntry, ModifiedAssetsResponse
from backend.core.project_service import load_project_config
from backend.core.workspace_service import resolve_workspace_root

router = APIRouter(prefix="/api/v1", tags=["assets"])


@router.get("/projects/{projectId}/modified", response_model=ModifiedAssetsResponse)
def get_modified_assets(
    projectId: str,
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> ModifiedAssetsResponse:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, _ = load_project_config(workspace_root, projectId)

    # Ensure we have an index; used only to detect ambiguous server IDs.
    index = ensure_index(cfg.project.id, cfg)

    from pathlib import Path
    from backend.core.index_service import build_mounts

    root = Path(cfg.project.assetsWritePath)
    if not root.exists():
        raise http_error(404, "PROJECT_NOT_FOUND", "Project assetsWritePath not found", {"path": str(root)})

    # Build a set of all vfs_paths that exist in non-project mounts.
    # A project file whose vfs_path is NOT in this set is a brand-new asset.
    non_project_paths: set[str] = set()
    for mount in build_mounts(cfg):
        if mount.origin == "project":
            continue
        for rel in mount.list_files():
            non_project_paths.add(rel.replace("\\", "/").lstrip("/"))

    entries: list[ModifiedAssetEntry] = []

    # Server JSON overrides
    server_root = root / "Server"
    if server_root.exists():
        for p in server_root.rglob("*.json"):
            if not p.is_file():
                continue
            rel = p.relative_to(root).as_posix()
            stem = p.stem

            asset_key: str | None = None
            paths = index.server_id_to_all_paths.get(stem)
            # Only expose an assetKey when it resolves uniquely.
            if paths and len(paths) == 1:
                asset_key = f"server:{stem}"

            st = p.stat()
            entries.append(
                ModifiedAssetEntry(
                    kind="server-json",
                    vfsPath=rel,
                    assetKey=asset_key,
                    size=st.st_size,
                    mtimeMs=int(st.st_mtime * 1000),
                    isNew=rel not in non_project_paths,
                )
            )

    # Common resources overrides/additions
    common_root = root / "Common"
    if common_root.exists():
        for p in common_root.rglob("*"):
            if not p.is_file():
                continue
            rel = p.relative_to(root).as_posix()
            rel_under_common = p.relative_to(common_root).as_posix()
            st = p.stat()
            entries.append(
                ModifiedAssetEntry(
                    kind="common-resource",
                    vfsPath=rel,
                    assetKey=f"common:{rel_under_common}",
                    size=st.st_size,
                    mtimeMs=int(st.st_mtime * 1000),
                )
            )

    entries.sort(key=lambda e: (e.kind, e.vfsPath.lower()))
    return ModifiedAssetsResponse(projectId=projectId, count=len(entries), entries=entries)


@router.get("/projects/{projectId}/asset")
def get_asset(
    projectId: str,
    key: str = Query(..., description="assetKey, ex: server:Weapon_Sword_Iron"),
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> dict:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, _ = load_project_config(workspace_root, projectId)
    return read_server_json(cfg, key)


@router.put("/projects/{projectId}/asset", response_model=AssetPutResponse)
def put_asset(
    projectId: str,
    key: str = Query(..., description="assetKey, ex: server:Weapon_Sword_Iron"),
    body: AssetPutRequest | None = None,
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> AssetPutResponse:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, _ = load_project_config(workspace_root, projectId)
    if body is None:
        # FastAPI can pass None if body is missing.
        raise http_error(422, "BODY_MISSING", "Missing request body")
    if body.mode == "copy":
        if not body.newId:
            raise http_error(422, "NEWID_MISSING", "newId is required for mode=copy", {})
        result = write_server_json_copy(cfg, key, body.newId, body.payload)
        return AssetPutResponse(**result)
    if body.mode != "override":
        raise http_error(422, "MODE_INVALID", "Unsupported mode", {"mode": body.mode})
    result = write_server_json_override(cfg, key, body.payload)
    return AssetPutResponse(**result)


@router.get("/projects/{projectId}/resource")
def get_resource(
    projectId: str,
    key: str = Query(..., description="assetKey, ex: common:Icons/...png"),
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> Response:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, _ = load_project_config(workspace_root, projectId)
    resolved = resolve_common_resource(cfg, key)

    data = resolved.mount.read_bytes(resolved.vfs_path)

    headers = {
        # MVP: cache allowed; later we can add etag/mtime based on source.
        "Cache-Control": "public, max-age=3600",
        "X-HAS-Origin": resolved.origin,
        "X-HAS-ResolvedPath": resolved.vfs_path,
    }

    return Response(content=data, media_type=resolved.media_type or "application/octet-stream", headers=headers)
