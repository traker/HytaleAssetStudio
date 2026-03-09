# Hytale Asset Studio

Repo dédié pour l'outil d'édition/visualisation d'assets Hytale (séparé du mono-repo FineCraft pour éviter de mélanger Java/Gradle et l'app Node/Python).

## Vision

Voir [VISION.md](VISION.md).

## Docs Hytale (référence)

Point d'entrée : [docs/Hytale Docs/01_Getting_Started.md](docs/Hytale%20Docs/01_Getting_Started.md)

## Statut

- Ce repo est initialisé proprement (sans historique) après un revert du mono-repo.
- L'implémentation est planifiée dans la Vision et sera construite incrémentalement (MVP read-only → overrides → éditeur d'interactions).

## Structure (prévue)

- `backend/` : API Python (lecture/écriture, VFS, génération de graphe)
- `frontend/` : UI web (React + graphe + éditeurs)

## Lancer (dev)

- Script (Windows PowerShell): `./scripts/dev.ps1`
- Backend (manuel): `python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000`
- Frontend (manuel): `cd frontend; npm run dev` (par défaut: `http://127.0.0.1:5173/`)

Note: éviter de lancer plusieurs instances du backend sur des ports différents, sinon le frontend peut parler à un backend qui n'a pas la dernière version des routes.

