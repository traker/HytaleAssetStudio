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

import { useState, useEffect, useRef } from 'react'
import { TEXTAREA_STYLE } from './formStyles'
import { hasApi } from '../../api/hasApi'
import type { SearchResult } from '../../api/types'

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

const ITEM_QUALITY_OPTIONS = [
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
  'BlockType',
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
// BlockType section
// ─────────────────────────────────────────────────────────────

const BLOCK_MATERIAL_OPTIONS = ['Solid', 'Fluid', 'Gas', 'NonCollidable', 'Platform']

// Keys shown with structured inputs; everything else → JSON textarea
const BLOCK_SIMPLE_KEYS = new Set([
  'Material', 'DrawType', 'Group', 'BlockSoundSetId', 'BlockParticleSetId',
  'Gathering', 'Flags', 'Textures',
])

function BlockTypeSection({
  blockType,
  onChange,
  readOnly,
}: {
  blockType: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
  readOnly: boolean
}) {
  const [collapsed, setCollapsed] = useState(true)

  const setField = (k: string, v: unknown) => {
    if (readOnly) return
    const next = { ...blockType }
    if (v === undefined || v === null || v === '') delete next[k]
    else next[k] = v
    onChange(next)
  }

  const setJsonField = (k: string, raw: string) => {
    if (readOnly) return
    const trimmed = raw.trim()
    const next = { ...blockType }
    if (!trimmed) delete next[k]
    else try { next[k] = JSON.parse(trimmed) } catch { return }
    onChange(next)
  }

  const extraKeys = Object.keys(blockType).filter((k) => !BLOCK_SIMPLE_KEYS.has(k))

  return (
    <>
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{
          width: '100%', textAlign: 'left', background: 'transparent',
          border: 'none', borderBottom: '1px solid #222', padding: '6px 0',
          color: '#61dafb', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', cursor: 'pointer', marginTop: 14, marginBottom: 0,
        }}
      >
        {collapsed ? '▸' : '▾'} Block Type
      </button>
      {!collapsed && (
        <div style={{ marginTop: 8 }}>
          {/* Material */}
          <div style={FIELD}>
            <label style={LABEL}>Material</label>
            <select
              value={typeof blockType['Material'] === 'string' ? (blockType['Material'] as string) : ''}
              onChange={(e) => setField('Material', e.target.value || undefined)}
              disabled={readOnly}
              style={{ ...INPUT, background: '#1e1e2e', color: '#ccc', borderColor: '#3a3a5c', height: 26 }}
            >
              <option value="">— unset —</option>
              {BLOCK_MATERIAL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* DrawType */}
          <div style={FIELD}>
            <label style={LABEL}>DrawType</label>
            <input
              type="text"
              value={typeof blockType['DrawType'] === 'string' ? (blockType['DrawType'] as string) : ''}
              onChange={(e) => setField('DrawType', e.target.value || undefined)}
              disabled={readOnly}
              style={INPUT}
              placeholder="Cube, Mesh, Crossed, Model…"
            />
          </div>

          {/* Group */}
          <div style={FIELD}>
            <label style={LABEL}>Group</label>
            <input
              type="text"
              value={typeof blockType['Group'] === 'string' ? (blockType['Group'] as string) : ''}
              onChange={(e) => setField('Group', e.target.value || undefined)}
              disabled={readOnly}
              style={INPUT}
            />
          </div>

          {/* BlockSoundSetId */}
          <div style={FIELD}>
            <label style={LABEL}>BlockSoundSetId</label>
            <input
              type="text"
              value={typeof blockType['BlockSoundSetId'] === 'string' ? (blockType['BlockSoundSetId'] as string) : ''}
              onChange={(e) => setField('BlockSoundSetId', e.target.value || undefined)}
              disabled={readOnly}
              style={INPUT}
            />
          </div>

          {/* BlockParticleSetId */}
          <div style={FIELD}>
            <label style={LABEL}>BlockParticleSetId</label>
            <input
              type="text"
              value={typeof blockType['BlockParticleSetId'] === 'string' ? (blockType['BlockParticleSetId'] as string) : ''}
              onChange={(e) => setField('BlockParticleSetId', e.target.value || undefined)}
              disabled={readOnly}
              style={INPUT}
            />
          </div>

          {/* Gathering — JSON */}
          <div style={FIELD}>
            <label style={LABEL}>Gathering (JSON)</label>
            <textarea
              rows={3}
              defaultValue={blockType['Gathering'] !== undefined ? JSON.stringify(blockType['Gathering'], null, 2) : ''}
              readOnly={readOnly}
              onBlur={(e) => setJsonField('Gathering', e.target.value)}
              style={{ ...TEXTAREA_STYLE, width: '100%', resize: 'vertical', fontSize: 11 }}
              spellCheck={false}
            />
          </div>

          {/* Flags — JSON */}
          <div style={FIELD}>
            <label style={LABEL}>Flags (JSON)</label>
            <textarea
              rows={2}
              defaultValue={blockType['Flags'] !== undefined ? JSON.stringify(blockType['Flags'], null, 2) : ''}
              readOnly={readOnly}
              onBlur={(e) => setJsonField('Flags', e.target.value)}
              style={{ ...TEXTAREA_STYLE, width: '100%', resize: 'vertical', fontSize: 11 }}
              spellCheck={false}
            />
          </div>

          {/* Textures — JSON */}
          <div style={FIELD}>
            <label style={LABEL}>Textures (JSON)</label>
            <textarea
              rows={2}
              defaultValue={blockType['Textures'] !== undefined ? JSON.stringify(blockType['Textures'], null, 2) : ''}
              readOnly={readOnly}
              onBlur={(e) => setJsonField('Textures', e.target.value)}
              style={{ ...TEXTAREA_STYLE, width: '100%', resize: 'vertical', fontSize: 11 }}
              spellCheck={false}
            />
          </div>

          {/* Remaining block keys — JSON catch-all */}
          {extraKeys.map((k) => {
            const val = blockType[k]
            const isComplex = typeof val === 'object' && val !== null
            return (
              <div key={k} style={FIELD}>
                <label style={LABEL}>{k}</label>
                {isComplex ? (
                  <textarea
                    rows={3}
                    defaultValue={JSON.stringify(val, null, 2)}
                    readOnly={readOnly}
                    onBlur={(e) => { if (!readOnly) setJsonField(k, e.target.value) }}
                    style={{ ...TEXTAREA_STYLE, width: '100%', resize: 'vertical', fontSize: 11 }}
                    spellCheck={false}
                  />
                ) : (
                  <input
                    type="text"
                    defaultValue={val === undefined || val === null ? '' : String(val)}
                    readOnly={readOnly}
                    onBlur={(e) => { if (!readOnly) setField(k, e.target.value || undefined) }}
                    style={SMALL_INPUT}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Item picker input (combobox with live search)
// ─────────────────────────────────────────────────────────────

function ItemPickerInput({
  value,
  onChange,
  projectId,
  readOnly,
  placeholder = 'ItemId…',
}: {
  value: string
  onChange: (v: string) => void
  projectId: string | undefined
  readOnly: boolean
  placeholder?: string
}) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync query when value changes externally
  useEffect(() => { setQuery(value) }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function handleInput(q: string) {
    setQuery(q)
    if (!projectId || q.trim().length < 2) { setResults([]); setOpen(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await hasApi.projectSearch(projectId, q.trim(), 50)
        const filtered = resp.results.filter((r) => r.group === 'item' || r.group === 'block')
        setResults(filtered)
        setOpen(filtered.length > 0)
      } catch { /* ignore */ }
    }, 200)
  }

  function select(r: SearchResult) {
    const id = r.assetKey
    setQuery(id)
    onChange(id)
    setResults([])
    setOpen(false)
  }

  function commit() {
    onChange(query.trim())
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onBlur={commit}
        readOnly={readOnly}
        style={{ ...SMALL_INPUT, width: '100%' }}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#1a1a2e',
          border: '1px solid #3a3a5c',
          borderRadius: 4,
          maxHeight: 180,
          overflowY: 'auto',
          zIndex: 999,
          fontSize: 11,
        }}>
          {results.map((r) => (
            <div
              key={r.assetKey + (r.path ?? '')}
              onMouseDown={(e) => { e.preventDefault(); select(r) }}
              style={{
                padding: '4px 8px',
                cursor: 'pointer',
                color: r.assetKey === value ? '#61dafb' : '#ccc',
                borderBottom: '1px solid #252540',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#252545')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: '#61dafb', marginRight: 6 }}>{r.assetKey}</span>
              {r.group && <span style={{ color: '#555', fontSize: 10 }}>{r.group}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Recipe editor
// ─────────────────────────────────────────────────────────────

type RecipeInput = { ItemId: string; Quantity: number }
type BenchReq = { Id: string; Type: string; Categories: string[]; RequiredTierLevel: number }
type RecipeData = {
  Input?: RecipeInput[]
  BenchRequirement?: BenchReq[]
  KnowledgeRequired?: boolean
  TimeSeconds?: number
}

function RecipeEditor({
  value,
  onChange,
  projectId,
  readOnly,
}: {
  value: unknown
  onChange: (v: RecipeData) => void
  projectId: string | undefined
  readOnly: boolean
}) {
  const recipe: RecipeData = (typeof value === 'object' && value !== null)
    ? (value as RecipeData)
    : {}

  const inputs: RecipeInput[] = Array.isArray(recipe.Input)
    ? (recipe.Input as RecipeInput[])
    : []
  const benches: BenchReq[] = Array.isArray(recipe.BenchRequirement)
    ? (recipe.BenchRequirement as BenchReq[])
    : []

  function update(patch: Partial<RecipeData>) {
    onChange({ ...recipe, ...patch })
  }

  // Input[]
  function setInput(i: number, field: keyof RecipeInput, val: string | number) {
    const next = inputs.map((row, idx) => idx === i ? { ...row, [field]: val } : row)
    update({ Input: next })
  }
  function addInput() {
    update({ Input: [...inputs, { ItemId: '', Quantity: 1 }] })
  }
  function removeInput(i: number) {
    const next = inputs.filter((_, idx) => idx !== i)
    update({ Input: next.length > 0 ? next : undefined })
  }

  // BenchRequirement[]
  function setBench(i: number, field: keyof BenchReq, val: unknown) {
    const next = benches.map((row, idx) => idx === i ? { ...row, [field]: val } : row)
    update({ BenchRequirement: next })
  }
  function addBench() {
    update({ BenchRequirement: [...benches, { Id: '', Type: 'Crafting', Categories: [], RequiredTierLevel: 0 }] })
  }
  function removeBench(i: number) {
    const next = benches.filter((_, idx) => idx !== i)
    update({ BenchRequirement: next.length > 0 ? next : undefined })
  }
  function setBenchCategory(i: number, raw: string) {
    const cats = raw.split(',').map((s) => s.trim()).filter(Boolean)
    setBench(i, 'Categories', cats)
  }

  return (
    <div>
      {/* ── Inputs ── */}
      <label style={{ ...LABEL, marginBottom: 4 }}>Input Items</label>
      {inputs.map((row, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <ItemPickerInput
            value={row.ItemId}
            onChange={(v) => setInput(i, 'ItemId', v)}
            projectId={projectId}
            readOnly={readOnly}
            placeholder="ItemId…"
          />
          <input
            type="number"
            min={1}
            value={row.Quantity}
            onChange={(e) => setInput(i, 'Quantity', parseInt(e.target.value, 10) || 1)}
            readOnly={readOnly}
            style={{ ...SMALL_INPUT, width: 64 }}
            title="Quantity"
          />
          {!readOnly && (
            <button onClick={() => removeInput(i)} style={REMOVE_BTN} title="Remove">×</button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button onClick={addInput} style={{ ...ADD_BTN, marginBottom: 10 }}>+ Add ingredient</button>
      )}

      {/* ── Bench requirements ── */}
      <label style={{ ...LABEL, marginBottom: 4 }}>Bench Requirements</label>
      {benches.map((row, i) => (
        <div key={i} style={{ border: '1px solid #2a2a45', borderRadius: 4, padding: '6px 8px', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL}>Id</label>
              <input
                type="text"
                value={row.Id}
                onChange={(e) => setBench(i, 'Id', e.target.value)}
                readOnly={readOnly}
                style={SMALL_INPUT}
                placeholder="Armor_Bench"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={LABEL}>Type</label>
              <input
                type="text"
                value={row.Type}
                onChange={(e) => setBench(i, 'Type', e.target.value)}
                readOnly={readOnly}
                style={SMALL_INPUT}
                placeholder="Crafting"
              />
            </div>
            <div style={{ flex: 0 }}>
              <label style={LABEL}>Tier</label>
              <input
                type="number"
                min={0}
                value={row.RequiredTierLevel}
                onChange={(e) => setBench(i, 'RequiredTierLevel', parseInt(e.target.value, 10) || 0)}
                readOnly={readOnly}
                style={{ ...SMALL_INPUT, width: 54 }}
              />
            </div>
            {!readOnly && (
              <button onClick={() => removeBench(i)} style={{ ...REMOVE_BTN, alignSelf: 'flex-end', marginBottom: 2 }} title="Remove">×</button>
            )}
          </div>
          <div>
            <label style={LABEL}>Categories (comma-separated)</label>
            <input
              type="text"
              value={Array.isArray(row.Categories) ? row.Categories.join(', ') : ''}
              onChange={(e) => setBenchCategory(i, e.target.value)}
              readOnly={readOnly}
              style={SMALL_INPUT}
              placeholder="Armor, Weapon…"
            />
          </div>
        </div>
      ))}
      {!readOnly && (
        <button onClick={addBench} style={{ ...ADD_BTN, marginBottom: 10 }}>+ Add bench requirement</button>
      )}

      {/* ── Misc ── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            id="knowledgeRequired"
            checked={recipe.KnowledgeRequired === true}
            onChange={(e) => update({ KnowledgeRequired: e.target.checked ? true : undefined })}
            disabled={readOnly}
            style={{ width: 14, height: 14, accentColor: '#61dafb', cursor: readOnly ? 'default' : 'pointer' }}
          />
          <label htmlFor="knowledgeRequired" style={{ fontSize: 12, color: '#ccc', cursor: readOnly ? 'default' : 'pointer' }}>
            Knowledge Required
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ ...LABEL, marginBottom: 0, minWidth: 80 }}>Time (s)</label>
          <input
            type="number"
            step="any"
            min={0}
            value={recipe.TimeSeconds ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim()
              update({ TimeSeconds: v === '' ? undefined : parseFloat(v) })
            }}
            readOnly={readOnly}
            style={{ ...SMALL_INPUT, width: 72 }}
            placeholder="—"
          />
        </div>
      </div>
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
  projectId?: string
}

export function ItemFormEditor({ json, onChange, readOnly = false, projectId }: ItemFormEditorProps) {
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
          <RecipeEditor
            value={json['Recipe']}
            onChange={(v) => set('Recipe', v)}
            projectId={projectId}
            readOnly={readOnly}
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

      {/* ── Block Type ── */}
      {json['BlockType'] !== undefined && (
        <BlockTypeSection
          blockType={asObj(json['BlockType'])}
          onChange={(v) => set('BlockType', v)}
          readOnly={readOnly}
        />
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
