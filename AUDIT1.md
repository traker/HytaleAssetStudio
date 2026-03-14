# AUDIT1 — Harmonisation structure & nettoyage

Issu de l'audit du 2026-03-14. Objectif : éliminer le code mort, déduplication de logique, harmoniser la structure des modules backend et frontend.

Aucune fonctionnalité nouvelle n'est introduite dans ce chantier.

---

## Lot 1 — Nettoyage sans risque

Suppressions et renommages purs. Risque : nul (pas de logique modifiée).

### 1.1 — Supprimer les binaires commitées à la racine

**Fichiers :**
- `Capture d'écran 2026-03-13 154451.png`
- `Capture d'écran 2026-03-14 024458.png`

**Ce qu'il faut faire :**
```
git rm "Capture d'écran 2026-03-13 154451.png"
git rm "Capture d'écran 2026-03-14 024458.png"
```

---

### 1.2 — Supprimer `ProjectGraphView.tsx` (dead code)

**Fichier :** `frontend/src/views/ProjectGraphView.tsx`

Wrapper backward-compat de 11 lignes non importé nulle part dans le code actif. `App.tsx` importe directement `ProjectGraphItemsView`.

**Ce qu'il faut faire :**
- Vérifier (`grep -r ProjectGraphView src/`) → 0 imports actifs
- Supprimer le fichier

---

### 1.3 — Supprimer `frontend/src/assets/react.svg`

Leftover du template Vite. Jamais importé dans le code actif.

**Ce qu'il faut faire :**
- Vérifier (`grep -r react.svg src/`) → 0 imports
- Supprimer le fichier

---

### 1.4 — Supprimer les dossiers vides `backend/static/` et `backend/core/graph/`

Ces dossiers ne contiennent que des `.gitkeep`. `backend/static/` n'est monté nulle part dans `main.py`. `backend/core/graph/` laisse croire que la logique graphe y est découpée (elle ne l'est pas).

**Ce qu'il faut faire :**
- `git rm -r backend/static/` (ou garder si une feature est planifiée — documenter dans ce cas)
- `git rm -r backend/core/graph/`

---

### 1.5 — Archiver `scripts/convert_tests.py`

Script one-shot de migration `unittest → pytest` accompli dans `STABILSTAGE2`. Sa présence dans `scripts/` laisse croire que des tests restent à migrer.

**Ce qu'il faut faire :**
- Déplacer vers `archived_task/convert_tests.py`
- Vérifier que `scripts/` contient encore `dev.ps1` (actif) après le déplacement

---

### 1.6 — Renommer les fichiers composants React en PascalCase

Deux fichiers dans `frontend/src/components/editor/` exportent principalement des composants React mais sont nommés en camelCase, à l'inverse de la convention du projet :

| Actuel | Cible |
|---|---|
| `interactionFormTypeSections.tsx` | `InteractionFormTypeSections.tsx` |
| `interactionFormStructuredEditors.tsx` | `InteractionFormStructuredEditors.tsx` |

**Ce qu'il faut faire :**
- Renommer les fichiers (git mv)
- Mettre à jour tous les imports (`InteractionFormPanel.tsx` et autres consommateurs)
- Vérifier `npm run build` → OK

---

## Lot 2 — Harmonisation backend

Refactorings de faible risque : déplacements de code et de responsabilités sans modifier les interfaces publiques (routes inchangées, 41 tests doivent passer).

### 2.1 — Déduplication de `_group_for_server_path`

**Problème :** la fonction `_group_for_server_path` existe en 3 copies verbatim :
- `backend/core/graph_service.py` (×2 : une dans `build_focus_graph`, une dans `build_modified_graph`)
- `backend/routes/index_graph.py` (×1 : utilisée dans `_build_search_results`)

**Ce qu'il faut faire :**
- Extraire la fonction au niveau module dans `graph_service.py` (avec export)
- Importer depuis `index_graph.py` au lieu de redéfinir
- Vérifier 41 tests OK

---

### 2.2 — Découper `models.py` en modules thématiques

**Problème :** `models.py` (199 lignes) mélange DTOs d'API et modèles de domaine.

