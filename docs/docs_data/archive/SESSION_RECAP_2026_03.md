- 2026-03-14 - Nouveau chantier UX/UI `UXWORKFLOW1` initialise
	- Contexte:
		- un audit frontend centre sur workflow UX, interactions utilisateur et UI a ete realise
		- plusieurs frictions prioritaires ont ete retenues: perte silencieuse de draft possible, workflow `Items -> Interactions` peu decouvrable, navigation graphe trop mouvante, messages de troncature peu actionnables, creation de projet fragile sur le champ directory
	- Sorties creees:
		- `UXWORKFLOW1.md` - plan atomique de remediations UX/UI
		- `UXWORKFLOW1_TRACKING.md` - tracker d'execution avec regles de suivi, validations et statuts par lot
	- Pilotage retenu:
		- priorite initiale sur la confiance utilisateur et la decouvrabilite des workflows avant toute refonte visuelle plus large
		- chaque sous-tache UX doit etre fermee avec une preuve concrete (build, test manuel, ou observation UI notee dans le tracker)
	- Avancement lot 1:
		- `AssetSidePanel.tsx` expose maintenant un vrai etat `dirty` / `saving` / `saved` / `error` / `synced`
		- un composant `UnsavedChangesDialog` a ete ajoute pour intercepter la perte de draft avant fermeture ou changement de selection
		- la garde est branchee dans `ProjectGraphEditor`, `ProjectModifiedGraphView` et `InteractionTreeEditor` pour les panneaux assets externes
		- build frontend valide: `npm --prefix frontend run build`
		- validation manuelle encore a faire avant de passer les sous-taches 1.1 a 1.3 en `done`
	- Avancement lot 2:
		- la top bar affiche maintenant un hint visible quand `Interactions` n'est pas encore debloque
		- le dashboard projet contient une carte `Interactions Workflow` qui explique le chemin `Items -> selection -> Open Interactions`
		- `AssetSidePanel.tsx` expose un vrai bloc `Workflow` avec CTA `Open Interactions` plus visible, mais seulement quand l'asset selectionne peut reellement ouvrir une interaction
		- `InteractionTreeEditor.tsx` expose une action visible d'ouverture de l'interaction referencee pour les refs serveur externes, en plus du double-clic, et la masque quand la cible est deja ouverte
		- cloture du lot 2 validee apres verification manuelle utilisateur et build frontend OK
	- Avancement lot 3:
		- `ProjectGraphEditor.tsx` et `ProjectModifiedGraphView.tsx` ne declenchent plus d'expansion sur simple clic; l'extension locale passe maintenant par un controle explicite `+ / -` dans le noeud
		- `ProjectGraphEditor.tsx` precharge maintenant `n+1` niveaux tout en affichant `n`, ce qui garde les refs visibles dans les cartes et permet d'ouvrir une branche precise depuis une ref cachee
		- `ProjectModifiedGraphView.tsx` suit maintenant la meme logique `n+1` affiche `n`, avec refs visibles dans le noeud et revelation ciblee d'une branche cachee au clic
		- la recherche du graphe items charge maintenant directement le graphe sur selection d'un resultat, avec un message d'aide associe
		- `ProjectGraphEditor.tsx` et `ProjectModifiedGraphView.tsx` limitent maintenant les `fitView` aux cas explicites pour eviter les sauts de camera pendant l'exploration locale
		- build frontend valide: `npm --prefix frontend run build`
	- Avancement lot 4:
		- `layoutDagre.ts` expose maintenant un helper de warning de troncature qui explique la vraie contrainte technique: la preview de layout est limitee aux `MAX_DAGRE_NODES` premiers noeuds pour garder une navigation fluide
		- `ProjectGraphEditor.tsx`, `InteractionTreeEditor.tsx` et `ProjectModifiedGraphView.tsx` affichent maintenant des warnings plus actionnables, avec prochaine action adaptee au contexte (`reduce depth`, `open a referenced interaction`, `isolate one modified root`)
		- `ProjectGraphEditor.tsx`, `InteractionTreeEditor.tsx`, `HomePage.tsx` et `ProjectConfigView.tsx` ont ete harmonises sur une micro-convention simple pour les etats systeme: verbes d'action pour le chargement, succes courts et fallback d'erreur explicites `Unable to ...`
		- `HomePage.tsx` fiabilise la creation de projet avec un etat `directoryTouched`: le champ `Directory` ne se recompose plus apres une edition manuelle, et l'aide inline explique la regle
		- build frontend valide: `npm --prefix frontend run build`
	- Stabilisation complementaire lot 3:
		- `ProjectModifiedGraphView.tsx` aligné sur le comportement de la vue Items: une simple selection de noeud ne change plus les dependances des callbacks qui pilotent le refetch complet
		- le reload complet et le `fitView` restent maintenant reserves aux vrais changements de vue (`projectId`, `depth`, focus explicite depuis la liste, refresh volontaire), ce qui evite le reset/recalcul au simple clic
		- le toggle `+ / -` de `ProjectModifiedGraphView.tsx` ne depend plus de l'historique `expandedNodeIds` pour une branche deja prechargee: une branche connue s'ouvre ou se referme maintenant localement et immediatement
		- build frontend valide: `npm --prefix frontend run build`
	- Avancement lot 5:
		- `formStyles.ts` releve legerement la hierarchie des labels, champs et espacements pour rendre le panel interaction moins compact et plus lisible sur desktop
		- `InteractionFormPanel.tsx` ajuste header, tabs, padding de contenu et footer, et replie maintenant `Additional Fields` par defaut pour limiter le bruit visuel
		- `interactionFormTypeSections.tsx` et `InteractionFormStructuredEditors.tsx` supportent maintenant des sections repliables; premier lot applique a `Damage Effects`, `Default Value` et `HitEntityRules`
		- build frontend valide: `npm --prefix frontend run build`
	- Avancement lot 6:
		- `UXWORKFLOW1_TRACKING.md` contient maintenant une checklist de walkthrough manuel en 5 parcours max, chacun rattache aux lots modifies pour servir de support de cloture
		- la preuve technique minimale du lot 6 est deja renseignee: build frontend vert et rappel des validations manuelles deja obtenues dans la session
		- la fermeture complete du lot depend maintenant surtout d'une passe manuelle courte sur les 5 parcours listes dans le tracker
	- Cloture UXWORKFLOW1:
		- decision prise de clore `UXWORKFLOW1` sans reouvrir ce chantier pour les incoherences residuelles; ces sujets devront etre traites dans un plan futur dedie
		- le plan et son tracker passent en archive dans `archived_task/`
		- fichiers modifies couverts par le commit de cloture: `UXWORKFLOW1.md`, `UXWORKFLOW1_TRACKING.md`, `docs/docs_data/SESSION_RECAP.md`

- 2026-03-14 - ASSETFORMS1 complété — Lots 3–6 implémentés (suite de la session précédente)
	- **Lot 3 — EntityEffectFormEditor + EffectsBlockEditor** (commit `09000c4`)
		- `EffectsBlockEditor.tsx` extrait de `InteractionFormPanel.tsx` — réutilisable par les deux contextes
		- `extraStringKeys` prop ajoutée (EntityBottomTint, EntityTopTint, ScreenEffect, ModelVFXId, PlayerSoundEventId)
		- `EntityEffectFormEditor.tsx` créé : Duration/Infinite/Debuff, OverlapBehavior (select), DamageCalculatorCooldown, StatusEffectIcon, DeathMessageKey, ApplicationEffects & DamageEffects via EffectsBlockEditor, DamageCalculator/StatModifiers JSON
		- Branché dans `AssetSidePanel` switch `entity-effect`
	- **Lot 4 — BlockType dans ItemFormEditor** (commit `4c5ea8d`)
		- Section collapsible `▸ Block Type` visible uniquement si `json.BlockType` existe
		- Champs structurés : Material (select), DrawType, Group, BlockSoundSetId, BlockParticleSetId, Gathering/Flags/Textures (JSON)
		- Extra keys (CustomModel, Bench, State…) en catch-all JSON dans la section
	- **Lot 5 — ProjectileFormEditor** (commit `5c4fa33`)
		- `ProjectileFormEditor.tsx` créé : Appearance + booleans, Physics (MuzzleVelocity, TerminalVelocity, Gravity…), Shape optionnel (Radius/Height), Aim, Damage, Audio (Hit/Miss/Death sound), Particles (SystemId inline), Extra catch-all
		- Branché dans `AssetSidePanel` switch `projectile`
	- **Lot 6 — NPCRoleFormEditor** (commit `c5c2fb4`)
		- `NPCRoleFormEditor.tsx` créé : Type=Variant → Reference + Modify k/v editor + Parameters k/v editor ; autres types → message fallback vers JSON tab
		- Branché dans `AssetSidePanel` switch `npc-role`
	- `ASSETFORMS1_TRACKING.md` : tous lots marqués `done`
	- Build final : `npm run build` → ✅ (536 modules, 0 erreur TS)
