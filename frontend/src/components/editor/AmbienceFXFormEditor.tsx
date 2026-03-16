// AmbienceFXFormEditor.tsx
// Editor for Hytale AmbienceFX assets (Server/Audio/AmbienceFX/).
// Covers: Conditions (DayTime/SunLightLevel/Walls min-max + EnvironmentTagPattern),
// AmbientBed (Track + Volume) and Music.Tracks[].

import { useState } from 'react'
import type React from 'react'

import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE, TEXTAREA_STYLE } from './formStyles'

type Props = {
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly: boolean
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SECTION_STYLE: React.CSSProperties = {
  marginBottom: 12,
  padding: '10px 12px 8px',
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

const GRID2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }

const ADD_BTN_STYLE: React.CSSProperties = {
  marginTop: 6,
  padding: '3px 10px',
  fontSize: 11,
  borderRadius: 4,
  background: '#1e1e35',
  border: '1px solid #444',
  color: '#aaa',
  cursor: 'pointer',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nested(json: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = json[key]
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return {}
}

function setNested(
  json: Record<string, unknown>,
  key: string,
  value: Record<string, unknown>,
): Record<string, unknown> {
  return { ...json, [key]: value }
}

function numVal(v: unknown): number | '' {
  return typeof v === 'number' ? v : ''
}

// ─── Min/Max row ──────────────────────────────────────────────────────────────

function MinMaxRow({
  label,
  obj,
  onChange,
  readOnly,
}: {
  label: string
  obj: Record<string, unknown>
  onChange: (o: Record<string, unknown>) => void
  readOnly: boolean
}) {
  return (
    <div style={GRID2}>
      <div style={FIELD_WRAP}>
        <label style={{ ...FIELD_WRAP, fontSize: 10, color: '#888', marginBottom: 2 }}>{label} Min</label>
        <input
          type="number" step="any" style={INPUT_STYLE}
          value={numVal(obj['Min'])}
          readOnly={readOnly}
          onChange={(e) => onChange({ ...obj, Min: e.target.value === '' ? undefined : Number(e.target.value) })}
        />
      </div>
      <div style={FIELD_WRAP}>
        <label style={{ ...FIELD_WRAP, fontSize: 10, color: '#888', marginBottom: 2 }}>{label} Max</label>
        <input
          type="number" step="any" style={INPUT_STYLE}
          value={numVal(obj['Max'])}
          readOnly={readOnly}
          onChange={(e) => onChange({ ...obj, Max: e.target.value === '' ? undefined : Number(e.target.value) })}
        />
      </div>
    </div>
  )
}

// ─── Music tracks tag list ────────────────────────────────────────────────────

function TrackList({
  tracks,
  onChange,
  readOnly,
}: {
  tracks: string[]
  onChange: (t: string[]) => void
  readOnly: boolean
}) {
  const [input, setInput] = useState('')

  function add() {
    const t = input.trim()
    if (!t || tracks.includes(t)) return
    onChange([...tracks, t])
    setInput('')
  }

  function remove(idx: number) {
    onChange(tracks.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
        {tracks.map((t, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#2a2a45', border: '1px solid #444', borderRadius: 4,
              padding: '2px 6px', fontSize: 11, color: '#ccc',
            }}
          >
            {t}
            {!readOnly && (
              <button
                style={{ border: 'none', background: 'none', color: '#cc6666', cursor: 'pointer', padding: 0, fontSize: 11 }}
                onClick={() => remove(i)}
              >✕</button>
            )}
          </span>
        ))}
        {tracks.length === 0 && (
          <span style={{ color: '#555', fontSize: 12 }}>No tracks.</span>
        )}
      </div>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            style={{ ...INPUT_STYLE, flex: 1 }}
            value={input}
            placeholder="path/to/track.ogg"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          />
          <button style={ADD_BTN_STYLE} onClick={add}>Add</button>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AmbienceFXFormEditor({ json, onChange, readOnly }: Props) {
  const conditions = nested(json, 'Conditions')
  const dayTime = nested(conditions, 'DayTime')
  const sunLight = nested(conditions, 'SunLightLevel')
  const walls = nested(conditions, 'Walls')
  const ambientBed = nested(json, 'AmbientBed')
  const music = nested(json, 'Music')
  const musicTracks: string[] = Array.isArray(music['Tracks']) ? (music['Tracks'] as string[]) : []

  function updateConditions(patch: Record<string, unknown>) {
    onChange(setNested(json, 'Conditions', { ...conditions, ...patch }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* Conditions */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Playback Conditions</div>

        <MinMaxRow
          label="Day Time"
          obj={dayTime}
          readOnly={readOnly}
          onChange={(o) => updateConditions({ DayTime: o })}
        />
        <MinMaxRow
          label="Sun Light Level"
          obj={sunLight}
          readOnly={readOnly}
          onChange={(o) => updateConditions({ SunLightLevel: o })}
        />
        <MinMaxRow
          label="Walls"
          obj={walls}
          readOnly={readOnly}
          onChange={(o) => updateConditions({ Walls: o })}
        />

        {conditions['EnvironmentTagPattern'] !== undefined && (
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Environment Tag Pattern (JSON)</label>
            <textarea
              style={{ ...TEXTAREA_STYLE, minHeight: 80 }}
              value={JSON.stringify(conditions['EnvironmentTagPattern'], null, 2)}
              readOnly={readOnly}
              onChange={(e) => {
                try {
                  updateConditions({ EnvironmentTagPattern: JSON.parse(e.target.value) })
                } catch { /* ignore */ }
              }}
            />
          </div>
        )}
        {!readOnly && conditions['EnvironmentTagPattern'] === undefined && (
          <button
            style={ADD_BTN_STYLE}
            onClick={() => updateConditions({ EnvironmentTagPattern: {} })}
          >
            + Add EnvironmentTagPattern
          </button>
        )}
      </div>

      {/* Ambient Bed */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Ambient Bed (looping)</div>
        <div style={GRID2}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Track (.ogg path)</label>
            <input
              style={INPUT_STYLE}
              value={typeof ambientBed['Track'] === 'string' ? ambientBed['Track'] : ''}
              readOnly={readOnly}
              placeholder="path/to/ambient.ogg"
              onChange={(e) =>
                onChange(setNested(json, 'AmbientBed', { ...ambientBed, Track: e.target.value || undefined }))
              }
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Volume (0–1)</label>
            <input
              type="number" step="0.01" min="0" max="1" style={INPUT_STYLE}
              value={numVal(ambientBed['Volume'])}
              readOnly={readOnly}
              onChange={(e) =>
                onChange(setNested(json, 'AmbientBed', {
                  ...ambientBed,
                  Volume: e.target.value === '' ? undefined : Number(e.target.value),
                }))
              }
            />
          </div>
        </div>
      </div>

      {/* Music Tracks */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Music Tracks</div>
        <TrackList
          tracks={musicTracks}
          readOnly={readOnly}
          onChange={(t) =>
            onChange(setNested(json, 'Music', { ...music, Tracks: t.length ? t : undefined }))
          }
        />
      </div>

    </div>
  )
}
