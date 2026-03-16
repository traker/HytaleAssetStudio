// PrefabFormEditor.tsx
// Display-only metadata view for Hytale Prefab assets (Server/Prefabs/).
// The block array is too large for inline editing — all modifications go through RAW JSON.
// Displayed: version, blockIdVersion, anchor (X/Y/Z), block count.

import type React from 'react'

type Props = {
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly: boolean
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SECTION_STYLE: React.CSSProperties = {
  marginBottom: 12,
  padding: '10px 12px 8px',
  border: '1px solid #2b2b3f',
  borderRadius: 6,
  background: 'rgba(25, 25, 40, 0.55)',
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: '#9da5ca',
  marginBottom: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  fontWeight: 700,
}

const GRID2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }
const GRID3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  color: '#888',
  marginBottom: 3,
  display: 'block',
}

const VALUE_STYLE: React.CSSProperties = {
  fontSize: 13,
  color: '#e0e0e0',
  padding: '5px 8px',
  background: '#13131f',
  border: '1px solid #2a2a3f',
  borderRadius: 4,
  fontVariantNumeric: 'tabular-nums',
}

const BADGE_STYLE: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 14,
  fontWeight: 700,
  color: '#a29bfe',
  padding: '4px 10px',
  background: '#1e1a3a',
  border: '1px solid #5a52b0',
  borderRadius: 5,
  fontVariantNumeric: 'tabular-nums',
}

const NOTICE_STYLE: React.CSSProperties = {
  marginTop: 8,
  padding: '8px 10px',
  background: '#1a1a2e',
  border: '1px solid #2b2b4f',
  borderRadius: 4,
  fontSize: 11,
  color: '#7a8bb0',
  lineHeight: 1.5,
}

// ─── Read-only value cell ─────────────────────────────────────────────────────

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      <div style={VALUE_STYLE}>{value ?? '—'}</div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PrefabFormEditor({ json }: Props) {
  const version = typeof json['version'] === 'number' ? json['version'] : null
  const blockIdVersion = typeof json['blockIdVersion'] === 'number' ? json['blockIdVersion'] : null
  const anchorX = typeof json['anchorX'] === 'number' ? json['anchorX'] : null
  const anchorY = typeof json['anchorY'] === 'number' ? json['anchorY'] : null
  const anchorZ = typeof json['anchorZ'] === 'number' ? json['anchorZ'] : null
  const blockCount = Array.isArray(json['blocks']) ? (json['blocks'] as unknown[]).length : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* Summary badge */}
      <div style={{ ...SECTION_STYLE, textAlign: 'center' }}>
        <div style={SECTION_TITLE_STYLE}>Prefab structure</div>
        {blockCount !== null ? (
          <div>
            <div style={BADGE_STYLE}>{blockCount.toLocaleString()} blocks</div>
          </div>
        ) : (
          <div style={{ color: '#555', fontSize: 12 }}>Block count unavailable.</div>
        )}
        <div style={NOTICE_STYLE}>
          The block array is display-only. Use the <strong>RAW JSON</strong> tab to inspect or modify block positions and names.
        </div>
      </div>

      {/* Format metadata */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Format Versions</div>
        <div style={GRID2}>
          <Cell label="Prefab version" value={version} />
          <Cell label="Block ID version" value={blockIdVersion} />
        </div>
      </div>

      {/* Anchor point */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Anchor Point</div>
        <div style={GRID3}>
          <Cell label="Anchor X" value={anchorX} />
          <Cell label="Anchor Y" value={anchorY} />
          <Cell label="Anchor Z" value={anchorZ} />
        </div>
      </div>

    </div>
  )
}
