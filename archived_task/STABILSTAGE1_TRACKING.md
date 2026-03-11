# STABILSTAGE1 - Suivi d'execution

Document de pilotage pour executer le plan defini dans [STABILSTAGE1.md](STABILSTAGE1.md).

## Mode d'emploi

- Cocher une tache quand elle est terminee.
- Passer le statut d'un lot de `todo` a `in-progress` puis `done`.
- Noter la preuve de validation apres chaque changement significatif.
- Garder ce fichier factuel: statut, decision, verification, reste a faire.

## Legende

- `todo`: non commence
- `in-progress`: en cours
- `blocked`: bloque par une decision ou une dependance
- `done`: termine et verifie

## Tableau de bord

### Lot 1 - Securiser les invariants critiques

- Statut global: `done`
- Objectif: garantir qu'un utilisateur travaille sur le bon workspace, que les creations n'ecrasent rien, et que les exports restent propres.

#### 1. Workspace selectionne reellement respecte

- Statut: `done`
- Priorite: P0
- Fichiers cibles:
  - backend/routes/workspace.py
  - backend/routes/projects.py
  - backend/core/workspace_service.py
- Taches:
  - [x] Definir la source de verite `workspaceId -> rootPath`
  - [x] Faire utiliser ce mapping par `workspace_list_projects`
  - [x] Faire utiliser ce mapping par `project_create`
  - [x] Faire utiliser ce mapping par `project_import_pack`
  - [x] Refuser un `workspaceId` inconnu avec une erreur explicite
  - [ ] Verifier le comportement si deux workspaces differents sont ouverts successivement
- Criteres d'acceptation:
  - [x] La liste de projets correspond au workspace ouvert
  - [x] La creation se fait dans le bon workspace
  - [x] L'import de pack se fait dans le bon workspace
  - [x] Un `workspaceId` invalide ne retombe pas silencieusement sur le workspace par defaut
- Validation:
  - [x] Test manuel multi-workspace
  - [ ] Test automatise backend si ajoute
  - [x] Validation statique backend/frontend
- Notes:
  - Backend: registre memoire `workspaceId -> rootPath` + resolution via header `X-HAS-Workspace-Id` pour les routes projet.
  - Frontend: le contexte workspace est maintenant propage automatiquement par la couche API apres `workspaceOpen`.
  - Validation utilisateur: test manuel effectue, comportement juge correct.

#### 2. Creation de projet atomique

- Statut: `done`
- Priorite: P0
- Fichiers cibles:
  - backend/core/workspace_service.py
- Taches:
  - [x] Verifier l'existence du projet avant toute ecriture disque
  - [x] Valider le manifest avant creation des dossiers/fichiers
  - [x] Ecrire `Common`, `Server`, `manifest.json` et `has.project.json` seulement apres validation complete
  - [x] Eviter tout ecrasement d'un projet deja existant
  - [x] Ajouter ou prevoir un rollback minimal si une ecriture intermediaire echoue
- Criteres d'acceptation:
  - [x] Un projet existant provoque une erreur sans side effect disque
  - [x] Une erreur de creation ne laisse pas de projet partiellement initialise
- Validation:
  - [x] Test backend creation en conflit
  - [x] Test backend creation reussie
  - [x] Test backend rollback sur echec d'ecriture
- Notes:
  - `create_project` refuse maintenant un targetDir deja occupe par des fichiers/reserves du projet.
  - En cas d'echec d'ecriture apres creation partielle, les fichiers et dossiers crees par la tentative sont nettoyes.

#### 3. Export ZIP propre et whitelist

- Statut: `done`
- Priorite: P0
- Fichiers cibles:
  - backend/core/export_service.py
- Taches:
  - [x] Remplacer la logique blacklist par une logique whitelist
  - [x] Autoriser uniquement `Common/`, `Server/`, `manifest.json` et les eventuels fichiers explicitement voulus
  - [x] Exclure `.studio_cache`
  - [x] Exclure toute metadata interne studio
  - [x] Verifier les chemins archives produits
- Criteres d'acceptation:
  - [x] Le ZIP n'embarque aucun fichier interne studio
  - [x] Le ZIP reste compatible avec le format attendu par Hytale
- Validation:
  - [x] Test backend export sans manifest valide
  - [x] Test backend export avec whitelist
  - [x] Verification du contenu du ZIP via tests unitaires
- Notes:
  - L'export ne prend plus "tout le dossier projet" ; il retient seulement `manifest.json`, `Common/**` et `Server/**`.
  - Les fichiers de debug, cache ou metadata studio hors whitelist sont ignores a l'export.

