# Backend

The backend is the source of truth for the Studio. It reads asset packs from disk or ZIPs, applies layer priority, builds indexes and graphs, resolves assets on demand, and writes overrides only into the active project.

## Local-only expectation

This backend is intended for a trusted local operator on a single machine.

- It accepts local filesystem paths as part of the product model.
- That capability is intentional because the Studio edits real local asset packs and project folders chosen by the operator.
- It is not designed as a remote multi-user API.
- Default CORS is restricted to the local Vite dev origins.
- Default dev startup binds to `127.0.0.1` only.
- `HAS_LOCAL_ONLY=1` is the default runtime mode and rejects non-loopback clients and browser origins.

If you expose it outside loopback, you are outside the supported operating model.

## Setup

From the repository root, create a virtual environment and install backend requirements:

```powershell
uv venv .venv
uv pip install --python .venv\Scripts\python.exe -r backend/requirements.lock
```

`backend/requirements.lock` is the pinned lockfile generated from `backend/requirements.txt` via `uv pip compile`. Use it for reproducible installs. To regenerate after updating `requirements.txt`:

```powershell
uv pip compile backend/requirements.txt --python .venv\Scripts\python.exe -o backend/requirements.lock
```

Current backend requirements include FastAPI, Uvicorn, Pydantic, HTTPX, and pytest.

This `uv` flow was re-validated during the current publication pass on Windows.

The repository launcher `scripts/dev.ps1` uses this same `uv`-managed `.venv` flow automatically before starting the backend.

## Run in development

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Why `python -m uvicorn`:

- it avoids accidentally picking a different global `uvicorn`
- it keeps the backend aligned with the active Python environment

The frontend Vite proxy targets `http://127.0.0.1:${HAS_API_PORT}` and assumes `8000` by default.

If you change the backend port, export `HAS_API_PORT` before starting the frontend.

## Environment variables

The current backend defaults come from `backend/core/config.py`.

Optional variables:

- `HAS_WORKSPACE_ROOT`: default workspace root used by backend defaults. Current code default is `.`.
- `HAS_VANILLA_SOURCE_TYPE`: default vanilla source type. Current default is `folder`.
- `HAS_VANILLA_PATH`: default vanilla asset path. Current default is empty.
- `HAS_PERF_AUDIT`: enable backend performance audit headers and logs when set to `1`.
- `HAS_LOCAL_ONLY`: defaults to `1`. When enabled, startup rejects non-loopback CORS origins and requests from non-loopback clients are refused with `403 LOCAL_ONLY_MODE`.
- `HAS_ALLOWED_ORIGINS`: comma-separated CORS origins. If unset, defaults to `http://127.0.0.1:5173,http://localhost:5173`. While `HAS_LOCAL_ONLY=1`, non-loopback origins are rejected at startup.

Important note: the repository documentation and code intentionally no longer assume a machine-specific workspace or vanilla path as a hardcoded default.

Remote note: if you set `HAS_LOCAL_ONLY=0`, you are deliberately leaving the supported product model. That opt-out exists only for advanced development and diagnostics, not as a supported deployment target.

## API surface

Main route groups:

- workspace open and project listing
- project create, open, config, manifest, import, export
- graph and search endpoints
- asset read, write, modified listing, resource preview
- interaction tree endpoints

The minimal backend contract is documented in [docs/docs_data/API_BACKEND_MINIMAL.md](../docs/docs_data/API_BACKEND_MINIMAL.md).

## Tests

After installing backend requirements, run from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Validation note for the current publication pass:

- clean setup reproduced with `uv venv .venv`
- dependency install reproduced with `uv pip install --python .venv\Scripts\python.exe -r backend/requirements.txt`
- backend suite result: `47 passed`

Startup note:

- FastAPI startup is now handled through a lifespan hook rather than the deprecated `@app.on_event("startup")` API.

## Notes for frontend integration

- The frontend sends `X-HAS-Workspace-Id` automatically once a workspace has been opened.
- The backend remains responsible for resolving layer order and the effective asset state.
- The frontend only pulls compact graph data and selected asset payloads on demand.
