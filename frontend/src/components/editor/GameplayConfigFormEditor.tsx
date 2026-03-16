// GameplayConfigFormEditor.tsx
// Key-section editor for GameplayConfigs (Server/GameplayConfigs/).
// Covers the most practical fields; full config editable via RAW JSON tab.

import type React from 'react'

import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE, TEXTAREA_STYLE } from './formStyles'

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

const GRID2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }
const GRID3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nested(json: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = json[key]
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return {}
}

function setNested(
  json: Record<string, unknown>,
  key: string,
  inner: Record<string, unknown>,
): Record<string, unknown> {
  return { ...json, [key]: inner }
}

function setDeep2(
  json: Record<string, unknown>,
  k1: string,
  k2: string,
  value: unknown,
): Record<string, unknown> {
  const lvl1 = nested(json, k1)
  return setNested(json, k1, { ...lvl1, [k2]: value })
}

function numVal(v: unknown): number | '' {
  return typeof v === 'number' ? v : ''
}

function strVal(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function jsonStr(v: unknown): string {
  if (v === undefined || v === null) return ''
  return JSON.stringify(v, null, 2)
}

function parseJsonOrUndefined(s: string): unknown {
  try { return JSON.parse(s) } catch { return undefined }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function GameplayConfigFormEditor({ json, onChange, readOnly }: Props) {
  const death = nested(json, 'Death')
  const itemEntity = nested(json, 'ItemEntity')
  const world = nested(json, 'World')
  const player = nested(json, 'Player')
  const respawn = nested(json, 'Respawn')
  const ping = nested(json, 'Ping')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* Parent */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Inheritance</div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Parent config ID</label>
          <input
            style={INPUT_STYLE}
            value={strVal(json['Parent'])}
            readOnly={readOnly}
            placeholder="Default"
            onChange={(e) => onChange({ ...json, Parent: e.target.value || undefined })}
          />
        </div>
      </div>

      {/* Death */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Death</div>
        <div style={GRID3}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Items Loss Mode</label>
            <select
              style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer' }}
              value={strVal(death['ItemsLossMode'])}
              disabled={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'Death', 'ItemsLossMode', e.target.value || undefined))}
            >
              <option value="">—</option>
              <option value="None">None</option>
              <option value="Configured">Configured</option>
              <option value="All">All</option>
            </select>
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Item Amount Loss %</label>
            <input
              type="number" step="any" style={INPUT_STYLE}
              value={numVal(death['ItemsAmountLossPercentage'])}
              readOnly={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'Death', 'ItemsAmountLossPercentage', e.target.value === '' ? undefined : Number(e.target.value)))}
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Durability Loss %</label>
            <input
              type="number" step="any" style={INPUT_STYLE}
              value={numVal(death['ItemsDurabilityLossPercentage'])}
              readOnly={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'Death', 'ItemsDurabilityLossPercentage', e.target.value === '' ? undefined : Number(e.target.value)))}
            />
          </div>
        </div>
      </div>

      {/* World */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>World</div>
        <div style={GRID2}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Daytime Duration (s)</label>
            <input
              type="number" step="any" style={INPUT_STYLE}
              value={numVal(world['DaytimeDurationSeconds'])}
              readOnly={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'World', 'DaytimeDurationSeconds', e.target.value === '' ? undefined : Number(e.target.value)))}
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Nighttime Duration (s)</label>
            <input
              type="number" step="any" style={INPUT_STYLE}
              value={numVal(world['NighttimeDurationSeconds'])}
              readOnly={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'World', 'NighttimeDurationSeconds', e.target.value === '' ? undefined : Number(e.target.value)))}
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Allow Block Breaking</label>
            <select
              style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer' }}
              value={world['AllowBlockBreaking'] === undefined ? '' : String(world['AllowBlockBreaking'])}
              disabled={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'World', 'AllowBlockBreaking', e.target.value === '' ? undefined : e.target.value === 'true'))}
            >
              <option value="">— inherit —</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Allow Block Placement</label>
            <select
              style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer' }}
              value={world['AllowBlockPlacement'] === undefined ? '' : String(world['AllowBlockPlacement'])}
              disabled={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'World', 'AllowBlockPlacement', e.target.value === '' ? undefined : e.target.value === 'true'))}
            >
              <option value="">— inherit —</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
        </div>
      </div>

      {/* Player */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Player</div>
        <div style={GRID2}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Movement Config ID</label>
            <input
              style={INPUT_STYLE}
              value={strVal(player['MovementConfig'])}
              readOnly={readOnly}
              placeholder="Default"
              onChange={(e) => onChange(setDeep2(json, 'Player', 'MovementConfig', e.target.value || undefined))}
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Armor Visibility Option</label>
            <select
              style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer' }}
              value={strVal(player['ArmorVisibilityOption'])}
              disabled={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'Player', 'ArmorVisibilityOption', e.target.value || undefined))}
            >
              <option value="">—</option>
              <option value="All">All</option>
              <option value="None">None</option>
              <option value="Helmet">Helmet</option>
            </select>
          </div>
        </div>
      </div>

      {/* Item Entity */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Dropped Items</div>
        <div style={GRID2}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Item Entity Lifetime (s)</label>
            <input
              type="number" step="any" style={INPUT_STYLE}
              value={numVal(itemEntity['Lifetime'])}
              readOnly={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'ItemEntity', 'Lifetime', e.target.value === '' ? undefined : Number(e.target.value)))}
            />
          </div>
        </div>
      </div>

      {/* Respawn */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Respawn</div>
        <div style={GRID2}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Radius Limit Respawn Point</label>
            <input
              type="number" step="any" style={INPUT_STYLE}
              value={numVal(respawn['RadiusLimitRespawnPoint'])}
              readOnly={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'Respawn', 'RadiusLimitRespawnPoint', e.target.value === '' ? undefined : Number(e.target.value)))}
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Max Respawn Points / Player</label>
            <input
              type="number" step="1" style={INPUT_STYLE}
              value={numVal(respawn['MaxRespawnPointsPerPlayer'])}
              readOnly={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'Respawn', 'MaxRespawnPointsPerPlayer', e.target.value === '' ? undefined : Number(e.target.value)))}
            />
          </div>
        </div>
      </div>

      {/* Ping */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Ping</div>
        <div style={GRID2}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Ping Duration (s)</label>
            <input type="number" step="any" style={INPUT_STYLE} value={numVal(ping['PingDuration'])} readOnly={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'Ping', 'PingDuration', e.target.value === '' ? undefined : Number(e.target.value)))} />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Ping Cooldown (s)</label>
            <input type="number" step="any" style={INPUT_STYLE} value={numVal(ping['PingCooldown'])} readOnly={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'Ping', 'PingCooldown', e.target.value === '' ? undefined : Number(e.target.value)))} />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Broadcast Radius</label>
            <input type="number" step="any" style={INPUT_STYLE} value={numVal(ping['PingBroadcastRadius'])} readOnly={readOnly}
              onChange={(e) => onChange(setDeep2(json, 'Ping', 'PingBroadcastRadius', e.target.value === '' ? undefined : Number(e.target.value)))} />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Ping Sound Event ID</label>
            <input style={INPUT_STYLE} value={strVal(ping['PingSound'])} readOnly={readOnly} placeholder="SFX_Ping"
              onChange={(e) => onChange(setDeep2(json, 'Ping', 'PingSound', e.target.value || undefined))} />
          </div>
        </div>
      </div>

      {/* Plugin — raw fallback */}
      {json['Plugin'] !== undefined && (
        <div style={SECTION_STYLE}>
          <div style={SECTION_TITLE_STYLE}>Plugin (JSON)</div>
          <textarea
            style={{ ...TEXTAREA_STYLE, minHeight: 120 }}
            value={jsonStr(json['Plugin'])}
            readOnly={readOnly}
            onChange={(e) => {
              const v = parseJsonOrUndefined(e.target.value)
              if (v !== undefined) onChange({ ...json, Plugin: v })
            }}
          />
        </div>
      )}

    </div>
  )
}
