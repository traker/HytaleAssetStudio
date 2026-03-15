from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import HTTPException

import pytest
from backend.core.asset_service import write_server_json_copy, write_server_json_override
from backend.core.graph_service import build_modified_graph
from backend.core.index_service import ensure_index
from backend.core.io import write_json
from backend.core.models import PackSource, ProjectConfig, ProjectConfigProject
from backend.routes.assets import _list_modified_entries
from backend.core.state import PROJECT_INDEX, PROJECT_INDEX_FINGERPRINT


class AssetCopyTests:
    def setup_method(self) -> None:
        PROJECT_INDEX.clear()
        PROJECT_INDEX_FINGERPRINT.clear()

    def teardown_method(self) -> None:
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

            assert result["assetKey"] == "server:Sword_Copy"
            assert (project_root / "Server" / "Items" / "Sword_Copy.json").exists()

    def test_write_server_json_copy_rejects_existing_id_in_effective_graph(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword"})
            write_json(vanilla_root / "Server" / "Items" / "Axe.json", {"Id": "Axe"})

            with pytest.raises(HTTPException) as exc_info:
                write_server_json_copy(cfg, "server:Sword", "Axe", {"Id": "Axe"})

            assert exc_info.value.status_code == 409
            assert exc_info.value.detail["error"]["code"] == "ID_CONFLICT"
            assert not (project_root / "Server" / "Items" / "Axe.json").exists()

    def test_write_server_json_copy_rejects_existing_project_target_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword"})
            write_json(project_root / "Server" / "Items" / "Sword_Copy.json", {"Id": "Sword_Copy"})

            with pytest.raises(HTTPException) as exc_info:
                write_server_json_copy(cfg, "server:Sword", "Sword_Copy", {"Id": "Sword_Copy"})

            assert exc_info.value.status_code == 409
            assert exc_info.value.detail["error"]["code"] == "ID_CONFLICT"

    def test_write_server_json_override_updates_effective_index_immediately(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword", "Value": 1})

            initial_index = ensure_index(cfg.project.id, cfg)
            assert initial_index.origin_by_server_path["Server/Items/Sword.json"] == "vanilla"

            result = write_server_json_override(cfg, "server:Sword", {"Id": "Sword", "Value": 99})

            assert result["origin"] == "project"

            immediate_state = PROJECT_INDEX[cfg.project.id]
            assert immediate_state.origin_by_server_path["Server/Items/Sword.json"] == "project"
            assert immediate_state.effective_mount_by_vfs_path["Server/Items/Sword.json"] == "project"

            updated_index = ensure_index(cfg.project.id, cfg)
            assert updated_index.origin_by_server_path["Server/Items/Sword.json"] == "project"
            assert updated_index.effective_mount_by_vfs_path["Server/Items/Sword.json"] == "project"

    def test_write_server_json_copy_updates_memory_index_immediately(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword", "Value": 1})

            ensure_index(cfg.project.id, cfg)
            result = write_server_json_copy(cfg, "server:Sword", "Sword_Copy", {"Id": "Sword_Copy", "Value": 2})

            assert result["assetKey"] == "server:Sword_Copy"
            immediate_state = PROJECT_INDEX[cfg.project.id]
            assert immediate_state.origin_by_server_path["Server/Items/Sword_Copy.json"] == "project"
            assert immediate_state.effective_mount_by_vfs_path["Server/Items/Sword_Copy.json"] == "project"
            assert immediate_state.server_id_to_path["Sword_Copy"] == "Server/Items/Sword_Copy.json"

    def test_build_modified_graph_includes_unreferenced_new_copy_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword", "Value": 1})

            write_server_json_copy(cfg, "server:Sword", "Sword_Copy", {"Id": "Sword", "Value": 2})

            graph = build_modified_graph(cfg, 0)
            node_ids = {node["id"] for node in graph["nodes"]}

            assert "server:Sword_Copy" in node_ids
            assert "server:Sword_Copy" in graph["modifiedIds"]

    def test_build_modified_graph_marks_new_and_override_roots(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword", "Value": 1})
            write_json(vanilla_root / "Server" / "Items" / "Shield.json", {"Id": "Shield", "Value": 5})

            write_server_json_override(cfg, "server:Sword", {"Id": "Sword", "Value": 99})
            write_server_json_copy(cfg, "server:Shield", "Shield_Copy", {"Id": "Shield", "Value": 6})

            graph = build_modified_graph(cfg, 0)
            nodes = {node["id"]: node for node in graph["nodes"]}

            assert nodes["server:Sword"]["modificationKind"] == "override"
            assert nodes["server:Shield_Copy"]["modificationKind"] == "new"

    def test_same_server_id_in_different_project_path_is_still_override(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            vanilla_root = root / "vanilla"
            project_root = root / "project"
            (vanilla_root / "Common").mkdir(parents=True)
            (vanilla_root / "Server" / "Item" / "Items" / "Weapon" / "Sword").mkdir(parents=True)
            (project_root / "Common").mkdir(parents=True)
            (project_root / "Server" / "Item" / "Interactions" / "Weapons" / "Sword" / "Attacks" / "Primary").mkdir(parents=True)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(
                vanilla_root / "Server" / "Item" / "Items" / "Weapon" / "Sword" / "Weapon_Sword_Test.json",
                {"Id": "Weapon_Sword_Test", "Value": 1},
            )
            write_json(
                project_root / "Server" / "Item" / "Interactions" / "Weapons" / "Sword" / "Attacks" / "Primary" / "Weapon_Sword_Test.json",
                {"Id": "Weapon_Sword_Test", "Value": 2},
            )

            entries = {entry.vfsPath: entry for entry in _list_modified_entries(cfg)}
            graph = build_modified_graph(cfg, 0)
            node = next(
                item for item in graph["nodes"]
                if item["path"] == "Server/Item/Interactions/Weapons/Sword/Attacks/Primary/Weapon_Sword_Test.json"
            )

            assert entries["Server/Item/Interactions/Weapons/Sword/Attacks/Primary/Weapon_Sword_Test.json"].modificationKind == "override"
            assert node["modificationKind"] == "override"

    def test_build_modified_graph_resolves_quality_dependency_for_modified_item(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            vanilla_root = root / "vanilla"
            project_root = root / "project"
            (vanilla_root / "Common").mkdir(parents=True)
            (vanilla_root / "Server" / "Item" / "Items" / "Weapon").mkdir(parents=True)
            (vanilla_root / "Server" / "Item" / "Qualities").mkdir(parents=True)
            (project_root / "Common").mkdir(parents=True)
            (project_root / "Server" / "Item" / "Items" / "Weapon").mkdir(parents=True)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Item" / "Items" / "Weapon" / "Sword.json", {"Id": "Sword", "Quality": "Common"})
            write_json(vanilla_root / "Server" / "Item" / "Qualities" / "Rare.json", {"QualityValue": 3})
            write_json(project_root / "Server" / "Item" / "Items" / "Weapon" / "Sword.json", {"Id": "Sword", "Quality": "Rare"})

            graph = build_modified_graph(cfg, 1)
            nodes = {node["id"]: node for node in graph["nodes"]}
            edges = {(edge["from"], edge["to"], edge["type"]) for edge in graph["edges"]}

            assert "server:Sword" in nodes
            assert "server:Rare" in nodes
            assert nodes["server:Rare"]["group"] == "quality"
            assert ("server:Sword", "server:Rare", "quality") in edges

    def test_list_modified_entries_uses_server_path_and_marks_copy_vs_override(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Sword.json", {"Id": "Sword", "Value": 1})
            write_server_json_override(cfg, "server:Sword", {"Id": "Sword", "Value": 99})
            write_server_json_copy(cfg, "server:Sword", "Sword_Copy", {"Id": "Sword", "Value": 2})

            entries = {entry.vfsPath: entry for entry in _list_modified_entries(cfg)}

            assert entries["Server/Items/Sword.json"].assetKey == "server-path:Server/Items/Sword.json"
            assert entries["Server/Items/Sword.json"].modificationKind == "override"
            assert entries["Server/Items/Sword_Copy.json"].assetKey == "server-path:Server/Items/Sword_Copy.json"
            assert entries["Server/Items/Sword_Copy.json"].modificationKind == "new"

    def test_list_modified_entries_marks_common_resources_by_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            (vanilla_root / "Common" / "Icons").mkdir(parents=True, exist_ok=True)
            (project_root / "Common" / "Icons").mkdir(parents=True, exist_ok=True)
            (vanilla_root / "Common" / "Icons" / "Sword.png").write_text("vanilla", encoding="utf-8")
            (project_root / "Common" / "Icons" / "Sword.png").write_text("project-override", encoding="utf-8")
            (project_root / "Common" / "Icons" / "Axe.png").write_text("project-new", encoding="utf-8")

            entries = {entry.vfsPath: entry for entry in _list_modified_entries(cfg)}

            assert entries["Common/Icons/Sword.png"].assetKey == "common:Icons/Sword.png"
            assert entries["Common/Icons/Sword.png"].modificationKind == "override"
            assert entries["Common/Icons/Axe.png"].assetKey == "common:Icons/Axe.png"
            assert entries["Common/Icons/Axe.png"].modificationKind == "new"

