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

type VarEntry = { Interactions: InteractionInline[] }
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
  'Parent',
  'DamageCalculator',
  'DamageEffects',
  'EntityStatsOnHit',
  'StaminaCost',
])

function asObj(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
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

  // ── Unknown extra keys ───────────────────────────────────
  const extraKeys = Object.keys(interaction).filter((k) => !KNOWN_INTERACTION_KEYS.has(k))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

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
      {extraKeys.map((k) => {
        const val = interaction[k]
        const isComplex = typeof val === 'object' && val !== null
        return (
          <div key={k}>
            <label style={{ ...LABEL, color: '#666' }}>{k} (extra)</label>
            {isComplex ? (
              <textarea
                rows={3}
                defaultValue={JSON.stringify(val, null, 2)}
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

  const interactions: InteractionInline[] = Array.isArray(entry.Interactions)
    ? entry.Interactions
    : []

  function updateInteraction(idx: number, updated: InteractionInline) {
    const next = interactions.map((it, i) => (i === idx ? updated : it))
    onChangeEntry({ ...entry, Interactions: next })
  }

  function removeInteraction(idx: number) {
    const next = interactions.filter((_, i) => i !== idx)
    onChangeEntry({ ...entry, Interactions: next })
  }

  function addInteraction() {
    onChangeEntry({ ...entry, Interactions: [...interactions, { Parent: '' }] })
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
              <InlineInteractionEditor
                interaction={it}
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
    onChange({ ...vars, [name]: { Interactions: [{ Parent: '' }] } })
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
