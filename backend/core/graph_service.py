from __future__ import annotations

import re
from collections import deque
from pathlib import Path

from backend.core.errors import http_error
from backend.core.index_service import build_mounts, ensure_index
from backend.core.modification_service import collect_project_modifications
from backend.core.models import ProjectConfig
from backend.core.perf import timed
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


def _group_for_server_path(vfs_path: str) -> str:
    """Derive a UI group label from a VFS server path."""
    p = vfs_path.replace("\\", "/").lower()
    if "/item/items/" in p:
        return "item"
    if "/rootinteractions/" in p:
        return "rootinteraction"
    if "/interactions/" in p:
        return "interaction"
    if "/effects/" in p:
        return "effect"
    if "/projectiles/" in p:
        return "projectile"
    if "/particles/" in p:
        return "particle"
    if "/sounds/" in p or "/soundevents/" in p:
        return "sound"
    if "/models/" in p:
        return "model"
    if "/npc/" in p or "/npcs/" in p:
        return "npc"
    if "/prefabs/" in p:
        return "prefab"
    if "/block/" in p or "/blocks/" in p:
        return "block"
    return "json_data"


def build_focus_graph(cfg: ProjectConfig, root_key: str, depth: int | None) -> dict:
    with timed("graph.focus"):
        index = ensure_index(cfg.project.id, cfg)
        mounts = build_mounts(cfg)
        mounts_by_id = {m.mount_id: m for m in mounts}

    if root_key.startswith("server-path:"):
        root_path = root_key.split(":", 1)[1].strip().replace("\\", "/").lstrip("/")
        if root_path not in index.effective_mount_by_vfs_path:
            raise http_error(404, "ASSET_NOT_FOUND", "Server asset path not found", {"path": root_path})
        if not root_path.lower().startswith("server/") or not root_path.lower().endswith(".json"):
            raise http_error(422, "ROOT_INVALID", "server-path root must target a Server/*.json asset", {"root": root_key})
        root_id = Path(root_path).stem
    elif root_key.startswith("server:"):
        root_id = root_key.split(":", 1)[1]
        if root_id not in index.server_id_to_all_paths:
            raise http_error(404, "ASSET_NOT_FOUND", "Server asset not found", {"id": root_id})
        paths = index.server_id_to_all_paths[root_id]
        if len(paths) != 1:
            raise http_error(409, "ID_AMBIGUOUS", "Server ID resolves to multiple JSON paths", {"id": root_id, "paths": paths})
        root_path = paths[0]
    else:
        raise http_error(422, "ROOT_INVALID", "Only server:* and server-path:* are supported for now", {"root": root_key})

    unique_ids = set(index.server_id_to_path.keys())

    def node_key_for_id(server_id: str) -> str:
        return f"server:{server_id}"

    def node_key_for_path(vfs_path: str) -> str:
        stem = Path(vfs_path).stem
        paths = index.server_id_to_all_paths.get(stem, [])
        if len(paths) == 1 and paths[0] == vfs_path:
            return node_key_for_id(stem)
        return f"server-path:{vfs_path}"

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

    def ensure_node(vfs_path: str) -> None:
        origin = index.origin_by_server_path.get(vfs_path, "vanilla")
        state = "vanilla"
        if origin == "project":
            state = "local"
        group = _group_for_server_path(vfs_path)
        node_id = node_key_for_path(vfs_path)
        label = Path(vfs_path).stem
        nodes[node_id] = {
            "id": node_id,
            "label": label,
            "title": label,
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
    queue = deque([(root_path, 0)])
    seen = {root_path}

    while queue:
        current_path, d = queue.popleft()
        ensure_node(current_path)

        if max_depth is not None and d >= max_depth:
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
                    child_path = index.server_id_to_path[ref]
                    edges.add((node_key_for_path(current_path), node_key_for_id(ref), lbl))
                    if child_path not in seen:
                        seen.add(child_path)
                        queue.append((child_path, d + 1))
        else:
            for s in _iter_strings(data):
                s = s.strip()

                # Common resources (textures/sounds/models...) referenced by path
                common_key = _try_common_asset_key(s)
                if common_key:
                    ensure_common_node(common_key)
                    edges.add((node_key_for_path(current_path), common_key, "resource"))
                    continue
                if not _ID_CANDIDATE.match(s):
                    continue
                if s not in unique_ids:
                    continue
                child_path = index.server_id_to_path[s]
                edges.add((node_key_for_path(current_path), node_key_for_id(s), "ref"))
                if child_path not in seen:
                    seen.add(child_path)
                    queue.append((child_path, d + 1))

    return {
        "nodes": list(nodes.values()),
        "edges": [{"from": f, "to": t, "type": typ} for (f, t, typ) in sorted(edges)],
    }


def build_modified_graph(cfg: ProjectConfig, depth: int) -> dict:
    """Multi-root graph: BFS from every project-layer server-json asset."""
    from pathlib import Path as _Path

    with timed("graph.modified"):
        index = ensure_index(cfg.project.id, cfg)
        mounts = build_mounts(cfg)
        mounts_by_id = {m.mount_id: m for m in mounts}

    def node_key_for_id(server_id: str) -> str:
        return f"server:{server_id}"

    def node_key_for_path(vfs_path: str) -> str:
        stem = _Path(vfs_path).stem
        paths = index.server_id_to_all_paths.get(stem, [])
        if len(paths) == 1 and paths[0] == vfs_path:
            return node_key_for_id(stem)
        return f"server-path:{vfs_path}"

    # Collect all modified server roots by VFS path, preserving orphan/new assets.
    modified_paths: list[str] = []
    modified_kind_by_path: dict[str, str] = {}
    for entry in collect_project_modifications(cfg, index=index):
        if entry.kind != "server-json":
            continue
        if entry.vfs_path not in index.effective_mount_by_vfs_path:
            continue
        modified_paths.append(entry.vfs_path)
        modified_kind_by_path[entry.vfs_path] = entry.modification_kind

    modified_root_ids = {node_key_for_path(path) for path in modified_paths}

    if not modified_paths:
        return {"nodes": [], "edges": [], "modifiedIds": []}

    unique_ids = set(index.server_id_to_path.keys())

    def _group_for_common_path(vfs_path: str) -> str:
        ext = _Path(vfs_path).suffix.lower()
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
        rel = s
        if rel.lower().startswith("common/"):
            rel = rel[7:]
        vfs_path = f"Common/{rel}".replace("\\", "/")
        if vfs_path not in index.effective_mount_by_vfs_path:
            return None
        return f"common:{rel}"

    nodes: dict[str, dict] = {}
    edges: set[tuple[str, str, str]] = set()

    def ensure_node(vfs_path: str) -> None:
        origin = index.origin_by_server_path.get(vfs_path, "vanilla")
        state = "local" if origin == "project" else "vanilla"
        group = _group_for_server_path(vfs_path)
        node_id = node_key_for_path(vfs_path)
        label = _Path(vfs_path).stem
        nodes[node_id] = {
            "id": node_id,
            "label": label,
            "title": label,
            "group": group,
            "path": vfs_path,
            "state": state,
            "isModifiedRoot": node_id in modified_root_ids,
            "modificationKind": modified_kind_by_path.get(vfs_path),
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
            "label": _Path(vfs_path).name,
            "title": _Path(vfs_path).name,
            "group": group,
            "path": vfs_path,
            "state": state,
            "isModifiedRoot": False,
        }

    # BFS started simultaneously from all modified roots.
    seen: set[str] = set(modified_paths)
    queue: deque[tuple[str, int]] = deque((path, 0) for path in modified_paths)

    while queue:
        current_path, d = queue.popleft()
        ensure_node(current_path)

        if d >= depth:
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
                    child_path = index.server_id_to_path[ref]
                    edges.add((node_key_for_path(current_path), node_key_for_id(ref), lbl))
                    if child_path not in seen:
                        seen.add(child_path)
                        queue.append((child_path, d + 1))
        else:
            for s in _iter_strings(data):
                s = s.strip()
                common_key = _try_common_asset_key(s)
                if common_key:
                    ensure_common_node(common_key)
                    edges.add((node_key_for_path(current_path), common_key, "resource"))
                    continue
                if not _ID_CANDIDATE.match(s):
                    continue
                if s not in unique_ids:
                    continue
                child_path = index.server_id_to_path[s]
                edges.add((node_key_for_path(current_path), node_key_for_id(s), "ref"))
                if child_path not in seen:
                    seen.add(child_path)
                    queue.append((child_path, d + 1))

    return {
        "nodes": list(nodes.values()),
        "edges": [{"from": f, "to": t, "type": typ} for (f, t, typ) in sorted(edges)],
        "modifiedIds": sorted(modified_root_ids),
    }
