import type { ProjectInfo, WorkspaceOpenResponse } from '../api'

type Props = {
  workspaceRoot: string
  onWorkspaceRootChange: (v: string) => void
  onOpen: () => void
  isBusy: boolean
  error: string | null
  workspace: WorkspaceOpenResponse | null
  projects: ProjectInfo[]
  onSelectProject: (id: string) => void
}

export function HomePage(props: Props) {
  const { workspaceRoot, onWorkspaceRootChange, onOpen, isBusy, error, workspace, projects, onSelectProject } = props

  return (
    <div className="page-content">
      {/* ── Workspace card ── */}
      <div className="workspace-section">
        <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 16, color: '#eee', fontWeight: 700 }}>
          Open workspace
        </h2>
        <label className="studio-label">Workspace root path</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <input
            className="studio-input"
            value={workspaceRoot}
            onChange={(e) => onWorkspaceRootChange(e.target.value)}
            placeholder="K:/hytale-asset-studio-workspace"
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
          <p className="section-title">Projects</p>
          {projects.length === 0 ? (
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
