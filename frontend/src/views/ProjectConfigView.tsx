import { useEffect, useMemo, useState } from 'react'
import { HasApiError, hasApi } from '../api'
import type { PackSource, ProjectConfig, ProjectLayer } from '../api'

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
    return () => {
      cancelled = true
    }
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
      await hasApi.projectPutLayers(props.projectId, {
        vanilla: draftVanilla,
        layers: draftLayers,
      })
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
    <div className="card" style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Project config</h2>
          <p style={{ marginTop: 0, opacity: 0.8 }}>projectId: {props.projectId}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={props.onOpenGraphItems}
            disabled={status.kind === 'loading' || status.kind === 'saving' || status.kind === 'exporting'}
          >
            Graphe Items
          </button>
          <button
            onClick={props.onOpenModified}
            disabled={status.kind === 'loading' || status.kind === 'saving' || status.kind === 'exporting'}
          >
            Modifiés
          </button>
          <button onClick={props.onBack} disabled={status.kind === 'loading' || status.kind === 'saving'}>
            Back
          </button>
        </div>
      </div>

      {error && <p style={{ color: 'salmon' }}>{error}</p>}

      {status.message && <p style={{ opacity: 0.8 }}>{status.message}</p>}

      {!config || !draftVanilla ? (
        <p>Loading…</p>
      ) : (
        <>
          <h3>Vanilla</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'center' }}>
            <label>sourceType</label>
            <select
              value={draftVanilla.sourceType}
              onChange={(e) => setDraftVanilla({ ...draftVanilla, sourceType: e.target.value as PackSource['sourceType'] })}
            >
              <option value="folder">folder</option>
              <option value="zip">zip</option>
            </select>

            <label>path</label>
            <input value={draftVanilla.path} onChange={(e) => setDraftVanilla({ ...draftVanilla, path: e.target.value })} />
          </div>

          <h3 style={{ marginTop: 18 }}>Layers</h3>
          {draftLayers.length === 0 ? (
            <p>No layers.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {draftLayers.map((layer, i) => (
                <div key={`${layer.id}-${i}`} style={{ border: '1px solid #333', borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong>{layer.id}</strong>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => moveLayer(i, -1)} disabled={i === 0}>
                        Up
                      </button>
                      <button onClick={() => moveLayer(i, 1)} disabled={i === draftLayers.length - 1}>
                        Down
                      </button>
                      <button onClick={() => removeLayer(i)}>Remove</button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'center', marginTop: 10 }}>
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
                    <input value={layer.path} onChange={(e) => updateLayer(i, { path: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addLayer} disabled={status.kind === 'saving' || status.kind === 'loading'}>
              Add layer
            </button>
            <button onClick={save} disabled={!canSave}>
              {status.kind === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>

          <h3 style={{ marginTop: 18 }}>Export ZIP</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'center' }}>
            <label>outputPath</label>
            <input
              value={exportPath}
              onChange={(e) => setExportPath(e.target.value)}
              placeholder="K:/hytale-asset-studio-workspace/exports/my-pack.zip"
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={exportZip} disabled={status.kind === 'exporting' || status.kind === 'saving' || status.kind === 'loading'}>
              {status.kind === 'exporting' ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
