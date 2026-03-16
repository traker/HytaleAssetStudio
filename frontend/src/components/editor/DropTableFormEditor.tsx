import type React from 'react'

import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE, TEXTAREA_STYLE } from './formStyles'

// ─── Types ────────────────────────────────────────────────────────────────────

type ContainerType = 'Multiple' | 'Choice' | 'Single'

type DropItem = {
  ItemId?: string
  QuantityMin?: number
  QuantityMax?: number
  Quantity?: number
  [key: string]: unknown
}

type DropContainer = {
  Type: ContainerType
  Weight?: number
  Item?: DropItem
  Containers?: DropContainer[]
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

const ENTRY_STYLE: React.CSSProperties = {
  border: '1px solid #2a3450',
  borderRadius: 5,
  padding: '8px 10px',
  marginBottom: 8,
  background: 'rgba(20, 20, 38, 0.6)',
}

const ROW_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
}

const BADGE_BASE: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.05em',
  borderRadius: 3,
  padding: '2px 6px',
  marginRight: 6,
  color: '#111',
}

const BADGE_COLOR: Record<ContainerType, string> = {
  Multiple: '#4ECDC4',
  Choice: '#FFE66D',
  Single: '#A8E6CF',
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
  borderColor: '#6b2a2a',
  color: '#f08080',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asContainer(v: unknown): DropContainer | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return v as DropContainer
}

function asContainerArray(v: unknown): DropContainer[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => asContainer(x) !== null) as DropContainer[]
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type ItemEditorProps = {
  item: DropItem
  onChange: (updated: DropItem) => void
  readOnly: boolean
}

