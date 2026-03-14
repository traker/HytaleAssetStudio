from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.core.config import get_settings, Settings

client = TestClient(app)


def _override_settings(workspace_root: Path) -> Settings:
    return Settings(
        workspace_root=workspace_root,
        default_vanilla_source_type="folder",
        default_vanilla_path="",
    )


def test_health_returns_ok() -> None:
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_workspace_open_missing_body_returns_422() -> None:
    resp = client.post("/api/v1/workspace/open", json={})
    assert resp.status_code == 422


def test_workspace_open_valid_dir_returns_workspace_id() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        app.dependency_overrides[get_settings] = lambda: _override_settings(Path(tmp))
        try:
            resp = client.post("/api/v1/workspace/open", json={"rootPath": tmp})
            assert resp.status_code == 200
            body = resp.json()
            assert "workspaceId" in body
            assert body["rootPath"] == tmp
        finally:
            app.dependency_overrides.clear()


def test_workspace_projects_unknown_id_returns_404() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        app.dependency_overrides[get_settings] = lambda: _override_settings(Path(tmp))
        try:
            resp = client.get("/api/v1/workspace/unknown-workspace-id-zzz/projects")
            assert resp.status_code == 404
            body = resp.json()
            assert body["detail"]["error"]["code"] == "WORKSPACE_NOT_FOUND"
        finally:
            app.dependency_overrides.clear()
