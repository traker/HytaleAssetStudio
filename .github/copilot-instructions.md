# HytaleAssetStudio — Instructions Copilot

## Protocole de démarrage (important)

Avant toute tâche non triviale (feature, refacto, debug, ajout d’assets) :

1. Lire `docs/docs_data/SESSION_RECAP.md` (état/dernières décisions).
2. Lire `VISION.md` (objectif + workflows + architecture cible).
3. Si besoin d’un exemple concret, consulter le snapshot legacy : `legacy/tools_graph_assets/`.

## Contexte

- Ce repo est **indépendant** du mono-repo FineCraft `TestPluginHytale`.
- Le snapshot `legacy/tools_graph_assets/` sert de référence (code historique) ; on n’y développe pas.

## Conventions

- Ne pas committer `node_modules/`, builds, caches, venv.
- Garder les assets vanilla en lecture seule ; toute écriture doit aller dans un espace projet/override (cf. Vision).
