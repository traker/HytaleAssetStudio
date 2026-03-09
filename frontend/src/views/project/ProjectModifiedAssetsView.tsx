import { useEffect, useMemo, useRef, useState } from 'react'
import { Panel } from '@xyflow/react'

import { HasApiError, hasApi } from '../../api'
import type { AssetGetResponse, ModifiedAssetEntry, ModifiedAssetsResponse } from '../../api'
import { AssetSidePanel } from '../../components/editor/AssetSidePanel'

type Props = {
  projectId: string
  onBack: () => void
}

export function ProjectModifiedAssetsView(props: Props) {
  const [data, setData] = useState<ModifiedAssetsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [asset, setAsset] = useState<AssetGetResponse | null>(null)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [assetLoading, setAssetLoading] = useState(false)
  const [assetReloadTick, setAssetReloadTick] = useState(0)
  const assetSeq = useRef(0)

  const entries = useMemo(() => data?.entries ?? [], [data])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)

    ;(async () => {
      try {
        const resp = await hasApi.projectModified(props.projectId)
        if (cancelled) return
        setData(resp)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof HasApiError ? e.message : 'Unexpected error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [props.projectId])

  useEffect(() => {
    if (!selectedNodeId) {
      setAsset(null)
      setAssetError(null)
      setAssetLoading(false)
      return
    }

    const mySeq = ++assetSeq.current
    setAssetLoading(true)
    setAssetError(null)
    setAsset(null)

    ;(async () => {
      try {
        const a = await hasApi.assetGet(props.projectId, selectedNodeId)
        if (assetSeq.current !== mySeq) return
        setAsset(a)
      } catch (e) {
        if (assetSeq.current !== mySeq) return
        setAsset(null)
        setAssetError(e instanceof HasApiError ? e.message : 'Unexpected error')
      } finally {
        if (assetSeq.current === mySeq) setAssetLoading(false)
      }
    })()
  }, [props.projectId, selectedNodeId, assetReloadTick])

  function handleEntryClick(e: ModifiedAssetEntry): void {
    if (!e.assetKey) return

    if (e.kind === 'server-json') {
      setSelectedNodeId(e.assetKey)
      return
    }

    if (e.kind === 'common-resource') {
      const url = `/api/v1/projects/${encodeURIComponent(props.projectId)}/resource?key=${encodeURIComponent(e.assetKey)}`
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="editor-container" style={{ position: 'fixed', inset: 0 }}>
      <Panel position="top-left" className="panel">
        <h3>Hytale Asset Studio</h3>
        <p style={{ marginTop: 0, opacity: 0.8 }}>projectId: {props.projectId}</p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <button
            onClick={props.onBack}
            style={{
              padding: '5px 10px',
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Back
          </button>
        </div>

        {loading && <p style={{ marginTop: 10, color: '#ccc', fontStyle: 'italic' }}>Chargement…</p>}
        {error && <p style={{ marginTop: 10, color: '#FF6B6B' }}>{error}</p>}

        {!loading && !error && (
          <>
            <p style={{ marginTop: 10, color: '#ccc' }}>
              {data ? `${data.count} fichier(s) modifié(s)` : '0 fichier modifié'}
            </p>
            {entries.length === 0 ? (
              <p style={{ marginTop: 6, color: '#888', fontSize: 12 }}>Aucun override/fichier ajouté dans le projet actif.</p>
            ) : (
              <div
                style={{
                  marginTop: 10,
                  maxHeight: 520,
                  overflow: 'auto',
                  border: '1px solid #333',
                  borderRadius: 6,
                }}
              >
                {entries.map((e) => {
                  const clickable = Boolean(e.assetKey)
                  return (
                    <div
                      key={`${e.kind}:${e.vfsPath}`}
                      onClick={() => clickable && handleEntryClick(e)}
                      style={{
                        padding: '8px 10px',
                        cursor: clickable ? 'pointer' : 'default',
                        borderBottom: '1px solid #333',
                        background: 'transparent',
                        fontSize: 12,
                      }}
                      onMouseEnter={(ev) => {
                        if (clickable) ev.currentTarget.style.background = '#2a2a2a'
                      }}
                      onMouseLeave={(ev) => {
                        ev.currentTarget.style.background = 'transparent'
                      }}
                      title={e.assetKey ?? 'ID ambigu / non résolvable'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ color: '#fff', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.vfsPath}
                        </div>
                        <div style={{ color: '#888', whiteSpace: 'nowrap' }}>{e.kind === 'server-json' ? 'Server' : 'Common'}</div>
                      </div>
                      <div style={{ marginTop: 3, color: '#888', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.assetKey ?? 'assetKey: (ambigu)'}
                        {`  •  ${(e.size / 1024).toFixed(1)} KB`}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </Panel>

      {selectedNodeId && (
        <AssetSidePanel
          projectId={props.projectId}
          selectedNodeId={selectedNodeId}
          asset={asset}
          loading={assetLoading}
          error={assetError}
          onClose={() => setSelectedNodeId(null)}
          onRefresh={() => setAssetReloadTick((t) => t + 1)}
        />
      )}
    </div>
  )
}
