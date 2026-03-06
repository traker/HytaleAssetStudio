from fastapi import APIRouter, Query

from backend.core.interaction_tree_service import build_interaction_tree


router = APIRouter(prefix="/api/v1", tags=["interactions"])


@router.get("/projects/{projectId}/interaction/tree")
def project_interaction_tree(
    projectId: str,
    root: str = Query(..., description="Interaction server id (optionally prefixed with 'server:')"),
):
    return build_interaction_tree(project_id=projectId, root_key=root)
