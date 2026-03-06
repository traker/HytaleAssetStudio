import type { AssetGetResponse } from '../../api'

type Props = {
  selectedNodeId: string
  asset: AssetGetResponse | null
  loading: boolean
  error: string | null
  onClose: () => void
  onOpenInteractions?: () => void
  canOpenInteractions?: boolean
}

export function AssetSidePanel(props: Props) {
  const title = props.asset?.resolvedPath ?? props.selectedNodeId

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100%',
        width: 460,
        background: 'rgba(30, 30, 30, 0.96)',
        borderLeft: '1px solid #333',
        boxShadow: '0 0 20px rgba(0,0,0,0.5)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              color: '#61dafb',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            key: {props.selectedNodeId}
            {props.asset?.origin ? `  •  origin: ${props.asset.origin}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {props.onOpenInteractions && (
            <button
              onClick={props.onOpenInteractions}
              disabled={!props.canOpenInteractions || props.loading}
              style={{
                padding: '4px 8px',
                background: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: 4,
                cursor: props.canOpenInteractions && !props.loading ? 'pointer' : 'not-allowed',
                opacity: props.canOpenInteractions ? 1 : 0.6,
              }}
              title={props.canOpenInteractions ? 'Ouvrir l\'éditeur d\'interaction' : 'Sélectionne une interaction dans le graphe'}
            >
              Interactions
            </button>
          )}

          <button
            onClick={props.onClose}
            style={{
              padding: '4px 8px',
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: 4,
              cursor: 'pointer',
            }}
            title="Fermer"
          >
            X
          </button>
        </div>
      </div>

      <div style={{ padding: 12, overflow: 'auto', flex: 1 }}>
        {props.loading && <div style={{ color: '#ccc', fontStyle: 'italic' }}>Chargement...</div>}
        {props.error && <div style={{ color: '#FF6B6B' }}>{props.error}</div>}

        {props.asset && (
          <pre
            style={{
              margin: 0,
              padding: 10,
              background: '#1e1e1e',
              border: '1px solid #333',
              borderRadius: 6,
              fontSize: 12,
              lineHeight: 1.35,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(props.asset.json, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}
