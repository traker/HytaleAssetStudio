import { Handle, Position } from '@xyflow/react'

import { getColorForGroup } from './colors'

export type InteractionNodeData = {
  label: string
  nodeType: string
  isExternal: boolean
  rawFields?: Record<string, unknown>
}

type Props = {
  data: InteractionNodeData
}

export function InteractionNode({ data }: Props) {
  const typeColor = getColorForGroup(data.isExternal ? 'json_data' : 'interaction')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 260,
        backgroundColor: '#1e1e1e',
        borderRadius: 6,
        border: `2px solid ${typeColor}`,
        overflow: 'hidden',
        color: '#fff',
        fontFamily: 'monospace',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555', width: 8, height: 8, border: '2px solid #222' }} />

      <div
        style={{
          backgroundColor: typeColor,
          color: '#111',
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 'bold',
          textTransform: 'uppercase',
          borderBottom: `1px solid ${typeColor}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.nodeType}</span>
        {data.isExternal && (
          <span
            style={{
              fontSize: 10,
              background: '#111',
              color: typeColor,
              padding: '2px 5px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
            }}
            title="External interaction reference"
          >
            EXTERNAL
          </span>
        )}
      </div>

      <div style={{ padding: '10px 10px', wordBreak: 'break-word', fontSize: 13 }}>{data.label}</div>

      <Handle id="failed" type="source" position={Position.Left} style={{ background: '#555', width: 8, height: 8, border: '2px solid #222' }} />
      <Handle id="next" type="source" position={Position.Right} style={{ background: '#555', width: 8, height: 8, border: '2px solid #222' }} />
      <Handle id="child" type="source" position={Position.Bottom} style={{ background: '#555', width: 8, height: 8, border: '2px solid #222' }} />
    </div>
  )
}