### Lot 2 - Fiabiliser les donnees metier

- Statut global: `done`
- Objectif: eviter les incoherences silencieuses sur import, index, IDs et sauvegardes.

#### 4. Preservation du manifest a l'import

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - backend/core/workspace_service.py
- Taches:
  - [x] Reutiliser les champs connus du manifest importe
  - [x] Definir le comportement exact si le manifest est invalide
  - [x] Remonter une erreur ou un warning explicite au lieu d'une degradation silencieuse
  - [x] Eviter la perte des champs standards utiles
- Criteres d'acceptation:
  - [x] Un import suivi d'un export preserve les champs importants du manifest
  - [x] Un manifest invalide produit un retour comprensible
- Validation:
  - [x] Test backend import avec manifest complet
  - [x] Test backend import avec manifest invalide
  - [x] Test backend import sans manifest
- Notes:
  - Si le pack source contient un `manifest.json` valide, les champs connus sont normalises via `ProjectManifest` puis reutilises tels quels.
  - Si le manifest source est invalide, l'import est maintenant refuse explicitement avec `MANIFEST_INVALID`.
  - Si le pack source n'a pas de manifest, on garde le comportement par defaut de creation d'un manifest minimal pour le projet.

#### 5. Strategie de cache d'index plus fiable

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - backend/core/index_service.py
  - backend/core/asset_service.py
  - backend/routes/index_graph.py
- Taches:
  - [x] Invalider le cache lors des ecritures faites par le studio
  - [x] Definir une signature minimale des changements disque utiles
  - [ ] Exposer si necessaire l'origine cache/memory/rebuild dans les reponses de debug
  - [x] Verifier le comportement apres modif disque hors process si ce cas doit etre supporte
- Criteres d'acceptation:
  - [x] Le graph et la search ne restent pas faux apres une ecriture via le studio
  - [x] L'etat recharge est coherent apres save override/copy
- Validation:
  - [x] Test backend save puis reload
  - [x] Test backend invalidation cache
- Notes:
  - Le fingerprint inclut maintenant l'etat des fichiers projet exportables: `manifest.json`, `Common/**`, `Server/**`.
  - Le cache memoire est invalide si le fingerprint courant differe de celui memorise.
  - Le cache disque est aussi ignore si le fingerprint ne correspond plus.
  - L'origine cache/memory/rebuild n'est pas encore exposee aux reponses API; c'est un raffinement optionnel, pas un blocage.

#### 6. Gestion explicite des collisions d'IDs

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - backend/core/index_service.py
  - backend/core/asset_service.py
  - backend/core/graph_service.py
  - backend/routes/index_graph.py
  - frontend/src/api/types.ts
  - frontend/src/views/project/ProjectGraphEditor.tsx
- Taches:
  - [x] Distinguer resolution par ID unique et resolution par chemin effectif
  - [x] Faire apparaitre les assets ambigus dans la recherche
  - [x] Exposer les chemins candidats ou un etat `ambiguous`
  - [x] Garder le 409 seulement pour une demande non desambiguisable
  - [x] Ajouter un comportement UI minimal pour expliquer l'ambiguite
- Criteres d'acceptation:
  - [x] Un asset ambigu apparait en recherche
  - [x] L'utilisateur comprend pourquoi il est ambigu
  - [x] L'utilisateur peut choisir ou desambiguise explicitement
- Validation:
  - [x] Test backend collision d'IDs
  - [x] Build frontend avec UI ambiguity
- Notes:
  - La recherche retourne maintenant une entree par chemin candidat pour les IDs ambigus, avec `server-path:*`.
  - `assetGet` et `projectGraph` acceptent desormais `server-path:*` pour permettre une selection explicite par chemin.
  - L'UI de recherche affiche le chemin et un badge `AMBIG` pour les candidats ambigus.
  - Limite restante: les references internes ambiguës rencontrees pendant la traversée du graphe ne sont pas encore developpees en plusieurs branches automatiquement.

#### 7. Save as securise

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - backend/core/asset_service.py
  - backend/routes/assets.py
- Taches:
  - [x] Refuser un `newId` deja existant dans le projet
  - [x] Refuser un chemin cible deja present sauf mode explicite d'ecrasement
  - [x] Verifier la collision potentielle avec l'index effectif si necessaire
  - [x] Renvoyer une erreur claire cote API
- Criteres d'acceptation:
  - [x] Save as ne peut pas ecraser silencieusement un asset existant
