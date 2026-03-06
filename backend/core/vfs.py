from __future__ import annotations

import json
import zipfile
from dataclasses import dataclass
from pathlib import Path

from backend.core.errors import http_error


def _norm(p: str) -> str:
    return p.replace("\\", "/").lstrip("/")


@dataclass(frozen=True)
class Mount:
    mount_id: str
    origin: str  # vanilla|dependency|project
    source_type: str  # folder|zip
    root: Path
    prefix: str  # '' or 'Assets'

    _zip: zipfile.ZipFile | None = None
    _zip_names: set[str] | None = None

    def _ensure_zip(self) -> None:
        if self.source_type != "zip":
            return
        if self._zip is None:
            object.__setattr__(self, "_zip", zipfile.ZipFile(self.root))
        if self._zip_names is None:
            names = {n for n in self._zip.namelist() if not n.endswith("/")}
            object.__setattr__(self, "_zip_names", names)

    def vfs_to_native(self, vfs_path: str) -> str:
        vfs_path = _norm(vfs_path)
        if self.prefix:
            return f"{self.prefix}/{vfs_path}"
        return vfs_path

    def exists(self, vfs_path: str) -> bool:
        vfs_path = _norm(vfs_path)
        native = self.vfs_to_native(vfs_path)
        if self.source_type == "folder":
            return (self.root / native).exists()
        if self.source_type == "zip":
            self._ensure_zip()
            return native in (self._zip_names or set())
        return False

    def read_text(self, vfs_path: str) -> str:
        vfs_path = _norm(vfs_path)
        native = self.vfs_to_native(vfs_path)
        if self.source_type == "folder":
            return (self.root / native).read_text(encoding="utf-8", errors="ignore")
        if self.source_type == "zip":
            self._ensure_zip()
            assert self._zip is not None
            return self._zip.read(native).decode("utf-8", errors="ignore")
        raise http_error(500, "VFS_UNSUPPORTED", "Unsupported mount source type", {"sourceType": self.source_type})

    def read_bytes(self, vfs_path: str) -> bytes:
        vfs_path = _norm(vfs_path)
        native = self.vfs_to_native(vfs_path)
        if self.source_type == "folder":
            return (self.root / native).read_bytes()
        if self.source_type == "zip":
            self._ensure_zip()
            assert self._zip is not None
            return self._zip.read(native)
        raise http_error(500, "VFS_UNSUPPORTED", "Unsupported mount source type", {"sourceType": self.source_type})

    def list_files(self) -> list[str]:
        # Returns VFS paths (without prefix)
        if self.source_type == "folder":
            base = self.root / self.prefix if self.prefix else self.root
            if not base.exists():
                return []
            files: list[str] = []
            for p in base.rglob("*"):
                if not p.is_file():
                    continue
                rel = str(p.relative_to(base)).replace("\\", "/")
                files.append(rel)
            return files

        if self.source_type == "zip":
            self._ensure_zip()
            names = list(self._zip_names or set())
            out: list[str] = []
            for n in names:
                n = _norm(n)
                if self.prefix:
                    prefix = f"{self.prefix}/"
                    if not n.startswith(prefix):
                        continue
                    out.append(n[len(prefix) :])
                else:
                    out.append(n)
            return out

        raise http_error(500, "VFS_UNSUPPORTED", "Unsupported mount source type", {"sourceType": self.source_type})


def detect_prefix_folder(root: Path) -> str:
    if (root / "Common").is_dir() and (root / "Server").is_dir():
        return ""
    if (root / "Assets" / "Common").is_dir() and (root / "Assets" / "Server").is_dir():
        return "Assets"
    raise http_error(422, "PACK_INVALID", "Pack root must contain Common/ and Server/ (or Assets/Common + Assets/Server)", {"path": str(root)})


def detect_prefix_zip(zip_path: Path) -> str:
    try:
        with zipfile.ZipFile(zip_path) as z:
            names = {n for n in z.namelist()}
    except Exception as e:
        raise http_error(422, "ZIP_INVALID", "Unable to read zip", {"path": str(zip_path), "error": str(e)})

    has_common = any(n.startswith("Common/") for n in names)
    has_server = any(n.startswith("Server/") for n in names)
    if has_common and has_server:
        return ""

    has_common = any(n.startswith("Assets/Common/") for n in names)
    has_server = any(n.startswith("Assets/Server/") for n in names)
    if has_common and has_server:
        return "Assets"

    raise http_error(422, "PACK_INVALID", "Zip must contain Common/ and Server/ (or Assets/Common + Assets/Server)", {"path": str(zip_path)})


def mount_from_source(
    *,
    mount_id: str,
    origin: str,
    source_type: str,
    path: str,
) -> Mount:
    root = Path(path)
    if source_type == "folder":
        prefix = detect_prefix_folder(root)
        return Mount(mount_id=mount_id, origin=origin, source_type=source_type, root=root, prefix=prefix)
    if source_type == "zip":
        prefix = detect_prefix_zip(root)
        return Mount(mount_id=mount_id, origin=origin, source_type=source_type, root=root, prefix=prefix)
    raise http_error(422, "SOURCE_INVALID", "Unknown sourceType", {"sourceType": source_type})


def read_json_from_mount(mount: Mount, vfs_path: str) -> dict:
    try:
        return json.loads(mount.read_text(vfs_path))
    except json.JSONDecodeError as e:
        raise http_error(422, "JSON_INVALID", "Invalid JSON", {"path": vfs_path, "error": str(e)})
