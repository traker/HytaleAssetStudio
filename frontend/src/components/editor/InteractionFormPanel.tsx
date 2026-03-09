/**
 * InteractionFormPanel — right-side panel for viewing/editing a selected interaction node.
 *
 * Features:
 * - Two tabs: Form (structured per-type) | Raw JSON (editable)
 * - "Apply" button → calls onApply(newRawFields) to update the node in the graph
 * - "Save to server" button (if the node has a server ID) → calls onSaveToServer
 * - Shows type-specific fields from interactionSchemas
 */

import { useEffect, useState } from 'react'
import { getColorForInteractionType } from '../graph/colors'
import { getSchemaForType, type FieldDef, type FieldType } from '../graph/interactionSchemas'

type Tab = 'form' | 'raw'

export interface InteractionFormPanelProps {
  nodeId: string
  nodeType: string
  rawFields: Record<string, unknown>
  isExternal: boolean
  /** Called when user clicks "Apply" — provides the updated rawFields */
  onApply: (updated: Record<string, unknown>) => void
  /** Called when user clicks "Save to server" (only for external nodes) */
  onSaveToServer?: () => void
  onClose: () => void
}

// ─────────────────────────────────────────────────────────────
// Styles helpers
// ─────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: '#888',
  marginBottom: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#1a1a2e',
  border: '1px solid #3a3a5c',
  borderRadius: 4,
  color: '#ddd',
  fontSize: 12,
  padding: '5px 7px',
  outline: 'none',
}

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  fontFamily: 'monospace',
  resize: 'vertical',
  lineHeight: 1.4,
  minHeight: 60,
}

const FIELD_WRAP: React.CSSProperties = {
  marginBottom: 10,
}

// ─────────────────────────────────────────────────────────────
// Individual field renderers
// ─────────────────────────────────────────────────────────────

