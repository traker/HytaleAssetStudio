# AUDIT1 — Suivi d'exécution

Document de pilotage pour exécuter le plan défini dans [AUDIT1.md](AUDIT1.md).

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
| Lot 1 | Nettoyage sans risque | `todo` |
| Lot 2 | Harmonisation backend | `todo` |
| Lot 3 | Harmonisation frontend | `todo` |

---

## Lot 1 — Nettoyage sans risque

- Statut global : `todo`
- Objectif : supprimer code mort, binaires parasites, dossiers vides, scripts obsolètes. Aucune logique modifiée.

### 1.1 — Supprimer les binaires commitées à la racine

- Statut : `todo`
- Priorité : P0
- Fichiers cibles :
  - `Capture d'écran 2026-03-13 154451.png`
  - `Capture d'écran 2026-03-14 024458.png`
- Tâches :
  - [ ] `git rm "Capture d'écran 2026-03-13 154451.png"`
  - [ ] `git rm "Capture d'écran 2026-03-14 024458.png"`
- Critères d'acceptation :
  - [ ] Fichiers absents du repo, `git status` propre
- Validation :
  - [ ] `git ls-files | grep png` → 0 résultat
- Notes :

---

### 1.2 — Supprimer `ProjectGraphView.tsx` (dead code)

- Statut : `todo`
- Priorité : P0
- Fichiers cibles :
  - `frontend/src/views/ProjectGraphView.tsx`
- Tâches :
  - [ ] Vérifier absence d'imports actifs : `grep -r "ProjectGraphView" frontend/src/` → 0 résultat hors fichier lui-même
  - [ ] Supprimer le fichier
  - [ ] `npm run build` → OK
- Critères d'acceptation :
  - [ ] Fichier supprimé, build OK
- Validation :
  - [ ] `npm run build` → OK
- Notes :

---

### 1.3 — Supprimer `frontend/src/assets/react.svg`

- Statut : `todo`
- Priorité : P0
- Fichiers cibles :
  - `frontend/src/assets/react.svg`
- Tâches :
  - [ ] Vérifier absence d'imports : `grep -r "react.svg" frontend/src/` → 0 résultat
  - [ ] Supprimer le fichier
  - [ ] `npm run build` → OK
- Critères d'acceptation :
  - [ ] Fichier supprimé, build OK
- Validation :
  - [ ] `npm run build` → OK
- Notes :

---

### 1.4 — Supprimer les dossiers vides `backend/static/` et `backend/core/graph/`

- Statut : `todo`
- Priorité : P0
- Fichiers cibles :
  - `backend/static/` (contient uniquement `.gitkeep`)
  - `backend/core/graph/` (contient uniquement `.gitkeep`)
- Tâches :
  - [ ] Confirmer que `main.py` ne monte pas `backend/static/`
  - [ ] `git rm -r backend/static/`
  - [ ] `git rm -r backend/core/graph/`
  - [ ] 41 tests OK
- Critères d'acceptation :
  - [ ] Dossiers absents, tests OK
- Validation :
  - [ ] `python -m pytest -v` → 41 passed
- Notes :

---

### 1.5 — Archiver `scripts/convert_tests.py`

- Statut : `todo`
- Priorité : P1
- Fichiers cibles :
  - `scripts/convert_tests.py`
- Tâches :
  - [ ] Déplacer `scripts/convert_tests.py` → `archived_task/convert_tests.py`
  - [ ] Vérifier que `scripts/dev.ps1` reste en place
- Critères d'acceptation :
  - [ ] `scripts/` ne contient plus que `dev.ps1`
  - [ ] Le script est tracé dans `archived_task/`
- Validation :
  - [ ] `Get-ChildItem scripts/` → uniquement `dev.ps1`
- Notes :

---

### 1.6 — Renommer les fichiers composants React en PascalCase

- Statut : `todo`
- Priorité : P1
- Fichiers cibles :
  - `frontend/src/components/editor/interactionFormTypeSections.tsx` → `InteractionFormTypeSections.tsx`
  - `frontend/src/components/editor/interactionFormStructuredEditors.tsx` → `InteractionFormStructuredEditors.tsx`
- Tâches :
  - [ ] `git mv interactionFormTypeSections.tsx InteractionFormTypeSections.tsx`
  - [ ] `git mv interactionFormStructuredEditors.tsx InteractionFormStructuredEditors.tsx`
  - [ ] Mettre à jour tous les imports consommateurs (rechercher les anciens noms)
  - [ ] `npm run build` → OK
- Critères d'acceptation :
  - [ ] Fichiers renommés, aucun import cassé, build OK
- Validation :
  - [ ] `npm run build` → OK
  - [ ] `grep -r "interactionFormTypeSections\|interactionFormStructuredEditors" frontend/src/` → 0 résultat
- Notes :

---

## Lot 2 — Harmonisation backend

- Statut global : `todo`
- Objectif : déduplication de logique, découpage de `models.py`, nettoyage des imports croisés entre services.

### 2.1 — Déduplication de `_group_for_server_path`

