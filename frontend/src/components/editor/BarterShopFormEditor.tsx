import type React from 'react'

import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE } from './formStyles'

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemRef = {
  ItemId?: string
  Quantity?: number
  [key: string]: unknown
}

type Stock = number | [number, number]

type TradeEntry = {
  Weight?: number
  Output?: ItemRef
  Input?: ItemRef[]
  Stock?: Stock
  [key: string]: unknown
}

type FixedSlot = {
  Type: 'Fixed'
  Trade?: TradeEntry
}

type PoolSlot = {
  Type: 'Pool'
  SlotCount?: number
  Trades?: TradeEntry[]
}

type TradeSlot = FixedSlot | PoolSlot | { Type: string; [key: string]: unknown }

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

const SLOT_STYLE: React.CSSProperties = {
  border: '1px solid #2a3450',
  borderRadius: 5,
  padding: '10px 12px',
  marginBottom: 10,
  background: 'rgba(20, 20, 38, 0.6)',
}

const TRADE_ENTRY_STYLE: React.CSSProperties = {
  border: '1px solid #1e2840',
  borderRadius: 4,
  padding: '8px 10px',
  marginBottom: 6,
  background: 'rgba(15, 15, 30, 0.5)',
}

const GRID2_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
}

const GRID3_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 8,
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
  padding: '2px 8px',
  fontSize: 10,
  borderColor: '#6b2a2a',
  color: '#f08080',
}

const BADGE_FIXED: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.05em',
  borderRadius: 3,
  padding: '2px 7px',
  background: '#6c5ce7',
  color: '#fff',
  marginRight: 8,
}

const BADGE_POOL: React.CSSProperties = {
  ...BADGE_FIXED,
  background: '#e84393',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asItemRef(v: unknown): ItemRef {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as ItemRef
  return {}
}

function asItemRefArray(v: unknown): ItemRef[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => x && typeof x === 'object') as ItemRef[]
}

function asTradeEntryArray(v: unknown): TradeEntry[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => x && typeof x === 'object') as TradeEntry[]
}

function asSlotArray(v: unknown): TradeSlot[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => x && typeof x === 'object') as TradeSlot[]
}

function stockToString(stock: Stock | undefined): string {
  if (stock === undefined) return ''
  if (Array.isArray(stock)) return `${stock[0]}-${stock[1]}`
  return String(stock)
}

