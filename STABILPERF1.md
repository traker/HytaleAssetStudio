# STABILPERF1 - Plan de stabilisation performance

Objectif: traiter les points chauds mesures reellement sur le backend/frontend sans perdre d'information UX et sans simplifier prematurement les workflows.

## Cadre

- Les mesures de ce plan viennent de l'instrumentation opt-in decrite dans `docs/docs_data/PERF_AUDIT.md`.
- Le backend reste la source de verite sur les layers, l'index et le graphe.
- L'objectif n'est pas de "rendre le graphe plus pauvre", mais de supprimer les recalculs et scans evitables.
- Toute optimisation doit etre re-mesuree avant de passer au lot suivant.

## Rapport de mesures - synthese

Scenario principal observe: ouverture de `ProjectModifiedGraphView`, expansion de noeuds, changement de profondeur.

Constats mesures:

1. Le point chaud principal est `/api/v1/projects/{projectId}/modified` au cold start.
- Temps observes: ~28.5s.
- `Server-Timing`: `vfs.list_files` represente ~28.1s a ~28.6s du total.
- Conclusion: le cout dominant n'est pas le graphe, mais le scan complet des layers inferieurs pour classer `new` vs `override`.

2. Le cache readonly VFS corrige bien le hot path mais pas le cold path.
- Une fois chaud, `/modified` retombe vers ~196ms a ~199ms.
- `Server-Timing`: `vfs.list_files.cache_hit` ~1ms.
- Conclusion: le cache VFS actuel aide, mais la route `/modified` repose encore sur une collecte trop couteuse lors du premier passage.

3. `/graph-modified` n'est pas la cause principale du ralentissement percu.
- A chaud, `graph.modified` lui-meme reste faible: ~10ms a ~13ms.
- Le temps total provient surtout de `index.ensure` et de son fingerprinting: ~200ms dans les runs observes.
- Conclusion: le probleme n'est pas la structure de graphe transportee seule, mais les recalculs backend autour d'elle.

4. Les routes asset/focus sont acceptables cote backend.
- `/graph?root=...`: ~20ms a ~24ms backend.
- `/asset?key=...`: ~11ms a ~14ms backend.
- Conclusion: pas de chantier prioritaire sur ces endpoints tant que les couts `/modified` et `index.ensure` ne sont pas traites.

5. Le frontend a un cout reel mais secondaire.
- `graph.layout_dagre`: ~23ms a ~156ms selon la taille du graphe.
- `view.modified_graph.paint`: ~58ms a ~419ms.
- Conclusion: il y a une marge frontend sur les gros graphes, mais ce n'est pas le levier principal tant que le backend cold start reste dominant.

## Cause racine probable

### A. Collecte des fichiers modifies trop chere

Dans `backend/core/modification_service.py`, `collect_project_modifications(...)` reconstruit a chaque appel:

- `lower_layer_paths`
- `lower_layer_server_ids`

en parcourant `mount.list_files()` pour tous les layers non projet.

Effet:

- premier appel tres lent sur gros packs readonly
- duplication de travail avec l'index effectif deja calcule ailleurs
- latence massive visible des l'ouverture de `ProjectModifiedGraphView`

### B. `index.ensure` encore trop present dans les flux graphe/asset

Les traces montrent plusieurs appels a `index.ensure`, `index.fingerprint` et `index.project_signature` dans des chemins tres frequents.

Effet:

- cout notable meme a chaud
- repetition de calculs de fingerprint dans les flux de lecture simples

### C. Cout frontend sur les graphes profonds

Le couple `toFlow` + `layout_dagre` + `paint` grimpe avec la taille du graphe.

Effet:

- experience moins fluide sur profondeur 3+
- mais apres correction du backend seulement, sinon on optimise le mauvais niveau d'abord

## Lots proposes

**Lot 1: Eliminer le scan massif de `/modified`**

Objectif: faire de `/modified` une lecture derivee d'etats deja connus ou caches, au lieu d'un rescannage complet des layers inferieurs.

1. Reutiliser l'index effectif pour classer `new` vs `override`
Fichiers cibles:
- `backend/core/modification_service.py`
- `backend/core/index_service.py`
- `backend/routes/assets.py`

Ce qu'il faut changer:
- Eviter de reconstruire `lower_layer_paths` et `lower_layer_server_ids` par `build_mounts(...)+list_files()` a chaque appel.
- Reutiliser autant que possible l'index effectif deja disponible pour savoir:
  - si un `server_id` existe dans un layer inferieur
  - si un `Common/...` existe dans un layer inferieur
