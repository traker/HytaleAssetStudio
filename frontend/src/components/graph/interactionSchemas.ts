/**
 * Schemas for all Hytale interaction types.
 * Used by InteractionFormPanel and InteractionPalette.
 */

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string-ref'        // server ID string (external interaction reference)
  | 'array-ref'         // array of server ID refs / inline interactions
  | 'dict-stat-number'  // { StatId: number } like Costs: { Stamina: 0.1 }
  | 'dict-time'         // { "0": interaction, "0.35": interaction } (Charging.Next)
  | 'effects'           // { ItemAnimationId?, WorldSoundEventId?, LocalSoundEventId?, Trails?, CameraEffect? }
  | 'object'            // generic JSON object (shown as JSON textarea)
  | 'array-string'      // array of plain strings

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  required?: boolean
  description?: string
}

export type InteractionCategory =
  | 'control-flow'
  | 'entity-action'
  | 'block-action'
  | 'projectile'
  | 'inventory'
  | 'ui'
  | 'condition'
  | 'special'

export interface InteractionSchema {
  type: string
  label: string
  category: InteractionCategory
  /** fields rendered in the form panel (does NOT include Type which is implicit) */
  fields: FieldDef[]
  /**
   * Maps a JSON key that generates a graph edge to its edge-type label.
   * e.g. { Next: 'next', Failed: 'failed', Interactions: 'child' }
   */
  outgoingEdges: Record<string, string>
}

// ─────────────────────────────────────────────────────────────
// CONTROL FLOW
// ─────────────────────────────────────────────────────────────

const Simple: InteractionSchema = {
  type: 'Simple',
  label: 'Simple',
  category: 'control-flow',
  fields: [
    { key: 'RunTime', label: 'RunTime (s)', type: 'number', description: 'Duration in seconds before Next fires' },
    { key: 'Effects', label: 'Effects', type: 'effects' },
    { key: 'Next', label: 'Next', type: 'string-ref', description: 'Interaction to execute after RunTime' },
  ],
  outgoingEdges: { Next: 'next' },
}

