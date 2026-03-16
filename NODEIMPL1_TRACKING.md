# NODEIMPL1 — Tracker d'exécution

Document de suivi pour exécuter le plan `NODEIMPL1.md`.

## Légende

- `todo` : non commencé
- `in-progress` : en cours
- `blocked` : bloqué (décision ou info manquante)
- `done` : terminé et validé

---

## Tableau de bord global

| Lot | Titre | Statut |
|---|---|---|
| **Lot 1** | Types fréquents — Items/Blocks/Stats | `done` |
| **Lot 2** | Audio | `done` |
| **Lot 3** | Gameplay / Commerce / IA | `done` |
| **Lot 4** | Types avancés | `done` |
| **Lot 5** | Display-only / Complexes | `done` |

---

## Lot 1 — Types fréquents dans le graphe Items

Statut global : `todo`

### 1.1 `drop-table` — DropTableFormEditor

- Statut : `done`
- Fichiers touchés :
  - `backend/core/graph_service.py` — ajout règle `/drops/` → `drop-table` dans `_group_for_server_path`
  - `frontend/src/components/graph/colors.ts` — couleur `drop-table`: `#FDCB6E`
  - `frontend/src/components/editor/assetTypeRegistry.ts` — aucun changement nécessaire (déjà présent)
  - `frontend/src/components/editor/DropTableFormEditor.tsx` — CRÉÉ
  - `frontend/src/components/editor/AssetSidePanel.tsx` — import + case ajoutés
- Validation : `npm run lint` + `npm run build` + test sur `Drop_Goblin_Scrapper.json`
- Notes : forme récursive (Multiple/Choice/Single). Nesting niveau-1 inline ; nesting profond → textarea JSON fallback.

### 1.2 `block` — BlockFormEditor

- Statut : `done`
- Fichiers touchés :
  - `backend/core/graph_service.py` — aucun changement (règle `/block/` déjà présente)
  - `frontend/src/components/graph/colors.ts` — aucun changement (`block: '#4ECDC4'` déjà présent)
  - `frontend/src/components/editor/assetTypeRegistry.ts` — ajout `'block'` dans l'union + règle `'BlockType' in json` avant item (étape 5.5)
  - `frontend/src/components/editor/BlockFormEditor.tsx` — CRÉÉ
  - `frontend/src/components/editor/AssetSidePanel.tsx` — import + case ajoutés
- Validation : `npm run lint` + `npm run build` + test sur `Rock_Stone.json`
- Notes : sections Identity / BlockType / Textures / Sound+Particles / Gathering / Aliases / ResourceTypes. Champs complexes (Flags, RandomTickProcedure, ConnectedBlockRuleSet) → textarea JSON fallback conditionnel.

### 1.3 `entity-stat` — EntityStatFormEditor

- Statut : `done`
- Fichiers touchés :
  - `backend/core/graph_service.py` — ajout règle `/entity/stats/` + `/entitystats/` → `entity-stat`
  - `frontend/src/components/graph/colors.ts` — couleur `entity-stat`: `#55EFC4`
  - `frontend/src/components/editor/assetTypeRegistry.ts` — ajout `'entity-stat'` dans l'union + règle `InitialValue+Min+Max` (étape 5.7, avant item)
  - `frontend/src/components/editor/EntityStatFormEditor.tsx` — CRÉÉ
  - `frontend/src/components/editor/AssetSidePanel.tsx` — import + case ajoutés
- Validation : `npm run lint` + `npm run build` + test sur `Health.json`
- Notes : sections Base Values (InitialValue/Min/Max/ResetType/Shared) / Regeneration (entrées avec Interval, Amount, RegenType, ClampAtZero, Conditions) / MinValueEffects / MaxValueEffects. Conditions simples inline ; effets interaction-seulement (strings) → CSV, sinon textarea JSON.

---

## Lot 2 — Audio

Statut global : `todo`

### 2.1 `sound-event` — SoundEventFormEditor

