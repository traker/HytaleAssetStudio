from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from backend.core.index_service import ensure_index
from backend.core.models import ProjectConfig
from backend.core.state import ProjectIndexState


@dataclass(frozen=True)
class ProjectModification:
    kind: str
    vfs_path: str
    asset_key: str | None
    modification_kind: str
    is_new: bool
    size: int
    mtime_ms: int


def collect_project_modifications(cfg: ProjectConfig, index: ProjectIndexState | None = None) -> list[ProjectModification]:
    project_root = Path(cfg.project.assetsWritePath)
    if index is None:
        index = ensure_index(cfg.project.id, cfg)

    entries: list[ProjectModification] = []

    server_root = project_root / "Server"
    if server_root.exists():
        for path in server_root.rglob("*.json"):
            if not path.is_file():
                continue
            vfs_path = path.relative_to(project_root).as_posix()
            stat = path.stat()
            server_id = Path(vfs_path).stem
            is_override = index.lower_layer_server_ids.get(server_id, False)
            entries.append(
                ProjectModification(
                    kind="server-json",
                    vfs_path=vfs_path,
                    asset_key=f"server-path:{vfs_path}",
                    modification_kind="override" if is_override else "new",
                    is_new=not is_override,
                    size=stat.st_size,
                    mtime_ms=int(stat.st_mtime * 1000),
                )
            )

    common_root = project_root / "Common"
    if common_root.exists():
        for path in common_root.rglob("*"):
            if not path.is_file():
                continue
            vfs_path = path.relative_to(project_root).as_posix()
            rel_under_common = path.relative_to(common_root).as_posix()
            stat = path.stat()
            is_override = index.lower_layer_vfs_paths.get(vfs_path, False)
            entries.append(
                ProjectModification(
                    kind="common-resource",
                    vfs_path=vfs_path,
                    asset_key=f"common:{rel_under_common}",
                    modification_kind="override" if is_override else "new",
                    is_new=not is_override,
                    size=stat.st_size,
                    mtime_ms=int(stat.st_mtime * 1000),
                )
            )

    entries.sort(key=lambda entry: (entry.kind, entry.vfs_path.lower()))
    return entries