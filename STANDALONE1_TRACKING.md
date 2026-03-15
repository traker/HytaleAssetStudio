# STANDALONE1 — Tracker d'exécution

Tracking document for the plan defined in [STANDALONE1.md](STANDALONE1.md).
Branch: `feature/standalone-app`

## How to use it

- Check a task when it is finished.
- Move each lot from `todo` to `in-progress` then `done`.
- Record concrete validation evidence after meaningful changes.
- Keep this file factual: status, decision, validation, remaining work.

## Legend

- `todo`: not started
- `in-progress`: currently being executed
- `blocked`: waiting for a product decision or dependency
- `done`: completed and validated

---

## Global dashboard

| Lot | Title | Status |
|---|---|---|
| Lot 1 | Frontend servi par FastAPI (StaticFiles) | `done` |
| Lot 2 | Fenêtre native pywebview | `todo` |
| Lot 3 | Packaging PyInstaller | `todo` |

---

## Lot 1 — Frontend servi par FastAPI (StaticFiles)

- Global status: `done`
- Objectif: supprimer la dépendance Node.js à l'exécution. Le frontend buildé est servi directement par FastAPI.

### 1.1 — Monter le build frontend comme StaticFiles dans FastAPI

- Status: `done`
- Fichiers cibles:
  - `backend/app/main.py`
- Tasks:
  - [x] Ajouter le montage `StaticFiles` pour `frontend/dist/assets/` après les routes API
  - [x] Ajouter la route catch-all SPA fallback (serve `index.html` pour toute route non-API)
  - [x] Vérifier que le backend démarre normalement si `frontend/dist/` est absent (mode dev)
  - [x] Vérifier que `/api/v1/...` répond correctement
  - [x] `python -m pytest` → 47 passed

### 1.2 — Adapter la configuration Vite pour le mode production

- Status: `done`
- Fichiers cibles:
  - `frontend/vite.config.ts`
  - `frontend/src/` (variables d'env si besoin)
- Tasks:
  - [x] Vérifier `base` dans `vite.config.ts` (doit être `/` ou absent) — absent, défaut `/` OK
  - [x] Vérifier que les `VITE_*` se résolvent en prod
  - [x] `npm run build` → OK sans erreur TypeScript ni warning bloquant
  - [x] UI servie par FastAPI charge sans erreur console ni assets 404

### 1.3 — Script de lancement prod

- Status: `done`
- Fichiers cibles:
  - `scripts/run.ps1` (nouveau) ou mode dans `scripts/dev.ps1`
  - `backend/README.md`
  - `CONTRIBUTING.md`
- Tasks:
  - [x] Créer `scripts/run.ps1` : build frontend + démarrage uvicorn sans reload
  - [x] Documenter la distinction dev/prod dans `backend/README.md`
  - [x] `scripts/run.ps1` → Studio accessible sur `http://127.0.0.1:8000/`

### Validation Lot 1

- [x] `npm run build` OK
- [x] `python -m pytest` → 47 passed
- [x] UI accessible et fonctionnelle via `http://127.0.0.1:8000/` (backend seul, sans Vite)
- [x] Backend démarre sans erreur si `frontend/dist/` absent

---

## Lot 2 — Fenêtre native pywebview

- Global status: `todo`
- Dépend de: Lot 1 validé

### 2.1 — Ajouter pywebview comme dépendance

- Status: `todo`
- Fichiers cibles:
  - `backend/requirements.txt`
  - `backend/requirements.lock`
- Tasks:
  - [ ] Ajouter `pywebview>=5` à `backend/requirements.txt`
  - [ ] Régénérer `backend/requirements.lock` via `uv pip compile`
  - [ ] Installer dans le venv et vérifier l'import

### 2.2 — Créer le point d'entrée standalone

- Status: `todo`
- Fichiers cibles:
  - `app.py` (nouveau, racine du repo)
- Tasks:
  - [ ] Démarrer uvicorn dans un thread daemon
  - [ ] Polling health check jusqu'à disponibilité backend (`GET /api/v1/health`)
  - [ ] Ouvrir la fenêtre pywebview sur `http://127.0.0.1:8000/`
  - [ ] Fermeture fenêtre → arrêt propre uvicorn

### 2.3 — Validation manuelle Lot 2

- Status: `todo`
- Tasks:
  - [ ] `python app.py` → fenêtre native ouverte, UI chargée
  - [ ] Fermeture fenêtre → pas de process zombie uvicorn
  - [ ] `python -m pytest` → 47 passed minimum

### Validation Lot 2

- [ ] Fenêtre native fonctionnelle (`python app.py`)
- [ ] Fermeture propre
- [ ] Tests backend : 47 passed minimum

---

## Lot 3 — Packaging PyInstaller

- Global status: `todo`
- Dépend de: Lot 2 validé

### 3.1 — Configurer PyInstaller

- Status: `todo`
- Fichiers cibles:
  - `HytaleAssetStudio.spec` (nouveau, racine)
  - `backend/requirements.txt` (ajout pyinstaller)
  - `backend/requirements.lock` (régénéré)
- Tasks:
  - [ ] Ajouter `pyinstaller` à `backend/requirements.txt` et régénérer le lock
  - [ ] Créer `HytaleAssetStudio.spec` : datas frontend/dist, hidden imports uvicorn/fastapi, mode onedir, console=False
  - [ ] Identifier les hidden imports manquants (uvicorn.logging, uvicorn.loops.*, etc.)

### 3.2 — Valider le build PyInstaller

- Status: `todo`
- Tasks:
  - [ ] `pyinstaller HytaleAssetStudio.spec` → build sans erreur
  - [ ] Lancer `dist/HytaleAssetStudio/HytaleAssetStudio.exe`
  - [ ] Vérifier UI fonctionnelle (workspace, assets, graphe)
  - [ ] Vérifier sur environnement sans Python dans PATH

### 3.3 — Script de build release

- Status: `todo`
- Fichiers cibles:
  - `scripts/build-release.ps1` (nouveau)
  - `README.md`
- Tasks:
  - [ ] Créer `scripts/build-release.ps1` : npm build + pyinstaller
  - [ ] Mettre à jour `README.md` section installation

### Validation Lot 3

- [ ] `scripts/build-release.ps1` → exe produit sans erreur
- [ ] `dist/HytaleAssetStudio/HytaleAssetStudio.exe` fonctionne sans Python préalable
- [ ] Toutes opérations Studio fonctionnelles depuis l'exe

---

## Merge checklist

- [ ] Lot 1 validé
- [ ] Lot 2 validé
- [ ] Lot 3 validé
- [ ] `SESSION_RECAP.md` mis à jour
- [ ] `VISION.md` mis à jour (section distribution)
- [ ] `README.md` mis à jour (section installation → télécharger l'exe)
