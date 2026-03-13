# INTERACTIONEDITOR1 - Tracker d'execution

Document de suivi pour executer le plan `INTERACTIONEDITOR1.md`.

## Legende

- `todo`: non commence
- `in-progress`: en cours
- `blocked`: bloque par une decision ou un contrat incomplet
- `done`: termine et verifie

## Tableau de bord

### Lot 1 - Fidelite du contrat graphe/import/export

- Statut global: `done`
- Objectif: ne plus perdre la semantique des branches Hytale lors de l'edition graphe.

#### 1.1 Cartographier les branches semantiques a preserver

- Statut: `done`
- Priorite: P0
- Fichiers cibles:
  - `backend/core/interaction_tree_service.py`
  - `frontend/src/components/graph/InteractionNode.tsx`
  - `frontend/src/components/graph/interactionExport.ts`
- Constats verifies:
  - le backend parse deja `ForkInteractions`, `BlockedInteractions`, `CollisionNext`, `GroundNext`, `StartInteraction`, `CancelInteraction`, `HitBlock`, `HitEntity`, `HitNothing`
  - le frontend d'edition n'expose aujourd'hui que `next`, `failed`, `child`
  - l'export rabat encore les branches `child` sur `Interactions`
- Sortie concrete produite:
  - [x] matrice explicite `cle JSON -> parser backend -> UI actuelle -> export actuel -> edge type cible`
  - [x] set minimal recommande pour 1.2: `next`, `failed`, `child`, `fork`, `blocked`, `collisionNext`, `groundNext`, `start`, `cancel`, `hitBlock`, `hitEntity`, `hitNothing`
- Questions ouvertes documentees:
  - `HitEntityRules` n'est pas encore integre au contrat parser/UI/export actuel
  - `Charging.Next` reste un cas hybride a traiter explicitement dans la phase suivante

#### 1.2 Etendre les handles et les edge types du graphe

- Statut: `done`
- Priorite: P0
- Taches:
  - [x] definir le set minimal d'edge types a supporter dans l'UI
  - [x] etendre `InteractionNode.tsx` avec les handles necessaires
  - [x] adapter `InteractionTreeEditor.tsx` pour creer/afficher ces edges
- Validation:
  - [x] `npm --prefix frontend run build`
- Notes:
  - `InteractionNode.tsx` rend maintenant des handles conditionnels bases sur les `outgoingEdges` du schema
  - `InteractionTreeEditor.tsx` preserve maintenant `sourceHandle -> edgeType` pour `fork`, `blocked`, `collisionNext`, `groundNext`, `start`, `cancel`, `hitBlock`, `hitEntity`, `hitNothing`
  - `interactionSchemas.ts` a ete aligne pour les cas deja connus (`Parallel`, `Wielding`, `Projectile`, `Selector`)
  - limite restante: au reload, certaines branches restent encore parsees comme `child` ou `next` cote backend tant que 1.3 n'est pas traite

#### 1.3 Corriger l'export semantique

- Statut: `done`
- Priorite: P0
- Taches:
  - [x] rehydrater `ForkInteractions`
  - [x] rehydrater `BlockedInteractions`
  - [x] rehydrater `CollisionNext` / `GroundNext`
  - [x] traiter les containers `Selector` (`HitBlock`, `HitEntity`, `HitNothing`)
- Validation:
  - [x] `python -m unittest backend.tests.test_interaction_tree_service`
  - [x] `npm --prefix frontend run build`
  - [x] `npm --prefix frontend run test:interaction-contract`
- Notes:
  - `backend/core/interaction_tree_service.py` emet maintenant des edge types semantiques (`fork`, `blocked`, `collisionNext`, `groundNext`, `start`, `cancel`, `hitBlock`, `hitEntity`, `hitNothing`)
  - `frontend/src/components/graph/interactionExport.ts` reconstruit maintenant les cles Hytale dediees au lieu de rabattre ces branches sur `Interactions` / `Next`
  - couverture backend ajoutee pour `Parallel`, `Projectile`, `Selector`, `Wielding`
  - un test contractuel frontend verifie maintenant l'export semantique pour `Parallel`, `Wielding`, `Projectile`, `Selector`, ainsi que la preservation des champs inconnus non derives des edges
  - limite restante connue: `HitEntityRules` n'entre pas encore dans ce contrat parser/export et reste hors-scope de ce lot

### Lot 2 - Architecture type-aware du form panel

- Statut global: `done`
- Objectif: rendre l'extension de l'editeur par type simple et locale.

