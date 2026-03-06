from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.core.config import Settings, get_settings
from backend.core.export_service import export_project_zip
from backend.core.index_service import rebuild_project_index
from backend.core.models import (
    ExportZipRequest,
    ExportZipResponse,
    ImportPackRequest,
    ImportPackResponse,
    OkResponse,
    ProjectCreateRequest,
    ProjectCreateResponse,
    ProjectLayersPutRequest,
    ProjectOpenRequest,
    ProjectOpenResponse,
)
from backend.core.project_service import load_project_config, save_project_config
from backend.core.workspace_service import create_project, import_pack, open_project

router = APIRouter(prefix="/api/v1", tags=["projects"])


@router.post("/workspace/{workspaceId}/projects/create", response_model=ProjectCreateResponse)
def project_create(workspaceId: str, req: ProjectCreateRequest, settings: Settings = Depends(get_settings)) -> ProjectCreateResponse:
    # MVP: workspaceId is derived from HAS_WORKSPACE_ROOT; we ignore the value for now.
    return create_project(settings.workspace_root, req)


@router.post("/workspace/{workspaceId}/projects/import-pack", response_model=ImportPackResponse)
def project_import_pack(workspaceId: str, req: ImportPackRequest, settings: Settings = Depends(get_settings)) -> ImportPackResponse:
    # MVP: workspaceId is derived from HAS_WORKSPACE_ROOT; we ignore the value for now.
    return import_pack(settings, req)


@router.post("/projects/open", response_model=ProjectOpenResponse)
def project_open(req: ProjectOpenRequest) -> ProjectOpenResponse:
    return open_project(req)


@router.get("/projects/{projectId}/config")
def project_get_config(projectId: str, settings: Settings = Depends(get_settings)) -> dict:
    cfg, _ = load_project_config(settings.workspace_root, projectId)
    # Compatibility: pydantic v1/v2
    from backend.core.pydantic_compat import model_dump

    return model_dump(cfg)


@router.put("/projects/{projectId}/layers", response_model=OkResponse)
def project_put_layers(
    projectId: str,
    req: ProjectLayersPutRequest,
    settings: Settings = Depends(get_settings),
) -> OkResponse:
    cfg, cfg_path = load_project_config(settings.workspace_root, projectId)

    cfg.vanilla = req.vanilla
    cfg.layers = req.layers
    save_project_config(cfg_path, cfg)

    # Ensure changes reflect immediately in subsequent reads/search/graph.
    rebuild_project_index(cfg.project.id, cfg)

    return OkResponse(ok=True)


@router.post("/projects/{projectId}/export", response_model=ExportZipResponse)
def project_export_zip(projectId: str, req: ExportZipRequest, settings: Settings = Depends(get_settings)) -> ExportZipResponse:
    cfg, _ = load_project_config(settings.workspace_root, projectId)
    result = export_project_zip(cfg, req.outputPath)
    return ExportZipResponse(**result)