- 2026-03-14 - Clôture complète de `STABILSTAGE2` — Lots 4 et 5 terminés
	- **Lot 4 — Frontend qualité et performance** : tous les 7 items terminés
		- `4.1` `.tmp/` ajouté au `.gitignore`
		- `4.2` `openapi-typescript` + script `npm run codegen` dans `package.json`
		- `4.3` Monaco Editor lazy-chargé dans `AssetSidePanel.tsx` (2 usages, `<Suspense>`)
		- `4.4` `activeWorkspaceId` → `sessionStorage` dans `http.ts`
		- `4.5` Guard `MAX_DAGRE_NODES = 200` dans `layoutDagre.ts`, warning UI dans les 3 vues graphe
		- `4.6` `formStyles.ts` créé — styles centralisés pour `InteractionFormPanel` et `interactionFormTypeSections`
		- `4.7` `WorkspaceContext.tsx` créé — `App.tsx` refactorisé en `AppShell` + `WorkspaceProvider`, `HomePage.tsx` 9 props → 2 props
	- **Lot 5 — Tests et couverture** : tous les 2 items terminés
		- `5.1` 7 fichiers de tests migrés de `unittest` → `pytest` (script `scripts/convert_tests.py`), `pytest.ini` créé, `requirements.txt` mis à jour
		- `5.2` `backend/tests/test_routes.py` créé (4 tests : health, open valid, open 422, projects 404)
	- **Vérification finale** : `python -m pytest -v` → **41 passed**, `npm run build` → OK (528 modules)
- 2026-03-13 - Cloture complete et archivage de `INTERACTIONEDITOR1`
	- `INTERACTIONEDITOR1.md`
		- ajout d'une section de cloture finale declarant le chantier termine
	- `INTERACTIONEDITOR1_TRACKING.md`
		- le lot 2 est aligne en `done`, ce qui cloture tout le chantier au niveau tracker
	- `archived_task/`
		- archivage du plan et du tracker `INTERACTIONEDITOR1`
	- verification:
		- le tracker ne contient plus de lot restant en cours pour `INTERACTIONEDITOR1`
- 2026-03-13 - Cloture du lot 5 de `INTERACTIONEDITOR1`
	- `frontend/scripts/interactionContractFixtures.ts`
		- creation d'un mini corpus de fixtures representatif pour `Parallel`, `Wielding`, `Projectile`, `Selector`, `Charging`, `Replace`
	- `frontend/scripts/interaction-contract.test.ts`
		- le test contractuel frontend boucle maintenant sur ce corpus partage au lieu de cas inline disperses
		- il verifie la preservation des branches semantiques et des champs inconnus sur l'export/save
	- `backend/tests/test_interaction_tree_service.py`
		- ajout de couverture `Charging` et `Replace` pour completer la passe load/import sur le meme spectre de types critiques
	- `INTERACTIONEDITOR1_TRACKING.md`
		- le lot 5 passe en `done`
	- verification:
		- `python -m unittest backend.tests.test_interaction_tree_service` → OK
		- `npm --prefix frontend run test:interaction-contract` → OK
- 2026-03-13 - Cloture du lot 4 de `INTERACTIONEDITOR1`
	- `frontend/src/components/graph/interactionSchemas.ts`
		- ajout des schemas manquants documentes: `TeleportInstance`, `TeleportConfigInstance`, `OpenContainer`, `OpenProcessingBench`, `Explode`, `SpawnPrefab`, `SpawnDrops`, `UseEntity`, `UseCoop`, `ResetCooldown`
		- `MovementCondition`, deja ajoute plus tot, complete desormais la couverture des types documentes initialement absents
	- `frontend/src/components/graph/colors.ts`
		- ajout de couleurs dediees pour les nouveaux types afin d'eviter une palette trop grise dans l'UI
	- `INTERACTIONEDITOR1_TRACKING.md`
		- le lot 4 passe en `done`
	- verification:
		- `npm --prefix frontend run build` → OK
- 2026-03-13 - Cloture du lot 3 de `INTERACTIONEDITOR1`
	- `INTERACTIONEDITOR1_TRACKING.md`
		- le lot 3 (`3.1`, `3.2`, `3.3`) est maintenant cloture en `done`
		- la verification restante de `3.3` a ete levee: `InteractionFormPanel.tsx` ne garde plus que le wiring generique et appelle le registre type-aware extrait dans `interactionFormTypeSections.tsx`
	- stabilisation finale associee:
		- correction du parseur backend pour eviter les doublons d'edges sur `Charging.Next`
	- verification:
		- `npm --prefix frontend run build` → OK
		- `python -m unittest backend.tests.test_interaction_tree_service` → OK
- 2026-03-13 - Fix des doublons d'edges sur `Charging.Next`
	- `backend/core/interaction_tree_service.py`
		- `collect_relation_refs(...)` ne rescane plus les conteneurs relationnels generiques avant de descendre dans leurs enfants; cela evitait de reconstruire deux fois les memes edges sortants pour des noeuds inline dans des structures `dict-time` comme `Charging.Next`
		- ajout d'une deduplication defensive sur `(from, to, type)` lors de la collecte des edges
	- `backend/tests/test_interaction_tree_service.py`
		- ajout d'un test de non-regression couvrant un `Charging` avec plusieurs paliers inline ayant eux-memes `Next` / `Failed`
	- verification:
		- `python -m unittest backend.tests.test_interaction_tree_service` → OK
- 2026-03-13 - Demarrage du lot 3.3 de `INTERACTIONEDITOR1`
	- `frontend/src/components/editor/interactionFormTypeSections.tsx`
		- nouveau module dedie au registre type-aware et a ses helpers locaux (`NestedObjectSection`, `ItemStackEditor`, `ReplaceDefaultValueEditor`, etc.)
		- les sections specialisees par type (`Selector`, `Charging`, `DamageEntity`, `ModifyInventory`, `ChangeStat*`, `StatsCondition*`, `EffectCondition`, `MovementCondition`, `Condition`) n'encombrent plus le panel principal
	- `frontend/src/components/editor/InteractionFormPanel.tsx`
		- le panel principal est recentre sur le wiring: onglets, rendu schema generique, `DictTimeEditor`, `ExtraFields`, apply/save
		- l'ajout d'un nouveau type-aware editor devient localise dans le module extrait au lieu d'imposer de retravailler tout le fichier principal
- 2026-03-13 - Cloture du lot 1 de `INTERACTIONEDITOR1`
	- le lot 1 est maintenant termine: parser backend, UI graphe et export frontend preservent le contrat semantique principal (`ForkInteractions`, `BlockedInteractions`, `CollisionNext`, `GroundNext`, `HitBlock`, `HitEntity`, `HitNothing`)
	- ajout d'un test contractuel frontend executable via `npm --prefix frontend run test:interaction-contract`
	- ce test couvre l'export semantique de `Parallel`, `Wielding`, `Projectile`, `Selector`, et verifie aussi la preservation des champs inconnus non derives des edges
	- la couverture backend `backend.tests.test_interaction_tree_service` a ete etendue a `Wielding.BlockedInteractions`
	- validations de cloture lot 1:
		- `python -m unittest backend.tests.test_interaction_tree_service`
		- `npm --prefix frontend run test:interaction-contract`
		- `npm --prefix frontend run build`
	- limite explicitement maintenue hors-scope du lot 1: `HitEntityRules`
- 2026-03-13 - Demarrage du lot 3 avec `Charging`
	- `frontend/src/components/graph/interactionSchemas.ts`
		- le schema `Charging` expose maintenant aussi `Failed`, `FailOnDamage`, `Delay`, `MouseSensitivityAdjustmentTarget`, `MouseSensitivityAdjustmentDuration`
	- `frontend/src/components/editor/InteractionFormPanel.tsx`
		- ajout d'une section dediee `Charging Behavior` pour les flags et reglages observes dans les assets/doc Hytale
		- `Charging.Next` reste edite comme dict-time, mais chaque entree peut maintenant etre basculee entre reference serveur et objet inline JSON
		- cela retire un point de friction majeur: les paliers inline ne sont plus simplement visibles, ils deviennent editables sans passer par `Raw JSON`
	- verification:
		- `npm --prefix frontend run build` → OK
- 2026-03-13 - `Replace` devient type-aware
	- `frontend/src/components/graph/interactionSchemas.ts`
		- le schema `Replace` expose maintenant `Next`, ce qui aligne le frontend avec les usages observes dans la doc/legacy
	- `frontend/src/components/editor/InteractionFormPanel.tsx`
		- ajout d'un bloc dedie `Replace Behavior` pour `Var`, `DefaultOk` et `Next`
		- ajout d'un editeur `DefaultValue` capable de travailler soit en mode container `{ Interactions: [...] }`, soit en mode objet JSON brut
		- le cas frequent `DefaultValue.Interactions` n'est donc plus un simple blob opaque
	- verification:
		- `npm --prefix frontend run build` → OK
