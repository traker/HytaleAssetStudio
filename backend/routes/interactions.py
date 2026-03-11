from pathlib import Path

from fastapi import APIRouter, Depends, Header, Query

from backend.core.config import Settings, get_settings
from backend.core.interaction_tree_service import build_interaction_tree
from backend.core.workspace_service import resolve_workspace_root


router = APIRouter(prefix="/api/v1", tags=["interactions"])


@router.get("/projects/{projectId}/interaction/tree")
def project_interaction_tree(
    projectId: str,
    root: str = Query(..., description="Interaction server id (optionally prefixed with 'server:')"),
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
):
    workspace_root = resolve_workspace_root(settings, workspaceId)
    return build_interaction_tree(project_id=projectId, root_key=root, workspace_root=workspace_root)
