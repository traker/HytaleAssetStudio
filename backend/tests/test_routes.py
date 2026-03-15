from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.main import _is_loopback_origin, _validate_runtime_policy, app
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


def test_health_rejects_non_loopback_client_in_local_only_mode() -> None:
    remote_client = TestClient(app, client=("192.168.1.25", 50000))

    resp = remote_client.get("/api/v1/health")

    assert resp.status_code == 403
    body = resp.json()
    assert body["error"]["code"] == "LOCAL_ONLY_MODE"
    assert body["error"]["details"]["clientHost"] == "192.168.1.25"


def test_health_rejects_non_loopback_origin_in_local_only_mode() -> None:
    resp = client.get("/api/v1/health", headers={"Origin": "https://example.com"})

    assert resp.status_code == 403
    body = resp.json()
    assert body["error"]["code"] == "LOCAL_ONLY_MODE"
    assert body["error"]["details"]["origin"] == "https://example.com"


def test_validate_runtime_policy_rejects_non_loopback_origins_in_local_only_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HAS_LOCAL_ONLY", "1")
    monkeypatch.setenv("HAS_ALLOWED_ORIGINS", "http://127.0.0.1:5173,https://example.com")
    get_settings.cache_clear()

    with pytest.raises(RuntimeError, match="HAS_LOCAL_ONLY=1 only supports loopback CORS origins"):
        _validate_runtime_policy()

    get_settings.cache_clear()


def test_loopback_origin_helper_accepts_localhost_and_rejects_remote() -> None:
    assert _is_loopback_origin("http://localhost:5173") is True
    assert _is_loopback_origin("http://127.0.0.1:5173") is True
    assert _is_loopback_origin("https://example.com") is False


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