- 2026-03-13 - `Wielding` devient type-aware
	- `frontend/src/components/graph/interactionSchemas.ts`
		- le schema `Wielding` couvre maintenant les champs observes en pratique: `RunTime`, `HorizontalSpeedMultiplier`, `CancelOnOtherClick`, `FailOnDamage`, `BlockedEffects`, `DamageModifiers`, `AngledWielding`, `StaminaCost`, `Forks`, `Failed`
		- `Failed` est maintenant declare comme branche semantique du graphe, en plus de `Next` et `BlockedInteractions`
	- `frontend/src/components/editor/InteractionFormPanel.tsx`
		- ajout d'un bloc dedie `Wielding Behavior` pour les reglages de garde/parade
		- ajout de sections guidees pour `StaminaCost` et `AngledWielding`
		- `DamageModifiers` et `BlockedEffects` sont maintenant exposes explicitement dans la partie defense
	- verification:
		- `npm --prefix frontend run build` → OK
- 2026-03-13 - `Chaining` devient type-aware
	- `frontend/src/components/editor/InteractionFormPanel.tsx`
		- ajout d'un bloc dedie `Chaining Behavior` pour `ChainId` et `ChainingAllowance`
		- ajout d'un editeur structure pour `Next`, avec ordre explicite et bascule reference serveur / objet inline
		- ajout d'un editeur structure pour `Flags`, afin d'editer les finishers/branches lies a `ChainFlag` sans repasser par un blob JSON
	- cela couvre mieux les cas reels `FirstClick` / combos conditionnels documentes dans `114_Interaction_Type_Chaining.md`
	- verification:
		- `npm --prefix frontend run build` → OK
- 2026-03-13 - `Selector` avance devient type-aware
	- `frontend/src/components/graph/interactionSchemas.ts`
		- le schema `Selector` expose maintenant `FailOn`, `Failed` et `HitEntityRules` en plus des branches deja presentes
	- `frontend/src/components/editor/InteractionFormPanel.tsx`
		- ajout d'un bloc `Selector Behavior` pour `RunTime`, `FailOn`, `Next`, `Failed`
		- ajout d'editeurs structures pour `HitEntity`, `HitBlock`, `HitNothing` via leurs containers `{ Interactions: [...] }`
		- ajout d'un editeur `HitEntityRules` avec `Matchers` + `Next`, tout en gardant ce sous-contrat hors du mapping semantique graphe/import/export
	- verification:
		- `npm --prefix frontend run build` → OK
- 2026-03-13 - Stabilisation du pattern du form panel (`INTERACTIONEDITOR1` 2.3)
	- extraction des editeurs structures reutilisables dans `frontend/src/components/editor/interactionFormStructuredEditors.tsx`
	- le pattern commun liste / map / container / hit rules n'est plus duplique inline dans `InteractionFormPanel.tsx`
	- `InteractionFormPanel.tsx` reste le point de registre type-aware, mais sa responsabilite est reduite aux sections et au wiring
	- verification:
		- `npm --prefix frontend run build` → OK
- 2026-03-13 - `DamageEntity` devient type-aware
	- `frontend/src/components/editor/InteractionFormPanel.tsx`
		- ajout d'un bloc dedie `Damage Entity` pour `Parent` et `Effects`
		- ajout d'un bloc `Damage Calculator` pour `Type`, `Class`, `RandomPercentageModifier` et un editeur structure de `BaseDamage`
		- ajout d'un bloc `Damage Effects` pour les sons, `WorldParticles` et `Knockback`
		- ajout d'un editeur guide `EntityStatsOnHit`
		- preservation explicite des champs inconnus dans `DamageCalculator`, `DamageEffects` et `Knockback` via des zones JSON annexes
	- `frontend/src/components/graph/interactionSchemas.ts`
		- descriptions du schema `DamageEntity` precisees pour mieux refleter les sous-objets reellement supportes
	- verification:
		- `npm --prefix frontend run build` → OK
- 2026-03-13 - `ModifyInventory` devient type-aware
	- `frontend/src/components/graph/interactionSchemas.ts`
		- le schema `ModifyInventory` abandonne les faux champs generiques `Items` / `Mode` et expose les cles reelles observees dans les assets: `AdjustHeldItemQuantity`, `AdjustHeldItemDurability`, `ItemToRemove`, `ItemToAdd`, `BrokenItem`, `NotifyOnBreak`, `NotifyOnBreakMessage`, `Next`, `Failed`
		- `Failed` est maintenant declare comme branche semantique du graphe pour ce type
	- `frontend/src/components/editor/interactionFormStructuredEditors.tsx`
		- `InteractionValueEditor` est exporte pour reutilisation locale sur les branches ref/inline uniques
	- `frontend/src/components/editor/InteractionFormPanel.tsx`
		- ajout d'un bloc dedie `Modify Inventory` pour les ajustements de stack/durabilite et les options de break
		- ajout d'editeurs guides `Item To Remove` et `Item To Add` avec preservation des champs inconnus eventuels
		- `Next` et `Failed` sont maintenant editables comme ref serveur ou objet inline, ce qui colle aux usages reels des assets Hytale
	- verification:
		- `npm --prefix frontend run build` → OK
- 2026-03-13 - `ChangeStat` et `ChangeStatWithModifier` deviennent type-aware
	- `frontend/src/components/graph/interactionSchemas.ts`
		- `ChangeStat` expose maintenant `ValueType`, `RunTime`, `Effects` et `Failed` en plus de `Behaviour`, `StatModifiers` et `Next`
		- `ChangeStatWithModifier` remplace le faux champ `Behaviour` par les champs reels `InteractionModifierId` et `ValueType`, tout en gardant `StatModifiers` et `Next`
	- `frontend/src/components/editor/InteractionFormPanel.tsx`
		- ajout d'un editeur structure commun pour `StatModifiers`
		- `ChangeStat` dispose maintenant d'un bloc dedie avec `Behaviour`, `ValueType`, `RunTime`, `Effects`, puis de sections ref/inline pour `Next` et `Failed`
		- `ChangeStatWithModifier` dispose d'un bloc dedie avec `InteractionModifierId`, `ValueType`, `StatModifiers` et `Next`
	- verification:
		- `npm --prefix frontend run build` → OK
- 2026-03-13 - `StatsCondition` devient type-aware
	- `frontend/src/components/graph/interactionSchemas.ts`
		- `StatsCondition` expose maintenant `ValueType`, `LessThan`, `Lenient`, `RunTime` et `Effects` en plus de `Costs`, `Next`, `Failed`
		- `StatsConditionWithModifier` expose maintenant explicitement `InteractionModifierId` et un vrai `Costs` de type dictionnaire numerique
	- `frontend/src/components/editor/InteractionFormPanel.tsx`
		- ajout d'un editeur structure commun pour `Costs`
		- `StatsCondition` dispose maintenant d'un bloc dedie pour les options de comparaison, puis de sections ref/inline pour `Next` et `Failed`
		- `StatsConditionWithModifier` reutilise le meme pattern avec `InteractionModifierId`
	- verification:
		- `npm --prefix frontend run build` → OK
- 2026-03-13 - `EffectCondition` devient type-aware
	- `frontend/src/components/graph/interactionSchemas.ts`
		- `EffectCondition` abandonne le faux schema `EffectId` / `Invert` et expose maintenant les champs reels `Entity`, `EntityEffectIds`, `Match`, `Next`, `Failed`
	- `frontend/src/components/editor/InteractionFormPanel.tsx`
		- ajout d'un bloc dedie `Effect Condition` pour `Entity` et `Match`
		- ajout d'un editeur structure pour la liste `EntityEffectIds`
		- `Next` et `Failed` sont maintenant editables comme ref serveur ou objet inline
	- verification:
		- `npm --prefix frontend run build` → OK
- 2026-03-13 - `MovementCondition` devient type-aware
	- `frontend/src/components/graph/interactionSchemas.ts`
		- ajout du schema `MovementCondition` avec les branches directionnelles reelles `ForwardLeft`, `Forward`, `ForwardRight`, `Left`, `Right`, `BackLeft`, `Back`, `BackRight`, ainsi qu'un `Failed` optionnel
	- `frontend/src/components/editor/InteractionFormPanel.tsx`
		- ajout d'un bloc dedie `Directional Branches` avec edition ref serveur / objet inline pour chaque direction de mouvement
		- ajout d'une section `Failed` pour le fallback optionnel
	- verification:
		- `npm --prefix frontend run build` → OK
- 2026-03-13 - Cloture du lot 3.2 de `INTERACTIONEDITOR1`
	- la passe gameplay / combat / inventory est maintenant terminee pour les types vises: `DamageEntity`, `ModifyInventory`, `ChangeStat`, `ChangeStatWithModifier`, `StatsCondition`, `EffectCondition`, `MovementCondition`
	- tous ces sous-editeurs ont ete valides par `npm --prefix frontend run build` au fil de l'eau
	- le prochain choix de pilotage n'est plus un type restant du lot 3.2, mais soit une cloture plus large du lot 3, soit le passage au lot 4, soit une passe de non-regression du lot 5
- 2026-03-13 - Fix du graphe d'interactions pour les containers anonymes dans les listes relationnelles
	- `backend/core/interaction_tree_service.py`
		- le parseur de l'arbre d'interactions traverse maintenant correctement les wrappers anonymes du type `{ Interactions: [...] }` lorsqu'ils apparaissent a l'interieur de listes relationnelles comme `Parallel.Interactions`
		- cela evite de creer des noeuds inline orphelins dans l'editeur pour certains assets reels, notamment des signatures d'armes avec `Selector` / `Replace` imbriques dans des containers sans champ `Type`
	- `backend/tests/test_interaction_tree_service.py`
		- ajout d'un test de non-regression couvrant un `Parallel` dont les enfants sont encapsules dans des containers anonymes
	- verification:
		- `python -m unittest backend.tests.test_interaction_tree_service` → OK
