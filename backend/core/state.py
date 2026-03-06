from __future__ import annotations

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


# In-memory cache (MVP)
PROJECT_INDEX: dict[str, ProjectIndexState] = {}
