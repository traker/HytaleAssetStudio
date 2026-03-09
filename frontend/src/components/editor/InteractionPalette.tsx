/**
 * InteractionPalette — sidebar panel listing all interaction types.
 * Each chip is draggable; dropping it onto the ReactFlow canvas creates a new node.
 *
 * Usage:
 *   <InteractionPalette />
 *
 * Drag protocol:
 *   onDragStart sets two dataTransfer items:
 *     - "application/interaction-type" → the type string (e.g. "Simple")
 *     - "text/plain" → same value (fallback)
 */

import { useState } from 'react'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  INTERACTION_SCHEMAS,
  type InteractionCategory,
} from '../graph/interactionSchemas'
import { getColorForInteractionType } from '../graph/colors'

const DRAG_MIME = 'application/interaction-type'

const PANEL_STYLE: React.CSSProperties = {
  height: '100%',
  width: 200,
  flexShrink: 0,
  background: 'rgba(22, 22, 30, 0.97)',
  borderRight: '1px solid #333',
  color: '#ddd',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 10,
  userSelect: 'none',
  overflowY: 'hidden',
}

const HEADER_STYLE: React.CSSProperties = {
  padding: '10px 12px 8px',
  borderBottom: '1px solid #333',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#aaa',
  flexShrink: 0,
}

const SCROLL_STYLE: React.CSSProperties = {
  overflowY: 'auto',
  flex: 1,
  padding: '6px 0 16px',
}

const CATEGORY_HEADER_STYLE: React.CSSProperties = {
  padding: '8px 12px 4px',
  fontSize: 9,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#666',
}

function getPaletteChipStyle(color: string, dragging: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '5px 10px 5px 8px',
    margin: '1px 6px',
    borderRadius: 4,
    cursor: 'grab',
    fontSize: 11,
    color: '#ddd',
    background: dragging ? 'rgba(255,255,255,0.08)' : 'transparent',
    border: dragging ? `1px solid ${color}55` : '1px solid transparent',
    transition: 'background 0.1s, border-color 0.1s',
  }
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: `0 0 4px ${color}88`,
      }}
    />
  )
}

export function InteractionPalette() {
  const [draggingType, setDraggingType] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<InteractionCategory>>(new Set())

  const grouped = new Map<InteractionCategory, typeof INTERACTION_SCHEMAS>()
  for (const cat of CATEGORY_ORDER) grouped.set(cat, [])
  for (const schema of INTERACTION_SCHEMAS) {
    grouped.get(schema.category)?.push(schema)
  }

  function toggleCategory(cat: InteractionCategory) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div style={PANEL_STYLE}>
      <div style={HEADER_STYLE}>Palette</div>
      <div style={SCROLL_STYLE}>
        {CATEGORY_ORDER.map((cat) => {
          const schemas = grouped.get(cat) ?? []
          const isCollapsed = collapsed.has(cat)
          return (
            <div key={cat}>
              <div
                style={{
                  ...CATEGORY_HEADER_STYLE,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingRight: 8,
                }}
                onClick={() => toggleCategory(cat)}
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                <span>{CATEGORY_LABELS[cat]}</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>{isCollapsed ? '▶' : '▼'}</span>
              </div>

              {!isCollapsed &&
                schemas.map((schema) => {
                  const color = getColorForInteractionType(schema.type)
                  const isDragging = draggingType === schema.type
                  return (
                    <div
                      key={schema.type}
                      style={getPaletteChipStyle(color, isDragging)}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_MIME, schema.type)
                        e.dataTransfer.setData('text/plain', schema.type)
                        e.dataTransfer.effectAllowed = 'copy'
                        setDraggingType(schema.type)
                      }}
                      onDragEnd={() => setDraggingType(null)}
                      title={`Drag to canvas to create a ${schema.type} node`}
                    >
                      <ColorDot color={color} />
                      <span>{schema.label}</span>
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { DRAG_MIME }
