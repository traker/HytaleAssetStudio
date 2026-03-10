from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes.assets import router as assets_router
from backend.routes.dialog import router as dialog_router
from backend.routes.interactions import router as interactions_router
from backend.routes.index_graph import router as index_graph_router
from backend.routes.projects import router as projects_router
from backend.routes.workspace import router as workspace_router

app = FastAPI(title="Hytale Asset Studio API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health() -> dict:
    return {"ok": True}


app.include_router(workspace_router)
app.include_router(projects_router)
app.include_router(index_graph_router)
app.include_router(assets_router)
app.include_router(dialog_router)
app.include_router(interactions_router)
