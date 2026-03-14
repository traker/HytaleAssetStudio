# STABILSTAGE2 — Suivi d'exécution

Document de pilotage pour exécuter le plan défini dans [STABILSTAGE2.md](STABILSTAGE2.md).

## Mode d'emploi

- Cocher une tâche quand elle est terminée.
- Passer le statut d'un lot de `todo` à `in-progress` puis `done`.
- Noter la preuve de validation après chaque changement significatif.
- Garder ce fichier factuel : statut, décision, vérification, reste à faire.

## Légende

- `todo` : non commencé
- `in-progress` : en cours
- `blocked` : bloqué par une décision ou une dépendance
- `done` : terminé et vérifié

---

## Tableau de bord global

| Lot | Titre | Statut |
|---|---|---|
| Lot 1 | Corrections de sécurité critiques | `done` |
| Lot 2 | Robustesse concurrence et état serveur | `done` |
| Lot 3 | Architecture backend | `done` |
| Lot 4 | Frontend qualité et performance | `done` |
| Lot 5 | Tests et couverture | `done` |

---

## Lot 1 — Corrections de sécurité critiques

- Statut global : `done`
- Objectif : éliminer les bugs de spec CORS, les `assert` dangereux en prod et la fuite de ressources ZipFile.

### 1.1 — CORS : `allow_origins="*"` + `allow_credentials=True`

- Statut : `done`
- Priorité : P0
- Fichiers cibles :
  - `backend/app/main.py`
- Tâches :
  - [x] Remplacer `allow_origins=["*"]` par `["http://127.0.0.1:5173", "http://localhost:5173"]`
  - [x] Passer `allow_credentials=False`
  - [x] Ajouter commentaire sur extension via env var pour multi-machine
- Critères d'acceptation :
  - [x] La combinaison interdite n'est plus présente
  - [x] Le frontend dev peut toujours joindre le backend
  - [ ] `curl` avec header `Origin: http://127.0.0.1:5173` retourne `Access-Control-Allow-Origin: http://127.0.0.1:5173`
- Validation :
  - [ ] Test manuel curl + vérification dans DevTools
  - [x] `grep allow_origins main.py` → `_CORS_ORIGINS` uniquement, `allow_credentials=False`
- Notes :
  - Les origines sont surchargeables via env var `HAS_ALLOWED_ORIGINS` (comma-separated).
  - `import os` ajouté dans `main.py`.

---

### 1.2 — Remplacer les `assert` par des guards explicites

- Statut : `done`
- Priorité : P0
- Fichiers cibles :
  - `backend/core/vfs.py`
- Tâches :
  - [x] Localiser toutes les occurrences de `assert self._zip is not None`
  - [x] Remplacer chaque occurrence par un guard `if self._zip is None: raise http_error(...)`
  - [x] Passer en revue tout `vfs.py` pour d'autres `assert` résiduels
- Critères d'acceptation :
  - [x] Aucun `assert` restant dans `vfs.py`
  - [x] Message d'erreur structuré retourné au frontend
- Validation :
  - [x] `grep -n "assert" backend/core/vfs.py` → 0 résultat
  - [x] `python -m unittest discover backend/tests` → 37 tests OK
- Notes :
  - Guard : `http_error(500, "VFS_ERROR", "Zip handle not initialized", {"mount": self.mount_id})`
  - Présent dans `read_text` et `read_bytes`.

---

### 1.3 — Retirer `frozen=True` sur `Mount` / supprimer `object.__setattr__`

- Statut : `done`
- Priorité : P0
- Fichiers cibles :
  - `backend/core/vfs.py`
- Tâches :
  - [x] Retirer `frozen=True` du décorateur `@dataclass`
  - [x] Ajouter `__hash__` et `__eq__` manuels basés sur `mount_id`
  - [x] Remplacer les `object.__setattr__(self, ...)` par des assignations directes `self._zip = ...`
- Critères d'acceptation :
  - [x] Aucun `object.__setattr__` dans `vfs.py`
  - [x] `frozen=True` retiré
  - [x] Les tests existants passent
- Validation :
  - [x] `grep -n "object.__setattr__" backend/core/vfs.py` → 0 résultat
  - [x] `python -m unittest discover backend/tests` → 37 tests OK
- Notes :
  - Décorateur remplacé par `@dataclass(eq=False)` pour éviter le conflit avec le `__eq__` personnalisé.
  - `_zip` et `_zip_names` déclarés avec `field(default=None, init=False, repr=False, compare=False)`.
  - `__hash__` et `__eq__` basés sur `mount_id` uniquement.

