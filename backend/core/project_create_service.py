from __future__ import annotations

import logging
import re
from pathlib import Path

from fastapi import HTTPException

from backend.core.errors import http_error
from backend.core.io import write_json
from backend.core.models import (
    ProjectConfig,
    ProjectConfigProject,
    ProjectCreateRequest,
    ProjectCreateResponse,
)
from backend.core.workspace_service import _project_config_path


logger = logging.getLogger("uvicorn.error")

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(value: str) -> str:
    s = value.strip().lower()
    s = _SLUG_RE.sub("-", s)
    s = s.strip("-")
    return s


def _default_project_manifest(project_id: str, display_name: str) -> dict:
    return {
        "Group": project_id,
        "Name": display_name,
        "Version": "1.0.0",
        "Description": "",
        "Authors": [],
        "Website": "",
        "ServerVersion": "*",
        "DisabledByDefault": False,
        "IncludesAssetPack": False,
    }


def _project_creation_conflicts(project_root: Path) -> list[str]:
    conflicts: list[str] = []

    if project_root.exists() and any(project_root.iterdir()):
        conflicts.append(str(project_root))

    for reserved in (
        project_root / "Common",
        project_root / "Server",
        project_root / "manifest.json",
        _project_config_path(project_root),
    ):
        if reserved.exists() and str(reserved) not in conflicts:
            conflicts.append(str(reserved))

    return conflicts


def _cleanup_created_paths(created_paths: list[Path]) -> None:
    for path in reversed(created_paths):
        try:
            if path.is_file():
                path.unlink()
            elif path.is_dir():
                path.rmdir()
        except FileNotFoundError:
            continue
        except OSError:
            logger.warning("project create cleanup skipped path", extra={"path": str(path)})


def create_project(workspace_root: Path, req: ProjectCreateRequest) -> ProjectCreateResponse:
    project_root = Path(req.targetDir)
    manifest_data = dict(req.manifest) if req.manifest is not None else _default_project_manifest(req.projectId, req.displayName)

    conflicts = _project_creation_conflicts(project_root)
    if conflicts:
        raise http_error(
            409,
            "PROJECT_EXISTS",
            "Project targetDir already exists or contains reserved project files",
            {"targetDir": str(project_root), "conflicts": conflicts},
        )

    cfg = ProjectConfig(
        project=ProjectConfigProject(
            id=req.projectId,
            displayName=req.displayName,
            rootPath=str(project_root),
            assetsWritePath=str(project_root),
        ),
        vanilla=req.vanilla,
        layers=[],
    )

    cfg_path = _project_config_path(project_root)
    created_paths: list[Path] = []

    try:
        project_root.parent.mkdir(parents=True, exist_ok=True)

        if not project_root.exists():
            project_root.mkdir(exist_ok=False)
            created_paths.append(project_root)

        common_dir = project_root / "Common"
        server_dir = project_root / "Server"
        common_dir.mkdir(exist_ok=False)
        created_paths.append(common_dir)
        server_dir.mkdir(exist_ok=False)
        created_paths.append(server_dir)

        manifest_path = project_root / "manifest.json"
        write_json(manifest_path, manifest_data)
        created_paths.append(manifest_path)

        write_json(cfg_path, cfg.model_dump())
        created_paths.append(cfg_path)
    except HTTPException:
        _cleanup_created_paths(created_paths)
        raise
    except Exception as e:
        _cleanup_created_paths(created_paths)
        raise http_error(500, "PROJECT_CREATE_FAILED", "Failed to create project", {"targetDir": str(project_root), "error": str(e)})

    return ProjectCreateResponse(
        projectId=req.projectId,
        rootPath=str(project_root),
        assetsWritePath=str(project_root),
        configPath=str(cfg_path),
    )
