from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException

from backend.core.asset_service import write_server_json_copy, write_server_json_override
from backend.core.index_service import ensure_index
from backend.core.io import write_json
from backend.core.models import PackSource, ProjectConfig, ProjectConfigProject
from backend.core.state import PROJECT_INDEX, PROJECT_INDEX_FINGERPRINT


class AssetCopyTests(unittest.TestCase):
    def setUp(self) -> None:
        PROJECT_INDEX.clear()
        PROJECT_INDEX_FINGERPRINT.clear()

    def tearDown(self) -> None:
        PROJECT_INDEX.clear()
        PROJECT_INDEX_FINGERPRINT.clear()

    def make_config(self, project_root: Path, vanilla_root: Path) -> ProjectConfig:
        return ProjectConfig(
            project=ProjectConfigProject(
                id="asset-copy-tests",
                displayName="Asset Copy Tests",
                rootPath=str(project_root),
                assetsWritePath=str(project_root),
            ),
            vanilla=PackSource(sourceType="folder", path=str(vanilla_root)),
            layers=[],
        )

    def setup_pack_roots(self, tmp: str) -> tuple[Path, Path]:
        root = Path(tmp)
        vanilla_root = root / "vanilla"
        project_root = root / "project"
        (vanilla_root / "Common").mkdir(parents=True)
        (vanilla_root / "Server" / "Items").mkdir(parents=True)
        (project_root / "Common").mkdir(parents=True)
        (project_root / "Server" / "Items").mkdir(parents=True)
        return project_root, vanilla_root

    def test_write_server_json_copy_creates_new_asset(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword", "Value": 1})

            result = write_server_json_copy(cfg, "server:Sword", "Sword_Copy", {"Id": "Sword_Copy", "Value": 2})

            self.assertEqual(result["assetKey"], "server:Sword_Copy")
            self.assertTrue((project_root / "Server" / "Items" / "Sword_Copy.json").exists())

    def test_write_server_json_copy_rejects_existing_id_in_effective_graph(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword"})
            write_json(vanilla_root / "Server" / "Items" / "Axe.json", {"Id": "Axe"})

            with self.assertRaises(HTTPException) as ctx:
                write_server_json_copy(cfg, "server:Sword", "Axe", {"Id": "Axe"})

            self.assertEqual(ctx.exception.status_code, 409)
            self.assertEqual(ctx.exception.detail["error"]["code"], "ID_CONFLICT")
            self.assertFalse((project_root / "Server" / "Items" / "Axe.json").exists())

    def test_write_server_json_copy_rejects_existing_project_target_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword"})
            write_json(project_root / "Server" / "Items" / "Sword_Copy.json", {"Id": "Sword_Copy"})

            with self.assertRaises(HTTPException) as ctx:
                write_server_json_copy(cfg, "server:Sword", "Sword_Copy", {"Id": "Sword_Copy"})

            self.assertEqual(ctx.exception.status_code, 409)
            self.assertEqual(ctx.exception.detail["error"]["code"], "ID_CONFLICT")

    def test_write_server_json_override_updates_effective_index_immediately(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword", "Value": 1})

            initial_index = ensure_index(cfg.project.id, cfg)
            self.assertEqual(initial_index.origin_by_server_path["Server/Items/Sword.json"], "vanilla")

            result = write_server_json_override(cfg, "server:Sword", {"Id": "Sword", "Value": 99})

            self.assertEqual(result["origin"], "project")

            updated_index = ensure_index(cfg.project.id, cfg)
            self.assertEqual(updated_index.origin_by_server_path["Server/Items/Sword.json"], "project")
            self.assertEqual(updated_index.effective_mount_by_vfs_path["Server/Items/Sword.json"], "project")


if __name__ == "__main__":
    unittest.main()