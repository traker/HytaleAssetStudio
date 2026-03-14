from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AssetPutRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    payload: dict = Field(..., alias="json")
    mode: Literal["override", "copy"] = "override"
    newId: str | None = None


class AssetPutResponse(BaseModel):
    ok: bool = True
    assetKey: str
    resolvedPath: str
    origin: Literal["project"] = "project"


class GraphNode(BaseModel):
    id: str
    label: str
    title: str | None = None
    group: str | None = None
    path: str | None = None
    state: Literal["vanilla", "local"]
    isModifiedRoot: bool = False
    modificationKind: Literal["override", "new"] | None = None
