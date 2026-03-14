import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'

import { getColorForGroup, getColorForEdgeType } from './colors'
import type { BlueprintNodeData } from './blueprintTypes'

type Props = {
  data: BlueprintNodeData
}

const NEW_BORDER_COLOR = '#36c275'
const OVERRIDE_BORDER_COLOR = '#ffb347'
const SELECTED_BORDER_COLOR = '#00D4FF'
const SELECTED_GLOW = '0 0 0 2px #00D4FF55, 0 0 12px #00D4FF44'

function areOutgoingDepsEqual(a: BlueprintNodeData['outgoing'], b: BlueprintNodeData['outgoing']): boolean {
  if (a === b) return true
  if (!a || !b) return !a && !b
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]
    const right = b[i]
    if (
      left.edgeLabel !== right.edgeLabel ||
      left.targetId !== right.targetId ||
      left.targetLabel !== right.targetLabel ||
      left.targetGroup !== right.targetGroup
    ) {
      return false
    }
  }
  return true
}

function arePropsEqual(prev: Props, next: Props): boolean {
  const left = prev.data
  const right = next.data
  return (
    left.label === right.label &&
    left.group === right.group &&
    left.path === right.path &&
    left.isModified === right.isModified &&
    left.isRoot === right.isRoot &&
    left.modificationKind === right.modificationKind &&
    left.isSelected === right.isSelected &&
    left.isConnected === right.isConnected &&
    left.nodeId === right.nodeId &&
    left.onSelectNode === right.onSelectNode &&
    areOutgoingDepsEqual(left.outgoing, right.outgoing)
  )
}

const BlueprintNodeComponent = ({ data }: Props) => {
  const typeColor = getColorForGroup(data.group)
  const modificationBadge = data.modificationKind === 'new'
    ? { label: 'NEW', title: 'Asset present only in the current project', color: '#dff8ea', background: NEW_BORDER_COLOR }
    : data.modificationKind === 'override'
      ? { label: 'OVR', title: 'Asset ID already exists in a lower layer', color: '#2b1800', background: OVERRIDE_BORDER_COLOR }
      : data.isModified
        ? { label: 'LOCAL', title: 'Project-local asset', color: '#111', background: '#8aa4b8' }
        : null

  const selected = data.isSelected
  const connected = data.isConnected
  const borderWidth = data.isRoot || selected ? 3 : 2
  const borderColor = selected ? SELECTED_BORDER_COLOR : typeColor

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
        boxShadow: selected ? SELECTED_GLOW : data.isRoot ? `0 0 0 1px ${typeColor}66` : connected ? '0 0 0 1px #00D4FF33' : undefined,
        contain: 'layout paint style',
        contentVisibility: 'auto',
        containIntrinsicSize: '300px 180px',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#555', width: 8, height: 8, border: '2px solid #222' }} />

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
          {modificationBadge && (
            <span
              style={{ fontSize: 9, background: modificationBadge.background, color: modificationBadge.color, padding: '1px 4px', borderRadius: 3, fontWeight: 'bold' }}
              title={modificationBadge.title}
            >
              {modificationBadge.label}
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
            contain: 'layout paint style',
          }}
        >
          <div style={{ padding: '2px 10px 3px', fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
            Dépendances
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto', contain: 'layout paint style' }}>
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

export const BlueprintNode = memo(BlueprintNodeComponent, arePropsEqual)
