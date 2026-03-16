# NODEIMPL1 — Implémentation complète des types de nœuds assets Hytale

Objectif : couvrir tous les types d'assets Hytale vanilla significatifs avec un formulaire
dédié dans le Studio, afin que tout asset ouvert dans le panneau latéral bénéficie d'une
édition guidée plutôt que d'un JSON brut.

Chaque lot suit la procédure définie dans
`.github/instructions/add-asset-node-type.instructions.md` (5 points de contact :
`graph_service.py` × 2, `colors.ts`, `assetTypeRegistry.ts`, `XxxFormEditor.tsx`,
`AssetSidePanel.tsx`).

---

## Constat de départ (2026-03-16)

### Types avec formulaire ✅
| AssetKind | Formulaire | Path VFS principal |
|---|---|---|
| `item` | `ItemFormEditor` | `Server/Item/Items/` |
| `quality` | `QualityFormEditor` | `Server/Item/Qualities/` |
| `entity-effect` | `EntityEffectFormEditor` | `Server/EntityEffect/` |
| `projectile-config` | `ProjectileConfigFormEditor` | `Server/ProjectileConfigs/` |
| `projectile` | `ProjectileFormEditor` | `Server/Projectile/` |
| `npc-role` | `NPCRoleFormEditor` | `Server/NPC/Roles/` |
| `interaction` / `rootinteraction` | `InteractionFormPanel` | `Server/Item/Interactions/`, `Server/Item/RootInteractions/` |

### Types reconnus par le graphe (couleur) mais sans formulaire ⚠️
`drop-table`, `sound`, `particle`, `model`, `npc`, `prefab`, `block`, `effect`

### Types complètement absents du registry ❌
`entity-stat`, `sound-event`, `item-sound-set`, `barter-shop`, `npc-group`,
`tag-pattern`, `response-curve`, `movement-config`, `gameplay-config`,
`objective`, `reputation`, `ambience-fx`, `trail`, `item-tool-spec`, `resource-type`

---

## Règle d'arbitrage (complexité vs. valeur)

Un formulaire **minimal** (5–10 champs couvrant les cas fréquents) est toujours préféré à
l'absence de formulaire. L'onglet RAW JSON reste accessible pour le reste.

Les types à structure exclusivement binaire/tabulaire (ex : prefabs block-by-block) sont
marqués "display-only" : le formulaire affiche les métadonnées, pas le tableau de blocs.

---

## Lot 1 — Types fréquents dans le graphe Items (impact maximum)

**Critère** : navigués ou référencés dans la majorité des assets vanilla Items/Blocks/NPCs.

### 1.1 `drop-table` — formulaire Drop Table

- **Path VFS** : `Server/Drops/**/*.json`
- **Détection actuelle** : kind déjà détecté, tombe sur `default:` dans le switch
- **Doc** : `docs/Hytale Docs/105_Drop_Tables.md`
- **Champs clés** :
  - `Container.Type` (`Multiple` | `Choice` | `Single`)
  - `Container.Containers[]` — liste récursive
  - Pour `Single` : `Item.ItemId`, `Item.QuantityMin`, `Item.QuantityMax`
  - Pour `Choice` : `Weight`
- **Note** : la structure est récursive et profonde. Le formulaire affiche le type racine
  et une liste d'entrées level-1 ; au-delà, renvoyer vers RAW JSON est acceptable.
- **Fichiers** : `DropTableFormEditor.tsx`

### 1.2 `block` — formulaire Block (items avec BlockType)

- **Path VFS** : sous `Server/Item/Items/` mais avec champ `BlockType` présent
- **Détection** : priorité sur `item` quand `'BlockType' in json`
- **Doc** : `docs/Hytale Docs/06_Blocks_and_Portals.md`
- **Champs clés** (dans `BlockType`) :
  - `Material` (string)
  - `DrawType` (string : `Cube`, `Model`, etc.)
  - `Group` (string)
  - `Flags` (object)
  - `BlockSoundSetId` (string)
  - `BlockParticleSetId` (string)
  - `Textures[]` (array of `{ All, Top, Bottom, Side, Weight }`)
  - `ParticleColor` (string hex)
  - `Gathering.Breaking` (object : `GatherType`, `ItemId`, `ToolSpecs`)
  - `Hardness` (number)
  - `LightLevel` (number)
  - `Interactions` (object)