function ItemEditor({ item, onChange, readOnly }: ItemEditorProps) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={FIELD_WRAP}>
        <label style={LABEL_STYLE}>Item ID</label>
        <input
          style={INPUT_STYLE}
          value={item.ItemId ?? ''}
          readOnly={readOnly}
          onChange={(e) => onChange({ ...item, ItemId: e.target.value })}
          placeholder="e.g. Weapon_Mace_Scrap"
        />
      </div>
      <div style={ROW_STYLE}>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Qty Min</label>
          <input
            type="number"
            style={INPUT_STYLE}
            value={item.QuantityMin ?? ''}
            readOnly={readOnly}
            onChange={(e) => onChange({ ...item, QuantityMin: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Qty Max</label>
          <input
            type="number"
            style={INPUT_STYLE}
            value={item.QuantityMax ?? ''}
            readOnly={readOnly}
            onChange={(e) => onChange({ ...item, QuantityMax: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  )
}

type EntryEditorProps = {
  entry: DropContainer
  index: number
  onChange: (updated: DropContainer) => void
  onRemove: () => void
  readOnly: boolean
}

function EntryEditor({ entry, index, onChange, onRemove, readOnly }: EntryEditorProps) {
  const color = BADGE_COLOR[entry.Type] ?? '#888'
  const hasDeepNesting =
    entry.Type !== 'Single' &&
    asContainerArray(entry.Containers).some(
      (c) => c.Type !== 'Single' || asContainerArray(c.Containers).length > 0,
    )

  function setField(key: string, value: unknown): void {
    onChange({ ...entry, [key]: value })
  }

  return (
    <div style={ENTRY_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ ...BADGE_BASE, background: color }}>{entry.Type}</span>
        <span style={{ fontSize: 11, color: '#5a6070', marginRight: 'auto' }}>#{index + 1}</span>
        {!readOnly && (
          <button style={BTN_DANGER} onClick={onRemove}>Remove</button>
        )}
      </div>

      {/* Choice: weight */}
      {entry.Type === 'Choice' && (
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Weight</label>
          <input
            type="number"
            style={INPUT_STYLE}
            value={entry.Weight ?? ''}
            readOnly={readOnly}
            onChange={(e) => setField('Weight', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </div>
      )}

      {/* Single: item fields */}
      {entry.Type === 'Single' && (
        <ItemEditor
          item={entry.Item ?? {}}
          onChange={(updated) => setField('Item', updated)}
          readOnly={readOnly}
        />
      )}

      {/* Choice or Multiple with Single children: inline list */}
      {entry.Type !== 'Single' && !hasDeepNesting && (
        <div>
          <div style={{ ...LABEL_STYLE, marginBottom: 4 }}>
            Sub-containers ({asContainerArray(entry.Containers).length})
          </div>
          {asContainerArray(entry.Containers).map((child, ci) => (
            <div key={ci} style={{ ...ENTRY_STYLE, background: 'rgba(10,10,20,0.4)', marginLeft: 8 }}>
              <span style={{ ...BADGE_BASE, background: BADGE_COLOR[child.Type] ?? '#888' }}>{child.Type}</span>
              {child.Type === 'Choice' && (
                <span style={{ fontSize: 11, color: '#8a9' }}>weight: {child.Weight ?? '?'}</span>
              )}
              {child.Type === 'Single' && (
                <ItemEditor
                  item={child.Item ?? {}}
                  onChange={(updated) => {
                    const next = deepClone(asContainerArray(entry.Containers))
                    next[ci] = { ...next[ci], Item: updated }
                    setField('Containers', next)
                  }}
                  readOnly={readOnly}
                />
              )}
            </div>
          ))}
          {!readOnly && (
            <button
              style={{ ...BTN_STYLE, marginTop: 4 }}
              onClick={() => {
                const next = deepClone(asContainerArray(entry.Containers))
                next.push({ Type: 'Single', Item: { ItemId: '' } })
                setField('Containers', next)
              }}
            >
              + Add sub-container
            </button>
          )}
        </div>
      )}

      {/* Deep nesting: textarea fallback */}
      {entry.Type !== 'Single' && hasDeepNesting && (
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>
            Sub-containers (complex — edit as JSON)
          </label>
          <textarea
            style={{ ...TEXTAREA_STYLE, minHeight: 90 }}
            value={JSON.stringify(entry.Containers ?? [], null, 2)}
            readOnly={readOnly}
            onChange={(e) => {
              try { setField('Containers', JSON.parse(e.target.value)) } catch { /* ignore */ }
            }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Root editor ──────────────────────────────────────────────────────────────

function RootContainerEditor({
  container,
  onChange,
  readOnly,
}: {
  container: DropContainer
  onChange: (updated: DropContainer) => void
  readOnly: boolean
}) {
  const entries = asContainerArray(container.Containers)

  function setType(t: ContainerType): void {
    onChange({ ...container, Type: t })
  }

  function updateEntry(i: number, updated: DropContainer): void {
    const next = deepClone(entries)
    next[i] = updated
    onChange({ ...container, Containers: next })
  }

  function removeEntry(i: number): void {
    const next = deepClone(entries)
    next.splice(i, 1)
    onChange({ ...container, Containers: next })
  }

  function addEntry(): void {
    const next = deepClone(entries)
    next.push({ Type: 'Single', Item: { ItemId: '' } })
    onChange({ ...container, Containers: next })
  }

  return (
    <div>
      {/* Root type */}
      <div style={FIELD_WRAP}>
        <label style={LABEL_STYLE}>Root Container Type</label>
        <select
          style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer' }}
          value={container.Type}
          disabled={readOnly}
          onChange={(e) => setType(e.target.value as ContainerType)}
        >
          <option value="Multiple">Multiple</option>
          <option value="Choice">Choice</option>
          <option value="Single">Single</option>
        </select>
      </div>

      {/* Root-level Single */}
      {container.Type === 'Single' && (
        <ItemEditor
          item={container.Item ?? {}}
          onChange={(updated) => onChange({ ...container, Item: updated })}
          readOnly={readOnly}
        />
      )}

      {/* Root-level Choice weight */}
      {container.Type === 'Choice' && (
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Weight</label>
          <input
            type="number"
            style={INPUT_STYLE}
            value={container.Weight ?? ''}
            readOnly={readOnly}
            onChange={(e) =>
              onChange({ ...container, Weight: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          />
        </div>
      )}

      {/* Children list (Multiple or Choice) */}
      {container.Type !== 'Single' && (
        <div>
          <div style={SECTION_TITLE_STYLE}>
            Containers ({entries.length})
          </div>
          {entries.map((entry, i) => (
            <EntryEditor
              key={i}
              entry={entry}
              index={i}
              onChange={(updated) => updateEntry(i, updated)}
              onRemove={() => removeEntry(i)}
              readOnly={readOnly}
            />
          ))}
          {!readOnly && (
            <button style={BTN_STYLE} onClick={addEntry}>
              + Add container
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function DropTableFormEditor({ json, onChange, readOnly }: Props) {
  const container = asContainer(json['Container'])

  function updateContainer(updated: DropContainer): void {
    onChange({ ...json, Container: updated })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Drop Table</div>

        {container ? (
          <RootContainerEditor
            container={container}
            onChange={updateContainer}
            readOnly={readOnly}
          />
        ) : (
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
              No Container defined. Create one:
            </div>
            {!readOnly && (
              <button
                style={BTN_STYLE}
                onClick={() =>
                  updateContainer({ Type: 'Multiple', Containers: [] })
                }
              >
                + Create Container
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