- Statut : `done`
- Fichiers touchés :
  - `backend/core/graph_service.py` — règle `/audio/soundevents/` + `/soundevents/` → `sound-event` (avant la règle générique `sound`)
  - `frontend/src/components/graph/colors.ts` — couleur `sound-event`: `#F9CA24`
  - `frontend/src/components/editor/assetTypeRegistry.ts` — ajout `'sound-event'` dans l'union + règle path ou `Array.isArray(json['Layers'])` (étape 5.8)
  - `frontend/src/components/editor/SoundEventFormEditor.tsx` — CRÉÉ
  - `frontend/src/components/editor/AssetSidePanel.tsx` — import + case ajoutés
- Validation : test sur `SFX_Sword_T2_Impact.json`
- Notes : sections Global (Volume, AudioCategory, Parent, PreventSoundInterruption) / Layers (Files, Volume, StartDelay, RandomSettings). Détection format legacy `Sounds[]` → warning + textarea fallback.

### 2.2 `item-sound-set` — ItemSoundSetFormEditor

- Statut : `done`
- Fichiers touchés :
  - `backend/core/graph_service.py` — règle `/audio/itemsounds/` + `/itemsounds/` → `item-sound-set`
  - `frontend/src/components/graph/colors.ts` — couleur `item-sound-set`: `#F0932B`
  - `frontend/src/components/editor/assetTypeRegistry.ts` — ajout `'item-sound-set'` + règle path ou `SoundEvents` object (étape 5.9)
  - `frontend/src/components/editor/ItemSoundSetFormEditor.tsx` — CRÉÉ
  - `frontend/src/components/editor/AssetSidePanel.tsx` — import + case ajoutés
- Validation : test sur un ISS_* depuis `Server/Audio/ItemSounds/`
- Notes : tableau slot → Sound Event ID, +Add/Remove, référence des slots communs en bas.

---

## Lot 3 — Gameplay / Commerce / IA

Statut global : `in-progress`

### 3.1 `barter-shop` — BarterShopFormEditor

- Statut : `done`
- Fichiers touchés :
  - `backend/core/graph_service.py` — règle `/bartershops/` + `/barter/` → `barter-shop`
  - `frontend/src/components/graph/colors.ts` — couleur `barter-shop`: `#E84393`
  - `frontend/src/components/editor/assetTypeRegistry.ts` — ajout `'barter-shop'` dans l'union + règle path ou `Array.isArray(json['TradeSlots'])` (étape 5.95)
  - `frontend/src/components/editor/BarterShopFormEditor.tsx` — CRÉÉ
  - `frontend/src/components/editor/AssetSidePanel.tsx` — import + case ajoutés
- Validation : test sur `Kweebec_Merchant.json`
- Notes : sections Shop (DisplayNameKey, RefreshInterval.Days, RestockHour) / Trade Slots avec type Fixed (single Trade) et Pool (SlotCount + Trades[]). Stock = nombre fixe ou plage `min-max`.

### 3.2 `npc-group` — NPCGroupFormEditor

- Statut : `done`
- Fichiers touchés :
  - `backend/core/graph_service.py` — règle `/npc/groups/` + `/npcgroups/` → `npc-group`
  - `frontend/src/components/graph/colors.ts` — couleur `npc-group`: `#7ED6DF`
  - `frontend/src/components/editor/assetTypeRegistry.ts` — ajout `'npc-group'` dans l'union + règle path seule (étape 5.97, forme JSON trop générique)
  - `frontend/src/components/editor/NPCGroupFormEditor.tsx` — CRÉÉ
  - `frontend/src/components/editor/AssetSidePanel.tsx` — import + case ajoutés
- Validation : build clean (257 modules). Test sur `Server/NPC/Groups/Livestock.json`
- Notes : 4 champs string[] : IncludeRoles, ExcludeRoles, IncludeGroups, ExcludeGroups. UI tag-list avec Enter pour ajouter, ✕ pour supprimer. Clé supprimée du JSON si la liste est vide.

### 3.3 `tag-pattern` — TagPatternFormEditor

- Statut : `done`
- Fichiers touchés :
  - `backend/core/graph_service.py` — règle `/tagpatterns/` + `/tag/patterns/` → `tag-pattern`
  - `frontend/src/components/graph/colors.ts` — couleur `tag-pattern`: `#FD79A8`
  - `frontend/src/components/editor/assetTypeRegistry.ts` — ajout `'tag-pattern'` dans l'union + règle path ou `Op in ['Or','And','Equals'] && ('Patterns' in json || 'Tag' in json)` (étape 5.98)
  - `frontend/src/components/editor/TagPatternFormEditor.tsx` — CRÉÉ
  - `frontend/src/components/editor/AssetSidePanel.tsx` — import + case ajoutés
