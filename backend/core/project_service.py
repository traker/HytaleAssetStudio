from __future__ import annotations

import logging
from pathlib import Path

from backend.core.config import Settings
from backend.core.errors import http_error
from backend.core.io import read_json, write_json
from backend.core.models import PackSource, ProjectConfig, WorkspaceDefaults


logger = logging.getLogger("uvicorn.error")


def _project_config_path(project_root: Path) -> Path:
    return project_root / "has.project.json"


def _load_workspace_defaults(settings: Settings) -> WorkspaceDefaults:
    cfg_path = settings.workspace_root / "has.workspace.json"
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


def find_project_config_path(workspace_root: Path, project_id: str) -> Path:
    projects_dir = workspace_root / "projects"
    if not projects_dir.exists():
        raise http_error(404, "PROJECT_NOT_FOUND", "Workspace projects dir missing", {"projectsDir": str(projects_dir)})

    for cfg_path in projects_dir.rglob("has.project.json"):
        try:
            cfg = read_json(cfg_path)
            pid = (cfg.get("project") or {}).get("id")
            if pid == project_id:
                return cfg_path
        except Exception as exc:
            logger.warning(
                "project lookup skipped invalid config",
                extra={"path": str(cfg_path), "projectId": project_id, "error": str(exc)},
            )
            continue

    raise http_error(404, "PROJECT_NOT_FOUND", "Project not found", {"projectId": project_id})


def load_project_config(workspace_root: Path, project_id: str) -> tuple[ProjectConfig, Path]:
    cfg_path = find_project_config_path(workspace_root, project_id)
    cfg_dict = read_json(cfg_path)
    try:
        cfg = ProjectConfig(**cfg_dict)
    except Exception as e:
        raise http_error(422, "PROJECT_CONFIG_INVALID", "Invalid has.project.json", {"path": str(cfg_path), "error": str(e)})
    return cfg, cfg_path


def save_project_config(cfg_path: Path, cfg: ProjectConfig) -> None:
    write_json(cfg_path, cfg.model_dump())


def get_project_assets_root(cfg: ProjectConfig) -> Path:
    return Path(cfg.project.assetsWritePath)