# 📋 Session Recap — Hytale Asset Studio

- 2026-03-14 - `Replace` expose maintenant `DefaultValue` comme vraie branche du graphe
	- assets vanilla verifies:
		- les usages observes de `Replace` passent majoritairement par `DefaultValue.Interactions`
		- ce container melange des refs serveur et des interactions inline selon les cas
	- `backend/core/interaction_tree_service.py`
		- le parseur suit maintenant `Replace.DefaultValue` et emet des edges `replace`
	- `frontend/src/components/graph/interactionSchemas.ts`
		- `Replace` declare maintenant `DefaultValue` comme branche sortante `replace`
	- `frontend/src/components/graph/InteractionNode.tsx`
		- ajout du handle visuel `replace` et detection via `rawFields.DefaultValue`
	- `frontend/src/components/graph/interactionExport.ts`
		- l'export reconstruit `DefaultValue.Interactions` a partir des edges `replace`, tout en preservant les extras du container
	- `frontend/src/components/editor/interactionFormTypeSections.tsx`
		- le form `Replace` edite maintenant `DefaultValue` en mode guide `None` / `Interactions Container` / `Raw Object`
		- le mode container utilise une vraie liste de valeurs ref/inline au lieu d'un textarea JSON brut
	- verification:
		- `python -m unittest backend.tests.test_interaction_tree_service -v` → OK
		- `npm --prefix frontend run test:interaction-contract` → OK
		- `npm --prefix frontend run build` → OK

- 2026-03-14 - Le graphe d'interactions affiche maintenant les refs externes comme noeuds `_ref`
	- `backend/core/interaction_tree_service.py`
		- les refs serveur externes detectees dans l'arbre (`Next`, `Failed`, `Interactions`, etc.) sont maintenant publiees avec `type: "_ref"` et `rawFields.ServerId`
		- cela aligne le contrat backend avec le schema frontend deja present pour les placeholders de reference externe
	- `backend/tests/test_interaction_tree_service.py`
		- ajout d'un test de non-regression couvrant une interaction qui pointe par `Next` vers un asset externe resolu depuis un autre layer
	- verification:
		- `python -m unittest backend.tests.test_interaction_tree_service -v` → OK
		- `npm --prefix frontend run build` → OK

# 📋 Session Recap — Hytale Asset Studio

## 2026-03-12 — Etat + plan + tracker pour le chantier Interaction Editor

**Contexte** : le chantier d'amelioration de l'editeur d'interactions devient suffisamment large pour necessiter un cadrage dedie, separe du simple fil de conversation.

**Fait** :
- creation de `INTERACTIONEDITOR1.md`
	- etat factuel de l'editeur actuel
	- ecarts critiques sur la fidelite graphe/import/export
	- plan de travail par lots
- creation de `INTERACTIONEDITOR1_TRACKING.md`
	- tracker pre-rempli avec l'avancement actuel
	- `Condition` et `Selector` deja notes comme premiere vague type-aware terminee

**Constats formalises** :
- le backend parse deja plus de branches semantiques que le frontend d'edition n'en preserve actuellement
- l'export frontend rabat encore trop de branches sur `Interactions`
- la couverture schema reste partielle par rapport a la liste de types Hytale documentee

**Decision** : le prochain chantier prioritaire sur l'editeur d'interactions doit commencer par la fidelite du contrat graphe/import/export, avant d'etendre massivement les widgets de formulaire type-aware.

**Complement 1.1** :
- la cartographie precise des branches semantiques a preserver a ete formalisee dans `INTERACTIONEDITOR1.md`
- elle montre noir sur blanc quels chemins sont aujourd'hui preserves (`Next`, `Failed`, `Interactions`) et lesquels sont encore ecrases (`ForkInteractions`, `BlockedInteractions`, `CollisionNext`, `GroundNext`, `StartInteraction`, `CancelInteraction`, `HitBlock`, `HitEntity`, `HitNothing`)
- le set minimal d'edge types recommande pour la phase suivante a ete fige dans le plan/tracker

**Avancee 1.2** :
- `frontend/src/components/graph/InteractionNode.tsx`
	- ajout de handles semantiques conditionnels en fonction du type d'interaction / schema
- `frontend/src/views/project/InteractionTreeEditor.tsx`
	- le graphe d'edition preserve maintenant des edge types UI distincts (`fork`, `blocked`, `collisionNext`, `groundNext`, `start`, `cancel`, `hitBlock`, `hitEntity`, `hitNothing`) au lieu de tout rabatre systematiquement sur `child`
- `frontend/src/components/graph/interactionSchemas.ts`
	- alignement des `outgoingEdges` connus pour `Parallel`, `Wielding`, `Projectile`, `Selector`
- `frontend/src/components/graph/colors.ts`
	- ajout des couleurs manquantes pour ces branches

**Verification** :
- `npm --prefix frontend run build` → OK

**Limite restante** :
- cette avancee rend l'UI capable d'editer ces branches distinctement, mais le parser backend et l'export frontend ne les reconstituent pas encore tous correctement au reload/save; c'est le coeur de la suite 1.3.

**Cloture 1.3** :
- `backend/core/interaction_tree_service.py`
	- mapping des relations Hytale aligne sur des edge types distincts: `fork`, `blocked`, `collisionNext`, `groundNext`, `start`, `cancel`, `hitBlock`, `hitEntity`, `hitNothing`
- `frontend/src/components/graph/interactionExport.ts`
	- reconstruction semantique des cles JSON Hytale:
	  - `ForkInteractions`
	  - `BlockedInteractions`
	  - `CollisionNext`
	  - `GroundNext`
	  - `StartInteraction`
	  - `CancelInteraction`
	  - containers `HitBlock` / `HitEntity` / `HitNothing` avec `{ Interactions: [...] }`
- `backend/tests/test_interaction_tree_service.py`
	- ajout de couverture sur les edge types parses pour `Parallel`, `Projectile`, `Selector`

**Verification** :
- `python -m unittest backend.tests.test_interaction_tree_service` → OK
- `npm --prefix frontend run build` → OK

**Limite restante** :
- `HitEntityRules` reste hors du contrat sémantique courant et demandera un traitement dédié dans une suite de lot separée.

## 2026-03-12 — Premier jalon type-aware pour l'editeur d'interactions

**Contexte** : l'editeur d'interactions etait deja base sur `interactionSchemas.ts`, mais le rendu restait trop generique pour certains types qui portent des sous-objets structurants (`Condition`, `Selector`, etc.).

**Fait** :
- `frontend/src/components/editor/InteractionFormPanel.tsx`
	- ajout d'une couche de rendu specifique au `nodeType`, en plus du rendu schema-driven existant
	- ajout d'un bloc dedie pour `Condition` :
	  - edition guidee des shortcuts racine (`RequiredGameMode`, `Crouching`, `Jumping`, `Swimming`, `InWater`, `OnGround`)
	  - edition guidee du sous-objet optionnel `Condition` (`EntityType`, `Stat`, `Comparison`, `Value`, `GameMode`, etc.)
	- ajout d'un bloc dedie pour `Selector` :
	  - edition guidee du sous-objet `Selector` (`Id`, `Direction`, `TestLineOfSight`, distances, offsets, etc.)
	- les champs non pris en charge par ces sous-editeurs restent preserves via le schema generique + `Additional Fields`

**Verification** :
- `npm --prefix frontend run build` → OK

**Decision** : le chantier interaction editor doit maintenant avancer type par type, avec des sous-editeurs specialises la ou la forme JSON encode une structure metier specifique. `Condition` et `Selector` servent de premiere base pour cette direction.

## 2026-03-12 — AssetSidePanel supporte maintenant les ressources Common en preview

**Contexte** : certains noeuds `common:*` du graphe etaient encore traites comme "pas de server JSON", ce qui empechait d'inspecter visuellement les images, les sons et les fichiers de modele/animation depuis le panneau lateral.

**Fait** :
- `frontend/src/api/http.ts`, `frontend/src/api/hasApi.ts`
	- ajout d'un helper de fetch brut avec les headers workspace existants
	- ajout d'accesseurs frontend pour `/resource`
- `frontend/src/components/editor/AssetSidePanel.tsx`
	- ajout d'un mode `preview` pour les ressources `common:*`
	- preview image pour les formats image (`.png`, etc.)
	- lecteur audio pour `.ogg` et autres types audio reconnus
	- fallback texte read-only pour les formats JSON-like/textuels (`.blockymodel`, `.blockyanim`, `.animation`, `.material`, `.particle`, `.effect`, `.prefab`, etc.)
	- fallback binaire avec bouton `Open raw` si aucun preview n'est supporte
- `frontend/src/views/project/ProjectGraphEditor.tsx`, `frontend/src/views/project/ProjectModifiedGraphView.tsx`
	- suppression du faux message d'erreur "Common resource (no server JSON)" pour laisser le panneau charger la preview
