# Hytale Asset Studio

Hytale Asset Studio is a local visual editor for Hytale asset packs. It combines a Python backend and a React frontend to inspect layered assets, explore dependency graphs, edit overrides safely, and work on interaction trees without touching vanilla assets directly.

This repository is intentionally separated from the FineCraft mono-repo so the Studio can evolve as its own toolchain.

## Scope

The Studio currently covers these workflows:

- open a workspace and manage project-pack configurations
- stack vanilla assets, dependency packs, and the active project as layered read models
- inspect server JSON assets and common resources from graph views
- create overrides and copies in the active project only
- edit item and interaction-related assets with a mix of structured forms and raw JSON
- load, inspect, edit, and save interaction trees

The product vision and target architecture remain documented in [VISION.md](VISION.md).

## Local-only operating model

This application is designed to run on a single trusted machine.

- The backend reads and writes local filesystem paths by design.
- Arbitrary local path selection is a deliberate product capability, not an accidental exposure.
- Vanilla assets and dependency packs are treated as read-only inputs.
- Only the active project is written by the Studio.
- Remote deployment is out of scope and unsupported.

Current dev defaults bind the backend and frontend to loopback addresses only (`127.0.0.1` / `localhost`). The backend now also runs in a local-only mode by default and rejects non-loopback clients unless a developer explicitly disables that safeguard.

## Current status

The repository is usable for active development, but it is still an evolving tool rather than a frozen public release.

Validated in the current publication pass:

- frontend lint currently passes
- frontend production build passes
- frontend interaction contract test passes
- backend pytest suite passes from a clean `uv` virtual environment (`47 passed`)

Still in progress during this publication pass:

- backend startup still emits a FastAPI deprecation warning for `@app.on_event("startup")`; this is tracked as non-blocking cleanup rather than a publication blocker

## Repository layout

- `backend/`: FastAPI API, VFS/index/graph services, import/export and workspace/project logic
- `frontend/`: React + TypeScript UI, graph views, side panels, structured editors
- `docs/`: active project docs, session recap, backend API notes, Hytale reference docs
- `legacy/`: historical implementation snapshot used as reference only
- `scripts/`: local developer helpers such as the Windows dev launcher

## Quick start

### Recommended on Windows

Use the launcher from the repository root:

```powershell
./scripts/dev.ps1
```

The launcher now uses `uv` to prepare the backend `.venv` automatically before starting the API.

This starts:

- the backend on `127.0.0.1:8000`
- the frontend on `127.0.0.1:5173`

The launcher also avoids common issues with stale ports and PowerShell profiles.

### Manual start

Backend from the repository root:

```powershell
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend from `frontend/`:

```powershell
npm install
npm run dev
```

If you change the backend port, set `HAS_API_PORT` before starting the frontend so Vite proxies API calls to the correct backend instance.

## Common developer checks

Backend dependencies:

```powershell
uv venv .venv
uv pip install --python .venv\Scripts\python.exe -r backend/requirements.txt
```

Frontend checks from `frontend/`:

```powershell
npm run lint
npm run build
npm run test:interaction-contract
```

Backend tests from the repository root after installing backend requirements:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

## Documentation

- Product vision: [VISION.md](VISION.md)
- Backend API baseline: [docs/docs_data/API_BACKEND_MINIMAL.md](docs/docs_data/API_BACKEND_MINIMAL.md)
- Active session recap: [docs/docs_data/SESSION_RECAP.md](docs/docs_data/SESSION_RECAP.md)
- Hytale reference docs entry point: [docs/Hytale Docs/01_Getting_Started.md](docs/Hytale%20Docs/01_Getting_Started.md)

## Publication note

If you publish the repository, publish it as a local asset tool. Do not present it as a hosted service or multi-user web application.

