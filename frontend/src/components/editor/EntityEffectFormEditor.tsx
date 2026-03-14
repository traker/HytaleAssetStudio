/**
 * EntityEffectFormEditor — structured form for Server/Entity/Effects/ assets.
 *
 * Handles: Duration, Infinite, Debuff, OverlapBehavior, DamageCalculatorCooldown,
 *          StatusEffectIcon, DeathMessageKey, ApplicationEffects, DamageEffects,
 *          DamageCalculator, StatModifiers, and a catch-all for extra keys.
 */

import { useMemo } from 'react'
import { EffectsBlockEditor } from './EffectsBlockEditor'
import { INPUT_STYLE, LABEL_STYLE, TEXTAREA_STYLE } from './formStyles'

// Keys explicitly handled in this form — everything else goes to Extra section
const HANDLED_KEYS = new Set([
  'Duration',
  'Infinite',
  'Debuff',
  'OverlapBehavior',
  'DamageCalculatorCooldown',
  'StatusEffectIcon',
  'DeathMessageKey',
  'ApplicationEffects',
  'DamageEffects',
  'DamageCalculator',
  'StatModifiers',
])

const OVERLAP_OPTIONS = ['Overwrite', 'Stack', 'Ignore']

// Extra keys visible inside ApplicationEffects beyond the EffectsBlockEditor defaults
const APP_FX_EXTRA_KEYS = ['EntityBottomTint', 'EntityTopTint', 'ScreenEffect', 'ModelVFXId'] as const
// Extra keys visible inside DamageEffects
const DMG_FX_EXTRA_KEYS = ['PlayerSoundEventId'] as const

// ─── Shared section styles ────────────────────────────────────────────────────
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

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly?: boolean
}

