import { useEffect, useMemo, useState } from 'react'
import { HasApiError, hasApi } from '../api'
import type { PackSource, ProjectConfig, ProjectLayer, ProjectManifest, ProjectManifestAuthor } from '../api'
import { PathInput } from '../components/ui/PathInput'
import { clone } from '../utils/clone'

type Props = {
  projectId: string
  onBack: () => void
  onOpenGraphItems: () => void
  onOpenModified: () => void
}

type Status = { kind: 'idle' | 'loading' | 'saving' | 'exporting'; message?: string }

export function ProjectConfigView(props: Props) {
  const [config, setConfig] = useState<ProjectConfig | null>(null)
  const [draftVanilla, setDraftVanilla] = useState<PackSource | null>(null)
  const [draftLayers, setDraftLayers] = useState<ProjectLayer[]>([])
  const [draftManifest, setDraftManifest] = useState<ProjectManifest | null>(null)
  const [manifestOpen, setManifestOpen] = useState(false)

  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [manifestStatus, setManifestStatus] = useState<{ message?: string; error?: string }>({})
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
        const [cfg, mfst] = await Promise.all([
          hasApi.projectConfig(props.projectId),
          hasApi.projectGetManifest(props.projectId),
        ])
        if (cancelled) return
        setConfig(cfg)
        setDraftVanilla(clone(cfg.vanilla))
        setDraftLayers(clone(cfg.layers ?? []))
        setDraftManifest(clone(mfst))
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

  function patchManifest(patch: Partial<ProjectManifest>): void {
    setDraftManifest((prev) => prev ? { ...prev, ...patch } : prev)
  }

  function updateAuthor(index: number, patch: Partial<ProjectManifestAuthor>): void {
    setDraftManifest((prev) => {
      if (!prev) return prev
      const authors = [...(prev.Authors ?? [])]
      authors[index] = { ...authors[index], ...patch }
      return { ...prev, Authors: authors }
    })
  }

  function addAuthor(): void {
    setDraftManifest((prev) => {
      if (!prev) return prev
      return { ...prev, Authors: [...(prev.Authors ?? []), { Name: '', Email: '', Url: '' }] }
    })
  }

  function removeAuthor(index: number): void {
    setDraftManifest((prev) => {
      if (!prev) return prev
      return { ...prev, Authors: (prev.Authors ?? []).filter((_, i) => i !== index) }
    })
  }

  function addDepEntry(field: 'Dependencies' | 'OptionalDependencies'): void {
    setDraftManifest((prev) => {
      if (!prev) return prev
      const entries = Object.entries(prev[field] ?? {})
      entries.push(['', '*'])
      return { ...prev, [field]: Object.fromEntries(entries) }
    })
  }

  function setDepEntry(field: 'Dependencies' | 'OptionalDependencies', index: number, key: string, value: string): void {
    setDraftManifest((prev) => {
      if (!prev) return prev
      const entries = Object.entries(prev[field] ?? {})
      entries[index] = [key, value]
      return { ...prev, [field]: Object.fromEntries(entries) }
    })
  }

  function removeDepEntry(field: 'Dependencies' | 'OptionalDependencies', index: number): void {
    setDraftManifest((prev) => {
      if (!prev) return prev
      const entries = Object.entries(prev[field] ?? {})
      entries.splice(index, 1)
      return { ...prev, [field]: Object.fromEntries(entries) }
    })
  }

  async function saveManifest(): Promise<void> {
    if (!draftManifest) return
    setManifestStatus({})
    try {
      await hasApi.projectPutManifest(props.projectId, draftManifest)
      setManifestStatus({ message: 'Manifest saved' })
      setTimeout(() => setManifestStatus({}), 1500)
    } catch (e) {
      setManifestStatus({ error: e instanceof HasApiError ? e.message : 'Failed to save manifest' })
    }
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
            {/* Layers */}
            <p className="section-title" style={{ marginTop: 8 }}>Layers</p>
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

            {/* Manifest */}
            <button
              onClick={() => setManifestOpen((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginTop: 24, marginBottom: 0,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, color: '#ccc', fontSize: 22, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              }}
            >
              <span style={{ fontSize: 10, color: '#555', transition: 'transform 0.15s', display: 'inline-block', transform: manifestOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              Manifest
              {manifestStatus.message && <span style={{ fontSize: 11, color: '#4caf93', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{manifestStatus.message}</span>}
              {manifestStatus.error && <span style={{ fontSize: 11, color: '#e06c75', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{manifestStatus.error}</span>}
            </button>
            {manifestOpen && draftManifest && (
              <>
                <div className="config-grid" style={{ gridTemplateColumns: '140px 1fr' }}>
                  <label>Group *</label>
                  <input value={draftManifest.Group} onChange={(e) => patchManifest({ Group: e.target.value })} disabled={isBusy} />
                  <label>Name *</label>
                  <input value={draftManifest.Name} onChange={(e) => patchManifest({ Name: e.target.value })} disabled={isBusy} />
                  <label>Version *</label>
                  <input value={draftManifest.Version} onChange={(e) => patchManifest({ Version: e.target.value })} disabled={isBusy} />
                  <label>Description</label>
                  <input value={draftManifest.Description ?? ''} onChange={(e) => patchManifest({ Description: e.target.value })} disabled={isBusy} />
                  <label>Website</label>
                  <input value={draftManifest.Website ?? ''} onChange={(e) => patchManifest({ Website: e.target.value })} disabled={isBusy} />
                  <label>ServerVersion</label>
                  <input value={draftManifest.ServerVersion ?? '*'} onChange={(e) => patchManifest({ ServerVersion: e.target.value })} disabled={isBusy} />
                  <label>IncludesAssetPack</label>
                  <input type="checkbox" checked={draftManifest.IncludesAssetPack ?? false} onChange={(e) => patchManifest({ IncludesAssetPack: e.target.checked })} disabled={isBusy} />
                  <label>DisabledByDefault</label>
                  <input type="checkbox" checked={draftManifest.DisabledByDefault ?? false} onChange={(e) => patchManifest({ DisabledByDefault: e.target.checked })} disabled={isBusy} />
                </div>

                <p style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginTop: 14, marginBottom: 6 }}>Authors</p>
                {(draftManifest.Authors ?? []).length === 0 && (
                  <p style={{ color: '#555', fontSize: 12 }}>No authors.</p>
                )}
                {(draftManifest.Authors ?? []).map((author, i) => (
                  <div key={i} className="layer-card" style={{ marginBottom: 6 }}>
                    <div className="layer-card-header">
                      <span style={{ fontSize: 12, color: '#888' }}>Author {i + 1}</span>
                      <button className="btn btn-danger" style={{ padding: '2px 8px' }} onClick={() => removeAuthor(i)} disabled={isBusy}>Remove</button>
                    </div>
                    <div className="config-grid" style={{ gridTemplateColumns: '80px 1fr' }}>
                      <label>Name *</label>
                      <input value={author.Name} onChange={(e) => updateAuthor(i, { Name: e.target.value })} disabled={isBusy} />
                      <label>Email</label>
                      <input value={author.Email ?? ''} onChange={(e) => updateAuthor(i, { Email: e.target.value })} disabled={isBusy} />
                      <label>Url</label>
                      <input value={author.Url ?? ''} onChange={(e) => updateAuthor(i, { Url: e.target.value })} disabled={isBusy} />
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-secondary" onClick={addAuthor} disabled={isBusy}>+ Add author</button>
                </div>

                {(['Dependencies', 'OptionalDependencies'] as const).map((field) => {
                  const entries = Object.entries(draftManifest[field] ?? {})
                  const label = field === 'Dependencies' ? 'Dependencies' : 'Optional dependencies'
                  const hint = field === 'Dependencies' ? 'required' : 'optional'
                  return (
                    <div key={field}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginTop: 14, marginBottom: 4 }}>
                        {label}
                        <span style={{ fontSize: 11, color: '#555', fontWeight: 400, marginLeft: 6 }}>Group:Name → version — pack {hint}</span>
                      </p>
                      {entries.length === 0 && (
                        <p style={{ color: '#555', fontSize: 12 }}>None.</p>
                      )}
                      {entries.map(([key, val], i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                          <input
                            style={{ flex: 2 }}
                            value={key}
                            placeholder="com.example:MyPack"
                            onChange={(e) => setDepEntry(field, i, e.target.value, val)}
                            disabled={isBusy}
                          />
                          <input
                            style={{ flex: 1 }}
                            value={val}
                            placeholder="*"
                            onChange={(e) => setDepEntry(field, i, key, e.target.value)}
                            disabled={isBusy}
                          />
                          <button className="btn btn-danger" style={{ padding: '2px 8px' }} onClick={() => removeDepEntry(field, i)} disabled={isBusy}>✕</button>
                        </div>
                      ))}
                      <button className="btn btn-secondary" style={{ marginTop: 4 }} onClick={() => addDepEntry(field)} disabled={isBusy}>+ Add</button>
                    </div>
                  )
                })}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={saveManifest} disabled={isBusy}>Save manifest</button>
                </div>
              </>
            )}

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

