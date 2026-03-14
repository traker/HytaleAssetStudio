/**
 * InteractionVarsEditor — structured editor for the `InteractionVars` block
 * present in many Hytale item/asset JSON files (weapons, armors, NPCs…).
 *
 * Structure handled:
 *   InteractionVars: {
 *     [VarName]: {
 *       Interactions: [
 *         {
 *           Parent?: string
 *           DamageCalculator?: { BaseDamage?: { [stat]: number } }
 *           DamageEffects?: { WorldSoundEventId?: string; LocalSoundEventId?: string }
 *           EntityStatsOnHit?: Array<{ EntityStatId: string; Amount: number }>
 *           StaminaCost?: { Value?: number; CostType?: string }
 *           // any other key → shown as JSON textarea
 *         }
 *       ]
 *     }
 *   }
 */

import { useState } from 'react'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type DamageStats = Record<string, number>
type DamageCalculator = { BaseDamage?: DamageStats; [k: string]: unknown }
type DamageEffects = { WorldSoundEventId?: string; LocalSoundEventId?: string; [k: string]: unknown }
type StatOnHit = { EntityStatId: string; Amount: number }
type StaminaCost = { Value?: number; CostType?: string }

type InteractionInline = {
  Parent?: string
  DamageCalculator?: DamageCalculator
  DamageEffects?: DamageEffects
  EntityStatsOnHit?: StatOnHit[]
  StaminaCost?: StaminaCost
  [k: string]: unknown
}

type InteractionValue = string | InteractionInline

type VarEntry = {
  Interactions: InteractionValue[]
  [k: string]: unknown
}
export type InteractionVarsValue = Record<string, VarEntry>

export type InteractionVarsEditorProps = {
  vars: InteractionVarsValue
  onChange: (updated: InteractionVarsValue) => void
}

// ─────────────────────────────────────────────────────────────
// Style constants
// ─────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#1a1a2e',
  border: '1px solid #3a3a5c',
  borderRadius: 4,
  color: '#ddd',
  fontSize: 12,
  padding: '4px 7px',
  outline: 'none',
  fontFamily: 'monospace',
}

const SMALL_INPUT: React.CSSProperties = {
  ...INPUT_STYLE,
  fontSize: 11,
  padding: '3px 6px',
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: '#777',
  marginBottom: 2,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  color: '#555',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginTop: 8,
  marginBottom: 4,
}

const ADD_BTN: React.CSSProperties = {
  background: 'transparent',
  border: '1px dashed #444',
  borderRadius: 3,
  color: '#666',
  cursor: 'pointer',
  fontSize: 11,
  padding: '2px 8px',
  marginTop: 4,
}

const REMOVE_BTN: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#FF6B6B',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  padding: '0 3px',
  flexShrink: 0,
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const KNOWN_INTERACTION_KEYS = new Set([
  'Type',
  'Parent',
  'EffectId',
  'Entity',
  'Config',
  'Next',
  'Interactions',
  'DamageCalculator',
  'DamageEffects',
  'EntityStatsOnHit',
  'StaminaCost',
])

const VANILLA_TYPED_INTERACTIONS = ['ApplyEffect', 'Projectile', 'Serial'] as const

function asObj(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
}

function isInteractionInline(v: unknown): v is InteractionInline {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function jsonStringify(v: unknown): string {
  return JSON.stringify(v, null, 2)
}

function setOptionalRecordValue(
  source: Record<string, unknown>,
  key: string,
  value: unknown,
): Record<string, unknown> {
  const updated = { ...source }
  if (value === undefined || value === null || value === '') delete updated[key]
  else updated[key] = value
  return updated
}

function knownKeysForInteractionType(type: string | undefined): Set<string> {
  const keys = new Set(KNOWN_INTERACTION_KEYS)
  if (type === 'ApplyEffect') {
    keys.add('EffectId')
    keys.add('Entity')
  }
  if (type === 'Projectile') {
    keys.add('Config')
    keys.add('Next')
  }
  if (type === 'Serial') {
    keys.add('Interactions')
  }
  return keys
}

function JsonObjectEditor({
  label,
  description,
  value,
  onChange,
  placeholder,
  minHeight = 70,
}: {
  label: string
  description?: string
  value: unknown
  onChange: (updated: unknown) => void
  placeholder: string
  minHeight?: number
}) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      {description && <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>{description}</div>}
      <textarea
        rows={4}
        defaultValue={value === undefined ? '' : jsonStringify(value)}
        onBlur={(e) => {
          const raw = e.target.value.trim()
          if (!raw) {
            onChange(undefined)
            return
          }
          try {
            onChange(JSON.parse(raw))
          } catch {
            // Ignore invalid JSON while editing.
          }
        }}
        style={{
          ...INPUT_STYLE,
          resize: 'vertical',
          minHeight,
          lineHeight: 1.4,
          fontSize: 11,
        }}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  )
}