**Décomposition cible :**

```
backend/core/models/
  __init__.py        # re-exports pour backward compat
  workspace.py       # WorkspaceConfig, WorkspaceOpenRequest, WorkspaceOpenResponse,
                     # WorkspaceDefaults, WorkspaceProjectsResponse
  project.py         # ProjectConfig, ProjectConfigProject, ProjectLayer,
                     # ProjectInfo, ProjectManifest, ImportPackNewProject
  asset.py           # PackSource, SourceType, AssetPutRequest, AssetGetResponse,
                     # AssetCopyRequest, AssetCopyResponse, CommonResourceResponse
  request.py         # ImportPackRequest, ProjectCreateRequest, LayersUpdateRequest,
                     # ManifestUpdateRequest
```

Le `__init__.py` re-exporte tout pour que tous les imports existants (`from backend.core.models import X`) continuent de fonctionner sans toucher aux fichiers appelants.

**Ce qu'il faut faire :**
- Créer `backend/core/models/` avec les 4 fichiers + `__init__.py`
- Supprimer `backend/core/models.py`
- Vérifier 41 tests OK + `npm run build` OK

---

### 2.3 — Déplacer `_project_config_path` et `_load_workspace_defaults` vers `project_service.py`

**Problème :** `_project_config_path` est une fonction privée de `workspace_service.py` importée directement par `import_service.py` et `project_create_service.py`. `_load_workspace_defaults` est dans le même cas pour `import_service.py`.

Ces deux helpers concernent la config projet/workspace, pas l'ouverture du workspace.

**Ce qu'il faut faire :**
- Déplacer `_project_config_path` dans `project_service.py`
- Déplacer `_load_workspace_defaults` dans `project_service.py`
- Mettre à jour les imports dans `import_service.py`, `project_create_service.py`, `workspace_service.py`
- Vérifier 41 tests OK

---

### 2.4 — Nettoyer `pydantic_compat.py`

**Problème :** `pydantic_compat.py` (shim Pydantic v1/v2) est importé en double dans `projects.py` (module level et à l'intérieur d'une fonction body). Le projet est sur Pydantic v2 exclusivement.

**Ce qu'il faut faire :**
- Vérifier que `pydantic>=2.7` est la seule version requise dans `requirements.txt` (déjà le cas)
- Vérifier que `model_dump()` peut être appelé directement (Pydantic v2 natif)
- Supprimer `backend/core/pydantic_compat.py`
- Remplacer tous les `from backend.core.pydantic_compat import model_dump` par `.model_dump()` appelé sur l'instance
- Vérifier 41 tests OK

---

### 2.5 — Clarifier `index_graph.py` : renommer ou re-scoper

**Problème :** `routes/index_graph.py` couvre à la fois la gestion de l'index (`/rebuild`) et les endpoints client-facing (`/search`, `/graph`, `/graph-modified`). Le nom est trompeur.

**Ce qu'il faut faire :**
- Renommer `routes/index_graph.py` → `routes/graph.py`
- Mettre à jour l'import dans `app/main.py` (`from backend.routes.graph import router as graph_router`)
- Vérifier 41 tests OK

---

## Lot 3 — Harmonisation frontend

Refactorings de structure frontend. Le build doit rester vert après chaque étape.

### 3.1 — Créer `frontend/src/hooks/` et extraire les hooks partagés

**Problème :** aucun hook custom n'est extrait. La logique d'état réutilisable est inline dans les vues.

**Ce qu'il faut faire :**
- Créer `frontend/src/hooks/`
- Extraire `useProjectConfig` depuis `ProjectConfigView.tsx` (chargement + sauvegarde config projet)
- Extraire `useAsset` depuis `AssetSidePanel.tsx` (fetch asset par clé)
- Vérifier `npm run build` → OK

---

### 3.2 — Créer `frontend/src/utils/` et y déplacer les helpers purs

**Problème :** `clone<T>()` (`JSON.parse(JSON.stringify(v))`) est défini inline dans `ProjectConfigView.tsx`. Les helpers purs n'ont pas de home.

