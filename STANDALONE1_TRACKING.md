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
| Lot 2 | Fenêtre native pywebview | `done` |
| Lot 3 | Packaging PyInstaller | `done` |

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

- Global status: `in-progress`
- Dépend de: Lot 1 validé ✅

### 2.1 — Ajouter pywebview comme dépendance

- Status: `done`
- Fichiers cibles:
  - `backend/requirements.txt`
  - `backend/requirements.lock`
- Tasks:
  - [x] Ajouter `pywebview>=5` à `backend/requirements.txt` — résolu pywebview==6.1
  - [x] Régénérer `backend/requirements.lock` via `uv pip compile` — 36 packages résolus
  - [x] Installer dans le venv et vérifier l'import — OK (pythonnet + clr-loader inclus)

### 2.2 — Créer le point d'entrée standalone

- Status: `done`
- Fichiers cibles:
  - `app.py` (nouveau, racine du repo)
- Tasks:
  - [x] Démarrer uvicorn dans un thread daemon
  - [x] Polling health check jusqu'à disponibilité backend (`GET /api/v1/health`)
  - [x] Ouvrir la fenêtre pywebview sur `http://127.0.0.1:8000/`
  - [x] Fermeture fenêtre → arrêt propre uvicorn (`server.should_exit`)

### 2.3 — Validation manuelle Lot 2

- Status: `done`
- Tasks:
  - [x] `python app.py` → fenêtre native ouverte, UI chargée ✅
  - [x] Fermeture fenêtre → exit propre (code 0) ✅
  - [x] `python -m pytest` → 47 passed ✅

### Validation Lot 2

- [x] Fenêtre native fonctionnelle (`python app.py`) ✅
- [x] Fermeture propre ✅
- [x] Tests backend : 47 passed ✅

---

## Lot 3 — Packaging PyInstaller

- Global status: `in-progress`
- Dépend de: Lot 2 validé

### 3.1 — Configurer PyInstaller

- Status: `done`
- Fichiers cibles:
  - `HytaleAssetStudio.spec` (nouveau, racine)
  - `backend/requirements.txt` (ajout pyinstaller)
  - `backend/requirements.lock` (régénéré)
  - `backend/app/main.py` (fix `sys._MEIPASS` pour data files bundle)
- Tasks:
  - [x] Ajouter `pyinstaller>=6` à `backend/requirements.txt` et régénérer le lock — pyinstaller==6.19.0
  - [x] Créer `HytaleAssetStudio.spec` : datas frontend/dist + webview/lib/js + clr_loader DLLs + pythonnet runtime, hidden imports uvicorn/fastapi/webview, hookspath pywebview, mode onedir, console=False
  - [x] Fixer `_FRONTEND_DIST` dans `main.py` pour utiliser `sys._MEIPASS` en mode bundle

### 3.2 — Valider le build PyInstaller

- Status: `done`
- Tasks:
  - [x] `pyinstaller HytaleAssetStudio.spec --clean -y` → build sans erreur ✅
  - [x] Smoke test EXE (5s sans crash) ✅
  - [x] `dist/HytaleAssetStudio/HytaleAssetStudio.exe` → fenêtre UI fonctionnelle ✅
  - [x] Browse dossier fonctionne (dialogue natif via pywebview.FileDialog) ✅
  - [ ] Vérifier sur environnement sans Python dans PATH **(optionnel)**

### 3.3 — Script de build release

- Status: `done`
- Fichiers cibles:
  - `scripts/build-release.ps1` (nouveau)
- Tasks:
  - [x] Créer `scripts/build-release.ps1` : npm build + pyinstaller `-y`
  - [ ] Mettre à jour `README.md` section installation

### Validation Lot 3

- [x] `pyinstaller HytaleAssetStudio.spec --clean -y` → exe produit sans erreur ✅
- [x] Smoke test exe 5s sans crash ✅
- [x] `dist/HytaleAssetStudio/HytaleAssetStudio.exe` → UI fonctionnelle ✅
- [x] Browse dossier → dialogue natif Windows (pywebview.FileDialog) ✅

---

## Merge checklist

- [x] Lot 1 validé
- [x] Lot 2 validé
- [x] Lot 3 validé
- [x] `SESSION_RECAP.md` mis à jour
- [x] `VISION.md` mis à jour (section 4 Distribution ajoutée, ancienne §4→§5, §5→§6)
- [x] `README.md` mis à jour (section standalone exe en tête du Quick start)
