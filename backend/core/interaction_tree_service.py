from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from backend.core.asset_service import read_server_json
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
    "ForkInteractions": "fork",
    "BlockedInteractions": "blocked",
    "CollisionNext": "collisionNext",
    "GroundNext": "groundNext",
    "StartInteraction": "start",
    "CancelInteraction": "cancel",
    # Selector containers — these wrap { Interactions: [...] }
    "HitBlock": "hitBlock",
    "HitEntity": "hitEntity",
    "HitNothing": "hitNothing",
}


def build_interaction_tree(project_id: str, root_key: str, workspace_root: Path, max_nodes: int = 5000) -> dict:
    cfg, _ = load_project_config(workspace_root, project_id)
    index = ensure_index(project_id, cfg)

    asset_key = root_key if root_key.startswith("server:") or root_key.startswith("server-path:") else f"server:{root_key}"
    resp = read_server_json(cfg, asset_key)
    data = resp.get("json")

    nodes_by_id: dict[str, dict] = {}
    edges: list[dict] = []
    edge_keys: set[tuple[str, str, str]] = set()

    def add_node(node: dict) -> None:
        if node["id"] in nodes_by_id:
            return
        nodes_by_id[node["id"]] = node

    def add_edge(src: str, dst: str, typ: str) -> None:
        edge_key = (src, dst, typ)
        if edge_key in edge_keys:
            return
        edge_keys.add(edge_key)
        edges.append({"from": src, "to": dst, "type": typ})

    def is_external_server_ref(s: str) -> bool:
        # We only treat it as external if it exists as a known server json id.
        return s in index.server_id_to_all_paths

    def make_node_id(path: str) -> str:
        return f"internal:{path}"

    def collect_relation_refs(value: Any, path: str) -> list[_Ref]:
        if value is None:
            return []

        if isinstance(value, str):
            ref = scan_value(value, path)
            return [ref] if ref else []

        refs: list[_Ref] = []

        if isinstance(value, list):
            for i, item in enumerate(value):
                refs.extend(collect_relation_refs(item, f"{path}/{i}"))
            return refs

        if isinstance(value, dict):
            if "Type" in value and isinstance(value["Type"], str):
                ref = scan_value(value, path)
                return [ref] if ref else []

            if isinstance(value.get("Interactions"), list):
                for i, item in enumerate(value["Interactions"]):
                    refs.extend(collect_relation_refs(item, f"{path}/Interactions/{i}"))
                return refs

            for sub_key, sub_val in value.items():
                refs.extend(collect_relation_refs(sub_val, f"{path}/{sub_key}"))
            return refs

        return []

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
                    for ref in collect_relation_refs(target, f"{path}/{k}"):
                        add_edge(node_id, ref.value, edge_type)

                if value.get("Type") == "Replace" and "DefaultValue" in value:
                    for ref in collect_relation_refs(value.get("DefaultValue"), f"{path}/DefaultValue"):
                        add_edge(node_id, ref.value, "replace")
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
                add_node({"id": external_id, "type": "_ref", "label": s, "isExternal": True, "rawFields": {"ServerId": s}})
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
    root_node_id = str(resp.get("assetKey") or asset_key)
    root_label = Path(str(resp.get("resolvedPath") or root_node_id)).stem
    add_node({"id": root_node_id, "type": "Root", "label": root_label, "isExternal": True})

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
                    add_node({"id": external_id, "type": "_ref", "label": target_id, "isExternal": True, "rawFields": {"ServerId": target_id}})
                    add_edge(root_node_id, external_id, "child")

    # Safety: don't explode UI if malformed / huge.
    nodes = list(nodes_by_id.values())[:max_nodes]
    node_ids = {n["id"] for n in nodes}
    edges = [e for e in edges if e["from"] in node_ids and e["to"] in node_ids]

    return {"root": root_node_id, "nodes": nodes, "edges": edges}
