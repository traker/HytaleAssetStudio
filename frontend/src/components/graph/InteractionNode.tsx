import { Handle, Position } from '@xyflow/react'

import { getColorForInteractionType } from './colors'
import { getSchemaForType } from './interactionSchemas'

export type InteractionNodeData = {
  label: string
  nodeType: string
  isExternal: boolean
  isSelected?: boolean
  isConnected?: boolean
  rawFields?: Record<string, unknown>
}

type Props = {
  data: InteractionNodeData
}

const SELECTED_BORDER_COLOR = '#00D4FF'
const SELECTED_GLOW = '0 0 0 2px #00D4FF55, 0 0 12px #00D4FF44'

type HandleSpec = {
  id: string
  position: Position
  style: React.CSSProperties
  title: string
}

const BASE_HANDLE_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  border: '2px solid #222',
}

const HANDLE_SPECS: Record<string, HandleSpec> = {
  failed: {
    id: 'failed',
    position: Position.Left,
    style: { ...BASE_HANDLE_STYLE, background: '#FF6B6B', top: '42%' },
    title: 'failed',
  },
  next: {
    id: 'next',
    position: Position.Right,
    style: { ...BASE_HANDLE_STYLE, background: '#F4A261', top: '32%' },
    title: 'next',
  },
  collisionNext: {
    id: 'collisionNext',
    position: Position.Right,
    style: { ...BASE_HANDLE_STYLE, background: '#96CEB4', top: '55%' },
    title: 'collisionNext',
  },
  groundNext: {
    id: 'groundNext',
    position: Position.Right,
    style: { ...BASE_HANDLE_STYLE, background: '#96CEB4', top: '78%' },
    title: 'groundNext',
  },
  replace: {
    id: 'replace',
    position: Position.Bottom,
    style: { ...BASE_HANDLE_STYLE, background: '#A29BFE', left: '16%' },
    title: 'replace/default value',
  },
  child: {
    id: 'child',
    position: Position.Bottom,
    style: { ...BASE_HANDLE_STYLE, background: '#74B9FF', left: '16%' },
    title: 'child/interactions',
  },
  fork: {
    id: 'fork',
    position: Position.Bottom,
    style: { ...BASE_HANDLE_STYLE, background: '#FFE66D', left: '30%' },
    title: 'fork',
  },
  blocked: {
    id: 'blocked',
    position: Position.Bottom,
    style: { ...BASE_HANDLE_STYLE, background: '#888888', left: '44%' },
    title: 'blocked',
  },
  start: {
    id: 'start',
    position: Position.Bottom,
    style: { ...BASE_HANDLE_STYLE, background: '#7ed6df', left: '58%' },
    title: 'start',
  },
  cancel: {
    id: 'cancel',
    position: Position.Bottom,
    style: { ...BASE_HANDLE_STYLE, background: '#ff7675', left: '72%' },
    title: 'cancel',
  },
  hitBlock: {
    id: 'hitBlock',
    position: Position.Bottom,
    style: { ...BASE_HANDLE_STYLE, background: '#4ECDC4', left: '18%' },
    title: 'hitBlock',
  },
  hitEntity: {
    id: 'hitEntity',
    position: Position.Bottom,
    style: { ...BASE_HANDLE_STYLE, background: '#96CEB4', left: '38%' },
    title: 'hitEntity',
  },
  hitNothing: {
    id: 'hitNothing',
    position: Position.Bottom,
    style: { ...BASE_HANDLE_STYLE, background: '#B2BEC3', left: '58%' },
    title: 'hitNothing',
  },
}

const EDGE_TYPE_ORDER = ['failed', 'next', 'collisionNext', 'groundNext', 'replace', 'child', 'fork', 'blocked', 'start', 'cancel', 'hitBlock', 'hitEntity', 'hitNothing']

