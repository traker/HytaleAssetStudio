# 📋 Session Recap — Hytale Asset Studio

## 2026-03-05 — Séparation du repo + snapshot legacy

**Décision** : isoler l’outil dans un repo dédié (`HytaleAssetStudio`) pour éviter de polluer le mono-repo Java/Gradle FineCraft.

**Pourquoi** : un refactor automatique avait cassé l’appli ; repartir propre avec une Vision + incréments est plus sûr.

**État** :
- Document de cadrage : `VISION.md`.
- Référence historique (read-only) : `legacy/tools_graph_assets/`.

**Note (mono-repo FineCraft)** : l’outil historique `tools/graph_assets` a été stabilisé (dev server IPv4 côté Vite, route `/` côté Flask). Voir la doc `tools/graph_assets/README.md` dans le mono-repo.

---

## 2026-03-05 — Cache disque de l’index + compat Pydantic

**Fait** : persistance de l’index projet sur disque pour éviter un rebuild complet à chaque redémarrage.

- Cache écrit dans `<projectRoot>/.studio_cache/index.json` lors d’un `POST /projects/{projectId}/rebuild`.
- Chargement lazy via `ensure_index(...)` (mémoire → cache disque → rebuild).
- Testé : après redémarrage de l’API, `GET /search` + `GET /graph` fonctionnent sans rebuild explicite.

**Fix dev** : compat Pydantic v1/v2 pour éviter des `500` si `uvicorn` est lancé depuis un autre Python.

- Helper : `backend/core/pydantic_compat.py`.
- Doc : privilégier `python -m uvicorn ...` (voir `backend/README.md`).

---

## 2026-03-06 — Frontend : point d’arrêt + décisions d’architecture

**Objectif** : éviter la dérive vers des fichiers frontend énormes ; clarifier les vues et factoriser le “shell” d’éditeur (style legacy).

**Décisions** :
- **Deux vues distinctes** : Graphe Items **et** Graphe Interactions (à ne pas confondre).
- **Vue “Fichiers modifiés”** : inclut **Server + Common** (pas seulement les JSON server).
- **Interaction view** : reprendre l’esprit **legacy** (blueprint + panneau d’édition type raw/form + sauvegarde override), en l’intégrant au concept Projet/Config.

**Notes** :
- Le backend n’a pas encore d’endpoint dédié pour lister les fichiers modifiés/overrides ; à prévoir pour supporter correctement la vue “modifiés”.

---

## 2026-03-06 — Dev launcher (Windows) + fix Vite/NPM

**Problème** : exécution dev instable (ports/instances multiples) + erreurs liées au profil PowerShell (Terminal-Icons) + `npm@11` qui casse le passage d’arguments à Vite (résultat : frontend sur `:5173` mais `/` répondait 404).

**Fait** :
- Script unique de lancement dev : [scripts/dev.ps1](../../scripts/dev.ps1)
	- Démarre backend + frontend dans deux terminaux.
	- Utilise `pwsh -NoProfile` (fallback `powershell`) pour éviter les modules chargés via profil.
	- Paramètres : `-ApiPort` (défaut 8000), `-WebPort` (défaut 5173), `-KillExisting`.
- Vite dev server piloté via variables d’environnement (évite les args CLI mangés par `npm@11`) :
	- `HAS_API_PORT` : port backend pour le proxy `/api`.
	- `HAS_WEB_HOST` / `HAS_WEB_PORT` : host/port du serveur dev.

**Décision** : port “base” backend = **8000** (configurable), et éviter absolument plusieurs uvicorn simultanés.

---

## 2026-03-06 — Plan Frontend (tranches)

Objectif : garder des fichiers petits, respecter le style legacy, et avancer par incréments testables.

### Tranche A — Données graphe (backend) pour un rendu legacy correct
- Enrichir la réponse `GET /projects/{projectId}/graph` : chaque node doit porter des métadonnées exploitables côté UI (ex: `group`, `path`, `title/label`, et `state` vanilla/local) + intégrer les ressources Common quand elles sont référencées.
- Enrichir `GET /projects/{projectId}/search` pour aider la vue Interactions (ex: “kind” et/ou catégories) et rendre la recherche moins ambiguë.

### Tranche B — Graphe Items (UI)
- Utiliser ces métadonnées pour appliquer les couleurs/typologies “blueprint” (comme legacy) sans heuristiques fragiles.
- Garder l’éditeur JSON dans le panneau droit (read + save override quand on activera l’édition).

### Tranche C — Graphe Interactions (UI legacy-like)
- Vue dédiée (déjà séparée) : layout + panel comme legacy.
- Panneau d’édition :
	- Mode RAW (JSON) MVP.
	- Mode Form (optionnel plus tard si on a un schéma fiable).
	- Save override via `PUT /asset` (mode `override`).

---

## 2026-03-06 — Alignement “legacy” : Items graph enrichi + Interaction Tree Editor

**Fait** :
- Le graphe Items renvoie maintenant des nodes enrichis (`group`, `path`, `title`) et peut inclure des nodes Common (ex: textures/sounds) lorsqu’un JSON référence un fichier existant sous `Common/`.
- La vue **Interactions** n’est plus un “graph global” : elle affiche le **graphe interne** du fichier d’interaction sélectionné depuis Items (ports Next/Failed/Child).

**Backend** : nouvel endpoint `GET /api/v1/projects/{projectId}/interaction/tree?root=...`.

### Tranche D — Vue “Modifiés”
- Déjà implémentée : lister **Server + Common**, actions click (ouvrir JSON ou ressource).
- Améliorations ultérieures seulement si demandées (tri/filtre/refresh).

---

## 2026-03-09 — Ajout d'une base de docs Hytale (référence)

**Fait** : ajout du dossier `docs/Hytale Docs/` avec un point d'entrée.

- Entrée : `docs/Hytale Docs/01_Getting_Started.md`
