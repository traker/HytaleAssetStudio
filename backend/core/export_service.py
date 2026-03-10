from __future__ import annotations

import json
import zipfile
from pathlib import Path

from backend.core.errors import http_error
from backend.core.models import ProjectConfig


def _is_under_root(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except Exception:
        return False


def _iter_project_files(project_root: Path) -> list[Path]:
    # Export everything that belongs to the pack, but skip studio metadata.
    # Keep this intentionally minimal for MVP.
    skip_names = {"has.project.json"}

    files: list[Path] = []
    if not project_root.exists():
        return files

    for p in project_root.rglob("*"):
        if not p.is_file():
            continue
        if p.name in skip_names:
            continue
        files.append(p)

    return files


def _validate_manifest(project_root: Path) -> dict:
    manifest_path = project_root / "manifest.json"
    if not manifest_path.exists():
        raise http_error(422, "MANIFEST_MISSING", "manifest.json is required for export", {"path": str(manifest_path)})

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise http_error(422, "MANIFEST_INVALID", "manifest.json must be valid JSON", {"path": str(manifest_path), "error": str(e)})

    if not isinstance(manifest, dict):
        raise http_error(422, "MANIFEST_INVALID", "manifest.json root must be an object", {"path": str(manifest_path)})

    group = manifest.get("Group")
    name = manifest.get("Name")
    if not isinstance(group, str) or not group.strip() or not isinstance(name, str) or not name.strip():
        raise http_error(
            422,
            "MANIFEST_INVALID",
            "manifest.json must contain non-empty string fields Group and Name",
            {"path": str(manifest_path), "Group": group, "Name": name},
        )

    version = manifest.get("Version")
    if not isinstance(version, str) or not version.strip():
        raise http_error(
            422,
            "MANIFEST_INVALID",
            "manifest.json must contain a non-empty string field Version",
            {"path": str(manifest_path), "Version": version},
        )

    return manifest


def export_project_zip(cfg: ProjectConfig, output_path: str) -> dict:
    project_root = Path(cfg.project.assetsWritePath)
    if not project_root.exists():
        raise http_error(404, "PROJECT_ROOT_MISSING", "Project assetsWritePath does not exist", {"path": str(project_root)})

    _validate_manifest(project_root)

    out = Path(output_path)
    if out.suffix.lower() != ".zip":
        raise http_error(422, "OUTPUT_INVALID", "outputPath must end with .zip", {"outputPath": output_path})

    out.parent.mkdir(parents=True, exist_ok=True)

    # Ensure we don't accidentally zip outside of the project root
    files = _iter_project_files(project_root)
    for f in files:
        if not _is_under_root(f, project_root):
            raise http_error(422, "PATH_INVALID", "File escapes project root", {"path": str(f), "root": str(project_root)})

    # Write zip
    try:
        with zipfile.ZipFile(out, mode="w", compression=zipfile.ZIP_DEFLATED) as z:
            for f in sorted(files):
                arcname = str(f.relative_to(project_root)).replace("\\", "/")
                z.write(f, arcname)
    except Exception as e:
        raise http_error(500, "EXPORT_FAILED", "Failed to write zip", {"outputPath": str(out), "error": str(e)})

    return {"ok": True, "outputPath": str(out)}
