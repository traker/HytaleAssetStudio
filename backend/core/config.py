from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


DEFAULT_ALLOWED_ORIGINS: tuple[str, ...] = (
    "http://127.0.0.1:5173",
    "http://localhost:5173",
)


def _env_flag(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None or raw_value.strip() == "":
        return default
    return raw_value.strip().lower() not in {"0", "false", "no", "off"}


def _parse_allowed_origins(raw_value: str) -> tuple[str, ...]:
    origins = tuple(origin.strip() for origin in raw_value.split(",") if origin.strip())
    return origins or DEFAULT_ALLOWED_ORIGINS


@dataclass(frozen=True)
class Settings:
    workspace_root: Path
    default_vanilla_source_type: str
    default_vanilla_path: str
    perf_audit_enabled: bool = False
    local_only: bool = True
    allowed_origins: tuple[str, ...] = DEFAULT_ALLOWED_ORIGINS


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    # Defaults chosen to match the current dev machine conventions documented in
    # .github/copilot-instructions.md and VISION.md.
    workspace_root = Path(os.getenv("HAS_WORKSPACE_ROOT", "") or ".")
    default_vanilla_source_type = os.getenv("HAS_VANILLA_SOURCE_TYPE", "folder")
    default_vanilla_path = os.getenv("HAS_VANILLA_PATH", "")
    perf_audit_enabled = _env_flag("HAS_PERF_AUDIT", False)
    local_only = _env_flag("HAS_LOCAL_ONLY", True)
    allowed_origins = _parse_allowed_origins(os.getenv("HAS_ALLOWED_ORIGINS", ""))
    return Settings(
        workspace_root=workspace_root,
        default_vanilla_source_type=default_vanilla_source_type,
        default_vanilla_path=default_vanilla_path,
        perf_audit_enabled=perf_audit_enabled,
        local_only=local_only,
        allowed_origins=allowed_origins,
    )
