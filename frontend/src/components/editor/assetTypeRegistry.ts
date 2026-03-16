/**
 * assetTypeRegistry — single source of truth for asset type detection.
 *
 * detectAssetKind() returns a discriminated AssetKind based on JSON shape and vfsPath.
 * All form editor routing in AssetSidePanel must use this function.
 *
 * Detection order is deterministic (more specific before more general):
 *   quality → entity-effect → projectile-config → projectile → npc-role → drop-table → block → entity-stat → sound-event → item-sound-set → item → unknown
 */

export type AssetKind =
  | 'quality'            // Server/Item/Qualities/
  | 'block'              // Server/Item/Items/*/ — items with BlockType field
  | 'entity-stat'        // Server/Entity/Stats/
  | 'sound-event'        // Server/Audio/SoundEvents/
  | 'item-sound-set'     // Server/Audio/ItemSounds/
  | 'barter-shop'        // Server/BarterShops/
  | 'npc-group'          // Server/NPC/Groups/
  | 'tag-pattern'        // Server/TagPatterns/
  | 'response-curve'     // Server/ResponseCurves/
  | 'movement-config'    // Server/Entity/MovementConfig/
  | 'gameplay-config'    // Server/GameplayConfigs/
  | 'objective'          // Server/Objective/
  | 'reputation'         // Server/Reputation/
  | 'ambience-fx'        // Server/Audio/AmbienceFX/
  | 'prefab'             // Server/Prefabs/
  | 'item'               // Server/Item/Items/ — items, potions, tools…
  | 'entity-effect'      // Server/Entity/Effects/ or Server/EntityEffect/
  | 'projectile-config'  // Server/ProjectileConfigs/
  | 'projectile'         // Server/Projectile/ or Server/Projectiles/
  | 'npc-role'           // Server/NPC/Roles/
  | 'drop-table'         // Server/Drops/ — recursive Container structure
  | 'unknown'

export function detectAssetKind(
  json: Record<string, unknown>,
  vfsPath: string,
): AssetKind {
  const path = vfsPath.replace(/\\/g, '/').toLowerCase()

  if (path.includes('/item/qualities/')) {
    return 'quality'
  }

  // 1. entity-effect — path match or JSON shape
  if (
    path.includes('entity/effects') ||
    path.includes('entity/effect') ||
    path.includes('entityeffect/') ||
    'ApplicationEffects' in json ||
    'OverlapBehavior' in json ||
    'DamageCalculatorCooldown' in json
  ) {
    return 'entity-effect'
  }

  // 2. projectile-config — path match or LaunchForce + Physics object
  if (
    path.includes('/projectileconfigs/') ||
    path.includes('/projectileconfig/') ||
    (
      'LaunchForce' in json &&
      typeof json['Physics'] === 'object' &&
      json['Physics'] !== null &&
      'Type' in (json['Physics'] as Record<string, unknown>)
    )
  ) {
    return 'projectile-config'
  }

  // 3. projectile — path match or physics fields
  if (
    path.includes('/projectile/') ||
    path.includes('/projectiles/') ||
    'MuzzleVelocity' in json ||
    'TerminalVelocity' in json
  ) {
    return 'projectile'
  }

  // 4. npc-role — path match or Variant/Template shape
  if (
    path.includes('npc/roles') ||
    (
      (json['Type'] === 'Variant' || json['Type'] === 'Template') &&
      'Reference' in json
    )
  ) {
    return 'npc-role'
  }

  // 5. drop-table — Container with known type
  if (
    path.includes('/drops/') ||
    (
      typeof json['Container'] === 'object' &&
      json['Container'] !== null &&
      typeof (json['Container'] as Record<string, unknown>)['Type'] === 'string' &&
      ['Multiple', 'Choice', 'Single'].includes(
        (json['Container'] as Record<string, unknown>)['Type'] as string,
      )
    )
  ) {
    return 'drop-table'
  }

  // 5.5 block — must come before item (block JSONs also have ItemLevel/Icon)
  if ('BlockType' in json) {
    return 'block'
  }

  // 5.7 entity-stat — path-based or key shape (InitialValue + Min + Max)
  if (
    path.includes('/entity/stats/') ||
    path.includes('/entitystats/') ||
    (
      'InitialValue' in json &&
      'Min' in json &&
      'Max' in json
    )
  ) {
    return 'entity-stat'
  }

  // 5.8 sound-event — path or Layers array shape
  if (
    path.includes('/audio/soundevents/') ||
    path.includes('/soundevents/') ||
    Array.isArray(json['Layers'])
  ) {
    return 'sound-event'
  }

  // 5.9 item-sound-set — path or SoundEvents object
  if (
    path.includes('/audio/itemsounds/') ||
    path.includes('/itemsounds/') ||
    (typeof json['SoundEvents'] === 'object' && json['SoundEvents'] !== null && !Array.isArray(json['SoundEvents']))
  ) {
    return 'item-sound-set'
  }

  // 5.95 barter-shop — path or TradeSlots array
  if (
    path.includes('/bartershops/') ||
    path.includes('/barter/') ||
    Array.isArray(json['TradeSlots'])
  ) {
    return 'barter-shop'
  }

  // 5.97 npc-group — path only (JSON shape too generic)
  if (path.includes('/npc/groups/') || path.includes('/npcgroups/')) {
    return 'npc-group'
  }

  // 5.98 tag-pattern — path or Op+Patterns/Op+Tag shape
  if (
    path.includes('/tagpatterns/') ||
    path.includes('/tag/patterns/') ||
    (
      typeof json['Op'] === 'string' &&
      ['Or', 'And', 'Equals'].includes(json['Op'] as string) &&
      ('Patterns' in json || 'Tag' in json)
    )
  ) {
    return 'tag-pattern'
  }

  // 5.99 response-curve — path or Type in Exponential/Logistic/SineWave
  if (
    path.includes('/responsecurves/') ||
    path.includes('/response/curves/') ||
    (
      typeof json['Type'] === 'string' &&
      ['Exponential', 'Logistic', 'SineWave'].includes(json['Type'] as string) &&
      !('Container' in json)
    )
  ) {
    return 'response-curve'
  }

  // 6.1 movement-config — path
  if (
    path.includes('/entity/movementconfig/') ||
    path.includes('/movementconfigs/') ||
    path.includes('/movementconfig/')
  ) {
    return 'movement-config'
  }

  // 6.2 gameplay-config — path
  if (path.includes('/gameplayconfigs/') || path.includes('/gameplayconfig/')) {
    return 'gameplay-config'
  }

  // 6.3 objective — path
  if (path.includes('/objective/')) {
    return 'objective'
  }

  // 6.4 reputation — path
  if (path.includes('/reputation/')) {
    return 'reputation'
  }

  // 6.5 ambience-fx — path
  if (path.includes('/ambiencefx/') || (path.includes('/ambience/') && path.includes('/audio/'))) {
    return 'ambience-fx'
  }

  // 6.6 prefab — path or anchor + blocks fields
  if (
    path.includes('/prefabs/') ||
    ('blocks' in json && 'anchorX' in json)
  ) {
    return 'prefab'
  }

  // 7. item — heuristic (mirrors looksLikeItem)
  if (
    'Quality' in json ||
    'ItemLevel' in json ||
    'MaxDurability' in json ||
    'PlayerAnimationsId' in json ||
    ('Icon' in json && 'TranslationProperties' in json)
  ) {
    return 'item'
  }

  return 'unknown'
}
