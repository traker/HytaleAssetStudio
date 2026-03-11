from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, Header

from backend.core.config import Settings, get_settings
from backend.core.errors import http_error
from backend.core.export_service import export_project_zip
from backend.core.index_service import rebuild_project_index
from backend.core.models import (
    ExportZipRequest,
    ExportZipResponse,
    ImportPackRequest,
    ImportPackResponse,
    ManifestPutRequest,
    OkResponse,
    ProjectCreateRequest,
    ProjectCreateResponse,
    ProjectLayersPutRequest,
    ProjectManifest,
    ProjectOpenRequest,
    ProjectOpenResponse,
)
from backend.core.io import write_json
from backend.core.pydantic_compat import model_dump
from backend.core.project_service import load_project_config, save_project_config
from backend.core.workspace_service import create_project, import_pack, open_project, resolve_workspace_root

router = APIRouter(prefix="/api/v1", tags=["projects"])


@router.post("/workspace/{workspaceId}/projects/create", response_model=ProjectCreateResponse)
def project_create(workspaceId: str, req: ProjectCreateRequest, settings: Settings = Depends(get_settings)) -> ProjectCreateResponse:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    return create_project(workspace_root, req)


@router.post("/workspace/{workspaceId}/projects/import-pack", response_model=ImportPackResponse)
def project_import_pack(workspaceId: str, req: ImportPackRequest, settings: Settings = Depends(get_settings)) -> ImportPackResponse:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    workspace_settings = Settings(
        workspace_root=workspace_root,
        default_vanilla_source_type=settings.default_vanilla_source_type,
        default_vanilla_path=settings.default_vanilla_path,
    )
    return import_pack(workspace_settings, req)


@router.post("/projects/open", response_model=ProjectOpenResponse)
def project_open(req: ProjectOpenRequest) -> ProjectOpenResponse:
    return open_project(req)


@router.get("/projects/{projectId}/config")
def project_get_config(
    projectId: str,
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> dict:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, _ = load_project_config(workspace_root, projectId)
    # Compatibility: pydantic v1/v2
    from backend.core.pydantic_compat import model_dump

    return model_dump(cfg)


@router.put("/projects/{projectId}/layers", response_model=OkResponse)
def project_put_layers(
    projectId: str,
    req: ProjectLayersPutRequest,
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> OkResponse:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, cfg_path = load_project_config(workspace_root, projectId)

    cfg.vanilla = req.vanilla
    cfg.layers = req.layers
    save_project_config(cfg_path, cfg)

    # Ensure changes reflect immediately in subsequent reads/search/graph.
    rebuild_project_index(cfg.project.id, cfg)

    return OkResponse(ok=True)


@router.post("/projects/{projectId}/export", response_model=ExportZipResponse)
def project_export_zip(
    projectId: str,
    req: ExportZipRequest,
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> ExportZipResponse:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, _ = load_project_config(workspace_root, projectId)
    result = export_project_zip(cfg, req.outputPath)
    return ExportZipResponse(**result)


@router.get("/projects/{projectId}/manifest")
def project_get_manifest(
    projectId: str,
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> dict:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, _ = load_project_config(workspace_root, projectId)
    manifest_path = Path(cfg.project.assetsWritePath) / "manifest.json"
    if not manifest_path.exists():
        # Return a default manifest seeded from project metadata
        return model_dump(ProjectManifest(Group=cfg.project.id, Name=cfg.project.displayName))
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise http_error(422, "MANIFEST_INVALID", "manifest.json is not valid JSON", {"error": str(e)})


@router.put("/projects/{projectId}/manifest", response_model=OkResponse)
def project_put_manifest(
    projectId: str,
    req: ManifestPutRequest,
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> OkResponse:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, _ = load_project_config(workspace_root, projectId)
    manifest_path = Path(cfg.project.assetsWritePath) / "manifest.json"
    from backend.core.pydantic_compat import model_dump
    write_json(manifest_path, model_dump(req.manifest))
    return OkResponse(ok=True)
