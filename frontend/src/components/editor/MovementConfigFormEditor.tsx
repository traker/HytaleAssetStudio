// MovementConfigFormEditor.tsx
// Sectioned numeric editor for movement configs (Server/Entity/MovementConfig/).

import type React from 'react'

import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE } from './formStyles'

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

type NumFieldProps = {
  label: string
  field: string
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly: boolean
  step?: string
}

function NumField({ label, field, json, onChange, readOnly, step = 'any' }: NumFieldProps) {
  const val = typeof json[field] === 'number' ? json[field] : ''
  return (
    <div style={FIELD_WRAP}>
      <label style={LABEL_STYLE}>{label}</label>
      <input
        type="number"
        step={step}
        style={INPUT_STYLE}
        value={val as number | ''}
        readOnly={readOnly}
        onChange={(e) => onChange({ ...json, [field]: e.target.value === '' ? undefined : Number(e.target.value) })}
      />
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function MovementConfigFormEditor({ json, onChange, readOnly }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* Base */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Base</div>
        <div style={GRID3}>
          <NumField label="Base Speed" field="BaseSpeed" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Acceleration" field="Acceleration" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Velocity Resistance" field="VelocityResistance" json={json} onChange={onChange} readOnly={readOnly} />
        </div>
      </div>

      {/* Jump */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Jump</div>
        <div style={GRID3}>
          <NumField label="Jump Force" field="JumpForce" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Swim Jump Force" field="SwimJumpForce" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Fall Jump Force" field="FallJumpForce" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Jump Buffer Duration" field="JumpBufferDuration" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Jump Buffer Max Y Vel." field="JumpBufferMaxYVelocity" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Variable Jump Fall Force" field="VariableJumpFallForce" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Fall Momentum Loss" field="FallMomentumLoss" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Fall Effect Duration" field="FallEffectDuration" json={json} onChange={onChange} readOnly={readOnly} />
        </div>
      </div>

      {/* Speed multipliers */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Speed Multipliers</div>
        <div style={{ marginBottom: 6 }}>
          <label style={{ ...LABEL_STYLE, fontSize: 10, color: '#5a6280' }}>Walk</label>
          <div style={GRID3}>
            <NumField label="Forward Walk" field="ForwardWalkSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
            <NumField label="Backward Walk" field="BackwardWalkSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
            <NumField label="Strafe Walk" field="StrafeWalkSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
          </div>
        </div>
        <div style={{ marginBottom: 6 }}>
          <label style={{ ...LABEL_STYLE, fontSize: 10, color: '#5a6280' }}>Run</label>
          <div style={GRID3}>
            <NumField label="Forward Run" field="ForwardRunSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
            <NumField label="Backward Run" field="BackwardRunSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
            <NumField label="Strafe Run" field="StrafeRunSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
          </div>
        </div>
        <div style={{ marginBottom: 6 }}>
          <label style={{ ...LABEL_STYLE, fontSize: 10, color: '#5a6280' }}>Crouch</label>
          <div style={GRID3}>
            <NumField label="Forward Crouch" field="ForwardCrouchSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
            <NumField label="Backward Crouch" field="BackwardCrouchSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
            <NumField label="Strafe Crouch" field="StrafeCrouchSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
          </div>
        </div>
        <div style={GRID2}>
          <NumField label="Forward Sprint" field="ForwardSprintSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Combo Air Speed" field="ComboAirSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Max Speed Multiplier" field="MaxSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Min Speed Multiplier" field="MinSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
        </div>
      </div>

      {/* Air control */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Air Control</div>
        <div style={GRID2}>
          <NumField label="Air Drag Min" field="AirDragMin" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Air Drag Max" field="AirDragMax" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Air Drag Min Speed" field="AirDragMinSpeed" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Air Drag Max Speed" field="AirDragMaxSpeed" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Air Friction Min" field="AirFrictionMin" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Air Friction Max" field="AirFrictionMax" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Air Friction Min Speed" field="AirFrictionMinSpeed" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Air Friction Max Speed" field="AirFrictionMaxSpeed" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Air Control Min Speed" field="AirControlMinSpeed" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Air Control Max Speed" field="AirControlMaxSpeed" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Air Control Min Mult." field="AirControlMinMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Air Control Max Mult." field="AirControlMaxMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Air Speed Multiplier" field="AirSpeedMultiplier" json={json} onChange={onChange} readOnly={readOnly} />
        </div>
      </div>

      {/* Climb / Fly */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Climb / Fly</div>
        <div style={GRID2}>
          <NumField label="Climb Speed" field="ClimbSpeed" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Climb Speed Lateral" field="ClimbSpeedLateral" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Climb Up Sprint" field="ClimbUpSprintSpeed" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Climb Down Sprint" field="ClimbDownSprintSpeed" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Horizontal Fly Speed" field="HorizontalFlySpeed" json={json} onChange={onChange} readOnly={readOnly} />
          <NumField label="Vertical Fly Speed" field="VerticalFlySpeed" json={json} onChange={onChange} readOnly={readOnly} />
        </div>
      </div>

    </div>
  )
}
