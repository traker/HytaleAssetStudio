from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import HTTPException

import pytest
from backend.core.config import Settings
from backend.core.io import read_json, write_json
from backend.core.models import ImportPackNewProject, ImportPackRequest, PackSource
from backend.core.import_service import import_pack


class ImportPackTests:
    def make_settings(self, workspace_root: Path) -> Settings:
        return Settings(
            workspace_root=workspace_root,
            default_vanilla_source_type="folder",
            default_vanilla_path=str(workspace_root / "vanilla"),
        )

    def make_request(self, pack_root: Path, project_id: str | None = None, display_name: str | None = None) -> ImportPackRequest:
        return ImportPackRequest(
            pack=PackSource(sourceType="folder", path=str(pack_root)),
            newProject=ImportPackNewProject(projectId=project_id, displayName=display_name),
        )

    def setup_workspace(self, tmp: str) -> tuple[Path, Path]:
        workspace_root = Path(tmp) / "workspace"
        vanilla_root = workspace_root / "vanilla"
        pack_root = Path(tmp) / "pack"

        (workspace_root / "projects").mkdir(parents=True)
        (vanilla_root / "Common").mkdir(parents=True)
        (vanilla_root / "Server").mkdir(parents=True)
        (pack_root / "Common").mkdir(parents=True)
        (pack_root / "Server").mkdir(parents=True)

        return workspace_root, pack_root

    def test_import_pack_preserves_manifest_fields(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root, pack_root = self.setup_workspace(tmp)
            settings = self.make_settings(workspace_root)

            write_json(
                pack_root / "manifest.json",
                {
                    "Group": "legacy.group",
                    "Name": "Legacy Pack",
                    "Version": "2.5.1",
                    "Description": "Imported manifest",
                    "Authors": [{"Name": "Guill", "Email": "g@example.com"}],
                    "Website": "https://example.test",
                    "ServerVersion": "*",
                    "Dependencies": {"core:base": "1.0.0"},
                    "OptionalDependencies": {"extra:fx": "*"},
                    "DisabledByDefault": True,
                    "IncludesAssetPack": True,
                },
            )

            response = import_pack(settings, self.make_request(pack_root))

            manifest_path = workspace_root / "projects" / response.projectId / "manifest.json"
            manifest = read_json(manifest_path)
            assert manifest["Group"] == "legacy.group"
            assert manifest["Name"] == "Legacy Pack"
            assert manifest["Version"] == "2.5.1"
            assert manifest["Description"] == "Imported manifest"
            assert manifest["Authors"][0]["Name"] == "Guill"
            assert manifest["IncludesAssetPack"]
            assert manifest["DisabledByDefault"]

    def test_import_pack_rejects_invalid_manifest_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root, pack_root = self.setup_workspace(tmp)
            settings = self.make_settings(workspace_root)

            (pack_root / "manifest.json").write_text("{ invalid json", encoding="utf-8")

            with pytest.raises(HTTPException) as exc_info:
                import_pack(settings, self.make_request(pack_root))

            assert exc_info.value.status_code == 422
            assert exc_info.value.detail["error"]["code"] == "MANIFEST_INVALID"
            assert list((workspace_root / "projects").iterdir()) == []

    def test_import_pack_without_manifest_keeps_default_project_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root, pack_root = self.setup_workspace(tmp)
            settings = self.make_settings(workspace_root)

            response = import_pack(
                settings,
                self.make_request(pack_root, project_id="override-pack", display_name="Override Pack"),
            )

            manifest = read_json(workspace_root / "projects" / response.projectId / "manifest.json")
            assert manifest["Group"] == "override-pack"
            assert manifest["Name"] == "Override Pack"