- **Note** : hérite des champs item de base (`TranslationProperties`, `Icon`, `Categories`,
  `ItemLevel`, `MaxStack`…). Le formulaire affiche d'abord les champs item communs, puis
  une section "Block" pour les champs `BlockType`.
- **Fichiers** : `BlockFormEditor.tsx`

### 1.3 `entity-stat` — formulaire Stat d'entité

- **Path VFS** : `Server/Entity/Stats/**/*.json`
- **Détection** : path + `'InitialValue' in json` ou `'ResetType' in json`
- **Doc** : `docs/Hytale Docs/28_Entity_Stats.md`
- **Champs clés** :
  - `InitialValue` (number)
  - `Min` (number)
  - `Max` (number)
  - `Shared` (boolean)
  - `ResetType` (string : `MaxValue`, `Zero`, etc.)
  - `Regenerating[]` (array — textarea JSON)
- **Fichiers** : `EntityStatFormEditor.tsx`

---

## Lot 2 — Audio (présents comme nœuds liés dans les interactions)

### 2.1 `sound-event` — formulaire Sound Event

- **Path VFS** : `Server/Audio/SoundEvents/**/*.json`
- **Détection** : path `/audio/soundevents/` ou `/soundevents/` + `'Layers' in json`
- **Doc** : `docs/Hytale Docs/35_Sound_Effects.md`
- **Champs clés** :
  - `Layers[]` — array : chaque couche a `Files[]`, `Volume`, `RandomSettings`
  - `Volume` (number root)
  - `Parent` (string — référence à un autre sound event)
  - `AudioCategory` (string)
  - `PreventSoundInterruption` (boolean)
- **Note** : `Layers` est affiché sous forme de textarea JSON ou liste simplifiée.
- **Fichiers** : `SoundEventFormEditor.tsx`

### 2.2 `item-sound-set` — formulaire Item Sound Set

- **Path VFS** : `Server/Audio/ItemSounds/**/*.json` ou `Server/Item/SoundSets/**`
- **Détection** : path `/itemsounds/` ou `/soundsets/` (hors `/block/soundsets/`)
- **Doc** : `docs/Hytale Docs/108_Item_Sound_Sets.md`
- **Champs clés** : mapping de `SoundEventId` par action
  (typiquement `Equip`, `Unequip`, `Attack`, `Use`, etc.) — textarea JSON acceptable
- **Fichiers** : `ItemSoundSetFormEditor.tsx`

---

## Lot 3 — Gameplay / Commerce / IA de base

### 3.1 `barter-shop` — formulaire Barter Shop

- **Path VFS** : `Server/BarterShops/**/*.json`
- **Détection** : path `/bartershops/` ou `'TradeSlots' in json`
- **Doc** : `docs/Hytale Docs/187_Barter_Shops.md`
- **Champs clés** :
  - `DisplayNameKey` (string)
  - `RefreshInterval` (object)
  - `RestockHour` (number)
  - `TradeSlots[]` — liste de slots (`Type: Fixed|Pool`) — textarea JSON
- **Fichiers** : `BarterShopFormEditor.tsx`

### 3.2 `npc-group` — formulaire NPC Group / Attitude

- **Path VFS** : `Server/NPC/Groups/**/*.json`, `Server/NPC/AttitudeGroups/**`
- **Détection** : path `/npc/groups/` ou `/attitudegroups/`
- **Doc** : `docs/Hytale Docs/43_NPC_Groups.md`
- **Champs clés** : variables du groupe + hostilité inter-groupes — textarea JSON
- **Fichiers** : `NPCGroupFormEditor.tsx`