- `frontend/src/views/project/ProjectModifiedAssetsView.tsx`
	- un clic sur une ressource `Common` ouvre maintenant le meme panneau lateral au lieu d'un nouvel onglet brut

**Verification** :
- lecture d'assets vanilla locaux: les fichiers `.blockyanim` observes sont bien des JSON textuels
- `npm --prefix frontend run build` → OK

**Decision** : l'edition reste reservee aux `Server/*.json`, mais le panneau lateral devient maintenant un inspecteur generique utile pour les noeuds `Common` les plus frequents.

## 2026-03-12 — STABILPERF1 formalise a partir des mesures reelles

**Contexte** : les traces perf backend/frontend ont enfin confirme la nature du ralentissement dans `ProjectModifiedGraphView`.

**Constats** :
- `/modified` est le point chaud principal au cold start, autour de ~28.5s
- le temps est presque entierement absorbe par `vfs.list_files` sur les layers readonly inferieurs
- `graph.modified` reste faible; le graphe n'est donc pas la cause principale
- `index.ensure` reste un cout secondaire notable sur `/graph-modified`, `/graph` et `/asset`
- le frontend a un cout reel sur les gros graphes, mais il est secondaire par rapport au backend froid

**Fait** :
- creation de `STABILPERF1.md` pour formaliser le diagnostic, les objectifs et l'ordre d'execution
- creation de `STABILPERF1_TRACKING.md` pour suivre l'execution du plan

**Decision** : l'ordre retenu est:
- d'abord supprimer le rescannage massif de `/modified`
- ensuite reduire les recalculs `index.ensure`
- ensuite seulement traiter les couts frontend sur gros graphes

## 2026-03-12 — STABILPERF1 Lot 1 demarre: classification des modifications branchee sur l'index

**Objectif** : retirer le rescannage complet des layers readonly dans la collecte des fichiers modifies.

**Fait** :
- `backend/core/state.py`
	- `ProjectIndexState` porte maintenant les presences `lower_layer_vfs_paths` et `lower_layer_server_ids`
- `backend/core/index_service.py`
	- l'index calcule ces metadonnees lors du rebuild, au lieu de laisser `modification_service` rescanner les mounts
	- le schema de cache d'index est incremente pour invalider les anciens caches qui n'ont pas ces champs
- `backend/core/modification_service.py`
	- `collect_project_modifications(...)` reutilise maintenant l'index pour classer `new` vs `override`
- `backend/core/graph_service.py`
	- la vue graphe modifiee reinjecte l'index deja resolu dans `collect_project_modifications(...)` pour eviter un second passage separé
- `backend/tests/test_index_service.py`, `backend/tests/test_asset_service.py`
	- ajout de couverture sur les metadonnees lower-layer et sur la classification `Common/*`

**Verification** :
- `python -m unittest backend.tests.test_asset_service backend.tests.test_index_service` → 12 tests OK
- `python -m unittest discover -s backend/tests -p "test_*.py"` → 26 tests OK

**Reste** : mesurer l'effet reel avant/apres sur `/modified` et `ProjectModifiedGraphView`, puis decider si un verrou/memoisation suplementaire est necessaire pour les premiers appels paralleles.

## 2026-03-12 — STABILPERF1 Lot 1 valide par mesures: fin du goulet `/modified`

**Contexte** : apres branchement de la classification des modifications sur l'index, il fallait verifier le gain reel sur les scenarios utilisateur de `ProjectModifiedGraphView`.

**Resultats** :
- `/modified` passe d'environ ~28.5s au premier appel a ~266.64ms backend
- `/modified` a chaud tombe autour de ~26.43ms backend
- `/graph-modified?depth=1` passe d'environ ~28.5s a ~286.42ms backend au premier appel, puis ~38.39ms a chaud
- `graph.modified` reste faible; le nouveau cout dominant devient `index.ensure` et son fingerprint/cache load

**Decision** : le lot 1 a atteint son objectif principal. Le prochain chantier prioritaire devient la reduction des recalculs `index.ensure` du lot 2.

## 2026-03-12 — STABILPERF1 Lot 2 demarre: suppression des `ensure_index(...)` redondants

**Objectif** : retirer les doubles validations d'index visibles dans les traces `graph` et `graph-modified`.

**Fait** :
- `backend/routes/index_graph.py`
	- suppression des appels `ensure_index(...)` juste avant `build_focus_graph(...)` et `build_modified_graph(...)`, puisque ces services l'assurent deja eux-memes
- `backend/core/asset_service.py`
	- reutilisation du meme index pour `resolve_server_json(...)` dans les chemins lecture/copy afin d'eviter un second `ensure_index(...)` inutile

**Verification** :
- `python -m unittest discover -s backend/tests -p "test_*.py"` → 26 tests OK

**Fait en plus** :
- `backend/core/index_service.py`
	- ajout d'un helper pour mettre a jour l'index memoire apres ecriture d'un `Server/*.json`
- `backend/core/asset_service.py`
	- les writes `override` / `copy` n'executent plus `rebuild_project_index(...)` synchrone
	- ils mettent a jour l'index memoire de facon incrementale pour eviter un rebuild massif sur la lecture suivante

**Verification** :
- `python -m unittest backend.tests.test_asset_service backend.tests.test_index_service` → 13 tests OK
- `python -m unittest discover -s backend/tests -p "test_*.py"` → 27 tests OK

**Resultat final** :
- les traces montrent maintenant `count=1` sur `index.ensure` dans les routes critiques mesurees
- `PUT /asset` reste court (ex: ~42.19ms backend) sans `index.rebuild` massif
- juste apres ecriture, `GET /modified` reste autour de ~30ms backend et `GET /graph-modified?depth=4` autour de ~70ms backend

**Decision** : le lot 2 est considere atteint. Le point chaud residuel principal devient le frontend sur gros graphes (`layout`, `toFlow`, `paint`), qui correspond au lot 3.

## 2026-03-12 — STABILPERF1 Lot 3 demarre: premiers gains sur `toFlow` et layout Dagre

**Objectif** : reduire le cout frontend sur les gros graphes modifies sans perdre d'information visuelle.

**Fait** :
- `frontend/src/views/project/ProjectModifiedGraphView.tsx`
	- `toFlow(...)` n'effectue plus de recherche lineaire `rawNodes.find(...)` pour chaque edge
	- une map `nodeById` est construite une fois puis reutilisee pour remplir `outgoing`
- `frontend/src/components/graph/layoutDagre.ts`
	- ajout d'un cache LRU de positions Dagre base sur la topologie du graphe, la direction et la hauteur des noeuds
	- un graphe identique peut maintenant reutiliser directement ses positions sans recalcul complet de layout
- `frontend/src/components/graph/BlueprintNode.tsx`
	- memoisation du rendu des noeuds avec comparateur custom pour limiter les rerenders React inutiles

**Verification** :
- `npm --prefix frontend run build` → OK

**Resultats** :
- sur reloads de graphes identiques, `graph.layout_dagre` tombe maintenant a ~0.00-0.10ms et `graph.modified_to_flow` a ~0.20-0.50ms
- la navigation locale dans `ProjectModifiedGraphView` est ressentie comme beaucoup plus fluide
- le cout residuel principal devient le paint navigateur sur gros graphes, encore autour de ~470ms a ~570ms sur `depth=4`

**Decision** : le lot 3 est juge tres positif et probablement suffisant pour ce cycle `STABILPERF1`. Aller plus loin demanderait un chantier plus intrusif sur la densite DOM/UX des cartes de noeud plutot qu'une simple optimisation technique locale.

## 2026-03-12 — Instrumentation opt-in pour l'audit de performance

**Contexte** : avant de lancer un futur plan `STABILPERF1`, il faut mesurer concretement les couts backend/frontend sans appauvrir l'UX ni changer prematurement l'architecture.

**Fait** :
- `backend/app/main.py`
	- ajout d'un middleware opt-in active par `HAS_PERF_AUDIT=1`
	- chaque reponse expose `X-HAS-Perf-Id`, `X-HAS-Perf-Total-Ms` et `Server-Timing`
- `backend/core/perf.py`
	- nouveau helper centralisant l'agregation des spans backend par requete
- `backend/core/index_service.py`, `backend/core/vfs.py`, `backend/core/graph_service.py`
	- instrumentation des zones critiques index/VFS/graphe
- `frontend/src/perf/audit.ts`
	- nouveau helper opt-in active via `?perfAudit=1` ou `localStorage.hasPerfAudit = '1'`
- `frontend/src/api/http.ts`, `frontend/src/components/graph/layoutDagre.ts`, `frontend/src/views/project/ProjectGraphEditor.tsx`, `frontend/src/views/project/ProjectModifiedGraphView.tsx`
	- instrumentation des fetchs, transformations graphe, layout et paint
- `docs/docs_data/PERF_AUDIT.md`
	- mode d'emploi des mesures et scenarios de benchmark

**Verification** :
- `python -m compileall backend` → OK
- `python -m unittest discover -s backend/tests -p "test_*.py"` → 24 tests OK
- `npm --prefix frontend run build` → build OK

