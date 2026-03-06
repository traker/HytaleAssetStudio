from __future__ import annotations

import re
from collections import deque
from pathlib import Path

from backend.core.errors import http_error
from backend.core.index_service import build_mounts, ensure_index
from backend.core.models import ProjectConfig
from backend.core.vfs import read_json_from_mount


_ID_CANDIDATE = re.compile(r"^[A-Za-z0-9_\-]{3,}$")


def _iter_strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _iter_strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _iter_strings(v)


_INTERACTION_KEY_LABEL = {
    "Next": "next",
    "Failed": "failed",
    "Interactions": "calls",
    "ForkInteractions": "fork",
    "BlockedInteractions": "blocked",
    "CollisionNext": "collisionNext",
    "GroundNext": "groundNext",
}


def _is_timeline_dict(value: dict) -> bool:
    # timeline dict: {'0': 'X', '0.2': {...}}
    return bool(value) and all(isinstance(k, str) and k.replace(".", "", 1).isdigit() for k in value.keys())


def _collect_interaction_refs(value, label: str, out: dict[str, set[str]]) -> None:
    if isinstance(value, str):
        out[label].add(value)
        return

    if isinstance(value, list):
        for it in value:
            _collect_interaction_refs(it, label, out)
        return

    if isinstance(value, dict):
        if _is_timeline_dict(value):
            for v in value.values():
                _collect_interaction_refs(v, label, out)
            return

        # Replace node: treat DefaultValue.Interactions as a dedicated relation
        if value.get("Type") == "Replace":
            dv = value.get("DefaultValue")
            if isinstance(dv, dict) and "Interactions" in dv:
                _collect_interaction_refs(dv.get("Interactions"), "replace", out)

        # For interaction sub-objects, only follow known keys to avoid noisy edges.
        for k, lbl in _INTERACTION_KEY_LABEL.items():
            if k in value:
                _collect_interaction_refs(value.get(k), lbl, out)


def _extract_interaction_edges(json_obj: dict) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {lbl: set() for lbl in _INTERACTION_KEY_LABEL.values()}
    out["replace"] = set()

    for k, lbl in _INTERACTION_KEY_LABEL.items():
        if k in json_obj:
            _collect_interaction_refs(json_obj.get(k), lbl, out)

    return out


