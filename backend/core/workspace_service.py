from __future__ import annotations

import hashlib
import logging
import re
from pathlib import Path

from fastapi import HTTPException
from pydantic import ValidationError

from backend.core.config import Settings
from backend.core.errors import http_error
from backend.core.io import read_json, write_json
from backend.core.models import (
    ImportPackRequest,
    ImportPackResponse,
    PackSource,
    ProjectConfig,
    ProjectConfigProject,
    ProjectCreateRequest,
    ProjectCreateResponse,
    ProjectInfo,
    ProjectLayer,
    ProjectManifest,
    ProjectOpenRequest,
    ProjectOpenResponse,
    WorkspaceDefaults,
    WorkspaceOpenRequest,
    WorkspaceOpenResponse,
)
from backend.core.project_service import load_project_config, save_project_config
from backend.core.index_service import rebuild_project_index
from backend.core.pydantic_compat import model_dump
from backend.core.state import WORKSPACE_ROOT_BY_ID
from backend.core.vfs import mount_from_source, read_json_from_mount


logger = logging.getLogger("uvicorn.error")


def _workspace_id_for_root(root: Path) -> str:
    # Stable ID derived from path, good enough for MVP.
    normalized = str(root.resolve()).replace("\\", "/").lower().encode("utf-8")
    return hashlib.sha1(normalized).hexdigest()


def _workspace_config_path(root: Path) -> Path:
    return root / "has.workspace.json"


def _project_config_path(project_root: Path) -> Path:
    return project_root / "has.project.json"


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


def _normalize_import_manifest(pack_mount) -> dict | None:
    if not pack_mount.exists("manifest.json"):
        return None

    try:
        manifest = read_json_from_mount(pack_mount, "manifest.json")
    except HTTPException as exc:
        raise http_error(
            422,
            "MANIFEST_INVALID",
            "Imported pack manifest.json is invalid",
            {"source": str(pack_mount.root), "detail": exc.detail},
        )

    if not isinstance(manifest, dict):
        raise http_error(
            422,
            "MANIFEST_INVALID",
            "Imported pack manifest.json must contain an object at the root",
            {"source": str(pack_mount.root)},
        )

    try:
        normalized = ProjectManifest(**manifest)
    except ValidationError as exc:
        raise http_error(
            422,
            "MANIFEST_INVALID",
            "Imported pack manifest.json does not match the expected schema",
            {"source": str(pack_mount.root), "error": str(exc)},
        )

    return model_dump(normalized)


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


def register_workspace_root(root: Path) -> str:
    workspace_id = _workspace_id_for_root(root)
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

        write_json(cfg_path, model_dump(cfg))
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


def import_pack(settings: Settings, req: ImportPackRequest) -> ImportPackResponse:
    # Validate pack source + prefix detection
    pack_mount = mount_from_source(
        mount_id="import-pack",
        origin="dependency",
        source_type=req.pack.sourceType,
        path=req.pack.path,
    )

    manifest = _normalize_import_manifest(pack_mount)

    display_name = (req.newProject.displayName or "").strip()
    project_id = (req.newProject.projectId or "").strip()

    if not display_name:
        name_from_manifest = None
        if isinstance(manifest, dict):
            name_from_manifest = manifest.get("Name")
        display_name = str(name_from_manifest).strip() if name_from_manifest else "Imported Pack (Overrides)"

    if not project_id:
        base = None
        if isinstance(manifest, dict):
            base = manifest.get("Name") or manifest.get("Group")
        if not base:
            base = Path(req.pack.path).stem
        project_id = _slugify(str(base)) or "imported-pack"

    workspace_defaults = _load_workspace_defaults(settings)
    projects_dir = settings.workspace_root / "projects"
    target_dir = projects_dir / project_id

    cfg_path = _project_config_path(target_dir)
    created = False

    if not cfg_path.exists():
        created = True
        create_project(
            settings.workspace_root,
            ProjectCreateRequest(
                projectId=project_id,
                displayName=display_name,
                targetDir=str(target_dir),
                vanilla=workspace_defaults.vanilla,
                manifest=manifest or {"Group": project_id, "Name": display_name},
            ),
        )

    cfg, cfg_path2 = load_project_config(settings.workspace_root, project_id)

    layer_id = project_id
    new_layer = {
        "id": layer_id,
        "displayName": display_name,
        "sourceType": req.pack.sourceType,
        "path": req.pack.path,
        "enabled": True,
    }

    # Insert at layers[0] (spec)
    from backend.core.pydantic_compat import model_dump

    existing = [model_dump(l) for l in cfg.layers]
    existing = [l for l in existing if l.get("id") != layer_id]
    cfg.layers = [ProjectLayer(**new_layer)] + [ProjectLayer(**l) for l in existing]

    save_project_config(cfg_path2, cfg)

    rebuild_project_index(project_id, cfg)

    return ImportPackResponse(
        projectId=project_id,
        created=created,
        layer={"id": layer_id, "enabled": True},
    )
