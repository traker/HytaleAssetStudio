# Session Recap — Hytale Asset Studio

## 2026-03-15 — Snapshot actif

### Nouveau chantier `PUBLICATION1` initialise

- Contexte:
  - un audit global backend + frontend + publication publique a ete realise
  - verdict retenu: le repo n'est pas encore en etat de publication publique propre, meme si la base est solide et deja exploitable en local pour le developpement
  - contrainte produit reconfirmee: l'application doit rester un outil local-only, pas un service destine a etre expose a distance
- Constats principaux:
  - `npm run lint` frontend est rouge, avec plusieurs erreurs React 19 / ESLint 9 a traiter avant de parler de release propre
  - le backend est local par convention et scripts de lancement, mais le mode local-only doit etre davantage explicite et durci cote serveur / documentation
  - la surface documentaire publique est incoherente avec l'etat reel du projet (`README.md`, `frontend/README.md`, `backend/README.md`)
  - aucune licence n'est encore presente
  - le build frontend est OK et le test `interaction-contract` est OK; les tests backend n'ont pas pu etre reexecutés dans l'environnement courant faute de `pytest` installe
- Sorties creees:
  - `PUBLICATION1.md` - plan de remediations pour la readiness repo public
  - `PUBLICATION1_TRACKING.md` - tracker d'execution du chantier
- Pilotage retenu:
  - priorite immediate sur les bloqueurs de publication: lint frontend, docs publiques, licence, et formalisation / durcissement du mode local-only
  - les correctifs doivent rester compatibles avec le modele produit: outil local de confiance pilotant des chemins disque locaux
  - chaque lot doit etre ferme avec une preuve concrete de validation (`lint`, `build`, tests backend/frontend, revue doc, ou note explicite dans le tracker)

### Avancement `PUBLICATION1` — Lot 1.1 frontend

- Le sous-lot `1.1` a ete traite sur la passe du 2026-03-15.
- Correctifs appliques:
  - suppression de plusieurs resets d'etat pilotes par `useEffect` au profit de remounts cibles via `key`
  - nettoyage des violations React 19 (`set-state-in-effect`, `purity`)
  - refactor du `WorkspaceContext` pour lever le blocage `react-refresh/only-export-components`
  - nettoyage des erreurs `no-empty` et de plusieurs points d'export / helper inutiles
- Validations retenues:
  - `npm run lint` -> OK (warnings residuels non bloquants encore presents dans les vues graphe avancées)
  - `npm run build` -> OK
  - `npm run test:interaction-contract` -> OK
- Etat de pilotage:
  - `Lot 1` reste ouvert, avec `1.2` licence / hygiene repo et `1.3` documentation publique encore a faire

### Avancement `PUBLICATION1` — Lot 1.2 hygiene repo

- Le sous-lot `1.2` a ete traite sur la passe du 2026-03-15.
- Decisions et actions appliquees:
  - licence choisie: `MIT`
  - ajout d'un fichier `LICENSE` a la racine du repo
  - suppression de deux captures d'ecran non trackees presentes a la racine
  - verification de l'hygiene `.gitignore`: `dist/`, `.tmp/`, `.studio_cache/`, caches Python/Node et artefacts locaux etaient deja ignores
- Verification retenue:
  - `git status --short` relu apres nettoyage
  - controle des images trackees: seul l'asset UI legitime `frontend/src/assets/Background/bg.jpg` reste suivi dans git
- Etat de pilotage:
  - `Lot 1` reste ouvert uniquement sur `1.3` pour la surface README publique

### Avancement `PUBLICATION1` — Lot 1.3 documentation publique

- Le sous-lot `1.3` a ete traite sur la passe du 2026-03-15.
- Fichiers retravailles:
  - `README.md`
  - `backend/README.md`
  - `frontend/README.md`
- Correctifs appliques:
  - remplacement du positionnement trop "scaffold" par une description du produit reel et de ses workflows actuels
  - documentation explicite du modele local-only sur les trois points d'entree
  - alignement de la doc backend avec les defaults reels de `backend/core/config.py` et les comportements CORS/startup actuels
  - remplacement complet du template Vite dans la doc frontend par une doc projet reelle
- Etat de pilotage:
  - `Lot 1` est maintenant clos

### Avancement `PUBLICATION1` — Lot 2 local-only hardening

- Le lot `2` a ete traite sur la passe du 2026-03-15.
- Decision retenue:
  - le Studio reste officiellement un outil desktop/local-only pour operateur de confiance sur une seule machine
  - la capacite a ouvrir/ecrire sur des chemins locaux arbitraires est un choix produit explicite, pas un comportement a rendre compatible avec un mode distant
- Correctifs appliques:
  - ajout d'un mode runtime `HAS_LOCAL_ONLY=1` par defaut dans le backend
  - validation startup qui refuse des `HAS_ALLOWED_ORIGINS` non-loopback tant que le mode local-only est actif
  - middleware backend qui refuse les clients non-loopback et les origines navigateur non-loopback avec `403 LOCAL_ONLY_MODE`
  - documentation renforcee dans `README.md`, `backend/README.md` et `VISION.md`
- Validation retenue:
  - `python -m pytest backend/tests/test_routes.py` -> `8 passed`
- Etat de pilotage:
  - `Lot 2` est maintenant clos

