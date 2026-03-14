from __future__ import annotations

import logging
import os
import time

from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import get_settings
from backend.core.perf import build_server_timing_header, finish_request_perf, log_request_perf, start_request_perf
from backend.routes.assets import router as assets_router
from backend.routes.dialog import router as dialog_router
from backend.routes.interactions import router as interactions_router
from backend.routes.graph import router as index_graph_router
from backend.routes.projects import router as projects_router
from backend.routes.workspace import router as workspace_router

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="Hytale Asset Studio API", version="0.1.0")

# Dev origins: 127.0.0.1 / localhost on the default Vite port.
# For multi-machine deployments set HAS_ALLOWED_ORIGINS (comma-separated).
_allowed_origins_env = os.getenv("HAS_ALLOWED_ORIGINS", "")
_CORS_ORIGINS: list[str] = (
    [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]
    if _allowed_origins_env
    else ["http://127.0.0.1:5173", "http://localhost:5173"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def log_perf_audit_status() -> None:
    settings = get_settings()
    logger.info("startup perf_audit_enabled=%s", settings.perf_audit_enabled)


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
    return {"ok": True}


app.include_router(workspace_router)
app.include_router(projects_router)
app.include_router(index_graph_router)
app.include_router(assets_router)
app.include_router(dialog_router)
app.include_router(interactions_router)
