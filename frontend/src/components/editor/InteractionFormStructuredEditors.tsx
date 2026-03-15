import { useState } from 'react'

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

type InteractionListEntry = { id: string; val: unknown }
type InteractionMapEntry = { id: string; key: string; val: unknown }
type HitEntityRuleEntry = { id: string; matchers: unknown; next: unknown }

let interactionStructuredEditorSequence = 0

function nextStructuredEditorId(prefix: string): string {
  interactionStructuredEditorSequence += 1
  return `${prefix}_${interactionStructuredEditorSequence}`
}

function dictFromUnknown(val: unknown): Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {}
}

function arrayFromUnknown(val: unknown): unknown[] {
  return Array.isArray(val) ? val : []
}

function FieldSection({
  title,
  description,
  children,
  collapsible = false,
  defaultCollapsed = false,
}: {
  title: string
  description?: string
  children: React.ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div
      style={{
        marginBottom: 14,
        padding: '12px 12px 4px',
        border: '1px solid #2b2b3f',
        borderRadius: 6,
        background: 'rgba(25, 25, 40, 0.55)',
      }}
    >
      {collapsible ? (
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            marginBottom: collapsed ? 0 : 8,
          }}
        >
          <span style={{ fontSize: 11, color: '#9da5ca', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, textAlign: 'left' }}>
            {title}
          </span>
          <span style={{ fontSize: 11, color: '#747ca0', flexShrink: 0 }}>{collapsed ? '▸' : '▾'}</span>
        </button>
      ) : (
        <div style={{ fontSize: 11, color: '#9da5ca', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>
          {title}
        </div>
      )}
      {!collapsed && description && <div style={{ fontSize: 11, color: '#666', marginBottom: 9, lineHeight: 1.45 }}>{description}</div>}
      {!collapsed && children}
    </div>
  )
}

function valLabel(val: unknown): { text: string; isInline: boolean } {
  if (val === null || val === undefined || val === '') return { text: '(empty)', isInline: false }
  if (typeof val === 'string') return { text: val, isInline: false }
  if (typeof val === 'object' && !Array.isArray(val)) {
    const t = (val as Record<string, unknown>)['Type']
    return { text: typeof t === 'string' ? t : 'inline object', isInline: true }
  }
  return { text: String(val), isInline: false }
}

export function InteractionValueEditor({
  value,
  onChange,
  refPlaceholder,
}: {
  value: unknown
  onChange: (nextVal: unknown) => void
  refPlaceholder: string
}) {
  const { text, isInline } = valLabel(value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onChange(typeof value === 'string' ? value : '')}
          style={{ background: !isInline ? '#22314a' : 'transparent', border: '1px solid #334766', color: !isInline ? '#9fd3ff' : '#6f87a8', borderRadius: 3, cursor: 'pointer', fontSize: 10, padding: '2px 6px', flexShrink: 0 }}
        >
          Ref
        </button>
        <button
          type="button"
          onClick={() => {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) onChange(value)
            else onChange({ Type: 'Simple' })
          }}
          style={{ background: isInline ? '#2f2745' : 'transparent', border: '1px solid #4b3e6b', color: isInline ? '#d4c3ff' : '#8a7fb1', borderRadius: 3, cursor: 'pointer', fontSize: 10, padding: '2px 6px', flexShrink: 0 }}
        >
          Inline
        </button>
        {isInline && <span style={{ color: '#7a7198', fontSize: 10 }}>{text}</span>}
      </div>

      {isInline ? (
        <textarea
          key={`interaction-inline-${JSON.stringify(value)}`}
          defaultValue={JSON.stringify(value, null, 2)}
          onBlur={(e) => {
            const raw = e.target.value.trim()
            if (!raw) {
              onChange(null)
              return
            }
            try {
              onChange(JSON.parse(raw))
            } catch {
              // Ignore invalid JSON while editing.
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
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value.trim() === '' ? null : e.target.value)}
          style={{ ...INPUT_STYLE, width: '100%', fontSize: 11, padding: '4px 6px' }}
          placeholder={refPlaceholder}
        />
      )}
    </div>
  )
}

