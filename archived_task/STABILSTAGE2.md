# STABILSTAGE2 — Plan de stabilisation qualité & architecture

Issu de l'audit du 2026-03-14. Objectif : corriger les problèmes de sécurité, renforcer la robustesse du backend, améliorer la qualité du frontend et compléter la couverture de tests.

Les lots sont ordonnés par criticité : sécurité d'abord, architecture ensuite, qualité en dernier.

---

## Lot 1 — Corrections de sécurité critiques

Objectif : éliminer les bugs de spec CORS, les `assert` dangereux en prod et la fuite de ressources ZipFile.

### 1.1 — CORS : supprimer la combinaison interdite `allow_origins="*"` + `allow_credentials=True`

**Fichier concerné :** `backend/app/main.py`

**Problème :**
La combinaison `allow_origins=["*"]` + `allow_credentials=True` est rejetée par les navigateurs modernes (spec CORS §3.2). Elle ne fonctionne pas tel quel et pourrait créer des comportements imprévisibles si des cookies étaient ajoutés plus tard.

**Ce qu'il faut changer :**
- Remplacer `allow_origins=["*"]` par une liste explicite des origines dev : `["http://127.0.0.1:5173", "http://localhost:5173"]`.
- Passer `allow_credentials=False` (aucun cookie n'est utilisé aujourd'hui).
- Conserver `allow_methods=["*"]` et `allow_headers=["*"]` : acceptables sans credentials.
- Ajouter une note de commentaire indiquant que pour un déploiement multi-machine, l'origine doit être passée par variable d'env.

**Option retenue :**
Origines restreintes à 127.0.0.1 et localhost, pas de credentials. Extensible via env var `HAS_ALLOWED_ORIGINS` si besoin.

**Critère d'acceptation :**
- Le frontend en mode dev peut toujours joindre le backend.
- La combinaison interdite n'est plus présente dans le code.
- `pytest` ou test manuel via curl confirme que l'entête `Access-Control-Allow-Origin` est correct.

---

### 1.2 — Remplacer les `assert` de production par des guards explicites

**Fichier concerné :** `backend/core/vfs.py` (plusieurs occurrences dans `read_text`, `read_bytes`, `list_files`)

**Problème :**
`assert self._zip is not None` est une assertion Python. En mode optimisé (`python -O`) les assertions sont désactivées et le code crash sur `AttributeError: 'NoneType'` sans message utile. C'est un anti-pattern pour du code de production.

**Ce qu'il faut changer :**
- Remplacer chaque `assert self._zip is not None` par un guard :
  ```python
  if self._zip is None:
      raise http_error(500, "VFS_ERROR", "Zip handle not initialized", {"mount": self.mount_id})
  ```
- Passer en revue tout `vfs.py` pour d'autres `assert` éventuels.

**Critère d'acceptation :**
- Aucun `assert` restant dans `vfs.py`.
- Le message d'erreur retourné au frontend est structuré et exploitable.

---

### 1.3 — Retirer `frozen=True` sur `Mount` et utilisation de `object.__setattr__`

**Fichier concerné :** `backend/core/vfs.py`

**Problème :**
`Mount` est déclaré `@dataclass(frozen=True)` mais est muté via `object.__setattr__` dans `_ensure_zip()`. C'est un contrat brisé : les outils de type-checking (mypy, pyright) considèrent le type immuable alors qu'il est muté. Cela masque la vraie intention et peut causer des bugs subtils si le dataclass est sérialisé ou comparé.

**Ce qu'il faut changer :**
- Retirer `frozen=True` du décorateur.
- Définir `__hash__` manuellement sur les champs stables (`mount_id`) pour maintenir la hashabilité si des `Mount` sont utilisés dans des sets/dict-keys :
  ```python
  def __hash__(self) -> int:
      return hash(self.mount_id)
  def __eq__(self, other: object) -> bool:
      if not isinstance(other, Mount):
          return NotImplemented
      return self.mount_id == other.mount_id
  ```
- Remplacer les `object.__setattr__` par des assignations directes.

**Critère d'acceptation :**
- Aucun `object.__setattr__` dans `vfs.py`.
- `frozen=True` retiré.
- Les tests existants passent sans modification.

---

### 1.4 — Fermer proprement le ZipFile (fuite de file descriptors)