- Statut : `todo`
- Priorité : P0
- Fichiers cibles :
  - `backend/core/graph_service.py`
  - `backend/routes/index_graph.py`
- Tâches :
  - [ ] Extraire `_group_for_server_path` au niveau module dans `graph_service.py` (suppression des copies internes aux fonctions)
  - [ ] Exporter la fonction (retirer le `_` ou la rendre accessible)
  - [ ] Supprimer la copie locale dans `routes/index_graph.py`, importer depuis `graph_service.py`
  - [ ] 41 tests OK
- Critères d'acceptation :
  - [ ] 1 seule définition de `_group_for_server_path` dans tout le codebase
  - [ ] 41 tests OK
- Validation :
  - [ ] `grep -rn "_group_for_server_path\|group_for_server_path" backend/` → 1 définition, N imports
  - [ ] `python -m pytest -v` → 41 passed
- Notes :

---

### 2.2 — Découper `models.py` en modules thématiques

- Statut : `todo`
- Priorité : P1
- Fichiers cibles :
  - `backend/core/models.py` → à supprimer après migration
  - `backend/core/models/` (nouveau package)
    - `__init__.py` (re-exports backward compat)
    - `workspace.py`
    - `project.py`
    - `asset.py`
    - `request.py`
- Tâches :
  - [ ] Créer `backend/core/models/` avec les 4 modules thématiques
  - [ ] Rédiger `__init__.py` qui re-exporte tout (`from .workspace import *`, etc.) pour ne pas casser les imports existants
  - [ ] Supprimer `backend/core/models.py`
  - [ ] 41 tests OK + `npm run build` OK
- Critères d'acceptation :
  - [ ] Tous les `from backend.core.models import X` existants fonctionnent sans modification
  - [ ] 41 tests OK
- Validation :
  - [ ] `python -m pytest -v` → 41 passed
  - [ ] `npm run build` → OK
- Notes :

---

### 2.3 — Déplacer `_project_config_path` et `_load_workspace_defaults` vers `project_service.py`

- Statut : `todo`
- Priorité : P1
- Fichiers cibles :
  - `backend/core/workspace_service.py` (source)
  - `backend/core/project_service.py` (destination)
  - `backend/core/import_service.py` (consommateur)
  - `backend/core/project_create_service.py` (consommateur)
- Tâches :
  - [ ] Déplacer `_project_config_path` de `workspace_service.py` vers `project_service.py`
  - [ ] Déplacer `_load_workspace_defaults` de `workspace_service.py` vers `project_service.py`
  - [ ] Mettre à jour les imports dans `import_service.py`, `project_create_service.py`, `workspace_service.py`
  - [ ] 41 tests OK
- Critères d'acceptation :
  - [ ] Les deux fonctions résident dans `project_service.py`
  - [ ] Aucun import depuis `workspace_service` vers ces fonctions dans les services tiers
  - [ ] 41 tests OK
- Validation :
  - [ ] `python -m pytest -v` → 41 passed
- Dépendances : 2.2 (models refactor) devrait être fait en premier pour limiter les conflits
- Notes :

---

### 2.4 — Supprimer `pydantic_compat.py`

- Statut : `todo`
- Priorité : P1
- Fichiers cibles :
  - `backend/core/pydantic_compat.py`
  - `backend/routes/projects.py`
  - `backend/core/project_service.py`
  - tout autre consommateur
- Tâches :
  - [ ] Lister tous les `from backend.core.pydantic_compat import model_dump`
  - [ ] Remplacer chaque usage par `.model_dump()` appelé sur l'instance Pydantic v2
  - [ ] Supprimer `backend/core/pydantic_compat.py`
  - [ ] Corriger le double import dans `projects.py` (module level + body de fonction)
  - [ ] 41 tests OK
- Critères d'acceptation :
  - [ ] `pydantic_compat.py` absent
  - [ ] `grep -r pydantic_compat backend/` → 0 résultat
  - [ ] 41 tests OK
- Validation :
  - [ ] `python -m pytest -v` → 41 passed
- Notes :

---

### 2.5 — Renommer `routes/index_graph.py` → `routes/graph.py`

- Statut : `todo`
- Priorité : P2
- Fichiers cibles :
  - `backend/routes/index_graph.py` → `backend/routes/graph.py`
  - `backend/app/main.py`
- Tâches :
  - [ ] `git mv backend/routes/index_graph.py backend/routes/graph.py`
  - [ ] Mettre à jour l'import dans `main.py` : `from backend.routes.graph import router as graph_router`
  - [ ] 41 tests OK
- Critères d'acceptation :
  - [ ] `routes/index_graph.py` n'existe plus
  - [ ] 41 tests OK
- Validation :
  - [ ] `python -m pytest -v` → 41 passed
- Notes :

---

## Lot 3 — Harmonisation frontend

- Statut global : `todo`
- Objectif : clarifier la structure `src/`, isoler les responsabilités dans `api/`, extraire les hooks et utils.

### 3.1 — Créer `frontend/src/hooks/` et extraire les hooks partagés

