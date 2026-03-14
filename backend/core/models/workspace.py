from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SourceType = Literal["folder", "zip"]


class PackSource(BaseModel):
    sourceType: SourceType
    path: str


class WorkspaceDefaults(BaseModel):
    vanilla: PackSource


class WorkspaceConfig(BaseModel):
    schemaVersion: int = 1
    workspace: dict = Field(default_factory=dict)
    defaults: WorkspaceDefaults


class WorkspaceOpenRequest(BaseModel):
    rootPath: str


class WorkspaceOpenResponse(BaseModel):
    workspaceId: str
    rootPath: str
    projectsDir: str
    defaults: WorkspaceDefaults


class ProjectInfo(BaseModel):
    projectId: str
    displayName: str | None = None
    rootPath: str
    assetsWritePath: str
    status: Literal["ready", "invalid"] = "ready"
    errorMessage: str | None = None


class WorkspaceProjectsResponse(BaseModel):
    projects: list[ProjectInfo]