const Serial: InteractionSchema = {
  type: 'Serial',
  label: 'Serial',
  category: 'control-flow',
  fields: [
    { key: 'Interactions', label: 'Interactions (list)', type: 'array-ref', required: true, description: 'Executed one after another' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Interactions: 'child', Next: 'next' },
}

const Parallel: InteractionSchema = {
  type: 'Parallel',
  label: 'Parallel',
  category: 'control-flow',
  fields: [
    { key: 'Interactions', label: 'Interactions (list)', type: 'array-ref', required: true, description: 'Executed simultaneously' },
    { key: 'ForkInteractions', label: 'Fork Interactions', type: 'array-ref' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Interactions: 'child', ForkInteractions: 'fork', Next: 'next' },
}

const Condition: InteractionSchema = {
  type: 'Condition',
  label: 'Condition',
  category: 'control-flow',
  fields: [
    { key: 'RequiredGameMode', label: 'Required Game Mode', type: 'string', description: 'e.g. Survival, Creative' },
    { key: 'Crouching', label: 'Crouching', type: 'boolean' },
    { key: 'Jumping', label: 'Jumping', type: 'boolean' },
    { key: 'Swimming', label: 'Swimming', type: 'boolean' },
    { key: 'InWater', label: 'In Water', type: 'boolean' },
    { key: 'OnGround', label: 'On Ground', type: 'boolean' },
    { key: 'Next', label: 'Next (condition met)', type: 'string-ref' },
    { key: 'Failed', label: 'Failed (condition not met)', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed' },
}

const Chaining: InteractionSchema = {
  type: 'Chaining',
  label: 'Chaining',
  category: 'control-flow',
  fields: [
    { key: 'ChainingAllowance', label: 'Chaining Allowance', type: 'number', description: 'How many chained hits are allowed' },
    { key: 'ChainId', label: 'Chain ID', type: 'string', description: 'Identifier shared across the chain (e.g. Sword_Swings)' },
    { key: 'Next', label: 'Next (array)', type: 'array-ref', description: 'List of interactions to chain through' },
    { key: 'Flags', label: 'Flags', type: 'object', description: '{ FlagName: interaction }' },
  ],
  outgoingEdges: { Next: 'child' },
}

const Charging: InteractionSchema = {
  type: 'Charging',
  label: 'Charging',
  category: 'control-flow',
  fields: [
    { key: 'Effects', label: 'Effects', type: 'effects' },
    { key: 'AllowIndefiniteHold', label: 'Allow Indefinite Hold', type: 'boolean' },
    { key: 'DisplayProgress', label: 'Display Progress', type: 'boolean' },
    { key: 'HorizontalSpeedMultiplier', label: 'Horizontal Speed Mult.', type: 'number' },
    { key: 'Delay', label: 'Delay', type: 'number' },
    { key: 'FailOnDamage', label: 'Fail On Damage', type: 'boolean' },
    { key: 'MouseSensitivityAdjustmentTarget', label: 'Mouse Sensitivity Target', type: 'number' },
    { key: 'MouseSensitivityAdjustmentDuration', label: 'Mouse Sensitivity Duration', type: 'number' },
    { key: 'Failed', label: 'Failed', type: 'string-ref', description: 'Interaction to execute if charging fails' },
    {
      key: 'Next',
      label: 'Next (time → interaction)',
      type: 'dict-time',
      description: 'Keys are time offsets in seconds from hold start. e.g. { "0": "InteractionId", "0.35": { Type: "Replace", ... } }',
    },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed' },
}

const Wielding: InteractionSchema = {
  type: 'Wielding',
  label: 'Wielding',
  category: 'control-flow',
  fields: [
    { key: 'RunTime', label: 'RunTime (s)', type: 'number' },
    { key: 'HorizontalSpeedMultiplier', label: 'Horizontal Speed Mult.', type: 'number' },
    { key: 'CancelOnOtherClick', label: 'Cancel On Other Click', type: 'boolean' },
    { key: 'FailOnDamage', label: 'Fail On Damage', type: 'boolean' },
    { key: 'Effects', label: 'Effects', type: 'effects' },
    { key: 'BlockedEffects', label: 'Blocked Effects', type: 'effects' },
    { key: 'DamageModifiers', label: 'Damage Modifiers', type: 'dict-stat-number', description: '{ Physical: 0.7, Projectile: 0.7 }' },
    { key: 'AngledWielding', label: 'Angled Wielding', type: 'object', description: '{ Angle, AngleDistance, DamageModifiers, KnockbackModifiers }' },
    { key: 'StaminaCost', label: 'Stamina Cost', type: 'object', description: '{ Value, CostType }' },
    { key: 'Forks', label: 'Forks', type: 'object', description: '{ Primary: { Interactions: [...] } }' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
    { key: 'Failed', label: 'Failed', type: 'string-ref' },
    { key: 'BlockedInteractions', label: 'Blocked Interactions', type: 'array-ref' },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed', BlockedInteractions: 'blocked' },
}

const Replace: InteractionSchema = {
  type: 'Replace',
  label: 'Replace',
  category: 'control-flow',
  fields: [
    { key: 'Var', label: 'Variable Name', type: 'string', required: true, description: 'Variable to substitute (e.g. Swing_Left)' },
    { key: 'DefaultOk', label: 'Default OK (no error if missing)', type: 'boolean' },
    { key: 'DefaultValue', label: 'Default Value', type: 'object', description: 'Usually { Interactions: [...] } with refs or inline interactions' },
    { key: 'Next', label: 'Next', type: 'string-ref', description: 'Optional follow-up interaction after replacement' },
  ],
  outgoingEdges: { DefaultValue: 'replace', Next: 'next' },
}

const Selector: InteractionSchema = {
  type: 'Selector',
  label: 'Selector',
  category: 'control-flow',
  fields: [
    { key: 'RunTime', label: 'RunTime (s)', type: 'number' },
    { key: 'FailOn', label: 'Fail On', type: 'string', description: 'Optional failure condition, e.g. Entity or Block' },
    { key: 'Effects', label: 'Effects', type: 'effects' },
    { key: 'Selector', label: 'Selector Config', type: 'object', description: '{ Id, Direction, MinAngle?, MaxAngle? }' },
    { key: 'HitBlock', label: 'HitBlock', type: 'object', description: '{ Interactions: [...] }' },
    { key: 'HitEntity', label: 'HitEntity', type: 'object', description: '{ Interactions: [...] }' },
    { key: 'HitNothing', label: 'HitNothing', type: 'object', description: '{ Interactions: [...] }' },
    { key: 'HitEntityRules', label: 'HitEntityRules', type: 'object', description: '[{ Matchers, Next }]' },
    { key: 'Next', label: 'Next (no hit)', type: 'string-ref' },
    { key: 'Failed', label: 'Failed', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed', HitBlock: 'hitBlock', HitEntity: 'hitEntity', HitNothing: 'hitNothing' },
}

// ─────────────────────────────────────────────────────────────
// ENTITY ACTIONS
// ─────────────────────────────────────────────────────────────

const DamageEntity: InteractionSchema = {
  type: 'DamageEntity',
  label: 'Damage Entity',
  category: 'entity-action',
  fields: [
    { key: 'Parent', label: 'Parent (DamageEntityParent ID)', type: 'string' },
    { key: 'DamageCalculator', label: 'Damage Calculator', type: 'object', description: '{ Type|Class, BaseDamage, RandomPercentageModifier, ... }' },
    { key: 'Effects', label: 'Effects', type: 'effects' },
    { key: 'DamageEffects', label: 'Damage Effects', type: 'object', description: '{ Knockback, WorldSoundEventId, WorldParticles, ... }' },
    { key: 'EntityStatsOnHit', label: 'Entity Stats On Hit', type: 'object', description: '[{ EntityStatId, Amount }]' },
  ],
  outgoingEdges: {},
}

const ApplyEffect: InteractionSchema = {
  type: 'ApplyEffect',
  label: 'Apply Effect',
  category: 'entity-action',
  fields: [
    { key: 'EffectId', label: 'Effect ID', type: 'string', required: true },
    { key: 'Duration', label: 'Duration (s)', type: 'number' },
    { key: 'Strength', label: 'Strength', type: 'number' },
    { key: 'Target', label: 'Target', type: 'string', description: 'e.g. Self, Hit' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

const ClearEntityEffect: InteractionSchema = {
  type: 'ClearEntityEffect',
  label: 'Clear Entity Effect',
  category: 'entity-action',
  fields: [
    { key: 'EffectId', label: 'Effect ID', type: 'string' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

const ChangeStat: InteractionSchema = {
  type: 'ChangeStat',
  label: 'Change Stat',
  category: 'entity-action',
  fields: [
    { key: 'Behaviour', label: 'Behaviour', type: 'string', description: 'e.g. Set, Add, Subtract' },
    { key: 'ValueType', label: 'Value Type', type: 'string', description: 'e.g. Absolute, Percentage, PercentageCurrent' },
    { key: 'StatModifiers', label: 'Stat Modifiers', type: 'dict-stat-number', description: '{ StatId: amount }' },
    { key: 'RunTime', label: 'RunTime (s)', type: 'number' },
    { key: 'Effects', label: 'Effects', type: 'effects' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
    { key: 'Failed', label: 'Failed', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed' },
}

const ChangeStatWithModifier: InteractionSchema = {
  type: 'ChangeStatWithModifier',
  label: 'Change Stat (Modifier)',
  category: 'entity-action',
  fields: [
    { key: 'InteractionModifierId', label: 'Interaction Modifier ID', type: 'string', description: 'Modifier source applied to the stat deltas' },
    { key: 'ValueType', label: 'Value Type', type: 'string', description: 'e.g. Absolute, Percentage' },
    { key: 'StatModifiers', label: 'Stat Modifiers', type: 'dict-stat-number', description: '{ StatId: amount }' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

const ApplyForce: InteractionSchema = {
  type: 'ApplyForce',
  label: 'Apply Force',
  category: 'entity-action',
  fields: [
    { key: 'Direction', label: 'Direction', type: 'object', description: '{ X, Y, Z }' },
    { key: 'Magnitude', label: 'Magnitude', type: 'number' },
    { key: 'RelativeToView', label: 'Relative To View', type: 'boolean' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

const SpawnNPC: InteractionSchema = {
  type: 'SpawnNPC',
  label: 'Spawn NPC',
  category: 'entity-action',
  fields: [
    { key: 'NpcId', label: 'NPC ID', type: 'string', required: true },
    { key: 'Count', label: 'Count', type: 'number', description: 'Number of NPCs to spawn' },
    { key: 'SpawnOffset', label: 'Spawn Offset', type: 'object', description: '{ X, Y, Z }' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

const Heal: InteractionSchema = {
  type: 'Heal',
  label: 'Heal',
  category: 'entity-action',
  fields: [
    { key: 'Amount', label: 'Amount', type: 'number', required: true },
    { key: 'Target', label: 'Target', type: 'string', description: 'e.g. Self, Hit' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

// ─────────────────────────────────────────────────────────────
// BLOCK ACTIONS
// ─────────────────────────────────────────────────────────────

const PlaceBlock: InteractionSchema = {
  type: 'PlaceBlock',
  label: 'Place Block',
  category: 'block-action',
  fields: [
    { key: 'BlockId', label: 'Block ID', type: 'string', required: true },
    { key: 'Offset', label: 'Offset', type: 'object' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

const ChangeBlock: InteractionSchema = {
  type: 'ChangeBlock',
  label: 'Change Block',
  category: 'block-action',
  fields: [
    { key: 'BlockId', label: 'New Block ID', type: 'string', required: true },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

const ChangeState: InteractionSchema = {
  type: 'ChangeState',
  label: 'Change State',
  category: 'block-action',
  fields: [
    { key: 'State', label: 'State', type: 'object', description: '{ StateKey: value }' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

const BreakBlock: InteractionSchema = {
  type: 'BreakBlock',
  label: 'Break Block',
  category: 'block-action',
  fields: [
    { key: 'Effects', label: 'Effects', type: 'effects' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

const UseBlock: InteractionSchema = {
  type: 'UseBlock',
  label: 'Use Block',
  category: 'block-action',
  fields: [
    { key: 'Next', label: 'Next', type: 'string-ref' },
    { key: 'Failed', label: 'Failed', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed' },
}

const BlockCondition: InteractionSchema = {
  type: 'BlockCondition',
  label: 'Block Condition',
  category: 'block-action',
  fields: [
    { key: 'BlockId', label: 'Block ID', type: 'string' },
    { key: 'Next', label: 'Next (block matches)', type: 'string-ref' },
    { key: 'Failed', label: 'Failed (no match)', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed' },
}

// ─────────────────────────────────────────────────────────────
// PROJECTILE
// ─────────────────────────────────────────────────────────────

const LaunchProjectile: InteractionSchema = {
  type: 'LaunchProjectile',
  label: 'Launch Projectile',
  category: 'projectile',
  fields: [
    { key: 'ProjectileId', label: 'Projectile ID', type: 'string', required: true },
    { key: 'Speed', label: 'Speed', type: 'number' },
    { key: 'Spread', label: 'Spread', type: 'number' },
    { key: 'Effects', label: 'Effects', type: 'effects' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

const Projectile: InteractionSchema = {
  type: 'Projectile',
  label: 'Projectile',
  category: 'projectile',
  fields: [
    { key: 'CollisionNext', label: 'CollisionNext', type: 'string-ref', description: 'On entity hit' },
    { key: 'GroundNext', label: 'GroundNext', type: 'string-ref', description: 'On ground hit' },
    { key: 'Effects', label: 'Effects', type: 'effects' },
  ],
  outgoingEdges: { CollisionNext: 'collisionNext', GroundNext: 'groundNext' },
}

// ─────────────────────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────────────────────

const Consume: InteractionSchema = {
  type: 'Consume',
  label: 'Consume',
  category: 'inventory',
  fields: [
    { key: 'Amount', label: 'Amount', type: 'number' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

const ModifyInventory: InteractionSchema = {
  type: 'ModifyInventory',
  label: 'Modify Inventory',
  category: 'inventory',
  fields: [
    { key: 'AdjustHeldItemQuantity', label: 'Adjust Held Item Quantity', type: 'number', description: 'Consume or refund the held stack, e.g. -1' },
    { key: 'AdjustHeldItemDurability', label: 'Adjust Held Item Durability', type: 'number', description: 'Durability delta applied to the held item' },
    { key: 'ItemToRemove', label: 'Item To Remove', type: 'object', description: '{ Id, Quantity, ... }' },
    { key: 'ItemToAdd', label: 'Item To Add', type: 'object', description: '{ Id, Quantity, ... }' },
    { key: 'BrokenItem', label: 'Broken Item', type: 'string', description: 'Optional replacement item returned when the held item breaks' },
    { key: 'NotifyOnBreak', label: 'Notify On Break', type: 'boolean' },
    { key: 'NotifyOnBreakMessage', label: 'Notify On Break Message', type: 'string' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
    { key: 'Failed', label: 'Failed', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed' },
}

const RefillContainer: InteractionSchema = {
  type: 'RefillContainer',
  label: 'Refill Container',
  category: 'inventory',
  fields: [
    { key: 'FluidId', label: 'Fluid ID', type: 'string' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

// ─────────────────────────────────────────────────────────────
// UI / COMMUNICATION
// ─────────────────────────────────────────────────────────────

const SendMessage: InteractionSchema = {
  type: 'SendMessage',
  label: 'Send Message',
  category: 'ui',
  fields: [
    { key: 'Message', label: 'Message', type: 'string', required: true },
    { key: 'Target', label: 'Target', type: 'string', description: 'e.g. Self, All' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

const ChainFlag: InteractionSchema = {
  type: 'ChainFlag',
  label: 'Chain Flag',
  category: 'ui',
  fields: [
    { key: 'FlagId', label: 'Flag ID', type: 'string', required: true },
    { key: 'Value', label: 'Value', type: 'boolean' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next' },
}

const FirstClick: InteractionSchema = {
  type: 'FirstClick',
  label: 'First Click',
  category: 'ui',
  fields: [
    { key: 'Next', label: 'Next (first click)', type: 'string-ref' },
    { key: 'Failed', label: 'Failed (subsequent)', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed' },
}

// ─────────────────────────────────────────────────────────────
// CONDITIONS
// ─────────────────────────────────────────────────────────────

const StatsCondition: InteractionSchema = {
  type: 'StatsCondition',
  label: 'Stats Condition',
  category: 'condition',
  fields: [
    { key: 'Costs', label: 'Costs', type: 'dict-stat-number', description: '{ Stamina: 0.1 } — consumed if condition met' },
    { key: 'ValueType', label: 'Value Type', type: 'string', description: 'e.g. Absolute or Percent' },
    { key: 'LessThan', label: 'Less Than', type: 'boolean', description: 'Invert the comparison to check if the stat is below the threshold' },
    { key: 'Lenient', label: 'Lenient', type: 'boolean', description: 'Observed in some assets as an optional relaxed evaluation flag' },
    { key: 'RunTime', label: 'RunTime (s)', type: 'number' },
    { key: 'Effects', label: 'Effects', type: 'effects' },
    { key: 'Next', label: 'Next (stats sufficient)', type: 'string-ref' },
    { key: 'Failed', label: 'Failed (insufficient stats)', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed' },
}

const StatsConditionWithModifier: InteractionSchema = {
  type: 'StatsConditionWithModifier',
  label: 'Stats Condition (Modifier)',
  category: 'condition',
  fields: [
    { key: 'Costs', label: 'Costs', type: 'dict-stat-number', description: 'Base stat costs before the modifier is applied' },
    { key: 'InteractionModifierId', label: 'Interaction Modifier ID', type: 'string', description: 'Modifier source used to scale the costs' },
    { key: 'Next', label: 'Next', type: 'string-ref' },
    { key: 'Failed', label: 'Failed', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed' },
}

const EffectCondition: InteractionSchema = {
  type: 'EffectCondition',
  label: 'Effect Condition',
  category: 'condition',
  fields: [
    { key: 'Entity', label: 'Entity', type: 'string', description: 'Optional entity target, e.g. Self or Target' },
    { key: 'EntityEffectIds', label: 'Entity Effect IDs', type: 'array-string', description: 'Effects to check for on the target entity' },
    { key: 'Match', label: 'Match', type: 'string', description: 'Any, None or All' },
    { key: 'Next', label: 'Next (condition met)', type: 'string-ref' },
    { key: 'Failed', label: 'Failed (condition not met)', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed' },
}

const MovementCondition: InteractionSchema = {
  type: 'MovementCondition',
  label: 'Movement Condition',
  category: 'condition',
  fields: [
    { key: 'ForwardLeft', label: 'Forward Left', type: 'string-ref' },
    { key: 'Forward', label: 'Forward', type: 'string-ref' },
    { key: 'ForwardRight', label: 'Forward Right', type: 'string-ref' },
    { key: 'Left', label: 'Left', type: 'string-ref' },
    { key: 'Right', label: 'Right', type: 'string-ref' },
    { key: 'BackLeft', label: 'Back Left', type: 'string-ref' },
    { key: 'Back', label: 'Back', type: 'string-ref' },
    { key: 'BackRight', label: 'Back Right', type: 'string-ref' },
    { key: 'Failed', label: 'Failed', type: 'string-ref' },
  ],
  outgoingEdges: {
    ForwardLeft: 'next',
    Forward: 'next',
    ForwardRight: 'next',
    Left: 'next',
    Right: 'next',
    BackLeft: 'next',
    Back: 'next',
    BackRight: 'next',
    Failed: 'failed',
  },
}

const PlacementCountCondition: InteractionSchema = {
  type: 'PlacementCountCondition',
  label: 'Placement Count Condition',
  category: 'condition',
  fields: [
    { key: 'BlockId', label: 'Block ID', type: 'string' },
    { key: 'MaxCount', label: 'Max Count', type: 'number' },
    { key: 'Next', label: 'Next (under limit)', type: 'string-ref' },
    { key: 'Failed', label: 'Failed (at limit)', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed' },
}

const MemoriesCondition: InteractionSchema = {
  type: 'MemoriesCondition',
  label: 'Memories Condition',
  category: 'condition',
  fields: [
    { key: 'MemoryId', label: 'Memory ID', type: 'string', required: true },
    { key: 'Next', label: 'Next (memory set)', type: 'string-ref' },
    { key: 'Failed', label: 'Failed (memory not set)', type: 'string-ref' },
  ],
  outgoingEdges: { Next: 'next', Failed: 'failed' },
}

const TeleportInstance: InteractionSchema = {
  type: 'TeleportInstance',
  label: 'Teleport Instance',
  category: 'special',
  fields: [
    { key: 'InstanceName', label: 'Instance Name', type: 'string', description: 'Destination instance name, e.g. Persistent' },
    { key: 'InstanceKey', label: 'Instance Key', type: 'string', description: 'Instance identifier used by the portal or destination config' },
    { key: 'PositionOffset', label: 'Position Offset', type: 'object', description: '{ X, Y, Z } offset applied at the destination' },
    { key: 'Rotation', label: 'Rotation', type: 'object', description: '{ Yaw } orientation at destination' },
    { key: 'OriginSource', label: 'Origin Source', type: 'string', description: 'Observed values include Block and Entity' },
    { key: 'PersonalReturnPoint', label: 'Personal Return Point', type: 'boolean' },
    { key: 'CloseOnBlockRemove', label: 'Close On Block Remove', type: 'boolean' },
    { key: 'RemoveBlockAfter', label: 'Remove Block After', type: 'number', description: 'Optional delay before the source block is removed' },
  ],
  outgoingEdges: {},
}

const TeleportConfigInstance: InteractionSchema = {
  type: 'TeleportConfigInstance',
  label: 'Teleport Config Instance',
  category: 'special',
  fields: [],
  outgoingEdges: {},
}

const OpenContainer: InteractionSchema = {
  type: 'OpenContainer',
  label: 'Open Container',
  category: 'ui',
  fields: [],
  outgoingEdges: {},
}

const OpenProcessingBench: InteractionSchema = {
  type: 'OpenProcessingBench',
  label: 'Open Processing Bench',
  category: 'ui',
  fields: [],
  outgoingEdges: {},
}

const Explode: InteractionSchema = {
  type: 'Explode',
  label: 'Explode',
  category: 'special',
  fields: [
    { key: 'Parent', label: 'Parent', type: 'string', description: 'Optional shared explosion template to inherit from' },
    { key: 'RunTime', label: 'RunTime (s)', type: 'number' },
    { key: 'Effects', label: 'Effects', type: 'object', description: 'Explosion VFX/SFX payload, often with sounds and particles' },
    { key: 'Config', label: 'Config', type: 'object', description: 'Explosion config: damage, radii, knockback, item tool specs, drop chance' },
  ],
  outgoingEdges: {},
}

const SpawnPrefab: InteractionSchema = {
  type: 'SpawnPrefab',
  label: 'Spawn Prefab',
  category: 'special',
  fields: [
    { key: 'PrefabPath', label: 'Prefab Path', type: 'string', required: true, description: 'Relative prefab file path, e.g. Example_Portal1.prefab.json' },
    { key: 'Offset', label: 'Offset', type: 'object', description: '{ X, Y, Z } offset from the origin source' },
    { key: 'RotationYaw', label: 'Rotation Yaw', type: 'string', description: 'Observed values include Zero, Ninety, OneEighty, TwoSeventy' },
    { key: 'OriginSource', label: 'Origin Source', type: 'string', description: 'Observed values include Block and Entity' },
    { key: 'Force', label: 'Force Placement', type: 'boolean' },
  ],
  outgoingEdges: {},
}

const SpawnDrops: InteractionSchema = {
  type: 'SpawnDrops',
  label: 'Spawn Drops',
  category: 'special',
  fields: [
    { key: 'DropList', label: 'Drop List', type: 'string', description: 'Drop table id from Server/Drops, e.g. Drop_Chicken_Produce' },
  ],
  outgoingEdges: {},
}

const UseEntity: InteractionSchema = {
  type: 'UseEntity',
  label: 'Use Entity',
  category: 'entity-action',
  fields: [
    { key: 'Failed', label: 'Failed', type: 'string-ref', description: 'Fallback interaction if the target entity has no usable interaction' },
  ],
  outgoingEdges: { Failed: 'failed' },
}

const UseCoop: InteractionSchema = {
  type: 'UseCoop',
  label: 'Use Coop',
  category: 'block-action',
  fields: [],
  outgoingEdges: {},
}

const ResetCooldown: InteractionSchema = {
  type: 'ResetCooldown',
  label: 'Reset Cooldown',
  category: 'special',
  fields: [
    { key: 'Cooldown', label: 'Cooldown', type: 'object', description: '{ Id, Cooldown } target cooldown definition to reset or override' },
  ],
  outgoingEdges: {},
}

// ─────────────────────────────────────────────────────────────
// SPECIAL
// ─────────────────────────────────────────────────────────────

/**
 * _ref — placeholder node that points to an external interaction file by ServerId.
 * Exports as a bare string (the ServerId), not as an inline object.
 */
const ExternalRef: InteractionSchema = {
  type: '_ref',
  label: 'External Reference',
  category: 'special',
  fields: [
    {
      key: 'ServerId',
      label: 'Server ID',
      type: 'string',
      required: true,
      description: 'ID of the target interaction file (e.g. Weapon_Sword_Primary_Chain)',
    },
  ],
  outgoingEdges: {},
}

// ─────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────

export const INTERACTION_SCHEMAS: InteractionSchema[] = [
  // Control Flow
  Simple, Serial, Parallel, Condition, Chaining, Charging, Wielding, Replace, Selector,
  // Entity Actions
  DamageEntity, ApplyEffect, ClearEntityEffect, ChangeStat, ChangeStatWithModifier,
  ApplyForce, SpawnNPC, Heal,
  // Block Actions
  PlaceBlock, ChangeBlock, ChangeState, BreakBlock, UseBlock, BlockCondition,
  // Projectile
  LaunchProjectile, Projectile,
  // Inventory
  Consume, ModifyInventory, RefillContainer,
  // UI
  SendMessage, ChainFlag, FirstClick,
  // Conditions
  StatsCondition, StatsConditionWithModifier, EffectCondition,
  MovementCondition,
  PlacementCountCondition, MemoriesCondition,
  // Lot 4 coverage
  TeleportInstance, TeleportConfigInstance,
  OpenContainer, OpenProcessingBench,
  Explode, SpawnPrefab, SpawnDrops, UseEntity, UseCoop, ResetCooldown,
  // Special
  ExternalRef,
]

export const SCHEMA_BY_TYPE = new Map(INTERACTION_SCHEMAS.map((s) => [s.type, s]))

export function getSchemaForType(type: string): InteractionSchema | undefined {
  return SCHEMA_BY_TYPE.get(type)
}

export const CATEGORY_LABELS: Record<InteractionCategory, string> = {
  'control-flow': 'Control Flow',
  'entity-action': 'Entity Actions',
  'block-action': 'Block Actions',
  'projectile': 'Projectile',
  'inventory': 'Inventory',
  'ui': 'UI / Communication',
  'condition': 'Conditions',
  'special': 'Special',
}

export const CATEGORY_ORDER: InteractionCategory[] = [
  'special',
  'control-flow',
  'entity-action',
  'condition',
  'block-action',
  'projectile',
  'inventory',
  'ui',
]
