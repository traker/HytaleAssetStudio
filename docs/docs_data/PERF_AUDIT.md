# Audit de performance — instrumentation concrete

## Objectif

Mesurer d'abord, optimiser ensuite. Cette instrumentation est volontairement **opt-in** et ne change pas l'architecture metier actuelle :

- le backend reste la source de verite sur les layers et le graphe
- le frontend conserve les informations UX existantes
- aucun mode degrade n'est active par defaut

## Activation backend

Le middleware backend est active uniquement si la variable d'environnement `HAS_PERF_AUDIT=1` est presente au demarrage.

Option la plus simple via le launcher local :

```powershell
.\scripts\dev.ps1 -KillExisting -PerfAudit
```

Exemple PowerShell :

```powershell
$env:HAS_PERF_AUDIT='1'
python -m uvicorn backend.app.main:app --reload
```

Une fois active, chaque requete API ajoute :

- `X-HAS-Perf-Id` : identifiant de requete
- `X-HAS-Perf-Total-Ms` : temps total backend
- `Server-Timing` : details agreges par phase backend

Les mesures backend sont aussi logguees dans la console serveur.

## Activation frontend

Le frontend n'emet des logs de perf que si un des deux mecanismes suivants est actif :

- query string : `?perfAudit=1`
- ou `localStorage.hasPerfAudit = '1'`

Exemples :

```text
http://localhost:5173/?perfAudit=1
```

ou dans la console navigateur :

```js
localStorage.setItem('hasPerfAudit', '1')
location.reload()
```

Les mesures apparaissent dans la console navigateur sous la forme :

```text
[HAS PERF] frontend audit enabled
[HAS PERF] http.GET 42.13ms url=/api/v1/...
```

Si vous ne voyez rien, verifier en premier :

- que le terminal backend affiche bien `startup perf_audit_enabled=True`
- que l'URL ouverte contient bien `?perfAudit=1`
- que la console navigateur est ouverte sur l'onglet de la page frontend
- qu'aucun filtre de niveau de logs ne masque les messages `Info`
- que `http://127.0.0.1:8000/api/v1/health` renvoie les headers `x-has-perf-id`, `x-has-perf-total-ms` et `Server-Timing`

## Phases mesurees

Backend :

- temps total de requete HTTP
- `index.ensure`
- calcul de signature/fingerprint d'index
- chargement/sauvegarde du cache d'index
- rebuild d'index
- lectures VFS (`read_text`, `read_bytes`, `read_json`, `list_files`)
- construction des graphes focus/modifies

Frontend :

- duree des requetes HTTP
- restitution des timings backend via les headers de reponse
- transformation `toFlow`
- layout Dagre
- temps jusqu'au prochain paint pour les vues graphe

## Scenarios a comparer

Executer chaque scenario au moins 2 ou 3 fois pour separer le cold-start des runs avec cache chaud.

1. Ouverture d'un projet puis affichage de la home.
2. Ouverture du graphe focus sur un asset fortement reference.
3. Ouverture de `ProjectModifiedGraphView` sur un projet avec plusieurs overrides.
4. Expansion d'un noeud dans la vue des modifies.
5. Save / Save As puis refresh de la vue des modifies.
6. Recherche d'un asset puis ouverture de l'editeur lateral.

## Lecture des resultats

Regle simple :

- si `X-HAS-Perf-Total-Ms` est eleve mais le frontend est faible, le cout est surtout backend
- si le backend est raisonnable mais `dagre.layout`, `toFlow` ou `paint` sont eleves, le point chaud est surtout frontend
- si le premier run est lent puis les suivants chutent, il faut regarder les caches (index/VFS)

## Limites connues

- les mesures frontend passent par la console navigateur (`console.info`), il faut garder la console ouverte
- `Server-Timing` reste un resume ; pour des diagnostics plus fins il faudra peut-etre ajouter des spans supplementaires lors du futur plan `STABILPERF1`
- l'instrumentation actuelle vise d'abord les chemins critiques graph/index/VFS, pas encore l'ensemble complet de l'UI