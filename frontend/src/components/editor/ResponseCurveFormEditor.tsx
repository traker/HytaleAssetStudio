// ResponseCurveFormEditor.tsx
// Discriminated form for Exponential, Logistic, and SineWave response curves.

import type React from 'react'

import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE } from './formStyles'

// ─── Types ────────────────────────────────────────────────────────────────────

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

const HINT_STYLE: React.CSSProperties = {
  fontSize: 10,
  color: '#45486a',
  marginTop: 3,
}

const TYPE_BADGES: Record<string, React.CSSProperties> = {
  Exponential: { background: '#6c5ce7', color: '#fff' },
  Logistic: { background: '#00b894', color: '#fff' },
  SineWave: { background: '#0984e3', color: '#fff' },
}

function typeBadgeStyle(type: string): React.CSSProperties {
  return {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 3,
    padding: '2px 8px',
    marginLeft: 8,
    letterSpacing: '0.05em',
    ...(TYPE_BADGES[type] ?? { background: '#555', color: '#fff' }),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v: unknown): number | '' {
  return typeof v === 'number' ? v : ''
}

// ─── Sub-editors ──────────────────────────────────────────────────────────────

type SubProps = {
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly: boolean
}

function ExponentialEditor({ json, onChange, readOnly }: SubProps) {
  return (
    <div style={SECTION_STYLE}>
      <div style={SECTION_TITLE_STYLE}>
        Exponential
        <span style={typeBadgeStyle('Exponential')}>y = Slope · x^Exponent</span>
      </div>
      <div style={GRID2_STYLE}>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Slope</label>
          <input
            type="number"
            step="any"
            style={INPUT_STYLE}
            value={num(json['Slope'])}
            readOnly={readOnly}
            placeholder="1"
            onChange={(e) => onChange({ ...json, Slope: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
          <div style={HINT_STYLE}>Steepness multiplier. Negative reverses direction.</div>
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Exponent</label>
          <input
            type="number"
            step="any"
            style={INPUT_STYLE}
            value={num(json['Exponent'])}
            readOnly={readOnly}
            placeholder="1"
            onChange={(e) => onChange({ ...json, Exponent: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
          <div style={HINT_STYLE}>1 = linear, 2 = quadratic, 3 = cubic…</div>
        </div>
      </div>
    </div>
  )
}

function LogisticEditor({ json, onChange, readOnly }: SubProps) {
  return (
    <div style={SECTION_STYLE}>
      <div style={SECTION_TITLE_STYLE}>
        Logistic (S-curve)
        <span style={typeBadgeStyle('Logistic')} />
      </div>
      <div style={GRID2_STYLE}>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Ceiling</label>
          <input
            type="number"
            step="any"
            style={INPUT_STYLE}
            value={num(json['Ceiling'])}
            readOnly={readOnly}
            placeholder="1"
            onChange={(e) => onChange({ ...json, Ceiling: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
          <div style={HINT_STYLE}>Max value. Negative = descending S-curve.</div>
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Rate of Change</label>
          <input
            type="number"
            step="any"
            style={INPUT_STYLE}
            value={num(json['RateOfChange'])}
            readOnly={readOnly}
            placeholder="1"
            onChange={(e) => onChange({ ...json, RateOfChange: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
          <div style={HINT_STYLE}>Speed of the transition. Higher = sharper step.</div>
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Horizontal Shift</label>
          <input
            type="number"
            step="any"
            style={INPUT_STYLE}
            value={num(json['HorizontalShift'])}
            readOnly={readOnly}
            placeholder="0.5"
            onChange={(e) => onChange({ ...json, HorizontalShift: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
          <div style={HINT_STYLE}>Midpoint of the S-curve (0–1).</div>
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Vertical Shift</label>
          <input
            type="number"
            step="any"
            style={INPUT_STYLE}
            value={num(json['VerticalShift'])}
            readOnly={readOnly}
            placeholder="0"
            onChange={(e) => onChange({ ...json, VerticalShift: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
          <div style={HINT_STYLE}>Vertical translation of the curve.</div>
        </div>
      </div>
    </div>
  )
}

function SineWaveEditor({ json, onChange, readOnly }: SubProps) {
  return (
    <div style={SECTION_STYLE}>
      <div style={SECTION_TITLE_STYLE}>
        Sine Wave
        <span style={typeBadgeStyle('SineWave')} />
      </div>
      <div style={GRID4_STYLE}>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Amplitude</label>
          <input
            type="number"
            step="any"
            style={INPUT_STYLE}
            value={num(json['Amplitude'])}
            readOnly={readOnly}
            placeholder="1"
            onChange={(e) => onChange({ ...json, Amplitude: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
          <div style={HINT_STYLE}>Peak height.</div>
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Frequency</label>
          <input
            type="number"
            step="any"
            style={INPUT_STYLE}
            value={num(json['Frequency'])}
            readOnly={readOnly}
            placeholder="1"
            onChange={(e) => onChange({ ...json, Frequency: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
          <div style={HINT_STYLE}>Cycles per unit.</div>
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Phase</label>
          <input
            type="number"
            step="any"
            style={INPUT_STYLE}
            value={num(json['Phase'])}
            readOnly={readOnly}
            placeholder="0"
            onChange={(e) => onChange({ ...json, Phase: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
          <div style={HINT_STYLE}>Horizontal start offset.</div>
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Vertical Shift</label>
          <input
            type="number"
            step="any"
            style={INPUT_STYLE}
            value={num(json['VerticalShift'])}
            readOnly={readOnly}
            placeholder="0"
            onChange={(e) => onChange({ ...json, VerticalShift: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
          <div style={HINT_STYLE}>Centerline offset.</div>
        </div>
      </div>
    </div>
  )
}

// ─── Type selector ────────────────────────────────────────────────────────────

const KNOWN_TYPES = ['Exponential', 'Logistic', 'SineWave'] as const
type CurveType = (typeof KNOWN_TYPES)[number]

const DEFAULT_FIELDS: Record<CurveType, Record<string, number>> = {
  Exponential: { Slope: 1, Exponent: 1 },
  Logistic: { Ceiling: 1, RateOfChange: 1, HorizontalShift: 0.5, VerticalShift: 0 },
  SineWave: { Amplitude: 1, Frequency: 1, Phase: 0, VerticalShift: 0 },
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ResponseCurveFormEditor({ json, onChange, readOnly }: Props) {
  const curveType = typeof json['Type'] === 'string' ? json['Type'] : ''

  function setType(newType: string): void {
    if (KNOWN_TYPES.includes(newType as CurveType)) {
      onChange({ Type: newType, ...DEFAULT_FIELDS[newType as CurveType] })
    } else {
      onChange({ ...json, Type: newType })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* Type selector */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Curve Type</div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Type</label>
          {readOnly ? (
            <span style={{ ...INPUT_STYLE, display: 'block', color: '#c8d0f8' }}>{curveType || '—'}</span>
          ) : (
            <select
              style={{ ...INPUT_STYLE, cursor: 'pointer' }}
              value={curveType}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">— select —</option>
              {KNOWN_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Type-specific fields */}
      {curveType === 'Exponential' && (
        <ExponentialEditor json={json} onChange={onChange} readOnly={readOnly} />
      )}
      {curveType === 'Logistic' && (
        <LogisticEditor json={json} onChange={onChange} readOnly={readOnly} />
      )}
      {curveType === 'SineWave' && (
        <SineWaveEditor json={json} onChange={onChange} readOnly={readOnly} />
      )}

    </div>
  )
}
