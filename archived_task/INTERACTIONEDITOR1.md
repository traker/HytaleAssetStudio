# INTERACTIONEDITOR1 - Etat et plan d'evolution de l'editeur d'interactions

Objectif: faire evoluer l'editeur d'interactions d'un mode "schema generique + JSON" vers un editeur reellement pilote par le type d'interaction, tout en preservant fidelement la structure Hytale a l'import comme a l'export.

## Statut de cloture

- Statut global: `done`
- Date de cloture: `2026-03-13`
- Resultat: objectif atteint

Points actés a la cloture:
- le contrat graphe/import/export preserve maintenant les branches semantiques majeures visees par le chantier
- l'architecture type-aware du form panel est stabilisee et extraite dans des modules dedies
- les types prioritaires du chantier disposent de sous-editeurs exploitables sans retomber systematiquement sur du JSON brut
- la couverture schema documentee est alignee avec la liste Hytale suivie dans le repo
- une base de non-regression backend/frontend existe desormais pour les cas critiques

Archivage:
- ce document est a conserver comme trace de pilotage close dans `archived_task/INTERACTIONEDITOR1.md`
- le suivi d'execution associe est archive dans `archived_task/INTERACTIONEDITOR1_TRACKING.md`

## Etat actuel

### Ce qui existe deja

1. Vue graphe editable
- `frontend/src/views/project/InteractionTreeEditor.tsx`
- chargement du tree via `GET /interaction/tree`
- palette draggable de types d'interactions
- edition locale du graphe, ajout/suppression de noeuds, connexions, export puis save en override

2. Form panel deja present
- `frontend/src/components/editor/InteractionFormPanel.tsx`
- deux onglets: `Form` et `Raw JSON`
- rendu principal base sur `interactionSchemas.ts`
- preservation des champs inconnus via `Additional Fields`

3. Base de schemas deja utile
- `frontend/src/components/graph/interactionSchemas.ts`
- couverture actuelle de 36 types Hytale + `_ref` comme helper interne
- categories et labels deja relies a la palette et au form panel

4. Premiere couche type-aware deja demarree
- `Condition` a maintenant un bloc dedie pour les shortcuts racine + le sous-objet `Condition`
- `Selector` a maintenant un bloc dedie pour le sous-objet `Selector`

5. Backend tree parser deja exploitable
- `backend/core/interaction_tree_service.py`
- scan des objets inline avec `Type`
- extraction de relations `Next`, `Failed`, `Interactions`, `ForkInteractions`, `BlockedInteractions`, `CollisionNext`, `GroundNext`, `StartInteraction`, `CancelInteraction`, `HitBlock`, `HitEntity`, `HitNothing`

### Limites majeures observees

1. Le graphe d'edition ne preserve pas encore toutes les branches semantiques
- `InteractionNode.tsx` n'expose aujourd'hui que 3 handles source: `next`, `failed`, `child`
- `InteractionTreeEditor.tsx` ne cree des edges qu'avec ces 3 semantiques
- `interactionExport.ts` reconstruit `Next`, `Failed` et `Interactions`, mais ne rehydrate pas correctement:
  - `ForkInteractions`
  - `BlockedInteractions`
  - `HitBlock`
  - `HitEntity`
  - `HitNothing`
  - `CollisionNext`
  - `GroundNext`
  - `StartInteraction`
  - `CancelInteraction`

2. Les types complexes restent encore trop "JSON-first"
- `Replace`, `Charging`, `Wielding`, `Chaining`, `Selector` avance, `DamageEntity`, `ModifyInventory`, `ChangeStat*` ont encore des sous-structures metier peu guidees
- plusieurs sous-objets importants restent edites comme blobs JSON

3. Couverture schema alignee sur la liste documentee
- la doc `109_Interaction_Types_List.md` liste 47 types Hytale
- `interactionSchemas.ts` couvre maintenant cette liste documentee, plus `_ref` qui reste un helper Studio interne
- la limite residuelle n'est donc plus l'absence brute de schemas, mais le niveau de richesse/type-awareness de certains sous-editeurs

4. Les containers semantiques de `Selector` ne sont pas encore modelises comme branches de premier rang dans l'editeur
- `HitBlock`, `HitEntity`, `HitNothing`, `HitEntityRules` existent cote doc / backend
- le panel commence a structurer `Selector`, mais l'edition graphe/export de ces branches n'est pas encore fiable

