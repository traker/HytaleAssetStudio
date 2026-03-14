from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException
from pydantic import ValidationError

from backend.core.config import Settings
from backend.core.errors import http_error
from backend.core.index_service import rebuild_project_index
from backend.core.models import (
    ImportPackRequest,
    ImportPackResponse,
    ProjectCreateRequest,
    ProjectLayer,
    ProjectManifest,
)
from backend.core.project_create_service import _slugify, create_project
from backend.core.project_service import load_project_config, save_project_config
from backend.core.vfs import mount_from_source, read_json_from_mount
from backend.core.workspace_service import _load_workspace_defaults, _project_config_path


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

    return normalized.model_dump()


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

    existing = [l.model_dump() for l in cfg.layers]
    existing = [l for l in existing if l.get("id") != layer_id]
    cfg.layers = [ProjectLayer(**new_layer)] + [ProjectLayer(**l) for l in existing]

    save_project_config(cfg_path2, cfg)

    rebuild_project_index(project_id, cfg)

    return ImportPackResponse(
        projectId=project_id,
        created=created,
        layer={"id": layer_id, "enabled": True},
    )
