# ASSETFORMS1 — Éditeurs de formulaires multi-types

Objectif : étendre le Studio pour offrir des form editors structurés à tous les types d'assets Hytale fréquemment modifiés, en partant d'une architecture dont le point d'extension est clair et maintenable.

---

## Constat de départ

L'éditeur de formulaire existe aujourd'hui pour deux familles :

- **Interactions** — `InteractionFormPanel.tsx` + `InteractionFormTypeSections.tsx`, 47 types couverts, architecture type-aware solide.
- **Items** — `ItemFormEditor.tsx`, détection `looksLikeItem()` importée dans `AssetSidePanel.tsx`.

Le reste (EntityEffect, Projectile, NPCRole, Drop tables, Block sections) affiche du JSON brut dans Monaco. C'est fonctionnel mais ergonomiquement pauvre pour les cas courants.

### Problème architectural immédiat

`AssetSidePanel.tsx` détecte et route aujourd'hui via `looksLikeItem` importé directement depuis `ItemFormEditor.tsx`. Ajouter 5 types supplémentaires en dupliquant ce pattern va :

1. bloater `AssetSidePanel` avec 5+ imports et conditions supplémentaires,
2. créer des risques de conflits d'ordre (un block-item satisfait aussi `looksLikeItem`),
3. rendre l'ajout de nouveaux types non-découvrable.

### Réponse architecturale recommandée : `assetTypeRegistry.ts`

Extraire toute la logique de détection dans un registre centralisé qui renvoie un `AssetKind` discriminé. `AssetSidePanel` ne fait plus que consommer ce type et router vers le bon composant via un `switch`. Chaque nouveau type s'ajoute en 1 seul endroit.

```
frontend/src/components/editor/
  assetTypeRegistry.ts          ← NOUVEAU — detectAssetKind(json, vfsPath): AssetKind
  AssetSidePanel.tsx            ← MODIFIÉ — switch(kind) → form editor
  ItemFormEditor.tsx            ← MODIFIÉ — looksLikeItem déplacé dans le registry
  EntityEffectFormEditor.tsx    ← NOUVEAU (Lot 3)
  ProjectileFormEditor.tsx      ← NOUVEAU (Lot 5)
  NPCRoleFormEditor.tsx         ← NOUVEAU (Lot 6)
```

---

## Lots

### Lot 1 — `Simple.Effects.Particles` (quick win, sans dépendance)

**Pourquoi en premier** : indépendant de toute restructuration, valeur immédiate car `Particles` apparaît dans la quasi totalité des interactions vanillas qui produisent un VFX.

Fichiers cibles : `InteractionFormPanel.tsx`

#### 1.1 Éditeur tableau `Particles` dans le bloc `Effects`

- Ajouter un éditeur de liste après les 4 champs fixes (`ItemAnimationId`, etc.).
- Chaque entrée expose :
  - `SystemId` (string, requis)
  - `TargetNodeName` (string, optionnel)
  - `RotationOffset` — inline avec 3 champs number: `Roll`, `Pitch`, `Yaw` (omis si tous à 0)
- Boutons `+ Add particle` / `✕ Remove` par entrée.
- L'objet `Particles` est omis de la valeur finale si le tableau est vide.

Validation : `npm run build` + vérification manuelle sur `Root_Cast.json`.

---

### Lot 2 — Socle : routing extensible dans `AssetSidePanel` (prérequis des lots 3-6)

**Objectif** : rendre l'ajout de form editors mécanique et sans risque de régression.

#### 2.1 Créer `assetTypeRegistry.ts`

```ts
export type AssetKind =
  | 'item'           // Server/Item/Items/ — Items, Blocks, Potions, Tools…
  | 'entity-effect'  // Server/Entity/Effects/ ou Server/EntityEffect/
  | 'projectile'     // Server/Projectile/ ou Server/Projectiles/
  | 'npc-role'       // Server/NPC/Roles/
  | 'drop-table'     // Server/Drops/ — container récursif
  | 'unknown'

export function detectAssetKind(
  json: Record<string, unknown>,
  vfsPath: string,
): AssetKind
```

Stratégie de détection (ordre déterministe, sans ambiguïté) :
1. **`entity-effect`** — `vfsPath` contient `Entity/Effects` OU `EntityEffect/`, OU json contient `ApplicationEffects` | `OverlapBehavior`.
2. **`projectile`** — `vfsPath` contient `Projectile`, OU json contient `MuzzleVelocity` | `TerminalVelocity`.
3. **`npc-role`** — `vfsPath` contient `NPC/Roles`, OU json contient `Type` ∈ {`Variant`, `Template`} + `Reference`.
4. **`drop-table`** — json contient `Container` avec `Type` ∈ {`Multiple`, `Choice`, `Single`}.
5. **`item`** — heuristique actuelle de `looksLikeItem` (migrée ici).
6. Sinon → `unknown`.

#### 2.2 Modifier `AssetSidePanel.tsx`

- Supprimer l'import direct de `looksLikeItem`.
- Calculer `kind = useMemo(() => detectAssetKind(json, vfsPath), [json, vfsPath])`.
- Onglet `form` visible ssi `kind !== 'unknown'`.
- Rendu du form tab : `switch(kind)` → `<ItemFormEditor>` | `<EntityEffectFormEditor>` | … | `null`.

Contrainte : **aucune régression** sur le rendu Item (tests manuels sur `Ingredient_Bar_Adamantite`, `Weapon_Sword_Iron`).

---

### Lot 3 — `EntityEffectFormEditor` (assets `Server/Entity/Effects/`)

