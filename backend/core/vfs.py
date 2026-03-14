from __future__ import annotations

import json
import time
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

import threading

from backend.core.errors import http_error
from backend.core.perf import record_duration


_MOUNT_FILE_LIST_CACHE: dict[tuple[str, str, str], tuple[str, list[str]]] = {}
# Single-process only — see state.py NOTE.
_VFS_CACHE_LOCK: threading.Lock = threading.Lock()


def _norm(p: str) -> str:
    return p.replace("\\", "/").lstrip("/")


def _mount_cache_key(source_type: str, root: Path, prefix: str) -> tuple[str, str, str]:
    return source_type, str(root.resolve()).replace("\\", "/").lower(), prefix


def _mount_listing_signature(source_type: str, root: Path, prefix: str) -> str:
    if source_type == "zip":
        stat = root.stat()
        return f"zip:{stat.st_size}:{stat.st_mtime_ns}"

    base = root / prefix if prefix else root
    parts: list[str] = []
    for rel in ("Common", "Server", "manifest.json"):
        path = base / rel
        if not path.exists():
            parts.append(f"{rel}:missing")
            continue
        stat = path.stat()
        parts.append(f"{rel}:{stat.st_size}:{stat.st_mtime_ns}")
    return "folder:" + "|".join(parts)


@dataclass(eq=False)
class Mount:
    mount_id: str
    origin: str  # vanilla|dependency|project
    source_type: str  # folder|zip
    root: Path
    prefix: str  # '' or 'Assets'

    # Mutable internal state — not part of constructor/repr/comparison.
    _zip: zipfile.ZipFile | None = field(default=None, init=False, repr=False, compare=False)
    _zip_names: set[str] | None = field(default=None, init=False, repr=False, compare=False)

    def __hash__(self) -> int:
        return hash(self.mount_id)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Mount):
            return NotImplemented
        return self.mount_id == other.mount_id

    def close(self) -> None:
        """Close the underlying ZipFile handle if open. Safe to call multiple times."""
        if self._zip is not None:
            try:
                self._zip.close()
            except Exception:
                pass
            self._zip = None
        self._zip_names = None

    def __del__(self) -> None:
        self.close()

    def _ensure_zip(self) -> None:
        if self.source_type != "zip":
            return
        if self._zip is None:
            self._zip = zipfile.ZipFile(self.root)
        if self._zip_names is None:
            self._zip_names = {n for n in self._zip.namelist() if not n.endswith("/")}

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
        start = time.perf_counter()
        vfs_path = _norm(vfs_path)
        native = self.vfs_to_native(vfs_path)
        try:
            if self.source_type == "folder":
                return (self.root / native).read_text(encoding="utf-8", errors="ignore")
            if self.source_type == "zip":
                self._ensure_zip()
                if self._zip is None:
                    raise http_error(500, "VFS_ERROR", "Zip handle not initialized", {"mount": self.mount_id})
                return self._zip.read(native).decode("utf-8", errors="ignore")
            raise http_error(500, "VFS_UNSUPPORTED", "Unsupported mount source type", {"sourceType": self.source_type})
        finally:
            record_duration("vfs.read_text", (time.perf_counter() - start) * 1000.0)

    def read_bytes(self, vfs_path: str) -> bytes:
        start = time.perf_counter()
        vfs_path = _norm(vfs_path)
        native = self.vfs_to_native(vfs_path)
        try:
            if self.source_type == "folder":
                return (self.root / native).read_bytes()
            if self.source_type == "zip":
                self._ensure_zip()
                if self._zip is None:
                    raise http_error(500, "VFS_ERROR", "Zip handle not initialized", {"mount": self.mount_id})
                return self._zip.read(native)
            raise http_error(500, "VFS_UNSUPPORTED", "Unsupported mount source type", {"sourceType": self.source_type})
        finally:
            record_duration("vfs.read_bytes", (time.perf_counter() - start) * 1000.0)

    def list_files(self) -> list[str]:
        start = time.perf_counter()
        # Returns VFS paths (without prefix)
        use_cache = self.origin in {"vanilla", "dependency"}
        cache_key = _mount_cache_key(self.source_type, self.root, self.prefix)
        signature = _mount_listing_signature(self.source_type, self.root, self.prefix) if use_cache else None
        if use_cache and signature is not None:
            cached = _MOUNT_FILE_LIST_CACHE.get(cache_key)
            if cached is not None and cached[0] == signature:
                record_duration("vfs.list_files.cache_hit", (time.perf_counter() - start) * 1000.0)
                return list(cached[1])

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
            if use_cache and signature is not None:
                with _VFS_CACHE_LOCK:
                    _MOUNT_FILE_LIST_CACHE[cache_key] = (signature, list(files))
            record_duration("vfs.list_files", (time.perf_counter() - start) * 1000.0)
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
            if use_cache and signature is not None:
                with _VFS_CACHE_LOCK:
                    _MOUNT_FILE_LIST_CACHE[cache_key] = (signature, list(out))
            record_duration("vfs.list_files", (time.perf_counter() - start) * 1000.0)
            return out

        record_duration("vfs.list_files", (time.perf_counter() - start) * 1000.0)
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
    start = time.perf_counter()
    try:
        return json.loads(mount.read_text(vfs_path))
    except json.JSONDecodeError as e:
        raise http_error(422, "JSON_INVALID", "Invalid JSON", {"path": vfs_path, "error": str(e)})
    finally:
        record_duration("vfs.read_json", (time.perf_counter() - start) * 1000.0)
