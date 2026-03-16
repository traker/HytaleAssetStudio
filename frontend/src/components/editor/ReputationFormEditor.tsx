// ReputationFormEditor.tsx
// Editor for Hytale Reputation assets (Server/Reputation/).
// Covers: Stats (faction → number map), Faction, FactionAllies[], FactionEnemies[],
// and Attitudes (Default + Conditions as JSON textarea).

import { useState } from 'react'
import type React from 'react'

import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE, TEXTAREA_STYLE } from './formStyles'

type Props = {
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly: boolean
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SECTION_STYLE: React.CSSProperties = {
  marginBottom: 12,
  padding: '10px 12px 8px',
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

const ADD_BTN_STYLE: React.CSSProperties = {
  marginTop: 6,
  padding: '3px 10px',
  fontSize: 11,
  borderRadius: 4,
  background: '#1e1e35',
  border: '1px solid #444',
  color: '#aaa',
  cursor: 'pointer',
}

const REMOVE_BTN_STYLE: React.CSSProperties = {
  padding: '2px 6px',
  fontSize: 10,
  borderRadius: 3,
  background: '#3a1a1a',
  border: '1px solid #662222',
  color: '#cc6666',
  cursor: 'pointer',
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 4,
}

const GRID2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }

// ─── Stats section (faction → number key-value table) ────────────────────────

function StatsEditor({
  stats,
  onChange,
  readOnly,
}: {
  stats: Record<string, number>
  onChange: (s: Record<string, number>) => void
  readOnly: boolean
}) {
  const [newKey, setNewKey] = useState('')
  const entries = Object.entries(stats)

  function setEntry(key: string, value: number) {
    onChange({ ...stats, [key]: value })
  }

  function removeEntry(key: string) {
    const { [key]: _, ...rest } = stats
    onChange(rest)
  }

  function addEntry() {
    const k = newKey.trim()
    if (!k) return
    onChange({ ...stats, [k]: 0 })
    setNewKey('')
  }

  return (
    <div>
      {entries.length === 0 && (
        <div style={{ color: '#555', fontSize: 12, marginBottom: 4 }}>No faction stats.</div>
      )}
      {entries.map(([faction, value]) => (
        <div key={faction} style={ROW_STYLE}>
          <input
            style={{ ...INPUT_STYLE, flex: 2 }}
            value={faction}
            readOnly
            title="Faction name (read-only — remove and re-add to rename)"
          />
          <input
            type="number"
            style={{ ...INPUT_STYLE, flex: 1 }}
            value={value}
            readOnly={readOnly}
            onChange={(e) => setEntry(faction, Number(e.target.value))}
          />
          {!readOnly && (
            <button style={REMOVE_BTN_STYLE} onClick={() => removeEntry(faction)}>✕</button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div style={{ ...ROW_STYLE, marginTop: 4 }}>
          <input
            style={{ ...INPUT_STYLE, flex: 2 }}
            value={newKey}
            placeholder="faction name"
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addEntry() }}
          />
          <button style={ADD_BTN_STYLE} onClick={addEntry}>+ Add</button>
        </div>
      )}
    </div>
  )
}

// ─── Tag list (for FactionAllies / FactionEnemies) ────────────────────────────

function TagList({
  label,
  tags,
  onChange,
  readOnly,
}: {
  label: string
  tags: string[]
  onChange: (t: string[]) => void
  readOnly: boolean
}) {
  const [input, setInput] = useState('')

  function addTag() {
    const t = input.trim()
    if (!t || tags.includes(t)) return
    onChange([...tags, t])
    setInput('')
  }

  function removeTag(idx: number) {
    onChange(tags.filter((_, i) => i !== idx))
  }

  return (
    <div style={FIELD_WRAP}>
      <label style={LABEL_STYLE}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
        {tags.map((t, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#2a2a45', border: '1px solid #444', borderRadius: 4,
              padding: '2px 6px', fontSize: 11, color: '#ccc',
            }}
          >
            {t}
            {!readOnly && (
              <button
                style={{ border: 'none', background: 'none', color: '#cc6666', cursor: 'pointer', padding: 0, fontSize: 11 }}
                onClick={() => removeTag(i)}
              >✕</button>
            )}
          </span>
        ))}
      </div>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            style={{ ...INPUT_STYLE, flex: 1 }}
            value={input}
            placeholder="faction ID"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTag() }}
          />
          <button style={ADD_BTN_STYLE} onClick={addTag}>Add</button>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ReputationFormEditor({ json, onChange, readOnly }: Props) {
  const stats = (json['Stats'] && typeof json['Stats'] === 'object' && !Array.isArray(json['Stats']))
    ? (json['Stats'] as Record<string, number>)
    : {}

  const attitudes = (json['Attitudes'] && typeof json['Attitudes'] === 'object' && !Array.isArray(json['Attitudes']))
    ? (json['Attitudes'] as Record<string, unknown>)
    : {}

  const allies: string[] = Array.isArray(json['FactionAllies']) ? (json['FactionAllies'] as string[]) : []
  const enemies: string[] = Array.isArray(json['FactionEnemies']) ? (json['FactionEnemies'] as string[]) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* Stats */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Faction Stats (initial reputation values)</div>
        <StatsEditor
          stats={stats}
          readOnly={readOnly}
          onChange={(s) => onChange({ ...json, Stats: Object.keys(s).length ? s : undefined })}
        />
      </div>

      {/* Faction identity */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Faction Config</div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Faction ID</label>
          <input
            style={INPUT_STYLE}
            value={typeof json['Faction'] === 'string' ? json['Faction'] : ''}
            readOnly={readOnly}
            placeholder="FactionId"
            onChange={(e) => onChange({ ...json, Faction: e.target.value || undefined })}
          />
        </div>
        <div style={GRID2}>
          <TagList
            label="Faction Allies"
            tags={allies}
            readOnly={readOnly}
            onChange={(t) => onChange({ ...json, FactionAllies: t.length ? t : undefined })}
          />
          <TagList
            label="Faction Enemies"
            tags={enemies}
            readOnly={readOnly}
            onChange={(t) => onChange({ ...json, FactionEnemies: t.length ? t : undefined })}
          />
        </div>
      </div>

      {/* Attitudes */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Attitudes</div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Default Attitude</label>
          <select
            style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer' }}
            value={typeof attitudes['Default'] === 'string' ? attitudes['Default'] : ''}
            disabled={readOnly}
            onChange={(e) =>
              onChange({ ...json, Attitudes: { ...attitudes, Default: e.target.value || undefined } })
            }
          >
            <option value="">—</option>
            <option value="Friendly">Friendly</option>
            <option value="Neutral">Neutral</option>
            <option value="Hostile">Hostile</option>
          </select>
        </div>
        {attitudes['Conditions'] !== undefined && (
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Conditions (JSON)</label>
            <textarea
              style={{ ...TEXTAREA_STYLE, minHeight: 100 }}
              value={JSON.stringify(attitudes['Conditions'], null, 2)}
              readOnly={readOnly}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  onChange({ ...json, Attitudes: { ...attitudes, Conditions: parsed } })
                } catch { /* ignore */ }
              }}
            />
          </div>
        )}
        {!readOnly && attitudes['Conditions'] === undefined && (
          <button
            style={ADD_BTN_STYLE}
            onClick={() => onChange({ ...json, Attitudes: { ...attitudes, Conditions: [] } })}
          >
            + Add Conditions
          </button>
        )}
      </div>

    </div>
  )
}