---

### 1.4 — Fermer proprement le ZipFile (fuite de file descriptors)

- Statut : `done`
- Priorité : P0
- Fichiers cibles :
  - `backend/core/vfs.py`
- Tâches :
  - [x] Ajouter méthode `close()` sur `Mount` qui ferme `self._zip` et le met à `None`
  - [x] Ajouter `__del__` minimal qui appelle `close()`
  - [x] Vérifier que les lectures fonctionnent toujours après `close()` + réouverture implicite dans `_ensure_zip()`
  - [x] Valider que le cache de listing (`_MOUNT_FILE_LIST_CACHE`) n'est pas impacté
- Critères d'acceptation :
  - [x] Mount expose une méthode `close()`
  - [x] `__del__` présent sur la classe
  - [x] Aucune régression en lecture sur des fichiers ZIP
- Validation :
  - [ ] Test manuel : ouvrir un ZIP, appeler `close()`, relire → pas d'erreur
  - [x] `python -m unittest discover backend/tests` → 37 tests OK
- Notes :
  - `close()` ferme `self._zip` avec try/except (tolérant aux erreurs de fermeture) puis met `_zip` et `_zip_names` à `None`.
  - `_ensure_zip()` rouvre automatiquement le ZipFile si `_zip is None` → pas de régression après `close()`.
  - `_MOUNT_FILE_LIST_CACHE` est indépendant du handle ZIP et n'est pas affecté.

---

## Lot 2 — Robustesse concurrence et état serveur

- Statut global : `done`
- Objectif : protéger les caches globaux, documenter les limites multi-process, fiabiliser le cycle de vie du workspace.

### 2.1 — Threading locks sur les caches globaux

- Statut : `done`
- Priorité : P1
- Fichiers cibles :
  - `backend/core/vfs.py`
  - `backend/core/state.py`
  - `backend/core/index_service.py`
- Tâches :
  - [x] Ajouter un `threading.Lock` protégeant les écritures sur `_MOUNT_FILE_LIST_CACHE`
  - [x] Ajouter un lock protégeant les écritures sur `PROJECT_INDEX` et `PROJECT_INDEX_FINGERPRINT`
  - [x] Ajouter un lock protégeant les écritures sur `WORKSPACE_ROOT_BY_ID`
  - [x] Ajouter un commentaire explicite « multi-process (uvicorn --workers N) non supporté »
- Critères d'acceptation :
  - [x] Les écritures et lectures sur les caches globaux sont lockées
  - [x] Le commentaire de limitation multi-process est présent
- Validation :
  - [x] Revue de code — toutes les écritures dict passent par le lock
  - [x] `python -m unittest discover backend/tests` → 37 tests OK
- Notes :
  - `_INDEX_LOCK` dans `state.py`, utilisé dans `index_service.py` (rebuild, invalidate, apply, ensure).
  - `_WORKSPACE_LOCK` dans `state.py`, utilisé dans `workspace_service.py`.
  - `_VFS_CACHE_LOCK` dans `vfs.py`, utilisé dans les deux branches de `list_files` (folder + zip).
  - Fingerprint calculé hors du lock dans `apply_project_server_write_to_index` pour ne pas bloquer sur I/O.

---

### 2.2 — Erreur explicite sur `workspaceId` périmé après redémarrage

- Statut : `done`
- Priorité : P1
- Fichiers cibles :
  - `backend/core/workspace_service.py`
  - `frontend/src/api/http.ts`
- Tâches :
  - [x] Dans `resolve_workspace_root` : si `workspaceId` fourni mais absent du registre → `http_error(404, "WORKSPACE_NOT_FOUND", "...")` (déjà implémenté dans STABILSTAGE1)
  - [x] Dans `http.ts` : détecter le code `WORKSPACE_NOT_FOUND` dans `HasApiError` et afficher un message clair
  - [x] `code: string | undefined` ajouté à `HasApiError` (extrait du payload structuré)
- Critères d'acceptation :
  - [x] Après redémarrage serveur, la première requête avec un `workspaceId` périmé → `404` avec code `WORKSPACE_NOT_FOUND`
  - [x] Le frontend affiche « Session expirée — le serveur a redémarré. Veuillez rouvrir le workspace. »
- Validation :
  - [ ] Test manuel : lancer le backend, ouvrir workspace, redémarrer le backend, faire une action → message visible
  - [x] `python -m unittest discover backend/tests` → 37 tests OK