- Si l'index actuel ne suffit pas, l'enrichir avec un cache explicitement oriente "classification des modifications".

Option recommandee:
- introduire un cache backend par fingerprint de projet/layers pour la vue des modifications, plutot que rescanner les mounts a chaque route.

Criteres d'acceptation:
- le premier appel a `/modified` ne fait plus exploser `vfs.list_files` a plusieurs dizaines de secondes
- le classement `new` vs `override` reste strictement identique fonctionnellement

2. Verifier l'absence de regression semantique sur `override` par ID serveur
Fichiers cibles:
- `backend/tests/test_asset_service.py`
- nouveaux tests si necessaire

Ce qu'il faut proteger:
- `server-json`: `override` base sur l'existence d'un meme ID serveur dans un layer inferieur
- `common-resource`: `override` base sur l'existence du meme chemin inferieur

Critere d'acceptation:
- aucune regression sur la distinction `new` vs `override` deja validee sur `ProjectModifiedGraphView`

**Lot 2: Reduire les recalculs `index.ensure`**

Objectif: eviter de payer plusieurs fois le fingerprinting et les verifications d'index dans le meme flux utilisateur.

1. Identifier et reduire les doubles appels `ensure_index`
Fichiers cibles:
- `backend/core/index_service.py`
- `backend/core/asset_service.py`
- `backend/core/graph_service.py`
- `backend/routes/index_graph.py`
- `backend/routes/assets.py`

Ce qu'il faut changer:
- Eviter les appels repetes a `ensure_index(...)` quand plusieurs services backend sont enchaines dans une meme requete ou dans deux lectures immediates du meme ecran.
- Evaluer une memoisation par requete ou une reutilisation plus explicite de l'etat d'index deja resolu.

Criteres d'acceptation:
- baisse visible des temps `index.ensure`, `index.fingerprint` et `index.project_signature` dans les traces perf
- pas de regression de coherence apres save/copy

2. Preserver l'invalidation correcte
Fichiers cibles:
- `backend/core/index_service.py`
- `backend/core/asset_service.py`

Ce qu'il faut garantir:
- une ecriture projet continue d'invalider correctement l'index
- les optimisations de cache n'introduisent pas de stale data sur le graphe ou la liste des modifications

Critere d'acceptation:
- apres save/copy, l'etat recharge reste correct sans redemarrage ni action manuelle

**Lot 3: Optimiser la phase frontend sur gros graphes**

Objectif: lisser la perception UI une fois les couts backend majeurs reduits.

1. Mesurer puis optimiser `toFlow`, layout et paint
Fichiers cibles:
- `frontend/src/views/project/ProjectModifiedGraphView.tsx`
- `frontend/src/views/project/ProjectGraphEditor.tsx`
- `frontend/src/components/graph/layoutDagre.ts`

Pistes a evaluer:
- eviter des recompositions inutiles des noeuds/edges lors des refresh proches
- limiter les relayouts complets si seule une petite expansion est ajoutee
- verifier l'impact de `StrictMode` en dev versus build reel

Critere d'acceptation:
- baisse mesuree de `graph.layout_dagre` et/ou `view.modified_graph.paint` sur les graphes de profondeur 3+

## Ordre d'execution recommande

1. Corriger `/modified` et la classification des modifications
2. Reduire les recalculs `index.ensure`
3. Re-mesurer completement `ProjectModifiedGraphView`
4. Seulement ensuite traiter les couts frontend sur gros graphes

## Tests et validations a exiger

1. Backend
- tests sur la classification `new` vs `override`
- tests sur cache chaud/froid si possible au niveau unite/integration
- verification qu'aucune ecriture projet ne laisse un index stale

2. Frontend
- build OK
- verification manuelle des vues graphe focus et modifies

3. Perf
- re-executer les scenarios de `docs/docs_data/PERF_AUDIT.md`
- comparer avant/apres au minimum sur:
  - `/modified`
  - `/graph-modified`
  - `graph.layout_dagre`
  - `view.modified_graph.paint`

## Definition de succes de STABILPERF1

- `/modified` n'a plus de cold start a plusieurs dizaines de secondes sur le projet de reference
- `ProjectModifiedGraphView` reste fonctionnellement identique pour l'utilisateur
- les indicateurs `new`/`override`, les roots modifies, l'expansion et le refresh apres save/copy restent corrects
- les gains sont verifies par traces perf, pas seulement "ressentis"