Ces assets sont référencés par `ApplyEffect.EffectId` et `EffectCondition.EntityEffectIds`. Avoir un form structuré évite d'éditer à la main les champs d'effets visuels et de stat.

#### 3.1 Créer `EntityEffectFormEditor.tsx`

Champs structurés :
- `Duration` (number, en secondes — `-1` si `Infinite: true`)
- `Infinite` (boolean)
- `Debuff` (boolean)
- `OverlapBehavior` (select : `Overwrite` | `Stack` | `Ignore`)
- `ApplicationEffects` — réutilise un composant `<EffectsBlock>` (voir 3.2)
- `DamageEffects` — idem
- `DamageCalculator` (JSON textarea)
- `StatModifiers` (JSON textarea)
- Champs restants → `ExtraJsonFields` (pattern identique à `ItemFormEditor`)

#### 3.2 Extraire `<EffectsBlock>` depuis `InteractionFormPanel`

Le rendu `renderField('effects')` dans `InteractionFormPanel.tsx` contient la logique pour `ItemAnimationId`, `WorldSoundEventId`, `LocalSoundEventId`, `CameraEffect`, `Trails`, **et `Particles` (Lot 1)**. Ce rendu est identique à ce dont `EntityEffectFormEditor` a besoin.

- Extraire dans un composant `EffectsBlockEditor` dans un fichier dédié (ex: `EffectsBlockEditor.tsx`).
- `InteractionFormPanel` et `EntityEffectFormEditor` l'importent.
- Pas de régression sur l'existant.

---

### Lot 4 — Section `BlockType` dans `ItemFormEditor`

Les Blocks Hytale sont des Items (même fichier `Server/Item/Items/`) avec une clé `BlockType`. La détection `looksLikeItem` les capture déjà. Il manque juste une section structurée pour `BlockType`.

#### 4.1 Ajouter section `BlockType` collapsible dans `ItemFormEditor.tsx`

Visible uniquement si `json.BlockType` existe.

Champs structurés :
- `Material` (select ou input : `Solid`, `Fluid`, `Gas`, `NonCollidable`, `Platform`)
- `DrawType` (input : `Cube`, `Mesh`, `Crossed`, etc.)
- `Group` (string)
- `Flags` (JSON textarea)
- `Gathering` (JSON textarea)
- `Textures` (JSON textarea)
- `BlockSoundSetId` (string)
- `BlockParticleSetId` (string)

Ajouter `'BlockType'` au set `HANDLED_KEYS` pour éviter la duplication dans `ExtraJsonFields`.

---

### Lot 5 — `ProjectileFormEditor` (assets `Server/Projectile/`)

Les projectiles sont référencés par `LaunchProjectile` et régissent le comportement des flèches, sorts, etc.

#### 5.1 Créer `ProjectileFormEditor.tsx`

Champs structurés (d'après `37_Projectiles.md` et `Arrow_NoCharge.json`) :
- `Appearance` (string — référence modèle)
- `SticksVertically` (boolean)
- Physique : `MuzzleVelocity`, `TerminalVelocity`, `Gravity`, `Bounciness`, `ImpactSlowdown` (numbers)
- `TimeToLive`, `Damage`, `DeadTime` (numbers)
- `HorizontalCenterShot`, `VerticalCenterShot`, `DepthShot` (numbers)
- `PitchAdjustShot` (boolean)
- `HitSoundEventId`, `MissSoundEventId` (strings)
- `HitParticles` — mini-éditeur `{ SystemId }` (inline, sans tableau)
- Champs restants → `ExtraJsonFields`

---

### Lot 6 — `NPCRoleFormEditor` (assets `Server/NPC/Roles/`) — complexité haute

NPCs de type `Variant` (les plus courants pour les overrides) ont une structure peu profonde ( `Type`, `Reference`, `Modify`, `Parameters`). Les NPCs `Template` sont beaucoup plus complexes.

**Scope restreint au MVP** : Type `Variant` uniquement.

#### 6.1 Créer `NPCRoleFormEditor.tsx`

Champs structurés pour `Type: Variant` :
- `Type` (badge read-only : `Variant`)
- `Reference` (string — ID du template parent)
- `Modify` — éditeur clé/valeur générique (paires `key: value`, support string/number/boolean + JSON)
- `Parameters` — éditeur clé/valeur générique
- Champs restants → `ExtraJsonFields`

Pour `Type: Template` ou inconnu → fallback Monaco (pas de form dédié dans ce lot).

---

## Questions ouvertes

| # | Question | Défaut proposé |
|---|----------|----------------|
| Q1 | `Drop tables` : éditeur récursif complet ou juste JSON ? | JSON brut (Monaco) — structure récursive trop complexe pour un form |
| Q2 | `EffectsBlockEditor` : même fichier que `EntityEffectFormEditor` ou module séparé ? | Module séparé `EffectsBlockEditor.tsx` pour clarté |
| Q3 | Lot 6 : les `Template` NPCs doivent-ils être couverts ? | Non — hors scope de ce chantier |

---

## Ordre d'exécution recommandé

```
Lot 1 (Particles)  ─── standalone, aucune dépendance
Lot 2 (Registry)   ─── prerequisite pour 3, 4, 5, 6
Lot 3 (EntityEffect + EffectsBlockEditor)
Lot 4 (BlockType dans Item)
Lot 5 (Projectile)
Lot 6 (NPC Variant)
```

Lots 1 et 2 peuvent être développés dans la même session (Lot 1 first, Lot 2 ensuite isolément pour éviter de mélanger une feature avec un refactor).
