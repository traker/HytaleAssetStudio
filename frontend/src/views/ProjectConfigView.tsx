import { useEffect, useMemo, useState } from 'react'
import { HasApiError, hasApi } from '../api'
import type { PackSource, ProjectConfig, ProjectLayer } from '../api'
import { PathInput } from '../components/ui/PathInput'

type Props = {
  projectId: string
  onBack: () => void
  onOpenGraphItems: () => void
  onOpenModified: () => void
}

type Status = { kind: 'idle' | 'loading' | 'saving' | 'exporting'; message?: string }

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export function ProjectConfigView(props: Props) {
  const [config, setConfig] = useState<ProjectConfig | null>(null)
  const [draftVanilla, setDraftVanilla] = useState<PackSource | null>(null)
  const [draftLayers, setDraftLayers] = useState<ProjectLayer[]>([])

  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)

  const [exportPath, setExportPath] = useState('')
  const canSave = useMemo(
    () => status.kind !== 'loading' && status.kind !== 'saving' && draftVanilla !== null,
    [status.kind, draftVanilla],
  )
  const isBusy = status.kind === 'loading' || status.kind === 'saving' || status.kind === 'exporting'

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setStatus({ kind: 'loading' })
      setError(null)
      try {
        const cfg = await hasApi.projectConfig(props.projectId)
        if (cancelled) return
        setConfig(cfg)
        setDraftVanilla(clone(cfg.vanilla))
        setDraftLayers(clone(cfg.layers ?? []))
      } catch (e) {
        if (cancelled) return
        setError(e instanceof HasApiError ? e.message : 'Unexpected error')
      } finally {
        if (!cancelled) setStatus({ kind: 'idle' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [props.projectId])

  function updateLayer(index: number, patch: Partial<ProjectLayer>): void {
    setDraftLayers((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  function moveLayer(index: number, dir: -1 | 1): void {
    setDraftLayers((prev) => {
      const j = index + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      const tmp = next[index]
      next[index] = next[j]
      next[j] = tmp
      return next
    })
  }

  function removeLayer(index: number): void {
    setDraftLayers((prev) => prev.filter((_, i) => i !== index))
  }

  function addLayer(): void {
    setDraftLayers((prev) => [
      ...prev,
      {
        id: `layer-${prev.length + 1}`,
        displayName: `Layer ${prev.length + 1}`,
        sourceType: 'folder',
        path: '',
        enabled: true,
      },
    ])
  }

  async function save(): Promise<void> {
    if (!draftVanilla) return
    setStatus({ kind: 'saving' })
    setError(null)
    try {
      await hasApi.projectPutLayers(props.projectId, { vanilla: draftVanilla, layers: draftLayers })
      const cfg = await hasApi.projectConfig(props.projectId)
      setConfig(cfg)
      setDraftVanilla(clone(cfg.vanilla))
      setDraftLayers(clone(cfg.layers ?? []))
      setStatus({ kind: 'idle', message: 'Saved' })
      setTimeout(() => setStatus({ kind: 'idle' }), 1200)
    } catch (e) {
      setStatus({ kind: 'idle' })
      setError(e instanceof HasApiError ? e.message : 'Unexpected error')
    }
  }

  async function exportZip(): Promise<void> {
    setStatus({ kind: 'exporting' })
    setError(null)
    try {
      const out = exportPath.trim()
      if (!out) {
        setError('Output path is required')
        setStatus({ kind: 'idle' })
        return
      }
      await hasApi.exportZip(props.projectId, { outputPath: out })
      setStatus({ kind: 'idle', message: 'Exported' })
      setTimeout(() => setStatus({ kind: 'idle' }), 1200)
    } catch (e) {
      setStatus({ kind: 'idle' })
      setError(e instanceof HasApiError ? e.message : 'Unexpected error')
    }
  }

  return (
    <div className="page-content">

      {/* ── Tool tiles ── */}
      <div className="tool-grid">
        <button className="tool-tile" onClick={props.onOpenGraphItems} disabled={isBusy}>
          <span className="tool-tile-icon">🗂</span>
          <span className="tool-tile-label">Items Graph</span>
          <span className="tool-tile-desc">Browse and explore item assets</span>
        </button>
        <button className="tool-tile" disabled title="Open from an item node in the Items Graph">
          <span className="tool-tile-icon">🔗</span>
          <span className="tool-tile-label">Interactions</span>
          <span className="tool-tile-desc">Open from an item in the Items Graph</span>
        </button>
        <button className="tool-tile" onClick={props.onOpenModified} disabled={isBusy}>
          <span className="tool-tile-icon">📋</span>
          <span className="tool-tile-label">Modified Assets</span>
          <span className="tool-tile-desc">Overrides and pending changes</span>
        </button>
      </div>

      {/* ── Config card ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="section-title" style={{ marginBottom: 16 }}>Project configuration — {props.projectId}</p>

        {error && <p className="error-msg">{error}</p>}
        {status.message && <p className="success-msg">{status.message}</p>}

        {!config || !draftVanilla ? (
          <p style={{ color: '#555', fontSize: 13 }}>{status.kind === 'loading' ? 'Loading…' : 'No config loaded.'}</p>
        ) : (
          <>
            {/* Vanilla */}
            <p className="section-title" style={{ marginTop: 8 }}>Vanilla pack</p>
            <div className="config-grid">
              <label>sourceType</label>
              <select
                value={draftVanilla.sourceType}
                onChange={(e) => setDraftVanilla({ ...draftVanilla, sourceType: e.target.value as PackSource['sourceType'] })}
              >
                <option value="folder">folder</option>
                <option value="zip">zip</option>
              </select>

              <label>path</label>
              <PathInput
                value={draftVanilla.path}
                onChange={(v) => setDraftVanilla({ ...draftVanilla, path: v })}
                sourceType={draftVanilla.sourceType === 'zip' ? 'zip' : 'folder'}
                disabled={isBusy}
              />
            </div>

            {/* Layers */}
            <p className="section-title" style={{ marginTop: 20 }}>Layers</p>
            {draftLayers.length === 0 ? (
              <p style={{ color: '#555', fontSize: 12 }}>No layers.</p>
            ) : (
              draftLayers.map((layer, i) => (
                <div key={`${layer.id}-${i}`} className="layer-card">
                  <div className="layer-card-header">
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#bbb', fontFamily: 'ui-monospace, monospace' }}>
                      {layer.id}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" style={{ padding: '3px 8px' }} onClick={() => moveLayer(i, -1)} disabled={i === 0}>↑</button>
                      <button className="btn btn-ghost" style={{ padding: '3px 8px' }} onClick={() => moveLayer(i, 1)} disabled={i === draftLayers.length - 1}>↓</button>
                      <button className="btn btn-danger" style={{ padding: '3px 8px' }} onClick={() => removeLayer(i)}>Remove</button>
                    </div>
                  </div>
                  <div className="config-grid">
                    <label>enabled</label>
                    <input type="checkbox" checked={layer.enabled} onChange={(e) => updateLayer(i, { enabled: e.target.checked })} />
                    <label>displayName</label>
                    <input value={layer.displayName ?? ''} onChange={(e) => updateLayer(i, { displayName: e.target.value })} />
                    <label>sourceType</label>
                    <select value={layer.sourceType} onChange={(e) => updateLayer(i, { sourceType: e.target.value as ProjectLayer['sourceType'] })}>
                      <option value="folder">folder</option>
                      <option value="zip">zip</option>
                    </select>
                    <label>path</label>
                    <PathInput
                      value={layer.path}
                      onChange={(v) => updateLayer(i, { path: v })}
                      sourceType={layer.sourceType === 'zip' ? 'zip' : 'folder'}
                      disabled={isBusy}
                    />
                  </div>
                </div>
              ))
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={addLayer} disabled={isBusy}>
                + Add layer
              </button>
              <button className="btn btn-primary" onClick={save} disabled={!canSave}>
                {status.kind === 'saving' ? 'Saving…' : 'Save'}
              </button>
            </div>

            {/* Export */}
            <p className="section-title" style={{ marginTop: 24 }}>Export ZIP</p>
            <div className="config-grid" style={{ gridTemplateColumns: '120px 1fr' }}>
              <label>outputPath</label>
              <PathInput
                value={exportPath}
                onChange={setExportPath}
                placeholder="K:/…/exports/my-pack.zip"
                sourceType="zip"
                disabled={isBusy}
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-secondary" onClick={exportZip} disabled={isBusy}>
                {status.kind === 'exporting' ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