const EDGE_TYPE_BY_RAW_FIELD: Record<string, string> = {
  Failed: 'failed',
  Next: 'next',
  CollisionNext: 'collisionNext',
  GroundNext: 'groundNext',
  DefaultValue: 'replace',
  Interactions: 'child',
  ForkInteractions: 'fork',
  BlockedInteractions: 'blocked',
  StartInteraction: 'start',
  CancelInteraction: 'cancel',
  HitBlock: 'hitBlock',
  HitEntity: 'hitEntity',
  HitNothing: 'hitNothing',
}

function getOutgoingHandleIds(data: InteractionNodeData): string[] {
  if (data.nodeType === 'Root') return ['child']
  if (data.isExternal) return []

  const schema = getSchemaForType(data.nodeType)
  const supported = new Set<string>(schema ? Object.values(schema.outgoingEdges) : ['failed', 'next', 'child'])

  const rawFields = data.rawFields ?? {}
  for (const [rawField, edgeType] of Object.entries(EDGE_TYPE_BY_RAW_FIELD)) {
    if (rawField in rawFields) supported.add(edgeType)
  }

  return EDGE_TYPE_ORDER.filter((edgeType) => supported.has(edgeType))
}

export function InteractionNode({ data }: Props) {
  const typeColor = data.isExternal ? '#9B9B9B' : getColorForInteractionType(data.nodeType)
  const outgoingHandleIds = getOutgoingHandleIds(data)

  const borderColor = data.isSelected
    ? SELECTED_BORDER_COLOR
    : data.isConnected
      ? '#00D4FF66'
      : typeColor
  const borderWidth = data.isSelected ? 3 : 2
  const boxShadow = data.isSelected ? SELECTED_GLOW : data.isConnected ? '0 0 0 1px #00D4FF33' : undefined

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 220,
        maxWidth: 280,
        backgroundColor: '#1a1a1a',
        borderRadius: 6,
        border: `${borderWidth}px solid ${borderColor}`,
        overflow: 'hidden',
        color: '#fff',
        fontFamily: 'monospace',
        boxShadow,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555', width: 8, height: 8, border: '2px solid #222' }} />

      {/* ── Header ── */}
      <div
        style={{
          backgroundColor: typeColor,
          color: '#111',
          padding: '5px 8px',
          fontSize: 10,
          fontWeight: 'bold',
          textTransform: 'uppercase',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {data.nodeType === '_ref' ? '↗ ref' : data.nodeType}
        </span>
        {data.isExternal && (
          <span
            style={{
              fontSize: 9,
              background: '#00000033',
              color: '#111',
              padding: '1px 4px',
              borderRadius: 3,
              whiteSpace: 'nowrap',
              fontWeight: 'bold',
            }}
            title="Référence externe"
          >
            EXT
          </span>
        )}
      </div>

      {/* ── Label ── */}
      <div style={{ padding: '8px 10px', wordBreak: 'break-word', fontSize: 13, fontWeight: 600 }}>
        {data.nodeType === '_ref'
          ? String(data.rawFields?.ServerId ?? '(no ID)')
          : data.label}
      </div>

      {/* ── Raw fields preview (top 3 scalar fields) ── */}
      {data.rawFields && !data.isExternal && (() => {
        const entries = Object.entries(data.rawFields)
          .filter(([k, v]) => k !== 'Type' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'))
          .slice(0, 3)
        if (entries.length === 0) return null
        return (
          <div style={{ borderTop: '1px solid #2e2e2e', padding: '4px 10px 6px' }}>
            {entries.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 6, fontSize: 10, color: '#aaa', overflow: 'hidden' }}>
                <span style={{ color: '#666', flexShrink: 0 }}>{k}:</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ccc' }}>
                  {String(v)}
                </span>
              </div>
            ))}
          </div>
        )
      })()}

      {outgoingHandleIds.map((handleId) => {
        const spec = HANDLE_SPECS[handleId]
        if (!spec) return null
        return (
          <Handle
            key={spec.id}
            id={spec.id}
            type="source"
            position={spec.position}
            style={spec.style}
            title={spec.title}
          />
        )
      })}
    </div>
  )
}