**Ce qu'il faut faire :**
- Créer `frontend/src/utils/clone.ts` (ou `utils/index.ts`)
- Y déplacer `clone<T>()` et tout helper pur similaire découvert
- Mettre à jour les imports dans les consommateurs
- Vérifier `npm run build` → OK

---

### 3.3 — Isoler les internals HTTP dans `api/`

**Problème :**
- `http.ts` mélange `HasApiError` (classe d'erreur domaine), session storage (`setApiWorkspaceId`), et les primitives transport (`httpFetch`, `httpJson`)
- `api/index.ts` expose `httpFetch` et `httpJson` dans le barrel, qui fuient vers les vues

**Ce qu'il faut faire :**
- Créer `frontend/src/api/client.ts` : n'exporte que `httpFetch` et `httpJson` (primitives internes)
- `http.ts` devient `frontend/src/api/workspaceSession.ts` : gère `HasApiError` + `setApiWorkspaceId` + `buildHeaders`
- `api/index.ts` : ne re-exporte plus `httpFetch` ni `httpJson` (internals)
- Mettre à jour les imports dans `hasApi.ts` et les autres consommateurs
- Vérifier `npm run build` → OK

---

### 3.4 — Documenter la stratégie `types.ts` vs `generated.ts`

**Problème :** le script `npm run codegen` génèrerait `src/api/generated.ts` depuis l'OpenAPI, mais `types.ts` est maintenu manuellement. La relation entre les deux est indéfinie.

**Décision à prendre (choix A ou B) :**
- **A — Supprimer `types.ts` et migrer vers `generated.ts`** : plus de maintenance manuelle, but codegen doit tourner avec le backend actif
- **B — Garder `types.ts` comme source de vérité frontend, `generated.ts` comme référence/validation** : plus stable pour le CI

**Ce qu'il faut faire :**
- Trancher A ou B (décision produit)
- Documenter dans `frontend/README.md`
- Si A : migrer les imports, supprimer `types.ts`

---

### 3.5 — Déplacer `InteractionTreeEditor` et `ProjectGraphEditor` dans `components/editor/`

**Problème :** ces deux fichiers (538/536 lignes) sont dans `views/project/` mais n'encodent aucune logique de navigation ni de routing. Ils sont des composants ReactFlow prop-driven réutilisables.

**Ce qu'il faut faire :**
- `git mv frontend/src/views/project/InteractionTreeEditor.tsx frontend/src/components/editor/`
- `git mv frontend/src/views/project/ProjectGraphEditor.tsx frontend/src/components/editor/`
- Mettre à jour les imports dans `ProjectGraphInteractionsView.tsx`, `ProjectGraphItemsView.tsx`, et tout autre consommateur
- Vérifier `npm run build` → OK

---

## Récapitulatif des priorités

| Item | Lot | Priorité | Risque | Dépendances |
|---|---|---|---|---|
| 1.1 Supprimer PNGs | 1 | P0 | Nul | — |
| 1.2 Dead code ProjectGraphView | 1 | P0 | Nul | — |
| 1.3 react.svg | 1 | P0 | Nul | — |
| 1.4 Dossiers vides | 1 | P0 | Nul | — |
| 1.5 Archiver convert_tests.py | 1 | P1 | Nul | — |
| 1.6 Renommage PascalCase | 1 | P1 | Très faible | — |
| 2.1 Dédup _group_for_server_path | 2 | P0 | Faible | — |
| 2.2 Découper models.py | 2 | P1 | Faible | — |
| 2.3 Déplacer helpers workspace | 2 | P1 | Faible | 2.2 |
| 2.4 Supprimer pydantic_compat | 2 | P1 | Faible | — |
| 2.5 Renommer index_graph.py | 2 | P2 | Nul | — |
| 3.1 Créer hooks/ | 3 | P1 | Moyen | — |
| 3.2 Créer utils/ | 3 | P1 | Très faible | — |
| 3.3 Isoler api/ internals | 3 | P1 | Faible | — |
| 3.4 Stratégie types.ts vs generated | 3 | P2 | Faible | — |
| 3.5 Déplacer editors vers components | 3 | P2 | Très faible | — |