function InteractionExtrasEditor({
  interaction,
  excludedKeys,
  onChange,
}: {
  interaction: InteractionInline
  excludedKeys: Set<string>
  onChange: (updated: InteractionInline) => void
}) {
  const extraKeys = Object.keys(interaction).filter((k) => !excludedKeys.has(k))

  return (
    <>
      {extraKeys.map((k) => {
        const val = interaction[k]
        const isComplex = typeof val === 'object' && val !== null
        return (
          <div key={k}>
            <label style={{ ...LABEL, color: '#666' }}>{k} (extra)</label>
            {isComplex ? (
              <textarea
                rows={3}
                defaultValue={jsonStringify(val)}
                onBlur={(e) => {
                  try { onChange({ ...interaction, [k]: JSON.parse(e.target.value) }) } catch { /* ignore */ }
                }}
                style={{
                  ...INPUT_STYLE,
                  resize: 'vertical',
                  minHeight: 50,
                  lineHeight: 1.4,
                  fontSize: 11,
                }}
                spellCheck={false}
              />
            ) : (
              <input
                type="text"
                defaultValue={val === undefined || val === null ? '' : String(val)}
                onBlur={(e) => onChange({ ...interaction, [k]: e.target.value || undefined })}
                style={SMALL_INPUT}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

function ApplyEffectFields({
  interaction,
  onChange,
}: {
  interaction: InteractionInline
  onChange: (updated: InteractionInline) => void
}) {
  const effectId = interaction.EffectId
  const effectIdIsString = typeof effectId === 'string' || effectId === undefined
  const entity = typeof interaction.Entity === 'string' ? interaction.Entity : ''

  return (
    <div>
      <div style={SECTION_LABEL}>Apply Effect</div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
        <button
          type="button"
          onClick={() => onChange({ ...interaction, EffectId: typeof effectId === 'string' ? effectId : '' })}
          style={{
            background: effectIdIsString ? '#22314a' : 'transparent',
            border: '1px solid #334766',
            color: effectIdIsString ? '#9fd3ff' : '#6f87a8',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 10,
            padding: '2px 6px',
          }}
        >
          Effect Ref
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...interaction, EffectId: typeof effectId === 'object' && effectId !== null ? effectId : {} })}
          style={{
            background: !effectIdIsString ? '#2f2745' : 'transparent',
            border: '1px solid #4b3e6b',
            color: !effectIdIsString ? '#d4c3ff' : '#8a7fb1',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 10,
            padding: '2px 6px',
          }}
        >
          Effect Object
        </button>
      </div>

      {effectIdIsString ? (
        <div style={{ marginBottom: 6 }}>
          <label style={LABEL}>Effect ID</label>
          <input
            type="text"
            value={typeof effectId === 'string' ? effectId : ''}
            onChange={(e) => onChange(setOptionalRecordValue(interaction, 'EffectId', e.target.value || undefined) as InteractionInline)}
            style={SMALL_INPUT}
            placeholder="Potion_Health"
          />
        </div>
      ) : (
        <div style={{ marginBottom: 6 }}>
          <JsonObjectEditor
            label="EffectId"
            description="Observed vanilla form for inline effect definitions used by potions and environmental effects."
            value={effectId}
            onChange={(updated) => onChange(setOptionalRecordValue(interaction, 'EffectId', updated) as InteractionInline)}
            placeholder={'{\n  "StatModifiers": { "Health": 40 },\n  "ValueType": "Percent"\n}'}
          />
        </div>
      )}

      <div>
        <label style={LABEL}>Entity</label>
        <input
          type="text"
          value={entity}
          onChange={(e) => onChange(setOptionalRecordValue(interaction, 'Entity', e.target.value || undefined) as InteractionInline)}
          style={SMALL_INPUT}
          placeholder="Target"
        />
      </div>
    </div>
  )
}

function ProjectileFields({
  interaction,
  onChange,
}: {
  interaction: InteractionInline
  onChange: (updated: InteractionInline) => void
}) {
  const config = typeof interaction.Config === 'string' ? interaction.Config : ''
  const next = interaction.Next

  return (
    <div>
      <div style={SECTION_LABEL}>Projectile</div>
      <div style={{ marginBottom: 6 }}>
        <label style={LABEL}>Config</label>
        <input
          type="text"
          value={config}
          onChange={(e) => onChange(setOptionalRecordValue(interaction, 'Config', e.target.value || undefined) as InteractionInline)}
          style={SMALL_INPUT}
          placeholder="Projectile_Config_Bow_Combat"
        />
      </div>

      <div>
        <label style={LABEL}>Next</label>
        <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>Observed vanilla follow-up after projectile launch.</div>
        <InteractionValueEditor
          value={typeof next === 'string' || isInteractionInline(next) ? next : ''}
          onChange={(updated) => onChange(setOptionalRecordValue(interaction, 'Next', updated) as InteractionInline)}
        />
      </div>
    </div>
  )
}

function SerialFields({
  interaction,
  onChange,
}: {
  interaction: InteractionInline
  onChange: (updated: InteractionInline) => void
}) {
  const interactions = Array.isArray(interaction.Interactions)
    ? interaction.Interactions.filter((entry) => typeof entry === 'string' || isInteractionInline(entry)) as InteractionValue[]
    : []

  function updateNestedInteraction(index: number, updated: InteractionValue) {
    const next = interactions.map((entry, entryIndex) => entryIndex === index ? updated : entry)
    onChange({ ...interaction, Interactions: next })
  }

  function removeNestedInteraction(index: number) {
    const next = interactions.filter((_, entryIndex) => entryIndex !== index)
    onChange(next.length > 0 ? { ...interaction, Interactions: next } : setOptionalRecordValue(interaction, 'Interactions', undefined) as InteractionInline)
  }

  function addNestedInteraction() {
    onChange({ ...interaction, Interactions: [...interactions, ''] })
  }

  return (
    <div>
      <div style={SECTION_LABEL}>Serial Interactions</div>
      {interactions.length === 0 && (
        <div style={{ color: '#555', fontStyle: 'italic', fontSize: 11, marginBottom: 6 }}>No serial steps.</div>
      )}
      {interactions.map((entry, index) => (
        <div key={`serial-${index}`} style={{ marginBottom: 8, padding: '6px 8px', border: '1px solid #242438', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#555' }}>Step #{index + 1}</span>
            <button type="button" onClick={() => removeNestedInteraction(index)} style={{ ...REMOVE_BTN, fontSize: 11 }}>× remove</button>
          </div>
          <InteractionValueEditor value={entry} onChange={(updated) => updateNestedInteraction(index, updated)} />
        </div>
      ))}
      <button type="button" onClick={addNestedInteraction} style={ADD_BTN}>+ Add serial step</button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sub-component: single interaction inline editor
// ─────────────────────────────────────────────────────────────

function InlineInteractionEditor({
  interaction,
  onChange,
}: {
  interaction: InteractionInline
  onChange: (updated: InteractionInline) => void
}) {
  function set<K extends keyof InteractionInline>(k: K, v: InteractionInline[K]) {
    onChange({ ...interaction, [k]: v })
  }

  const interactionType = typeof interaction.Type === 'string' ? interaction.Type : ''

  // ── Parent ──────────────────────────────────────────────
  const parent = typeof interaction.Parent === 'string' ? interaction.Parent : ''

  // ── DamageCalculator.BaseDamage ─────────────────────────
  const dc = asObj(interaction.DamageCalculator)
  const bd = asObj(dc['BaseDamage'])
  const baseDamageEntries = Object.entries(bd) as [string, number][]

  function setBdEntry(stat: string, amount: number) {
    const updated: DamageStats = { ...(bd as DamageStats), [stat]: amount }
    set('DamageCalculator', { ...dc, BaseDamage: updated })
  }
  function removeBdEntry(stat: string) {
    const updated: DamageStats = { ...(bd as DamageStats) }
    delete updated[stat]
    set('DamageCalculator', { ...dc, BaseDamage: Object.keys(updated).length > 0 ? updated : undefined })
  }
  function addBdEntry() {
    // find a stat name not yet used
    const candidates = ['Physical', 'Fire', 'Ice', 'Lightning', 'Poison', 'Holy', 'Dark']
    const next = candidates.find((c) => !(c in bd)) ?? `Stat_${Date.now()}`
    set('DamageCalculator', { ...dc, BaseDamage: { ...(bd as DamageStats), [next]: 0 } })
  }
  function renameBdEntry(oldStat: string, newStat: string) {
    if (!newStat.trim() || newStat === oldStat) return
    const updated: DamageStats = {}
    for (const [k, v] of Object.entries(bd)) {
      updated[k === oldStat ? newStat : k] = v as number
    }
    set('DamageCalculator', { ...dc, BaseDamage: updated })
  }

  // ── DamageEffects ────────────────────────────────────────
  const de = asObj(interaction.DamageEffects)
  const worldSfx = typeof de['WorldSoundEventId'] === 'string' ? de['WorldSoundEventId'] : ''
  const localSfx = typeof de['LocalSoundEventId'] === 'string' ? de['LocalSoundEventId'] : ''
  function setDe(key: string, val: string) {
    const updated = { ...de, [key]: val || undefined }
    if (!val) delete updated[key]
    set('DamageEffects', Object.keys(updated).length > 0 ? updated : undefined)
  }

  // ── EntityStatsOnHit ─────────────────────────────────────
  const statsOnHit: StatOnHit[] = Array.isArray(interaction.EntityStatsOnHit)
    ? (interaction.EntityStatsOnHit as StatOnHit[])
    : []
  function updateStatOnHit(idx: number, updated: StatOnHit) {
    const next = statsOnHit.map((s, i) => (i === idx ? updated : s))
    set('EntityStatsOnHit', next)
  }
  function removeStatOnHit(idx: number) {
    const next = statsOnHit.filter((_, i) => i !== idx)
    set('EntityStatsOnHit', next.length > 0 ? next : undefined)
  }
  function addStatOnHit() {
    set('EntityStatsOnHit', [...statsOnHit, { EntityStatId: 'SignatureEnergy', Amount: 1 }])
  }

  // ── StaminaCost ──────────────────────────────────────────
  const sc = asObj(interaction.StaminaCost) as StaminaCost
  const scValue = typeof sc.Value === 'number' ? sc.Value : undefined
  const scType = typeof sc.CostType === 'string' ? sc.CostType : ''
  function setSc(k: keyof StaminaCost, v: number | string | undefined) {
    const updated = { ...sc, [k]: v }
    if (v === undefined || v === '') delete updated[k]
    set('StaminaCost', Object.keys(updated).length > 0 ? updated : undefined)
  }

  const knownKeys = knownKeysForInteractionType(interactionType)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

      <div>
        <label style={LABEL}>Type</label>
        <input
          type="text"
          value={interactionType}
          onChange={(e) => set('Type', e.target.value || undefined)}
          style={SMALL_INPUT}
          list="interaction-vars-vanilla-types"
          placeholder="Simple"
        />
        <datalist id="interaction-vars-vanilla-types">
          {VANILLA_TYPED_INTERACTIONS.map((typeName) => (
            <option key={typeName} value={typeName} />
          ))}
          <option value="Simple" />
          <option value="ModifyInventory" />
          <option value="ChangeStat" />
          <option value="ResetCooldown" />
        </datalist>
      </div>

      {/* Parent */}
      <div>
        <label style={LABEL}>Parent</label>
        <input
          type="text"
          value={parent}
          onChange={(e) => set('Parent', e.target.value || undefined)}
          style={SMALL_INPUT}
          placeholder="Parent interaction ID"
        />
      </div>

      {interactionType === 'ApplyEffect' && (
        <ApplyEffectFields interaction={interaction} onChange={onChange} />
      )}

      {interactionType === 'Projectile' && (
        <ProjectileFields interaction={interaction} onChange={onChange} />
      )}

      {interactionType === 'Serial' && (
        <SerialFields interaction={interaction} onChange={onChange} />
      )}

      {/* DamageCalculator.BaseDamage */}
      <div>
        <div style={SECTION_LABEL}>Base Damage</div>
        {baseDamageEntries.map(([stat, amount]) => (
          <div key={stat} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3 }}>
            <input
              type="text"
              defaultValue={stat}
              onBlur={(e) => renameBdEntry(stat, e.target.value)}
              style={{ ...SMALL_INPUT, width: 110 }}
              placeholder="Stat"
            />
            <span style={{ color: '#444', fontSize: 11, flexShrink: 0 }}>:</span>
            <input
              type="number"
              value={amount}
              step="any"
              onChange={(e) => setBdEntry(stat, parseFloat(e.target.value) || 0)}
              style={{ ...SMALL_INPUT, width: 70 }}
            />
            <button onClick={() => removeBdEntry(stat)} style={REMOVE_BTN} title="Remove">×</button>
          </div>
        ))}
        <button onClick={addBdEntry} style={ADD_BTN}>+ Add stat</button>
      </div>

      {/* DamageEffects */}
      <div>
        <div style={SECTION_LABEL}>Damage Effects (SFX)</div>
        <div style={{ marginBottom: 3 }}>
          <label style={{ ...LABEL, color: '#555' }}>World</label>
          <input
            type="text"
            value={worldSfx}
            onChange={(e) => setDe('WorldSoundEventId', e.target.value)}
            style={SMALL_INPUT}
            placeholder="SFX_MyWeapon_Impact"
          />
        </div>
        <div>
          <label style={{ ...LABEL, color: '#555' }}>Local</label>
          <input
            type="text"
            value={localSfx}
            onChange={(e) => setDe('LocalSoundEventId', e.target.value)}
            style={SMALL_INPUT}
            placeholder="SFX_MyWeapon_Impact"
          />
        </div>
      </div>

      {/* EntityStatsOnHit */}
      <div>
        <div style={SECTION_LABEL}>Entity Stats On Hit</div>
        {statsOnHit.map((stat, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3 }}>
            <input
              type="text"
              value={stat.EntityStatId}
              onChange={(e) => updateStatOnHit(idx, { ...stat, EntityStatId: e.target.value })}
              style={{ ...SMALL_INPUT, flex: 1 }}
              placeholder="EntityStatId"
            />
            <input
              type="number"
              value={stat.Amount}
              step="any"
              onChange={(e) => updateStatOnHit(idx, { ...stat, Amount: parseFloat(e.target.value) || 0 })}
              style={{ ...SMALL_INPUT, width: 60 }}
              placeholder="Amt"
            />
            <button onClick={() => removeStatOnHit(idx)} style={REMOVE_BTN} title="Remove">×</button>
          </div>
        ))}
        <button onClick={addStatOnHit} style={ADD_BTN}>+ Add stat</button>
      </div>

      {/* StaminaCost */}
      <div>
        <div style={SECTION_LABEL}>Stamina Cost</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label style={{ ...LABEL, color: '#555' }}>Value</label>
            <input
              type="number"
              step="any"
              value={scValue ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim()
                setSc('Value', v === '' ? undefined : parseFloat(v))
              }}
              style={SMALL_INPUT}
              placeholder="0.0"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ ...LABEL, color: '#555' }}>Type</label>
            <input
              type="text"
              value={scType}
              onChange={(e) => setSc('CostType', e.target.value || undefined)}
              style={SMALL_INPUT}
              placeholder="e.g. Damage"
            />
          </div>
        </div>
      </div>

      {/* Extra unknown keys */}
      <InteractionExtrasEditor interaction={interaction} excludedKeys={knownKeys} onChange={onChange} />
    </div>
  )
}

function InteractionValueEditor({
  value,
  onChange,
}: {
  value: InteractionValue
  onChange: (updated: InteractionValue) => void
}) {
  const isRef = typeof value === 'string'
  const interaction = isInteractionInline(value) ? value : {}
  const interactionType = typeof interaction.Type === 'string' ? interaction.Type : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onChange(typeof value === 'string' ? value : '')}
          style={{
            background: isRef ? '#22314a' : 'transparent',
            border: '1px solid #334766',
            color: isRef ? '#9fd3ff' : '#6f87a8',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 10,
            padding: '2px 6px',
          }}
        >
          Ref
        </button>
        <button
          type="button"
          onClick={() => onChange(isInteractionInline(value) ? value : { Type: 'Simple' })}
          style={{
            background: !isRef ? '#2f2745' : 'transparent',
            border: '1px solid #4b3e6b',
            color: !isRef ? '#d4c3ff' : '#8a7fb1',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 10,
            padding: '2px 6px',
          }}
        >
          Inline
        </button>
        {!isRef && interactionType && (
          <span style={{ fontSize: 10, color: '#7a7198' }}>Type: {interactionType}</span>
        )}
      </div>

      {isRef ? (
        <div>
          <label style={LABEL}>Interaction Reference</label>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={SMALL_INPUT}
            placeholder="FineCraft_Harmony_Instrument_Primary_Flute"
          />
        </div>
      ) : (
        <InlineInteractionEditor interaction={interaction} onChange={onChange} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sub-component: single var section (collapsible)
// ─────────────────────────────────────────────────────────────

function VarSection({
  varName,
  entry,
  onChangeEntry,
  onRemoveVar,
}: {
  varName: string
  entry: VarEntry
  onChangeEntry: (updated: VarEntry) => void
  onRemoveVar: () => void
}) {
  const [open, setOpen] = useState(true)

  const interactions: InteractionValue[] = Array.isArray(entry.Interactions)
    ? entry.Interactions.filter((interaction) => typeof interaction === 'string' || isInteractionInline(interaction))
    : []

  const extraEntryFields = Object.fromEntries(
    Object.entries(entry).filter(([key]) => key !== 'Interactions'),
  )

  function updateInteraction(idx: number, updated: InteractionValue) {
    const next = interactions.map((it, i) => (i === idx ? updated : it))
    onChangeEntry({ ...entry, Interactions: next })
  }

  function removeInteraction(idx: number) {
    const next = interactions.filter((_, i) => i !== idx)
    onChangeEntry({ ...entry, Interactions: next })
  }

  function addInteraction() {
    onChangeEntry({ ...entry, Interactions: [...interactions, ''] })
  }

  return (
    <div
      style={{
        marginBottom: 8,
        borderRadius: 5,
        border: '1px solid #2a2a3c',
        overflow: 'hidden',
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 10px',
          background: '#1c1c2e',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setOpen((p) => !p)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#888', fontSize: 10 }}>{open ? '▾' : '▸'}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#a0a0d0', fontFamily: 'monospace' }}>
            {varName}
          </span>
          <span style={{ fontSize: 10, color: '#555' }}>
            ({interactions.length} interaction{interactions.length !== 1 ? 's' : ''})
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemoveVar() }}
          style={{ ...REMOVE_BTN, fontSize: 13 }}
          title="Remove var"
        >
          ×
        </button>
      </div>

      {/* Section body */}
      {open && (
        <div style={{ padding: '8px 12px', background: '#161624' }}>
          {Object.keys(extraEntryFields).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <label style={{ ...LABEL, color: '#666' }}>Additional Var Entry Fields</label>
              <textarea
                rows={3}
                defaultValue={JSON.stringify(extraEntryFields, null, 2)}
                onBlur={(e) => {
                  const raw = e.target.value.trim()
                  if (!raw) {
                    onChangeEntry({ Interactions: interactions })
                    return
                  }
                  try {
                    const parsed = JSON.parse(raw)
                    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                      onChangeEntry({ ...(parsed as Record<string, unknown>), Interactions: interactions })
                    }
                  } catch {
                    // Ignore invalid JSON while editing.
                  }
                }}
                style={{
                  ...INPUT_STYLE,
                  resize: 'vertical',
                  minHeight: 50,
                  lineHeight: 1.4,
                  fontSize: 11,
                }}
                spellCheck={false}
              />
            </div>
          )}
          {interactions.length === 0 && (
            <div style={{ color: '#555', fontStyle: 'italic', fontSize: 11 }}>No interactions.</div>
          )}
          {interactions.map((it, idx) => (
            <div key={idx}>
              {interactions.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#555' }}>#{idx + 1}</span>
                  <button onClick={() => removeInteraction(idx)} style={{ ...REMOVE_BTN, fontSize: 11 }}>
                    × remove
                  </button>
                </div>
              )}
              <InteractionValueEditor
                value={it}
                onChange={(updated) => updateInteraction(idx, updated)}
              />
            </div>
          ))}
          <button onClick={addInteraction} style={{ ...ADD_BTN, marginTop: 8 }}>
            + Add interaction
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────

export function InteractionVarsEditor({ vars, onChange }: InteractionVarsEditorProps) {
  const varEntries = Object.entries(vars)

  function updateVar(name: string, updated: VarEntry) {
    onChange({ ...vars, [name]: updated })
  }

  function removeVar(name: string) {
    const next = { ...vars }
    delete next[name]
    onChange(next)
  }

  function addVar() {
    const name = `NewVar_${Date.now()}`
    onChange({ ...vars, [name]: { Interactions: [''] } })
  }

  return (
    <div>
      {varEntries.length === 0 && (
        <div style={{ color: '#666', fontStyle: 'italic', fontSize: 12, marginBottom: 8 }}>
          No InteractionVars defined.
        </div>
      )}
      {varEntries.map(([name, entry]) => (
        <VarSection
          key={name}
          varName={name}
          entry={entry}
          onChangeEntry={(updated) => updateVar(name, updated)}
          onRemoveVar={() => removeVar(name)}
        />
      ))}
      <button onClick={addVar} style={{ ...ADD_BTN, fontSize: 12, padding: '4px 12px' }}>
        + Add var
      </button>
    </div>
  )
}