### 3.3 `tag-pattern` — formulaire Tag Pattern

- **Path VFS** : `Server/TagPatterns/**/*.json`
- **Détection** : path `/tagpatterns/` ou `'Patterns' in json` avec array
- **Doc** : `docs/Hytale Docs/48_Tag_Patterns.md`
- **Champs clés** : `Patterns[]` — array de conditions de matching — textarea JSON
- **Fichiers** : `TagPatternFormEditor.tsx`

### 3.4 `response-curve` — formulaire Response Curve

- **Path VFS** : `Server/ResponseCurves/**/*.json`
- **Détection** : path `/responsecurves/` ou `'Points' in json` + `'CurveType' in json`
- **Doc** : `docs/Hytale Docs/44_Response_Curves.md`
- **Champs clés** :
  - `CurveType` (string)
  - `Points[]` — courbe XY
- **Fichiers** : `ResponseCurveFormEditor.tsx`

---

## Lot 4 — Types avancés / moins fréquents

### 4.1 `movement-config` — formulaire Movement Config

- **Path VFS** : `Server/MovementConfigs/**/*.json`
- **Détection** : path `/movementconfigs/`
- **Doc** : `docs/Hytale Docs/58_Movement_Configs.md`
- **Champs clés** : vitesses de déplacement, physique — formulaire partiel + textarea
- **Fichiers** : `MovementConfigFormEditor.tsx`

### 4.2 `gameplay-config` — formulaire Gameplay Config

- **Path VFS** : `Server/GameplayConfig/**/*.json`
- **Détection** : path `/gameplayconfig/`
- **Doc** : `docs/Hytale Docs/189_Gameplay_Configs.md`
- **Champs clés** : paramètres gameplay spécifiques — textarea JSON acceptable
- **Fichiers** : `GameplayConfigFormEditor.tsx`

### 4.3 `objective` — formulaire Objective Asset

- **Path VFS** : `Server/Objective/**/*.json`
- **Détection** : path `/objective/`
- **Doc** : `docs/Hytale Docs/168_Objective_System.md`
- **Champs clés** : type d'objectif, conditions — formulaire partiel
- **Fichiers** : `ObjectiveFormEditor.tsx`

### 4.4 `reputation` — formulaire Reputation Group/Rank

- **Path VFS** : `Server/Reputation/**/*.json`
- **Détection** : path `/reputation/`
- **Doc** : `docs/Hytale Docs/193_Reputation_System.md`
- **Champs clés** : seuils, rangs — textarea JSON
- **Fichiers** : `ReputationFormEditor.tsx`

### 4.5 `ambience-fx` — formulaire Ambience FX

- **Path VFS** : `Server/AmbienceFX/**/*.json`
- **Détection** : path `/ambiencefx/`
- **Doc** : `docs/Hytale Docs/54_AmbienceFX.md`
- **Champs clés** : musique ambiante, zones — formulaire partiel
- **Fichiers** : `AmbienceFXFormEditor.tsx`

---

## Lot 5 — Display-only / Complexes

Ces types sont structurellement complexes. Le formulaire se limite aux métadonnées
(lecture seule ou edit partiel) ; la modification complète passe par RAW JSON.

### 5.1 `prefab` — affichage Prefab (metadata only)

- **Path VFS** : `Server/Prefabs/**/*.prefab.json`
- **Détection** : path `/prefabs/` + `.prefab.json` ou `'blocks' in json` + `'anchorX' in json`
- **Doc** : `docs/Hytale Docs/186_Prefabs.md`
- **Affiché** : `version`, `blockIdVersion`, nombre de blocs (taille du tableau) — lecture seule
- **Fichiers** : `PrefabFormEditor.tsx`

---

## Validation de chaque lot

Pour chaque lot, la fermeture requiert :
- `npm run lint` → vert
- `npm run build` → vert
- Ouvrir un asset vanilla représentatif dans le Studio : onglet "Form" visible et rendu sans erreur
- `python -m pytest` → vert (si `graph_service.py` modifié)
