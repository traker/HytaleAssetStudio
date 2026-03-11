from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends

from backend.core.config import Settings, get_settings
from backend.core.models import WorkspaceOpenRequest, WorkspaceOpenResponse, WorkspaceProjectsResponse
from backend.core.workspace_service import list_projects, open_workspace, resolve_workspace_root

router = APIRouter(prefix="/api/v1", tags=["workspace"])


@router.post("/workspace/open", response_model=WorkspaceOpenResponse)
def workspace_open(req: WorkspaceOpenRequest, settings: Settings = Depends(get_settings)) -> WorkspaceOpenResponse:
    return open_workspace(settings, req)


@router.get("/workspace/{workspaceId}/projects", response_model=WorkspaceProjectsResponse)
def workspace_list_projects(workspaceId: str, settings: Settings = Depends(get_settings)) -> WorkspaceProjectsResponse:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    projects = list_projects(workspace_root)
    return WorkspaceProjectsResponse(projects=projects)
