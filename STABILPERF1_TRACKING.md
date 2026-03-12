# STABILPERF1 - Suivi d'execution

Document de pilotage pour executer le plan defini dans `STABILPERF1.md`.

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

### Lot 1 - Eliminer le scan massif de `/modified`

- Statut global: `in-progress`
- Objectif: supprimer le rescannage complet des layers readonly lors de la collecte des fichiers modifies.

#### 1. Reutiliser l'index effectif ou un cache dedie pour classifier les modifications

- Statut: `done`
- Priorite: P0
- Fichiers cibles:
  - `backend/core/modification_service.py`
  - `backend/core/index_service.py`
  - `backend/routes/assets.py`
- Taches:
  - [x] Cartographier precisement les donnees deja disponibles dans l'index pour `new` vs `override`
  - [x] Supprimer le parcours complet des lower layers dans `collect_project_modifications(...)`
  - [x] Reutiliser l'index existant ou introduire un cache dedie par fingerprint projet/layers
  - [x] Verifier que les resources `Common/*` restent classees par chemin et les `server-json` par ID serveur
  - [x] Garder le format de reponse API inchange
- Criteres d'acceptation:
  - [x] Le cold start de `/modified` baisse fortement
  - [ ] La semantique `new` vs `override` reste identique
- Validation:
  - [x] Tests backend de classification
  - [x] Mesure perf avant/apres sur `/modified`
  - [x] Verification manuelle `ProjectModifiedGraphView`
- Notes:
  - Baseline actuelle observee: ~28.5s sur `/modified`, dont ~28.1s a ~28.6s en `vfs.list_files` au premier appel.
  - En cours: les metadonnees lower-layer sont maintenant calculees dans l'index pour etre reutilisees par la collecte des modifications au lieu de rescanner les mounts readonly a chaque appel.
  - Validation actuelle: `python -m unittest discover -s backend/tests -p "test_*.py"` -> 26 tests OK.
  - Mesure apres changement: premier `/modified` ~266.64ms backend (`index.ensure` ~249.98ms) au lieu de ~28.5s; runs suivants ~26ms backend / ~86ms cote navigateur.
  - Mesure apres changement: premier `/graph-modified?depth=1` ~286.42ms backend au lieu de ~28.5s, puis ~38.39ms backend a chaud.

#### 2. Proteger le comportement metier de la vue des modifies

- Statut: `done`
- Priorite: P0
- Fichiers cibles:
  - `backend/tests/test_asset_service.py`
  - autres tests backend si necessaire
- Taches:
  - [x] Verifier les cas `override` par meme ID serveur avec chemin different
  - [x] Verifier les cas `new` si l'ID n'existe que dans le projet
  - [x] Verifier les resources `Common/*` par chemin exact
- Criteres d'acceptation:
  - [x] Aucun changement visible non voulu dans les badges `NEW` / `OVERRIDE` cote backend contractuel
- Validation:
  - [x] Suite backend verte

### Lot 2 - Reduire les recalculs `index.ensure`

- Statut global: `done`
- Objectif: limiter les recalculs de fingerprint et les revalidations d'index dans les flux les plus frequents.

#### 3. Reduire les doubles appels d'index dans les routes critiques

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - `backend/core/index_service.py`
  - `backend/core/asset_service.py`
  - `backend/core/graph_service.py`
  - `backend/routes/index_graph.py`
  - `backend/routes/assets.py`
- Taches:
  - [x] Lister les chemins qui appellent `ensure_index(...)` plusieurs fois dans le meme flux utilisateur
  - [x] Introduire une reutilisation locale ou une memoisation par requete si pertinente
  - [x] Re-mesurer `index.ensure`, `index.fingerprint` et `index.project_signature`
- Criteres d'acceptation:
  - [x] Baisse visible des timings `index.ensure` sur `/graph-modified`, `/graph` et `/asset`
- Validation:
  - [x] Mesure perf avant/apres sur les routes concernees
  - [x] Tests backend verts
- Notes:
  - Nettoyage effectue: suppression des `ensure_index(...)` redondants dans `backend/routes/index_graph.py` avant `build_focus_graph(...)` et `build_modified_graph(...)`.
  - Nettoyage effectue: reutilisation du meme index dans `backend/core/asset_service.py` pour eviter un double `ensure_index(...)` dans le chemin `copy`.
  - Optimisation write path: apres save/copy, l'index memoire est maintenant mis a jour incrementalement au lieu d'etre reconstruit ou invalide globalement.
  - Validation actuelle: `python -m unittest discover -s backend/tests -p "test_*.py"` -> 27 tests OK.
  - Mesure finale: les traces montrent maintenant `count=1` sur `index.ensure` dans les routes critiques, sans rebuild massif apres write.
  - Mesure finale: `PUT /asset` ~42.19ms backend sur le scenario de test, puis `GET /modified` ~30.49ms et `GET /graph-modified?depth=4` ~70.13ms backend juste apres ecriture.

#### 4. Preserver l'invalidation correcte apres ecriture

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - `backend/core/index_service.py`
  - `backend/core/asset_service.py`
- Taches:
  - [x] Verifier que save/override/copy invalident toujours correctement l'etat en cache
  - [x] Verifier l'absence de stale data dans la vue des modifies et le graphe
- Criteres d'acceptation:
  - [x] Apres save/copy, les vues rechargees restent exactes