- Validation:
  - [x] Test backend save as en collision
  - [x] Test backend save as reussi
- Notes:
  - Le backend refuse maintenant un `newId` deja present dans la VFS effective avec `ID_CONFLICT`.
  - Le chemin cible derive est aussi refuse s'il existe deja dans l'index effectif ou sur disque.

### Lot 3 - Rendre l'outil plus robuste au quotidien

- Statut global: `done`
- Objectif: ameliorer DX, UX d'erreur et maintenabilite.

#### 8. Arreter de masquer les erreurs utiles

- Statut: `done`
- Priorite: P2
- Fichiers cibles:
  - backend/core/workspace_service.py
  - backend/core/project_service.py
  - frontend/src/App.tsx
  - frontend/src/views/project/ProjectModifiedGraphView.tsx
- Taches:
  - [x] Remplacer les `except Exception: continue` silencieux par logs structures quand pertinent
  - [x] Decider si les projets invalides doivent etre listes avec statut degrade
  - [x] Remplacer les `catch {}` frontend critiques par un pattern visible
  - [x] Ajouter un message utilisateur pour les erreurs de refresh/expand/save
- Criteres d'acceptation:
  - [x] Une erreur utile est visible cote logs ou cote UI
  - [x] Une erreur de refresh/expand n'est plus silencieuse
- Validation:
  - [ ] Verification manuelle UX erreur
  - [x] Verification logs backend
- Notes:
  - `project_service.py` loggue maintenant les configs projet invalides sautees lors de la recherche d'un projet.
  - `App.tsx` ne masque plus les echecs de refresh de la liste projet.
  - `ProjectModifiedGraphView.tsx` remonte maintenant les erreurs de refresh et d'expansion, et permet un retry apres echec d'expansion.
  - `workspace_service.py` renvoie maintenant aussi les projets invalides avec `status=invalid` et `errorMessage`, affiches comme cartes non ouvrables dans `HomePage.tsx`.
  - Revue de code ciblee effectuee: les messages d'erreur sont bien relies a des etats visibles dans `App.tsx`, `HomePage.tsx`, `ProjectModifiedGraphView.tsx` et `AssetSidePanel.tsx`; la verification manuelle restante concerne seulement le ressenti UX en navigation reelle.

#### 9. Normaliser la serialisation Pydantic

- Statut: `done`
- Priorite: P3
- Fichiers cibles:
  - backend/routes/projects.py
  - backend/core/workspace_service.py
- Taches:
  - [x] Remplacer les `.dict()` residuels par le helper commun
  - [x] Verifier qu'un seul chemin de serialisation est utilise
- Criteres d'acceptation:
  - [x] Plus d'appel direct a `.dict()` dans le backend applicatif
- Validation:
  - [x] Recherche globale backend
- Notes:
  - Les appels restants ont ete remplaces par `model_dump(...)` dans `workspace_service.py` et `projects.py`.

#### 10. Reduire les assertions frontend fragiles

- Statut: `done`
- Priorite: P3
- Fichiers cibles:
  - frontend/src/views/project/ProjectGraphEditor.tsx
  - frontend/src/views/project/ProjectModifiedGraphView.tsx
  - frontend/src/components/graph/layoutDagre.ts
- Taches:
  - [x] Introduire un type `GraphNodeData`
  - [x] Ajouter des type guards simples pour les usages critiques
  - [x] Reduire les `as any` sur la navigation et les panneaux lateraux
- Criteres d'acceptation:
  - [x] Les zones critiques n'utilisent plus `as any` par defaut
- Validation:
  - [x] Build frontend
  - [x] Verification TypeScript
- Notes:
  - Ajout d'un module partage `frontend/src/components/graph/blueprintTypes.ts` pour centraliser le typage des noeuds blueprint.
  - Les vues `ProjectGraphEditor` et `ProjectModifiedGraphView` utilisent maintenant `Node<BlueprintNodeData>` au lieu de naviguer en `as any`.
  - `layoutDagre.ts` a ete genericise pour conserver le type des noeuds au layout.

#### 11. Traiter l'avertissement bundle

- Statut: `done`
- Priorite: P4
- Fichiers cibles:
  - frontend/package.json
  - frontend/vite.config.ts
  - frontend/src/App.tsx
- Taches:
  - [x] Identifier les gros contributeurs au bundle, notamment Monaco
  - [x] Evaluer un chargement lazy des vues lourdes
  - [x] Reporter si besoin apres stabilisation P0/P1
- Criteres d'acceptation:
  - [x] Le sujet est soit traite, soit explicitement reporte avec justification