#### 2.1 Poser la structure de renderers specialises

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/components/editor/InteractionFormPanel.tsx`
- Validation:
  - [x] ajout d'un point d'extension type-aware dans le form panel
  - [x] preservation du rendu schema generique et des `Additional Fields`

#### 2.2 Premiere vague de sous-editeurs specialises

- Statut: `done`
- Priorite: P1
- Types couverts:
  - [x] `Condition`
  - [x] `Selector` (configuration principale)
- Validation:
  - [x] `npm --prefix frontend run build`

#### 2.3 Stabiliser le pattern pour les prochains types

- Statut: `done`
- Priorite: P1
- Taches:
  - [x] extraire proprement les composants de sections specialisees si le fichier grossit trop
  - [x] definir un pattern commun pour sous-objets, listes, containers et dictionnaires
- Validation:
  - [x] `npm --prefix frontend run build`
- Notes:
  - les editeurs structures reutilisables (`InteractionListEditor`, `InteractionMapEditor`, `SelectorBranchEditor`, `HitEntityRulesEditor`) vivent maintenant dans `frontend/src/components/editor/interactionFormStructuredEditors.tsx`
  - `InteractionFormPanel.tsx` garde le registre type-aware, mais delegue les briques liste/map/container a un module partage

### Lot 3 - Types prioritaires a fort impact

- Statut global: `done`
- Objectif: traiter d'abord les types les plus frequents ou les plus structurants.

#### 3.1 Control flow complexes

- Statut: `done`
- Priorite: P1
- Taches:
  - [x] `Charging`
  - [x] `Replace`
  - [x] `Wielding`
  - [x] `Chaining`
  - [x] `Selector` avance (`HitBlock`, `HitEntity`, `HitNothing`, `HitEntityRules`)
- Validation:
  - [x] `npm --prefix frontend run build`
- Notes:
  - `interactionSchemas.ts` couvre maintenant les champs `Charging` observes en pratique (`Failed`, `FailOnDamage`, `Delay`, ajustements de sensibilite souris)
  - `InteractionFormPanel.tsx` fournit un bloc dedie "Charging Behavior"
  - `Charging.Next` reste edite comme time-dict, mais chaque palier peut maintenant basculer entre reference serveur et objet inline JSON sans repasser par l'onglet `Raw JSON`
  - `Replace` expose maintenant aussi `Next` comme branche semantique editable
  - `DefaultValue` peut maintenant etre edite comme container `Interactions` structure ou comme objet JSON brut selon le cas
  - `Wielding` expose maintenant `Failed` comme branche de graphe en plus de `Next` et `BlockedInteractions`
  - `InteractionFormPanel.tsx` ajoute des sections dediees pour `StaminaCost`, `AngledWielding`, `DamageModifiers`, `BlockedEffects` et les flags de guard/parry
  - `Chaining` dispose maintenant d'un editeur structure pour la liste `Next` et pour le dictionnaire `Flags`, avec bascule reference serveur / objet inline
  - `Selector` expose maintenant `FailOn` / `Failed` dans le form panel et propose des editeurs structures pour `HitBlock`, `HitEntity`, `HitNothing`
  - `HitEntityRules` est maintenant editable en formulaire, mais reste explicitement hors du contrat semantique parser/export du lot 1

#### 3.2 Gameplay / combat / inventory

- Statut: `done`
- Priorite: P2
- Taches:
  - [x] `DamageEntity`
  - [x] `ModifyInventory`
  - [x] `ChangeStat`
  - [x] `ChangeStatWithModifier`
  - [x] `StatsCondition`
  - [x] `EffectCondition`
  - [x] `MovementCondition`
- Notes:
  - `DamageEntity` dispose maintenant d'un sous-editeur guide pour `Parent`, `Effects`, `DamageCalculator`, `DamageEffects`, `Knockback` et `EntityStatsOnHit`
  - les cles inconnues de `DamageCalculator`, `DamageEffects` et `Knockback` restent preservables via des zones JSON dediees, pour eviter une regression sur les variantes Hytale moins frequentes
  - `ModifyInventory` est maintenant aligne sur les champs reels observes (`AdjustHeldItemQuantity`, `AdjustHeldItemDurability`, `ItemToRemove`, `ItemToAdd`, `BrokenItem`, `NotifyOnBreak`, `NotifyOnBreakMessage`, `Next`, `Failed`)
  - `ModifyInventory.Next` et `ModifyInventory.Failed` peuvent maintenant etre edites comme ref serveur ou objet inline, ce qui couvre les usages reels de consommation/ammo documentes
  - `ChangeStat` expose maintenant `ValueType`, `RunTime`, `Effects`, `Failed` et un vrai editeur de `StatModifiers`, ce qui couvre les usages courants de soins/couts/regen delay
  - `ChangeStatWithModifier` est maintenant aligne sur la doc reelle avec `InteractionModifierId`, `ValueType` et `StatModifiers`, au lieu du faux champ `Behaviour`
  - `StatsCondition` expose maintenant `ValueType`, `LessThan`, `Lenient`, `RunTime`, `Effects`, `Next` et `Failed`, avec un vrai editeur de `Costs`
  - `StatsConditionWithModifier` profite du meme pattern de couts et de branches, avec `InteractionModifierId` explicite
  - `EffectCondition` est maintenant aligne sur la forme reelle `EntityEffectIds` + `Match` + `Next` / `Failed`, au lieu du faux couple `EffectId` / `Invert`
  - `MovementCondition` expose maintenant les branches directionnelles reelles (`ForwardLeft`, `Left`, `Back`, etc.) et un `Failed` optionnel, avec edition ref/inline par direction
  - la passe 3.2 est maintenant completee et validee au build frontend apres chaque ajout majeur

#### 3.3 Decoupage de `InteractionFormPanel`

- Statut: `done`
- Priorite: P1
- Objectif: isoler le registre type-aware pour rendre le panel principal plus maintenable et simplifier l'ajout de nouveaux types.
- Taches:
  - [x] extraire le registre type-aware et ses helpers vers un module dedie
  - [x] reduire `InteractionFormPanel.tsx` au rendu generique, `dict-time`, extra fields et footer
  - [x] verifier que les ajouts de nouveaux types ne demandent plus de modifier le panel principal
- Validation:
  - [x] `npm --prefix frontend run build`
- Notes:
  - le nouveau module `frontend/src/components/editor/interactionFormTypeSections.tsx` porte maintenant les sections specialisees et leurs helpers UI locaux
  - `InteractionFormPanel.tsx` conserve le wiring principal (`draft`, rendu schema-driven, `DictTimeEditor`, `ExtraFields`, apply/save), ce qui reduit nettement la surface a relire pour chaque nouveau type
  - le point d'extension type-aware est maintenant concentre dans `renderTypeSpecificFields(...)`, ce qui permet d'ajouter un nouveau type sans reouvrir la logique principale du panel

### Lot 4 - Couverture des types Hytale manquants

- Statut global: `done`
- Objectif: rapprocher `interactionSchemas.ts` de la liste de reference Hytale.

#### 4.1 Ajouter les schemas manquants

- Statut: `done`
- Priorite: P2
- Taches:
  - [x] `MovementCondition`
  - [x] `TeleportInstance`
  - [x] `TeleportConfigInstance`
  - [x] `OpenContainer`
  - [x] `OpenProcessingBench`
  - [x] `Explode`
  - [x] `SpawnPrefab`
  - [x] `SpawnDrops`
  - [x] `UseEntity`
  - [x] `UseCoop`
  - [x] `ResetCooldown`
- Validation:
  - [x] `npm --prefix frontend run build`
- Notes:
  - `interactionSchemas.ts` couvre maintenant aussi les 10 types encore absents de la liste de reference Hytale, avec des champs minimaux derives de la documentation du repo
  - `MovementCondition`, deja traite precedemment, cloture de fait la derniere entree restante du tableau lot 4
  - la palette expose desormais ces types automatiquement via `INTERACTION_SCHEMAS`, sans ajout ad hoc supplementaire

### Lot 5 - Validation et non-regression

- Statut global: `done`
- Objectif: fiabiliser le chantier par fixtures et scenarios repetables.

#### 5.1 Fixtures de reference

- Statut: `done`
- Priorite: P1
- Taches:
  - [x] constituer un mini corpus d'interactions representatif
  - [x] couvrir au moins `Parallel`, `Wielding`, `Projectile`, `Selector`, `Charging`, `Replace`
- Validation:
  - [x] `npm --prefix frontend run test:interaction-contract`
- Notes:
  - le corpus vit dans `frontend/scripts/interactionContractFixtures.ts`
  - il couvre les branches critiques et la preservation de champs inconnus pour `Parallel`, `Wielding`, `Projectile`, `Selector`, `Charging`, `Replace`

#### 5.2 Verification export/import

- Statut: `done`
- Priorite: P1
- Taches:
  - [x] verifier load -> edit minime -> save sur branches semantiques critiques
  - [x] verifier qu'aucun champ inconnu n'est perdu si non touche par l'UI
- Validation:
  - [x] `python -m unittest backend.tests.test_interaction_tree_service`
  - [x] `npm --prefix frontend run test:interaction-contract`
- Notes:
  - la charge `load` est verrouillee cote backend par les tests parseur incluant `Parallel`, `Wielding`, `Projectile`, `Selector`, `Charging`, `Replace`
  - la charge `save` est verrouillee cote frontend par l'export contractuel sur le meme corpus, avec verification explicite des branches semantiques et des champs inconnus preservables

## Notes de pilotage

- Le premier risque majeur n'est pas l'absence de widgets elegants, mais la perte de structure semantique lors de l'export.
- Le prochain dev concret recommande est donc Lot 1 avant d'ouvrir trop de nouveaux types.
- Les types frequents du legacy (`Selector`, `Replace`, `Charging`, `ChangeStat`, `DamageEntity`, `ModifyInventory`) doivent rester les premiers candidats apres la correction du contrat graphe.

## Cloture

- Statut global du chantier: `done`
- Date de cloture: `2026-03-13`
- Decision: le plan et ce tracker passent en archive dans `archived_task/`
- Suite eventuelle: ouvrir un nouveau chantier dedie si un lot additionnel est necessaire, plutot que reouvrir `INTERACTIONEDITOR1`