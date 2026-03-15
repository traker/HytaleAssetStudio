import type React from 'react'

import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE } from './formStyles'

type Props = {
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly: boolean
}

const SECTION_STYLE: React.CSSProperties = {
  marginBottom: 14,
  padding: '12px 12px 4px',
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

const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
}

const CHECKBOX_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 33,
}

function getString(json: Record<string, unknown>, key: string): string {
  const value = json[key]
  return typeof value === 'string' ? value : ''
}

function getNumberString(json: Record<string, unknown>, key: string): string {
  const value = json[key]
  return typeof value === 'number' ? String(value) : ''
}

function getBoolean(json: Record<string, unknown>, key: string): boolean {
  return json[key] === true
}

function getNestedString(json: Record<string, unknown>, parentKey: string, childKey: string): string {
  const parent = json[parentKey]
  if (!parent || typeof parent !== 'object' || Array.isArray(parent)) return ''
  const value = (parent as Record<string, unknown>)[childKey]
  return typeof value === 'string' ? value : ''
}

function setValue(json: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  const next = { ...json }
  if (value === undefined || value === '') delete next[key]
  else next[key] = value
  return next
}

function setNestedValue(
  json: Record<string, unknown>,
  parentKey: string,
  childKey: string,
  value: unknown,
): Record<string, unknown> {
  const parent = json[parentKey]
  const parentObject = parent && typeof parent === 'object' && !Array.isArray(parent)
    ? { ...(parent as Record<string, unknown>) }
    : {}

  if (value === undefined || value === '') delete parentObject[childKey]
  else parentObject[childKey] = value

  const next = { ...json }
  if (Object.keys(parentObject).length === 0) delete next[parentKey]
  else next[parentKey] = parentObject
  return next
}

export function QualityFormEditor({ json, onChange, readOnly }: Props) {
  return (
    <div>
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Tier</div>
        <div style={GRID_STYLE}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Quality Value</label>
            <input
              type="number"
              value={getNumberString(json, 'QualityValue')}
              onChange={(event) => {
                const raw = event.target.value.trim()
                onChange(setValue(json, 'QualityValue', raw === '' ? undefined : parseInt(raw, 10)))
              }}
              readOnly={readOnly}
              style={INPUT_STYLE}
              placeholder="2"
            />
          </div>

          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Text Color</label>
            <input
              type="text"
              value={getString(json, 'TextColor')}
              onChange={(event) => onChange(setValue(json, 'TextColor', event.target.value || undefined))}
              readOnly={readOnly}
              style={INPUT_STYLE}
              placeholder="#3e9049"
            />
          </div>

          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Localization Key</label>
            <input
              type="text"
              value={getString(json, 'LocalizationKey')}
              onChange={(event) => onChange(setValue(json, 'LocalizationKey', event.target.value || undefined))}
              readOnly={readOnly}
              style={INPUT_STYLE}
              placeholder="server.general.qualities.Uncommon"
            />
          </div>
        </div>
      </div>

      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Tooltip And Slots</div>
        <div style={GRID_STYLE}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Item Tooltip Texture</label>
            <input
              type="text"
              value={getString(json, 'ItemTooltipTexture')}
              onChange={(event) => onChange(setValue(json, 'ItemTooltipTexture', event.target.value || undefined))}
              readOnly={readOnly}
              style={INPUT_STYLE}
              placeholder="UI/ItemQualities/Tooltips/ItemTooltipUncommon.png"
            />
          </div>

          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Tooltip Arrow Texture</label>
            <input
              type="text"
              value={getString(json, 'ItemTooltipArrowTexture')}
              onChange={(event) => onChange(setValue(json, 'ItemTooltipArrowTexture', event.target.value || undefined))}
              readOnly={readOnly}
              style={INPUT_STYLE}
              placeholder="UI/ItemQualities/Tooltips/ItemTooltipUncommonArrow.png"
            />
          </div>

          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Slot Texture</label>
            <input
              type="text"
              value={getString(json, 'SlotTexture')}
              onChange={(event) => onChange(setValue(json, 'SlotTexture', event.target.value || undefined))}
              readOnly={readOnly}
              style={INPUT_STYLE}
              placeholder="UI/ItemQualities/Slots/SlotUncommon.png"
            />
          </div>

          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Block Slot Texture</label>
            <input
              type="text"
              value={getString(json, 'BlockSlotTexture')}
              onChange={(event) => onChange(setValue(json, 'BlockSlotTexture', event.target.value || undefined))}
              readOnly={readOnly}
              style={INPUT_STYLE}
              placeholder="UI/ItemQualities/Slots/SlotUncommon.png"
            />
          </div>

          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Special Slot Texture</label>
            <input
              type="text"
              value={getString(json, 'SpecialSlotTexture')}
              onChange={(event) => onChange(setValue(json, 'SpecialSlotTexture', event.target.value || undefined))}
              readOnly={readOnly}
              style={INPUT_STYLE}
              placeholder="UI/ItemQualities/Slots/SlotUncommon.png"
            />
          </div>
        </div>
      </div>

      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Display</div>
        <div style={GRID_STYLE}>
          <label style={CHECKBOX_ROW_STYLE}>
            <input
              type="checkbox"
              checked={getBoolean(json, 'VisibleQualityLabel')}
              onChange={(event) => onChange(setValue(json, 'VisibleQualityLabel', event.target.checked ? true : undefined))}
              disabled={readOnly}
            />
            <span style={LABEL_STYLE}>Visible Quality Label</span>
          </label>

          <label style={CHECKBOX_ROW_STYLE}>
            <input
              type="checkbox"
              checked={getBoolean(json, 'RenderSpecialSlot')}
              onChange={(event) => onChange(setValue(json, 'RenderSpecialSlot', event.target.checked ? true : undefined))}
              disabled={readOnly}
            />
            <span style={LABEL_STYLE}>Render Special Slot</span>
          </label>

          <label style={CHECKBOX_ROW_STYLE}>
            <input
              type="checkbox"
              checked={getBoolean(json, 'HideFromSearch')}
              onChange={(event) => onChange(setValue(json, 'HideFromSearch', event.target.checked ? true : undefined))}
              disabled={readOnly}
            />
            <span style={LABEL_STYLE}>Hide From Search</span>
          </label>
        </div>
      </div>

      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Drop Effect</div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Item Entity Particle System Id</label>
          <input
            type="text"
            value={getNestedString(json, 'ItemEntityConfig', 'ParticleSystemId')}
            onChange={(event) => onChange(setNestedValue(json, 'ItemEntityConfig', 'ParticleSystemId', event.target.value || undefined))}
            readOnly={readOnly}
            style={INPUT_STYLE}
            placeholder="Drop_Uncommon"
          />
        </div>
      </div>
    </div>
  )
}