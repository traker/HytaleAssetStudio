import { useState } from 'react'
import { HasApiError, hasApi } from '../api'
import type { ProjectInfo, WorkspaceOpenResponse } from '../api'
import { PathInput } from '../components/ui/PathInput'

type Props = {
  workspaceRoot: string
  onWorkspaceRootChange: (v: string) => void
  onOpen: () => void
  isBusy: boolean
  error: string | null
  workspace: WorkspaceOpenResponse | null
  projects: ProjectInfo[]
  onSelectProject: (id: string) => void
  onProjectCreated: (projectId: string) => void
}

export function HomePage(props: Props) {
  const { workspaceRoot, onWorkspaceRootChange, onOpen, isBusy, error, workspace, projects, onSelectProject, onProjectCreated } = props

  // ── New project form state ──
  const [showCreate, setShowCreate] = useState(false)
  const [createId, setCreateId] = useState('')
  const [createName, setCreateName] = useState('')
  const [createDir, setCreateDir] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  function openCreateForm(): void {
    setCreateId('')
    setCreateName('')
    setCreateDir('')
    setCreateError(null)
    setShowCreate(true)
  }

  function deriveDir(id: string): string {
    if (!workspace) return id
    const base = workspace.projectsDir.replace(/[\/\\]$/, '')
    return id ? `${base}/${id}` : base
  }

  function handleIdChange(v: string): void {
    setCreateId(v)
    // Auto-fill dir only while it hasn't been manually edited
    setCreateDir(deriveDir(v))
  }

  async function handleCreate(): Promise<void> {
    if (!workspace) return
    const id = createId.trim()
    const dir = createDir.trim()
    if (!id || !dir) { setCreateError('Project ID and directory are required'); return }

    setCreating(true)
    setCreateError(null)
    try {
      const res = await hasApi.workspaceCreateProject(workspace.workspaceId, {
        projectId: id,
        displayName: createName.trim() || id,
        targetDir: dir,
        vanilla: workspace.defaults?.vanilla ?? { sourceType: 'folder', path: '' },
      })
      setShowCreate(false)
      onProjectCreated(res.projectId)
    } catch (e) {
      setCreateError(e instanceof HasApiError ? e.message : 'Unexpected error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="page-content">
      {/* ── Workspace card ── */}
      <div className="workspace-section">
        <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 16, color: '#eee', fontWeight: 700 }}>
          Open workspace
        </h2>
        <label className="studio-label">Workspace root path</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <PathInput
            value={workspaceRoot}
            onChange={onWorkspaceRootChange}
            placeholder="K:/hytale-asset-studio-workspace"
            sourceType="folder"
            disabled={isBusy}
            style={{ flex: 1 }}
            onKeyDown={(e) => e.key === 'Enter' && !isBusy && onOpen()}
          />
          <button
            className="btn btn-primary"
            onClick={onOpen}
            disabled={isBusy || workspaceRoot.trim().length === 0}
            style={{ flexShrink: 0 }}
          >
            {isBusy ? 'Opening…' : 'Open'}
          </button>
        </div>
        {error && <p className="error-msg">{error}</p>}
      </div>

      {/* ── Projects list ── */}
      {workspace && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p className="section-title" style={{ marginBottom: 0 }}>Projects</p>
            <button className="btn btn-secondary" onClick={openCreateForm} style={{ fontSize: 11 }}>
              + New project
            </button>
          </div>

          {/* ── New project form ── */}
          {showCreate && (
            <div className="card" style={{ marginBottom: 16 }}>
              <p className="section-title" style={{ marginBottom: 14 }}>Create new project</p>
              <div className="config-grid" style={{ gridTemplateColumns: '120px 1fr', marginBottom: 12 }}>
                <label>Project ID *</label>
                <input
                  className="studio-input"
                  value={createId}
                  onChange={(e) => handleIdChange(e.target.value)}
                  placeholder="my-project"
                  autoFocus
                />

                <label>Display name</label>
                <input
                  className="studio-input"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="My Project"
                />

                <label>Directory *</label>
                <PathInput
                  value={createDir}
                  onChange={setCreateDir}
                  placeholder={deriveDir('my-project')}
                  sourceType="folder"
                  disabled={creating}
                />
              </div>

              {createError && <p className="error-msg">{createError}</p>}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !createId.trim() || !createDir.trim()}>
                  {creating ? 'Creating…' : 'Create'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowCreate(false)} disabled={creating}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {projects.length === 0 && !showCreate ? (
            <p style={{ color: '#555', fontSize: 13 }}>No projects found in this workspace.</p>
          ) : (
            <div className="project-grid">
              {projects.map((p) => (
                <button
                  key={p.projectId}
                  className="project-card"
                  onClick={() => onSelectProject(p.projectId)}
                >
                  <span className="project-card-id">{p.projectId}</span>
                  {p.displayName && (
                    <span className="project-card-name">{p.displayName}</span>
                  )}
                  <span className="project-card-arrow">Open →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
