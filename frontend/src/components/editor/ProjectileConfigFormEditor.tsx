/**
 * ProjectileConfigFormEditor — structured form for Server/ProjectileConfigs/ assets.
 *
 * Handles:
 *   - Model, LaunchForce
 *   - SpawnOffset (X/Y/Z inline)
 *   - SpawnRotationOffset (Pitch/Yaw/Roll inline)
 *   - Physics (structured sub-editor: Type, Gravity, velocities, rotation mode,
 *     bounce params, SticksVertically, AllowRolling…)
 *   - Interactions per slot (ProjectileSpawn/Hit/Miss/Bounce) — JSON textarea,
 *     since each slot is a full interaction tree
 *   - Extra fields catch-all
 */

import { LABEL_STYLE, INPUT_STYLE, TEXTAREA_STYLE } from './formStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const HANDLED_KEYS = new Set([
  'Model', 'LaunchForce', 'SpawnOffset', 'SpawnRotationOffset', 'Physics', 'Interactions',
])

const PHYSICS_HANDLED_KEYS = new Set([
  'Type', 'Gravity', 'TerminalVelocityAir', 'TerminalVelocityWater',
  'RotationMode', 'Bounciness', 'BounceLimit', 'BounceCount',
  'AllowRolling', 'RollingFrictionFactor', 'SticksVertically',
])

const PHYSICS_TYPE_OPTIONS = ['Standard']
const ROTATION_MODE_OPTIONS = ['Velocity', 'VelocityRoll', 'VelocityDamped', 'Fixed', 'None']
const INTERACTION_SLOTS = ['ProjectileSpawn', 'ProjectileHit', 'ProjectileMiss', 'ProjectileBounce']

