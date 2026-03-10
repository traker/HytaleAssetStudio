from __future__ import annotations

import hashlib
import re
from pathlib import Path

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
    ProjectOpenRequest,
    ProjectOpenResponse,
    WorkspaceDefaults,
    WorkspaceOpenRequest,
    WorkspaceOpenResponse,
)
from backend.core.project_service import load_project_config, save_project_config
from backend.core.index_service import rebuild_project_index
from backend.core.vfs import mount_from_source, read_json_from_mount


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
                "defaults": defaults_model.dict(),
            },
        )

    return WorkspaceOpenResponse(
        workspaceId=_workspace_id_for_root(root),
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
            project = cfg.get("project") or {}
            project_id = project.get("id") or cfg_path.parent.name
            result.append(
                ProjectInfo(
                    projectId=project_id,
                    displayName=project.get("displayName"),
                    rootPath=project.get("rootPath", str(cfg_path.parent)),
                    assetsWritePath=project.get("assetsWritePath", project.get("rootPath", str(cfg_path.parent))),
                )
            )
        except Exception:
            continue

    # Deduplicate by projectId (keep first)
    seen: set[str] = set()
    deduped: list[ProjectInfo] = []
    for p in result:
        if p.projectId in seen:
            continue
        seen.add(p.projectId)
        deduped.append(p)
    return sorted(deduped, key=lambda p: p.projectId)


def create_project(workspace_root: Path, req: ProjectCreateRequest) -> ProjectCreateResponse:
    project_root = Path(req.targetDir)
    project_root.mkdir(parents=True, exist_ok=True)

    # Ensure pack-like layout exists (empty is OK for now).
    (project_root / "Common").mkdir(parents=True, exist_ok=True)
    (project_root / "Server").mkdir(parents=True, exist_ok=True)

    manifest_data = req.manifest or {
        "Group": req.projectId,
        "Name": req.displayName,
        "Version": "1.0.0",
        "Description": "",
        "Authors": [],
        "Website": "",
        "ServerVersion": "*",
        "DisabledByDefault": False,
        "IncludesAssetPack": True,
    }
    write_json(project_root / "manifest.json", manifest_data)

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
    if cfg_path.exists():
        raise http_error(409, "PROJECT_EXISTS", "Project already exists at targetDir", {"targetDir": str(project_root)})

    write_json(cfg_path, cfg.dict())

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

    manifest: dict | None = None
    if pack_mount.exists("manifest.json"):
        try:
            manifest = read_json_from_mount(pack_mount, "manifest.json")
        except Exception:
            manifest = None

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
                manifest={"Group": project_id, "Name": display_name},
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
