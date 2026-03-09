import { useEffect, useMemo, useState } from 'react'

import { HasApiError, hasApi } from '../../api'
import type { AssetGetResponse } from '../../api'

type Props = {
  projectId: string
  selectedNodeId: string
  asset: AssetGetResponse | null
  loading: boolean
  error: string | null
  onClose: () => void
  onOpenInteractions?: () => void
  canOpenInteractions?: boolean
  onRefresh?: () => void
}

export function AssetSidePanel(props: Props) {
  const title = props.asset?.resolvedPath ?? props.selectedNodeId

  const canEdit = useMemo(() => {
    return Boolean(props.asset) && props.selectedNodeId.startsWith('server:')
  }, [props.asset, props.selectedNodeId])

  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<{ kind: 'idle' | 'saving'; error?: string }>(
    { kind: 'idle' },
  )

  useEffect(() => {
    setIsEditing(false)
    setDraftError(null)
    setSaveStatus({ kind: 'idle' })
    if (props.asset) setDraft(JSON.stringify(props.asset.json, null, 2))
    else setDraft('')
  }, [props.selectedNodeId, props.asset])

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
      setIsEditing(false)
      setSaveStatus({ kind: 'idle' })
      props.onRefresh?.()
    } catch (e) {
      const msg = e instanceof HasApiError ? e.message : 'Unexpected error'
      setSaveStatus({ kind: 'idle', error: msg })
    }
  }

  function handleCancel(): void {
    setDraftError(null)
    setSaveStatus({ kind: 'idle' })
    setIsEditing(false)
    if (props.asset) setDraft(JSON.stringify(props.asset.json, null, 2))
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
            {props.asset?.origin ? `  •  origin: ${props.asset.origin}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              disabled={props.loading || saveStatus.kind === 'saving'}
              style={{
                padding: '4px 8px',
                background: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: 4,
                cursor: !props.loading && saveStatus.kind !== 'saving' ? 'pointer' : 'not-allowed',
                opacity: !props.loading && saveStatus.kind !== 'saving' ? 1 : 0.6,
              }}
              title="Editer en JSON (override)"
            >
              Edit
            </button>
          )}

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

      <div style={{ padding: 12, overflow: 'auto', flex: 1 }}>
        {props.loading && <div style={{ color: '#ccc', fontStyle: 'italic' }}>Chargement...</div>}
        {props.error && <div style={{ color: '#FF6B6B' }}>{props.error}</div>}
        {draftError && <div style={{ color: '#FF6B6B', marginBottom: 8 }}>{draftError}</div>}
        {saveStatus.error && <div style={{ color: '#FF6B6B', marginBottom: 8 }}>{saveStatus.error}</div>}

        {props.asset &&
          (isEditing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: 320,
                resize: 'vertical',
                margin: 0,
                padding: 10,
                background: '#1e1e1e',
                border: '1px solid #333',
                borderRadius: 6,
                color: '#fff',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 12,
                lineHeight: 1.35,
                outline: 'none',
              }}
            />
          ) : (
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
          ))}
      </div>
    </div>
  )
}