// ─── Styles ───────────────────────────────────────────────────────────────────

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
const SELECT: React.CSSProperties = {
  ...INPUT_STYLE, width: '100%',
  background: '#1e1e2e', color: '#ccc', borderColor: '#383850', height: 26,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asObj(v: unknown): Record<string, unknown> {
  return (typeof v === 'object' && v !== null && !Array.isArray(v))
    ? (v as Record<string, unknown>) : {}
}

function XYZEditor({
  label, value, onChange, readOnly,
}: {
  label: string
  value: unknown
  onChange: (v: Record<string, unknown> | undefined) => void
  readOnly: boolean
}) {
  const obj = asObj(value)
  const setAxis = (axis: string, raw: string) => {
    if (readOnly) return
    const next = { ...obj }
    if (raw === '' || isNaN(parseFloat(raw))) delete next[axis]
    else next[axis] = parseFloat(raw)
    onChange(Object.keys(next).length === 0 ? undefined : next)
  }
  return (
    <div style={FIELD}>
      <label style={LABEL}>{label}</label>
      <div style={ROW}>
        {(['X', 'Y', 'Z'] as const).map((axis) => (
          <div key={axis} style={COL}>
            <input
              type="number"
              value={typeof obj[axis] === 'number' ? (obj[axis] as number) : ''}
              onChange={(e) => setAxis(axis, e.target.value)}
              disabled={readOnly}
              style={INPUT}
              placeholder={axis}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function PitchYawRollEditor({
  label, value, onChange, readOnly,
}: {
  label: string
  value: unknown
  onChange: (v: Record<string, unknown> | undefined) => void
  readOnly: boolean
}) {
  const obj = asObj(value)
  const setAxis = (axis: string, raw: string) => {
    if (readOnly) return
    const next = { ...obj }
    if (raw === '' || isNaN(parseFloat(raw))) delete next[axis]
    else next[axis] = parseFloat(raw)
    onChange(Object.keys(next).length === 0 ? undefined : next)
  }
  return (
    <div style={FIELD}>
      <label style={LABEL}>{label}</label>
      <div style={ROW}>
        {(['Pitch', 'Yaw', 'Roll'] as const).map((axis) => (
          <div key={axis} style={COL}>
            <input
              type="number"
              value={typeof obj[axis] === 'number' ? (obj[axis] as number) : ''}
              onChange={(e) => setAxis(axis, e.target.value)}
              disabled={readOnly}
              style={INPUT}
              placeholder={axis}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function PhysicsEditor({
  value,
  onChange,
  readOnly,
}: {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
  readOnly: boolean
}) {
  const set = (k: string, v: unknown) => {
    if (readOnly) return
    const next = { ...value }
    if (v === undefined || v === '') delete next[k]
    else next[k] = v
    onChange(next)
  }

  const setJson = (k: string, raw: string) => {
    if (readOnly) return
    const next = { ...value }
    if (!raw.trim()) delete next[k]
    else try { next[k] = JSON.parse(raw) } catch { return }
    onChange(next)
  }

  const extraPhysicsKeys = Object.keys(value).filter((k) => !PHYSICS_HANDLED_KEYS.has(k))

  return (
    <div style={{ border: '1px solid #2a2a36', borderRadius: 4, padding: '8px 10px', marginBottom: 8 }}>
      {/* Type */}
      <div style={FIELD}>
        <label style={LABEL}>Physics Type</label>
        <select
          value={typeof value['Type'] === 'string' ? (value['Type'] as string) : ''}
          onChange={(e) => set('Type', e.target.value || undefined)}
          disabled={readOnly}
          style={SELECT}
        >
          <option value="">— unset —</option>
          {PHYSICS_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* RotationMode */}
      <div style={FIELD}>
        <label style={LABEL}>RotationMode</label>
        <select
          value={typeof value['RotationMode'] === 'string' ? (value['RotationMode'] as string) : ''}
          onChange={(e) => set('RotationMode', e.target.value || undefined)}
          disabled={readOnly}
          style={SELECT}
        >
          <option value="">— unset —</option>
          {ROTATION_MODE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* SticksVertically */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: readOnly ? 'default' : 'pointer', color: '#aaa', fontSize: 11, marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={value['SticksVertically'] === true}
          onChange={(e) => set('SticksVertically', e.target.checked)}
          disabled={readOnly}
        />
        SticksVertically
      </label>

      {/* AllowRolling */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: readOnly ? 'default' : 'pointer', color: '#aaa', fontSize: 11, marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={value['AllowRolling'] === true}
          onChange={(e) => set('AllowRolling', e.target.checked)}
          disabled={readOnly}
        />
        AllowRolling
      </label>

      {/* Gravity / Velocities */}
      <div style={ROW}>
        <div style={COL}>
          <label style={LABEL}>Gravity</label>
          <input type="number" value={typeof value['Gravity'] === 'number' ? (value['Gravity'] as number) : ''} onChange={(e) => set('Gravity', e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={readOnly} style={INPUT} />
        </div>
        <div style={COL}>
          <label style={LABEL}>TermVelocityAir</label>
          <input type="number" value={typeof value['TerminalVelocityAir'] === 'number' ? (value['TerminalVelocityAir'] as number) : ''} onChange={(e) => set('TerminalVelocityAir', e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={readOnly} style={INPUT} />
        </div>
        <div style={COL}>
          <label style={LABEL}>TermVelocityWater</label>
          <input type="number" value={typeof value['TerminalVelocityWater'] === 'number' ? (value['TerminalVelocityWater'] as number) : ''} onChange={(e) => set('TerminalVelocityWater', e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={readOnly} style={INPUT} />
        </div>
      </div>

      {/* Bounce params */}
      <div style={ROW}>
        <div style={COL}>
          <label style={LABEL}>Bounciness</label>
          <input type="number" step="0.01" value={typeof value['Bounciness'] === 'number' ? (value['Bounciness'] as number) : ''} onChange={(e) => set('Bounciness', e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={readOnly} style={INPUT} placeholder="0–1" />
        </div>
        <div style={COL}>
          <label style={LABEL}>BounceLimit</label>
          <input type="number" step="0.01" value={typeof value['BounceLimit'] === 'number' ? (value['BounceLimit'] as number) : ''} onChange={(e) => set('BounceLimit', e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={readOnly} style={INPUT} />
        </div>
        <div style={COL}>
          <label style={LABEL}>BounceCount</label>
          <input type="number" value={typeof value['BounceCount'] === 'number' ? (value['BounceCount'] as number) : ''} onChange={(e) => set('BounceCount', e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={readOnly} style={INPUT} />
        </div>
      </div>

      {/* RollingFrictionFactor */}
      {(value['RollingFrictionFactor'] !== undefined || !readOnly) && (
        <div style={FIELD}>
          <label style={LABEL}>RollingFrictionFactor</label>
          <input type="number" step="0.01" value={typeof value['RollingFrictionFactor'] === 'number' ? (value['RollingFrictionFactor'] as number) : ''} onChange={(e) => set('RollingFrictionFactor', e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={readOnly} style={INPUT} />
        </div>
      )}

      {/* Extra physics keys */}
      {extraPhysicsKeys.map((k) => {
        const v = value[k]
        const isComplex = typeof v === 'object' && v !== null
        return (
          <div key={k} style={FIELD}>
            <label style={LABEL}>{k}</label>
            {isComplex ? (
              <textarea rows={2} defaultValue={JSON.stringify(v, null, 2)} readOnly={readOnly} onBlur={(e) => { if (!readOnly) setJson(k, e.target.value) }} style={{ ...TEXTAREA_STYLE, width: '100%', resize: 'vertical', fontSize: 11 }} spellCheck={false} />
            ) : (
              <input type="text" defaultValue={v === null || v === undefined ? '' : String(v)} readOnly={readOnly} onBlur={(e) => { if (!readOnly) set(k, e.target.value || undefined) }} style={INPUT} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly?: boolean
}

export function ProjectileConfigFormEditor({ json, onChange, readOnly = false }: Props) {
  const set = (k: string, v: unknown) => {
    if (readOnly) return
    const next = { ...json }
    if (v === undefined) delete next[k]
    else next[k] = v
    onChange(next)
  }

  const setJson = (k: string, raw: string) => {
    if (readOnly) return
    const next = { ...json }
    if (!raw.trim()) delete next[k]
    else try { next[k] = JSON.parse(raw) } catch { return }
    onChange(next)
  }

  const physics = asObj(json['Physics'])
  const interactions = asObj(json['Interactions'])
  const extraKeys = Object.keys(json).filter((k) => !HANDLED_KEYS.has(k))

  return (
    <div style={{ fontSize: 12, padding: '8px 12px' }}>
      {readOnly && (
        <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', marginBottom: 8 }}>
          Read-only — overrides uniquement disponibles pour les assets server.
        </div>
      )}

      {/* ── Identity ──────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER}>Identity</div>
      <div style={FIELD}>
        <label style={LABEL}>Model</label>
        <input
          type="text"
          value={typeof json['Model'] === 'string' ? (json['Model'] as string) : ''}
          onChange={(e) => set('Model', e.target.value || undefined)}
          disabled={readOnly}
          style={INPUT}
          placeholder="e.g. Arrow_Crude"
        />
      </div>
      <div style={FIELD}>
        <label style={LABEL}>LaunchForce</label>
        <input
          type="number"
          value={typeof json['LaunchForce'] === 'number' ? (json['LaunchForce'] as number) : ''}
          onChange={(e) => set('LaunchForce', e.target.value === '' ? undefined : parseFloat(e.target.value))}
          disabled={readOnly}
          style={INPUT}
        />
      </div>

      {/* ── Spawn ─────────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER}>Spawn</div>
      <XYZEditor
        label="SpawnOffset  (X / Y / Z)"
        value={json['SpawnOffset']}
        onChange={(v) => set('SpawnOffset', v)}
        readOnly={readOnly}
      />
      <PitchYawRollEditor
        label="SpawnRotationOffset  (Pitch / Yaw / Roll)"
        value={json['SpawnRotationOffset']}
        onChange={(v) => set('SpawnRotationOffset', v)}
        readOnly={readOnly}
      />

      {/* ── Physics ───────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER}>Physics</div>
      <PhysicsEditor
        value={physics}
        onChange={(v) => set('Physics', v)}
        readOnly={readOnly}
      />

      {/* ── Interactions (per slot) ───────────────────────────────────── */}
      <div style={SECTION_HEADER}>Interactions</div>
      {INTERACTION_SLOTS.map((slot) => (
        <div key={slot} style={FIELD}>
          <label style={LABEL}>{slot}</label>
          <textarea
            rows={4}
            defaultValue={
              interactions[slot] !== undefined
                ? JSON.stringify(interactions[slot], null, 2)
                : ''
            }
            readOnly={readOnly}
            onBlur={(e) => {
              if (readOnly) return
              const raw = e.target.value.trim()
              const next = { ...interactions }
              if (!raw) delete next[slot]
              else try { next[slot] = JSON.parse(raw) } catch { return }
              set('Interactions', Object.keys(next).length === 0 ? undefined : next)
            }}
            style={{ ...TEXTAREA_STYLE, width: '100%', resize: 'vertical', fontSize: 11 }}
            spellCheck={false}
            placeholder={`{ "Cooldown": {}, "Interactions": [] }`}
          />
        </div>
      ))}
      {/* Extra slots not in the standard list */}
      {Object.keys(interactions)
        .filter((s) => !INTERACTION_SLOTS.includes(s))
        .map((slot) => (
          <div key={slot} style={FIELD}>
            <label style={{ ...LABEL, color: '#59a' }}>{slot} (extra)</label>
            <textarea
              rows={4}
              defaultValue={JSON.stringify(interactions[slot], null, 2)}
              readOnly={readOnly}
              onBlur={(e) => {
                if (readOnly) return
                const raw = e.target.value.trim()
                const next = { ...interactions }
                if (!raw) delete next[slot]
                else try { next[slot] = JSON.parse(raw) } catch { return }
                set('Interactions', Object.keys(next).length === 0 ? undefined : next)
              }}
              style={{ ...TEXTAREA_STYLE, width: '100%', resize: 'vertical', fontSize: 11 }}
              spellCheck={false}
            />
          </div>
        ))}

      {/* ── Extra top-level fields ────────────────────────────────────── */}
      {extraKeys.length > 0 && (
        <>
          <div style={SECTION_HEADER}>Additional Fields</div>
          {extraKeys.map((k) => {
            const v = json[k]
            const isComplex = typeof v === 'object' && v !== null
            return (
              <div key={k} style={FIELD}>
                <label style={LABEL}>{k}</label>
                {isComplex ? (
                  <textarea rows={3} defaultValue={JSON.stringify(v, null, 2)} readOnly={readOnly} onBlur={(e) => { if (!readOnly) setJson(k, e.target.value) }} style={{ ...TEXTAREA_STYLE, width: '100%', resize: 'vertical', fontSize: 11 }} spellCheck={false} />
                ) : (
                  <input type="text" defaultValue={v === null || v === undefined ? '' : String(v)} readOnly={readOnly} onBlur={(e) => { if (!readOnly) set(k, e.target.value || undefined) }} style={INPUT} />
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
