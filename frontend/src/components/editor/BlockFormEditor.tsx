import type React from 'react'

import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE, TEXTAREA_STYLE } from './formStyles'

// ─── Types ────────────────────────────────────────────────────────────────────

type Texture = {
  All?: string
  Top?: string
  Bottom?: string
  Side?: string
  Weight?: number
  [key: string]: unknown
}

type Breaking = {
  GatherType?: string
  ItemId?: string
  [key: string]: unknown
}

type Gathering = {
  Breaking?: Breaking
  [key: string]: unknown
}

type BlockType = {
  Material?: string
  DrawType?: string
  Group?: string
  Flags?: Record<string, unknown>
  Gathering?: Gathering
  BlockParticleSetId?: string
  Textures?: Texture[]
  ParticleColor?: string
  BlockSoundSetId?: string
  Aliases?: string[]
  BlockBreakingDecalId?: string
  CustomModel?: string
  VariantRotation?: string
  [key: string]: unknown
}

type ResourceType = {
  Id?: string
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

const GRID2_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
}

const TEXTURE_ROW_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 72px 28px',
  gap: 6,
  alignItems: 'end',
  marginBottom: 6,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asBlockType(v: unknown): BlockType {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as BlockType
  return {}
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => typeof x === 'string') as string[]
}

function asTextureArray(v: unknown): Texture[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => x && typeof x === 'object') as Texture[]
}

function asResourceTypeArray(v: unknown): ResourceType[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => x && typeof x === 'object') as ResourceType[]
}

