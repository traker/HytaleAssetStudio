from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query

from backend.core.config import Settings, get_settings
from backend.core.graph_service import build_focus_graph, build_modified_graph
from backend.core.index_service import ensure_index, rebuild_project_index
from backend.core.project_service import load_project_config
from backend.core.workspace_service import resolve_workspace_root

router = APIRouter(prefix="/api/v1", tags=["index", "graph"])


def _group_for_server_path(vfs_path: str) -> str:
    """Derive a UI group label from a VFS server path."""
    p = vfs_path.replace("\\", "/").lower()
    if "/item/items/" in p:
        return "item"
    if "/rootinteractions/" in p:
        return "rootinteraction"
    if "/interactions/" in p:
        return "interaction"
    if "/effects/" in p:
        return "effect"
    if "/projectiles/" in p:
        return "projectile"
    if "/particles/" in p:
        return "particle"
    if "/sounds/" in p or "/soundevents/" in p:
        return "sound"
    if "/models/" in p:
        return "model"
    if "/npc/" in p or "/npcs/" in p:
        return "npc"
    if "/prefabs/" in p:
        return "prefab"
    if "/block/" in p or "/blocks/" in p:
        return "block"
    return "json_data"


def _build_search_results(index, q: str, limit: int) -> list[dict]:
    q_low = q.lower()
    results: list[dict] = []

    for server_id, paths in sorted(index.server_id_to_all_paths.items()):
        if q_low not in server_id.lower():
            continue

        if len(paths) == 1:
            vfs_path = paths[0]
            origin = index.origin_by_server_path.get(vfs_path, "vanilla")
            results.append(
                {
                    "assetKey": f"server:{server_id}",
                    "kind": "server-json",
                    "display": server_id,
                    "origin": origin,
                    "group": _group_for_server_path(vfs_path),
                    "path": vfs_path,
                    "ambiguous": False,
                }
            )
        else:
            for vfs_path in paths:
                origin = index.origin_by_server_path.get(vfs_path, "vanilla")
                results.append(
                    {
                        "assetKey": f"server-path:{vfs_path}",
                        "kind": "server-json",
                        "display": server_id,
                        "origin": origin,
                        "group": _group_for_server_path(vfs_path),
                        "path": vfs_path,
                        "ambiguous": True,
                        "ambiguousId": server_id,
                        "candidatePaths": paths,
                    }
                )

        if len(results) >= limit:
            break

    return results[:limit]


@router.post("/projects/{projectId}/rebuild")
def project_rebuild(
    projectId: str,
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> dict:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, _ = load_project_config(workspace_root, projectId)
    state = rebuild_project_index(projectId, cfg)
    return {
        "ok": True,
        "stats": {"serverJsonCount": state.server_json_count, "commonFileCount": state.common_file_count},
    }


@router.get("/projects/{projectId}/search")
def project_search(
    projectId: str,
    q: str = Query(min_length=1),
    limit: int = Query(default=50, ge=1, le=200),
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> dict:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, _ = load_project_config(workspace_root, projectId)

    # Lazy build (memory/disk cache) (MVP convenience)
    index = ensure_index(projectId, cfg)

    return {"results": _build_search_results(index, q, limit)}


@router.get("/projects/{projectId}/graph")
def project_graph(
    projectId: str,
    root: str = Query(..., description="assetKey, ex: server:Weapon_Sword_Iron"),
    depth: int = Query(default=2, ge=0, le=10),
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> dict:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, _ = load_project_config(workspace_root, projectId)

    # Ensure index (memory/disk cache)
    ensure_index(projectId, cfg)

    return build_focus_graph(cfg, root, depth)


@router.get("/projects/{projectId}/graph-modified")
def project_graph_modified(
    projectId: str,
    depth: int = Query(default=1, ge=0, le=6),
    settings: Settings = Depends(get_settings),
    workspaceId: str | None = Header(default=None, alias="X-HAS-Workspace-Id"),
) -> dict:
    workspace_root = resolve_workspace_root(settings, workspaceId)
    cfg, _ = load_project_config(workspace_root, projectId)
    ensure_index(projectId, cfg)
    return build_modified_graph(cfg, depth)
