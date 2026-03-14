# ASSETFORMS1 - Tracker d'exécution

Document de suivi pour exécuter le plan `ASSETFORMS1.md`.

## Légende

- `todo`: non commencé
- `in-progress`: en cours
- `blocked`: bloqué par une décision ou un contrat incomplet
- `done`: terminé et vérifié

---

## Tableau de bord

### Lot 1 — Simple.Effects.Particles

- Statut global: `done`
- Commit: Lot 1 in prior session

#### 1.1 Éditeur Particles dans renderField('effects')

- Statut: `done`

---

### Lot 2 — Socle routing extensible (AssetSidePanel)

- Statut global: `done`

#### 2.1 Créer `assetTypeRegistry.ts`

- Statut: `done`

#### 2.2 Modifier `AssetSidePanel.tsx`

- Statut: `done`

---

### Lot 3 — EntityEffectFormEditor

- Statut global: `done`
- Commit: `09000c4`

#### 3.1 Extraire `EffectsBlockEditor.tsx`

- Statut: `done`
- Notes: added `extraStringKeys` prop so EntityEffectFormEditor can show
  EntityBottomTint/EntityTopTint/ScreenEffect/ModelVFXId in ApplicationEffects
  and PlayerSoundEventId in DamageEffects.

#### 3.2 Créer `EntityEffectFormEditor.tsx`

- Statut: `done`
- Notes: DamageCalculatorCooldown, StatusEffectIcon, DeathMessageKey added
  beyond original plan spec (observed from Burn.json sample).

---

### Lot 4 — Section BlockType dans ItemFormEditor

- Statut global: `done`
- Commit: `4c5ea8d`

#### 4.1 Ajouter section BlockType collapsible

- Statut: `done`
- Notes: Extra BlockType keys (CustomModel, CustomModelTexture, HitboxType,
  VariantRotation, Bench, State, Opacity, ParticleColor, Support…) rendered
  as JSON k/v catch-all inside the collapsed section.

---

### Lot 5 — ProjectileFormEditor

- Statut global: `done`
- Commit: `5c4fa33`

#### 5.1 Créer `ProjectileFormEditor.tsx`

- Statut: `done`
- Notes: Added DeadTimeMiss, DeathSoundEventId, MissParticles, DeathParticles,
  DeathEffectsOnHit, Radius, Height (conditional section) beyond original plan.

---

### Lot 6 — NPCRoleFormEditor (Variant uniquement)

- Statut global: `done`
- Commit: `c5c2fb4`

#### 6.1 Créer `NPCRoleFormEditor.tsx`

- Statut: `done`
- Notes: Non-Variant types show an informational fallback message directing
  users to the JSON tab.

---

## Questions ouvertes

| # | Question | Décision |
|---|----------|----------|
| Q1 | Drop tables : éditeur récursif complet ou JSON ? | JSON brut (Monaco) — hors scope |
| Q2 | `EffectsBlockEditor` : même fichier ou module séparé ? | Module séparé `EffectsBlockEditor.tsx` ✓ |
| Q3 | NPC Template : couvert dans ce chantier ? | Non — hors scope |


Document de suivi pour exécuter le plan `ASSETFORMS1.md`.

## Légende

- `todo`: non commencé
- `in-progress`: en cours
- `blocked`: bloqué par une décision ou un contrat incomplet
- `done`: terminé et vérifié

---

## Tableau de bord

### Lot 1 — Simple.Effects.Particles

- Statut global: `todo`
- Objectif: exposer un éditeur de tableau structuré pour `Particles` dans le bloc `Effects` des interactions.

#### 1.1 Éditeur Particles dans renderField('effects')

- Statut: `todo`
- Priorité: P1
- Fichiers cibles:
  - `frontend/src/components/editor/InteractionFormPanel.tsx`