def build_focus_graph(cfg: ProjectConfig, root_key: str, depth: int | None) -> dict:
    index = ensure_index(cfg.project.id, cfg)
    mounts = build_mounts(cfg)
    mounts_by_id = {m.mount_id: m for m in mounts}

    if not root_key.startswith("server:"):
        raise http_error(422, "ROOT_INVALID", "Only server:* is supported for now", {"root": root_key})

    root_id = root_key.split(":", 1)[1]
    if root_id not in index.server_id_to_all_paths:
        raise http_error(404, "ASSET_NOT_FOUND", "Server asset not found", {"id": root_id})
    paths = index.server_id_to_all_paths[root_id]
    if len(paths) != 1:
        raise http_error(409, "ID_AMBIGUOUS", "Server ID resolves to multiple JSON paths", {"id": root_id, "paths": paths})

    root_path = paths[0]

    unique_ids = set(index.server_id_to_path.keys())

    def node_key_for_id(server_id: str) -> str:
        return f"server:{server_id}"

    def _group_for_server_path(vfs_path: str) -> str:
        p = vfs_path.replace("\\", "/").lower()
        if "/item/items/" in p:
            return "item"
        if "/rootinteractions/" in p or "/interactions/" in p:
            return "interaction"
        if "/effects/" in p:
            return "effect"
        if "/particles/" in p:
            return "particle"
        if "/sounds/" in p:
            return "sound"
        if "/models/" in p:
            return "model"
        return "json_data"

    def _group_for_common_path(vfs_path: str) -> str:
        ext = Path(vfs_path).suffix.lower()
        if ext in {".png", ".jpg", ".jpeg", ".webp", ".tga"}:
            return "texture"
        if ext in {".ogg", ".wav", ".mp3"}:
            return "sound"
        if ext in {".gltf", ".glb", ".obj", ".fbx"}:
            return "model"
        return "default"

    def _try_common_asset_key(s: str) -> str | None:
        s = s.strip().replace("\\", "/").lstrip("/")
        if not s or "/" not in s or "." not in s:
            return None

        # Accept either 'Common/...' or a path under Common (ex: 'Icons/...png')
        rel = s
        if rel.lower().startswith("common/"):
            rel = rel[7:]

        vfs_path = f"Common/{rel}".replace("\\", "/")
        # Must exist in current VFS mapping to avoid noisy edges.
        if vfs_path not in index.effective_mount_by_vfs_path:
            return None

        return f"common:{rel}"

    nodes: dict[str, dict] = {}
    edges: set[tuple[str, str, str]] = set()

    def ensure_node(server_id: str) -> None:
        vfs_path = index.server_id_to_path.get(server_id)
        if not vfs_path:
            return
        origin = index.origin_by_server_path.get(vfs_path, "vanilla")
        state = "vanilla"
        if origin == "project":
            state = "local"
        group = _group_for_server_path(vfs_path)
        nodes[node_key_for_id(server_id)] = {
            "id": node_key_for_id(server_id),
            "label": server_id,
            "title": server_id,
            "group": group,
            "path": vfs_path,
            "state": state,
        }

    def ensure_common_node(asset_key: str) -> None:
        if not asset_key.startswith("common:"):
            return
        rel = asset_key.split(":", 1)[1].lstrip("/")
        vfs_path = f"Common/{rel}".replace("\\", "/")
        origin = index.origin_by_vfs_path.get(vfs_path, "vanilla")
        state = "local" if origin == "project" else "vanilla"
        group = _group_for_common_path(vfs_path)
        nodes[asset_key] = {
            "id": asset_key,
            "label": Path(vfs_path).name,
            "title": Path(vfs_path).name,
            "group": group,
            "path": vfs_path,
            "state": state,
        }

    # BFS by depth
    max_depth = depth if depth is not None else 2
    queue = deque([(root_id, 0)])
    seen = {root_id}

    while queue:
        current_id, d = queue.popleft()
        ensure_node(current_id)

        if max_depth is not None and d >= max_depth:
            continue

        current_path = index.server_id_to_path.get(current_id)
        if not current_path:
            continue

        mount_id = index.effective_mount_by_vfs_path.get(current_path)
        if not mount_id:
            continue
        mount = mounts_by_id[mount_id]
        data = read_json_from_mount(mount, current_path)

        p = current_path.lower().replace("\\", "/")
        is_interaction = "/interactions/" in p or "/rootinteractions/" in p
        if is_interaction and isinstance(data, dict):
            labeled = _extract_interaction_edges(data)
            for lbl, refs in labeled.items():
                for ref in refs:
                    if ref not in unique_ids:
                        continue
                    edges.add((node_key_for_id(current_id), node_key_for_id(ref), lbl))
                    if ref not in seen:
                        seen.add(ref)
                        queue.append((ref, d + 1))
        else:
            for s in _iter_strings(data):
                s = s.strip()

                # Common resources (textures/sounds/models...) referenced by path
                common_key = _try_common_asset_key(s)
                if common_key:
                    ensure_common_node(common_key)
                    edges.add((node_key_for_id(current_id), common_key, "resource"))
                    continue

                if not _ID_CANDIDATE.match(s):
                    continue
                if s not in unique_ids:
                    continue
                edges.add((node_key_for_id(current_id), node_key_for_id(s), "ref"))
                if s not in seen:
                    seen.add(s)
                    queue.append((s, d + 1))

    return {
        "nodes": list(nodes.values()),
        "edges": [{"from": f, "to": t, "type": typ} for (f, t, typ) in sorted(edges)],
    }
