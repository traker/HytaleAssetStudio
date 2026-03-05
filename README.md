# Hytale Asset Studio

Repo dédié pour l'outil d'édition/visualisation d'assets Hytale (séparé du mono-repo FineCraft pour éviter de mélanger Java/Gradle et l'app Node/Python).

## Vision

Voir [VISION.md](VISION.md).

## Statut

- Ce repo est initialisé proprement (sans historique) après un revert du mono-repo.
- L'implémentation est planifiée dans la Vision et sera construite incrémentalement (MVP read-only → overrides → éditeur d'interactions).

## Structure (prévue)

- `backend/` : API Python (lecture/écriture, VFS, génération de graphe)
- `frontend/` : UI web (React + graphe + éditeurs)

