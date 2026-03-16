import type React from 'react'

import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE, TEXTAREA_STYLE } from './formStyles'

// ─── Types ────────────────────────────────────────────────────────────────────

type RandomSettings = {
  MinPitch?: number
  MaxPitch?: number
  MinVolume?: number
  MaxVolume?: number
  [key: string]: unknown
}

type Layer = {
  Files?: string[]
  Volume?: number
  RandomSettings?: RandomSettings
  StartDelay?: number
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

const LAYER_STYLE: React.CSSProperties = {
  border: '1px solid #2a3450',
  borderRadius: 5,
  padding: '8px 10px',
  marginBottom: 8,
  background: 'rgba(20, 20, 38, 0.6)',
}

const GRID2_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
}

const GRID4_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr 1fr',
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
  padding: '2px 6px',
  fontSize: 10,
  borderColor: '#6b2a2a',
  color: '#f08080',
}

const CHECKBOX_LABEL_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  color: '#cdd',
  cursor: 'pointer',
  userSelect: 'none',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asLayerArray(v: unknown): Layer[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => x && typeof x === 'object') as Layer[]
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => typeof x === 'string') as string[]
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

// ─── Layer editor ─────────────────────────────────────────────────────────────

type LayerEditorProps = {
  layer: Layer
  index: number
  onChange: (updated: Layer) => void
  onRemove: () => void
  readOnly: boolean
}