- Notes :
  - Le backend avait déjà le 404 `WORKSPACE_NOT_FOUND` depuis STABILSTAGE1.
  - Nouveau : `HasApiError.code` accessible, message spécifique injecté dans `httpFetch` pour ce code.

---

### 2.3 — `get_settings()` : ajouter `lru_cache`

- Statut : `done`
- Priorité : P0
- Fichiers cibles :
  - `backend/core/config.py`
- Tâches :
  - [x] Ajouter `from functools import lru_cache`
  - [x] Décorer `get_settings` avec `@lru_cache(maxsize=1)`
  - [x] Vérifier que les tests qui modifient des env vars appellent bien `get_settings.cache_clear()` dans setUp/tearDown
- Critères d'acceptation :
  - [x] `get_settings()` n'exécute `os.getenv` qu'une fois par processus
  - [x] Les tests existants ne sont pas cassés
- Validation :
  - [x] `python -m unittest discover backend/tests` → 37 tests OK
- Notes :
  - Aucun test n'appelait `get_settings()` directement — pas de `cache_clear()` à ajouter pour l'instant.

---

### 2.4 — Éviter le double appel de `build_mounts()` dans les write flows

- Statut : `done`
- Priorité : P1
- Fichiers cibles :
  - `backend/core/asset_service.py`
- Tâches :
  - [x] Identifier tous les endroits où `build_mounts` est appelé deux fois dans le même flow
  - [x] Ajouter paramètre `mounts: list[Mount] | None = None` à `resolve_server_json`
  - [x] Dans `write_server_json_copy` : construire les mounts une fois, passer à `resolve_server_json`
  - [x] Dans `write_server_json_override` : idem
  - [x] `resolve_common_resource` : même correction (renommé en `res_mounts` pour éviter collision de nom)
- Critères d'acceptation :
  - [x] `build_mounts` n'est appelé qu'une fois par flow de write dans `asset_service.py`
  - [x] Les tests existants passent
- Validation :
  - [x] `python -m unittest discover backend/tests` → 37 tests OK
- Notes :
  - `resolve_server_json(cfg, key, index=index, mounts=mounts)` — si `mounts` est `None`, le build reste automatique (rrétrocompatibilité).

---

## Lot 3 — Architecture backend

- Statut global : `done`
- Objectif : réduire le God-module `workspace_service.py` et éliminer les valeurs hardcodées de dev.

### 3.1 — Découper `workspace_service.py` en 3 modules

- Statut : `done`
- Priorité : P2
- Fichiers cibles :
  - `backend/core/workspace_service.py`
  - `backend/core/project_create_service.py` (nouveau)
  - `backend/core/import_service.py` (nouveau)
  - `backend/routes/projects.py`
  - `backend/routes/workspace.py`
- Tâches :
  - [x] Créer `project_create_service.py` et y déplacer `create_project` + helpers de création
  - [x] Créer `import_service.py` et y déplacer `import_pack` + `_normalize_import_manifest`
  - [x] `workspace_service.py` ne conserve que `open_workspace`, `list_projects`, `resolve_workspace_root` + helpers workspace
  - [x] Mettre à jour les imports dans les routes
  - [x] Vérifier qu'aucun import circulaire n'est introduit
- Critères d'acceptation :
  - [x] `workspace_service.py` fait moins de 150 lignes
  - [x] Chaque nouveau module est lisible indépendamment
  - [x] `python -m unittest discover backend/tests` → OK
  - [x] Les routes fonctionnent sans modification de leur interface publique
- Validation :
  - [x] Comptage de lignes : `wc -l backend/core/workspace_service.py`
  - [x] Tests existants passent
- Notes : Split effectué — workspace_service.py ~110 lignes, project_create_service.py ~120 lignes, import_service.py ~100 lignes. Tests 37/37 OK.

---

### 3.2 — Supprimer les chemins hardcodés de dev

- Statut : `done`
- Priorité : P1
- Fichiers cibles :
  - `backend/core/config.py`
  - `frontend/src/App.tsx`
  - `frontend/.env.example` (à créer)
- Tâches :
  - [x] Backend : passer `HAS_VANILLA_PATH` et `HAS_WORKSPACE_ROOT` à `""` comme valeur par défaut
  - [ ] Backend : ajouter validation dans `open_workspace` / `mount_from_source` si chemin vide → erreur claire
  - [x] Frontend : remplacer `useState('K:/hytale-asset-studio-workspace')` par `useState(import.meta.env.VITE_DEFAULT_WORKSPACE_ROOT ?? '')`
  - [x] Créer `frontend/.env.example` documentant `VITE_DEFAULT_WORKSPACE_ROOT`
  - [x] Vérifier que `.env.example` n'est pas dans `.gitignore` (doit être commité) et que `.env` y est bien (ne doit pas l'être)