- Validation:
  - [x] Build frontend et comparaison taille bundle
- Notes:
  - Le warning bundle est confirme au build avec `dist/assets/index-DS-rQidk.js` a ~581 kB minifie.
  - `monaco-editor` et `@monaco-editor/react` sont presents dans `frontend/package.json`, et l'editeur est importe directement dans `frontend/src/components/editor/AssetSidePanel.tsx`.
  - Le sujet est explicitement reporte apres stabilisation: optimisation possible plus tard via lazy loading de la vue/panneau editeur ou `manualChunks`, mais non bloquant pour cloturer STABILSTAGE1.

## Tests prioritaires

### Backend

- [x] Tests `create_project`
  - [x] refuse proprement un projet existant
  - [x] n'ecrit rien en cas d'echec
  - [x] cree bien `Common`, `Server`, `manifest.json` et `has.project.json`

- [x] Tests `export`
  - [x] echoue sans manifest valide
  - [x] n'embarque pas `.studio_cache`
  - [x] produit seulement les fichiers attendus

- [x] Tests `import_pack`
  - [x] conserve les champs importants du manifest
  - [x] gere un manifest invalide explicitement

- [x] Tests `index/collisions`
  - [x] detecte une collision d'IDs
  - [x] expose l'ambiguite en recherche
  - [x] renvoie une erreur structuree pour une ouverture ambiguë

- [x] Tests `asset write`
  - [x] override met a jour l'index
  - [x] save as refuse l'ecrasement

## Ordre d'execution retenu

- [x] 1. Workspace reel
- [x] 2. Creation atomique
- [x] 3. Export whitelist
- [x] 4. Save as securise
- [x] 5. Import manifest
- [x] 6. Invalidation cache index
- [x] 7. Collisions d'IDs
- [ ] 8. Erreurs backend/frontend visibles
- [x] 8. Erreurs backend/frontend visibles
- [x] 9. Typage frontend
- [x] 10. Bundle plus tard

## Journal d'execution

### Entree type

- Date:
- Sujet:
- Statut:
- Fichiers touches:
- Verification effectuee:
- Risques restants:

### Historique

- Date: 2026-03-11
  - Sujet: Cloture technique STABILSTAGE1
  - Statut: termine
  - Fichiers touches: backend/tests/test_collision_resolution.py, backend/tests/test_asset_service.py, STABILSTAGE1_TRACKING.md
  - Verification effectuee: `python -m unittest discover -s backend/tests -p "test_*.py"`, `npm --prefix frontend run build`
  - Risques restants: validation UX manuelle des erreurs encore souhaitable; optimisation bundle explicitement reportee apres stabilisation

- Date: 2026-03-11
  - Sujet: Revue UX ciblee des erreurs visibles
  - Statut: termine
  - Fichiers touches: STABILSTAGE1_TRACKING.md
  - Verification effectuee: revue de code ciblee `frontend/src/App.tsx`, `frontend/src/views/HomePage.tsx`, `frontend/src/views/project/ProjectModifiedGraphView.tsx`, `frontend/src/components/editor/AssetSidePanel.tsx`
  - Risques restants: seul le test manuel de perception UI en usage reel reste a faire par clic dans l'application

- Date: 2026-03-11
  - Sujet: Reduction des assertions frontend fragiles
  - Statut: termine
  - Fichiers touches: frontend/src/components/graph/blueprintTypes.ts, frontend/src/components/graph/BlueprintNode.tsx, frontend/src/components/graph/layoutDagre.ts, frontend/src/views/project/ProjectGraphEditor.tsx, frontend/src/views/project/ProjectModifiedGraphView.tsx
  - Verification effectuee: recherche frontend `as any`, `npm --prefix frontend run build`
  - Risques restants: d'autres zones frontend hors graph editor peuvent encore meriter un raffinement de types plus tard, mais les zones critiques ciblees sont couvertes

- Date: 2026-03-11
  - Sujet: Normalisation de la serialisation Pydantic
  - Statut: termine
  - Fichiers touches: backend/core/workspace_service.py, backend/routes/projects.py
  - Verification effectuee: recherche globale `.dict()` backend, `python -m compileall backend`, `python -m unittest discover -s backend/tests -p "test_*.py"`
  - Risques restants: aucun risque specifique identifie sur ce point; c'est surtout une dette technique retiree