5. Le pilotage produit doit suivre les vrais usages
- le legacy `INTERACTIONS_REPORT.md` montre que les types les plus frequents incluent notamment:
  - `Simple`
  - `Selector`
  - `Parallel`
  - `Replace`
  - `Serial`
  - `ChangeStat`
  - `DamageEntity`
  - `StatsCondition`
  - `Charging`
  - `Chaining`
  - `ModifyInventory`
- ces types doivent prioriser les prochains sous-editeurs specialises

## Contraintes de conception

1. Le Studio ne doit pas appauvrir le JSON Hytale
- tout champ non pris en charge par un sous-editeur doit rester preserve
- l'onglet `Raw JSON` reste indispensable comme soupape de securite

2. L'edition graphe doit rester semantiquement fidele
- une branche `HitBlock` ne doit pas etre re-exportee comme une simple `Interactions`
- une branche `ForkInteractions` ne doit pas etre fusionnee silencieusement avec `Interactions`

3. L'amelioration doit se faire par lots mesurables
- d'abord la fidelite du contrat graphe/import/export
- ensuite la qualite des sous-editeurs type-aware
- ensuite la couverture des types manquants

## Plan propose

### Lot 1 - Retablir le contrat semantique graphe/import/export

Objectif: faire en sorte que le graphe editable preserve correctement les branches Hytale importantes au lieu de les rabattre sur `child`.

Travail cible:
- `frontend/src/components/graph/InteractionNode.tsx`
  - ajouter les handles necessaires pour les branches semantiques majeures
- `frontend/src/views/project/InteractionTreeEditor.tsx`
  - permettre la creation et l'affichage d'edges semantiques distincts (`fork`, `blocked`, `collisionNext`, `groundNext`, `start`, `cancel`, `hitBlock`, `hitEntity`, `hitNothing` si retenus)
- `frontend/src/components/graph/interactionExport.ts`
  - re-exporter ces branches dans les bonnes cles JSON
- `backend/core/interaction_tree_service.py`
  - verifier l'alignement import -> graphe sur les memes branches

Criteres d'acceptation:
- un `Parallel` avec `ForkInteractions` reste un `ForkInteractions` apres load/edit/save
- un `Wielding` avec `BlockedInteractions` reste stable apres export
- un `Projectile` avec `CollisionNext` et `GroundNext` reste stable apres export
- un `Selector` ne perd pas ses containers de hit principaux

#### Cartographie 1.1 - matrice des branches semantiques

| Cle JSON Hytale | Parser backend actuel | UI graphe actuelle | Export actuel | Risque actuel | Edge type cible |
|---|---|---|---|---|---|
| `Next` | `next` | handle `next` | `Next` | faible | `next` |
| `Failed` | `failed` | handle `failed` | `Failed` | faible | `failed` |
| `Interactions` | `child` | handle `child` | `Interactions` | faible | `child` |
| `ForkInteractions` | `child` | handle `child` | re-exporte comme `Interactions` | perte de semantique | `fork` |
| `BlockedInteractions` | `child` | handle `child` | re-exporte comme `Interactions` | perte de semantique | `blocked` |
| `CollisionNext` | `next` | handle `next` | re-exporte comme `Next` | collision avec `Next` | `collisionNext` |
| `GroundNext` | `next` | handle `next` | re-exporte comme `Next` | collision avec `Next` | `groundNext` |
| `StartInteraction` | `child` | handle `child` | re-exporte comme `Interactions` | perte de semantique | `start` |
| `CancelInteraction` | `child` | handle `child` | re-exporte comme `Interactions` | perte de semantique | `cancel` |
| `HitBlock` | `child` via container `{ Interactions: [...] }` | handle `child` | re-exporte comme `Interactions` | perte du container selector | `hitBlock` |
| `HitEntity` | `child` via container `{ Interactions: [...] }` | handle `child` | re-exporte comme `Interactions` | perte du container selector | `hitEntity` |
| `HitNothing` | `child` via container `{ Interactions: [...] }` | handle `child` | re-exporte comme `Interactions` | perte du container selector | `hitNothing` |

Constats additionnels:
- `HitEntityRules` n'est pas encore modelise semantiquement dans `_REL_KEY_TO_EDGE_TYPE` cote backend; ce n'est donc pas juste un probleme d'UI/export, mais un trou de contrat plus profond.
- `Charging.Next` est un cas hybride: le backend le parse actuellement comme une suite de references internes/externe, mais l'export frontend le traite encore surtout comme un `Next` special preserve depuis `rawFields`.
- la palette et les couleurs frontend connaissent deja des types d'edges supplementaires (`fork`, `blocked`, `collisionNext`, `groundNext`), mais `InteractionNode.tsx` et `InteractionTreeEditor.tsx` ne les exposent pas encore vraiment comme contrat d'edition.

