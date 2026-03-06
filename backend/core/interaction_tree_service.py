from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.core.asset_service import read_server_json
from backend.core.config import get_settings
from backend.core.index_service import ensure_index
from backend.core.project_service import load_project_config


@dataclass(frozen=True)
class _Ref:
    kind: str
    value: str


_REL_KEY_TO_EDGE_TYPE: dict[str, str] = {
    "Next": "next",
    "Failed": "failed",
    "Interactions": "child",
    "ForkInteractions": "child",
    "BlockedInteractions": "child",
    "CollisionNext": "next",
    "GroundNext": "next",
    "StartInteraction": "child",
    "CancelInteraction": "child",
}


def build_interaction_tree(project_id: str, root_key: str, max_nodes: int = 5000) -> dict:
    settings = get_settings()
    cfg, _ = load_project_config(settings.workspace_root, project_id)
    index = ensure_index(project_id, cfg)

    root_server_id = root_key
    if root_server_id.startswith("server:"):
        root_server_id = root_server_id.split(":", 1)[1]

    asset_key = f"server:{root_server_id}"
    resp = read_server_json(cfg, asset_key)
    data = resp.get("json")

    nodes_by_id: dict[str, dict] = {}
    edges: list[dict] = []

    def add_node(node: dict) -> None:
        if node["id"] in nodes_by_id:
            return
        nodes_by_id[node["id"]] = node

    def add_edge(src: str, dst: str, typ: str) -> None:
        edges.append({"from": src, "to": dst, "type": typ})

    def is_external_server_ref(s: str) -> bool:
        # We only treat it as external if it exists as a known server json id.
        return s in index.server_id_to_all_paths

    def make_node_id(path: str) -> str:
        return f"internal:{path}"

    def scan_value(value: Any, path: str) -> _Ref | None:
        if isinstance(value, dict):
            if "Type" in value and isinstance(value["Type"], str):
                node_id = make_node_id(path)
                add_node(
                    {
                        "id": node_id,
                        "type": value.get("Type", "Interaction"),
                        "label": value.get("Type", "Interaction"),
                        "isExternal": False,
                        "rawFields": value,
                    }
                )
                # Also scan outgoing references
                for k, edge_type in _REL_KEY_TO_EDGE_TYPE.items():
                    if k not in value:
                        continue
                    target = value.get(k)
                    if target is None:
                        continue
                    if isinstance(target, list):
                        for i, t in enumerate(target):
                            ref = scan_value(t, f"{path}/{k}/{i}")
                            if ref:
                                add_edge(node_id, ref.value, edge_type)
                    else:
                        ref = scan_value(target, f"{path}/{k}")
                        if ref:
                            add_edge(node_id, ref.value, edge_type)
                return _Ref(kind="node", value=node_id)

            # Not a Type node; keep scanning children looking for nodes.
            for k, v in value.items():
                scan_value(v, f"{path}/{k}")
            return None

        if isinstance(value, list):
            for i, v in enumerate(value):
                scan_value(v, f"{path}/{i}")
            return None

        if isinstance(value, str):
            s = value.strip()
            if is_external_server_ref(s):
                external_id = f"server:{s}"
                add_node({"id": external_id, "type": "External", "label": s, "isExternal": True})
                return _Ref(kind="external", value=external_id)
            return None

        return None

    def collect_external_refs(value: Any) -> list[str]:
        out: list[str] = []

        def walk(v: Any) -> None:
            if isinstance(v, str):
                s = v.strip()
                if is_external_server_ref(s):
                    out.append(s)
                return
            if isinstance(v, list):
                for x in v:
                    walk(x)
                return
            if isinstance(v, dict):
                for x in v.values():
                    walk(x)
                return

        walk(value)
        # de-dup while keeping order
        seen: set[str] = set()
        uniq: list[str] = []
        for x in out:
            if x in seen:
                continue
            seen.add(x)
            uniq.append(x)
        return uniq

    # Root placeholder
    root_node_id = f"server:{root_server_id}"
    add_node({"id": root_node_id, "type": "Root", "label": root_server_id, "isExternal": True})

    # Try a few likely shapes:
    # - a single node dict with Type
    # - { Interactions: [ {Type:...}, ... ] }
    # - { Interactions: { Primary: "SomeInteraction", ... } } (entrypoint mapping)
    if isinstance(data, dict) and "Type" in data:
        ref = scan_value(data, "root")
        if ref:
            add_edge(root_node_id, ref.value, "child")
    else:
        scan_value(data, "root")

        if isinstance(data, dict) and "Interactions" in data:
            inter = data.get("Interactions")
            if isinstance(inter, list):
                for i, v in enumerate(inter):
                    ref = scan_value(v, f"root/Interactions/{i}")
                    if ref:
                        add_edge(root_node_id, ref.value, "child")
            elif isinstance(inter, dict):
                # Map of named entrypoints → server ids (or nested containers). Link root to each referenced interaction.
                for target_id in collect_external_refs(inter):
                    external_id = f"server:{target_id}"
                    add_node({"id": external_id, "type": "External", "label": target_id, "isExternal": True})
                    add_edge(root_node_id, external_id, "child")

    # Safety: don't explode UI if malformed / huge.
    nodes = list(nodes_by_id.values())[:max_nodes]
    node_ids = {n["id"] for n in nodes}
    edges = [e for e in edges if e["from"] in node_ids and e["to"] in node_ids]

    return {"root": root_node_id, "nodes": nodes, "edges": edges}
