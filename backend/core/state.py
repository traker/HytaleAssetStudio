from __future__ import annotations

import threading
from dataclasses import dataclass


@dataclass
class ProjectIndexState:
    projectId: str
    server_json_count: int
    common_file_count: int

    # vfs path -> origin (vanilla|dependency|project)
    origin_by_vfs_path: dict[str, str]

    # vfs server path -> resolved origin
    origin_by_server_path: dict[str, str]

    # vfs path -> bytes/json read is resolved via mount; stored as mapping to mount key
    effective_mount_by_vfs_path: dict[str, str]

    # server id -> vfs path (only for unique ids)
    server_id_to_path: dict[str, str]

    # server id -> all vfs paths (including ambiguous)
    server_id_to_all_paths: dict[str, list[str]]

    # presence maps for assets that exist in lower layers (vanilla/dependency),
    # used to classify project files as new vs override without rescanning mounts.
    lower_layer_vfs_paths: dict[str, bool]
    lower_layer_server_ids: dict[str, bool]


# In-memory cache (MVP)
# NOTE: single-process only — uvicorn --workers N > 1 is not supported
# (all caches live in-memory and are not shared across processes).
PROJECT_INDEX: dict[str, ProjectIndexState] = {}
PROJECT_INDEX_FINGERPRINT: dict[str, str] = {}

# In-memory workspace registry used to resolve the workspace the user opened.
# This avoids falling back silently to HAS_WORKSPACE_ROOT for subsequent
# workspace/project-scoped requests.
WORKSPACE_ROOT_BY_ID: dict[str, str] = {}

# Locks protecting concurrent writes on caches from multiple threads
# (e.g. Starlette threadpool handlers, background tasks).
_INDEX_LOCK: threading.Lock = threading.Lock()
_WORKSPACE_LOCK: threading.Lock = threading.Lock()
