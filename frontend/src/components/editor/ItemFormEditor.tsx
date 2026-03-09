/**
 * ItemFormEditor — structured form editor for Hytale item/asset JSON files.
 *
 * Covers the main "item metadata" fields common across weapons, food, tools, etc.
 * Does NOT handle:
 *   - InteractionVars → own tab in AssetSidePanel
 *   - Complex sub-objects (BlockType, Glider, IconProperties, Recipe…) → JSON textarea fallback
 *
 * The `Interactions` field in items is a SLOT MAP (Primary/Secondary/Ability1…)
 * whose values are either:
 *   - a string server ID → editable text input
 *   - an inline object { Interactions: [...], ... } → read-only badge (edit in JSON tab)
 */

import { useState } from 'react'

// ─────────────────────────────────────────────────────────────
// Style constants
// ─────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#1a1a2e',
  border: '1px solid #3a3a5c',
  borderRadius: 4,
  color: '#ddd',
  fontSize: 12,
  padding: '4px 7px',
  outline: 'none',
  fontFamily: 'monospace',
}

const SMALL_INPUT: React.CSSProperties = { ...INPUT, fontSize: 11, padding: '3px 6px' }

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: '#777',
  marginBottom: 2,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const SECTION_HEADER: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#61dafb',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginTop: 14,
  marginBottom: 6,
  borderBottom: '1px solid #222',
  paddingBottom: 3,
}

const FIELD: React.CSSProperties = { marginBottom: 8 }

const INLINE_BADGE: React.CSSProperties = {
  display: 'inline-block',
  background: '#1a2030',
  border: '1px solid #2a3a5c',
  borderRadius: 3,
  padding: '3px 7px',
  fontSize: 11,
  color: '#74B9FF',
  fontWeight: 600,
  fontFamily: 'monospace',
}

const ADD_BTN: React.CSSProperties = {
  background: 'transparent',
  border: '1px dashed #444',
  borderRadius: 3,
  color: '#666',
  cursor: 'pointer',
  fontSize: 11,
  padding: '2px 8px',
  marginTop: 4,
}

const REMOVE_BTN: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#FF6B6B',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  padding: '0 3px',
  flexShrink: 0,
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const ITEM_QUALITY_OPTIONS = [
  'Template', 'Technical', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary',
]

// These keys are all handled explicitly in the form — excluded from "Extra fields"
const HANDLED_KEYS = new Set([
  'Parent',
  'TranslationProperties',
  'Quality',
  'ItemLevel',
  'MaxStack',
  'Scale',
  'Consumable',
  'Model',
  'Texture',
  'Icon',
  'DroppedItemAnimation',
  'PlayerAnimationsId',
  'ItemSoundSetId',
  'Reticle',
  'MaxDurability',
  'DurabilityLossOnHit',
  'Interactions',  // slot refs — handled in dedicated section
  'InteractionVars',  // own tab in AssetSidePanel — skip entirely
  'InteractionConfig',
  'Categories',
  'Tags',
  'Recipe',
  'IconProperties',
])

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function asObj(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
}

function isInlineSlot(v: unknown): boolean {
  return typeof v === 'object' && v !== null
}

function getStr(obj: Record<string, unknown>, k: string): string {
  const v = obj[k]
  return typeof v === 'string' ? v : ''
}

function getNum(obj: Record<string, unknown>, k: string): string {
  const v = obj[k]
  return typeof v === 'number' ? String(v) : ''
}

// ─────────────────────────────────────────────────────────────
// Interactions slot editor
// ─────────────────────────────────────────────────────────────

const KNOWN_SLOTS = ['Primary', 'Secondary', 'Ability1', 'Ability2', 'SwapFrom', 'Use']

