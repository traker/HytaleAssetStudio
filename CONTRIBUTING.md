# Contributing to Hytale Asset Studio

## Before you start

Read [VISION.md](VISION.md) to understand the product scope and anti-goals. Changes that push the Studio toward a remote/multi-user service, a 3D editor, or a full Hytale IDE are out of scope.

## Setup

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) on PATH
- Node.js 20+

### Backend

From the repository root:

```powershell
uv venv .venv
uv pip install --python .venv\Scripts\python.exe -r backend/requirements.lock
```

### Frontend

From `frontend/`:

```powershell
npm install
```

### Full-stack dev launcher

```powershell
scripts/dev.ps1
```

This script creates/syncs the backend venv, then starts both the backend (uvicorn on `127.0.0.1:8000`) and the frontend (Vite dev server on `127.0.0.1:5173`) together.

## Running tests

### Backend

```powershell
.\.venv\Scripts\python.exe -m pytest
```

### Frontend

```powershell
cd frontend
npm run lint
npm run build
npm run test:interaction-contract
```

## Code style

- **Python**: standard library conventions, type-annotated public APIs, `from __future__ import annotations` at the top of each module.
- **TypeScript**: strict mode, no `any` where avoidable.
- No external linter config changes without discussion.

## Submitting changes

1. Fork the repository and create a branch from `main`.
2. Keep changes focused — one concern per pull request.
3. Ensure all backend tests and frontend lint/build pass before opening a PR.
4. Describe *why* the change is needed, not just *what* it does.

## Local-only model

This tool is designed as a single-machine desktop utility. Pull requests that introduce remote networking, user accounts, databases, or server-side authentication are outside scope.

## License

By contributing, you agree that your contributions will be licensed under the same [PolyForm Noncommercial 1.0.0](LICENSE) license as the rest of the project.
