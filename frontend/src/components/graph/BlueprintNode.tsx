import { Handle, Position } from '@xyflow/react'

import { getColorForGroup } from './colors'

type BlueprintNodeData = {
  label: string
  group: string
  isModified?: boolean
  isRoot?: boolean
}

type Props = {
  data: BlueprintNodeData
}

export const BlueprintNode = ({ data }: Props) => {
  const typeColor = getColorForGroup(data.group)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 220,
        backgroundColor: '#1e1e1e',
        borderRadius: 6,
        border: `2px solid ${typeColor}`,
        overflow: 'hidden',
        color: '#fff',
        fontFamily: 'monospace',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#555', width: 8, height: 8, border: '2px solid #222' }} />

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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{data.group}</span>
          {data.isModified && (
            <span
              style={{
                fontSize: 10,
                background: '#ffaa00',
                color: '#000',
                padding: '2px 4px',
                borderRadius: 4,
                fontWeight: 'bold',
              }}
              title="Overridden / Modified"
            >
              OVERRIDE
            </span>
          )}
        </div>
        {data.isRoot && (
          <span style={{ fontSize: 10, background: '#111', color: typeColor, padding: '2px 5px', borderRadius: 4 }}>
            ROOT
          </span>
        )}
      </div>

      <div style={{ padding: '12px 10px', wordBreak: 'break-word', fontSize: 13, borderBottom: '1px solid #333' }}>{data.label}</div>

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}