function LayerEditor({ layer, index, onChange, onRemove, readOnly }: LayerEditorProps) {
  const files = asStringArray(layer.Files)
  const rs = layer.RandomSettings ?? {}

  function set(key: string, value: unknown): void {
    onChange({ ...layer, [key]: value })
  }

  function setRS(patch: Partial<RandomSettings>): void {
    onChange({ ...layer, RandomSettings: { ...rs, ...patch } })
  }

  function updateFile(i: number, value: string): void {
    const next = deepClone(files)
    next[i] = value
    set('Files', next)
  }

  function removeFile(i: number): void {
    const next = deepClone(files)
    next.splice(i, 1)
    set('Files', next)
  }

  const hasRS = layer.RandomSettings !== undefined

  return (
    <div style={LAYER_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#7a8cb0', marginRight: 'auto' }}>
          Layer #{index + 1} — {files.length} file(s)
        </span>
        {!readOnly && (
          <button style={BTN_DANGER} onClick={onRemove}>Remove</button>
        )}
      </div>

      {/* Files */}
      <div style={{ marginBottom: 6 }}>
        <label style={{ ...LABEL_STYLE, marginBottom: 4 }}>Sound files (one played at random)</label>
        {files.map((f, fi) => (
          <div key={fi} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <input
              style={{ ...INPUT_STYLE, flex: 1 }}
              value={f}
              readOnly={readOnly}
              placeholder="Sounds/Weapons/Sword/Impact_01.ogg"
              onChange={(e) => updateFile(fi, e.target.value)}
            />
            {!readOnly && (
              <button style={BTN_DANGER} onClick={() => removeFile(fi)}>✕</button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button style={BTN_STYLE} onClick={() => set('Files', [...files, ''])}>+ Add file</button>
        )}
      </div>

      <div style={GRID2_STYLE}>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Volume (dB or 0–1)</label>
          <input
            type="number"
            style={INPUT_STYLE}
            value={layer.Volume ?? ''}
            readOnly={readOnly}
            step="0.5"
            onChange={(e) => set('Volume', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Start Delay (s)</label>
          <input
            type="number"
            style={INPUT_STYLE}
            value={layer.StartDelay ?? ''}
            readOnly={readOnly}
            step="0.05"
            onChange={(e) => set('StartDelay', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </div>
      </div>

      {/* Random settings toggle */}
      {!readOnly && !hasRS && (
        <button
          style={{ ...BTN_STYLE, marginTop: 4 }}
          onClick={() => setRS({ MinPitch: -2, MaxPitch: 2 })}
        >
          + Add random settings
        </button>
      )}

      {hasRS && (
        <div>
          <div style={{ ...LABEL_STYLE, marginBottom: 4 }}>Random Settings</div>
          <div style={GRID4_STYLE}>
            {(
              [
                ['MinPitch', 'Min Pitch'],
                ['MaxPitch', 'Max Pitch'],
                ['MinVolume', 'Min Vol'],
                ['MaxVolume', 'Max Vol'],
              ] as [keyof RandomSettings, string][]
            ).map(([key, label]) => (
              <div key={key} style={FIELD_WRAP}>
                <label style={LABEL_STYLE}>{label}</label>
                <input
                  type="number"
                  style={INPUT_STYLE}
                  value={(rs[key] as number) ?? ''}
                  readOnly={readOnly}
                  step="0.5"
                  onChange={(e) => setRS({ [key]: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
          {!readOnly && (
            <button
              style={{ ...BTN_DANGER, marginTop: 4 }}
              onClick={() => {
                const { RandomSettings: _rs, ...rest } = layer
                onChange(rest)
              }}
            >
              Remove random settings
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function SoundEventFormEditor({ json, onChange, readOnly }: Props) {
  const layers = asLayerArray(json['Layers'])

  // Detect legacy format
  const isLegacy = !('Layers' in json) && 'Sounds' in json

  function set(key: string, value: unknown): void {
    onChange({ ...json, [key]: value })
  }

  function updateLayer(i: number, updated: Layer): void {
    const next = deepClone(layers)
    next[i] = updated
    set('Layers', next)
  }

  function removeLayer(i: number): void {
    const next = deepClone(layers)
    next.splice(i, 1)
    set('Layers', next)
  }

  function addLayer(): void {
    set('Layers', [...layers, { Files: [''], Volume: 0 }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* Legacy warning */}
      {isLegacy && (
        <div style={{
          padding: '8px 12px',
          borderRadius: 5,
          background: 'rgba(180, 120, 30, 0.15)',
          border: '1px solid #7a5c20',
          fontSize: 12,
          color: '#dba',
          marginBottom: 8,
        }}>
          ⚠ Legacy format detected (<code>Sounds</code> array). The modern format uses <code>Layers</code>.
        </div>
      )}

      {/* ── Global properties ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Global</div>
        <div style={GRID2_STYLE}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Volume (dB or 0–1)</label>
            <input
              type="number"
              style={INPUT_STYLE}
              value={(json['Volume'] as number) ?? ''}
              readOnly={readOnly}
              step="0.5"
              onChange={(e) => set('Volume', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Audio Category</label>
            <input
              style={INPUT_STYLE}
              value={(json['AudioCategory'] as string) ?? ''}
              readOnly={readOnly}
              placeholder="AudioCat_Sword"
              onChange={(e) => set('AudioCategory', e.target.value || undefined)}
            />
          </div>
        </div>
        <div style={GRID2_STYLE}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Parent</label>
            <input
              style={INPUT_STYLE}
              value={(json['Parent'] as string) ?? ''}
              readOnly={readOnly}
              placeholder="SFX_Attn_Moderate"
              onChange={(e) => set('Parent', e.target.value || undefined)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label style={CHECKBOX_LABEL_STYLE}>
              <input
                type="checkbox"
                checked={(json['PreventSoundInterruption'] as boolean) ?? false}
                disabled={readOnly}
                onChange={(e) => set('PreventSoundInterruption', e.target.checked || undefined)}
              />
              Prevent interruption
            </label>
          </div>
        </div>
      </div>

      {/* ── Layers ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Layers ({layers.length})</div>
        {layers.map((layer, i) => (
          <LayerEditor
            key={i}
            layer={layer}
            index={i}
            onChange={(updated) => updateLayer(i, updated)}
            onRemove={() => removeLayer(i)}
            readOnly={readOnly}
          />
        ))}
        {!readOnly && (
          <button style={BTN_STYLE} onClick={addLayer}>+ Add layer</button>
        )}
      </div>

      {/* ── Legacy Sounds (read-only display) ── */}
      {isLegacy && (
        <div style={SECTION_STYLE}>
          <div style={SECTION_TITLE_STYLE}>Legacy Sounds (raw)</div>
          <textarea
            style={{ ...TEXTAREA_STYLE, minHeight: 80 }}
            value={JSON.stringify(json['Sounds'], null, 2)}
            readOnly={readOnly}
            onChange={(e) => {
              try { set('Sounds', JSON.parse(e.target.value)) } catch { /* ignore */ }
            }}
          />
        </div>
      )}

    </div>
  )
}