**Fichier concerné :** `backend/core/vfs.py`

**Problème :**
Le `zipfile.ZipFile` ouvert dans `_ensure_zip()` n'est jamais fermé. Sur un serveur long-running avec plusieurs packs ZIP chargés, les file descriptors s'accumulent. Le GC peut finir par les fermer mais ce n'est pas garanti (CPython uniquement, et pas en temps voulu).

**Analyse du design :**
Le ZIP est caché sur l'instance `Mount` pour éviter de le réouvrir à chaque lecture. Il faut conserver ce cache tout en gérant proprement la fermeture.

**Ce qu'il faut faire :**
- Ajouter une méthode `close()` sur `Mount` qui ferme `self._zip` si ouvert et le met à `None`.
- Ajouter un `__del__` minimal qui appelle `close()` pour le cas GC.
- Dans `build_mounts` (ou à l'endroit où les mounts sont construits et utilisés), passer à un pattern context-manager si le cycle de vie des Mounts est borné ; sinon documenter explicitement que `close()` doit être appelé en fin de session.
- Alternative si le cycle de vie ne peut pas être facilement borné : ouvrir/fermer le ZipFile à chaque accès en recachant seulement la liste des noms (qui est déjà cachée dans `_MOUNT_FILE_LIST_CACHE`). C'est légèrement moins performant mais élimine la fuite.

**Option retenue :**
Ajouter `close()` + `__del__` sur `Mount`. Le cache de listing des noms reste dans `_MOUNT_FILE_LIST_CACHE` (déjà existant), et `_zip` n'est qu'un handle d'accès aux bytes — il peut être ré-ouvert si nécessaire.

**Critère d'acceptation :**
- Aucun `ZipFile` ne reste ouvert indéfiniment après l'arrêt d'une session de travail.
- Les lectures sur un ZIP fonctionnent toujours après un `close()` + réouverture implicite.

---

## Lot 2 — Robustesse concurrence et état serveur

Objectif : documenter et mitiger les risques liés aux caches globaux mutabless, au cycle de vie du workspace en mémoire et aux settings non-cached.

### 2.1 — Protéger les caches globaux contre les accès concurrents

**Fichiers concernés :** `backend/core/vfs.py`, `backend/core/state.py`

**Problème :**
`_MOUNT_FILE_LIST_CACHE`, `PROJECT_INDEX`, `PROJECT_INDEX_FINGERPRINT`, `WORKSPACE_ROOT_BY_ID` sont des dicts globaux modifiés sans protection. FastAPI avec Starlette peut exécuter des handlers concurrents (async). Avec `--workers N > 1`, les caches sont totalement incohérents entre processes.

**Ce qu'il faut faire :**
- Ajouter un `threading.Lock` (non-async, adapté pour les accès depuis des threads pool) pour chaque dict global modifié en écriture :
  - `_MOUNT_FILE_LIST_CACHE` dans `vfs.py`
  - `PROJECT_INDEX` + `PROJECT_INDEX_FINGERPRINT` dans `state.py` (via les fonctions dans `index_service.py`)
  - `WORKSPACE_ROOT_BY_ID` dans `state.py`
- Les lectures sans write concurrent restent non-lockées pour les perfs.
- Ajouter un commentaire clair : « multi-process (uvicorn --workers N) non supporté, single-process uniquement ».

**Critère d'acceptation :**
- Les écritures et lectures sur les caches globaux sont lockées.
- Le commentaire de limitation multi-process est présent et lisible.

---

### 2.2 — Gérer explicitement la perte du `workspaceId` après redémarrage serveur

**Fichiers concernés :** `backend/core/workspace_service.py`, `backend/core/state.py`

**Problème :**
`WORKSPACE_ROOT_BY_ID` est in-memory. Après un hot-reload uvicorn ou un redémarrage, le dict est vide. Le frontend renvoie un `X-HAS-Workspace-Id` qui n'existe plus — `resolve_workspace_root` tombe silencieusement sur la valeur par défaut des settings sans logguer un warning visible.

**Ce qu'il faut faire :**
- Dans `resolve_workspace_root`, si le `workspaceId` est fourni mais absent du registre, lever un `http_error(404, "WORKSPACE_NOT_FOUND", "Workspace session expired or server restarted, please re-open workspace", {...})` au lieu de silencieusement retomber sur le défaut.
- En conséquence, côté frontend, intercepter ce code d'erreur spécifique dans `http.ts` et afficher un message « Session expirée, veuillez rouvrir le workspace » plutôt qu'une erreur générique.

**Critère d'acceptation :**
- Après redémarrage du serveur, la première requête avec un `workspaceId` périmé retourne une erreur `404` avec le code `WORKSPACE_NOT_FOUND`.
- Le frontend affiche un message compréhensible invitant à rouvrir le workspace.

---

### 2.3 — Mettre `get_settings()` en cache avec `lru_cache`

**Fichier concerné :** `backend/core/config.py`

**Problème :**
`get_settings()` recalcule `os.getenv(...)` et instancie un `Settings` à chaque requête. Le pattern recommandé avec FastAPI/Depends est `@lru_cache` ou une instance singleton.

**Ce qu'il faut changer :**
```python
from functools import lru_cache

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    ...
```
Note : avec `lru_cache`, les tests qui modifient des variables d'env doivent appeler `get_settings.cache_clear()` au setUp/tearDown.

**Critère d'acceptation :**
- `get_settings()` n'exécute `os.getenv` qu'une fois par processus.
- Les tests existants ne sont pas cassés.

---

### 2.4 — Éviter le double appel de `build_mounts()` dans `write_server_json_copy`

**Fichier concerné :** `backend/core/asset_service.py`

**Problème :**
Dans `write_server_json_copy`, `build_mounts` est appelé une première fois implicitement dans `ensure_index` (via `resolve_server_json`), puis une deuxième fois explicitement dans le corps de la fonction. C'est redondant et peut causer une incohérence si les mounts changent entre les deux appels.

**Ce qu'il faut faire :**
- Refactorer `resolve_server_json` et `write_server_json_copy` pour que l'index et les mounts construits une fois soient passés en paramètre aux fonctions internes qui en ont besoin.
- Même chose pour `write_server_json_override` si applicable.

**Critère d'acceptation :**
- `build_mounts` n'est appelé qu'une fois par flow de write.
- Le résultat fonctionnel est identique (tests existants passent).

---

## Lot 3 — Architecture backend : découpage et configuration

Objectif : réduire la dette de `workspace_service.py` et éliminer les valeurs hardcodées de dev du code.

### 3.1 — Découper `workspace_service.py` en modules focalisés

**Fichier concerné :** `backend/core/workspace_service.py`

**Problème :**
Le fichier regroupe : lifecycle du workspace (`open_workspace`, `resolve_workspace_root`), listing des projets (`list_projects`), création de projet (`create_project`), import de pack (`import_pack`), et tous leurs helpers privés. C'est un God-module difficile à naviguer et à tester isolément.

**Découpage proposé :**
- `workspace_service.py` → garde uniquement : `open_workspace`, `list_projects`, `resolve_workspace_root` + helpers workspace purs (`_workspace_id_for_root`, `_workspace_config_path`, `_project_config_path`).
- `project_create_service.py` (nouveau) → `create_project` + helpers de création (`_default_project_manifest`, `_slugify`, etc.).
- `import_service.py` (nouveau) → `import_pack` + helpers d'import (`_normalize_import_manifest`, etc.).

Les routes existantes importent depuis les nouveaux modules sans changer leur interface publique.

**Critère d'acceptation :**
- `workspace_service.py` fait moins de 150 lignes.
- Chaque nouveau module est lisible indépendamment.
- Tous les tests existants passent, les imports de routes sont mis à jour.

---

### 3.2 — Supprimer les chemins de dev hardcodés des defaults

**Fichiers concernés :** `backend/core/config.py`, `frontend/src/App.tsx`

**Problème côté backend :**
```python
default_vanilla_path = os.getenv("HAS_VANILLA_PATH", r"K:\projet\java\TestPluginHytale\Assets")
```
Si quelqu'un clone le repo sans configurer l'env var, le backend démarre avec un chemin inexistant spécifique à la machine de dev, sans message clair.

**Problème côté frontend :**
```typescript
const [workspaceRoot, setWorkspaceRoot] = useState('K:/hytale-asset-studio-workspace')
```
Idem : valeur hardcodée spécifique à une machine.

**Ce qu'il faut faire :**
- Backend : passer la valeur par défaut à `""` pour `HAS_VANILLA_PATH` et `HAS_WORKSPACE_ROOT`. Ajouter une validation dans `open_workspace` / `mount_from_source` qui retourne une erreur claire si le chemin est vide.
- Frontend : lire depuis `import.meta.env.VITE_DEFAULT_WORKSPACE_ROOT` avec fallback `""`. Documenter dans `frontend/.env.example` (fichier à créer) les variables attendues.

**Critère d'acceptation :**
- Aucun chemin absolu spécifique à une machine dans le code source.
- Démarrer sans configuration retourne une erreur intelligible plutôt qu'un crash silencieux.
- Un fichier `.env.example` documente les variables disponibles.

---

## Lot 4 — Frontend : qualité et performance

Objectif : réduire le bundle initial, fiabiliser les types API et nettoyer les patterns problématiques.

### 4.1 — Ajouter `.tmp/` au `.gitignore`

**Fichier concerné :** `.gitignore` (racine)

**Problème :**
Le script `test:interaction-contract` génère `.tmp/interaction-contract/` (JS compilé). Ce dossier n'est pas dans `.gitignore` et pourrait être commité par accident.

**Ce qu'il faut faire :**
- Ajouter `.tmp/` dans le `.gitignore` racine.

**Critère d'acceptation :**
- `git status` ne liste plus `.tmp/` comme untracked après un `npm run test:interaction-contract`.

---

### 4.2 — Codegen TypeScript depuis OpenAPI

**Fichiers concernés :** `frontend/package.json`, `frontend/src/api/types.ts`

**Problème :**
Les types TypeScript dans `types.ts` sont écrits à la main et peuvent silencieusement diverger du schéma backend FastAPI. La désynchro est détectée trop tard (runtime).

**Ce qu'il faut faire :**
- Ajouter `openapi-typescript` en devDependency.
- Ajouter un script `npm run codegen` qui appelle :
  ```
  openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/generated.ts
  ```
- Les types manuels dans `types.ts` restent comme override/extensions pour les cas non-capturés par le schéma généré, mais les types primaires migrés vers `generated.ts`.
- Documenter dans le README frontend que `codegen` doit être relancé après un changement de contrat backend.

**Critère d'acceptation :**
- `npm run codegen` génère `generated.ts` sans erreur avec le backend en cours.
- Au moins les types de réponse des routes principales (`WorkspaceOpenResponse`, `ProjectConfig`, `AssetGetResponse`) proviennent du fichier généré.

---

### 4.3 — Lazy loading de Monaco Editor

**Fichiers concernés :** composants qui importent `@monaco-editor/react` (probablement `InteractionFormPanel.tsx`)

**Problème :**
Monaco Editor pèse ~5 MB. Il est chargé à chaque démarrage de l'app alors qu'il n'est utilisé que dans l'onglet "Raw JSON". Cela alourdit le bundle initial et ralentit le premier rendu.

**Ce qu'il faut faire :**
- Identifier tous les imports directs de `@monaco-editor/react`.
- Les remplacer par un lazy import :
  ```tsx
  const MonacoEditor = React.lazy(() => import('@monaco-editor/react'))
  ```
- Envelopper chaque usage dans un `<Suspense fallback={<div>Loading editor…</div>}>`.

**Critère d'acceptation :**
- Le bundle initial (chunk principal) ne contient plus Monaco.
- L'onglet "Raw JSON" charge Monaco la première fois qu'il est ouvert.
- `npm run build` passe sans erreur.

---

### 4.4 — Déplacer `activeWorkspaceId` de la variable de module vers `sessionStorage`

**Fichier concerné :** `frontend/src/api/http.ts`

**Problème :**
```typescript
let activeWorkspaceId: string | null = null
```
Cet état est perdu au rafraîchissement de la page. L'utilisateur doit rouvrir le workspace manuellement. Pour un outil de développement utilisé en continu, c'est une friction récurrente.

**Ce qu'il faut faire :**
- Remplacer la variable de module par un accès à `sessionStorage` :
  ```typescript
  const WS_ID_KEY = 'has_workspace_id'
  export function setApiWorkspaceId(id: string | null): void {
    if (id) sessionStorage.setItem(WS_ID_KEY, id)
    else sessionStorage.removeItem(WS_ID_KEY)
  }
  function getApiWorkspaceId(): string | null {
    return sessionStorage.getItem(WS_ID_KEY)
  }
  ```
- Remplacer les usages de `activeWorkspaceId` par `getApiWorkspaceId()`.
- Note : le point 2.2 (WORKSPACE_NOT_FOUND) traite le cas où le server a redémarré — le frontend affichera un message clair plutôt que de crasher silencieusement.

**Critère d'acceptation :**
- Après F5, le `workspaceId` est restauré automatiquement depuis `sessionStorage`.
- Si le serveur a redémarré entre-temps, l'erreur `WORKSPACE_NOT_FOUND` est affichée proprement (point 2.2 prérequis).

---

### 4.5 — Limiter le Dagre layout pour les grands graphes

**Fichiers concernés :** `frontend/src/components/graph/layoutDagre.ts`, vues graphe

**Problème :**
Le calcul Dagre est synchrone dans le thread principal. Pour des graphes larges (>150 nœuds), l'UI se gèle plusieurs secondes. C'est particulièrement visible sur des interactions complexes avec beaucoup de paliers.

**Ce qu'il faut faire :**
- Ajouter une constante `MAX_DAGRE_NODES = 200` (valeur à ajuster selon les tests).
- Si le graphe dépasse ce seuil, afficher un message dans l'UI : « Graphe trop dense, augmenter `depth` n'est pas recommandé (>200 nœuds). Filtre ou zoom recommandé. » et tronquer à 200.
- Alternative plus coûteuse à implémenter plus tard : Web Worker. La consigner comme amélioration future dans ce fichier (commentaire TODO).

**Critère d'acceptation :**
- Un graphe >200 nœuds n'est pas rendu dans son intégralité sans confirmation.
- L'UI ne se gèle plus sur des assets très ramifiés.
- La constante est documentée et modulable.

---

### 4.6 — Extraire les styles inline de `InteractionFormPanel.tsx` vers des tokens CSS

**Fichier concerné :** `frontend/src/components/editor/InteractionFormPanel.tsx`

**Problème :**
Le composant définit des dizaines de `React.CSSProperties` en tête de fichier (`LABEL_STYLE`, `INPUT_STYLE`, `TEXTAREA_STYLE`, `FIELD_WRAP`, etc.). Ça fonctionne mais rend le theming difficile, alourdit le composant et se duplique probablement avec d'autres composants.

**Ce qu'il faut faire :**
- Créer un fichier `frontend/src/components/editor/formStyles.ts` qui exporte les objets de style partagés.
- Importer et réutiliser dans `InteractionFormPanel.tsx` et `interactionFormTypeSections.tsx`.
- Ne pas tout refactoriser en CSS modules dans ce lot — juste centraliser les constantes dupliquées.

**Critère d'acceptation :**
- Les constantes de style ne sont définies qu'une seule fois.
- `InteractionFormPanel.tsx` perd au moins 30 lignes de définitions de style inline.
- `npm run build` passe.

---

### 4.7 — Réduire le props drilling dans `App.tsx` avec un Context

**Fichier concerné :** `frontend/src/App.tsx` et vues filles

**Problème :**
`App.tsx` maintient ~8 états (`workspace`, `projects`, `selectedProjectId`, `projectView`, `itemRoot`, `interactionRoot`, etc.) passés par props sur plusieurs niveaux. Ajouter un nouvel état ou une nouvelle vue nécessite de modifier `App.tsx` et tous les intermédiaires.

**Ce qu'il faut faire :**
- Créer un `WorkspaceContext` (fichier `frontend/src/context/WorkspaceContext.tsx`) qui expose : `workspace`, `projects`, `selectedProjectId`, les setters, et les actions (`openWorkspace`, `selectProject`, `refreshAndSelect`).
- Remplacer les props correspondantes dans les vues qui n'en ont besoin que pour les transmettre.
- Garder les props pour les composants feuilles qui ont besoin d'une valeur spécifique — ne pas tout mettre dans le contexte.

**Critère d'acceptation :**
- `App.tsx` fait moins de 100 lignes de JSX.
- L'ajout d'une nouvelle vue ne nécessite plus de modifier la signature de props de tous les composants intermédiaires.
- `npm run build` passe.

---

## Lot 5 — Tests et couverture

Objectif : migrer vers pytest, ajouter des tests de routes HTTP et corriger le `.gitignore`.

### 5.1 — Migrer les tests backend de `unittest` vers `pytest`

**Fichiers concernés :** `backend/tests/*.py`, `backend/requirements.txt`

**Problème :**
Les tests actuels utilisent `unittest.TestCase`. `pytest` est plus ergonomique, offre `tmp_path` (fixture native), des assertions plus lisibles, une meilleure intégration avec FastAPI `TestClient` et des plugins utiles (`pytest-cov`, etc.).

**Ce qu'il faut faire :**
- Ajouter `pytest` et `pytest-cov` dans `requirements.txt` (ou un `requirements-dev.txt` séparé si préféré).
- Convertir les classes `unittest.TestCase` en fonctions `pytest` ou en classes sans héritage, en remplaçant `self.setUp`/`tearDown` par des fixtures.
- Remplacer `tempfile.TemporaryDirectory()` par la fixture `tmp_path`.
- Remplacer `self.assertEqual`, `self.assertRaises`, etc. par des `assert` directs.

**Critère d'acceptation :**
- `pytest backend/tests/` passe sans erreur.
- La couverture de code est > 70% (à mesurer via `pytest --cov=backend`).

---

### 5.2 — Ajouter des tests de routes HTTP avec `TestClient`

**Fichiers concernés :** nouveau fichier `backend/tests/test_routes.py`

**Problème :**
Aujourd'hui les tests couvrent les services mais pas les routes FastAPI. Des bugs dans la couche route (validation de body, gestion des Headers `X-HAS-Workspace-Id`, codes de retour HTTP) ne sont pas détectés.

**Ce qu'il faut faire :**
- Créer `backend/tests/test_routes.py` avec une fixture `client` basée sur `TestClient(app)`.
- Couvrir a minima :
  - `GET /api/v1/health` → 200
  - `POST /api/v1/workspace/open` → 200 avec rootPath valide, 422 avec body manquant
  - `GET /api/v1/workspace/{workspaceId}/projects` → 404 si workspaceId inconnu (après point 2.2)
  - `GET /api/v1/projects/{projectId}/asset?key=server:X` → comportements attendus selon état du projet

**Critère d'acceptation :**
- `pytest backend/tests/test_routes.py` passe.
- Les codes HTTP retournés correspondent aux specs de `API_BACKEND_MINIMAL.md`.

---

## Ordre d'exécution recommandé

| Lot | Priorité | Effort estimé | Dépendances |
|---|---|---|---|
| Lot 1 (sécurité) | P0 | Faible (corrections ciblées) | — |
| Lot 2.3 (`lru_cache`) | P0 | Très faible | — |
| Lot 2.1 (locks) | P1 | Faible | — |
| Lot 2.2 (workspace expired) | P1 | Faible | — |
| Lot 2.4 (build_mounts double) | P1 | Faible | — |
| Lot 3.2 (chemins hardcodés) | P1 | Faible | — |
| Lot 4.1 (.gitignore) | P0 | Trivial | — |
| Lot 4.3 (lazy Monaco) | P1 | Faible | — |
| Lot 4.4 (sessionStorage WS ID) | P1 | Faible | Lot 2.2 |
| Lot 3.1 (découper workspace_service) | P2 | Moyen | — |
| Lot 4.2 (codegen OpenAPI) | P2 | Moyen | — |
| Lot 4.5 (Dagre max nodes) | P2 | Faible | — |
| Lot 4.6 (formStyles) | P2 | Faible | — |
| Lot 5.1 (pytest migration) | P2 | Moyen | — |
| Lot 4.7 (WorkspaceContext) | P3 | Moyen | — |
| Lot 5.2 (test routes HTTP) | P3 | Moyen | Lot 5.1 |

---

## Clôture — 2026-03-14

Tous les lots ont été implémentés et vérifiés.

- **41/41 tests** passent (`python -m pytest -v`)
- **Build frontend** : OK (`npm run build` — 528 modules, 0 erreur)
- Chantier archivé dans `archived_task/`