**Decision** : l'instrumentation reste totalement desactivee par defaut. Elle sert uniquement a produire un diagnostic factuel avant toute decision de simplification, de cache supplementaire ou de refonte transport/layout.

## 2026-03-12 — Fallback frontend si le backend live ne renvoie pas encore `modificationKind`

**Contexte** : sur `ProjectModifiedGraphView`, certains serveurs backend deja lances continuaient a renvoyer `modificationKind = null` sur `/modified` et `/graph-modified`, ce qui faisait afficher `OVERRIDE` partout dans la liste et `LOCAL` dans les noeuds du graphe.

**Fait** :
- `frontend/src/views/project/ProjectModifiedGraphView.tsx`
	- ajout d'un fallback `resolveEntryModificationKind(...)` base sur `isNew` quand `modificationKind` est absent
	- reinjection du `modificationKind` sur les noeuds du graphe par correspondance `vfsPath -> modificationKind` a partir de la liste `/modified`
	- resultat: l'UI continue de distinguer correctement `NEW` vs `OVERRIDE` meme si le backend en cours d'execution est une version plus ancienne

**Verification** :
- `npm --prefix frontend run build` → build OK

**Note** : le code backend du repo renvoie deja correctement `modificationKind`; ce fallback protege surtout contre un `uvicorn` stale qui n'a pas encore ete relance.

## 2026-03-12 — `override` vs `new` recales sur l'ID serveur des layers inferieurs

**Objectif** : faire correspondre la distinction visible dans la liste et le graphe a la vraie semantique metier demandee.

**Decision** :
- pour les `server-json`, un fichier du projet actif est maintenant `override` si un asset avec le **meme ID serveur** existe deja dans un layer inferieur, meme si le chemin differe
- un fichier `server-json` est `new` seulement si cet ID n'existe que dans le projet actif
- pour les ressources `Common/*`, la logique reste basee sur le chemin, car il n'y a pas d'ID serveur equivalent

**Fait** :
- `backend/core/modification_service.py`
	- nouveau service centralisant la collecte des fichiers projet modifies et leur classification `new` vs `override`
- `backend/routes/assets.py`
	- la liste `/modified` reutilise maintenant cette classification partagee
- `backend/core/graph_service.py`
	- `build_modified_graph(...)` reutilise la meme logique pour les roots modifies du graphe
- `backend/tests/test_asset_service.py`
	- ajout d'un test qui valide qu'un fichier projet avec le meme ID qu'un asset vanilla reste classe `override` meme si son chemin est different

**Verification** :
- `python -m unittest discover -s backend/tests -p "test_*.py"` → 24 tests OK
- `npm --prefix frontend run build` → build OK

## 2026-03-11 — Refresh de ProjectModifiedGraphView apres save/copy + cache readonly VFS

**Objectif** : faire en sorte que `ProjectModifiedGraphView` se mette a jour immediatement apres un `save` ou `save as/copy`, tout en evitant de rescanner inutilement les layers read-only a chaque ecriture projet.

**Fait** :
- `frontend/src/components/editor/AssetSidePanel.tsx`
	- `onRefresh` accepte maintenant un `nextSelectedNodeId`
	- apres `override`, la vue se recharge explicitement sur le noeud courant
	- apres `copy`, la vue se recharge en selectionnant directement la nouvelle entree via `server-path:<resolvedPath>`
- `frontend/src/views/project/ProjectModifiedGraphView.tsx`
	- ajout d'un callback `handleAssetRefresh(...)` qui resynchronise liste + graphe et met a jour la selection active
	- `ModifiedGraphView` se recharge donc immediatement apres creation/copy depuis le panneau d'edition
- `backend/core/vfs.py`
	- ajout d'un cache de `list_files()` pour les mounts `vanilla` et `dependency`
	- le cache est invalide si la signature du source readonly change (zip mtime/size, ou stats des repertoires `Common/`, `Server/`, `manifest.json` pour les dossiers)
	- consequence: un rebuild d'index apres ecriture projet ne rescanne plus completement les gros layers readonly a chaque fois

**Verification** :
- `python -m unittest discover -s backend/tests -p "test_*.py"` → 23 tests OK
- `npm --prefix frontend run build` → build OK

**Decision** : le projet actif reste pleinement dynamique, mais les layers readonly sont maintenant traites comme persistants et caches tant que leur signature n'a pas change.

## 2026-03-11 — ProjectModifiedGraphView garde les copies orphelines et distingue new/copy vs override

**Objectif** : corriger la vue des assets modifies pour que les copies non referencees restent visibles dans le graphe et que l'UI distingue les roots `new/copy` des roots `override`.

**Fait** :
- `backend/core/graph_service.py`
	- `build_modified_graph(...)` ne seed plus la BFS par `server_id` mais par chemin VFS `Server/...json`
	- les roots modifies sont maintenant preserves meme s'ils ne sont references par aucun autre noeud
	- ajout d'un `modificationKind` (`new` ou `override`) sur les noeuds racines modifies
	- `modifiedIds` renvoie les IDs reels des roots (avec `server-path:*` si necessaire)
- `backend/core/models.py`
	- le modele `GraphNode` documente maintenant `isModifiedRoot` et `modificationKind`
- `backend/tests/test_asset_service.py`
	- test qu'une copie non referencee apparait bien dans `build_modified_graph`
	- test que les roots modifies sont etiquetes `new` vs `override`
- `frontend/src/api/types.ts`
	- le type `GraphNode` accepte `isModifiedRoot` et `modificationKind`
- `frontend/src/components/graph/BlueprintNode.tsx`
	- badge explicite `NEW/COPY` ou `OVERRIDE` au lieu de tout afficher comme override
- `frontend/src/views/project/ProjectModifiedGraphView.tsx`
	- la vue utilise `isModifiedRoot`/`modificationKind`
	- support de l'expansion des noeuds `server-path:*`
	- compteur distinct `new/copy` vs `override` dans le panneau

**Verification** :
- `python -m unittest discover -s backend/tests -p "test_*.py"` → 22 tests OK
- `npm --prefix frontend run build` → build OK

**Note** : la distinction faite ici est volontairement `new/copy` vs `override`. Le Studio ne preserve pas encore une provenance fine permettant de distinguer de facon certaine un asset cree de zero d'un asset issu d'un `Save as`.

## 2026-03-11 — Liste des fichiers projet dans ProjectModifiedGraphView

**Objectif** : garantir qu'un fichier du projet actif reste visible et editable meme s'il n'apparait pas dans le graphe des noeuds modifies.

**Fait** :
- `backend/routes/assets.py`
	- l'endpoint `/projects/{projectId}/modified` renvoie maintenant toujours un `assetKey` resolvable pour les `server-json` via `server-path:<vfsPath>`
	- ajout de `modificationKind` (`new` ou `override`) sur les entrees modifiees
- `backend/core/models.py`
	- `ModifiedAssetEntry` porte maintenant `modificationKind`
- `backend/tests/test_asset_service.py`
	- test que la liste des fichiers modifies expose bien les `server-path:*` et la distinction `new` vs `override`
- `frontend/src/views/project/ProjectModifiedGraphView.tsx`
	- chargement parallele du graphe modifie et de la liste `/modified`
	- ajout d'une section `Project files` dans le panneau de gauche
	- un fichier projet non visible dans le graphe peut maintenant etre selectionne depuis cette liste puis edite dans `AssetSidePanel`
- `frontend/src/api/types.ts`
	- alignement du type `ModifiedAssetEntry`

**Verification** :
- `python -m unittest discover -s backend/tests -p "test_*.py"` → 23 tests OK
- `npm --prefix frontend run build` → build OK

**Decision** : la vue graphe reste une visualisation des relations. La liste `Project files` joue le role de filet de securite pour tous les fichiers du projet actif qui n'ont pas encore d'ancrage dans le graphe.

## 2026-03-11 — Cloture technique de STABILSTAGE1

**Objectif** : fermer les derniers reliquats techniques du plan de stabilisation avant changement de sujet.

**Fait** :
- `backend/tests/test_collision_resolution.py`
	- ajout d'un test qui verifie qu'une ouverture `server:<id>` ambiguë renvoie une erreur structuree `ID_AMBIGUOUS` avec les chemins candidats
- `backend/tests/test_asset_service.py`
	- ajout d'un test qui verifie qu'un `override` met a jour l'index effectif immediatement et bascule l'origine en `project`
- `STABILSTAGE1_TRACKING.md`
	- cloture des tests restants backend
	- lot 3 marque termine cote technique
	- avertissement bundle explicitement reporte avec justification

**Verification** :
- `python -m unittest discover -s backend/tests -p "test_*.py"` → 20 tests OK
- `npm --prefix frontend run build` → build OK, warning chunk >500 kB confirme

**Decision** :
- l'optimisation bundle est reportee hors STABILSTAGE1
- raison: warning connu, probablement tire en partie par Monaco charge dans le panneau editeur, mais non bloquant pour la stabilisation fonctionnelle

**Reste** :
- une verification UX manuelle des erreurs visibles reste souhaitable, mais il n'y a plus de reliquat technique backend bloquant sur ce stage