- Statut : `todo`
- Priorité : P1
- Fichiers cibles :
  - `frontend/src/hooks/` (nouveau)
  - `frontend/src/hooks/useProjectConfig.ts` (extrait de `ProjectConfigView.tsx`)
  - `frontend/src/hooks/useAsset.ts` (extrait de `AssetSidePanel.tsx`)
- Tâches :
  - [ ] Créer `frontend/src/hooks/`
  - [ ] Extraire la logique de chargement/sauvegarde de config projet dans `useProjectConfig`
  - [ ] Extraire la logique de fetch asset par clé dans `useAsset`
  - [ ] Mettre à jour `ProjectConfigView.tsx` et `AssetSidePanel.tsx` pour consommer ces hooks
  - [ ] `npm run build` → OK
- Critères d'acceptation :
  - [ ] Les deux hooks sont dans `hooks/`, les vues/composants les consomment
  - [ ] `npm run build` → OK
- Validation :
  - [ ] `npm run build` → OK
- Notes :

---

### 3.2 — Créer `frontend/src/utils/` et y déplacer les helpers purs

- Statut : `todo`
- Priorité : P1
- Fichiers cibles :
  - `frontend/src/utils/` (nouveau)
  - `frontend/src/utils/clone.ts` ou `utils/index.ts`
- Tâches :
  - [ ] Créer `frontend/src/utils/`
  - [ ] Y extraire `clone<T>()` de `ProjectConfigView.tsx`
  - [ ] Rechercher d'autres helpers purs inline dans les vues (ex: formatters, transformers)
  - [ ] Mettre à jour les imports dans les consommateurs
  - [ ] `npm run build` → OK
- Critères d'acceptation :
  - [ ] `utils/` contient au moins `clone<T>()`, consommé depuis son emplacement original
  - [ ] `npm run build` → OK
- Validation :
  - [ ] `npm run build` → OK
- Notes :

---

### 3.3 — Isoler les internals HTTP dans `api/`

- Statut : `todo`
- Priorité : P1
- Fichiers cibles :
  - `frontend/src/api/http.ts` (à scinder)
  - `frontend/src/api/client.ts` (nouveau — primitives transport)
  - `frontend/src/api/workspaceSession.ts` (nouveau — HasApiError + setApiWorkspaceId)
  - `frontend/src/api/index.ts` (barrel à restreindre)
- Tâches :
  - [ ] Créer `client.ts` avec `httpFetch` et `httpJson` uniquement
  - [ ] Créer `workspaceSession.ts` avec `HasApiError`, `setApiWorkspaceId`, `buildHeaders`
  - [ ] Mettre à jour `hasApi.ts` pour importer depuis les nouveaux modules
  - [ ] Mettre à jour `index.ts` : supprimer `httpFetch` et `httpJson` du barrel
  - [ ] Supprimer `http.ts`
  - [ ] `npm run build` → OK
- Critères d'acceptation :
  - [ ] `http.ts` supprimé
  - [ ] `httpFetch` et `httpJson` non accessibles depuis `import { ... } from '../api'`
  - [ ] `npm run build` → OK
- Validation :
  - [ ] `npm run build` → OK
  - [ ] `grep -r "from '../api'" frontend/src/views` → aucun import de `httpFetch`/`httpJson`
- Notes :

---

### 3.4 — Documenter la stratégie `types.ts` vs `generated.ts`

- Statut : `todo`
- Priorité : P2
- Fichiers cibles :
  - `frontend/src/api/types.ts`
  - `frontend/README.md`
- Tâches :
  - [ ] Décider : A (migrer vers generated.ts) ou B (garder types.ts, generated en référence)
  - [ ] Documenter la décision dans `frontend/README.md`
  - [ ] Si A : générer `generated.ts`, migrer les imports, supprimer `types.ts`
  - [ ] `npm run build` → OK
- Critères d'acceptation :
  - [ ] Stratégie documentée dans `frontend/README.md`
  - [ ] Si A : `types.ts` supprimé
  - [ ] `npm run build` → OK
- Validation :
  - [ ] `npm run build` → OK
- Notes :

---

### 3.5 — Déplacer `InteractionTreeEditor` et `ProjectGraphEditor` dans `components/editor/`

- Statut : `todo`
- Priorité : P2
- Fichiers cibles :
  - `frontend/src/views/project/InteractionTreeEditor.tsx` → `frontend/src/components/editor/InteractionTreeEditor.tsx`
  - `frontend/src/views/project/ProjectGraphEditor.tsx` → `frontend/src/components/editor/ProjectGraphEditor.tsx`
  - `frontend/src/views/project/ProjectGraphInteractionsView.tsx` (consommateur)
  - `frontend/src/views/project/ProjectGraphItemsView.tsx` (consommateur)
- Tâches :
  - [ ] `git mv` les deux fichiers vers `components/editor/`
  - [ ] Mettre à jour les imports dans tous les consommateurs
  - [ ] `npm run build` → OK
- Critères d'acceptation :
  - [ ] Les deux fichiers sont dans `components/editor/`
  - [ ] `views/project/` ne contient plus ces fichiers
  - [ ] `npm run build` → OK
- Validation :
  - [ ] `npm run build` → OK
- Notes :