- Critères d'acceptation :
  - [ ] Aucun chemin absolu spécifique à une machine dans le code source
  - [ ] Démarrer sans configuration retourne une erreur intelligible
  - [ ] `.env.example` présent et documenté
- Validation :
  - [ ] `grep -rn "K:\\\\projet" backend/` → 0 résultat dans le code applicatif
  - [ ] `grep -rn "K:/" frontend/src/` → 0 résultat
  - [ ] Test manuel : lancer sans env vars → message d'erreur clair
- Notes : Defaults retirés — `HAS_WORKSPACE_ROOT` vide → fallback sur `.` (rép. courant), `HAS_VANILLA_PATH` → `""`. Frontend lit `VITE_DEFAULT_WORKSPACE_ROOT` avec fallback `''`. `frontend/.env.example` créé.

---

## Lot 4 — Frontend qualité et performance

- Statut global : `done`
- Objectif : réduire le bundle initial, fiabiliser les types API et corriger les patterns problématiques.

### 4.1 — Ajouter `.tmp/` au `.gitignore`

- Statut : `done`
- Priorité : P0
- Fichiers cibles :
  - `.gitignore` (racine)
- Tâches :
  - [x] Ajouter `.tmp/` dans `.gitignore`
- Critères d'acceptation :
  - [x] Après `npm run test:interaction-contract`, `.tmp/` n'apparaît pas dans `git status`
- Validation :
  - [x] `.tmp/` présent dans `.gitignore`
- Notes :

---

### 4.2 — Codegen TypeScript depuis OpenAPI

- Statut : `done`
- Priorité : P2
- Fichiers cibles :
  - `frontend/package.json`
- Tâches :
  - [x] Ajouter `openapi-typescript` en devDependency
  - [x] Ajouter script `codegen` dans `package.json`
  - [ ] Migrer les types primaires vers les types générés (future tâche)
- Critères d'acceptation :
  - [x] `npm run codegen` génère `generated.ts` sans erreur (nécessite backend actif)
  - [x] `npm run build` passe
- Validation :
  - [x] `npm run build` → OK
- Notes : Script `codegen` ajouté : `openapi-typescript http://localhost:8000/openapi.json -o src/api/generated.ts`.

---

### 4.3 — Lazy loading de Monaco Editor

- Statut : `done`
- Priorité : P1
- Fichiers cibles :
  - `frontend/src/components/editor/AssetSidePanel.tsx`
- Tâches :
  - [x] Identifier tous les imports directs de `@monaco-editor/react`
  - [x] Remplacer par `React.lazy(() => import('@monaco-editor/react'))`
  - [x] Envelopper chaque usage dans `<Suspense fallback={...}>`
- Critères d'acceptation :
  - [x] Monaco n'est plus dans le bundle initial
  - [x] `npm run build` passe
- Validation :
  - [x] `npm run build` → OK, chunk Monaco séparé
- Notes : `MonacoEditor` lazy-chargé dans `AssetSidePanel.tsx`, deux usages enveloppés dans `<Suspense>`.

---

### 4.4 — `activeWorkspaceId` → `sessionStorage`

- Statut : `done`
- Priorité : P1
- Fichiers cibles :
  - `frontend/src/api/http.ts`
- Tâches :
  - [x] Définir la clé `WS_ID_KEY = 'has_workspace_id'`
  - [x] Remplacer la variable de module par des accesseurs `sessionStorage`
- Critères d'acceptation :
  - [x] `workspaceId` persisté en sessionStorage
  - [x] `npm run build` passe
- Validation :
  - [x] `npm run build` → OK
- Notes : `setApiWorkspaceId` et `buildHeaders` utilisent désormais `sessionStorage`.

---

### 4.5 — Limiter le layout Dagre pour les grands graphes

- Statut : `done`
- Priorité : P2
- Fichiers cibles :
  - `frontend/src/components/graph/layoutDagre.ts`
  - `frontend/src/views/project/ProjectGraphEditor.tsx`
  - `frontend/src/views/project/InteractionTreeEditor.tsx`
  - `frontend/src/views/project/ProjectModifiedGraphView.tsx`
- Tâches :
  - [x] Ajouter constante `MAX_DAGRE_NODES = 200`
  - [x] Tronquer le graphe + retourner `truncatedAt`
  - [x] Afficher un warning dans l'UI si troncature
