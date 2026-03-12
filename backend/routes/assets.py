from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import Response

from backend.core.asset_service import read_server_json, resolve_common_resource, write_server_json_copy, write_server_json_override
from backend.core.config import Settings, get_settings
from backend.core.errors import http_error
from backend.core.modification_service import collect_project_modifications
from backend.core.models import AssetPutRequest, AssetPutResponse, ModifiedAssetEntry, ModifiedAssetsResponse
from backend.core.project_service import load_project_config
from backend.core.workspace_service import resolve_workspace_root

router = APIRouter(prefix="/api/v1", tags=["assets"])


def _list_modified_entries(cfg) -> list[ModifiedAssetEntry]:
    return [
        ModifiedAssetEntry(
            kind=entry.kind,
            vfsPath=entry.vfs_path,
            assetKey=entry.asset_key,
            size=entry.size,
            mtimeMs=entry.mtime_ms,
            isNew=entry.is_new,
            modificationKind=entry.modification_kind,
        )
        for entry in collect_project_modifications(cfg)
    ]


@router.get("/projects/{projectId}/modified", response_model=ModifiedAssetsResponse)
def get_modified_assets(
    projectId: str,
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> ModifiedAssetsResponse:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, _ = load_project_config(workspace_root, projectId)
    entries = _list_modified_entries(cfg)
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