- Date: 2026-03-11
  - Sujet: Erreurs utiles visibles backend/frontend
  - Statut: termine
  - Fichiers touches: backend/core/project_service.py, backend/core/models.py, backend/core/workspace_service.py, backend/tests/test_workspace_service.py, frontend/src/App.tsx, frontend/src/api/types.ts, frontend/src/views/HomePage.tsx, frontend/src/views/project/ProjectModifiedGraphView.tsx, frontend/src/App.css
  - Verification effectuee: `python -m compileall backend`, `python -m unittest discover -s backend/tests -p "test_*.py"`, `npm --prefix frontend run build`
  - Risques restants: validation UX manuelle encore souhaitable, mais le comportement degrade est maintenant implemente

- Date: 2026-03-11
  - Sujet: Gestion explicite des collisions d'IDs
  - Statut: termine
  - Fichiers touches: backend/core/asset_service.py, backend/core/graph_service.py, backend/core/interaction_tree_service.py, backend/routes/index_graph.py, backend/tests/test_collision_resolution.py, frontend/src/api/types.ts, frontend/src/views/project/ProjectGraphEditor.tsx, frontend/src/components/editor/AssetSidePanel.tsx, frontend/src/views/project/InteractionTreeEditor.tsx
  - Verification effectuee: `python -m compileall backend`, `python -m unittest discover -s backend/tests -p "test_*.py"`, `npm --prefix frontend run build`
  - Risques restants: la selection explicite par chemin est geree, mais les refs ambiguës internes au graphe restent filtrees tant qu'elles ne sont pas desambiguisées explicitement

- Date: 2026-03-11
  - Sujet: Strategie de cache d'index plus fiable
  - Statut: termine
  - Fichiers touches: backend/core/state.py, backend/core/index_service.py, backend/tests/test_index_service.py
  - Verification effectuee: `python -m compileall backend`, `python -m unittest discover -s backend/tests -p "test_*.py"`
  - Risques restants: la signature cible le contenu du projet, pas les gros packs externes, pour eviter un fingerprint trop couteux

- Date: 2026-03-11
  - Sujet: Preservation du manifest a l'import
  - Statut: termine
  - Fichiers touches: backend/core/workspace_service.py, backend/tests/test_import_pack.py
  - Verification effectuee: `python -m compileall backend`, `python -m unittest discover -s backend/tests -p "test_*.py"`
  - Risques restants: seules les cles connues du modele `ProjectManifest` sont preservees ; les extras sont ignores

- Date: 2026-03-11
  - Sujet: Save as securise contre les collisions
  - Statut: termine
  - Fichiers touches: backend/core/asset_service.py, backend/tests/test_asset_service.py
  - Verification effectuee: `python -m compileall backend`, `python -m unittest discover -s backend/tests -p "test_*.py"`
  - Risques restants: la politique est volontairement stricte et refuse aussi les collisions deja presentes dans les layers effectifs pour eviter les surprises de shadowing

- Date: 2026-03-11
  - Sujet: Export ZIP whitelist pack-only
  - Statut: termine
  - Fichiers touches: backend/core/export_service.py, backend/tests/test_export_service.py
  - Verification effectuee: `python -m compileall backend`, `python -m unittest discover -s backend/tests -p "test_*.py"`
  - Risques restants: si de nouveaux fichiers pack-valides hors `Common/`, `Server/`, `manifest.json` deviennent necessaires, il faudra les ajouter explicitement a la whitelist

- Date: 2026-03-11
  - Sujet: Creation de projet atomique
  - Statut: termine
  - Fichiers touches: backend/core/workspace_service.py, backend/tests/test_workspace_service.py
  - Verification effectuee: `python -m compileall backend`, `python -m unittest discover -s backend/tests -p "test_*.py"`
  - Risques restants: les dossiers parents du target peuvent etre crees en amont si absents, mais aucun contenu projet partiel n'est conserve en cas d'echec

- Date: 2026-03-11
  - Sujet: Workspace reel respecte par les routes backend/frontend
  - Statut: termine
  - Fichiers touches: backend/core/state.py, backend/core/workspace_service.py, backend/routes/workspace.py, backend/routes/projects.py, backend/routes/index_graph.py, backend/routes/assets.py, backend/routes/interactions.py, backend/core/interaction_tree_service.py, frontend/src/api/http.ts, frontend/src/api/hasApi.ts
  - Verification effectuee: `python -m compileall backend`, `npm --prefix frontend run build`, test manuel multi-workspace utilisateur
  - Risques restants: registre workspace en memoire seulement, necessite re-ouverture du workspace apres restart backend

- Date: 
  - Sujet: 
  - Statut: 
  - Fichiers touches: 
  - Verification effectuee: 
  - Risques restants: 