function InteractionSlotsEditor({
  value,
  onChange,
  readOnly,
}: {
  value: unknown
  onChange: (v: Record<string, unknown> | undefined) => void
  readOnly: boolean
}) {
  const slots = asObj(value)
  const slotEntries = Object.entries(slots)

  const [newSlotKey, setNewSlotKey] = useState('')

  function setSlot(key: string, val: string) {
    onChange({ ...slots, [key]: val })
  }

  function removeSlot(key: string) {
    const next = { ...slots }
    delete next[key]
    onChange(Object.keys(next).length > 0 ? next : undefined)
  }

  function addSlot() {
    const k = newSlotKey.trim()
    if (!k) return
    onChange({ ...slots, [k]: '' })
    setNewSlotKey('')
  }

  if (slotEntries.length === 0 && readOnly) return (
    <div style={{ color: '#555', fontStyle: 'italic', fontSize: 11 }}>Aucun slot défini.</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {slotEntries.map(([key, val]) => (
        <div key={key} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Slot name */}
          <div
            style={{
              flexShrink: 0,
              width: 90,
              fontSize: 11,
              color: '#a0a0d0',
              fontWeight: 700,
              fontFamily: 'monospace',
              textAlign: 'right',
              paddingRight: 4,
            }}
          >
            {key}
          </div>
          <span style={{ color: '#444', fontSize: 12, flexShrink: 0 }}>→</span>

          {/* Value */}
          {isInlineSlot(val) ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={INLINE_BADGE}
                title="Interaction inline — éditez via l'onglet JSON ou l'éditeur d'arbre"
              >
                inline
              </span>
              <span style={{ fontSize: 10, color: '#555' }}>
                (éditer dans l'onglet JSON)
              </span>
            </div>
          ) : (
            <input
              type="text"
              value={typeof val === 'string' ? val : ''}
              onChange={(e) => !readOnly && setSlot(key, e.target.value)}
              readOnly={readOnly}
              style={{ ...SMALL_INPUT, flex: 1 }}
              placeholder="Root_Weapon_Sword_Primary"
            />
          )}

          {!readOnly && (
            <button onClick={() => removeSlot(key)} style={REMOVE_BTN} title="Remove slot">×</button>
          )}
        </div>
      ))}

      {!readOnly && (
        <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
          <input
            type="text"
            list="slot-names"
            value={newSlotKey}
            onChange={(e) => setNewSlotKey(e.target.value)}
            style={{ ...SMALL_INPUT, width: 90 }}
            placeholder="Slot…"
            onKeyDown={(e) => { if (e.key === 'Enter') addSlot() }}
          />
          <datalist id="slot-names">
            {KNOWN_SLOTS.filter((s) => !(s in slots)).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button onClick={addSlot} style={ADD_BTN}>+ Add</button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Tag array editor (Type: [...], Family: [...])
// ─────────────────────────────────────────────────────────────

function TagArrayEditor({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string
  value: unknown
  onChange: (v: string[] | undefined) => void
  readOnly: boolean
}) {
  const arr: string[] = Array.isArray(value) ? (value as string[]) : []
  const [newTag, setNewTag] = useState('')

  function addTag() {
    const t = newTag.trim()
    if (!t) return
    onChange([...arr, t])
    setNewTag('')
  }

  function removeTag(i: number) {
    const next = arr.filter((_, idx) => idx !== i)
    onChange(next.length > 0 ? next : undefined)
  }

  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{ ...LABEL, color: '#555' }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 3 }}>
        {arr.map((tag, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#1c1c2e',
              border: '1px solid #3a3a5c',
              borderRadius: 12,
              padding: '2px 8px',
              fontSize: 11,
              color: '#ccc',
              gap: 4,
            }}
          >
            {tag}
            {!readOnly && (
              <button onClick={() => removeTag(i)} style={{ ...REMOVE_BTN, fontSize: 11 }}>×</button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            style={{ ...SMALL_INPUT, flex: 1 }}
            placeholder="Add tag…"
            onKeyDown={(e) => { if (e.key === 'Enter') addTag() }}
          />
          <button onClick={addTag} style={ADD_BTN}>+</button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Extra fields (not handled above, not InteractionVars)
// ─────────────────────────────────────────────────────────────

function ExtraJsonFields({
  json,
  onChange,
  readOnly,
}: {
  json: Record<string, unknown>
  onChange: (k: string, v: unknown) => void
  readOnly: boolean
}) {
  const keys = Object.keys(json).filter((k) => !HANDLED_KEYS.has(k))
  if (keys.length === 0) return null

  return (
    <>
      <div style={SECTION_HEADER}>Additional Fields</div>
      {keys.map((k) => {
        const val = json[k]
        const isComplex = typeof val === 'object' && val !== null
        return (
          <div key={k} style={FIELD}>
            <label style={LABEL}>{k}</label>
            {isComplex ? (
              <textarea
                rows={3}
                defaultValue={JSON.stringify(val, null, 2)}
                readOnly={readOnly}
                onBlur={(e) => {
                  if (readOnly) return
                  try { onChange(k, JSON.parse(e.target.value)) } catch { /* ignore */ }
                }}
                style={{ ...INPUT, resize: 'vertical', minHeight: 48, lineHeight: 1.4, fontSize: 11 }}
                spellCheck={false}
              />
            ) : (
              <input
                type="text"
                defaultValue={val === undefined || val === null ? '' : String(val)}
                readOnly={readOnly}
                onBlur={(e) => !readOnly && onChange(k, e.target.value || undefined)}
                style={SMALL_INPUT}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────

export type ItemFormEditorProps = {
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly?: boolean
}

/**
 * Returns true if the JSON looks like an item asset
 * (has Quality or ItemLevel — never present in interaction files).
 */
export function looksLikeItem(json: Record<string, unknown>): boolean {
  return 'Quality' in json || 'ItemLevel' in json || 'MaxDurability' in json
}

export function ItemFormEditor({ json, onChange, readOnly = false }: ItemFormEditorProps) {
  function set(key: string, value: unknown) {
    if (readOnly) return
    const next = { ...json }
    if (value === undefined || value === null || value === '') {
      delete next[key]
    } else {
      next[key] = value
    }
    onChange(next)
  }

  function setNested(outerKey: string, innerKey: string, value: unknown) {
    if (readOnly) return
    const outer = asObj(json[outerKey])
    const updated = { ...outer }
    if (value === undefined || value === null || value === '') {
      delete updated[innerKey]
    } else {
      updated[innerKey] = value
    }
    set(outerKey, Object.keys(updated).length > 0 ? updated : undefined)
  }

  function setTags(family: string, value: string[] | undefined) {
    const tags = asObj(json['Tags'])
    const updated = { ...tags }
    if (!value || value.length === 0) {
      delete updated[family]
    } else {
      updated[family] = value
    }
    set('Tags', Object.keys(updated).length > 0 ? updated : undefined)
  }

  const translationName = getStr(asObj(json['TranslationProperties']), 'Name')
  const tags = asObj(json['Tags'])

  return (
    <div>
      {readOnly && (
        <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', marginBottom: 8 }}>
          Read-only — overrides uniquement disponibles pour les assets server.
        </div>
      )}

      {/* ── Identity ── */}
      <div style={SECTION_HEADER}>Identity</div>

      <div style={FIELD}>
        <label style={LABEL}>Parent</label>
        <input
          type="text"
          value={getStr(json, 'Parent')}
          onChange={(e) => set('Parent', e.target.value || undefined)}
          readOnly={readOnly}
          style={INPUT}
          placeholder="Template_Weapon_Sword"
        />
      </div>

      <div style={FIELD}>
        <label style={LABEL}>Translation Key (Name)</label>
        <input
          type="text"
          value={translationName}
          onChange={(e) => setNested('TranslationProperties', 'Name', e.target.value || undefined)}
          readOnly={readOnly}
          style={INPUT}
          placeholder="server.items.MyItem.name"
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={LABEL}>Quality</label>
          {readOnly ? (
            <input type="text" value={getStr(json, 'Quality')} readOnly style={INPUT} />
          ) : (
            <select
              value={getStr(json, 'Quality')}
              onChange={(e) => set('Quality', e.target.value || undefined)}
              style={{ ...INPUT, cursor: 'pointer' }}
            >
              <option value="">—</option>
              {ITEM_QUALITY_OPTIONS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <label style={LABEL}>Item Level</label>
          <input
            type="number"
            value={getNum(json, 'ItemLevel')}
            onChange={(e) => {
              const v = e.target.value.trim()
              set('ItemLevel', v === '' ? undefined : parseInt(v, 10))
            }}
            readOnly={readOnly}
            style={INPUT}
            placeholder="—"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={LABEL}>Max Stack</label>
          <input
            type="number"
            value={getNum(json, 'MaxStack')}
            onChange={(e) => {
              const v = e.target.value.trim()
              set('MaxStack', v === '' ? undefined : parseInt(v, 10))
            }}
            readOnly={readOnly}
            style={INPUT}
            placeholder="—"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={LABEL}>Scale</label>
          <input
            type="number"
            step="any"
            value={getNum(json, 'Scale')}
            onChange={(e) => {
              const v = e.target.value.trim()
              set('Scale', v === '' ? undefined : parseFloat(v))
            }}
            readOnly={readOnly}
            style={INPUT}
            placeholder="—"
          />
        </div>
      </div>

      <div style={{ ...FIELD, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          id="consumable"
          checked={json['Consumable'] === true}
          onChange={(e) => set('Consumable', e.target.checked ? true : undefined)}
          disabled={readOnly}
          style={{ width: 14, height: 14, cursor: readOnly ? 'default' : 'pointer', accentColor: '#61dafb' }}
        />
        <label htmlFor="consumable" style={{ fontSize: 12, color: '#ccc', cursor: readOnly ? 'default' : 'pointer' }}>
          Consumable
        </label>
      </div>

      {/* ── Appearance ── */}
      <div style={SECTION_HEADER}>Appearance</div>

      {(['Model', 'Texture', 'Icon', 'DroppedItemAnimation'] as const).map((k) => (
        <div key={k} style={FIELD}>
          <label style={LABEL}>{k}</label>
          <input
            type="text"
            value={getStr(json, k)}
            onChange={(e) => set(k, e.target.value || undefined)}
            readOnly={readOnly}
            style={{ ...INPUT, fontSize: 11 }}
            placeholder={k === 'Model' ? 'Items/Weapons/Sword/Iron.blockymodel' : k === 'Icon' ? 'Icons/ItemsGenerated/MyItem.png' : ''}
          />
        </div>
      ))}

      {/* ── Stats ── */}
      <div style={SECTION_HEADER}>Stats / Combat</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={LABEL}>Max Durability</label>
          <input
            type="number"
            value={getNum(json, 'MaxDurability')}
            onChange={(e) => {
              const v = e.target.value.trim()
              set('MaxDurability', v === '' ? undefined : parseInt(v, 10))
            }}
            readOnly={readOnly}
            style={INPUT}
            placeholder="—"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={LABEL}>Durability Loss on Hit</label>
          <input
            type="number"
            step="any"
            value={getNum(json, 'DurabilityLossOnHit')}
            onChange={(e) => {
              const v = e.target.value.trim()
              set('DurabilityLossOnHit', v === '' ? undefined : parseFloat(v))
            }}
            readOnly={readOnly}
            style={INPUT}
            placeholder="—"
          />
        </div>
      </div>

      {(['PlayerAnimationsId', 'ItemSoundSetId', 'Reticle'] as const).map((k) => (
        <div key={k} style={FIELD}>
          <label style={LABEL}>{k}</label>
          <input
            type="text"
            value={getStr(json, k)}
            onChange={(e) => set(k, e.target.value || undefined)}
            readOnly={readOnly}
            style={INPUT}
          />
        </div>
      ))}

      {/* ── Interactions (slot refs) ── */}
      <div style={SECTION_HEADER}>Interactions (slot refs)</div>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 6 }}>
        Références vers les fichiers d'interactions par slot. Les valeurs inline ne sont pas éditables ici.
      </div>
      <InteractionSlotsEditor
        value={json['Interactions']}
        onChange={(v) => set('Interactions', v)}
        readOnly={readOnly}
      />

      {/* ── Tags ── */}
      {('Tags' in json) && (
        <>
          <div style={SECTION_HEADER}>Tags</div>
          {(['Type', 'Family'] as const).map((family) => (
            <TagArrayEditor
              key={family}
              label={family}
              value={(tags[family])}
              onChange={(v) => setTags(family, v)}
              readOnly={readOnly}
            />
          ))}
        </>
      )}

      {/* ── Recipe ── */}
      {('Recipe' in json) && (
        <>
          <div style={SECTION_HEADER}>Recipe</div>
          <textarea
            rows={6}
            defaultValue={JSON.stringify(json['Recipe'], null, 2)}
            readOnly={readOnly}
            onBlur={(e) => {
              if (readOnly) return
              try { set('Recipe', JSON.parse(e.target.value)) } catch { /* ignore */ }
            }}
            style={{ ...INPUT, resize: 'vertical', lineHeight: 1.4, fontSize: 11 }}
            spellCheck={false}
          />
        </>
      )}

      {/* ── Categories ── */}
      {('Categories' in json) && (
        <>
          <div style={SECTION_HEADER}>Categories</div>
          <textarea
            rows={2}
            defaultValue={JSON.stringify(json['Categories'], null, 2)}
            readOnly={readOnly}
            onBlur={(e) => {
              if (readOnly) return
              try { set('Categories', JSON.parse(e.target.value)) } catch { /* ignore */ }
            }}
            style={{ ...INPUT, resize: 'vertical', lineHeight: 1.4, fontSize: 11 }}
            spellCheck={false}
          />
        </>
      )}

      {/* ── Extra fields not covered above ── */}
      <ExtraJsonFields
        json={json}
        onChange={(k, v) => set(k, v)}
        readOnly={readOnly}
      />
    </div>
  )
}
