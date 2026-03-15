# STANDALONE1 — Plan de migration vers une application standalone

Initiated: 2026-03-15
Branch: `feature/standalone-app`

## Objectif

Transformer Hytale Asset Studio d'un outil "dev setup requis" en une application standalone double-clic, sans que l'utilisateur final n'ait à installer Python, Node.js, ou quoi que ce soit d'autre.

Public cible : modders Hytale non-développeurs, à l'aise avec des fichiers JSON mais pas avec des terminaux ou des gestionnaires de dépendances.

## Contraintes

- L'architecture backend Python (FastAPI + VFS + index + graphe) est conservée telle quelle — c'est la valeur du produit.
- Le frontend React reste la surface UI — on ne remplace pas React Flow ni les éditeurs.
- Le mode local-only (`HAS_LOCAL_ONLY=1`) reste actif et non modifiable par l'utilisateur final.
- La branche `master` ne doit pas être destabilisée. Merge uniquement quand les trois lots sont validés.

## Architecture cible

```
HytaleAssetStudio.exe (PyInstaller --onedir)
├── backend/          (FastAPI + uvicorn, thread background)
├── frontend/dist/    (React build statique, servi par FastAPI StaticFiles)
└── pywebview         (fenêtre native EdgeWebView2 sur Windows)
```

L'utilisateur double-clique sur `HytaleAssetStudio.exe`. Une fenêtre native s'ouvre directement sur l'UI du Studio. Aucun navigateur externe, aucun terminal visible.

---

## Lot 1 — Frontend servi par FastAPI (StaticFiles)

Priorité : P0 — prérequis des lots 2 et 3.

Objectif : à l'issue de ce lot, l'utilisateur peut utiliser le Studio en n'ayant que Python (+ le venv). Node.js n'est plus requis à l'exécution.

### 1.1 — Monter le build frontend comme StaticFiles dans FastAPI

Ce qui doit être fait :

- Ajouter `fastapi.staticfiles.StaticFiles` dans `backend/app/main.py` pour servir `frontend/dist/` quand le dossier existe.
- La route statique doit être montée **après** toutes les routes API (`/api/v1/...`) pour ne pas les écraser.
- Le `index.html` doit être servi pour toutes les routes non-API (SPA fallback) afin que React Router fonctionne.
- Si `frontend/dist/` est absent (mode dev normal), le backend démarre sans erreur — le frontend Vite reste utilisable en dev comme aujourd'hui.

Détails techniques :

- Monter les assets statiques sur `/` avec `html=True` ou une route catch-all.
- Ordre des middlewares : local-only middleware → API routes → StaticFiles → catch-all index.html.
- `allow_origins` reste loopback-only, `StaticFiles` ne fait pas d'API donc CORS n'est pas pertinent dessus.

Critères d'acceptance :

- `npm run build` dans `frontend/` produit `frontend/dist/`
- Le backend démarré seul (`python -m uvicorn ...`) sert l'UI sur `http://127.0.0.1:8000/`
- Toutes les routes `/api/v1/...` continuent de fonctionner normalement
- `python -m pytest` passe (47 tests minimum)
- En mode dev (sans `dist/`), le backend démarre sans erreur ou warning bloquant

### 1.2 — Adapter la configuration Vite pour le mode production

Ce qui doit être fait :

- Vérifier que `vite.config.ts` n'encode pas de base path absolu qui casserait le serving depuis FastAPI.
- Le proxy Vite (`/api` → `127.0.0.1:8000`) est utile uniquement en dev — en prod le frontend est servi par le même process FastAPI, donc pas de cross-origin. S'assurer que le build prod n'inclut pas de proxy logic.
- Vérifier que les `import.meta.env.VITE_*` utilisés dans le code se résolvent correctement en prod (notamment `VITE_DEFAULT_WORKSPACE_ROOT`).

Critères d'acceptance :

- `npm run build` sans erreur ni warning TypeScript
- L'UI servie par FastAPI charge correctement (pas d'assets 404, pas d'erreur console)

### 1.3 — Mettre à jour le script de lancement dev

Ce qui doit être fait :

- `scripts/dev.ps1` reste inchangé pour le flow dev (Vite + uvicorn séparés avec reload).
- Ajouter un mode `prod` dans `dev.ps1` (ou un script séparé `scripts/run.ps1`) qui : build le frontend, puis démarre uniquement uvicorn (sans Vite, sans reload).
- Documenter dans `backend/README.md` et `CONTRIBUTING.md` la distinction dev vs prod.

Critères d'acceptance :

- Le script prod démarre le Studio en mode production (une seule commande)
- L'UI est accessible sur `http://127.0.0.1:8000/`

---