export function EntityEffectFormEditor({ json, onChange, readOnly = false }: Props) {
  const set = (k: string, v: unknown) => {
    if (readOnly) return
    const next = { ...json }
    if (v === undefined || v === '') delete next[k]
    else next[k] = v
    onChange(next)
  }

  const setBoolean = (k: string, v: boolean) => {
    if (readOnly) return
    onChange({ ...json, [k]: v })
  }

  const setEffectsBlock = (k: string, v: Record<string, unknown> | undefined) => {
    if (readOnly) return
    const next = { ...json }
    if (v === undefined || Object.keys(v).length === 0) delete next[k]
    else next[k] = v
    onChange(next)
  }

  const setJson = (k: string, raw: string) => {
    if (readOnly) return
    const trimmed = raw.trim()
    const next = { ...json }
    if (!trimmed) {
      delete next[k]
    } else {
      try { next[k] = JSON.parse(trimmed) } catch { return }
    }
    onChange(next)
  }

  const appFx = useMemo(() => {
    const v = json['ApplicationEffects']
    return (typeof v === 'object' && v !== null && !Array.isArray(v))
      ? (v as Record<string, unknown>) : {}
  }, [json])

  const dmgFx = useMemo(() => {
    const v = json['DamageEffects']
    return (typeof v === 'object' && v !== null && !Array.isArray(v))
      ? (v as Record<string, unknown>) : {}
  }, [json])

  const extraKeys = Object.keys(json).filter((k) => !HANDLED_KEYS.has(k))

  return (
    <div style={{ fontSize: 12, padding: '8px 12px' }}>
      {/* ── Basic fields ──────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER}>General</div>

      {/* Duration */}
      <div style={{ ...FIELD, display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <label style={LABEL}>Duration (s)</label>
          <input
            type="number"
            value={typeof json['Duration'] === 'number' ? (json['Duration'] as number) : ''}
            onChange={(e) => set('Duration', e.target.value === '' ? undefined : parseFloat(e.target.value))}
            disabled={readOnly}
            style={INPUT}
            placeholder="-1 or seconds"
          />
        </div>
        <div style={{ paddingTop: 18 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: readOnly ? 'default' : 'pointer', color: '#aaa', fontSize: 11 }}>
            <input
              type="checkbox"
              checked={json['Infinite'] === true}
              onChange={(e) => setBoolean('Infinite', e.target.checked)}
              disabled={readOnly}
            />
            Infinite
          </label>
        </div>
        <div style={{ paddingTop: 18 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: readOnly ? 'default' : 'pointer', color: '#aaa', fontSize: 11 }}>
            <input
              type="checkbox"
              checked={json['Debuff'] === true}
              onChange={(e) => setBoolean('Debuff', e.target.checked)}
              disabled={readOnly}
            />
            Debuff
          </label>
        </div>
      </div>

      {/* OverlapBehavior */}
      <div style={FIELD}>
        <label style={LABEL}>OverlapBehavior</label>
        <select
          value={typeof json['OverlapBehavior'] === 'string' ? (json['OverlapBehavior'] as string) : ''}
          onChange={(e) => set('OverlapBehavior', e.target.value || undefined)}
          disabled={readOnly}
          style={{ ...INPUT, background: '#1e1e2e', color: '#ccc', borderColor: '#383850', height: 26 }}
        >
          <option value="">— unset —</option>
          {OVERLAP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* DamageCalculatorCooldown */}
      <div style={FIELD}>
        <label style={LABEL}>DamageCalculatorCooldown (s)</label>
        <input
          type="number"
          value={typeof json['DamageCalculatorCooldown'] === 'number' ? (json['DamageCalculatorCooldown'] as number) : ''}
          onChange={(e) => set('DamageCalculatorCooldown', e.target.value === '' ? undefined : parseFloat(e.target.value))}
          disabled={readOnly}
          style={INPUT}
          placeholder="e.g. 1"
        />
      </div>

      {/* StatusEffectIcon */}
      <div style={FIELD}>
        <label style={LABEL}>StatusEffectIcon</label>
        <input
          type="text"
          value={typeof json['StatusEffectIcon'] === 'string' ? (json['StatusEffectIcon'] as string) : ''}
          onChange={(e) => set('StatusEffectIcon', e.target.value || undefined)}
          disabled={readOnly}
          style={INPUT}
          placeholder="UI/StatusEffects/…"
        />
      </div>

      {/* DeathMessageKey */}
      <div style={FIELD}>
        <label style={LABEL}>DeathMessageKey</label>
        <input
          type="text"
          value={typeof json['DeathMessageKey'] === 'string' ? (json['DeathMessageKey'] as string) : ''}
          onChange={(e) => set('DeathMessageKey', e.target.value || undefined)}
          disabled={readOnly}
          style={INPUT}
          placeholder="server.general.deathCause.…"
        />
      </div>

      {/* ── ApplicationEffects ────────────────────────────────────────────── */}
      <div style={SECTION_HEADER}>Application Effects</div>
      <div style={{ border: '1px solid #2a2a36', borderRadius: 4, padding: '6px 8px', marginBottom: 8 }}>
        <EffectsBlockEditor
          value={appFx}
          onChange={(v) => setEffectsBlock('ApplicationEffects', v)}
          extraStringKeys={APP_FX_EXTRA_KEYS}
        />
      </div>

      {/* ── DamageEffects ─────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER}>Damage Effects</div>
      <div style={{ border: '1px solid #2a2a36', borderRadius: 4, padding: '6px 8px', marginBottom: 8 }}>
        <EffectsBlockEditor
          value={dmgFx}
          onChange={(v) => setEffectsBlock('DamageEffects', v)}
          extraStringKeys={DMG_FX_EXTRA_KEYS}
        />
      </div>

      {/* ── DamageCalculator ──────────────────────────────────────────────── */}
      <div style={SECTION_HEADER}>Damage Calculator</div>
      <div style={FIELD}>
        <textarea
          rows={4}
          defaultValue={json['DamageCalculator'] !== undefined ? JSON.stringify(json['DamageCalculator'], null, 2) : ''}
          readOnly={readOnly}
          onBlur={(e) => setJson('DamageCalculator', e.target.value)}
          style={{ ...TEXTAREA_STYLE, width: '100%', resize: 'vertical', fontSize: 11 }}
          spellCheck={false}
          placeholder='{ "BaseDamage": { "Fire": 5 } }'
        />
      </div>

      {/* ── StatModifiers ─────────────────────────────────────────────────── */}
      {(json['StatModifiers'] !== undefined || !readOnly) && (
        <>
          <div style={SECTION_HEADER}>Stat Modifiers</div>
          <div style={FIELD}>
            <textarea
              rows={3}
              defaultValue={json['StatModifiers'] !== undefined ? JSON.stringify(json['StatModifiers'], null, 2) : ''}
              readOnly={readOnly}
              onBlur={(e) => setJson('StatModifiers', e.target.value)}
              style={{ ...TEXTAREA_STYLE, width: '100%', resize: 'vertical', fontSize: 11 }}
              spellCheck={false}
              placeholder='[{ "Stat": "...", "Modifier": 0 }]'
            />
          </div>
        </>
      )}

      {/* ── Extra fields ──────────────────────────────────────────────────── */}
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
