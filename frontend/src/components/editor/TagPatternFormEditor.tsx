// TagPatternFormEditor.tsx
// Recursive editor for tag pattern trees: Op=Or|And (+ Patterns[]) or Op=Equals (+ Tag)

import type React from 'react'

import { INPUT_STYLE, LABEL_STYLE } from './formStyles'

// ─── Types ────────────────────────────────────────────────────────────────────

type TagPatternNode = {
  Op?: string
  Tag?: string
  Patterns?: TagPatternNode[]
  [key: string]: unknown
}

type Props = {
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly: boolean
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const NODE_STYLE: React.CSSProperties = {
  border: '1px solid #2b2b3f',
  borderRadius: 5,
  padding: '10px 12px',
  marginBottom: 6,
  background: 'rgba(25, 25, 40, 0.55)',
}

const NESTED_NODE_STYLE: React.CSSProperties = {
  border: '1px solid #1e2840',
  borderRadius: 4,
  padding: '8px 10px',
  marginBottom: 6,
  marginLeft: 16,
  background: 'rgba(15, 15, 30, 0.5)',
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  marginBottom: 6,
}

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  width: 100,
  cursor: 'pointer',
  flex: 'none',
}

const BTN_STYLE: React.CSSProperties = {
  fontSize: 11,
  padding: '3px 10px',
  borderRadius: 4,
  border: '1px solid #404467',
  background: '#1a1a2e',
  color: '#aab',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const BTN_DANGER: React.CSSProperties = {
  ...BTN_STYLE,
  padding: '2px 8px',
  fontSize: 10,
  borderColor: '#6b2a2a',
  color: '#f08080',
}

const OP_BADGE: Record<string, React.CSSProperties> = {
  Or: { background: '#6c5ce7', color: '#fff' },
  And: { background: '#00b894', color: '#fff' },
  Equals: { background: '#0984e3', color: '#fff' },
}

function badge(op: string): React.CSSProperties {
  return {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 3,
    padding: '2px 7px',
    marginRight: 6,
    letterSpacing: '0.05em',
    ...(OP_BADGE[op] ?? { background: '#555', color: '#fff' }),
  }
}

const HINT_STYLE: React.CSSProperties = {
  fontSize: 10,
  color: '#45486a',
  marginTop: 2,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function asNode(v: unknown): TagPatternNode {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as TagPatternNode
  return { Op: 'Equals', Tag: '' }
}

function asNodeArray(v: unknown): TagPatternNode[] {
  if (!Array.isArray(v)) return []
  return v.map(asNode)
}

function makeEqualsNode(): TagPatternNode {
  return { Op: 'Equals', Tag: '' }
}

function makeOrNode(): TagPatternNode {
  return { Op: 'Or', Patterns: [makeEqualsNode()] }
}

// ─── Recursive node editor ────────────────────────────────────────────────────

type NodeEditorProps = {
  node: TagPatternNode
  depth: number
  onChange: (updated: TagPatternNode) => void
  onRemove?: () => void
  readOnly: boolean
}

function NodeEditor({ node, depth, onChange, onRemove, readOnly }: NodeEditorProps) {
  const op = node.Op ?? 'Equals'
  const isLogical = op === 'Or' || op === 'And'
  const patterns = asNodeArray(node.Patterns)

  const style = depth === 0 ? NODE_STYLE : NESTED_NODE_STYLE

  function setOp(newOp: string): void {
    if (newOp === 'Equals') {
      onChange({ Op: 'Equals', Tag: node.Tag ?? '' })
    } else {
      // switching to Or/And — keep existing Patterns or start fresh
      onChange({ Op: newOp, Patterns: patterns.length > 0 ? patterns : [makeEqualsNode()] })
    }
  }

  function setTag(tag: string): void {
    onChange({ ...node, Tag: tag })
  }

  function updateChild(i: number, updated: TagPatternNode): void {
    const next = deepClone(patterns)
    next[i] = updated
    onChange({ ...node, Patterns: next })
  }

  function removeChild(i: number): void {
    const next = deepClone(patterns)
    next.splice(i, 1)
    onChange({ ...node, Patterns: next })
  }

  function addEquals(): void {
    onChange({ ...node, Patterns: [...patterns, makeEqualsNode()] })
  }

  function addGroup(): void {
    onChange({ ...node, Patterns: [...patterns, makeOrNode()] })
  }

  return (
    <div style={style}>
      <div style={ROW_STYLE}>
        {!readOnly ? (
          <select
            style={SELECT_STYLE}
            value={op}
            disabled={readOnly}
            onChange={(e) => setOp(e.target.value)}
          >
            <option value="Or">Or</option>
            <option value="And">And</option>
            <option value="Equals">Equals</option>
          </select>
        ) : (
          <span style={badge(op)}>{op}</span>
        )}

        {/* Equals: inline tag input */}
        {!isLogical && (
          <input
            style={{ ...INPUT_STYLE, flex: 1 }}
            value={node.Tag ?? ''}
            readOnly={readOnly}
            placeholder='e.g. Type=Soil or Vine'
            onChange={(e) => setTag(e.target.value)}
          />
        )}

        {/* Remove button (not on root) */}
        {!readOnly && onRemove && (
          <button style={BTN_DANGER} onClick={onRemove}>✕</button>
        )}
      </div>

      {/* Hint for Equals */}
      {!isLogical && (
        <div style={HINT_STYLE}>Tag value, optionally with category: <code>Category=Value</code> or plain <code>TagName</code></div>
      )}

      {/* Logical children */}
      {isLogical && (
        <>
          {patterns.map((child, i) => (
            <NodeEditor
              key={i}
              node={child}
              depth={depth + 1}
              onChange={(updated) => updateChild(i, updated)}
              onRemove={patterns.length > 1 ? () => removeChild(i) : undefined}
              readOnly={readOnly}
            />
          ))}
          {!readOnly && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4, marginLeft: 16 }}>
              <button style={BTN_STYLE} onClick={addEquals}>+ Equals</button>
              <button style={BTN_STYLE} onClick={addGroup}>+ Or/And group</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function TagPatternFormEditor({ json, onChange, readOnly }: Props) {
  const node = asNode(json)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ marginBottom: 6 }}>
        <label style={{ ...LABEL_STYLE, marginBottom: 4 }}>Root pattern</label>
        <NodeEditor
          node={node}
          depth={0}
          onChange={(updated) => onChange(updated as Record<string, unknown>)}
          readOnly={readOnly}
        />
      </div>
    </div>
  )
}
