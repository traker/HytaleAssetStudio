/**
 * ProjectileFormEditor — structured form for Server/Projectiles/ assets.
 *
 * Handles all common projectile fields: physics, shape, aim, damage, appearance,
 * audio, particle references, and a catch-all for extras.
 */

import { LABEL_STYLE, INPUT_STYLE, TEXTAREA_STYLE } from './formStyles'

const HANDLED_KEYS = new Set([
  'Appearance', 'SticksVertically', 'PitchAdjustShot', 'DeathEffectsOnHit',
  'MuzzleVelocity', 'TerminalVelocity', 'Gravity', 'Bounciness',
  'ImpactSlowdown', 'TimeToLive', 'DeadTime', 'DeadTimeMiss',
  'Radius', 'Height',
  'Damage',
  'HorizontalCenterShot', 'VerticalCenterShot', 'DepthShot',
  'HitSoundEventId', 'MissSoundEventId', 'DeathSoundEventId',
  'HitParticles', 'DeathParticles', 'MissParticles',
])

// ─── Styles ──────────────────────────────────────────────────────────────────

const SECTION_HEADER: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 6,
  marginTop: 14,
  borderBottom: '1px solid #2a2a36',
  paddingBottom: 3,
}
const FIELD: React.CSSProperties = { marginBottom: 8 }
const LABEL: React.CSSProperties = { ...LABEL_STYLE, display: 'block', marginBottom: 3 }
const INPUT: React.CSSProperties = { ...INPUT_STYLE, width: '100%' }
const ROW: React.CSSProperties = { display: 'flex', gap: 8 }
const COL: React.CSSProperties = { flex: 1 }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function NumField({
  label, value, onChange, readOnly, placeholder,
}: { label: string; value: unknown; onChange: (v: number | undefined) => void; readOnly: boolean; placeholder?: string }) {
  return (
    <div style={FIELD}>
      <label style={LABEL}>{label}</label>
      <input
        type="number"
        value={typeof value === 'number' ? (value as number) : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
        disabled={readOnly}
        style={INPUT}
        placeholder={placeholder}
      />
    </div>
  )
}

function StrField({
  label, value, onChange, readOnly, placeholder,
}: { label: string; value: unknown; onChange: (v: string | undefined) => void; readOnly: boolean; placeholder?: string }) {
  return (
    <div style={FIELD}>
      <label style={LABEL}>{label}</label>
      <input
        type="text"
        value={typeof value === 'string' ? (value as string) : ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={readOnly}
        style={INPUT}
        placeholder={placeholder}
      />
    </div>
  )
}

function BoolField({
  label, value, onChange, readOnly,
}: { label: string; value: unknown; onChange: (v: boolean) => void; readOnly: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: readOnly ? 'default' : 'pointer', color: '#aaa', fontSize: 11, marginBottom: 8 }}>
      <input
        type="checkbox"
        checked={value === true}
        onChange={(e) => onChange(e.target.checked)}
        disabled={readOnly}
      />
      {label}
    </label>
  )
}