- Tâches:
  - [ ] ajouter la liste `Particles` après les 4 champs fixes dans le bloc Effects
  - [ ] chaque entrée : `SystemId` (requis), `TargetNodeName` (optionnel), `RotationOffset.Roll/Pitch/Yaw` (optionnel, inline)
  - [ ] bouton `+ Add particle` et `✕ Remove` par entrée
  - [ ] omission de `Particles` si tableau vide dans la valeur produite
- Validation:
  - [ ] `npm run build`
  - [ ] test manuel sur un asset avec Particles (ex: `Root_Cast.json`)

---

### Lot 2 — Socle routing extensible (AssetSidePanel)

- Statut global: `todo`
- Objectif: rendre l'ajout de form editors mécanique — AssetSidePanel ne contient plus aucune logique de détection.

#### 2.1 Créer `assetTypeRegistry.ts`

- Statut: `todo`
- Priorité: P0
- Fichiers cibles:
  - `frontend/src/components/editor/assetTypeRegistry.ts` (nouveau)
  - `frontend/src/components/editor/ItemFormEditor.tsx` (retirer `looksLikeItem`, ou garder export pour compat)
- Tâches:
  - [ ] définir `AssetKind` union type
  - [ ] implémenter `detectAssetKind(json, vfsPath)` avec ordre déterministe (entity-effect > projectile > npc-role > drop-table > item > unknown)
  - [ ] migrer `looksLikeItem` en détecteur `item` dans le registry
  - [ ] conserver l'export `looksLikeItem` depuis `ItemFormEditor` si encore importé ailleurs (vérifier)
- Validation:
  - [ ] `npm run build`

#### 2.2 Modifier `AssetSidePanel.tsx`

- Statut: `todo`
- Priorité: P0
- Fichiers cibles:
  - `frontend/src/components/editor/AssetSidePanel.tsx`
- Tâches:
  - [ ] remplacer l'import de `looksLikeItem` par `detectAssetKind` depuis le registry
  - [ ] calculer `kind = useMemo(() => detectAssetKind(json, vfsPath), [json, vfsPath])`
  - [ ] onglet `form` visible ssi `kind !== 'unknown'`
  - [ ] switch(kind) pour renderer le bon form (initialement : item → ItemFormEditor, autres → null en attente des lots suivants)
- Validation:
  - [ ] `npm run build`
  - [ ] aucune régression sur les items (`Ingredient_Bar_Adamantite`, `Weapon_Sword_Iron`)

---

### Lot 3 — EntityEffectFormEditor

- Statut global: `todo`
- Objectif: form structuré pour les assets `Server/Entity/Effects/`, directement ouvrables depuis un clic sur `ApplyEffect.EffectId`.

#### 3.1 Extraire `EffectsBlockEditor.tsx`

- Statut: `todo`
- Priorité: P1 (prérequis de 3.2)
- Fichiers cibles:
  - `frontend/src/components/editor/EffectsBlockEditor.tsx` (nouveau)
  - `frontend/src/components/editor/InteractionFormPanel.tsx` (consommer le composant)
- Tâches:
  - [ ] extraire la logique `renderField('effects')` vers un composant `EffectsBlockEditor`
  - [ ] inclut: `ItemAnimationId`, `WorldSoundEventId`, `LocalSoundEventId`, `CameraEffect`, `Trails`, `Particles` (Lot 1)
  - [ ] `InteractionFormPanel` importe et utilise `EffectsBlockEditor` — aucune régression
- Validation:
  - [ ] `npm run build`

#### 3.2 Créer `EntityEffectFormEditor.tsx`

- Statut: `todo`
- Priorité: P1
- Fichiers cibles:
  - `frontend/src/components/editor/EntityEffectFormEditor.tsx` (nouveau)
  - `frontend/src/components/editor/assetTypeRegistry.ts` (activer `entity-effect`)
  - `frontend/src/components/editor/AssetSidePanel.tsx` (branch switch)
- Tâches:
  - [ ] champs: `Duration`, `Infinite`, `Debuff`, `OverlapBehavior` (select), `ApplicationEffects` (EffectsBlock), `DamageEffects` (EffectsBlock), `DamageCalculator` (JSON), `StatModifiers` (JSON)
  - [ ] `ExtraJsonFields` pour les clés non gérées
  - [ ] brancher dans AssetSidePanel
