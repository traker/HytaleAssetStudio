/**
 * assetTypeRegistry — single source of truth for asset type detection.
 *
 * detectAssetKind() returns a discriminated AssetKind based on JSON shape and vfsPath.
 * All form editor routing in AssetSidePanel must use this function.
 *
 * Detection order is deterministic (more specific before more general):
 *   entity-effect → projectile-config → projectile → npc-role → drop-table → item → unknown
 */

export type AssetKind =
  | 'item'               // Server/Item/Items/ — items, blocks, potions, tools…
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

  // 5. item — heuristic (mirrors looksLikeItem)
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