function parseStock(s: string): Stock | undefined {
  s = s.trim()
  if (!s) return undefined
  if (s.includes('-')) {
    const [a, b] = s.split('-').map(Number)
    if (!isNaN(a) && !isNaN(b)) return [a, b]
  }
  const n = Number(s)
  return isNaN(n) ? undefined : n
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

// ─── Item ref editor (inline) ─────────────────────────────────────────────────

type ItemRefEditorProps = {
  label: string
  item: ItemRef
  onChange: (updated: ItemRef) => void
  readOnly: boolean
}

function ItemRefEditor({ label, item, onChange, readOnly }: ItemRefEditorProps) {
  return (
    <div style={GRID2_STYLE}>
      <div style={FIELD_WRAP}>
        <label style={LABEL_STYLE}>{label} — Item ID</label>
        <input
          style={INPUT_STYLE}
          value={item.ItemId ?? ''}
          readOnly={readOnly}
          placeholder="e.g. Ingredient_Spices"
          onChange={(e) => onChange({ ...item, ItemId: e.target.value || undefined })}
        />
      </div>
      <div style={FIELD_WRAP}>
        <label style={LABEL_STYLE}>{label} — Quantity</label>
        <input
          type="number"
          style={INPUT_STYLE}
          value={item.Quantity ?? ''}
          readOnly={readOnly}
          onChange={(e) => onChange({ ...item, Quantity: e.target.value === '' ? undefined : Number(e.target.value) })}
        />
      </div>
    </div>
  )
}

// ─── Inputs list editor ───────────────────────────────────────────────────────

type InputsEditorProps = {
  inputs: ItemRef[]
  onChange: (updated: ItemRef[]) => void
  readOnly: boolean
}

function InputsEditor({ inputs, onChange, readOnly }: InputsEditorProps) {
  return (
    <div>
      <label style={{ ...LABEL_STYLE, marginBottom: 4 }}>Input(s) — what the player pays</label>
      {inputs.map((inp, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 28px', gap: 6, marginBottom: 4, alignItems: 'end' }}>
          <div>
            {i === 0 && <label style={{ ...LABEL_STYLE, marginBottom: 2 }}>Item ID</label>}
            <input
              style={INPUT_STYLE}
              value={inp.ItemId ?? ''}
              readOnly={readOnly}
              placeholder="e.g. Ingredient_Life_Essence"
              onChange={(e) => {
                const next = deepClone(inputs)
                next[i] = { ...next[i], ItemId: e.target.value || undefined }
                onChange(next)
              }}
            />
          </div>
          <div>
            {i === 0 && <label style={{ ...LABEL_STYLE, marginBottom: 2 }}>Qty</label>}
            <input
              type="number"
              style={INPUT_STYLE}
              value={inp.Quantity ?? ''}
              readOnly={readOnly}
              onChange={(e) => {
                const next = deepClone(inputs)
                next[i] = { ...next[i], Quantity: e.target.value === '' ? undefined : Number(e.target.value) }
                onChange(next)
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            {!readOnly && (
              <button style={BTN_DANGER} onClick={() => {
                const next = deepClone(inputs)
                next.splice(i, 1)
                onChange(next)
              }}>✕</button>
            )}
          </div>
        </div>
      ))}
      {!readOnly && (
        <button style={BTN_STYLE} onClick={() => onChange([...inputs, { ItemId: '', Quantity: 1 }])}>
          + Add input
        </button>
      )}
    </div>
  )
}

// ─── Single trade entry ───────────────────────────────────────────────────────

type TradeEntryEditorProps = {
  entry: TradeEntry
  index: number
  isPool: boolean
  onChange: (updated: TradeEntry) => void
  onRemove?: () => void
  readOnly: boolean
}

function TradeEntryEditor({ entry, index, isPool, onChange, onRemove, readOnly }: TradeEntryEditorProps) {
  const output = asItemRef(entry.Output)
  const inputs = asItemRefArray(entry.Input)

  return (
    <div style={TRADE_ENTRY_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#6a7ab0', marginRight: 'auto' }}>Trade #{index + 1}</span>
        {!readOnly && onRemove && (
          <button style={BTN_DANGER} onClick={onRemove}>Remove</button>
        )}
      </div>

      {/* Pool weight */}
      {isPool && (
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Weight (relative chance)</label>
          <input
            type="number"
            style={INPUT_STYLE}
            value={entry.Weight ?? ''}
            readOnly={readOnly}
            onChange={(e) => onChange({ ...entry, Weight: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </div>
      )}

      {/* Output */}
      <ItemRefEditor
        label="Output"
        item={output}
        onChange={(updated) => onChange({ ...entry, Output: updated })}
        readOnly={readOnly}
      />

      {/* Inputs */}
      <div style={{ marginTop: 8 }}>
        <InputsEditor
          inputs={inputs}
          onChange={(updated) => onChange({ ...entry, Input: updated })}
          readOnly={readOnly}
        />
      </div>

      {/* Stock */}
      <div style={{ marginTop: 8 }}>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Stock (fixed number or range, e.g. <code>10</code> or <code>4-8</code>)</label>
          <input
            style={INPUT_STYLE}
            value={stockToString(entry.Stock as Stock)}
            readOnly={readOnly}
            placeholder="10 or 4-8"
            onChange={(e) => onChange({ ...entry, Stock: parseStock(e.target.value) })}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Slot editor ──────────────────────────────────────────────────────────────

type SlotEditorProps = {
  slot: TradeSlot
  index: number
  onChange: (updated: TradeSlot) => void
  onRemove: () => void
  readOnly: boolean
}

function SlotEditor({ slot, index, onChange, onRemove, readOnly }: SlotEditorProps) {
  const isFixed = slot.Type === 'Fixed'
  const isPool = slot.Type === 'Pool'
  const fixedSlot = slot as FixedSlot
  const poolSlot = slot as PoolSlot

  function setType(type: string): void {
    if (type === 'Fixed') {
      onChange({ Type: 'Fixed', Trade: { Output: { ItemId: '' }, Input: [], Stock: 10 } })
    } else {
      onChange({ Type: 'Pool', SlotCount: 1, Trades: [] })
    }
  }

  return (
    <div style={SLOT_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <span style={isPool ? BADGE_POOL : BADGE_FIXED}>{slot.Type}</span>
        <span style={{ fontSize: 11, color: '#5a6080', marginRight: 'auto' }}>Slot #{index + 1}</span>
        {!readOnly && (
          <button style={BTN_DANGER} onClick={onRemove}>Remove slot</button>
        )}
      </div>

      {/* Type selector */}
      <div style={{ ...FIELD_WRAP, marginBottom: 10 }}>
        <label style={LABEL_STYLE}>Slot Type</label>
        <select
          style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer' }}
          value={slot.Type}
          disabled={readOnly}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="Fixed">Fixed</option>
          <option value="Pool">Pool</option>
        </select>
      </div>

      {/* Fixed: single trade */}
      {isFixed && (
        <TradeEntryEditor
          entry={fixedSlot.Trade ?? {}}
          index={0}
          isPool={false}
          onChange={(updated) => onChange({ ...slot, Trade: updated })}
          readOnly={readOnly}
        />
      )}

      {/* Pool: SlotCount + trade list */}
      {isPool && (
        <>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Slot Count (how many trades to pick from pool)</label>
            <input
              type="number"
              style={INPUT_STYLE}
              value={poolSlot.SlotCount ?? ''}
              readOnly={readOnly}
              onChange={(e) => onChange({ ...slot, SlotCount: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ ...LABEL_STYLE, marginBottom: 6 }}>
              Pool trades ({asTradeEntryArray(poolSlot.Trades).length})
            </label>
            {asTradeEntryArray(poolSlot.Trades).map((entry, ei) => (
              <TradeEntryEditor
                key={ei}
                entry={entry}
                index={ei}
                isPool
                onChange={(updated) => {
                  const next = deepClone(asTradeEntryArray(poolSlot.Trades))
                  next[ei] = updated
                  onChange({ ...slot, Trades: next })
                }}
                onRemove={() => {
                  const next = deepClone(asTradeEntryArray(poolSlot.Trades))
                  next.splice(ei, 1)
                  onChange({ ...slot, Trades: next })
                }}
                readOnly={readOnly}
              />
            ))}
            {!readOnly && (
              <button
                style={BTN_STYLE}
                onClick={() => {
                  const next = deepClone(asTradeEntryArray(poolSlot.Trades))
                  next.push({ Weight: 10, Output: { ItemId: '' }, Input: [], Stock: 10 })
                  onChange({ ...slot, Trades: next })
                }}
              >
                + Add pool trade
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function BarterShopFormEditor({ json, onChange, readOnly }: Props) {
  const slots = asSlotArray(json['TradeSlots'])
  const refreshInterval = (json['RefreshInterval'] as Record<string, unknown>) ?? {}

  function set(key: string, value: unknown): void {
    onChange({ ...json, [key]: value })
  }

  function updateSlot(i: number, updated: TradeSlot): void {
    const next = deepClone(slots)
    next[i] = updated
    set('TradeSlots', next)
  }

  function removeSlot(i: number): void {
    const next = deepClone(slots)
    next.splice(i, 1)
    set('TradeSlots', next)
  }

  function addSlot(type: 'Fixed' | 'Pool'): void {
    const next = deepClone(slots)
    if (type === 'Fixed') {
      next.push({ Type: 'Fixed', Trade: { Output: { ItemId: '' }, Input: [], Stock: 10 } })
    } else {
      next.push({ Type: 'Pool', SlotCount: 1, Trades: [] })
    }
    set('TradeSlots', next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* ── Shop identity ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Shop</div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Display Name Key</label>
          <input
            style={INPUT_STYLE}
            value={(json['DisplayNameKey'] as string) ?? ''}
            readOnly={readOnly}
            placeholder="server.barter.merchant.title"
            onChange={(e) => set('DisplayNameKey', e.target.value || undefined)}
          />
        </div>
        <div style={GRID3_STYLE}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Refresh (Days)</label>
            <input
              type="number"
              style={INPUT_STYLE}
              value={(refreshInterval['Days'] as number) ?? ''}
              readOnly={readOnly}
              onChange={(e) =>
                set('RefreshInterval', {
                  ...refreshInterval,
                  Days: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Restock Hour (0–23)</label>
            <input
              type="number"
              style={INPUT_STYLE}
              min={0}
              max={23}
              value={(json['RestockHour'] as number) ?? ''}
              readOnly={readOnly}
              onChange={(e) => set('RestockHour', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* ── Trade slots ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>
          Trade Slots ({slots.length})
        </div>
        {slots.map((slot, i) => (
          <SlotEditor
            key={i}
            slot={slot}
            index={i}
            onChange={(updated) => updateSlot(i, updated)}
            onRemove={() => removeSlot(i)}
            readOnly={readOnly}
          />
        ))}
        {!readOnly && (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button style={BTN_STYLE} onClick={() => addSlot('Fixed')}>+ Add Fixed slot</button>
            <button style={BTN_STYLE} onClick={() => addSlot('Pool')}>+ Add Pool slot</button>
          </div>
        )}
      </div>

    </div>
  )
}
