from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    workspace_root: Path
    default_vanilla_source_type: str
    default_vanilla_path: str
    perf_audit_enabled: bool = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    # Defaults chosen to match the current dev machine conventions documented in
    # .github/copilot-instructions.md and VISION.md.
    workspace_root = Path(os.getenv("HAS_WORKSPACE_ROOT", "") or ".")
    default_vanilla_source_type = os.getenv("HAS_VANILLA_SOURCE_TYPE", "folder")
    default_vanilla_path = os.getenv("HAS_VANILLA_PATH", "")
    perf_audit_enabled = os.getenv("HAS_PERF_AUDIT", "0") == "1"
    return Settings(
        workspace_root=workspace_root,
        default_vanilla_source_type=default_vanilla_source_type,
        default_vanilla_path=default_vanilla_path,
        perf_audit_enabled=perf_audit_enabled,
    )