## 2026-03-11 — Projets invalides visibles dans l'accueil

**Objectif** : ne plus cacher les projets invalides dans la liste du workspace, mais les afficher avec un statut degrade non ouvrable.

**Fait** :
- `backend/core/models.py`
	- `ProjectInfo` expose maintenant `status` (`ready|invalid`) et `errorMessage`
- `backend/core/workspace_service.py`
	- `list_projects(...)` parse les configs valides via `ProjectConfig`
	- en cas de config invalide, retourne une entree `invalid` au lieu de la cacher
	- deduplication qui prefere une entree `ready` a une entree `invalid` si collision d'identifiant
- `backend/tests/test_workspace_service.py`
	- test que la liste de projets inclut bien une entree invalide avec statut et message
- `frontend/src/api/types.ts`
	- alignement du type `ProjectInfo`
- `frontend/src/views/HomePage.tsx`
	- affichage des projets invalides comme cartes desactivees avec badge `INVALID` et message d'erreur
- `frontend/src/App.css`
	- style degrade pour les cartes invalides

**Verification** :
- `python -m unittest discover -s backend/tests -p "test_*.py"`
- `npm --prefix frontend run build`

**Note** : les projets invalides restent volontairement non ouvrables ; l'objectif est la visibilite et le diagnostic, pas l'ouverture d'un etat casse.

## 2026-03-11 — Typage frontend des graphes renforce

**Objectif** : supprimer les `as any` fragiles dans les zones critiques des vues graphe et stabiliser le contrat de donnees des noeuds.

**Fait** :
- `frontend/src/components/graph/blueprintTypes.ts`
	- nouveau module partage pour `BlueprintNodeData`, `OutgoingDep` et helpers de navigation
- `frontend/src/components/graph/BlueprintNode.tsx`
	- reutilise le type partage au lieu de redefinir localement les structures
- `frontend/src/components/graph/layoutDagre.ts`
	- layout genericise pour conserver le type exact des noeuds React Flow
- `frontend/src/views/project/ProjectGraphEditor.tsx`
	- `Node<BlueprintNodeData>` utilise dans les zones de navigation/selection
	- suppression des `as any` pour l'ouverture de l'editeur d'interactions
- `frontend/src/views/project/ProjectModifiedGraphView.tsx`
	- meme durcissement de typage sur la navigation et l'ouverture des interactions

**Verification** :
- recherche frontend sur `as any`
- `npm --prefix frontend run build`

**Note** : ce passage cible les zones critiques liees aux graphes blueprint ; d'autres composants frontend pourront etre raffines plus tard si besoin.

## 2026-03-11 — Normalisation de la serialisation Pydantic

**Objectif** : eliminer les derniers appels directs a `.dict()` et garder un seul chemin de serialisation compatible Pydantic v1/v2.

**Fait** :
- `backend/core/workspace_service.py`
	- remplacement de `defaults_model.dict()` par `model_dump(defaults_model)`
- `backend/routes/projects.py`
	- remplacement du `ProjectManifest(...).dict()` par `model_dump(...)`

**Verification** :
- recherche globale backend sur `.dict()`
- `python -m compileall backend`
- `python -m unittest discover -s backend/tests -p "test_*.py"`

## 2026-03-11 — Erreurs utiles visibles (passe partielle)

**Objectif** : supprimer les silences les plus nuisibles cote backend et frontend, sans encore refondre toute l'UX d'erreur.

**Fait** :
- `backend/core/project_service.py`
	- les configs projet invalides sautees lors de la recherche d'un projet sont maintenant logguees via `uvicorn.error`
- `frontend/src/App.tsx`
	- l'echec de refresh de la liste projet apres creation n'est plus silencieux
- `frontend/src/views/project/ProjectModifiedGraphView.tsx`
	- les echecs de refresh du graphe modifie et d'expansion d'un noeud remontent maintenant dans l'etat d'erreur UI
	- un echec d'expansion ne marque plus le noeud comme deja developpe, ce qui permet de retenter

**Verification** :
- `python -m compileall backend`
- `python -m unittest discover -s backend/tests -p "test_*.py"`
- `npm --prefix frontend run build`

**Reste a faire sur ce bloc** : si souhaite, exposer les projets invalides dans l'UI avec un statut degrade au lieu de simples logs backend.

## 2026-03-11 — Gestion explicite des collisions d'IDs + build frontend

**Objectif** : ne plus faire disparaitre les assets ambigus de la recherche et permettre une selection explicite par chemin.

**Fait** :
- `backend/routes/index_graph.py`
	- la recherche renvoie maintenant les IDs ambigus sous forme d'entrees distinctes par chemin candidat
	- ajout d'un etat `ambiguous` et des `candidatePaths` dans les resultats de recherche
- `backend/core/asset_service.py`
	- `resolve_server_json(...)` supporte maintenant `server-path:*` en plus de `server:*`
- `backend/core/graph_service.py`
	- `build_focus_graph(...)` accepte `server-path:*` comme racine explicite
	- les noeuds roots/ambigus peuvent etre identifies par chemin exact
- `backend/core/interaction_tree_service.py`
	- support de `server-path:*` pour charger une racine d'interaction explicite
- `frontend/src/api/types.ts`
	- enrichissement du type `SearchResult` avec `path`, `ambiguous`, `ambiguousId`, `candidatePaths`
- `frontend/src/views/project/ProjectGraphEditor.tsx`
	- affichage du chemin candidat et d'un badge `AMBIG` dans la liste de recherche
- `frontend/src/components/editor/AssetSidePanel.tsx`
	- edition autorisee aussi pour `server-path:*`
- `frontend/src/views/project/InteractionTreeEditor.tsx`
	- chargement des assets externes compatible avec `server-path:*`
- `backend/tests/test_collision_resolution.py`
	- test de recherche sur IDs ambigus
	- test de lecture asset via `server-path:*`
	- test de graphe avec racine `server-path:*`

**Verification** :
- `python -m compileall backend`
- `python -m unittest discover -s backend/tests -p "test_*.py"`
- `npm --prefix frontend run build`

**Limite restante** : la desambiguïsation explicite marche a l'entree utilisateur, mais les references ambiguës rencontrees pendant la traversée interne du graphe restent ignorees tant qu'aucun choix explicite n'est fourni.

## 2026-03-11 — Cache d'index plus fiable + tests backend

**Objectif** : eviter qu'un index memoire ou disque reste stale apres une modification des fichiers du projet.

**Fait** :
- `backend/core/state.py`
	- ajout de `PROJECT_INDEX_FINGERPRINT` pour suivre le fingerprint du cache memoire
- `backend/core/index_service.py`
	- fingerprint etendu avec une signature du contenu projet: `manifest.json`, `Common/**`, `Server/**`
	- invalidation du cache memoire si le fingerprint a change
	- invalidation du cache disque si le fingerprint ne correspond plus
	- conservation d'un compromis volontaire: la signature cible le projet actif, pas l'ensemble des gros packs externes
- `backend/tests/test_index_service.py`
	- test d'invalidation du cache memoire apres modification des fichiers projet
	- test d'invalidation du cache disque apres modification des fichiers projet

**Verification** :
- `python -m compileall backend`
- `python -m unittest discover -s backend/tests -p "test_*.py"`

**Limite restante** : le fingerprint ne suit pas finement les changements de vanilla/dependances lourdes pour eviter un cout de calcul trop eleve sur chaque lecture.

## 2026-03-11 — Preservation du manifest a l'import + tests backend

**Objectif** : ne plus perdre silencieusement les metadonnees du manifest lors d'un import de pack.

**Fait** :
- `backend/core/workspace_service.py`
	- ajout d'une normalisation explicite du manifest importe via `ProjectManifest`
	- si `manifest.json` existe et est valide, les champs connus sont preserves dans le projet cree
	- si `manifest.json` est invalide ou ne respecte pas le schema attendu, l'import echoue explicitement avec `MANIFEST_INVALID`
	- si le pack n'a pas de manifest, l'import garde le comportement de manifest minimal par defaut
- `backend/tests/test_import_pack.py`
	- test de preservation des champs principaux d'un manifest complet
	- test de rejet d'un manifest JSON invalide
	- test de fallback sans manifest

**Verification** :
- `python -m compileall backend`
- `python -m unittest discover -s backend/tests -p "test_*.py"`

**Limite restante** : seules les cles connues du modele `ProjectManifest` sont preservees ; les cles supplementaires non modelisees sont ignorees.

## 2026-03-11 — Save as securise contre les collisions + tests backend

**Objectif** : empecher `mode=copy` d'ecraser silencieusement un asset existant ou de creer une collision surprise.

**Fait** :
- `backend/core/asset_service.py`
	- `write_server_json_copy(...)` verifie maintenant l'index effectif avant ecriture
	- refus d'un `newId` deja present dans la VFS effective avec erreur `ID_CONFLICT`
	- refus d'un chemin cible deja existant avec erreur `PATH_CONFLICT`
- `backend/tests/test_asset_service.py`
	- test de copie reussie
	- test de rejet si `newId` existe deja dans le graphe effectif
	- test de rejet si le fichier cible existe deja dans le projet

