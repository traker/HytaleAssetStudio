import { useEffect, useState } from 'react'

import { HasApiError, hasApi } from '../../api'
import type { ModifiedAssetEntry } from '../../api'
import { ProjectGraphEditor } from './ProjectGraphEditor'

type Props = {
  projectId: string
  onBack: () => void
  onOpenInteractions: (root: { assetKey: string; display: string }) => void
}

export function ProjectModifiedGraphView(props: Props) {
  const [entries, setEntries] = useState<ModifiedAssetEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setEntries([])
    setSelectedKey(null)

    ;(async () => {
      try {
        const resp = await hasApi.projectModified(props.projectId)
        if (cancelled) return
        setEntries(resp.entries)
        // auto-select first server-json entry that has an assetKey
        const first = resp.entries.find((e) => e.kind === 'server-json' && e.assetKey)
        if (first?.assetKey) setSelectedKey(first.assetKey)
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

  const selectedEntry = selectedKey ? entries.find((e) => e.assetKey === selectedKey) : undefined

  const rootForGraph = selectedEntry?.assetKey
    ? { assetKey: selectedEntry.assetKey, display: selectedEntry.vfsPath.split('/').pop() ?? selectedEntry.vfsPath }
    : undefined

  const jsonCount = entries.filter((e) => e.kind === 'server-json' && e.assetKey).length

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

      {/* ── Left panel : list of modified assets ── */}
      <div
        style={{
          width: 270,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(10, 10, 18, 0.88)',
          borderRight: '1px solid #25253a',
          overflow: 'hidden',
          zIndex: 10,
          backdropFilter: 'blur(6px)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #25253a', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#ddd', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            Modified assets
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>
            {loading
              ? 'Loading…'
              : error
              ? <span style={{ color: '#e06c75' }}>{error}</span>
              : `${jsonCount} server JSON · ${entries.length - jsonCount} common`}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {entries.length === 0 && !loading && (
            <p style={{ padding: '14px', color: '#444', fontSize: 12 }}>No modified assets in this project.</p>
          )}

          {entries.map((e) => {
            const selectable = e.kind === 'server-json' && Boolean(e.assetKey)
            const isSelected = e.assetKey === selectedKey
            const filename = e.vfsPath.split('/').pop() ?? e.vfsPath

            return (
              <div
                key={`${e.kind}:${e.vfsPath}`}
                onClick={() => selectable && e.assetKey && setSelectedKey(e.assetKey)}
                title={e.assetKey ?? 'Common resource (no graph)'}
                style={{
                  padding: '7px 14px',
                  cursor: selectable ? 'pointer' : 'default',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: isSelected ? 'rgba(97, 218, 251, 0.10)' : 'transparent',
                  borderLeft: isSelected ? '2px solid #61dafb' : '2px solid transparent',
                  transition: 'background 0.1s',
                  opacity: selectable ? 1 : 0.35,
                }}
                onMouseEnter={(ev) => {
                  if (selectable && !isSelected) ev.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.background = isSelected ? 'rgba(97,218,251,0.10)' : 'transparent'
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isSelected ? '#61dafb' : '#ccc',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {filename}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#555',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {e.vfsPath}
                </div>
                <div style={{ fontSize: 10, color: '#3a3a55', marginTop: 1 }}>
                  {e.kind === 'server-json' ? 'Server JSON' : 'Common'} · {(e.size / 1024).toFixed(1)} KB
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right : graph ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
        {rootForGraph ? (
          <ProjectGraphEditor
            projectId={props.projectId}
            onBack={props.onBack}
            root={rootForGraph}
            autoLoad={true}
            searchEnabled={true}
            searchPlaceholder="Rechercher un item…"
            title="Modified — graph"
            onOpenInteractions={props.onOpenInteractions}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#333',
              fontSize: 13,
            }}
          >
            {loading ? 'Loading modified assets…' : 'Select a modified asset on the left to explore its graph'}
          </div>
        )}
      </div>

    </div>
  )
}