export function InteractionListEditor({
  title,
  description,
  value,
  onChange,
}: {
  title: string
  description?: string
  value: unknown
  onChange: (nextValue: unknown) => void
}) {
  const toEntries = (raw: unknown): InteractionListEntry[] =>
    arrayFromUnknown(raw).map((val, index) => ({ id: `list_${index}`, val }))

  const [entries, setEntries] = useState<InteractionListEntry[]>(() => toEntries(value))

  function emit(next: InteractionListEntry[]) {
    const list = next.map((entry) => entry.val).filter((entry) => entry !== null && entry !== undefined && entry !== '')
    onChange(list.length === 0 ? undefined : list)
  }

  function updateEntry(id: string, nextVal: unknown) {
    const updated = entries.map((entry) => (entry.id === id ? { ...entry, val: nextVal } : entry))
    setEntries(updated)
    emit(updated)
  }

  function removeEntry(id: string) {
    const updated = entries.filter((entry) => entry.id !== id)
    setEntries(updated)
    emit(updated)
  }

  function addEntry() {
    setEntries((prev) => [...prev, { id: nextStructuredEditorId('list_new'), val: '' }])
  }

  return (
    <FieldSection title={title} description={description}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.length === 0 && <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>No entries yet.</div>}
        {entries.map((entry, index) => (
          <div key={entry.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ color: '#666', fontSize: 10, minWidth: 20, paddingTop: 6 }}>{index + 1}.</div>
            <InteractionValueEditor value={entry.val} onChange={(nextVal) => updateEntry(entry.id, nextVal)} refPlaceholder="Server_Id_Reference" />
            <button onClick={() => removeEntry(entry.id)} style={{ background: 'transparent', border: 'none', color: '#FF6B6B', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 2px', flexShrink: 0 }} title="Remove entry">×</button>
          </div>
        ))}
        <button onClick={addEntry} style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px dashed #444', borderRadius: 3, color: '#666', cursor: 'pointer', fontSize: 11, padding: '3px 8px' }}>+ Add entry</button>
      </div>
    </FieldSection>
  )
}

export function InteractionMapEditor({
  title,
  description,
  value,
  onChange,
}: {
  title: string
  description?: string
  value: unknown
  onChange: (nextValue: unknown) => void
}) {
  const toEntries = (raw: unknown): InteractionMapEntry[] =>
    Object.entries(dictFromUnknown(raw)).map(([key, val], index) => ({ id: `map_${index}_${key}`, key, val }))

  const [entries, setEntries] = useState<InteractionMapEntry[]>(() => toEntries(value))

  function emit(next: InteractionMapEntry[]) {
    const obj: Record<string, unknown> = {}
    for (const entry of next) {
      const trimmedKey = entry.key.trim()
      if (!trimmedKey || entry.val === null || entry.val === undefined || entry.val === '') continue
      obj[trimmedKey] = entry.val
    }
    onChange(Object.keys(obj).length === 0 ? undefined : obj)
  }

  function updateEntry(id: string, patch: Partial<InteractionMapEntry>) {
    const updated = entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    setEntries(updated)
    emit(updated)
  }

  function removeEntry(id: string) {
    const updated = entries.filter((entry) => entry.id !== id)
    setEntries(updated)
    emit(updated)
  }

  function addEntry() {
    setEntries((prev) => [...prev, { id: nextStructuredEditorId('map_new'), key: '', val: '' }])
  }

  return (
    <FieldSection title={title} description={description}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.length === 0 && <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>No flags yet.</div>}
        {entries.map((entry) => (
          <div key={entry.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <input type="text" value={entry.key} onChange={(e) => updateEntry(entry.id, { key: e.target.value })} style={{ ...INPUT_STYLE, width: 150, fontSize: 11, padding: '4px 6px', flexShrink: 0 }} placeholder="Flag name" />
            <InteractionValueEditor value={entry.val} onChange={(nextVal) => updateEntry(entry.id, { val: nextVal })} refPlaceholder="Flag interaction ID" />
            <button onClick={() => removeEntry(entry.id)} style={{ background: 'transparent', border: 'none', color: '#FF6B6B', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 2px', flexShrink: 0 }} title="Remove flag">×</button>
          </div>
        ))}
        <button onClick={addEntry} style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px dashed #444', borderRadius: 3, color: '#666', cursor: 'pointer', fontSize: 11, padding: '3px 8px' }}>+ Add flag</button>
      </div>
    </FieldSection>
  )
}

export function SelectorBranchEditor({
  title,
  description,
  value,
  onChange,
}: {
  title: string
  description?: string
  value: unknown
  onChange: (nextValue: unknown) => void
}) {
  const obj = dictFromUnknown(value)
  const interactions = Array.isArray(obj['Interactions']) ? obj['Interactions'] : []
  const extras = { ...obj }
  delete extras['Interactions']

  function emit(nextInteractions: unknown, nextExtras: Record<string, unknown> = extras) {
    const next: Record<string, unknown> = { ...nextExtras }
    if (Array.isArray(nextInteractions) && nextInteractions.length > 0) {
      next['Interactions'] = nextInteractions
    }
    onChange(Object.keys(next).length === 0 ? undefined : next)
  }

  return (
    <FieldSection title={title} description={description}>
      <InteractionListEditor title="Interactions" description="Ordered interactions executed for this selector branch." value={interactions} onChange={(nextValue) => emit(nextValue)} />
      {Object.keys(extras).length > 0 && (
        <div style={FIELD_WRAP}>
          <span style={LABEL_STYLE}>Additional Branch Fields</span>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>Optional extra keys preserved alongside the branch interaction container.</div>
          <textarea
            key={`selector-branch-extras-${title}-${JSON.stringify(extras)}`}
            rows={3}
            defaultValue={JSON.stringify(extras, null, 2)}
            onBlur={(e) => {
              const raw = e.target.value.trim()
              if (!raw) {
                emit(interactions, {})
                return
              }
              try {
                const parsed = JSON.parse(raw)
                if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) emit(interactions, parsed as Record<string, unknown>)
              } catch {
                // Ignore invalid JSON while editing.
              }
            }}
            style={TEXTAREA_STYLE}
            placeholder='{
  "$Comment": "..."
}'
            spellCheck={false}
          />
        </div>
      )}
    </FieldSection>
  )
}