- Validation:
  - [ ] `npm run build`
  - [ ] test manuel sur `Server/Entity/Effects/Status/Burn.json`

---

### Lot 4 — Section BlockType dans ItemFormEditor

- Statut global: `todo`
- Objectif: exposer les champs `BlockType` structurés quand un Item est aussi un Block.

#### 4.1 Ajouter section BlockType collapsible

- Statut: `todo`
- Priorité: P2
- Fichiers cibles:
  - `frontend/src/components/editor/ItemFormEditor.tsx`
- Tâches:
  - [ ] afficher la section uniquement si `json.BlockType` existe
  - [ ] champs: `Material`, `DrawType`, `Group`, `Flags` (JSON), `Gathering` (JSON), `Textures` (JSON), `BlockSoundSetId`, `BlockParticleSetId`
  - [ ] ajouter `'BlockType'` au set `HANDLED_KEYS`
- Validation:
  - [ ] `npm run build`
  - [ ] test manuel sur `Rock_Stone.json`

---

### Lot 5 — ProjectileFormEditor

- Statut global: `todo`
- Objectif: form structuré pour les assets `Server/Projectile/`, référencés par `LaunchProjectile`.

#### 5.1 Créer `ProjectileFormEditor.tsx`

- Statut: `todo`
- Priorité: P2
- Fichiers cibles:
  - `frontend/src/components/editor/ProjectileFormEditor.tsx` (nouveau)
  - `frontend/src/components/editor/assetTypeRegistry.ts` (activer `projectile`)
  - `frontend/src/components/editor/AssetSidePanel.tsx` (branch switch)
- Tâches:
  - [ ] champs: `Appearance`, `SticksVertically`, `MuzzleVelocity`, `TerminalVelocity`, `Gravity`, `Bounciness`, `ImpactSlowdown`, `TimeToLive`, `Damage`, `DeadTime`, `HorizontalCenterShot`, `VerticalCenterShot`, `DepthShot`, `PitchAdjustShot`, `HitSoundEventId`, `MissSoundEventId`, `HitParticles` (inline SystemId)
  - [ ] `ExtraJsonFields` pour les clés non gérées
  - [ ] brancher dans AssetSidePanel
- Validation:
  - [ ] `npm run build`
  - [ ] test manuel sur `Arrow_NoCharge.json`

---

### Lot 6 — NPCRoleFormEditor (Variant uniquement)

- Statut global: `todo`
- Objectif: form structuré pour les NPCs de type `Variant` — les plus courants dans les overrides de mod.

#### 6.1 Créer `NPCRoleFormEditor.tsx`

- Statut: `todo`
- Priorité: P3
- Fichiers cibles:
  - `frontend/src/components/editor/NPCRoleFormEditor.tsx` (nouveau)
  - `frontend/src/components/editor/assetTypeRegistry.ts` (activer `npc-role`)
  - `frontend/src/components/editor/AssetSidePanel.tsx` (branch switch)
- Tâches:
  - [ ] détecter `Type: Variant` ; si `Template` ou absent → fallback Monaco
  - [ ] champs Variant: `Reference` (string), `Modify` (k/v générique), `Parameters` (k/v générique)
  - [ ] `ExtraJsonFields` pour les clés non gérées
  - [ ] brancher dans AssetSidePanel
- Validation:
  - [ ] `npm run build`
  - [ ] test manuel sur `Goblin_Scrapper.json`

---

## Questions ouvertes

| # | Question | Décision |
|---|----------|----------|
| Q1 | Drop tables : éditeur récursif complet ou JSON ? | JSON brut (Monaco) — hors scope |
| Q2 | `EffectsBlockEditor` : même fichier ou module séparé ? | Module séparé `EffectsBlockEditor.tsx` |
| Q3 | NPC Template : couvert dans ce chantier ? | Non — hors scope |