## Lot 2 — Fenêtre native pywebview

Priorité : P1 — dépend du Lot 1.

Objectif : à l'issue de ce lot, le Studio s'ouvre dans une vraie fenêtre applicative (EdgeWebView2), sans que l'utilisateur ne voie de navigateur ni de terminal.

### 2.1 — Ajouter pywebview comme dépendance

Ce qui doit être fait :

- Ajouter `pywebview>=5` à `backend/requirements.txt`.
- Régénérer `backend/requirements.lock` via `uv pip compile`.
- Vérifier la compatibilité avec Python 3.11+ sur Windows (EdgeWebView2 est requis — présent nativement sur Windows 10 1803+ et Windows 11).

### 2.2 — Créer le point d'entrée standalone

Ce qui doit être fait :

- Créer `app.py` à la racine du repo (ou `backend/standalone.py`).
- Ce script :
  1. Démarre uvicorn dans un thread daemon (sans reload, sans accès console).
  2. Attend que le backend soit prêt (polling `GET /api/v1/health` jusqu'à 200).
  3. Ouvre une fenêtre pywebview sur `http://127.0.0.1:8000/`.
  4. Bloque sur la boucle pywebview jusqu'à ce que la fenêtre soit fermée.
  5. Arrête proprement uvicorn à la fermeture.
- La fenêtre doit avoir un titre lisible ("Hytale Asset Studio") et une taille initiale raisonnable (ex: 1280×800).

### 2.3 — Validation manuelle

Ce qui doit être fait :

- Lancer `python app.py` depuis le venv.
- Vérifier : fenêtre native, UI complète, pas d'erreur console pywebview.
- Vérifier : fermer la fenêtre arrête le process proprement (pas de process uvicorn zombie).
- Vérifier : `python -m pytest` passe toujours.

Critères d'acceptance :

- `python app.py` → fenêtre native, UI fonctionnelle
- Fermeture propre sans process zombie
- Tests backend : 47 passed minimum

---

## Lot 3 — Packaging PyInstaller

Priorité : P2 — dépend du Lot 2.

Objectif : produire un dossier `dist/HytaleAssetStudio/` autonome (mode `--onedir`) contenant l'exe et toutes ses dépendances. L'utilisateur copie ce dossier et double-clique sur l'exe.

### 3.1 — Configurer PyInstaller

Ce qui doit être fait :

- Ajouter `pyinstaller` à `backend/requirements.txt` (et régénérer le lock) — ou l'utiliser hors-venv si préféré.
- Créer un fichier `.spec` PyInstaller (`HytaleAssetStudio.spec`) à la racine.
- La spec doit :
  - inclure `frontend/dist/` comme dossier de données (`datas`)
  - inclure les éventuels fichiers de données de `pywebview` (notamment `gui/`)
  - gérer les `hidden imports` de uvicorn/fastapi/starlette (ex: `uvicorn.logging`, `uvicorn.loops.*`, `uvicorn.lifespan.*`)
  - utiliser le mode `--onedir` (pas `--onefile`)
  - désactiver la console (`console=False`) pour l'exe final

### 3.2 — Valider le build PyInstaller

Ce qui doit être fait :

- Exécuter `pyinstaller HytaleAssetStudio.spec`.
- Lancer `dist/HytaleAssetStudio/HytaleAssetStudio.exe` sur une machine sans Python installé (ou en retirant le venv du PATH).
- Vérifier : fenêtre native, UI fonctionnelle, toutes les opérations Studio (ouvrir workspace, lire assets, graphe, etc.) fonctionnent.

### 3.3 — Script de build release

Ce qui doit être fait :

- Créer `scripts/build-release.ps1` qui enchaîne :
  1. `npm run build` dans `frontend/`
  2. `pyinstaller HytaleAssetStudio.spec --clean`
- Documenter l'usage dans `README.md` (section "Build a release").

Critères d'acceptance :

- `scripts/build-release.ps1` s'exécute sans erreur
- `dist/HytaleAssetStudio/HytaleAssetStudio.exe` fonctionne sans Python préalable
- L'exe ne dépend pas de fichiers externes au dossier `dist/HytaleAssetStudio/`

---

## Merge vers master

Conditions de merge :

- [ ] Lot 1 validé (tests backend + build frontend + serving FastAPI OK)
- [ ] Lot 2 validé (fenêtre native fonctionnelle, fermeture propre)
- [ ] Lot 3 validé (exe standalone fonctionnel sur machine sans Python)
- [ ] `SESSION_RECAP.md` et `VISION.md` mis à jour pour refléter le nouveau mode de distribution
- [ ] `README.md` mis à jour : section installation remplacée par "télécharger et lancer l'exe"