function renderField(
  field: FieldDef,
  value: unknown,
  onChange: (key: string, val: unknown) => void,
) {
  const { key, label, type, description, required } = field

  const labelEl = (
    <span style={LABEL_STYLE}>
      {label}
      {required && <span style={{ color: '#FF6B6B' }}> *</span>}
    </span>
  )

  if (type === 'boolean') {
    return (
      <div key={key} style={{ ...FIELD_WRAP, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          id={key}
          checked={Boolean(value)}
          onChange={(e) => onChange(key, e.target.checked)}
          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#61dafb' }}
        />
        <label htmlFor={key} style={{ fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
          {label}
          {description && (
            <span style={{ color: '#666', fontSize: 10, marginLeft: 6 }}>({description})</span>
          )}
        </label>
      </div>
    )
  }

  if (type === 'number') {
    return (
      <div key={key} style={FIELD_WRAP}>
        {labelEl}
        {description && <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>{description}</div>}
        <input
          type="number"
          step="any"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => {
            const v = e.target.value.trim()
            onChange(key, v === '' ? undefined : parseFloat(v))
          }}
          style={INPUT_STYLE}
        />
      </div>
    )
  }

  if (type === 'string' || type === 'string-ref') {
    return (
      <div key={key} style={FIELD_WRAP}>
        {labelEl}
        {description && <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>{description}</div>}
        {type === 'string-ref' && (
          <div style={{ fontSize: 10, color: '#61dafb', marginBottom: 3 }}>
            Server ID (e.g. Weapon_Sword_Primary_Chain)
          </div>
        )}
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(key, e.target.value || undefined)}
          style={INPUT_STYLE}
          placeholder={type === 'string-ref' ? 'Server_Id_Or_Leave_Empty' : ''}
        />
      </div>
    )
  }

  if (type === 'effects') {
    // Effects is a special dict with well-known keys
    const eff = (typeof value === 'object' && value !== null && !Array.isArray(value))
      ? (value as Record<string, unknown>)
      : {}

    const effectKeys = [
      'ItemAnimationId',
      'WorldSoundEventId',
      'LocalSoundEventId',
      'CameraEffect',
    ]

    const handleEffectChange = (eKey: string, eVal: string) => {
      const updated = { ...eff }
      if (eVal.trim() === '') {
        delete updated[eKey]
      } else {
        updated[eKey] = eVal
      }
      onChange(key, Object.keys(updated).length === 0 ? undefined : updated)
    }

    return (
      <div key={key} style={{ ...FIELD_WRAP, borderLeft: '2px solid #333', paddingLeft: 8 }}>
        <span style={{ ...LABEL_STYLE, color: '#aaa' }}>Effects</span>
        {effectKeys.map((ek) => (
          <div key={ek} style={{ marginBottom: 6 }}>
            <label style={{ ...LABEL_STYLE, color: '#666' }}>{ek}</label>
            <input
              type="text"
              value={typeof eff[ek] === 'string' ? (eff[ek] as string) : ''}
              onChange={(e) => handleEffectChange(ek, e.target.value)}
              style={INPUT_STYLE}
              placeholder="server ID or value"
            />
          </div>
        ))}
        {/* Trails needs special treatment as an array */}
        <div style={{ marginBottom: 4 }}>
          <label style={{ ...LABEL_STYLE, color: '#666' }}>Trails (JSON array)</label>
          <textarea
            rows={2}
            value={eff['Trails'] !== undefined ? JSON.stringify(eff['Trails'], null, 2) : ''}
            onChange={(e) => {
              const v = e.target.value.trim()
              if (!v) {
                const copy = { ...eff }
                delete copy['Trails']
                onChange(key, Object.keys(copy).length === 0 ? undefined : copy)
              } else {
                try {
                  const parsed = JSON.parse(v)
                  onChange(key, { ...eff, Trails: parsed })
                } catch {
                  // keep as string in error state
                }
              }
            }}
            style={{ ...TEXTAREA_STYLE, minHeight: 40 }}
            placeholder='[{ "TrailId": "..." }]'
          />
        </div>
      </div>
    )
  }

  // All other complex types: JSON textarea
  const jsonValue =
    value === undefined || value === null
      ? ''
      : typeof value === 'object'
      ? JSON.stringify(value, null, 2)
      : String(value)

  const rows =
    type === 'dict-time' ? 5
    : type === 'dict-stat-number' ? 3
    : type === 'array-ref' ? 3
    : 4

  const placeholder =
    type === 'dict-stat-number' ? '{\n  "Stamina": 0.1\n}'
    : type === 'dict-time' ? '{\n  "0": "InteractionId",\n  "0.35": { "Type": "Replace", ... }\n}'
    : type === 'array-ref' ? '[\n  "InteractionId1",\n  "InteractionId2"\n]'
    : type === 'array-string' ? '["item1", "item2"]'
    : '{ }'

  return (
    <div key={key} style={FIELD_WRAP}>
      {labelEl}
      {description && <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>{description}</div>}
      <textarea
        rows={rows}
        defaultValue={jsonValue}
        onBlur={(e) => {
          const v = e.target.value.trim()
          if (!v) {
            onChange(key, undefined)
            return
          }
          try {
            onChange(key, JSON.parse(v))
          } catch {
            // Invalid JSON — don't update (user is still typing)
          }
        }}
        style={TEXTAREA_STYLE}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Extra / unknown fields (fields in rawFields not in schema)
// ─────────────────────────────────────────────────────────────

function ExtraFields({
  rawFields,
  schemaKeys,
  onChange,
}: {
  rawFields: Record<string, unknown>
  schemaKeys: Set<string>
  onChange: (key: string, val: unknown) => void
}) {
  // Edge-derived keys that we don't want to show (they're managed by graph edges)
  const GRAPH_KEYS = new Set(['Next', 'Failed', 'Interactions', 'ForkInteractions',
    'CollisionNext', 'GroundNext', 'StartInteraction', 'CancelInteraction'])

  const extraKeys = Object.keys(rawFields).filter(
    (k) => k !== 'Type' && !schemaKeys.has(k) && !GRAPH_KEYS.has(k),
  )

  if (extraKeys.length === 0) return null

  return (
    <div
      style={{
        marginTop: 10,
        borderTop: '1px solid #333',
        paddingTop: 10,
      }}
    >
      <div style={{ fontSize: 10, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Additional Fields
      </div>
      {extraKeys.map((k) => {
        const val = rawFields[k]
        const isComplex = typeof val === 'object' && val !== null
        return (
          <div key={k} style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>{k}</label>
            {isComplex ? (
              <textarea
                rows={3}
                defaultValue={JSON.stringify(val, null, 2)}
                onBlur={(e) => {
                  try { onChange(k, JSON.parse(e.target.value)) } catch { /* ignore */ }
                }}
                style={TEXTAREA_STYLE}
                spellCheck={false}
              />
            ) : (
              <input
                type="text"
                defaultValue={val === undefined || val === null ? '' : String(val)}
                onBlur={(e) => onChange(k, e.target.value || undefined)}
                style={INPUT_STYLE}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function InteractionFormPanel({
  nodeId,
  nodeType,
  rawFields,
  isExternal,
  onApply,
  onSaveToServer,
  onClose,
}: InteractionFormPanelProps) {
  const [tab, setTab] = useState<Tab>('form')
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...rawFields })
  const [rawText, setRawText] = useState(() => JSON.stringify(rawFields, null, 2))
  const [rawError, setRawError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // Reset draft whenever the selected node changes
  useEffect(() => {
    setDraft({ ...rawFields })
    setRawText(JSON.stringify(rawFields, null, 2))
    setRawError(null)
    setDirty(false)
  }, [nodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const schema = getSchemaForType(nodeType)
  const typeColor = getColorForInteractionType(nodeType)

  function handleFieldChange(key: string, val: unknown) {
    setDraft((prev) => {
      const next = { ...prev }
      if (val === undefined || val === null || val === '') {
        delete next[key]
      } else {
        next[key] = val
      }
      return next
    })
    setDirty(true)
  }

  function handleApply() {
    if (tab === 'raw') {
      try {
        const parsed = JSON.parse(rawText)
        onApply(parsed)
        setDraft(parsed)
        setRawError(null)
        setDirty(false)
      } catch (e) {
        setRawError('Invalid JSON: ' + String(e))
      }
    } else {
      onApply({ ...draft, Type: nodeType })
      setDirty(false)
    }
  }

  function handleRawChange(text: string) {
    setRawText(text)
    setRawError(null)
    setDirty(true)
    try {
      JSON.parse(text)
    } catch {
      setRawError('Invalid JSON')
    }
  }

  const schemaKeys = new Set(schema?.fields.map((f) => f.key) ?? [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(18, 18, 28, 0.98)',
        color: '#ddd',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: typeColor,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {nodeType}
          </div>
          <div
            style={{
              fontSize: 10,
              color: '#666',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {nodeId}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '3px 8px',
            background: '#2a2a3a',
            color: '#aaa',
            border: '1px solid #444',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #333',
          flexShrink: 0,
        }}
      >
        {(['form', 'raw'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '7px 0',
              background: 'transparent',
              color: tab === t ? typeColor : '#666',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${typeColor}` : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: tab === t ? 700 : 400,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {t === 'form' ? 'Form' : 'Raw JSON'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {tab === 'form' ? (
          <>
            {isExternal ? (
              <div style={{ color: '#888', fontStyle: 'italic', fontSize: 12 }}>
                External node — fields are read-only (edit by opening the asset directly).
              </div>
            ) : schema ? (
              <>
                {schema.fields.map((field) =>
                  renderField(field as FieldDef & { type: FieldType }, draft[field.key], handleFieldChange),
                )}
                <ExtraFields
                  rawFields={draft}
                  schemaKeys={schemaKeys}
                  onChange={handleFieldChange}
                />
              </>
            ) : (
              <>
                <div style={{ color: '#888', fontSize: 11, marginBottom: 10 }}>
                  No schema for type "{nodeType}" — showing raw JSON.
                </div>
                <ExtraFields
                  rawFields={draft}
                  schemaKeys={new Set()}
                  onChange={handleFieldChange}
                />
              </>
            )}
          </>
        ) : (
          <>
            <textarea
              value={rawText}
              onChange={(e) => handleRawChange(e.target.value)}
              style={{
                ...TEXTAREA_STYLE,
                width: '100%',
                minHeight: 300,
                fontSize: 11,
              }}
              spellCheck={false}
            />
            {rawError && (
              <div style={{ color: '#FF6B6B', fontSize: 11, marginTop: 4 }}>{rawError}</div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {!isExternal && (
        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid #333',
            display: 'flex',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleApply}
            disabled={!dirty || (tab === 'raw' && rawError !== null)}
            style={{
              flex: 1,
              padding: '7px 0',
              background: dirty ? typeColor : '#333',
              color: dirty ? '#000' : '#555',
              border: 'none',
              borderRadius: 4,
              cursor: dirty ? 'pointer' : 'not-allowed',
              fontSize: 12,
              fontWeight: 700,
              transition: 'background 0.15s',
            }}
          >
            Apply
          </button>
          {onSaveToServer && (
            <button
              onClick={onSaveToServer}
              style={{
                flex: 1,
                padding: '7px 0',
                background: '#1a3a1a',
                color: '#55EFC4',
                border: '1px solid #55EFC4',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Save to Server
            </button>
          )}
        </div>
      )}
    </div>
  )
}
