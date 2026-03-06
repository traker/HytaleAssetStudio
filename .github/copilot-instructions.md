# HytaleAssetStudio — Instructions Copilot

## Protocole de démarrage (important)

Avant toute tâche non triviale (feature, refacto, debug, ajout d’assets) :

1. Lire `docs/docs_data/SESSION_RECAP.md` (état/dernières décisions).
2. Lire `VISION.md` (objectif + workflows + architecture cible).
3. Si besoin d’un exemple concret, consulter le snapshot legacy : `legacy/tools_graph_assets/`.

## Fil d'Ariane (quand tu perds le fil)

Si le contexte est confus, contradictoire, ou si tu ne sais pas “quoi faire ensuite”, applique cet ordre :

1. Re-lire `docs/docs_data/SESSION_RECAP.md` : c’est la source la plus "fraîche" (décisions récentes).
2. Re-lire `VISION.md` : vérifier que l’action demandée correspond à un Workflow et respecte les Anti-Objectifs.
3. Re-lire `docs/docs_data/API_BACKEND_MINIMAL.md` si la question touche aux endpoints/payloads backend.
4. Regarder le legacy `legacy/tools_graph_assets/` uniquement comme référence (ne pas y développer).

Ensuite :

- Résumer en 2–5 lignes ce que tu crois être vrai (hypothèses explicites).
- Proposer un prochain pas concret et vérifiable (petite implémentation, patch, ou lecture ciblée de fichiers).

## Règle "ne pas inventer" (obligatoire)

Quand une information est manquante (chemin local, format exact, décision produit, structure de fichier, comportement attendu) :

- Ne pas inventer une réponse “toute faite”.
- Poser 1 à 3 questions précises à l’utilisateur, avec un choix par défaut si possible.

Exemples typiques où il faut demander :

- un chemin local (ex: vanilla Assets) si non présent dans le contexte,
- un format/contrat non défini (ex: structure exacte d’un JSON Hytale non observé),
- un arbitrage UX (“on fait A ou B ?”) si la Vision ne tranche pas.

## Suivi (garder le contexte dans le repo)

Après une décision produit/tech importante ou un changement de direction :

- Mettre à jour `docs/docs_data/SESSION_RECAP.md` (décision + date + pourquoi).
- Mettre à jour `VISION.md` si ça impacte les Workflows, règles, ou formats.
- Si c’est un contrat d’API, mettre à jour `docs/docs_data/API_BACKEND_MINIMAL.md`.

Objectif : que le repo contienne toujours un point d’ancrage clair pour reprendre après une pause.

## Contexte

- Ce repo est **indépendant** du mono-repo FineCraft `TestPluginHytale`.
- Le snapshot `legacy/tools_graph_assets/` sert de référence (code historique) ; on n’y développe pas.

## Dev: Accès aux assets vanilla locaux (hors-repo)

Pendant le développement du Studio, il est acceptable (et attendu) de **consulter** le dossier d'assets vanilla local pour vérifier la structure réelle des fichiers et des références.

- Chemin de référence (machine dev actuelle) : `K:\projet\java\TestPluginHytale\Assets`
- Cet accès est **read-only** : ne jamais écrire/modifier ce dossier.
- Ne jamais ajouter ces assets au repo `HytaleAssetStudio`.
- Si le chemin diffère sur une autre machine, demander le chemin à l'utilisateur.

## Conventions

- Ne pas committer `node_modules/`, builds, caches, venv.
- Garder les assets vanilla en lecture seule ; toute écriture doit aller dans un espace projet/override (cf. Vision).
