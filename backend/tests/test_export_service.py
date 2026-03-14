from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path

from fastapi import HTTPException

import pytest
from backend.core.export_service import export_project_zip
from backend.core.io import write_json
from backend.core.models import PackSource, ProjectConfig, ProjectConfigProject


class ExportProjectZipTests:
    def make_config(self, project_root: Path) -> ProjectConfig:
        return ProjectConfig(
            project=ProjectConfigProject(
                id="demo-project",
                displayName="Demo Project",
                rootPath=str(project_root),
                assetsWritePath=str(project_root),
            ),
            vanilla=PackSource(sourceType="folder", path="K:/vanilla/Assets"),
            layers=[],
        )

    def write_valid_manifest(self, project_root: Path) -> None:
        write_json(
            project_root / "manifest.json",
            {
                "Group": "demo-project",
                "Name": "Demo Project",
                "Version": "1.0.0",
            },
        )

    def test_export_fails_without_valid_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root = Path(tmp) / "project"
            project_root.mkdir(parents=True)
            cfg = self.make_config(project_root)

            with pytest.raises(HTTPException) as exc_info:
                export_project_zip(cfg, str(project_root / "out.zip"))

            assert exc_info.value.status_code == 422

    def test_export_whitelist_excludes_studio_internal_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root = Path(tmp) / "project"
            (project_root / "Common" / "Icons").mkdir(parents=True)
            (project_root / "Server" / "Items").mkdir(parents=True)
            (project_root / ".studio_cache").mkdir(parents=True)
            cfg = self.make_config(project_root)

            self.write_valid_manifest(project_root)
            write_json(project_root / "Server" / "Items" / "Sword.json", {"Id": "Sword"})
            (project_root / "Common" / "Icons" / "Sword.png").write_bytes(b"png")
            write_json(project_root / "has.project.json", {"schemaVersion": 1})
            write_json(project_root / ".studio_cache" / "index.json", {"cached": True})
            write_json(project_root / "notes.json", {"debug": True})

            output_path = project_root / "export.zip"
            export_project_zip(cfg, str(output_path))

            with zipfile.ZipFile(output_path, "r") as archive:
                names = sorted(archive.namelist())

            assert names == [ "Common/Icons/Sword.png", "Server/Items/Sword.json", "manifest.json", ]

    def test_export_keeps_only_pack_paths(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root = Path(tmp) / "project"
            (project_root / "Server").mkdir(parents=True)
            cfg = self.make_config(project_root)

            self.write_valid_manifest(project_root)
            write_json(project_root / "Server" / "Root.json", {"Type": "Simple"})
            write_json(project_root / "README.json", {"debug": True})

            output_path = project_root / "export.zip"
            export_project_zip(cfg, str(output_path))

            with zipfile.ZipFile(output_path, "r") as archive:
                names = sorted(archive.namelist())

            assert "README.json" not in names
            assert "Server/Root.json" in names
            assert "manifest.json" in names

