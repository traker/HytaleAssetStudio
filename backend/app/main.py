from __future__ import annotations

import ipaddress
import logging
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.core.config import get_settings
from backend.core.perf import build_server_timing_header, finish_request_perf, log_request_perf, start_request_perf
from backend.routes.assets import router as assets_router
from backend.routes.dialog import router as dialog_router
from backend.routes.interactions import router as interactions_router
from backend.routes.graph import router as index_graph_router
from backend.routes.projects import router as projects_router
from backend.routes.workspace import router as workspace_router

logger = logging.getLogger("uvicorn.error")


def _is_loopback_host(host: str) -> bool:
    normalized_host = host.strip().lower()
    if normalized_host in {"localhost", "testclient"}:
        return True

    try:
        return ipaddress.ip_address(normalized_host).is_loopback
    except ValueError:
        return False


def _is_loopback_origin(origin: str) -> bool:
    parsed = urlparse(origin)
    if parsed.scheme not in {"http", "https"} or parsed.hostname is None:
        return False
    return _is_loopback_host(parsed.hostname)


def _validate_runtime_policy() -> None:
    settings = get_settings()
    invalid_origins = [origin for origin in settings.allowed_origins if not _is_loopback_origin(origin)]
    if settings.local_only and invalid_origins:
        raise RuntimeError(
            "HAS_LOCAL_ONLY=1 only supports loopback CORS origins. "
            f"Invalid origins: {', '.join(invalid_origins)}. "
            "Set HAS_LOCAL_ONLY=0 only if you are deliberately leaving the supported local-only model."
        )

    if settings.local_only:
        logger.info("startup local_only=%s allowed_origins=%s", settings.local_only, ",".join(settings.allowed_origins))
        return

    logger.warning(
        "startup local_only=%s allowed_origins=%s; remote exposure is outside the supported product model",
        settings.local_only,
        ",".join(settings.allowed_origins),
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    _validate_runtime_policy()
    logger.info("startup perf_audit_enabled=%s", settings.perf_audit_enabled)
    yield


app = FastAPI(title="Hytale Asset Studio API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(get_settings().allowed_origins),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.middleware("http")
async def local_only_middleware(request: Request, call_next):
    settings = get_settings()
    if settings.local_only:
        client_host = request.client.host if request.client is not None else None
        if client_host and not _is_loopback_host(client_host):
            logger.warning("blocked non-local client host=%s path=%s", client_host, request.url.path)
            return JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "code": "LOCAL_ONLY_MODE",
                        "message": "This backend only accepts loopback requests while HAS_LOCAL_ONLY=1.",
                        "details": {"clientHost": client_host},
                    }
                },
            )

        origin = request.headers.get("origin")
        if origin and not _is_loopback_origin(origin):
            logger.warning("blocked non-local origin origin=%s path=%s", origin, request.url.path)
            return JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "code": "LOCAL_ONLY_MODE",
                        "message": "This backend only accepts loopback browser origins while HAS_LOCAL_ONLY=1.",
                        "details": {"origin": origin},
                    }
                },
            )

    return await call_next(request)


@app.middleware("http")
async def perf_audit_middleware(request: Request, call_next):
    settings = get_settings()
    if not settings.perf_audit_enabled:
        return await call_next(request)

    start = time.perf_counter()
    token = start_request_perf(request.method, request.url.path)
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception:
        state = finish_request_perf(token, (time.perf_counter() - start) * 1000.0)
        if state is not None:
            log_request_perf(state, status_code)
        raise

    state = finish_request_perf(token, (time.perf_counter() - start) * 1000.0)
    if state is not None:
        response.headers["X-HAS-Perf-Id"] = state.request_id
        response.headers["X-HAS-Perf-Total-Ms"] = f"{state.total_ms:.2f}"
        response.headers["Server-Timing"] = build_server_timing_header(state)
        log_request_perf(state, status_code)
    return response


@app.get("/api/v1/health")
def health() -> dict:
    from backend.core.config import get_version  # noqa: PLC0415
    return {"ok": True, "version": get_version()}


app.include_router(workspace_router)
app.include_router(projects_router)
app.include_router(index_graph_router)
app.include_router(assets_router)
app.include_router(dialog_router)
app.include_router(interactions_router)

# --- Static frontend serving (production mode) ---
# Activated only when frontend/dist/ exists (built via `npm run build`).
# In dev mode the Vite dev server is used instead (scripts/dev.ps1).
# Must be registered AFTER all API routes so API paths are matched first.
_FRONTEND_DIST = (
    Path(sys._MEIPASS) / "frontend" / "dist"  # type: ignore[attr-defined]
    if getattr(sys, "frozen", False)
    else Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
)

if _FRONTEND_DIST.is_dir():
    _assets_dir = _FRONTEND_DIST / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="frontend-assets")

    @app.get("/", include_in_schema=False)
    async def _serve_root():
        return FileResponse(_FRONTEND_DIST / "index.html")

    @app.get("/{catchall:path}", include_in_schema=False)
    async def _serve_spa(catchall: str):
        candidate = _FRONTEND_DIST / catchall
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_DIST / "index.html")