export function HitEntityRulesEditor({
  value,
  onChange,
}: {
  value: unknown
  onChange: (nextValue: unknown) => void
}) {
  const toEntries = (raw: unknown): HitEntityRuleEntry[] =>
    (Array.isArray(raw) ? raw : []).map((item, index) => {
      const obj = dictFromUnknown(item)
      return { id: `rule_${index}`, matchers: Array.isArray(obj['Matchers']) ? obj['Matchers'] : [], next: obj['Next'] }
    })

  const [entries, setEntries] = useState<HitEntityRuleEntry[]>(() => toEntries(value))

  function emit(next: HitEntityRuleEntry[]) {
    const rules = next
      .map((entry) => {
        const result: Record<string, unknown> = {}
        if (Array.isArray(entry.matchers) && entry.matchers.length > 0) result['Matchers'] = entry.matchers
        if (entry.next !== null && entry.next !== undefined && entry.next !== '') result['Next'] = entry.next
        return result
      })
      .filter((entry) => Object.keys(entry).length > 0)
    onChange(rules.length === 0 ? undefined : rules)
  }

  function updateEntry(id: string, patch: Partial<HitEntityRuleEntry>) {
    const updated = entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    setEntries(updated)
    emit(updated)
  }

  function removeEntry(id: string) {
    const updated = entries.filter((entry) => entry.id !== id)
    setEntries(updated)
    emit(updated)
  }

  function addEntry() {
    setEntries((prev) => [...prev, { id: nextStructuredEditorId('rule_new'), matchers: [], next: { Interactions: [] } }])
  }

  return (
    <FieldSection title="HitEntityRules" description="Conditional entity-targeting rules. These remain form-edited for now and are not yet mapped as first-class graph branches." collapsible defaultCollapsed>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.length === 0 && <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>No hit-entity rules yet.</div>}
        {entries.map((entry, index) => (
          <div key={entry.id} style={{ border: '1px solid #2b2b3f', borderRadius: 6, padding: 10, background: 'rgba(20, 20, 34, 0.45)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: '#8d8db4', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Rule {index + 1}</div>
              <button onClick={() => removeEntry(entry.id)} style={{ background: 'transparent', border: 'none', color: '#FF6B6B', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }} title="Remove rule">×</button>
            </div>
            <div style={FIELD_WRAP}>
              <span style={LABEL_STYLE}>Matchers</span>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>{'JSON array of matcher objects, e.g. `[{"Type":"NPC"}]`.'}</div>
              <textarea
                key={`selector-matchers-${entry.id}-${JSON.stringify(entry.matchers)}`}
                rows={4}
                defaultValue={JSON.stringify(entry.matchers, null, 2)}
                onBlur={(e) => {
                  const raw = e.target.value.trim()
                  if (!raw) {
                    updateEntry(entry.id, { matchers: [] })
                    return
                  }
                  try {
                    const parsed = JSON.parse(raw)
                    if (Array.isArray(parsed)) updateEntry(entry.id, { matchers: parsed })
                  } catch {
                    // Ignore invalid JSON while editing.
                  }
                }}
                style={TEXTAREA_STYLE}
                spellCheck={false}
              />
            </div>
            <SelectorBranchEditor title="Next" description="Branch executed when the matcher set succeeds." value={entry.next} onChange={(nextValue) => updateEntry(entry.id, { next: nextValue })} />
          </div>
        ))}
        <button onClick={addEntry} style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px dashed #444', borderRadius: 3, color: '#666', cursor: 'pointer', fontSize: 11, padding: '3px 8px' }}>+ Add rule</button>
      </div>
    </FieldSection>
  )
}