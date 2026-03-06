# Backend (API Python)

## Setup

Créer un venv puis installer :

- `pip install -r backend/requirements.txt`

## Lancer en dev

- `python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000`

Notes :

- Utiliser `python -m uvicorn` évite d'exécuter un `uvicorn` d'un autre Python/venv.
- Le frontend (Vite proxy) pointe vers `http://127.0.0.1:${HAS_API_PORT}` (par défaut `8000`).
- Si le port `8000` est occupé, choisir un autre port **et** exporter `HAS_API_PORT` avant de lancer le frontend.

## Config (dev)

Variables d’environnement optionnelles :

- `HAS_WORKSPACE_ROOT` (défaut: `K:\hytale-asset-studio-workspace`)
- `HAS_VANILLA_SOURCE_TYPE` (défaut: `folder`)
- `HAS_VANILLA_PATH` (défaut: `K:\projet\java\TestPluginHytale\Assets`)
