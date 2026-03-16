import { INPUT_STYLE, LABEL_STYLE } from './formStyles'

// ─── Types ────────────────────────────────────────────────────────────────────

type SoundEvents = Record<string, string>

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

const ROW_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr 28px',
  gap: 6,
  alignItems: 'end',
  marginBottom: 6,
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

// ─── Known slot keys ──────────────────────────────────────────────────────────

const KNOWN_SLOTS: string[] = [
  'Drop',
  'Drag',
  'Equip',
  'Unequip',
  'Use',
  'Attack',
  'Mine',
  'Place',
  'Interact',
  'Pickup',
  'Throw',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asSoundEvents(v: unknown): SoundEvents {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as SoundEvents
  return {}
}

// ─── Main export ──────────────────────────────────────────────────────────────

import type React from 'react'

export function ItemSoundSetFormEditor({ json, onChange, readOnly }: Props) {
  const soundEvents = asSoundEvents(json['SoundEvents'])
  const entries = Object.entries(soundEvents)

  function updateKey(oldKey: string, newKey: string): void {
    const updated: SoundEvents = {}
    for (const [k, v] of Object.entries(soundEvents)) {
      updated[k === oldKey ? newKey : k] = v
    }
    onChange({ ...json, SoundEvents: updated })
  }

  function updateValue(key: string, value: string): void {
    onChange({ ...json, SoundEvents: { ...soundEvents, [key]: value } })
  }

  function removeEntry(key: string): void {
    const { [key]: _removed, ...rest } = soundEvents
    onChange({ ...json, SoundEvents: rest })
  }

  function addEntry(): void {
    // Find a slot not yet used
    const used = new Set(Object.keys(soundEvents))
    const next = KNOWN_SLOTS.find((s) => !used.has(s)) ?? 'Custom'
    onChange({ ...json, SoundEvents: { ...soundEvents, [next]: '' } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Sound Events ({entries.length})</div>

        {entries.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 28px', gap: 6, marginBottom: 4 }}>
              <label style={LABEL_STYLE}>Slot</label>
              <label style={LABEL_STYLE}>Sound Event ID</label>
              <div />
            </div>
            {entries.map(([key, value]) => (
              <div key={key} style={ROW_STYLE}>
                <input
                  style={INPUT_STYLE}
                  value={key}
                  readOnly={readOnly}
                  placeholder="Drop"
                  onChange={(e) => updateKey(key, e.target.value)}
                />
                <input
                  style={INPUT_STYLE}
                  value={value}
                  readOnly={readOnly}
                  placeholder="SFX_Drop_Items_Stone"
                  onChange={(e) => updateValue(key, e.target.value)}
                />
                {!readOnly && (
                  <button style={BTN_DANGER} onClick={() => removeEntry(key)}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}

        {entries.length === 0 && (
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>No sound events defined.</div>
        )}

        {!readOnly && (
          <button style={BTN_STYLE} onClick={addEntry}>+ Add slot</button>
        )}
      </div>

      {/* Known slots reference */}
      <div style={{
        padding: '6px 10px',
        borderRadius: 5,
        background: 'rgba(15,15,30,0.5)',
        border: '1px solid #222240',
        fontSize: 11,
        color: '#6a7090',
      }}>
        Common slots: {KNOWN_SLOTS.join(' · ')}
      </div>
    </div>
  )
}
