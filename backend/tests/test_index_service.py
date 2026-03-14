from __future__ import annotations

import tempfile
import time
from pathlib import Path

import pytest
from backend.core.index_service import ensure_index, rebuild_project_index
from backend.core.io import write_json
from backend.core.models import PackSource, ProjectConfig, ProjectConfigProject
from backend.core.state import PROJECT_INDEX, PROJECT_INDEX_FINGERPRINT


class IndexServiceCacheTests:
    def setup_method(self) -> None:
        PROJECT_INDEX.clear()
        PROJECT_INDEX_FINGERPRINT.clear()

    def teardown_method(self) -> None:
        PROJECT_INDEX.clear()
        PROJECT_INDEX_FINGERPRINT.clear()

    def make_config(self, project_root: Path, vanilla_root: Path) -> ProjectConfig:
        return ProjectConfig(
            project=ProjectConfigProject(
                id="index-cache-tests",
                displayName="Index Cache Tests",
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

    def test_ensure_index_invalidates_memory_cache_when_project_files_change(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword"})

            state1 = ensure_index(cfg.project.id, cfg)
            assert state1.server_json_count == 1

            time.sleep(0.01)
            write_json(project_root / "Server" / "Items" / "Axe.json", {"Id": "Axe"})

            state2 = ensure_index(cfg.project.id, cfg)
            assert state2.server_json_count == 2

    def test_ensure_index_invalidates_disk_cache_when_project_files_change(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword"})
            rebuild_project_index(cfg.project.id, cfg)

            PROJECT_INDEX.clear()
            PROJECT_INDEX_FINGERPRINT.clear()

            time.sleep(0.01)
            write_json(project_root / "Server" / "Items" / "Axe.json", {"Id": "Axe"})

            state = ensure_index(cfg.project.id, cfg)
            assert state.server_json_count == 2

    def test_index_tracks_lower_layer_presence_for_modification_classification(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword"})
            write_json(vanilla_root / "Common" / "Icons" / "Sword.png", {"fake": True})

            state = ensure_index(cfg.project.id, cfg)

            assert state.lower_layer_server_ids.get("Sword")
            assert state.lower_layer_vfs_paths.get("Server/Items/Sword.json")
            assert state.lower_layer_vfs_paths.get("Common/Icons/Sword.png")

