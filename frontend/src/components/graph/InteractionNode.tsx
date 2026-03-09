import { Handle, Position } from '@xyflow/react'

import { getColorForInteractionType } from './colors'

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

export function InteractionNode({ data }: Props) {
  const typeColor = data.isExternal ? '#9B9B9B' : getColorForInteractionType(data.nodeType)

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
          {data.nodeType}
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
        {data.label}
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

      <Handle
        id="failed"
        type="source"
        position={Position.Left}
        style={{ background: '#FF6B6B', width: 8, height: 8, border: '2px solid #222' }}
        title="failed"
      />
      <Handle
        id="next"
        type="source"
        position={Position.Right}
        style={{ background: '#F4A261', width: 8, height: 8, border: '2px solid #222' }}
        title="next"
      />
      <Handle
        id="child"
        type="source"
        position={Position.Bottom}
        style={{ background: '#74B9FF', width: 8, height: 8, border: '2px solid #222' }}
        title="child/calls"
      />
    </div>
  )
}
