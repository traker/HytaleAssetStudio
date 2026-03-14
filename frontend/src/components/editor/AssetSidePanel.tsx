import { Suspense, lazy, useEffect, useMemo, useState } from 'react'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

import { HasApiError, hasApi } from '../../api'
import type { AssetGetResponse } from '../../api'
import { InteractionVarsEditor, type InteractionVarsValue } from './InteractionVarsEditor'
import { ItemFormEditor } from './ItemFormEditor'
import { EntityEffectFormEditor } from './EntityEffectFormEditor'
import { detectAssetKind } from './assetTypeRegistry'

type Tab = 'json' | 'form' | 'vars'

type PreviewTab = Tab | 'preview'

type ResourcePreview = {
  assetKey: string
  resolvedPath: string
  origin: string
  mediaType: string
  size: number | null
  kind: 'image' | 'audio' | 'text' | 'binary'
  text?: string
  objectUrl?: string
}

type Props = {
  projectId: string
  selectedNodeId: string
  asset: AssetGetResponse | null
  loading: boolean
  error: string | null
  onClose: () => void
  onOpenInteractions?: () => void
  canOpenInteractions?: boolean
  onRefresh?: (nextSelectedNodeId?: string) => void | Promise<void>
}

export function AssetSidePanel(props: Props) {
  const isCommonResource = props.selectedNodeId.startsWith('common:')

  const editorFontFamily =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

  const canEdit = useMemo(() => {
    return Boolean(props.asset) && (props.selectedNodeId.startsWith('server:') || props.selectedNodeId.startsWith('server-path:'))
  }, [props.asset, props.selectedNodeId])

  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<{ kind: 'idle' | 'saving'; error?: string }>(
    { kind: 'idle' },
  )
  const [tab, setTab] = useState<PreviewTab>('json')

  const [resourcePreview, setResourcePreview] = useState<ResourcePreview | null>(null)
  const [resourceLoading, setResourceLoading] = useState(false)
  const [resourceError, setResourceError] = useState<string | null>(null)

  const title = resourcePreview?.resolvedPath ?? props.asset?.resolvedPath ?? props.selectedNodeId

  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false)
  const [newIdDraft, setNewIdDraft] = useState('')
  const [saveAsStatus, setSaveAsStatus] = useState<{ kind: 'idle' | 'saving'; error?: string; success?: string }>({ kind: 'idle' })

  useEffect(() => {
    setIsEditing(canEdit)
    setDraftError(null)
    setSaveStatus({ kind: 'idle' })
    setTab(isCommonResource ? 'preview' : 'json')
    setIsSaveAsOpen(false)
    setNewIdDraft('')
    setSaveAsStatus({ kind: 'idle' })
    if (props.asset) setDraft(JSON.stringify(props.asset.json, null, 2))
    else setDraft('')
  }, [props.selectedNodeId, props.asset, canEdit, isCommonResource])

  useEffect(() => {
    if (!isCommonResource) {
      setResourceLoading(false)
      setResourceError(null)
      setResourcePreview((prev) => {
        if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl)
        return null
      })
      return
    }

    let cancelled = false
    setResourceLoading(true)
    setResourceError(null)
    setResourcePreview((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl)
      return null
    })

    ;(async () => {
      try {
        const response = await hasApi.projectResourceFetch(props.projectId, props.selectedNodeId)
        if (cancelled) return

        const resolvedPath = response.headers.get('X-HAS-ResolvedPath') ?? props.selectedNodeId
        const origin = response.headers.get('X-HAS-Origin') ?? 'unknown'
        const mediaType = response.headers.get('Content-Type') ?? 'application/octet-stream'
        const contentLength = response.headers.get('Content-Length')
        const size = contentLength ? Number(contentLength) : null
        const lowerPath = resolvedPath.toLowerCase()
        const ext = lowerPath.includes('.') ? lowerPath.slice(lowerPath.lastIndexOf('.')) : ''
        const isImage = mediaType.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)
        const isAudio = mediaType.startsWith('audio/') || ['.ogg', '.wav', '.mp3'].includes(ext)
        const isText = mediaType.startsWith('text/') || mediaType.includes('json') || [
          '.json',
          '.blockymodel',
          '.blockyanim',
          '.animation',
          '.material',
          '.mat',
          '.particle',
          '.effect',
          '.prefab',
          '.txt',
          '.xml',
          '.csv',
          '.shader',
        ].includes(ext)

        if (isImage || isAudio) {
          const blob = await response.blob()
          if (cancelled) return
          setResourcePreview({
            assetKey: props.selectedNodeId,
            resolvedPath,
            origin,
            mediaType,
            size: Number.isFinite(size) ? size : blob.size,
            kind: isImage ? 'image' : 'audio',
            objectUrl: URL.createObjectURL(blob),
          })
        } else if (isText) {
          const text = await response.text()
          if (cancelled) return
          setResourcePreview({
            assetKey: props.selectedNodeId,
            resolvedPath,
            origin,
            mediaType,
            size: Number.isFinite(size) ? size : text.length,
            kind: 'text',
            text,
          })
        } else {
          const blob = await response.blob()
          if (cancelled) return
          setResourcePreview({
            assetKey: props.selectedNodeId,
            resolvedPath,
            origin,
            mediaType,
            size: Number.isFinite(size) ? size : blob.size,
            kind: 'binary',
            objectUrl: URL.createObjectURL(blob),
          })
        }
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof HasApiError ? e.message : 'Unexpected error'
        setResourceError(msg)
      } finally {
        if (!cancelled) setResourceLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isCommonResource, props.projectId, props.selectedNodeId])

  useEffect(() => {
    return () => {
      if (resourcePreview?.objectUrl) URL.revokeObjectURL(resourcePreview.objectUrl)
    }
  }, [resourcePreview])

  async function handleSave(): Promise<void> {
    if (!canEdit) return
    setDraftError(null)
    setSaveStatus({ kind: 'saving' })

    let parsed: unknown
    try {
      parsed = JSON.parse(draft)
    } catch {
      setDraftError('JSON invalide')
      setSaveStatus({ kind: 'idle', error: 'JSON invalide' })
      return
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setDraftError('Le JSON doit être un objet')
      setSaveStatus({ kind: 'idle', error: 'Le JSON doit être un objet' })
      return
    }

    try {
      await hasApi.assetPut(props.projectId, props.selectedNodeId, {
        mode: 'override',
        json: parsed as Record<string, unknown>,
      })
      setSaveStatus({ kind: 'idle' })
      await props.onRefresh?.(props.selectedNodeId)
    } catch (e) {
      const msg = e instanceof HasApiError ? e.message : 'Unexpected error'
      setSaveStatus({ kind: 'idle', error: msg })
    }
  }

  function handleCancel(): void {
    setDraftError(null)
    setSaveStatus({ kind: 'idle' })
    if (props.asset) setDraft(JSON.stringify(props.asset.json, null, 2))
  }

  async function handleSaveAs(): Promise<void> {
    const id = newIdDraft.trim()
    if (!id) {
      setSaveAsStatus({ kind: 'idle', error: 'ID requis' })
      return
    }
    if (!/^[A-Za-z0-9_]+$/.test(id)) {
      setSaveAsStatus({ kind: 'idle', error: 'ID: lettres, chiffres et _ seulement' })
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(draft)
    } catch {
      setSaveAsStatus({ kind: 'idle', error: 'JSON invalide' })
      return
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setSaveAsStatus({ kind: 'idle', error: 'Le JSON doit être un objet' })
      return
    }
    setSaveAsStatus({ kind: 'saving' })
    try {
      const resp = await hasApi.assetPut(props.projectId, props.selectedNodeId, {
        mode: 'copy',
        json: parsed as Record<string, unknown>,
        newId: id,
      })
      setSaveAsStatus({ kind: 'idle', success: `Créé : ${resp.assetKey}` })
      setNewIdDraft('')
      const nextSelectedNodeId = resp.resolvedPath.startsWith('Server/')
        ? `server-path:${resp.resolvedPath}`
        : resp.assetKey
      await props.onRefresh?.(nextSelectedNodeId)
    } catch (e) {
      const msg = e instanceof HasApiError ? e.message : 'Unexpected error'
      setSaveAsStatus({ kind: 'idle', error: msg })
    }
  }

  // ── InteractionVars helpers ───────────────────────────────────────────────

  const hasVars = useMemo(() => {
    if (!props.asset?.json) return false
    const j = props.asset.json as Record<string, unknown>
    return 'InteractionVars' in j
  }, [props.asset])

  const assetKind = useMemo(() => {
    if (!props.asset?.json) return 'unknown' as const
    return detectAssetKind(
      props.asset.json as Record<string, unknown>,
      props.asset.resolvedPath ?? props.selectedNodeId,
    )
  }, [props.asset, props.selectedNodeId])

  const hasForm = assetKind !== 'unknown'

  const currentVars = useMemo((): InteractionVarsValue => {
    try {
      const parsed = JSON.parse(draft) as Record<string, unknown>
      const v = parsed['InteractionVars']
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as InteractionVarsValue
    } catch { /* invalid JSON during editing */ }
    return {}
  }, [draft])

  const currentFormJson = useMemo((): Record<string, unknown> => {
    try { return JSON.parse(draft) as Record<string, unknown> } catch { return {} }
  }, [draft])

  const effectiveLoading = isCommonResource ? resourceLoading : props.loading
  const effectiveError = isCommonResource ? resourceError : props.error
  const visibleTabs = useMemo((): PreviewTab[] => {
    if (isCommonResource) return ['preview']
    return ['json', ...(hasForm ? (['form'] as PreviewTab[]) : []), ...(hasVars ? (['vars'] as PreviewTab[]) : [])]
  }, [hasForm, hasVars, isCommonResource])

  const resourceSizeLabel = resourcePreview?.size != null
    ? resourcePreview.size >= 1024
      ? `${(resourcePreview.size / 1024).toFixed(1)} KB`
      : `${resourcePreview.size} B`
    : null

  function handleFormChange(updated: Record<string, unknown>) {
    setDraft(JSON.stringify(updated, null, 2))
  }

  function handleVarsChange(updated: InteractionVarsValue) {
    try {
      const parsed = JSON.parse(draft) as Record<string, unknown>
      const next = { ...parsed, InteractionVars: updated }
      setDraft(JSON.stringify(next, null, 2))
    } catch {
      // draft is invalid JSON — write vars only
      setDraft(JSON.stringify({ InteractionVars: updated }, null, 2))
    }
  }

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
            {(resourcePreview?.origin ?? props.asset?.origin) ? `  •  origin: ${resourcePreview?.origin ?? props.asset?.origin}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {canEdit && isEditing && (
            <>
              <button
                onClick={handleSave}
                disabled={saveStatus.kind === 'saving'}
                style={{
                  padding: '4px 8px',
                  background: '#61dafb',
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  cursor: saveStatus.kind !== 'saving' ? 'pointer' : 'not-allowed',
                  opacity: saveStatus.kind !== 'saving' ? 1 : 0.6,
                }}
                title="Sauvegarder un override dans le projet"
              >
                {saveStatus.kind === 'saving' ? 'Saving…' : 'Save'}
              </button>

              <button
                onClick={() => { setIsSaveAsOpen((v) => !v); setSaveAsStatus({ kind: 'idle' }) }}
                disabled={saveStatus.kind === 'saving'}
                style={{
                  padding: '4px 8px',
                  background: isSaveAsOpen ? '#2a3a2a' : '#1e2e1e',
                  color: '#7ec87e',
                  border: '1px solid #3a5a3a',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                title="Créer une copie avec un nouvel ID"
              >
                Save as…
              </button>

              <button
                onClick={handleCancel}
                disabled={saveStatus.kind === 'saving'}
                style={{
                  padding: '4px 8px',
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: 4,
                  cursor: saveStatus.kind !== 'saving' ? 'pointer' : 'not-allowed',
                  opacity: saveStatus.kind !== 'saving' ? 1 : 0.6,
                }}
                title="Annuler les modifications"
              >
                Cancel
              </button>
            </>
          )}

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

      {isCommonResource && (
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid #333',
            background: 'rgba(22, 22, 22, 0.98)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, fontSize: 11, color: '#888', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {resourcePreview?.mediaType && <span>{resourcePreview.mediaType}</span>}
            {resourceSizeLabel && <span>{resourceSizeLabel}</span>}
            {resourcePreview?.kind && <span>{resourcePreview.kind}</span>}
          </div>
          <button
            onClick={() => window.open(hasApi.projectResourceUrl(props.projectId, props.selectedNodeId), '_blank', 'noopener,noreferrer')}
            style={{
              padding: '4px 8px',
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: 4,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="Ouvrir la ressource brute"
          >
            Open raw
          </button>
        </div>
      )}

      {/* ── Save as panel ── */}
      {isSaveAsOpen && canEdit && (
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid #2a3a2a',
            background: 'rgba(20, 35, 20, 0.95)',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 11, color: '#7ec87e', fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Save as — new asset
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap' }}>server:</span>
            <input
              value={newIdDraft}
              onChange={(e) => { setNewIdDraft(e.target.value); setSaveAsStatus({ kind: 'idle' }) }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveAs() }}
              placeholder="Nouveau_ID_Asset"
              autoFocus
              style={{
                flex: 1,
                padding: '4px 7px',
                background: '#1a2a1a',
                color: '#aee8ae',
                border: '1px solid #3a5a3a',
                borderRadius: 4,
                fontSize: 12,
                fontFamily: 'ui-monospace, monospace',
              }}
            />
            <button
              onClick={() => void handleSaveAs()}
              disabled={saveAsStatus.kind === 'saving'}
              style={{
                padding: '4px 10px',
                background: '#3a6a3a',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: saveAsStatus.kind !== 'saving' ? 'pointer' : 'not-allowed',
                fontSize: 12,
              }}
            >
              {saveAsStatus.kind === 'saving' ? 'Creating…' : 'Create'}
            </button>
          </div>
          {saveAsStatus.error && <div style={{ fontSize: 11, color: '#e06c75', marginTop: 4 }}>{saveAsStatus.error}</div>}
          {saveAsStatus.success && <div style={{ fontSize: 11, color: '#7ec87e', marginTop: 4 }}>{saveAsStatus.success}</div>}
          <div style={{ fontSize: 10, color: '#3a4a3a', marginTop: 5 }}>
            Writes the current JSON as a new file in the same Server subfolder with this ID as filename.
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333', flexShrink: 0 }}>
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '6px 0',
              background: 'transparent',
              color: tab === t ? '#61dafb' : '#555',
              border: 'none',
              borderBottom: tab === t ? '2px solid #61dafb' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: tab === t ? 700 : 400,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {t === 'json' ? 'JSON' : t === 'form' ? 'Form' : t === 'vars' ? 'Vars' : 'Preview'}
          </button>
        ))}
      </div>

      <div style={{ padding: 12, overflow: 'auto', flex: 1 }}>
        {effectiveLoading && <div style={{ color: '#ccc', fontStyle: 'italic' }}>Chargement...</div>}
        {effectiveError && <div style={{ color: '#FF6B6B' }}>{effectiveError}</div>}
        {draftError && <div style={{ color: '#FF6B6B', marginBottom: 8 }}>{draftError}</div>}
        {saveStatus.error && <div style={{ color: '#FF6B6B', marginBottom: 8 }}>{saveStatus.error}</div>}

        {isCommonResource && tab === 'preview' && resourcePreview && (
          <div>
            {resourcePreview.kind === 'image' && resourcePreview.objectUrl && (
              <div
                style={{
                  border: '1px solid #333',
                  borderRadius: 6,
                  background: 'linear-gradient(135deg, #202020 25%, #252525 25%, #252525 50%, #202020 50%, #202020 75%, #252525 75%, #252525)',
                  backgroundSize: '24px 24px',
                  padding: 12,
                }}
              >
                <img
                  src={resourcePreview.objectUrl}
                  alt={resourcePreview.resolvedPath}
                  style={{ display: 'block', maxWidth: '100%', maxHeight: 480, margin: '0 auto', imageRendering: 'pixelated' }}
                />
              </div>
            )}

            {resourcePreview.kind === 'audio' && resourcePreview.objectUrl && (
              <div style={{ border: '1px solid #333', borderRadius: 6, background: '#181818', padding: 12 }}>
                <audio controls preload="metadata" src={resourcePreview.objectUrl} style={{ width: '100%' }} />
              </div>
            )}

            {resourcePreview.kind === 'text' && (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: 320,
                  height: 420,
                  resize: 'vertical',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#1e1e1e',
                    border: '1px solid #333',
                    borderRadius: 6,
                    overflow: 'hidden',
                  }}
                >
                  <Suspense fallback={<div style={{ color: '#666', padding: 12, fontSize: 12 }}>Loading editor…</div>}>
                  <MonacoEditor
                    height="100%"
                    defaultLanguage="json"
                    theme="vs-dark"
                    value={resourcePreview.text ?? ''}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      lineHeight: 16,
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      fontFamily: editorFontFamily,
                      readOnly: true,
                      domReadOnly: true,
                    }}
                  />
                  </Suspense>
                </div>
              </div>
            )}

            {resourcePreview.kind === 'binary' && (
              <div style={{ border: '1px solid #333', borderRadius: 6, background: '#181818', padding: 12, color: '#aaa' }}>
                <div style={{ marginBottom: 8, fontSize: 12 }}>
                  Binary preview not supported yet for this format.
                </div>
                <div style={{ fontSize: 11, color: '#777' }}>
                  Open the raw resource to inspect or download it.
                </div>
              </div>
            )}
          </div>
        )}

        {props.asset && !isCommonResource && tab === 'json' && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              minHeight: 320,
              height: 420,
              resize: 'vertical',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: '#1e1e1e',
                border: '1px solid #333',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <Suspense fallback={<div style={{ color: '#666', padding: 12, fontSize: 12 }}>Loading editor…</div>}>
              <MonacoEditor
                height="100%"
                defaultLanguage="json"
                theme="vs-dark"
                value={draft}
                onChange={(value: string | undefined) => setDraft(value ?? '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineHeight: 16,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  fontFamily: editorFontFamily,
                  readOnly: !canEdit,
                  domReadOnly: !canEdit,
                }}
              />
              </Suspense>
            </div>
          </div>
        )}

        {props.asset && !isCommonResource && tab === 'form' && (() => {
          switch (assetKind) {
            case 'item':
              return (
                <ItemFormEditor
                  json={currentFormJson}
                  onChange={canEdit ? handleFormChange : () => {}}
                  readOnly={!canEdit}
                />
              )
            case 'entity-effect':
              return (
                <EntityEffectFormEditor
                  json={currentFormJson}
                  onChange={canEdit ? handleFormChange : () => {}}
                  readOnly={!canEdit}
                />
              )
            default:
              return null
          }
        })()}

        {props.asset && !isCommonResource && tab === 'vars' && (
          <div>
            {!canEdit && (
              <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', marginBottom: 8 }}>
                Read-only — overrides uniquement disponibles pour les assets server.
              </div>
            )}
            <InteractionVarsEditor
              vars={currentVars}
              onChange={canEdit ? handleVarsChange : () => {}}
            />
          </div>
        )}
      </div>
    </div>
  )
}
