/**
 * InteractionFormPanel — right-side panel for viewing/editing a selected interaction node.
 *
 * Features:
 * - Two tabs: Form (structured per-type) | Raw JSON (editable)
 * - "Apply" button → calls onApply(newRawFields) to update the node in the graph
 * - "Save to server" button (if the node has a server ID) → calls onSaveToServer
 * - Shows type-specific fields from interactionSchemas
 */

import { useEffect, useRef, useState } from 'react'
import { getColorForInteractionType } from '../graph/colors'
import { getSchemaForType, type FieldDef } from '../graph/interactionSchemas'
import { renderTypeSpecificFields } from './InteractionFormTypeSections'
import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE, TEXTAREA_STYLE } from './formStyles'
import { EffectsBlockEditor } from './EffectsBlockEditor'

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
    const eff = (typeof value === 'object' && value !== null && !Array.isArray(value))
      ? (value as Record<string, unknown>)
      : {}
    return (
      <div key={key} style={{ ...FIELD_WRAP, borderLeft: '2px solid #333', paddingLeft: 8 }}>
        <span style={{ ...LABEL_STYLE, color: '#aaa' }}>Effects</span>
        <EffectsBlockEditor
          value={eff}
          onChange={(v) => onChange(key, v)}
        />
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
// DictTimeEditor — structured editor for Charging.Next (time-dict)
// { "0": "ServerId" | { Type: "...", ... }, "0.35": ... }
// ─────────────────────────────────────────────────────────────

type DictTimeEntry = { id: string; timeKey: string; val: unknown }

function timeKeySortValue(raw: string): number {
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

function sortDictTimeEntries(entries: DictTimeEntry[]): DictTimeEntry[] {
  return [...entries].sort((left, right) => {
    const byTime = timeKeySortValue(left.timeKey) - timeKeySortValue(right.timeKey)
    if (byTime !== 0) return byTime
    return left.timeKey.localeCompare(right.timeKey)
  })
}

function valLabel(val: unknown): { text: string; isInline: boolean } {
  if (val === null || val === undefined || val === '')
    return { text: '(empty)', isInline: false }
  if (typeof val === 'string') return { text: val, isInline: false }
  if (typeof val === 'object' && !Array.isArray(val)) {
    const t = (val as Record<string, unknown>)['Type']
    return { text: typeof t === 'string' ? t : 'inline object', isInline: true }
  }
  return { text: String(val), isInline: false }
}

function dictFromUnknown(val: unknown): Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {}
}

function DictTimeEditor({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: unknown
  onChange: (key: string, val: unknown) => void
}) {
  const { key, label, description, required } = field

  const toEntries = (v: unknown): DictTimeEntry[] =>
    sortDictTimeEntries(
      Object.entries(dictFromUnknown(v)).map(([k, vv], i) => ({ id: `${i}_${k}`, timeKey: k, val: vv })),
    )

  const [entries, setEntries] = useState<DictTimeEntry[]>(() => toEntries(value))

  // Sync when the node changes (value prop changes externally)
  const prevSig = useRef(JSON.stringify(value))
  useEffect(() => {
    const sig = JSON.stringify(value)
    if (sig !== prevSig.current) {
      prevSig.current = sig
      setEntries(toEntries(value))
    }
  })

  function emit(next: DictTimeEntry[]) {
    const d: Record<string, unknown> = {}
    for (const e of sortDictTimeEntries(next)) {
      if (e.timeKey.trim() !== '') d[e.timeKey.trim()] = e.val ?? null
    }
    onChange(key, Object.keys(d).length === 0 ? undefined : d)
  }

  function handleKeyChange(id: string, newKey: string) {
    const updated = entries.map((e) => (e.id === id ? { ...e, timeKey: newKey } : e))
    setEntries(updated)
    emit(updated)
  }

  function handleStrValChange(id: string, newVal: string) {
    const updated = entries.map((e) =>
      e.id === id ? { ...e, val: newVal.trim() === '' ? null : newVal } : e,
    )
    setEntries(updated)
    emit(updated)
  }

  function handleRemove(id: string) {
    const updated = entries.filter((e) => e.id !== id)
    setEntries(updated)
    emit(updated)
  }

  function handleAdd() {
    setEntries((prev) => [...prev, { id: `new_${Date.now()}`, timeKey: '', val: null }])
  }

  function handleModeChange(id: string, mode: 'ref' | 'inline') {
    const updated = entries.map((entry) => {
      if (entry.id !== id) return entry
      if (mode === 'inline') {
        return typeof entry.val === 'object' && entry.val !== null && !Array.isArray(entry.val)
          ? entry
          : { ...entry, val: { Type: 'Simple' } }
      }
      return { ...entry, val: typeof entry.val === 'string' ? entry.val : '' }
    })
    setEntries(updated)
    emit(updated)
  }

  function handleInlineValChange(id: string, nextVal: unknown) {
    const updated = entries.map((entry) => (entry.id === id ? { ...entry, val: nextVal } : entry))
    setEntries(updated)
    emit(updated)
  }

  return (
    <div style={{ ...FIELD_WRAP, borderLeft: '2px solid #333', paddingLeft: 8 }}>
      <span style={LABEL_STYLE}>
        {label}
        {required && <span style={{ color: '#FF6B6B' }}> *</span>}
      </span>
      {description && (
        <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>{description}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {entries.length === 0 && (
          <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>No entries yet.</div>
        )}

        {entries.map((entry) => {
          const { text, isInline } = valLabel(entry.val)
          return (
            <div key={entry.id} style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>

              {/* ── Time-key input ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <input
                  type="text"
                  value={entry.timeKey}
                  onChange={(e) => handleKeyChange(entry.id, e.target.value)}
                  style={{
                    ...INPUT_STYLE,
                    width: 50,
                    fontSize: 11,
                    textAlign: 'right',
                    padding: '4px 5px',
                    fontFamily: 'monospace',
                  }}
                  placeholder="0.0"
                  title="Time offset in seconds"
                />
                <span style={{ color: '#555', fontSize: 10, flexShrink: 0 }}>s</span>
              </div>

              <span style={{ color: '#444', fontSize: 12, flexShrink: 0 }}>→</span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleModeChange(entry.id, 'ref')}
                    style={{
                      background: !isInline ? '#22314a' : 'transparent',
                      border: '1px solid #334766',
                      color: !isInline ? '#9fd3ff' : '#6f87a8',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontSize: 10,
                      padding: '2px 6px',
                      flexShrink: 0,
                    }}
                    title="Store a server ID reference"
                  >
                    Ref
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange(entry.id, 'inline')}
                    style={{
                      background: isInline ? '#2f2745' : 'transparent',
                      border: '1px solid #4b3e6b',
                      color: isInline ? '#d4c3ff' : '#8a7fb1',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontSize: 10,
                      padding: '2px 6px',
                      flexShrink: 0,
                    }}
                    title="Store an inline interaction object"
                  >
                    Inline
                  </button>
                  {isInline && (
                    <span style={{ color: '#7a7198', fontSize: 10 }}>
                      {text}
                    </span>
                  )}
                </div>

              {/* ── Value: editable if string ref, read-only badge if inline ── */}
                {isInline ? (
                  <textarea
                    key={`${entry.id}-inline`}
                    defaultValue={JSON.stringify(entry.val, null, 2)}
                    onBlur={(e) => {
                      const raw = e.target.value.trim()
                      if (!raw) {
                        handleInlineValChange(entry.id, null)
                        return
                      }
                      try {
                        handleInlineValChange(entry.id, JSON.parse(raw))
                      } catch {
                        // Ignore invalid JSON while typing; the last valid value stays in state.
                      }
                    }}
                    style={{ ...TEXTAREA_STYLE, minHeight: 84, fontSize: 11 }}
                    placeholder='{
  "Type": "Simple"
}'
                    spellCheck={false}
                  />
                ) : (
                  <input
                    type="text"
                    value={typeof entry.val === 'string' ? entry.val : ''}
                    onChange={(e) => handleStrValChange(entry.id, e.target.value)}
                    style={{ ...INPUT_STYLE, width: '100%', fontSize: 11, padding: '4px 6px' }}
                    placeholder="Server_Id_Reference"
                    title="Server ID of the referenced interaction"
                  />
                )}
              </div>

              {/* ── Remove ── */}
              <button
                onClick={() => handleRemove(entry.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#FF6B6B',
                  cursor: 'pointer',
                  fontSize: 15,
                  lineHeight: 1,
                  padding: '2px 2px',
                  flexShrink: 0,
                }}
                title="Remove entry"
              >
                ×
              </button>
            </div>
          )
        })}

        <button
          onClick={handleAdd}
          style={{
            alignSelf: 'flex-start',
            marginTop: 2,
            background: 'transparent',
            border: '1px dashed #444',
            borderRadius: 3,
            color: '#666',
            cursor: 'pointer',
            fontSize: 11,
            padding: '3px 8px',
          }}
        >
          + Add entry
        </button>
      </div>
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

  const { content: typeSpecificContent, handledKeys } = renderTypeSpecificFields(nodeType, draft, handleFieldChange, renderField)
  const visibleSchemaFields = schema?.fields.filter((field) => !handledKeys.has(field.key)) ?? []
  const schemaKeys = new Set([...(schema?.fields.map((f) => f.key) ?? []), ...handledKeys])

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
            onClick={() => {
              // Sync rawText from current draft when opening raw tab
              if (t === 'raw') setRawText(JSON.stringify({ ...draft, Type: nodeType }, null, 2))
              setTab(t)
            }}
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

      {/* Content — key=nodeId forces remount of uncontrolled textareas on node change */}
      <div key={nodeId} style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {tab === 'form' ? (
          <>
            {isExternal ? (
              <div style={{ color: '#888', fontStyle: 'italic', fontSize: 12 }}>
                External node — fields are read-only (edit by opening the asset directly).
              </div>
            ) : schema ? (
              <>
                {typeSpecificContent}
                {visibleSchemaFields.map((field) =>
                  field.type === 'dict-time' ? (
                    <DictTimeEditor
                      key={field.key}
                      field={field}
                      value={draft[field.key]}
                      onChange={handleFieldChange}
                    />
                  ) : (
                    renderField(field, draft[field.key], handleFieldChange)
                  ),
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