- Validation:
  - [x] Tests backend ecriture puis lecture
  - [x] Verification manuelle UI apres save/copy

### Lot 3 - Lisser les couts frontend sur gros graphes

- Statut global: `in-progress`
- Objectif: reduire le cout de composition/layout/paint sur les graphes les plus volumineux, maintenant que les goulets backend majeurs sont traites.

### Lot 3 - Lisser les couts frontend sur gros graphes

- Statut global: `todo`
- Objectif: reduire le cout de composition/layout/paint sur les graphes les plus volumineux, seulement apres amelioration backend.

#### 5. Re-mesurer puis optimiser `toFlow`, layout et paint

- Statut: `in-progress`
- Priorite: P2
- Fichiers cibles:
  - `frontend/src/views/project/ProjectModifiedGraphView.tsx`
  - `frontend/src/views/project/ProjectGraphEditor.tsx`
  - `frontend/src/components/graph/layoutDagre.ts`
- Taches:
  - [x] Rejouer les scenarios profondeur 1/2/3 apres optimisation backend
  - [x] Identifier les relayouts et recompositions evitables
  - [x] Limiter les recalculs complets quand seule une petite expansion change le graphe
- Criteres d'acceptation:
  - [x] Baisse mesuree de `graph.layout_dagre`, `graph.modified_to_flow` ou `view.modified_graph.paint`
- Validation:
  - [x] Build frontend OK
  - [x] Verification manuelle des interactions graphe
  - [x] Comparatif perf avant/apres
- Notes:
  - `ProjectModifiedGraphView.tsx`: suppression d'une recherche quadratique `rawNodes.find(...)` dans `toFlow(...)` au profit d'une map `nodeById`.
  - `layoutDagre.ts`: ajout d'un cache LRU de layout Dagre par topologie/hauteur de noeuds pour reutiliser les positions sur les graphes identiques.
  - `BlueprintNode.tsx`: memoisation avec comparateur custom pour reduire les rerenders inutiles des noeuds React Flow pendant les updates de selection/highlight et les petits merges.
  - `ProjectModifiedGraphView.tsx`: evitement des rebuilds complets si la signature du graphe n'a pas change et limitation des updates de highlight/selection aux elements affectes.
  - `BlueprintNode.tsx`: ajout de hints CSS de containment pour reduire le cout de paint navigateur.
  - Validation actuelle: `npm --prefix frontend run build` -> OK.
  - Mesures finales observees:
    - reload identique depth=1: `graph.layout_dagre` ~0.00-0.10ms, `graph.modified_to_flow` ~0.20-0.30ms, `paint` ~198-221ms
    - reload identique depth=3: `graph.layout_dagre` ~0.10ms, `graph.modified_to_flow` ~0.40ms, `paint` ~477ms
    - reload identique depth=4: `graph.layout_dagre` ~0.00-0.10ms, `graph.modified_to_flow` ~0.50ms, `paint` ~468-568ms selon contexte
    - expansions locales: navigation ressentie nettement plus fluide; un cas mesure descend a `paint` ~148ms sur un graphe ~60 noeuds

### Evaluation Lot 3

- Statut: `substantially-done`
- Conclusion:
  - les couts algorithmiques frontend (`toFlow` + `layout`) sont maintenant quasiment elimines sur les reloads de graphes identiques
  - le reliquat principal reste le paint navigateur/React Flow sur tres gros graphes, mais la fluidite de navigation est jugee nettement meilleure
  - un gain supplementaire demanderait probablement une reduction de densite DOM par noeud ou une virtualisation plus poussee, donc un chantier plus intrusif UX/UI

## Risques / points d'attention

- Ne pas casser la semantique metier `override` vs `new` juste pour gagner du temps.
- Ne pas introduire de cache stale sur les ecritures projet.
- Ne pas optimiser le frontend avant d'avoir retire le goulet principal backend.

## Baseline de reference

- `/modified` cold start: ~28.5s, dont ~28.1s a ~28.6s sur `vfs.list_files`
- `/modified` hot path: ~196ms a ~199ms avec `vfs.list_files.cache_hit`
- `/graph-modified?depth=1` a chaud: ~424ms avec ~204ms sur `index.ensure`
- `graph.modified`: ~10ms a ~13ms
- `graph.layout_dagre`: ~23ms a ~156ms
- `view.modified_graph.paint`: ~58ms a ~419ms

## Resultats intermediaires apres Lot 1.1

- `/modified` cold start: ~266.64ms backend au lieu de ~28.5s
- `/modified` chaud: ~26.43ms backend, ~86ms cote navigateur
- `/graph-modified?depth=1` premier appel: ~286.42ms backend au lieu de ~28.5s
- `/graph-modified?depth=1` chaud: ~38.39ms backend
- Nouveau point chaud principal: `index.ensure` / `index.cache_load` / fingerprinting

## Resultats intermediaires apres Lot 2

- `index.ensure` est maintenant stable avec `count=1` sur les routes critiques mesurees
- `PUT /asset` ne declenche plus de `index.rebuild` massif sur save/override
- apres ecriture, `GET /modified` reste autour de ~30ms backend
- apres ecriture, `GET /graph-modified?depth=4` reste autour de ~70ms backend
- le point chaud residuel percu se deplace vers le frontend sur gros graphes: `graph.layout_dagre` ~206.90ms, `graph.modified_to_flow` ~208.20ms, `view.modified_graph.paint` ~425ms a ~451ms