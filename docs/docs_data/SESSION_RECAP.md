# 📋 Session Recap — Hytale Asset Studio

## 2026-03-05 — Séparation du repo + snapshot legacy

**Décision** : isoler l’outil dans un repo dédié (`HytaleAssetStudio`) pour éviter de polluer le mono-repo Java/Gradle FineCraft.

**Pourquoi** : un refactor automatique avait cassé l’appli ; repartir propre avec une Vision + incréments est plus sûr.

**État** :
- Document de cadrage : `VISION.md`.
- Référence historique (read-only) : `legacy/tools_graph_assets/`.

**Note (mono-repo FineCraft)** : l’outil historique `tools/graph_assets` a été stabilisé (dev server IPv4 côté Vite, route `/` côté Flask). Voir la doc `tools/graph_assets/README.md` dans le mono-repo.