- Validation : build clean (258 modules). Test sur `Server/TagPatterns/Soil_Or_Grass.json`
- Notes : éditeur récursif (NodeEditor). Noeud Op=Equals → champ Tag inline. Noeud Op=Or/And → liste de sous-noeuds avec +Equals / +Or/And group. Racine sans bouton Remove. Profondeur illimitée.

### 3.4 `response-curve` — ResponseCurveFormEditor

- Statut : `done`
- Fichiers touchés :
  - `backend/core/graph_service.py` — règle `/responsecurves/` + `/response/curves/` → `response-curve`
  - `frontend/src/components/graph/colors.ts` — couleur `response-curve`: `#BADC58`
  - `frontend/src/components/editor/assetTypeRegistry.ts` — ajout `'response-curve'` dans l'union + règle path ou `Type ∈ {Exponential,Logistic,SineWave} && !Container` (étape 5.99)
  - `frontend/src/components/editor/ResponseCurveFormEditor.tsx` — CRÉÉ
  - `frontend/src/components/editor/AssetSidePanel.tsx` — import + case ajoutés
- Validation : build clean (259 modules). Test sur `Linear.json`, `SimpleLogistic.json`, `SimpleParabola.json`
- Notes : sélecteur de type en haut (avec reset des champs par défaut au changement) + sous-éditeur discriminé. Exponential : Slope + Exponent. Logistic : Ceiling + RateOfChange + HorizontalShift + VerticalShift. SineWave : Amplitude + Frequency + Phase + VerticalShift. Hints inline sur chaque champ.
- Fichiers touchés : idem pattern standard
- Validation : test sur un fichier `Server/ResponseCurves/`
- Notes :

---

## Lot 4 — Types avancés

Statut global : `done`

### 4.1 `movement-config` — MovementConfigFormEditor

- Statut : `done`
- Notes : Sectioned numeric editor (Base/Jump/Speed Multipliers/Air Control/Climb/Fly). NumField helper. Backend: `/entity/movementconfig/`, `/movementconfigs/`, `/movementconfig/`.

### 4.2 `gameplay-config` — GameplayConfigFormEditor

- Statut : `done`
- Notes : Parent inheritance + Death/World/Player/ItemEntity/Respawn/Ping sections. Plugin via textarea JSON fallback.

### 4.3 `objective` — ObjectiveFormEditor

- Statut : `done`
- Notes : TaskSets[]+Tasks[] with discriminated type editor (KillNPC/Gather/Craft/ReachLocation/UseBlock/UseEntity). Completions[]. Add/Remove on all lists.

### 4.4 `reputation` — ReputationFormEditor

- Statut : `done`
- Notes : Stats key-value table (faction→number). Faction ID + FactionAllies/FactionEnemies tag lists. Attitudes (Default select + Conditions textarea).

### 4.5 `ambience-fx` — AmbienceFXFormEditor

- Statut : `done`
- Notes : Conditions (DayTime/SunLightLevel/Walls min-max + EnvironmentTagPattern textarea). AmbientBed Track+Volume. Music.Tracks tag list.

---

## Lot 5 — Display-only / Complexes

Statut global : `done`

### 5.1 `prefab` — PrefabFormEditor (metadata only)

- Statut : `done`
- Notes : Lecture seule — affiche version, blockIdVersion, anchorX/Y/Z, block count (taille du tableau). Backend: règle `/prefabs/` déjà présente. Détection supplémentaire : `'blocks' in json && 'anchorX' in json`. Modifications du tableau de blocs via onglet RAW JSON.

---

## Historique

| Date | Action |
|---|---|
| 2026-03-16 | Lot 5 terminé : PrefabFormEditor (display-only, metadata). Build propre à 265 modules. |
| 2026-03-16 | Lot 4 terminé : infrastructure (graph_service, colors, registry, AssetSidePanel) + 5 form editors (MovementConfig, GameplayConfig, Objective, Reputation, AmbienceFX). Build propre. |
| 2026-03-16 | Chantier initialisé — plan et tracker créés |
