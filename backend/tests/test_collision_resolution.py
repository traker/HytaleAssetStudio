from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException

from backend.core.asset_service import read_server_json
from backend.core.graph_service import build_focus_graph
from backend.core.index_service import ensure_index
from backend.core.io import write_json
from backend.core.models import PackSource, ProjectConfig, ProjectConfigProject
from backend.routes.index_graph import _build_search_results
from backend.core.state import PROJECT_INDEX, PROJECT_INDEX_FINGERPRINT


class CollisionResolutionTests(unittest.TestCase):
    def setUp(self) -> None:
        PROJECT_INDEX.clear()
        PROJECT_INDEX_FINGERPRINT.clear()

    def tearDown(self) -> None:
        PROJECT_INDEX.clear()
        PROJECT_INDEX_FINGERPRINT.clear()

    def make_config(self, project_root: Path, vanilla_root: Path) -> ProjectConfig:
        return ProjectConfig(
            project=ProjectConfigProject(
                id="collision-tests",
                displayName="Collision Tests",
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
        (vanilla_root / "Server" / "Items" / "Weapon").mkdir(parents=True)
        (vanilla_root / "Server" / "Items" / "Tools").mkdir(parents=True)
        (project_root / "Common").mkdir(parents=True)
        (project_root / "Server").mkdir(parents=True)
        return project_root, vanilla_root

    def test_search_exposes_ambiguous_candidates_by_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Weapon" / "Shared.json", {"Id": "Shared"})
            write_json(vanilla_root / "Server" / "Items" / "Tools" / "Shared.json", {"Id": "Shared"})

            index = ensure_index(cfg.project.id, cfg)
            results = _build_search_results(index, "Shared", 10)

            self.assertEqual(len(results), 2)
            self.assertTrue(all(r["ambiguous"] for r in results))
            self.assertTrue(all(r["assetKey"].startswith("server-path:") for r in results))

    def test_read_server_json_supports_server_path_key(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            path = vanilla_root / "Server" / "Items" / "Weapon" / "Shared.json"
            write_json(path, {"Id": "Shared", "Power": 10})
            write_json(vanilla_root / "Server" / "Items" / "Tools" / "Shared.json", {"Id": "Shared", "Power": 3})

            response = read_server_json(cfg, "server-path:Server/Items/Weapon/Shared.json")

            self.assertEqual(response["resolvedPath"], "Server/Items/Weapon/Shared.json")
            self.assertEqual(response["json"]["Power"], 10)

    def test_read_server_json_returns_structured_error_for_ambiguous_server_id(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(vanilla_root / "Server" / "Items" / "Weapon" / "Shared.json", {"Id": "Shared", "Power": 10})
            write_json(vanilla_root / "Server" / "Items" / "Tools" / "Shared.json", {"Id": "Shared", "Power": 3})

            with self.assertRaises(HTTPException) as ctx:
                read_server_json(cfg, "server:Shared")

            self.assertEqual(ctx.exception.status_code, 409)
            self.assertEqual(ctx.exception.detail["error"]["code"], "ID_AMBIGUOUS")
            self.assertEqual(
                ctx.exception.detail["error"]["details"]["paths"],
                ["Server/Items/Tools/Shared.json", "Server/Items/Weapon/Shared.json"],
            )

    def test_build_focus_graph_accepts_server_path_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root, vanilla_root = self.setup_pack_roots(tmp)
            cfg = self.make_config(project_root, vanilla_root)

            write_json(
                vanilla_root / "Server" / "Items" / "Weapon" / "Shared.json",
                {"Id": "Shared", "Next": "Child"},
            )
            write_json(vanilla_root / "Server" / "Items" / "Tools" / "Shared.json", {"Id": "Shared"})
            write_json(vanilla_root / "Server" / "Items" / "Weapon" / "Child.json", {"Id": "Child"})

            graph = build_focus_graph(cfg, "server-path:Server/Items/Weapon/Shared.json", 1)
            node_ids = {node["id"] for node in graph["nodes"]}

            self.assertIn("server-path:Server/Items/Weapon/Shared.json", node_ids)


if __name__ == "__main__":
    unittest.main()