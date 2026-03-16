import { useState } from 'react'

import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE } from './formStyles'

// ─── Types ────────────────────────────────────────────────────────────────────

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

const TAG_WRAP: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 5,
  marginBottom: 6,
}

const TAG_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  fontFamily: 'monospace',
  padding: '2px 8px',
  borderRadius: 4,
  background: '#1e2a40',
  border: '1px solid #2c3a58',
  color: '#a8c0ef',
}

const TAG_BTN: React.CSSProperties = {
  cursor: 'pointer',
  color: '#f08080',
  background: 'none',
  border: 'none',
  padding: 0,
  fontSize: 12,
  lineHeight: 1,
}

const ADD_ROW: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
}

const BTN_STYLE: React.CSSProperties = {
  fontSize: 11,
  padding: '3px 10px',
  borderRadius: 4,
  border: '1px solid #404467',
  background: '#1a1a2e',
  color: '#aab',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const HINT_STYLE: React.CSSProperties = {
  fontSize: 10,
  color: '#5a6280',
  marginTop: 4,
}

// ─── Tag list field ───────────────────────────────────────────────────────────

type TagListProps = {
  label: string
  hint: string
  values: string[]
  onChange: (updated: string[]) => void
  readOnly: boolean
  placeholder: string
}

function TagListField({ label, hint, values, onChange, readOnly, placeholder }: TagListProps) {
  const [draft, setDraft] = useState('')

  function add() {
    const trimmed = draft.trim()
    if (!trimmed || values.includes(trimmed)) return
    onChange([...values, trimmed])
    setDraft('')
  }

  function remove(i: number) {
    const next = [...values]
    next.splice(i, 1)
    onChange(next)
  }

  return (
    <div style={FIELD_WRAP}>
      <label style={LABEL_STYLE}>{label}</label>
      <div style={TAG_WRAP}>
        {values.map((v, i) => (
          <span key={i} style={TAG_STYLE}>
            {v}
            {!readOnly && (
              <button style={TAG_BTN} title="Remove" onClick={() => remove(i)}>✕</button>
            )}
          </span>
        ))}
        {values.length === 0 && (
          <span style={{ fontSize: 11, color: '#45486a' }}>—</span>
        )}
      </div>
      {!readOnly && (
        <div style={ADD_ROW}>
          <input
            style={{ ...INPUT_STYLE, flex: 1 }}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          />
          <button style={BTN_STYLE} onClick={add}>Add</button>
        </div>
      )}
      <div style={HINT_STYLE}>{hint}</div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => typeof x === 'string') as string[]
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function NPCGroupFormEditor({ json, onChange, readOnly }: Props) {
  function set(key: string, value: string[]): void {
    const next: Record<string, unknown> = { ...json }
    if (value.length > 0) {
      next[key] = value
    } else {
      delete next[key]
    }
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* ── Include / Exclude Roles ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Roles</div>
        <TagListField
          label="Include Roles"
          hint='Wildcard patterns for NPC roles to include. Use * for wildcards, e.g. "Goblin_*" or "*Aggressive".'
          values={asStringArray(json['IncludeRoles'])}
          onChange={(v) => set('IncludeRoles', v)}
          readOnly={readOnly}
          placeholder="e.g. Goblin_* or Trork_Chieftain"
        />
        <TagListField
          label="Exclude Roles"
          hint='Wildcard patterns for NPC roles to exclude from the group, e.g. "*Boss*".'
          values={asStringArray(json['ExcludeRoles'])}
          onChange={(v) => set('ExcludeRoles', v)}
          readOnly={readOnly}
          placeholder="e.g. *Boss* or *Elite"
        />
      </div>

      {/* ── Include / Exclude Groups ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Nested Groups</div>
        <TagListField
          label="Include Groups"
          hint='References to other NPC group IDs to nest inside this group, e.g. "Livestock" or "Predators".'
          values={asStringArray(json['IncludeGroups'])}
          onChange={(v) => set('IncludeGroups', v)}
          readOnly={readOnly}
          placeholder="e.g. Livestock or Predators"
        />
        <TagListField
          label="Exclude Groups"
          hint='References to NPC group IDs to exclude from this group, e.g. "Critters".'
          values={asStringArray(json['ExcludeGroups'])}
          onChange={(v) => set('ExcludeGroups', v)}
          readOnly={readOnly}
          placeholder="e.g. Critters or Pets"
        />
      </div>

    </div>
  )
}
