from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from backend.core.config import Settings
from backend.core.errors import http_error
from backend.core.io import read_json, write_json
from backend.core.models import (
    PackSource,
    ProjectConfig,
    ProjectInfo,
    ProjectOpenRequest,
    ProjectOpenResponse,
    WorkspaceDefaults,
    WorkspaceOpenRequest,
    WorkspaceOpenResponse,
)
from backend.core.pydantic_compat import model_dump
from backend.core.state import WORKSPACE_ROOT_BY_ID, _WORKSPACE_LOCK


logger = logging.getLogger("uvicorn.error")


def _workspace_id_for_root(root: Path) -> str:
    # Stable ID derived from path, good enough for MVP.
    normalized = str(root.resolve()).replace("\\", "/").lower().encode("utf-8")
    return hashlib.sha1(normalized).hexdigest()


def _workspace_config_path(root: Path) -> Path:
    return root / "has.workspace.json"


def _project_config_path(project_root: Path) -> Path:
    return project_root / "has.project.json"



def register_workspace_root(root: Path) -> str:
    workspace_id = _workspace_id_for_root(root)
    with _WORKSPACE_LOCK:
        WORKSPACE_ROOT_BY_ID[workspace_id] = str(root)
    return workspace_id


def resolve_workspace_root(settings: Settings, workspace_id: str | None) -> Path:
    if not workspace_id:
        return settings.workspace_root

    root = WORKSPACE_ROOT_BY_ID.get(workspace_id)
    if root is None:
        raise http_error(404, "WORKSPACE_NOT_FOUND", "Unknown workspaceId. Open the workspace first.", {"workspaceId": workspace_id})

    return Path(root)


def _load_workspace_defaults(settings: Settings) -> WorkspaceDefaults:
    cfg_path = _workspace_config_path(settings.workspace_root)
    if cfg_path.exists():
        cfg = read_json(cfg_path)
        defaults = cfg.get("defaults") or {}
        vanilla = defaults.get("vanilla") or {}
        return WorkspaceDefaults(vanilla=PackSource(**vanilla))
    return WorkspaceDefaults(
        vanilla=PackSource(
            sourceType=settings.default_vanilla_source_type,  # type: ignore[arg-type]
            path=settings.default_vanilla_path,
        )
    )


def open_workspace(settings: Settings, req: WorkspaceOpenRequest) -> WorkspaceOpenResponse:
    root = Path(req.rootPath)
    projects_dir = root / "projects"
    cfg_path = _workspace_config_path(root)

    root.mkdir(parents=True, exist_ok=True)
    projects_dir.mkdir(parents=True, exist_ok=True)

    if cfg_path.exists():
        cfg = read_json(cfg_path)
        defaults = cfg.get("defaults") or {}
        vanilla = defaults.get("vanilla") or {}
        defaults_model = WorkspaceDefaults(vanilla=PackSource(**vanilla))
    else:
        defaults_model = WorkspaceDefaults(
            vanilla=PackSource(
                sourceType=settings.default_vanilla_source_type,  # type: ignore[arg-type]
                path=settings.default_vanilla_path,
            )
        )
        write_json(
            cfg_path,
            {
                "schemaVersion": 1,
                "workspace": {
                    "rootPath": str(root),
                    "projectsDir": str(projects_dir),
                },
                "defaults": model_dump(defaults_model),
            },
        )

    workspace_id = register_workspace_root(root)

    return WorkspaceOpenResponse(
        workspaceId=workspace_id,
        rootPath=str(root),
        projectsDir=str(projects_dir),
        defaults=defaults_model,
    )


def list_projects(workspace_root: Path) -> list[ProjectInfo]:
    projects_dir = workspace_root / "projects"
    if not projects_dir.exists():
        return []

    result: list[ProjectInfo] = []
    for cfg_path in projects_dir.rglob("has.project.json"):
        try:
            cfg = read_json(cfg_path)
            parsed = ProjectConfig(**cfg)
            result.append(
                ProjectInfo(
                    projectId=parsed.project.id,
                    displayName=parsed.project.displayName,
                    rootPath=parsed.project.rootPath,
                    assetsWritePath=parsed.project.assetsWritePath,
                    status="ready",
                )
            )
        except Exception as exc:
            logger.warning("project listing found invalid config", extra={"path": str(cfg_path), "error": str(exc)})
            result.append(
                ProjectInfo(
                    projectId=cfg_path.parent.name,
                    displayName=None,
                    rootPath=str(cfg_path.parent),
                    assetsWritePath=str(cfg_path.parent),
                    status="invalid",
                    errorMessage=str(exc),
                )
            )

    # Deduplicate by projectId, preferring ready entries over invalid ones.
    by_project_id: dict[str, ProjectInfo] = {}
    for p in result:
        existing = by_project_id.get(p.projectId)
        if existing is None:
            by_project_id[p.projectId] = p
            continue
        if existing.status == "invalid" and p.status == "ready":
            by_project_id[p.projectId] = p

    return sorted(by_project_id.values(), key=lambda p: (p.status != "ready", p.projectId))



def open_project(req: ProjectOpenRequest) -> ProjectOpenResponse:
    project_root = Path(req.projectPath)
    cfg_path = _project_config_path(project_root)
    if not cfg_path.exists():
        raise http_error(404, "PROJECT_NOT_FOUND", "Missing has.project.json", {"projectPath": str(project_root)})

    cfg = read_json(cfg_path)
    project = cfg.get("project") or {}
    project_id = project.get("id") or project_root.name
    root_path = project.get("rootPath") or str(project_root)
    assets_write_path = project.get("assetsWritePath") or root_path

    return ProjectOpenResponse(projectId=project_id, rootPath=root_path, assetsWritePath=assets_write_path)



