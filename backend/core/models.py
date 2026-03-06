from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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


class WorkspaceProjectsResponse(BaseModel):
    projects: list[ProjectInfo]


class ProjectConfigProject(BaseModel):
    id: str
    displayName: str
    rootPath: str
    assetsWritePath: str


class ProjectLayer(BaseModel):
    id: str
    displayName: str | None = None
    sourceType: SourceType
    path: str
    enabled: bool = True


class ProjectConfig(BaseModel):
    schemaVersion: int = 1
    project: ProjectConfigProject
    vanilla: PackSource
    layers: list[ProjectLayer] = Field(default_factory=list)


class ProjectCreateRequest(BaseModel):
    projectId: str
    displayName: str
    targetDir: str
    vanilla: PackSource
    manifest: dict | None = None


class ProjectCreateResponse(BaseModel):
    projectId: str
    rootPath: str
    assetsWritePath: str
    configPath: str


class ProjectOpenRequest(BaseModel):
    projectPath: str


class ProjectOpenResponse(BaseModel):
    projectId: str
    rootPath: str
    assetsWritePath: str


class AssetPutRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    payload: dict = Field(..., alias="json")
    mode: Literal["override"] = "override"


class AssetPutResponse(BaseModel):
    ok: bool = True
    assetKey: str
    resolvedPath: str
    origin: Literal["project"] = "project"


class OkResponse(BaseModel):
    ok: bool = True


class ProjectLayersPutRequest(BaseModel):
    vanilla: PackSource
    layers: list[ProjectLayer] = Field(default_factory=list)


class ImportPackNewProject(BaseModel):
    projectId: str | None = None
    displayName: str | None = None


class ImportPackRequest(BaseModel):
    pack: PackSource
    newProject: ImportPackNewProject


class ImportPackLayerInfo(BaseModel):
    id: str
    enabled: bool = True


class ImportPackResponse(BaseModel):
    projectId: str
    created: bool
    layer: ImportPackLayerInfo


class ExportZipRequest(BaseModel):
    outputPath: str


class ExportZipResponse(BaseModel):
    ok: bool = True
    outputPath: str


class ModifiedAssetEntry(BaseModel):
    kind: Literal["server-json", "common-resource"]
    vfsPath: str
    assetKey: str | None = None
    size: int
    mtimeMs: int
    origin: Literal["project"] = "project"


class ModifiedAssetsResponse(BaseModel):
    projectId: str
    count: int
    entries: list[ModifiedAssetEntry]