function asTranslationProps(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return {}
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

// ─── Textures editor ──────────────────────────────────────────────────────────

type TexturesEditorProps = {
  textures: Texture[]
  onChange: (updated: Texture[]) => void
  readOnly: boolean
}

function TexturesEditor({ textures, onChange, readOnly }: TexturesEditorProps) {
  function update(i: number, patch: Partial<Texture>): void {
    const next = deepClone(textures)
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  function remove(i: number): void {
    const next = deepClone(textures)
    next.splice(i, 1)
    onChange(next)
  }

  return (
    <div>
      {textures.map((tex, i) => (
        <div key={i} style={TEXTURE_ROW_STYLE}>
          <div>
            {i === 0 && <label style={{ ...LABEL_STYLE, marginBottom: 3 }}>Path (All/Top/…)</label>}
            <input
              style={INPUT_STYLE}
              value={(tex.All ?? tex.Top ?? tex.Side ?? '') as string}
              readOnly={readOnly}
              placeholder="BlockTextures/..."
              onChange={(e) => update(i, { All: e.target.value })}
            />
          </div>
          <div>
            {i === 0 && <label style={{ ...LABEL_STYLE, marginBottom: 3 }}>Weight</label>}
            <input
              type="number"
              style={INPUT_STYLE}
              value={tex.Weight ?? ''}
              readOnly={readOnly}
              onChange={(e) => update(i, { Weight: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            {!readOnly && (
              <button style={BTN_DANGER} onClick={() => remove(i)}>✕</button>
            )}
          </div>
        </div>
      ))}
      {!readOnly && (
        <button
          style={BTN_STYLE}
          onClick={() => onChange([...textures, { All: '', Weight: 1 }])}
        >
          + Add texture
        </button>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function BlockFormEditor({ json, onChange, readOnly }: Props) {
  const translationProps = asTranslationProps(json['TranslationProperties'])
  const blockType = asBlockType(json['BlockType'])
  const gathering = blockType.Gathering ?? {}
  const breaking = (gathering.Breaking ?? {}) as Breaking
  const textures = asTextureArray(blockType.Textures)
  const aliases = asStringArray(blockType.Aliases)
  const resourceTypes = asResourceTypeArray(json['ResourceTypes'])

  // ── Setters ──

  function setTop(key: string, value: unknown): void {
    onChange({ ...json, [key]: value })
  }

  function setTranslation(key: string, value: string): void {
    setTop('TranslationProperties', { ...translationProps, [key]: value })
  }

  function patchBlockType(patch: Partial<BlockType>): void {
    setTop('BlockType', { ...blockType, ...patch })
  }

  function setBreaking(patch: Partial<Breaking>): void {
    patchBlockType({
      Gathering: { ...gathering, Breaking: { ...breaking, ...patch } },
    })
  }

  function setAliases(list: string[]): void {
    patchBlockType({ Aliases: list })
  }

  function setResourceTypes(list: ResourceType[]): void {
    setTop('ResourceTypes', list)
  }

  // ── Complex fallback (raw JSON) ──

  const hasFlags = blockType.Flags && Object.keys(blockType.Flags).length > 0
  const hasRTP = 'RandomTickProcedure' in blockType
  const hasCBRS = 'ConnectedBlockRuleSet' in blockType
  const hasComplexRaw = hasFlags || hasRTP || hasCBRS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* ── Identity ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Identity</div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Name (translation key)</label>
          <input
            style={INPUT_STYLE}
            value={(translationProps['Name'] as string) ?? ''}
            readOnly={readOnly}
            placeholder="server.items.MyBlock.name"
            onChange={(e) => setTranslation('Name', e.target.value)}
          />
        </div>
        <div style={GRID2_STYLE}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Item Level</label>
            <input
              type="number"
              style={INPUT_STYLE}
              value={(json['ItemLevel'] as number) ?? ''}
              readOnly={readOnly}
              onChange={(e) => setTop('ItemLevel', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Max Stack</label>
            <input
              type="number"
              style={INPUT_STYLE}
              value={(json['MaxStack'] as number) ?? ''}
              readOnly={readOnly}
              onChange={(e) => setTop('MaxStack', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </div>
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Icon</label>
          <input
            style={INPUT_STYLE}
            value={(json['Icon'] as string) ?? ''}
            readOnly={readOnly}
            placeholder="Icons/ItemsGenerated/MyBlock.png"
            onChange={(e) => setTop('Icon', e.target.value)}
          />
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Set</label>
          <input
            style={INPUT_STYLE}
            value={(json['Set'] as string) ?? ''}
            readOnly={readOnly}
            placeholder="e.g. Rock_Stone"
            onChange={(e) => setTop('Set', e.target.value)}
          />
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Categories (CSV)</label>
          <input
            style={INPUT_STYLE}
            value={asStringArray(json['Categories']).join(', ')}
            readOnly={readOnly}
            placeholder="Blocks.Rocks, ..."
            onChange={(e) =>
              setTop('Categories', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
            }
          />
        </div>
      </div>

      {/* ── BlockType ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Block Type</div>
        <div style={GRID2_STYLE}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Material</label>
            <select
              style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer' }}
              value={blockType.Material ?? ''}
              disabled={readOnly}
              onChange={(e) => patchBlockType({ Material: e.target.value })}
            >
              <option value="">— select —</option>
              <option value="Solid">Solid</option>
              <option value="Liquid">Liquid</option>
              <option value="Air">Air</option>
              <option value="Foliage">Foliage</option>
            </select>
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Draw Type</label>
            <select
              style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer' }}
              value={blockType.DrawType ?? ''}
              disabled={readOnly}
              onChange={(e) => patchBlockType({ DrawType: e.target.value })}
            >
              <option value="">— select —</option>
              <option value="Cube">Cube</option>
              <option value="Model">Model</option>
              <option value="Billboard">Billboard</option>
              <option value="Cross">Cross</option>
              <option value="None">None</option>
            </select>
          </div>
        </div>
        <div style={GRID2_STYLE}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Group</label>
            <input
              style={INPUT_STYLE}
              value={blockType.Group ?? ''}
              readOnly={readOnly}
              placeholder="e.g. Stone"
              onChange={(e) => patchBlockType({ Group: e.target.value })}
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Variant Rotation</label>
            <input
              style={INPUT_STYLE}
              value={blockType.VariantRotation ?? ''}
              readOnly={readOnly}
              placeholder="e.g. NESW"
              onChange={(e) => patchBlockType({ VariantRotation: e.target.value || undefined })}
            />
          </div>
        </div>

        {/* Model-specific */}
        {blockType.DrawType === 'Model' && (
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Custom Model</label>
            <input
              style={INPUT_STYLE}
              value={blockType.CustomModel ?? ''}
              readOnly={readOnly}
              placeholder="Blocks/MyBlock/Block.blockymodel"
              onChange={(e) => patchBlockType({ CustomModel: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* ── Textures ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Textures ({textures.length})</div>
        <TexturesEditor
          textures={textures}
          onChange={(updated) => patchBlockType({ Textures: updated })}
          readOnly={readOnly}
        />
      </div>

      {/* ── Sound & Particles ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Sound & Particles</div>
        <div style={GRID2_STYLE}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Block Sound Set</label>
            <input
              style={INPUT_STYLE}
              value={blockType.BlockSoundSetId ?? ''}
              readOnly={readOnly}
              placeholder="e.g. Stone"
              onChange={(e) => patchBlockType({ BlockSoundSetId: e.target.value })}
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Item Sound Set</label>
            <input
              style={INPUT_STYLE}
              value={(json['ItemSoundSetId'] as string) ?? ''}
              readOnly={readOnly}
              placeholder="e.g. ISS_Blocks_Stone"
              onChange={(e) => setTop('ItemSoundSetId', e.target.value)}
            />
          </div>
        </div>
        <div style={GRID2_STYLE}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Block Particle Set</label>
            <input
              style={INPUT_STYLE}
              value={blockType.BlockParticleSetId ?? ''}
              readOnly={readOnly}
              placeholder="e.g. Stone"
              onChange={(e) => patchBlockType({ BlockParticleSetId: e.target.value })}
            />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Particle Color</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="color"
                style={{ width: 32, height: 28, padding: 0, border: 'none', background: 'none', cursor: readOnly ? 'default' : 'pointer' }}
                value={blockType.ParticleColor ?? '#737055'}
                disabled={readOnly}
                onChange={(e) => patchBlockType({ ParticleColor: e.target.value })}
              />
              <input
                style={{ ...INPUT_STYLE, flex: 1 }}
                value={blockType.ParticleColor ?? ''}
                readOnly={readOnly}
                placeholder="#737055"
                onChange={(e) => patchBlockType({ ParticleColor: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Block Breaking Decal</label>
          <input
            style={INPUT_STYLE}
            value={blockType.BlockBreakingDecalId ?? ''}
            readOnly={readOnly}
            placeholder="e.g. Breaking_Decals_Rock"
            onChange={(e) => patchBlockType({ BlockBreakingDecalId: e.target.value })}
          />
        </div>
      </div>

      {/* ── Gathering ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Gathering</div>
        <div style={GRID2_STYLE}>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Gather Type</label>
            <select
              style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer' }}
              value={breaking.GatherType ?? ''}
              disabled={readOnly}
              onChange={(e) => setBreaking({ GatherType: e.target.value || undefined })}
            >
              <option value="">— select —</option>
              <option value="Rocks">Rocks (pickaxe)</option>
              <option value="Woods">Woods (axe)</option>
              <option value="SoftBlocks">SoftBlocks (hands)</option>
              <option value="Unbreakable">Unbreakable</option>
            </select>
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL_STYLE}>Drop Item ID</label>
            <input
              style={INPUT_STYLE}
              value={breaking.ItemId ?? ''}
              readOnly={readOnly}
              placeholder="e.g. Rock_Stone_Cobble"
              onChange={(e) => setBreaking({ ItemId: e.target.value || undefined })}
            />
          </div>
        </div>
      </div>

      {/* ── Aliases ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Aliases</div>
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Alias IDs (CSV)</label>
          <input
            style={INPUT_STYLE}
            value={aliases.join(', ')}
            readOnly={readOnly}
            placeholder="stone, stone00"
            onChange={(e) =>
              setAliases(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
            }
          />
        </div>
      </div>

      {/* ── Resource Types ── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Resource Types</div>
        {resourceTypes.map((rt, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <input
              style={{ ...INPUT_STYLE, flex: 1 }}
              value={rt.Id ?? ''}
              readOnly={readOnly}
              placeholder="e.g. Rock"
              onChange={(e) => {
                const next = deepClone(resourceTypes)
                next[i] = { ...next[i], Id: e.target.value }
                setResourceTypes(next)
              }}
            />
            {!readOnly && (
              <button
                style={BTN_DANGER}
                onClick={() => {
                  const next = deepClone(resourceTypes)
                  next.splice(i, 1)
                  setResourceTypes(next)
                }}
              >✕</button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button style={BTN_STYLE} onClick={() => setResourceTypes([...resourceTypes, { Id: '' }])}>
            + Add resource type
          </button>
        )}
      </div>

      {/* ── Complex fields (raw JSON fallback) ── */}
      {hasComplexRaw && (
        <div style={SECTION_STYLE}>
          <div style={SECTION_TITLE_STYLE}>Advanced (raw JSON)</div>
          {hasFlags && (
            <div style={FIELD_WRAP}>
              <label style={LABEL_STYLE}>Flags</label>
              <textarea
                style={{ ...TEXTAREA_STYLE, minHeight: 60 }}
                value={JSON.stringify(blockType.Flags ?? {}, null, 2)}
                readOnly={readOnly}
                onChange={(e) => {
                  try { patchBlockType({ Flags: JSON.parse(e.target.value) }) } catch { /* ignore */ }
                }}
              />
            </div>
          )}
          {hasRTP && (
            <div style={FIELD_WRAP}>
              <label style={LABEL_STYLE}>RandomTickProcedure</label>
              <textarea
                style={{ ...TEXTAREA_STYLE, minHeight: 80 }}
                value={JSON.stringify(blockType['RandomTickProcedure'] ?? {}, null, 2)}
                readOnly={readOnly}
                onChange={(e) => {
                  try { patchBlockType({ RandomTickProcedure: JSON.parse(e.target.value) }) } catch { /* ignore */ }
                }}
              />
            </div>
          )}
          {hasCBRS && (
            <div style={FIELD_WRAP}>
              <label style={LABEL_STYLE}>ConnectedBlockRuleSet</label>
              <textarea
                style={{ ...TEXTAREA_STYLE, minHeight: 80 }}
                value={JSON.stringify(blockType['ConnectedBlockRuleSet'] ?? {}, null, 2)}
                readOnly={readOnly}
                onChange={(e) => {
                  try { patchBlockType({ ConnectedBlockRuleSet: JSON.parse(e.target.value) }) } catch { /* ignore */ }
                }}
              />
            </div>
          )}
        </div>
      )}

    </div>
  )
}
