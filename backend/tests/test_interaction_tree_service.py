from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
from backend.core.interaction_tree_service import build_interaction_tree
from backend.core.io import write_json
from backend.core.models import PackSource, ProjectConfig, ProjectConfigProject
from backend.core.state import PROJECT_INDEX, PROJECT_INDEX_FINGERPRINT


class InteractionTreeServiceTests:
    def setup_method(self) -> None:
        PROJECT_INDEX.clear()
        PROJECT_INDEX_FINGERPRINT.clear()

    def teardown_method(self) -> None:
        PROJECT_INDEX.clear()
        PROJECT_INDEX_FINGERPRINT.clear()

    def setup_workspace(self, tmp: str) -> tuple[Path, Path, Path]:
        root = Path(tmp)
        workspace_root = root / "workspace"
        projects_dir = workspace_root / "projects"
        project_root = projects_dir / "interaction-tests"
        vanilla_root = root / "vanilla"

        (project_root / "Common").mkdir(parents=True)
        (project_root / "Server" / "Item" / "Interactions").mkdir(parents=True)
        (vanilla_root / "Common").mkdir(parents=True)
        (vanilla_root / "Server").mkdir(parents=True)

        cfg = ProjectConfig(
            project=ProjectConfigProject(
                id="interaction-tests",
                displayName="Interaction Tests",
                rootPath=str(project_root),
                assetsWritePath=str(project_root),
            ),
            vanilla=PackSource(sourceType="folder", path=str(vanilla_root)),
            layers=[],
        )
        write_json(project_root / "has.project.json", cfg.model_dump())
        return workspace_root, project_root, vanilla_root

    def test_build_interaction_tree_preserves_parallel_fork_edges(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root, project_root, _ = self.setup_workspace(tmp)

            write_json(
                project_root / "Server" / "Item" / "Interactions" / "ParallelTest.json",
                {
                    "Type": "Parallel",
                    "Interactions": [{"Type": "Simple", "RunTime": 0.1}],
                    "ForkInteractions": [{"Type": "Simple", "RunTime": 0.2}],
                    "Next": {"Type": "Simple", "RunTime": 0.3},
                },
            )

            tree = build_interaction_tree("interaction-tests", "server:ParallelTest", workspace_root)
            edge_types = {(edge["from"], edge["type"]) for edge in tree["edges"]}

            assert ("internal:root", "child") in edge_types
            assert ("internal:root", "fork") in edge_types
            assert ("internal:root", "next") in edge_types

    def test_build_interaction_tree_exposes_external_refs_as_ref_nodes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root, project_root, vanilla_root = self.setup_workspace(tmp)

            write_json(
                vanilla_root / "Server" / "Item" / "Interactions" / "SharedFollowup.json",
                {
                    "Type": "Simple",
                    "RunTime": 0.2,
                },
            )
            write_json(
                project_root / "Server" / "Item" / "Interactions" / "ExternalRefRoot.json",
                {
                    "Type": "Condition",
                    "Next": "SharedFollowup",
                },
            )

            tree = build_interaction_tree("interaction-tests", "server:ExternalRefRoot", workspace_root)
            nodes_by_id = {node["id"]: node for node in tree["nodes"]}
            edge_targets = {
                (edge["from"], edge["to"], edge["type"])
                for edge in tree["edges"]
            }

            assert "server:SharedFollowup" in nodes_by_id
            assert nodes_by_id["server:SharedFollowup"]["type"] == "_ref"
            assert nodes_by_id["server:SharedFollowup"]["rawFields"] == {"ServerId": "SharedFollowup"}
            assert ("internal:root", "server:SharedFollowup", "next") in edge_targets

    def test_build_interaction_tree_preserves_projectile_collision_and_ground_edges(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root, project_root, _ = self.setup_workspace(tmp)

            write_json(
                project_root / "Server" / "Item" / "Interactions" / "ProjectileTest.json",
                {
                    "Type": "Projectile",
                    "CollisionNext": {"Type": "Simple", "RunTime": 0.1},
                    "GroundNext": {"Type": "Simple", "RunTime": 0.2},
                },
            )

            tree = build_interaction_tree("interaction-tests", "server:ProjectileTest", workspace_root)
            edge_types = {(edge["from"], edge["type"]) for edge in tree["edges"]}

            assert ("internal:root", "collisionNext") in edge_types
            assert ("internal:root", "groundNext") in edge_types

    def test_build_interaction_tree_preserves_wielding_blocked_edges(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root, project_root, _ = self.setup_workspace(tmp)

            write_json(
                project_root / "Server" / "Item" / "Interactions" / "WieldingTest.json",
                {
                    "Type": "Wielding",
                    "Next": {"Type": "Simple", "RunTime": 0.1},
                    "BlockedInteractions": [{"Type": "Simple", "RunTime": 0.2}],
                },
            )

            tree = build_interaction_tree("interaction-tests", "server:WieldingTest", workspace_root)
            edge_types = {(edge["from"], edge["type"]) for edge in tree["edges"]}

            assert ("internal:root", "next") in edge_types
            assert ("internal:root", "blocked") in edge_types

    def test_build_interaction_tree_preserves_selector_hit_containers(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root, project_root, _ = self.setup_workspace(tmp)

            write_json(
                project_root / "Server" / "Item" / "Interactions" / "SelectorTest.json",
                {
                    "Type": "Selector",
                    "Selector": {"Id": "Horizontal"},
                    "HitEntity": {"Interactions": [{"Type": "Simple", "RunTime": 0.1}]},
                    "HitBlock": {"Interactions": [{"Type": "Simple", "RunTime": 0.2}]},
                    "HitNothing": {"Interactions": [{"Type": "Simple", "RunTime": 0.3}]},
                },
            )

            tree = build_interaction_tree("interaction-tests", "server:SelectorTest", workspace_root)
            edge_types = {(edge["from"], edge["type"]) for edge in tree["edges"]}

            assert ("internal:root", "hitEntity") in edge_types
            assert ("internal:root", "hitBlock") in edge_types
            assert ("internal:root", "hitNothing") in edge_types

    def test_build_interaction_tree_preserves_parallel_children_wrapped_in_anonymous_containers(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root, project_root, _ = self.setup_workspace(tmp)

            write_json(
                project_root / "Server" / "Item" / "Interactions" / "ParallelWrappedChildren.json",
                {
                    "Type": "Parallel",
                    "Interactions": [
                        {
                            "Interactions": [
                                {
                                    "Type": "Selector",
                                    "Selector": {"Id": "Horizontal"},
                                }
                            ]
                        },
                        {
                            "Interactions": [
                                {
                                    "Type": "Replace",
                                    "Var": "WrappedVar",
                                }
                            ]
                        },
                    ],
                },
            )

            tree = build_interaction_tree("interaction-tests", "server:ParallelWrappedChildren", workspace_root)
            edge_targets = {
                (edge["from"], edge["to"], edge["type"])
                for edge in tree["edges"]
            }

            assert ( "internal:root", "internal:root/Interactions/0/Interactions/0", "child", ) in edge_targets
            assert ( "internal:root", "internal:root/Interactions/1/Interactions/0", "child", ) in edge_targets

    def test_build_interaction_tree_does_not_duplicate_charging_step_edges(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root, project_root, _ = self.setup_workspace(tmp)

            write_json(
                project_root / "Server" / "Item" / "Interactions" / "ChargingDuplicates.json",
                {
                    "Type": "Charging",
                    "Next": {
                        "0.1": {
                            "Type": "Condition",
                            "Next": {"Type": "Simple", "RunTime": 0.2},
                            "Failed": {"Type": "Simple", "RunTime": 0.3},
                        },
                        "0.3": {
                            "Type": "Condition",
                            "Next": {"Type": "Simple", "RunTime": 0.4},
                            "Failed": {"Type": "Simple", "RunTime": 0.5},
                        },
                    },
                },
            )

            tree = build_interaction_tree("interaction-tests", "server:ChargingDuplicates", workspace_root)
            edge_counts: dict[tuple[str, str, str], int] = {}
            for edge in tree["edges"]:
                key = (edge["from"], edge["to"], edge["type"])
                edge_counts[key] = edge_counts.get(key, 0) + 1

            assert edge_counts.get( ( "internal:root/Next/0.1", "internal:root/Next/0.1/Failed", "failed", ) ) == 1
            assert edge_counts.get( ( "internal:root/Next/0.3", "internal:root/Next/0.3/Next", "next", ) ) == 1
            assert edge_counts.get( ( "internal:root/Next/0.3", "internal:root/Next/0.3/Failed", "failed", ) ) == 1

    def test_build_interaction_tree_preserves_charging_entrypoints_and_failed_branch(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root, project_root, _ = self.setup_workspace(tmp)

            write_json(
                project_root / "Server" / "Item" / "Interactions" / "ChargingFixture.json",
                {
                    "Type": "Charging",
                    "Failed": {"Type": "Simple", "RunTime": 0.9},
                    "Next": {
                        "0.1": {"Type": "Replace", "Var": "Charge_A"},
                        "0.35": {"Type": "Replace", "Var": "Charge_B"},
                    },
                },
            )

            tree = build_interaction_tree("interaction-tests", "server:ChargingFixture", workspace_root)
            edge_targets = {
                (edge["from"], edge["to"], edge["type"])
                for edge in tree["edges"]
            }

            assert ("internal:root", "internal:root/Next/0.1", "next") in edge_targets
            assert ("internal:root", "internal:root/Next/0.35", "next") in edge_targets
            assert ("internal:root", "internal:root/Failed", "failed") in edge_targets

    def test_build_interaction_tree_preserves_replace_next_and_default_value_branches(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root, project_root, vanilla_root = self.setup_workspace(tmp)

            write_json(
                vanilla_root / "Server" / "Item" / "Interactions" / "ReplaceFallback.json",
                {
                    "Type": "Simple",
                    "RunTime": 0.15,
                },
            )

            write_json(
                project_root / "Server" / "Item" / "Interactions" / "ReplaceFixture.json",
                {
                    "Type": "Replace",
                    "Var": "Swing_Left",
                    "DefaultValue": {
                        "Interactions": [
                            "ReplaceFallback",
                            {"Type": "Simple", "RunTime": 0.15},
                        ]
                    },
                    "Next": {"Type": "Simple", "RunTime": 0.45},
                },
            )

            tree = build_interaction_tree("interaction-tests", "server:ReplaceFixture", workspace_root)
            edge_targets = {
                (edge["from"], edge["to"], edge["type"])
                for edge in tree["edges"]
            }

            assert ("internal:root", "internal:root/Next", "next") in edge_targets
            assert ("internal:root", "server:ReplaceFallback", "replace") in edge_targets
            assert ("internal:root", "server:ReplaceFallback", "child") not in edge_targets
            assert ("internal:root", "internal:root/DefaultValue/Interactions/1", "replace") in edge_targets

    def test_build_interaction_tree_keeps_replace_nodes_connected_inside_parallel_wrappers(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            workspace_root, project_root, _ = self.setup_workspace(tmp)

            write_json(
                project_root / "Server" / "Item" / "Interactions" / "HarmonyFluteSecondary.json",
                {
                    "Type": "Simple",
                    "$Comment": "Prepare Delay",
                    "RunTime": 0.167,
                    "Next": {
                        "Type": "Parallel",
                        "$Comment": "Resolve per-item vars (launch + cooldown visual)",
                        "Interactions": [
                            {
                                "Interactions": [
                                    {
                                        "Type": "Replace",
                                        "Var": "FineCraft_Harmony_Instrument_Secondary_Launch",
                                        "DefaultOk": True,
                                        "DefaultValue": {
                                            "Interactions": [
                                                "FineCraft_Harmony_Instrument_Cast_Fail"
                                            ]
                                        },
                                    }
                                ]
                            },
                            {
                                "Interactions": [
                                    {
                                        "Type": "Replace",
                                        "Var": "FineCraft_Harmony_Instrument_Cooldown_Visual_Secondary",
                                        "DefaultOk": True,
                                        "DefaultValue": {
                                            "Interactions": [
                                                {
                                                    "Type": "Simple",
                                                    "RunTime": 0,
                                                }
                                            ]
                                        },
                                    }
                                ]
                            },
                        ],
                    },
                    "Failed": {
                        "Type": "Replace",
                        "Var": "FineCraft_Harmony_Instrument_Fail",
                        "DefaultOk": True,
                        "DefaultValue": {
                            "Interactions": [
                                "FineCraft_Harmony_Instrument_Cast_Fail"
                            ]
                        },
                    },
                },
            )

            tree = build_interaction_tree("interaction-tests", "server:HarmonyFluteSecondary", workspace_root)
            edge_targets = {
                (edge["from"], edge["to"], edge["type"])
                for edge in tree["edges"]
            }

            assert ("internal:root", "internal:root/Next", "next") in edge_targets
            assert ("internal:root", "internal:root/Failed", "failed") in edge_targets
            assert ("internal:root/Next", "internal:root/Next/Interactions/0/Interactions/0", "child") in edge_targets
            assert ("internal:root/Next", "internal:root/Next/Interactions/1/Interactions/0", "child") in edge_targets

