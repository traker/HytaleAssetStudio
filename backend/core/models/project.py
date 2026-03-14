from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.core.models.workspace import PackSource, SourceType


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


class ProjectManifestAuthor(BaseModel):
    Name: str
    Email: str = ""
    Url: str = ""


class ProjectManifest(BaseModel):
    Group: str = ""
    Name: str = ""
    Version: str = "1.0.0"
    Description: str = ""
    Authors: list[ProjectManifestAuthor] = Field(default_factory=list)
    Website: str = ""
    ServerVersion: str = "*"
    Dependencies: dict[str, str] = Field(default_factory=dict)
    OptionalDependencies: dict[str, str] = Field(default_factory=dict)
    DisabledByDefault: bool = False
    IncludesAssetPack: bool = False


class ManifestPutRequest(BaseModel):
    manifest: ProjectManifest


class ModifiedAssetEntry(BaseModel):
    kind: Literal["server-json", "common-resource"]
    vfsPath: str
    assetKey: str | None = None
    size: int
    mtimeMs: int
    origin: Literal["project"] = "project"
    isNew: bool = False
    modificationKind: Literal["override", "new"] = "override"


class ModifiedAssetsResponse(BaseModel):
    projectId: str
    count: int
    entries: list[ModifiedAssetEntry]
