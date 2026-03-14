/**
 * NPCRoleFormEditor — structured form for Server/NPC/Roles/ assets.
 *
 * Full structured editing is available only for Type=Variant roles.
 * Other types (Generic, Template, etc.) show a note and fall back to JSON tab.
 *
 * Variant fields:
 *   - Reference (string) — the template to base on
 *   - Modify (object) — arbitrary field overrides, rendered as key/value list
 *   - Parameters (object) — key → { Value, Description } parameter definitions
 */

import { useState } from 'react'
import { LABEL_STYLE, INPUT_STYLE, TEXTAREA_STYLE } from './formStyles'

// ─── Styles ──────────────────────────────────────────────────────────────────

const SECTION_HEADER: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 6,
  marginTop: 14,
  borderBottom: '1px solid #2a2a36',
  paddingBottom: 3,
}
const FIELD: React.CSSProperties = { marginBottom: 8 }
const LABEL: React.CSSProperties = { ...LABEL_STYLE, display: 'block', marginBottom: 3 }
const INPUT: React.CSSProperties = { ...INPUT_STYLE, width: '100%' }
const ROW: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'flex-start' }

// ─── Modify K/V editor ───────────────────────────────────────────────────────

function ModifyEditor({
  value,
  onChange,
  readOnly,
}: {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
  readOnly: boolean
}) {
  const [newKey, setNewKey] = useState('')
  const entries = Object.entries(value)

  const setEntry = (k: string, v: unknown) => {
    if (readOnly) return
    const next = { ...value }
    if (v === undefined) delete next[k]
    else next[k] = v
    onChange(next)
  }

  const removeEntry = (k: string) => {
    if (readOnly) return
    const next = { ...value }
    delete next[k]
    onChange(next)
  }

  const addEntry = () => {
    if (readOnly || !newKey.trim()) return
    onChange({ ...value, [newKey.trim()]: '' })
    setNewKey('')
  }

  return (
    <div>
      {entries.map(([k, v]) => {
        const isComplex = typeof v === 'object' && v !== null
        return (
          <div key={k} style={{ ...FIELD, border: '1px solid #2a2a36', borderRadius: 4, padding: '6px 8px', background: '#1a1a28' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6a9fce', fontFamily: 'monospace' }}>{k}</span>
              {!readOnly && (
                <button
                  onClick={() => removeEntry(k)}
                  style={{ background: 'transparent', border: 'none', color: '#FF6B6B', cursor: 'pointer', fontSize: 12, padding: '0 2px' }}
                  title="Remove"
                >✕</button>
              )}
            </div>
            {isComplex ? (
              <textarea
                rows={3}
                defaultValue={JSON.stringify(v, null, 2)}
                readOnly={readOnly}
                onBlur={(e) => {
                  if (readOnly) return
                  const trimmed = e.target.value.trim()
                  if (!trimmed) setEntry(k, undefined)
                  else try { setEntry(k, JSON.parse(trimmed)) } catch { /* ignore */ }
                }}
                style={{ ...TEXTAREA_STYLE, width: '100%', resize: 'vertical', fontSize: 11 }}
                spellCheck={false}
              />
            ) : (
              <input
                type="text"
                defaultValue={v === null || v === undefined ? '' : String(v)}
                readOnly={readOnly}
                onBlur={(e) => {
                  if (readOnly) return
                  const raw = e.target.value
                  // Try to parse as number or bool
                  if (raw === 'true') setEntry(k, true)
                  else if (raw === 'false') setEntry(k, false)
                  else if (raw !== '' && !isNaN(Number(raw))) setEntry(k, Number(raw))
                  else setEntry(k, raw || undefined)
                }}
                style={{ ...INPUT, fontSize: 11 }}
              />
            )}
          </div>
        )
      })}
      {!readOnly && (
        <div style={ROW}>
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEntry() } }}
            style={{ ...INPUT, fontSize: 11 }}
            placeholder="New field name…"
          />
          <button
            onClick={addEntry}
            style={{ background: 'transparent', border: '1px dashed #444', borderRadius: 3, color: '#666', cursor: 'pointer', fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
          >+ Add</button>
        </div>
      )}
    </div>
  )
}

// ─── Parameters K/V editor ───────────────────────────────────────────────────

type ParamEntry = { Value: unknown; Description?: string }

function ParametersEditor({
  value,
  onChange,
  readOnly,
}: {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
  readOnly: boolean
}) {
  const [newKey, setNewKey] = useState('')
  const entries = Object.entries(value)

  const getEntry = (v: unknown): ParamEntry => {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      return v as ParamEntry
    }
    return { Value: v }
  }

  const setEntry = (k: string, patch: Partial<ParamEntry>) => {
    if (readOnly) return
    const current = getEntry(value[k])
    const updated = { ...current, ...patch }
    if (updated.Description === '') delete updated.Description
    onChange({ ...value, [k]: updated })
  }

  const removeEntry = (k: string) => {
    if (readOnly) return
    const next = { ...value }
    delete next[k]
    onChange(next)
  }

  const addEntry = () => {
    if (readOnly || !newKey.trim()) return
    onChange({ ...value, [newKey.trim()]: { Value: '', Description: '' } })
    setNewKey('')
  }

  return (
    <div>
      {entries.map(([k, raw]) => {
        const entry = getEntry(raw)
        const valueStr = entry.Value === null || entry.Value === undefined
          ? '' : (typeof entry.Value === 'object' ? JSON.stringify(entry.Value) : String(entry.Value))
        return (
          <div key={k} style={{ ...FIELD, border: '1px solid #2a2a36', borderRadius: 4, padding: '6px 8px', background: '#1a1a28' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6a9fce', fontFamily: 'monospace' }}>{k}</span>
              {!readOnly && (
                <button
                  onClick={() => removeEntry(k)}
                  style={{ background: 'transparent', border: 'none', color: '#FF6B6B', cursor: 'pointer', fontSize: 12, padding: '0 2px' }}
                  title="Remove"
                >✕</button>
              )}
            </div>
            <div style={{ marginBottom: 4 }}>
              <label style={{ ...LABEL, color: '#555' }}>Value</label>
              <input
                type="text"
                defaultValue={valueStr}
                readOnly={readOnly}
                onBlur={(e) => {
                  if (readOnly) return
                  const raw = e.target.value
                  if (raw === 'true') setEntry(k, { Value: true })
                  else if (raw === 'false') setEntry(k, { Value: false })
                  else if (raw !== '' && !isNaN(Number(raw))) setEntry(k, { Value: Number(raw) })
                  else setEntry(k, { Value: raw })
                }}
                style={{ ...INPUT, fontSize: 11 }}
              />
            </div>
            <div>
              <label style={{ ...LABEL, color: '#555' }}>Description</label>
              <input
                type="text"
                defaultValue={typeof entry.Description === 'string' ? entry.Description : ''}
                readOnly={readOnly}
                onBlur={(e) => setEntry(k, { Description: e.target.value || undefined })}
                style={{ ...INPUT, fontSize: 11 }}
              />
            </div>
          </div>
        )
      })}
      {!readOnly && (
        <div style={ROW}>
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEntry() } }}
            style={{ ...INPUT, fontSize: 11 }}
            placeholder="New parameter name…"
          />
          <button
            onClick={addEntry}
            style={{ background: 'transparent', border: '1px dashed #444', borderRadius: 3, color: '#666', cursor: 'pointer', fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
          >+ Add</button>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly?: boolean
}

export function NPCRoleFormEditor({ json, onChange, readOnly = false }: Props) {
  const roleType = typeof json['Type'] === 'string' ? (json['Type'] as string) : ''

  const set = (k: string, v: unknown) => {
    if (readOnly) return
    const next = { ...json }
    if (v === undefined || v === '') delete next[k]
    else next[k] = v
    onChange(next)
  }

  if (roleType !== 'Variant') {
    return (
      <div style={{ fontSize: 12, padding: '8px 12px', color: '#888' }}>
        <div style={{ marginBottom: 8 }}>
          <label style={LABEL}>Type</label>
          <div style={{ ...INPUT, padding: '4px 7px', color: '#ccc', fontSize: 12 }}>{roleType || '—'}</div>
        </div>
        <div style={{ fontSize: 11, fontStyle: 'italic', color: '#666' }}>
          Structured editing is available only for Variant roles. Edit this asset in the JSON tab.
        </div>
      </div>
    )
  }

  const modifyObj = (typeof json['Modify'] === 'object' && json['Modify'] !== null && !Array.isArray(json['Modify']))
    ? (json['Modify'] as Record<string, unknown>) : {}

  const paramsObj = (typeof json['Parameters'] === 'object' && json['Parameters'] !== null && !Array.isArray(json['Parameters']))
    ? (json['Parameters'] as Record<string, unknown>) : {}

  return (
    <div style={{ fontSize: 12, padding: '8px 12px' }}>
      {readOnly && (
        <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', marginBottom: 8 }}>
          Read-only — overrides uniquement disponibles pour les assets server.
        </div>
      )}

      {/* Type (display only) */}
      <div style={FIELD}>
        <label style={LABEL}>Type</label>
        <div style={{ ...INPUT, padding: '4px 7px', color: '#9cfca2', fontSize: 12 }}>Variant</div>
      </div>

      {/* Reference */}
      <div style={SECTION_HEADER}>Template Reference</div>
      <div style={FIELD}>
        <label style={LABEL}>Reference</label>
        <input
          type="text"
          value={typeof json['Reference'] === 'string' ? (json['Reference'] as string) : ''}
          onChange={(e) => set('Reference', e.target.value || undefined)}
          disabled={readOnly}
          style={INPUT}
          placeholder="e.g. Template_Swimming_Passive"
        />
      </div>

      {/* Modify */}
      <div style={SECTION_HEADER}>Modify (field overrides)</div>
      <ModifyEditor
        value={modifyObj}
        onChange={(v) => {
          if (readOnly) return
          const next = { ...json }
          if (Object.keys(v).length === 0) delete next['Modify']
          else next['Modify'] = v
          onChange(next)
        }}
        readOnly={readOnly}
      />

      {/* Parameters */}
      <div style={SECTION_HEADER}>Parameters</div>
      <ParametersEditor
        value={paramsObj}
        onChange={(v) => {
          if (readOnly) return
          const next = { ...json }
          if (Object.keys(v).length === 0) delete next['Parameters']
          else next['Parameters'] = v
          onChange(next)
        }}
        readOnly={readOnly}
      />
    </div>
  )
}
