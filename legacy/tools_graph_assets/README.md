# Asset graph viz (Hytale)

Petit outil Python pour explorer les dépendances d'assets (JSON → JSON / modèles / textures / sons…) sous forme de graphe HTML interactif.

## Éditeur d'assets (UI React + API Flask)

Depuis mars 2026, l'outil existe aussi en version "éditeur" (React + Vite) qui consomme l'API Flask.

### Prérequis

- Python (deps UI) : `python -m pip install -r tools/graph_assets/ui/requirements.txt`
- Node (deps frontend) : dans `tools/graph_assets/editor/` faire un `npm install`

### Lancer

Dans 2 terminaux :

- Backend API (port 5000) :
  - `python tools/graph_assets/ui/app.py`
- Frontend Vite (port 5173) :
  - `cd tools/graph_assets/editor && npm run dev:ipv4`

Ouvre ensuite : `http://127.0.0.1:5173/`.

## Installation

Depuis la racine du repo :

- `python -m pip install -r tools/graph_assets/requirements.txt`

## Usage

- Générer le graphe d'un item (en utilisant le cache si présent) :
  - `python tools/graph_assets/hytale_graph_viz.py --item Weapon_Arrow_Crude`

- Forcer un rebuild du cache :
  - `python tools/graph_assets/hytale_graph_viz.py --item Weapon_Arrow_Crude --rebuild`

- Limiter la profondeur (utile si le graphe devient énorme) :
  - `python tools/graph_assets/hytale_graph_viz.py --item Weapon_Arrow_Crude --depth 4`

- Exporter le sous-graphe en JSON (base pratique si tu veux manipuler/patcher plus tard) :
  - `python tools/graph_assets/hytale_graph_viz.py --item Weapon_Arrow_Crude --depth 4 --export-json tools/graph_assets/out/arrow.json`

- Audit des références non résolues (IDs/paths qui ne matchent rien dans les roots) :
  - `python tools/graph_assets/hytale_graph_viz.py --item Weapon_Arrow_Crude --depth 4 --audit --audit-limit 40`

## Cloner un "arbre" d'item (plan)

Objectif: créer une variante d'un item en dupliquant seulement ce que tu veux modifier, et en renommant les IDs/paths clonés pour éviter d'override les assets vanilla.

- Générer un plan de clonage (ne crée aucun fichier) :
  - `python tools/graph_assets/hytale_graph_viz.py --item Weapon_Arrow_Crude --depth 4 --clone-plan --clone-mode behavior --clone-namespace FineCraft --clone-prefix FineCraft_Clone_`

- (Optionnel) Éditer le plan pour exclure ce que tu ne veux pas cloner :
  - Ouvre le fichier `tools/graph_assets/out/hytale_Weapon_Arrow_Crude_clone_plan.json`
  - Supprime des entrées dans `files` (et idéalement les clés correspondantes dans `pathMap`/`idMap` si tu veux être strict)

- Appliquer un plan édité et écrire les JSON clonés :
  - `python tools/graph_assets/hytale_graph_viz.py --clone-from tools/graph_assets/out/hytale_Weapon_Arrow_Crude_clone_plan.json --clone-write --clone-root plugin-poison/src/main/resources`

Le plan JSON contient:
- `pathMap` (relpath source -> relpath cloné)
- `idMap` (stem source -> stem cloné)
- `replacementsExact` (table de réécriture exacte utilisée pour modifier les JSON clonés)

⚠️ Par défaut, l'outil ne clone que des JSON (pas les textures/modèles/sons). Ça réduit les risques d'override et garde un lien fort avec le vanilla.

- Choisir explicitement les racines d'assets (peut être répété) :
  - `python tools/graph_assets/hytale_graph_viz.py --root Assets --root plugin-poison/src/main/resources --item Weapon_Arrow_Crude`

Sortie: `tools/graph_assets/out/`.