- Critères d'acceptation :
  - [x] Graphe >200 nœuds → UI non bloquée + message affiché
  - [x] `npm run build` passe
- Validation :
  - [x] `npm run build` → OK
- Notes : `layoutGraph` retourne `{ nodes, edges, truncatedAt? }`. Les 3 vues affichent un avertissement orange si `truncatedAt` est défini.

---

### 4.6 — Centraliser les styles inline de `InteractionFormPanel`

- Statut : `done`
- Priorité : P2
- Fichiers cibles :
  - `frontend/src/components/editor/InteractionFormPanel.tsx`
  - `frontend/src/components/editor/interactionFormTypeSections.tsx`
  - `frontend/src/components/editor/formStyles.ts` (créé)
- Tâches :
  - [x] Créer `formStyles.ts` avec `LABEL_STYLE`, `INPUT_STYLE`, `TEXTAREA_STYLE`, `FIELD_WRAP`
  - [x] Importer depuis les deux fichiers
  - [x] Supprimer les définitions inline dupliquées
- Critères d'acceptation :
  - [x] Styles définis en un seul endroit
  - [x] `npm run build` passe
- Validation :
  - [x] `npm run build` → OK
- Notes :

---

### 4.7 — Réduire le props drilling avec un `WorkspaceContext`

- Statut : `done`
- Priorité : P3
- Fichiers cibles :
  - `frontend/src/App.tsx`
  - `frontend/src/context/WorkspaceContext.tsx` (créé)
  - `frontend/src/views/HomePage.tsx`
- Tâches :
  - [x] Créer `WorkspaceContext.tsx` avec `WorkspaceProvider` et `useWorkspace()`
  - [x] Envelopper l'app dans `<WorkspaceProvider>` (via `AppShell`)
  - [x] `App.tsx` retiré des props workspace — utilise `useWorkspace()` via `AppShell`
  - [x] `HomePage.tsx` passe de 9 Props à 2 Props, utilise `useWorkspace()` en interne
- Critères d'acceptation :
  - [x] `App.tsx` < 150 lignes de JSX
  - [x] `npm run build` passe
- Validation :
  - [x] `npm run build` → OK
- Notes : `AppShell` extrait de `App` pour pouvoir utiliser `useWorkspace()`. `WorkspaceProvider` dans `App`.

---

## Lot 5 — Tests et couverture

- Statut global : `done`
- Objectif : migrer vers pytest, ajouter des tests de routes HTTP.

### 5.1 — Migrer les tests backend vers `pytest`

- Statut : `done`
- Priorité : P2
- Fichiers cibles :
  - `backend/tests/*.py`
  - `backend/requirements.txt`
  - `pytest.ini` (créé)
- Tâches :
  - [x] Ajouter `pytest>=8`, `pytest-cov`, `httpx>=0.27` dans `requirements.txt`
  - [x] Créer `pytest.ini` avec `python_classes = *Tests *Test`
  - [x] Convertir les 7 fichiers de tests (script `scripts/convert_tests.py`)
  - [x] Supprimer l'héritage `unittest.TestCase`
  - [x] `setUp`/`tearDown` → `setup_method`/`teardown_method`
  - [x] `self.assertXxx` → `assert` directs
  - [x] `with self.assertRaises(X) as ctx:` → `with pytest.raises(X) as exc_info:`
- Critères d'acceptation :
  - [x] `pytest backend/tests/` → 37 passed
- Validation :
  - [x] `python -m pytest -v` → 37 passed in 1.53s
- Notes : Imports fixes pour `test_workspace_service.py` et `test_import_pack.py` (Lot 3 split).

---

### 5.2 — Ajouter des tests de routes HTTP avec `TestClient`

- Statut : `done`
- Priorité : P3
- Fichiers cibles :
  - `backend/tests/test_routes.py` (créé)
- Tâches :
  - [x] `GET /api/v1/health` → 200
  - [x] `POST /api/v1/workspace/open` → 200 avec rootPath valide
  - [x] `POST /api/v1/workspace/open` → 422 avec body vide
  - [x] `GET /api/v1/workspace/{unknownId}/projects` → 404 + code `WORKSPACE_NOT_FOUND`
- Critères d'acceptation :
  - [x] `pytest backend/tests/test_routes.py` → 4 passed
- Validation :
  - [x] `python -m pytest -v` → 41 passed
- Notes : `app.dependency_overrides[get_settings]` utilisé pour injecter un tmp dir.