/** Single-particle slot — just {SystemId: string} object */
function ParticleField({
  label, value, onChange, readOnly,
}: { label: string; value: unknown; onChange: (v: Record<string, unknown> | undefined) => void; readOnly: boolean }) {
  const obj = (typeof value === 'object' && value !== null && !Array.isArray(value))
    ? (value as Record<string, unknown>) : undefined
  const systemId = typeof obj?.['SystemId'] === 'string' ? (obj!['SystemId'] as string) : ''

  return (
    <div style={FIELD}>
      <label style={LABEL}>{label} — SystemId</label>
      <input
        type="text"
        value={systemId}
        onChange={(e) => {
          const v = e.target.value
          if (!v) onChange(undefined)
          else onChange({ ...(obj ?? {}), SystemId: v })
        }}
        disabled={readOnly}
        style={INPUT}
        placeholder="e.g. Impact_Blade_01"
      />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly?: boolean
}

export function ProjectileFormEditor({ json, onChange, readOnly = false }: Props) {
  const set = (k: string, v: unknown) => {
    if (readOnly) return
    const next = { ...json }
    if (v === undefined) delete next[k]
    else next[k] = v
    onChange(next)
  }

  const setJson = (k: string, raw: string) => {
    if (readOnly) return
    const trimmed = raw.trim()
    const next = { ...json }
    if (!trimmed) delete next[k]
    else try { next[k] = JSON.parse(trimmed) } catch { return }
    onChange(next)
  }

  const extraKeys = Object.keys(json).filter((k) => !HANDLED_KEYS.has(k))

  return (
    <div style={{ fontSize: 12, padding: '8px 12px' }}>
      {readOnly && (
        <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', marginBottom: 8 }}>
          Read-only — overrides uniquement disponibles pour les assets server.
        </div>
      )}

      {/* ── Appearance ──────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER}>Appearance</div>
      <StrField label="Appearance" value={json['Appearance']} onChange={(v) => set('Appearance', v)} readOnly={readOnly} placeholder="e.g. Arrow_Crude" />
      <div style={ROW}>
        <div style={COL}>
          <BoolField label="SticksVertically" value={json['SticksVertically']} onChange={(v) => set('SticksVertically', v)} readOnly={readOnly} />
        </div>
        <div style={COL}>
          <BoolField label="PitchAdjustShot" value={json['PitchAdjustShot']} onChange={(v) => set('PitchAdjustShot', v)} readOnly={readOnly} />
        </div>
      </div>

      {/* ── Physics ─────────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER}>Physics</div>
      <div style={ROW}>
        <div style={COL}><NumField label="MuzzleVelocity" value={json['MuzzleVelocity']} onChange={(v) => set('MuzzleVelocity', v)} readOnly={readOnly} /></div>
        <div style={COL}><NumField label="TerminalVelocity" value={json['TerminalVelocity']} onChange={(v) => set('TerminalVelocity', v)} readOnly={readOnly} /></div>
      </div>
      <div style={ROW}>
        <div style={COL}><NumField label="Gravity" value={json['Gravity']} onChange={(v) => set('Gravity', v)} readOnly={readOnly} /></div>
        <div style={COL}><NumField label="Bounciness" value={json['Bounciness']} onChange={(v) => set('Bounciness', v)} readOnly={readOnly} /></div>
      </div>
      <div style={ROW}>
        <div style={COL}><NumField label="ImpactSlowdown" value={json['ImpactSlowdown']} onChange={(v) => set('ImpactSlowdown', v)} readOnly={readOnly} /></div>
        <div style={COL}><NumField label="TimeToLive (s)" value={json['TimeToLive']} onChange={(v) => set('TimeToLive', v)} readOnly={readOnly} /></div>
      </div>
      <div style={ROW}>
        <div style={COL}><NumField label="DeadTime" value={json['DeadTime']} onChange={(v) => set('DeadTime', v)} readOnly={readOnly} /></div>
        <div style={COL}><NumField label="DeadTimeMiss" value={json['DeadTimeMiss']} onChange={(v) => set('DeadTimeMiss', v)} readOnly={readOnly} /></div>
      </div>

      {/* ── Shape (optional) ────────────────────────────────────────────── */}
      {(json['Radius'] !== undefined || json['Height'] !== undefined) && (
        <>
          <div style={SECTION_HEADER}>Shape</div>
          <div style={ROW}>
            <div style={COL}><NumField label="Radius" value={json['Radius']} onChange={(v) => set('Radius', v)} readOnly={readOnly} /></div>
            <div style={COL}><NumField label="Height" value={json['Height']} onChange={(v) => set('Height', v)} readOnly={readOnly} /></div>
          </div>
        </>
      )}

      {/* ── Aim ─────────────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER}>Aim</div>
      <div style={ROW}>
        <div style={COL}><NumField label="HorizontalCenter" value={json['HorizontalCenterShot']} onChange={(v) => set('HorizontalCenterShot', v)} readOnly={readOnly} /></div>
        <div style={COL}><NumField label="VerticalCenter" value={json['VerticalCenterShot']} onChange={(v) => set('VerticalCenterShot', v)} readOnly={readOnly} /></div>
        <div style={COL}><NumField label="Depth" value={json['DepthShot']} onChange={(v) => set('DepthShot', v)} readOnly={readOnly} /></div>
      </div>

      {/* ── Damage ──────────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER}>Damage</div>
      <div style={ROW}>
        <div style={COL}><NumField label="Damage" value={json['Damage']} onChange={(v) => set('Damage', v)} readOnly={readOnly} /></div>
        <div style={{ ...COL, paddingTop: 20 }}>
          <BoolField label="DeathEffectsOnHit" value={json['DeathEffectsOnHit']} onChange={(v) => set('DeathEffectsOnHit', v)} readOnly={readOnly} />
        </div>
      </div>

      {/* ── Audio ───────────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER}>Audio</div>
      <StrField label="HitSoundEventId" value={json['HitSoundEventId']} onChange={(v) => set('HitSoundEventId', v)} readOnly={readOnly} />
      <StrField label="MissSoundEventId" value={json['MissSoundEventId']} onChange={(v) => set('MissSoundEventId', v)} readOnly={readOnly} />
      <StrField label="DeathSoundEventId" value={json['DeathSoundEventId']} onChange={(v) => set('DeathSoundEventId', v)} readOnly={readOnly} />

      {/* ── Particles ───────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER}>Particles</div>
      <ParticleField label="HitParticles" value={json['HitParticles']} onChange={(v) => set('HitParticles', v)} readOnly={readOnly} />
      <ParticleField label="MissParticles" value={json['MissParticles']} onChange={(v) => set('MissParticles', v)} readOnly={readOnly} />
      <ParticleField label="DeathParticles" value={json['DeathParticles']} onChange={(v) => set('DeathParticles', v)} readOnly={readOnly} />

      {/* ── Extra fields ────────────────────────────────────────────────── */}
      {extraKeys.length > 0 && (
        <>
          <div style={SECTION_HEADER}>Additional Fields</div>
          {extraKeys.map((k) => {
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
                    onBlur={(e) => { if (!readOnly) setJson(k, e.target.value) }}
                    style={{ ...TEXTAREA_STYLE, width: '100%', resize: 'vertical', fontSize: 11 }}
                    spellCheck={false}
                  />
                ) : (
                  <input
                    type="text"
                    defaultValue={val === undefined || val === null ? '' : String(val)}
                    readOnly={readOnly}
                    onBlur={(e) => { if (!readOnly) set(k, e.target.value || undefined) }}
                    style={INPUT}
                  />
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