### Avancement `PUBLICATION1` — Lot 3 validation backend reproductible

- Le lot `3` a ete traite sur la passe du 2026-03-15.
- Flow retenu:
  - utilisation de `uv` pour creer un venv propre au repo
  - installation backend documentee via `uv pip` sur l'interpreteur du venv
  - execution de la suite backend via l'interpreteur du venv plutot que via un Python global implicite
- Validation retenue:
  - `uv venv .venv`
  - `uv pip install --python .venv\Scripts\python.exe -r backend/requirements.txt`
  - `.\.venv\Scripts\python.exe -m pytest` -> `47 passed`
- Revue de risque backend apres validation:
  - pas de chemin machine-specifique detecte dans le code backend publiable ni dans la doc publique backend/racine
  - pas de secret evident detecte dans la surface backend grepee pour la publication
  - le warning de deprecation FastAPI initial sur `@app.on_event("startup")` a ensuite ete retire via migration vers un `lifespan` hook
- Etat de pilotage:
  - `Lot 3` est maintenant clos

### Avancement `PUBLICATION1` — Lot 4 hygiene frontend

- Le lot `4` a ete traite sur la passe du 2026-03-15.
- Correctifs appliques:
  - suppression des derniers warnings `react-hooks/exhaustive-deps` dans les vues graphe frontend
  - retrait de plusieurs directives eslint devenues obsoletes apres les refactors precedents
  - decoupage Vite plus fin des vendors (`react`, `react-flow`, `dagre`, `Monaco`, `ELK`)
  - passage du moteur ELK en import dynamique pour sortir son poids du bundle principal
- Decision bundle retenue:
  - le chunk lazy `elk-layout` reste volumineux mais il est maintenant isole et explicitement accepte pour le cas d'usage local-only de layout avance
  - le seuil `chunkSizeWarningLimit` a ete releve a `1500` pour eviter un warning devenu non-actionnable apres ce decoupage
- Validation retenue:
  - `npm run lint` -> OK
  - `npm run build` -> OK
  - `npm run test:interaction-contract` -> OK
- Etat de pilotage:
  - `Lot 4` est maintenant clos

### Avancement `PUBLICATION1` — Lot 5 cloture publication

- Le lot `5` a ete traite sur la passe du 2026-03-15.
- Validation finale retenue:
  - `npm run lint` -> OK
  - `npm run build` -> OK
  - `npm run test:interaction-contract` -> OK
  - `.\.venv\Scripts\python.exe -m pytest` -> `47 passed`
- Revue de cloture:
  - la surface publiable est maintenant coherente avec le positionnement reel du Studio comme outil local-only
  - les garde-fous backend, la doc publique, le flow `uv`, et la qualite frontend ont ete alignes avant fermeture du chantier
  - le worktree global reste volontairement charge d'autres modifications de session, mais ce point est compris et n'invalide pas la cloture du chantier `PUBLICATION1`
- Etat de pilotage:
  - `PUBLICATION1` est maintenant clos et pret a l'archivage dans `archived_task/`

- `UXWORKFLOW1` est clos et archivé dans `archived_task/`.
  - Résultat utile: garde anti-perte de draft, workflow `Items -> Interactions` plus visible, navigation graphe stabilisée, warnings de troncature plus actionnables, création de projet plus fiable, lisibilité du panel interaction améliorée.
  - Décision: ne pas rouvrir ce chantier pour les incohérences résiduelles; les écarts restants devront partir dans un futur plan dédié.
- `ASSETFORMS1` est complété.
  - Couverture structurée ajoutée pour `entity-effect`, `projectile`, `npc-role` et pour `Item.BlockType`.
  - Vérification retenue: build frontend OK.
- `STABILSTAGE2` est complété.
  - Qualité/perf frontend stabilisées (`MAX_DAGRE_NODES`, Monaco lazy, `WorkspaceContext`, styles de formulaires centralisés, persistance `activeWorkspaceId`).
  - Tests migrés vers `pytest`; vérification de clôture: `41 passed` + build frontend OK.
- Contrat Interaction Editor consolidé sur les points récents.
  - `Replace.DefaultValue` est maintenant une vraie branche de graphe/import/export.
  - Les références serveur externes apparaissent maintenant comme nœuds `_ref` dans le graphe d'interactions.
  - Vérifications récentes: tests backend ciblés, test contractuel frontend, build frontend OK.

## Vérités à retenir

- Le backend reste la source de vérité pour les layers, l'index, le graphe et la résolution des assets; le frontend ne charge que des données ciblées.
- La knowledge base de référence du projet est formée par les assets vanilla lus en read-only et par `docs/Hytale Docs/`; le legacy sert seulement de référence historique d'implémentation.
- Les chantiers `INTERACTIONEDITOR1`, `ASSETFORMS1`, `STABILSTAGE2` et `UXWORKFLOW1` sont clôturés pour ce cycle.
- Les prochaines reprises doivent partir de la synthèse active ici, puis remonter aux archives si un détail d'implémentation manque.

## Archives

> Archivé → [SESSION_RECAP_2026_03.md](docs/docs_data/archive/SESSION_RECAP_2026_03.md)

## Note de curatelle

- Le recap détaillé de mars 2026 a été déplacé en archive de façon exceptionnelle pour rendre ce fichier à nouveau navigable avant le seuil normal des 15 jours.