**Verification** :
- `python -m compileall backend`
- `python -m unittest discover -s backend/tests -p "test_*.py"`

**Decision** : la politique est volontairement stricte ; une collision existante dans vanilla/dependances est refusee aussi pour eviter un `Save as` qui introduirait du shadowing implicite difficile a comprendre.

## 2026-03-11 — Export ZIP en whitelist pack-only + tests backend

**Objectif** : empecher l'export d'embarquer des fichiers internes studio ou hors format pack.

**Fait** :
- `backend/core/export_service.py`
	- remplacement de la logique blacklist par une whitelist explicite
	- export limite a `manifest.json`, `Common/**` et `Server/**`
	- exclusion implicite des fichiers internes type `.studio_cache`, `has.project.json`, fichiers debug hors whitelist
- `backend/tests/test_export_service.py`
	- test d'echec sans manifest valide
	- test de whitelist avec exclusion des fichiers studio
	- test de retention exclusive des chemins pack autorises

**Verification** :
- `python -m compileall backend`
- `python -m unittest discover -s backend/tests -p "test_*.py"`

**Limite restante** : si le format pack distribue doit inclure a l'avenir d'autres fichiers racine legitimes, ils devront etre ajoutes explicitement a la whitelist.

## 2026-03-11 — Creation de projet atomique + tests backend

**Objectif** : empecher toute creation partielle ou ecrasement lors d'un `create_project`.

**Fait** :
- `backend/core/workspace_service.py`
	- prevalidation du `targetDir` avant ecriture
	- refus d'un dossier cible deja occupe par des elements reserves du projet
	- rollback minimal des chemins crees si une ecriture echoue en cours de creation
	- remplacement du `cfg.dict()` local par `model_dump(cfg)` dans ce flux
- `backend/tests/test_workspace_service.py`
	- test de creation reussie
	- test de conflit sans ecrasement
	- test de rollback sur echec d'ecriture

**Verification** :
- `python -m compileall backend`
- `python -m unittest discover -s backend/tests -p "test_*.py"`

**Limite restante** : si les dossiers parents du `targetDir` n'existent pas, ils peuvent etre crees avant l'ecriture du projet lui-meme ; en revanche aucun contenu projet partiel n'est conserve apres echec.

## 2026-03-11 — Workspace backend reel via contexte API

**Objectif** : ne plus ignorer le workspace ouvert par l'utilisateur sur les routes backend.

**Fait** :
- `backend/core/state.py` — ajout d'un registre memoire `workspaceId -> rootPath`
- `backend/core/workspace_service.py` — enregistrement du workspace a l'ouverture + helper de resolution `resolve_workspace_root(...)`
- `backend/routes/workspace.py` — listing des projets base sur le `workspaceId` resolu
- `backend/routes/projects.py` — create/import utilisent le vrai workspace ; routes projet resolvent `X-HAS-Workspace-Id`
- `backend/routes/index_graph.py` — graph/search/rebuild resolvent `X-HAS-Workspace-Id`
- `backend/routes/assets.py` — asset/modified/resource resolvent `X-HAS-Workspace-Id`
- `backend/routes/interactions.py` + `backend/core/interaction_tree_service.py` — interaction tree resolu sur le bon workspace
- `frontend/src/api/http.ts` — propagation automatique du header `X-HAS-Workspace-Id`
- `frontend/src/api/hasApi.ts` — `workspaceOpen()` enregistre le workspace actif pour les appels suivants

**Verification** :
- `python -m compileall backend`
- `npm --prefix frontend run build`

**Limite restante** : le registre workspace est en memoire ; apres redemarrage backend, le frontend doit re-ouvrir le workspace pour rehydrater le contexte.

## 2026-06-XX — Manifest editor dans ProjectConfigView

**Objectif** : export ZIP avec un manifest Hytale complet (9 champs + Authors).

**Fait** :
- `backend/core/models.py` — ajout `ProjectManifestAuthor`, `ProjectManifest`, `ManifestPutRequest`
- `backend/core/workspace_service.py` — `create_project` écrit un manifest complet par défaut (9 champs)
- `backend/routes/projects.py` — `GET /projects/{id}/manifest` + `PUT /projects/{id}/manifest`
- `backend/core/export_service.py` — validation `Version` ajoutée à `_validate_manifest`
- `frontend/src/api/types.ts` — types `ProjectManifestAuthor` + `ProjectManifest`
- `frontend/src/api/hasApi.ts` — `projectGetManifest` + `projectPutManifest`
- `frontend/src/views/ProjectConfigView.tsx` — section Manifest (Group, Name, Version, Description, Website, ServerVersion, IncludesAssetPack, DisabledByDefault, Authors avec add/remove)

**Commit** : `57fc287`

---

## 2026-03-XX — App shell redesign (home → project workflow)

**Objectif** : refondre le design global de l'app (accueil → projet) pour qu'il soit cohérent avec la qualité des éditeurs.

**Fait** :

### Fichiers modifiés / créés
- `frontend/src/index.css` — suppression du `display: flex; place-items: center` sur `body` qui centrait verticalement toute l'app
- `frontend/src/App.css` — remplacement complet du CSS Vite par un thème dark studio complet : top bar, breadcrumb, tool tiles, project cards, classes `.btn`, `.card`, `.config-grid`, `.layer-card`, `.workspace-section`, `.studio-input`
- `frontend/src/views/HomePage.tsx` — nouveau fichier : carte workspace (input + bouton Open) + grille de cartes projet (`.project-card` avec hover)
- `frontend/src/App.tsx` — réécriture : AppShell avec top bar sticky (logo "H", titre, breadcrumb workspace→projet, nav tabs Config/Items/Interactions/Modified/← Projects) ; les vues full-screen (`graph-items`, `graph-interactions`) bypass le shell entièrement
- `frontend/src/views/ProjectConfigView.tsx` — suppression des boutons de nav (maintenant dans la top bar) ; ajout grille de tool tiles en haut (Items Graph, Interactions, Modified) ; classes CSS `.config-grid`, `.layer-card`, `.btn`

**Commit** : `4d43489`

---

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

---

## 2026-03-10 — Blueprint Interaction Editor (MVP complet)

**Objectif** : transformer la vue Interactions en éditeur blueprint complet (création/édition/connexion/save).

**Fait** :

### Nouveaux fichiers
- `frontend/src/components/graph/interactionSchemas.ts` — schémas de champs pour les 35 types d'interaction (7 catégories : control-flow, entity-action, condition, block-action, projectile, inventory, ui). Chaque schéma définit `fields[]` et `outgoingEdges` (JSON key → edge type).
- `frontend/src/components/graph/interactionExport.ts` — algorithme de reconstruction JSON Hytale depuis le graphe ReactFlow. Gère : arêtes `next`/`failed`/`child`, nœuds externes (→ chaîne), nœuds inline (→ objet), cycles (protection via ancestors set).
- `frontend/src/components/editor/InteractionPalette.tsx` — palette de types d'interaction organisée par catégorie, collapsible, avec drag-start (MIME `application/interaction-type`). Simple flex widget (pas de position absolute).
- `frontend/src/components/editor/InteractionFormPanel.tsx` — panneau form structuré par type. 2 onglets : Form (champs connus) + Raw JSON (textarea éditable). Bouton Apply (activé quand dirty). Gère tous les FieldType : string, number, boolean, string-ref, effects (ItemAnimationId/WorldSoundEventId/LocalSoundEventId/CameraEffect/Trails), object/dict-time/dict-stat-number/array-ref (JSON textarea).

### Fichier modifié
- `frontend/src/views/project/InteractionTreeEditor.tsx` — réécriture complète :
  - Wrappé dans `ReactFlowProvider` → `InteractionTreeEditorInner` utilise `useReactFlow()` pour `screenToFlowPosition`
  - Mode edit (`editMode` toggle) : affiche palette, active `nodesConnectable`, `onConnect`, `onNodesDelete`, `onEdgesDelete`, `deleteKeyCode="Delete"`
  - Drag from palette → `onDrop` crée un nœud `internal:new_*` avec rawFields = `{ Type }` au bon endroit dans le flow
  - `onConnect` : lit le `sourceHandle` pour déterminer l'edge type (next/failed/child) et crée l'arête colorée
  - `handleNodeApply` : met à jour rawFields + nodeType + label depuis le form panel
  - `handleSaveTree` : appelle `exportInteractionTree` + `hasApi.assetPut` avec mode override
  - Panneau droit : `AssetSidePanel` pour nœuds externes, `InteractionFormPanel` pour nœuds inline

**Schéma de données du graphe éditable** :
- Nœud externe : `{ id: "server:X", data: { label, nodeType: "External", isExternal: true } }` → exporté comme string `"X"`
- Nœud inline : `{ id: "internal:*", data: { label, nodeType: "Simple", isExternal: false, rawFields: {...} } }` → exporté comme objet

**Pattern export** : DFS depuis treeRootRef ; edges "next" → `result.Next`; "failed" → `result.Failed`; "child" → `result.Interactions[]`.

**Prochain** : tester sur un asset vanilla, éventuellement ajouter un ID picker pour sauvegarder un nœud inline comme nouvel asset serveur indépendant.
