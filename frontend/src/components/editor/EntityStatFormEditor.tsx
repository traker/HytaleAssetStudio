import type React from 'react'

import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE, TEXTAREA_STYLE } from './formStyles'

// ─── Types ────────────────────────────────────────────────────────────────────

type RegenCondition = {
  Id: string
  Inverse?: boolean
  Delay?: number
  GameMode?: string
  Stat?: string
  Amount?: number
  Comparison?: string
  [key: string]: unknown
}

type RegenEntry = {
  $Comment?: string
  Interval?: number
  Amount?: number
  RegenType?: string
  ClampAtZero?: boolean
  Conditions?: RegenCondition[]
  [key: string]: unknown
}

type InteractionRef =
  | string
  | { Type: string; [key: string]: unknown }

type MinMaxEffects = {
  TriggerAtZero?: boolean
  Interactions?: {
    Interactions?: InteractionRef[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

type Props = {
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly: boolean
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SECTION_STYLE: React.CSSProperties = {
  marginBottom: 14,
  padding: '12px 12px 8px',
  border: '1px solid #2b2b3f',
  borderRadius: 6,
  background: 'rgba(25, 25, 40, 0.55)',
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: '#9da5ca',
  marginBottom: 8,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  fontWeight: 700,
}

const GRID3_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 8,
}

const GRID2_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
}

const REGEN_ENTRY_STYLE: React.CSSProperties = {
  border: '1px solid #2a3450',
  borderRadius: 5,
  padding: '8px 10px',
  marginBottom: 8,
  background: 'rgba(20, 20, 38, 0.6)',
}

const BTN_STYLE: React.CSSProperties = {
  fontSize: 11,
  padding: '3px 10px',
  borderRadius: 4,
  border: '1px solid #404467',
  background: '#1a1a2e',
  color: '#aab',
  cursor: 'pointer',
}

const BTN_DANGER: React.CSSProperties = {
  ...BTN_STYLE,
  padding: '2px 6px',
  fontSize: 10,
  borderColor: '#6b2a2a',
  color: '#f08080',
}

const CHECKBOX_LABEL_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  color: '#cdd',
  cursor: 'pointer',
  userSelect: 'none',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asRegenArray(v: unknown): RegenEntry[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => x && typeof x === 'object') as RegenEntry[]
}

function asMinMaxEffects(v: unknown): MinMaxEffects {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as MinMaxEffects
  return {}
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function conditionsSummary(conditions: RegenCondition[] | undefined): string {
  if (!conditions || conditions.length === 0) return 'no conditions'
  return conditions
    .map((c) => (c.Inverse ? `!${c.Id}` : c.Id))
    .join(', ')
}

// ─── Regen entry editor ───────────────────────────────────────────────────────

type RegenEntryEditorProps = {
  entry: RegenEntry
  index: number
  onChange: (updated: RegenEntry) => void
  onRemove: () => void
  readOnly: boolean
}

function RegenEntryEditor({ entry, index, onChange, onRemove, readOnly }: RegenEntryEditorProps) {
  const conditions = (entry.Conditions ?? []) as RegenCondition[]

  function set(key: string, value: unknown): void {
    onChange({ ...entry, [key]: value })
  }

  function updateCondition(i: number, patch: Partial<RegenCondition>): void {
    const next = deepClone(conditions)
    next[i] = { ...next[i], ...patch }
    onChange({ ...entry, Conditions: next })
  }

  function removeCondition(i: number): void {
    const next = deepClone(conditions)
    next.splice(i, 1)
    onChange({ ...entry, Conditions: next })
  }

  function addCondition(): void {
    onChange({ ...entry, Conditions: [...conditions, { Id: 'Alive' }] })
  }

  return (
    <div style={REGEN_ENTRY_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#7a8cb0', marginRight: 'auto' }}>
          #{index + 1}{entry.$Comment ? ` — ${entry.$Comment}` : ''}
        </span>
        {!readOnly && (
          <button style={BTN_DANGER} onClick={onRemove}>Remove</button>
        )}
      </div>

      {/* Comment */}
      <div style={FIELD_WRAP}>
        <label style={LABEL_STYLE}>Comment</label>
        <input
          style={INPUT_STYLE}
          value={entry.$Comment ?? ''}
          readOnly={readOnly}
          placeholder="e.g. NPC, Player in creative…"
          onChange={(e) => set('$Comment', e.target.value || undefined)}
        />
      </div>

      <div style={GRID3_STYLE}>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Interval (s)</label>
          <input
            type="number"
            style={INPUT_STYLE}
            value={entry.Interval ?? ''}
            readOnly={readOnly}
            step="0.1"
            onChange={(e) => set('Interval', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Amount</label>
          <input
            type="number"
            style={INPUT_STYLE}
            value={entry.Amount ?? ''}
            readOnly={readOnly}
            step="0.01"
            onChange={(e) => set('Amount', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Regen Type</label>
          <select
            style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer' }}
            value={entry.RegenType ?? ''}
            disabled={readOnly}
            onChange={(e) => set('RegenType', e.target.value || undefined)}
          >
            <option value="">— select —</option>
            <option value="Additive">Additive</option>
            <option value="Percentage">Percentage</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 6 }}>
        <label style={CHECKBOX_LABEL_STYLE}>
          <input
            type="checkbox"
            checked={entry.ClampAtZero ?? false}
            disabled={readOnly}
            onChange={(e) => set('ClampAtZero', e.target.checked || undefined)}
          />
          Clamp at zero
        </label>
      </div>

      {/* Conditions */}
      <div style={{ marginTop: 6 }}>
        <div style={{ ...LABEL_STYLE, marginBottom: 4 }}>
          Conditions ({conditions.length}) — {conditionsSummary(conditions)}
        </div>
        {conditions.map((cond, ci) => (
          <div key={ci} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 28px', gap: 4, marginBottom: 4, alignItems: 'end' }}>
            <div>
              {ci === 0 && <label style={{ ...LABEL_STYLE, marginBottom: 2 }}>Id</label>}
              <input
                style={INPUT_STYLE}
                value={cond.Id}
                readOnly={readOnly}
                placeholder="Alive, Player, NoDamageTaken…"
                onChange={(e) => updateCondition(ci, { Id: e.target.value })}
              />
            </div>
            <div>
              {ci === 0 && <label style={{ ...LABEL_STYLE, marginBottom: 2 }}>Delay</label>}
              <input
                type="number"
                style={INPUT_STYLE}
                value={cond.Delay ?? ''}
                readOnly={readOnly}
                placeholder="—"
                onChange={(e) => updateCondition(ci, { Delay: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              {!readOnly && (
                <button style={BTN_DANGER} onClick={() => removeCondition(ci)}>✕</button>
              )}
            </div>
          </div>
        ))}
        {conditions.map((cond, ci) => (
          cond.Id === 'Player' ? (
            <div key={`gm_${ci}`} style={FIELD_WRAP}>
              <label style={LABEL_STYLE}>GameMode (condition #{ci + 1})</label>
              <input
                style={INPUT_STYLE}
                value={cond.GameMode ?? ''}
                readOnly={readOnly}
                placeholder="Creative, Survival…"
                onChange={(e) => updateCondition(ci, { GameMode: e.target.value || undefined })}
              />
            </div>
          ) : null
        ))}
        {!readOnly && (
          <button style={{ ...BTN_STYLE, marginTop: 2 }} onClick={addCondition}>
            + Add condition
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Min/Max effects (compact JSON fallback) ──────────────────────────────────

type EffectsEditorProps = {
  label: string
  effects: MinMaxEffects
  onChange: (updated: MinMaxEffects) => void
  readOnly: boolean
}

function EffectsEditor({ label, effects, onChange, readOnly }: EffectsEditorProps) {
  const interactions = effects.Interactions?.Interactions ?? []
  const simple = interactions.every((x) => typeof x === 'string')

  if (simple) {
    return (
      <div style={FIELD_WRAP}>
        <label style={LABEL_STYLE}>{label} — Interactions (CSV)</label>
        <input
          style={INPUT_STYLE}
          value={(interactions as string[]).join(', ')}
          readOnly={readOnly}
          placeholder="Interaction_A, Interaction_B"
          onChange={(e) => {
            const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
            onChange({
              ...effects,
              Interactions: { ...effects.Interactions, Interactions: list },
            })
          }}
        />
      </div>
    )
  }

  return (
    <div style={FIELD_WRAP}>
      <label style={LABEL_STYLE}>{label} (raw JSON)</label>
      <textarea
        style={{ ...TEXTAREA_STYLE, minHeight: 80 }}
        value={JSON.stringify(effects, null, 2)}
        readOnly={readOnly}
        onChange={(e) => {
          try { onChange(JSON.parse(e.target.value)) } catch { /* ignore */ }
        }}
      />
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function EntityStatFormEditor({ json, onChange, readOnly }: Props) {
  const regenEntries = asRegenArray(json['Regenerating'])
  const minEffects = asMinMaxEffects(json['MinValueEffects'])
  const maxEffects = asMinMaxEffects(json['MaxValueEffects'])
  const hasMinEffects = 'MinValueEffects' in json
  const hasMaxEffects = 'MaxValueEffects' in json

  function set(key: string, value: unknown): void {
    onChange({ ...json, [key]: value })
  }

  function updateRegen(i: number, updated: RegenEntry): void {
    const next = deepClone(regenEntries)
    next[i] = updated
    set('Regenerating', next)
  }

  function removeRegen(i: number): void {
    const next = deepClone(regenEntries)
    next.splice(i, 1)
    set('Regenerating', next)
  }

  function addRegen(): void {
    set('Regenerating', [...regenEntries, { Interval: 0.5, Amount: 1, RegenType: 'Additive', Conditions: [] }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* ── Base values ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Base Values</div>
        <div style={GRID3_STYLE}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Initial Value</label>
            <input
              type="number"
              style={INPUT_STYLE}
              value={(json['InitialValue'] as number) ?? ''}
              readOnly={readOnly}
              onChange={(e) => set('InitialValue', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Min</label>
            <input
              type="number"
              style={INPUT_STYLE}
              value={(json['Min'] as number) ?? ''}
              readOnly={readOnly}
              onChange={(e) => set('Min', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Max</label>
            <input
              type="number"
              style={INPUT_STYLE}
              value={(json['Max'] as number) ?? ''}
              readOnly={readOnly}
              onChange={(e) => set('Max', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </div>
        </div>

        <div style={GRID2_STYLE}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Reset Type</label>
            <select
              style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer' }}
              value={(json['ResetType'] as string) ?? ''}
              disabled={readOnly}
              onChange={(e) => set('ResetType', e.target.value || undefined)}
            >
              <option value="">— none —</option>
              <option value="MaxValue">MaxValue</option>
              <option value="InitialValue">InitialValue</option>
              <option value="None">None</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label style={CHECKBOX_LABEL_STYLE}>
              <input
                type="checkbox"
                checked={(json['Shared'] as boolean) ?? false}
                disabled={readOnly}
                onChange={(e) => set('Shared', e.target.checked)}
              />
              Shared (global stat)
            </label>
          </div>
        </div>
      </div>

      {/* ── Regeneration entries ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Regeneration ({regenEntries.length})</div>
        {regenEntries.map((entry, i) => (
          <RegenEntryEditor
            key={i}
            entry={entry}
            index={i}
            onChange={(updated) => updateRegen(i, updated)}
            onRemove={() => removeRegen(i)}
            readOnly={readOnly}
          />
        ))}
        {!readOnly && (
          <button style={BTN_STYLE} onClick={addRegen}>
            + Add regen entry
          </button>
        )}
      </div>

      {/* ── Min/Max effects ── */}
      {(hasMinEffects || !readOnly) && (
        <div style={SECTION_STYLE}>
          <div style={SECTION_TITLE_STYLE}>Min Value Effects</div>
          {hasMinEffects ? (
            <>
              <div style={{ marginBottom: 6 }}>
                <label style={CHECKBOX_LABEL_STYLE}>
                  <input
                    type="checkbox"
                    checked={minEffects.TriggerAtZero ?? false}
                    disabled={readOnly}
                    onChange={(e) => set('MinValueEffects', { ...minEffects, TriggerAtZero: e.target.checked })}
                  />
                  Trigger at zero
                </label>
              </div>
              <EffectsEditor
                label="Min effects"
                effects={minEffects}
                onChange={(updated) => set('MinValueEffects', updated)}
                readOnly={readOnly}
              />
            </>
          ) : (
            !readOnly && (
              <button style={BTN_STYLE} onClick={() => set('MinValueEffects', { TriggerAtZero: false, Interactions: { Interactions: [] } })}>
                + Add min effects
              </button>
            )
          )}
        </div>
      )}

      {(hasMaxEffects || !readOnly) && (
        <div style={SECTION_STYLE}>
          <div style={SECTION_TITLE_STYLE}>Max Value Effects</div>
          {hasMaxEffects ? (
            <EffectsEditor
              label="Max effects"
              effects={maxEffects}
              onChange={(updated) => set('MaxValueEffects', updated)}
              readOnly={readOnly}
            />
          ) : (
            !readOnly && (
              <button style={BTN_STYLE} onClick={() => set('MaxValueEffects', { Interactions: { Interactions: [] } })}>
                + Add max effects
              </button>
            )
          )}
        </div>
      )}

    </div>
  )
}