Set minimal recommande pour la phase 1.2:
- `next`
- `failed`
- `child`
- `fork`
- `blocked`
- `collisionNext`
- `groundNext`
- `start`
- `cancel`
- `hitBlock`
- `hitEntity`
- `hitNothing`

Decision de cadrage:
- `Interactions` reste la branche generique par defaut
- toute branche Hytale plus specifique doit avoir son propre edge type si elle a une cle JSON dediee et ne peut pas etre reconstituee sans ambiguite depuis `Interactions`

### Lot 2 - Generaliser l'architecture type-aware du form panel

Objectif: fournir une structure durable pour brancher des sous-editeurs par type, sans dupliquer tout le panel.

Travail cible:
- factoriser dans `InteractionFormPanel.tsx` un registre de renderers par type
- separer nettement:
  - champs schema generiques
  - sections specialisees par type
  - champs additionnels preserves
- documenter les types de sous-sections recurrentes: sous-objets config, dictionnaires, arrays references, containers de branches

Criteres d'acceptation:
- ajouter un nouveau sous-editeur type-specific doit devenir une operation locale et lisible
- aucun type existant ne doit perdre l'acces aux champs inconnus

### Lot 3 - Prioriser les types a fort impact reel

Objectif: traiter d'abord les types frequents ou structuralement complexes.

Priorite recommandees:

1. `Charging`
- structurer completement `Next` time-dict
- exposer `Failed`, `FailOnDamage`, sensibilite souris, hold flags

2. `Replace`
- editeur propre pour `Var`, `DefaultOk`, `DefaultValue`
- distinguer remplacement simple vs container d'interactions

3. `Wielding`
- exposer clairement `BlockedInteractions`
- lier proprement la branche bloquee au graphe

4. `Selector` avance
- editer `HitBlock`, `HitEntity`, `HitNothing`, `HitEntityRules`
- clarifier les containers d'interactions et leurs branches

5. `DamageEntity`
- sous-editeur pour `DamageCalculator`, `DamageEffects`, `EntityStatsOnHit`

6. `ModifyInventory` / `ChangeStat` / `ChangeStatWithModifier`
- remplacer les blobs JSON par des controles metier plus guides

### Lot 4 - Couvrir les types Hytale encore absents

Objectif: rapprocher la couverture schema du referentiel doc.

Etat: objectif atteint, les types documentes initialement absents ont ete ajoutes au schema frontend.

Criteres d'acceptation:
- chaque type absent dispose au minimum:
  - d'un schema
  - d'une entree palette
  - d'un rendu form exploitable
  - d'une preservation correcte a l'export

### Lot 5 - Validation et fixtures de non-regression

Objectif: arreter de raisonner uniquement "a l'oeil" sur l'editeur d'interactions.

Travail cible:
- construire un petit jeu de fixtures representatif des types critiques
- verifier les boucles load -> edit minime -> export
- ajouter des tests ou checks cibles pour l'export des branches semantiques

Etat: objectif atteint avec un corpus partage de fixtures frontend et une couverture backend/frontend complementaire sur `Parallel`, `Wielding`, `Projectile`, `Selector`, `Charging`, `Replace`.

Criteres d'acceptation:
- les regressions sur `ForkInteractions`, `BlockedInteractions`, `CollisionNext`, `GroundNext`, `Selector` sont detectables rapidement

## Ordre recommande

1. Lot 1 - fidelite graphe/import/export
2. Lot 2 - architecture type-aware durable
3. Lot 3 - types prioritaires a fort impact
4. Lot 4 - couverture des types manquants
5. Lot 5 - validation/fixures de non-regression

## Definition de succes de INTERACTIONEDITOR1

- l'editeur d'interactions n'ecrase plus les branches semantiques importantes en simple `Interactions`
- les types les plus frequents ont des sous-editeurs metier exploitables
- le nombre de types documentes sans schema baisse significativement
- le JSON Hytale reste preserve, meme quand l'UI ne connait pas encore tous les details

## Cloture

Le chantier `INTERACTIONEDITOR1` est considere termine.

Reste volontairement hors perimetre de cette cloture:
- `HitEntityRules` comme contrat semantique de premier rang parser/export
- des sous-editeurs encore plus riches pour certains types lot 4 actuellement couverts de maniere schema-driven

Ces suites potentielles relevent d'un nouveau chantier, pas d'une reouverture de ce plan.