/**
 * EffectsBlockEditor — structured editor for Hytale Effects dictionaries.
 *
 * Used by:
 *   - InteractionFormPanel (Simple.Effects field)
 *   - EntityEffectFormEditor (ApplicationEffects, DamageEffects fields)
 *
 * Handles: ItemAnimationId, WorldSoundEventId, LocalSoundEventId, CameraEffect,
 *          Particles (structured array), Trails (raw JSON).
 */

import { INPUT_STYLE, LABEL_STYLE, TEXTAREA_STYLE } from './formStyles'

type EffectsValue = Record<string, unknown>

type Props = {
  value: EffectsValue
  onChange: (updated: EffectsValue | undefined) => void
  /** Optional wrapper style override (e.g. for embedding in a form section) */
  style?: React.CSSProperties
  /** Additional string keys to show beyond the default four */
  extraStringKeys?: readonly string[]
}

const DEFAULT_STRING_KEYS = ['ItemAnimationId', 'WorldSoundEventId', 'LocalSoundEventId', 'CameraEffect'] as const

export function EffectsBlockEditor({ value, onChange, style, extraStringKeys }: Props) {
  const eff = value

  const allStringKeys = extraStringKeys
    ? ([...DEFAULT_STRING_KEYS, ...extraStringKeys] as string[])
    : (DEFAULT_STRING_KEYS as readonly string[])

  const handleStringChange = (eKey: string, eVal: string) => {
    const updated = { ...eff }
    if (eVal.trim() === '') delete updated[eKey]
    else updated[eKey] = eVal
    onChange(Object.keys(updated).length === 0 ? undefined : updated)
  }

  const particles = Array.isArray(eff['Particles'])
    ? (eff['Particles'] as Record<string, unknown>[])
    : []

  const setParticles = (next: Record<string, unknown>[]) => {
    const newEff = { ...eff }
    if (next.length === 0) delete newEff['Particles']
    else newEff['Particles'] = next
    onChange(Object.keys(newEff).length === 0 ? undefined : newEff)
  }

  const addParticle = () => setParticles([...particles, { SystemId: '' }])

  const updateParticle = (i: number, patch: Record<string, unknown>) => {
    const next = [...particles]
    const merged = { ...next[i], ...patch }
    Object.keys(merged).forEach((k) => { if (merged[k] === undefined) delete merged[k] })
    next[i] = merged
    setParticles(next)
  }

  const removeParticle = (i: number) => setParticles(particles.filter((_, j) => j !== i))

  const updateRot = (i: number, axis: string, val: string) => {
    const p = particles[i]
    const rotOff = (typeof p['RotationOffset'] === 'object' && p['RotationOffset'] !== null)
      ? { ...(p['RotationOffset'] as Record<string, unknown>) }
      : {}
    const n = parseFloat(val)
    if (!val || isNaN(n) || n === 0) delete rotOff[axis]
    else rotOff[axis] = n
    updateParticle(i, { RotationOffset: Object.keys(rotOff).length === 0 ? undefined : rotOff })
  }

  return (
    <div style={style}>
      {/* String fields */}
      {allStringKeys.map((ek) => (
        <div key={ek} style={{ marginBottom: 6 }}>
          <label style={{ ...LABEL_STYLE, color: '#666' }}>{ek}</label>
          <input
            type="text"
            value={typeof eff[ek] === 'string' ? (eff[ek] as string) : ''}
            onChange={(e) => handleStringChange(ek, e.target.value)}
            style={INPUT_STYLE}
            placeholder="server ID or value"
          />
        </div>
      ))}

      {/* Particles — structured array */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={{ ...LABEL_STYLE, color: '#666' }}>Particles</label>
          <button
            onClick={addParticle}
            style={{ background: 'transparent', border: '1px dashed #444', borderRadius: 3, color: '#666', cursor: 'pointer', fontSize: 11, padding: '2px 8px' }}
          >
            + Add
          </button>
        </div>
        {particles.map((p, i) => {
          const rotOff = (typeof p['RotationOffset'] === 'object' && p['RotationOffset'] !== null)
            ? (p['RotationOffset'] as Record<string, unknown>)
            : {}
          return (
            <div key={i} style={{ border: '1px solid #333', borderRadius: 4, padding: '6px 8px', marginBottom: 4, background: '#1a1a28' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: '#555' }}>#{i + 1}</span>
                <button
                  onClick={() => removeParticle(i)}
                  style={{ background: 'transparent', border: 'none', color: '#FF6B6B', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px' }}
                  title="Remove"
                >✕</button>
              </div>
              <div style={{ marginBottom: 3 }}>
                <label style={{ ...LABEL_STYLE, color: '#666' }}>SystemId *</label>
                <input
                  type="text"
                  value={typeof p['SystemId'] === 'string' ? (p['SystemId'] as string) : ''}
                  onChange={(e) => updateParticle(i, { SystemId: e.target.value || undefined })}
                  style={INPUT_STYLE}
                  placeholder="e.g. NatureBeam"
                />
              </div>
              <div style={{ marginBottom: 3 }}>
                <label style={{ ...LABEL_STYLE, color: '#666' }}>TargetNodeName</label>
                <input
                  type="text"
                  value={typeof p['TargetNodeName'] === 'string' ? (p['TargetNodeName'] as string) : ''}
                  onChange={(e) => updateParticle(i, { TargetNodeName: e.target.value || undefined })}
                  style={INPUT_STYLE}
                  placeholder="e.g. Handle"
                />
              </div>
              <div>
                <label style={{ ...LABEL_STYLE, color: '#666' }}>RotationOffset — Roll / Pitch / Yaw</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['Roll', 'Pitch', 'Yaw'] as const).map((axis) => (
                    <input
                      key={axis}
                      type="number"
                      value={typeof rotOff[axis] === 'number' ? (rotOff[axis] as number) : ''}
                      onChange={(e) => updateRot(i, axis, e.target.value)}
                      style={{ ...INPUT_STYLE, width: '30%' }}
                      placeholder={axis}
                    />
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Trails — raw JSON */}
      <div style={{ marginBottom: 4 }}>
        <label style={{ ...LABEL_STYLE, color: '#666' }}>Trails (JSON array)</label>
        <textarea
          rows={2}
          value={eff['Trails'] !== undefined ? JSON.stringify(eff['Trails'], null, 2) : ''}
          onChange={(e) => {
            const v = e.target.value.trim()
            const copy = { ...eff }
            if (!v) {
              delete copy['Trails']
            } else {
              try { copy['Trails'] = JSON.parse(v) } catch { /* keep current */ return }
            }
            onChange(Object.keys(copy).length === 0 ? undefined : copy)
          }}
          style={{ ...TEXTAREA_STYLE, minHeight: 40 }}
          placeholder='[{ "TrailId": "..." }]'
        />
      </div>
    </div>
  )
}
