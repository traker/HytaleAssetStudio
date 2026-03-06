from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    workspace_root: Path
    default_vanilla_source_type: str
    default_vanilla_path: str


def get_settings() -> Settings:
    # Defaults chosen to match the current dev machine conventions documented in
    # .github/copilot-instructions.md and VISION.md.
    workspace_root = Path(os.getenv("HAS_WORKSPACE_ROOT", r"K:\hytale-asset-studio-workspace"))
    default_vanilla_source_type = os.getenv("HAS_VANILLA_SOURCE_TYPE", "folder")
    default_vanilla_path = os.getenv(
        "HAS_VANILLA_PATH",
        r"K:\projet\java\TestPluginHytale\Assets",
    )
    return Settings(
        workspace_root=workspace_root,
        default_vanilla_source_type=default_vanilla_source_type,
        default_vanilla_path=default_vanilla_path,
    )
