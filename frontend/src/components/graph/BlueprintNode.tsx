import { Handle, Position } from '@xyflow/react'

import { getColorForGroup, getColorForEdgeType } from './colors'

export type OutgoingDep = {
  edgeLabel: string
  targetId: string
  targetLabel: string
  targetGroup: string
}

export type BlueprintNodeData = {
  label: string
  group: string
  path?: string
  isModified?: boolean
  isRoot?: boolean
  isSelected?: boolean
  isConnected?: boolean
  outgoing?: OutgoingDep[]
  nodeId?: string
  onSelectNode?: (sourceId: string, targetId: string) => void
}

type Props = {
  data: BlueprintNodeData
}

const ROOT_BORDER_COLOR = '#FF9500'
const SELECTED_BORDER_COLOR = '#00D4FF'
const SELECTED_GLOW = '0 0 0 2px #00D4FF55, 0 0 12px #00D4FF44'

export const BlueprintNode = ({ data }: Props) => {
  const typeColor = getColorForGroup(data.group)

  const selected = data.isSelected
  const connected = data.isConnected
  const borderColor = data.isRoot
    ? ROOT_BORDER_COLOR
    : selected
      ? SELECTED_BORDER_COLOR
      : connected
        ? '#00D4FF66'
        : typeColor
  const borderWidth = data.isRoot || selected ? 3 : connected ? 2 : 2
  const boxShadow = selected ? SELECTED_GLOW : connected ? '0 0 0 1px #00D4FF33' : undefined

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 230,
        maxWidth: 300,
        backgroundColor: '#1a1a1a',
        borderRadius: 6,
        border: `${borderWidth}px solid ${borderColor}`,
        overflow: 'hidden',
        color: '#fff',
        fontFamily: 'monospace',
        boxShadow,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#555', width: 8, height: 8, border: '2px solid #222' }} />

      {/* ── Header ── */}
      <div
        style={{
          backgroundColor: data.isRoot ? ROOT_BORDER_COLOR : typeColor,
          color: '#111',
          padding: '5px 8px',
          fontSize: 10,
          fontWeight: 'bold',
          textTransform: 'uppercase',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {data.isRoot && (
            <span style={{ fontSize: 9, background: '#00000033', padding: '1px 4px', borderRadius: 3, fontWeight: 'bold' }}>
              ROOT
            </span>
          )}
          <span>{data.group}</span>
          {data.isModified && (
            <span
              style={{ fontSize: 9, background: '#ffaa00', color: '#000', padding: '1px 4px', borderRadius: 3, fontWeight: 'bold' }}
              title="Overridden / Modified"
            >
              OVERRIDE
            </span>
          )}
        </div>
      </div>

      {/* ── Label ── */}
      <div style={{ padding: '8px 10px 6px', wordBreak: 'break-word', fontSize: 13, fontWeight: 600 }}>{data.label}</div>

      {/* ── Path ── */}
      {data.path && (
        <div
          style={{
            padding: '0 10px 6px',
            fontSize: 10,
            color: '#666',
            wordBreak: 'break-all',
          }}
          title={data.path}
        >
          {data.path.replace(/\\/g, '/').replace(/^(Server|Common)\//, '')}
        </div>
      )}

      {/* ── Dependencies ── */}
      {data.outgoing && data.outgoing.length > 0 && (
        <div
          style={{
            borderTop: '1px solid #2e2e2e',
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          <div style={{ padding: '2px 10px 3px', fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
            Dépendances
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {data.outgoing.map((dep, i) => {
              const depColor = getColorForGroup(dep.targetGroup)
              const edgeColor = getColorForEdgeType(dep.edgeLabel)
              return (
                <div
                  key={`${dep.targetId}-${i}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    data.onSelectNode?.(data.nodeId ?? '', dep.targetId)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 10px',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: '#ccc',
                    borderRadius: 3,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  title={dep.targetId}
                >
                  {/* group dot */}
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: depColor,
                      flexShrink: 0,
                    }}
                  />
                  {/* target name */}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {dep.targetLabel}
                  </span>
                  {/* edge type badge */}
                  <span
                    style={{
                      fontSize: 9,
                      padding: '1px 4px',
                      borderRadius: 3,
                      background: edgeColor + '33',
                      color: edgeColor,
                      fontWeight: 'bold',
                      flexShrink: 0,
                    }}
                  >
                    {dep.edgeLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: '#555', width: 8, height: 8, border: '2px solid #222' }} />
    </div>
  )
}
