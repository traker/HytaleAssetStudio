import { useMemo, useState } from 'react'
import './App.css'

import { HasApiError, hasApi } from './api'
import type { ProjectInfo, WorkspaceOpenResponse } from './api'
import { ProjectConfigView } from './views/ProjectConfigView'
import { ProjectGraphItemsView } from './views/project/ProjectGraphItemsView'
import { ProjectGraphInteractionsView } from './views/project/ProjectGraphInteractionsView'
import { ProjectModifiedAssetsView } from './views/project/ProjectModifiedAssetsView'

type ProjectView = 'config' | 'graph-items' | 'graph-interactions' | 'modified'

type GraphRoot = { assetKey: string; display: string }

function App() {
  const [workspaceRoot, setWorkspaceRoot] = useState('K:/hytale-asset-studio-workspace')
  const [workspace, setWorkspace] = useState<WorkspaceOpenResponse | null>(null)
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectView, setProjectView] = useState<ProjectView>('config')

  const [interactionRoot, setInteractionRoot] = useState<GraphRoot | null>(null)

  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canOpen = useMemo(() => workspaceRoot.trim().length > 0 && !isBusy, [workspaceRoot, isBusy])

  async function openWorkspace(): Promise<void> {
    setIsBusy(true)
    setError(null)
    setSelectedProjectId(null)
    try {
      const ws = await hasApi.workspaceOpen({ rootPath: workspaceRoot.trim() })
      setWorkspace(ws)

      const resp = await hasApi.workspaceProjects(ws.workspaceId)
      setProjects(resp.projects)
    } catch (e) {
      if (e instanceof HasApiError) {
        setError(e.message)
      } else {
        setError('Unexpected error')
      }
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <>
      {!(selectedProjectId && projectView !== 'config') && <h1>Hytale Asset Studio</h1>}

      {selectedProjectId ? (
        projectView === 'graph-items' ? (
          <ProjectGraphItemsView
            projectId={selectedProjectId}
            onBack={() => setProjectView('config')}
            onOpenInteractions={(root) => {
              setInteractionRoot(root)
              setProjectView('graph-interactions')
            }}
          />
        ) : projectView === 'graph-interactions' ? (
          <ProjectGraphInteractionsView
            projectId={selectedProjectId}
            root={interactionRoot}
            onBack={() => setProjectView('graph-items')}
          />
        ) : projectView === 'modified' ? (
          <ProjectModifiedAssetsView projectId={selectedProjectId} onBack={() => setProjectView('config')} />
        ) : (
          <ProjectConfigView
            projectId={selectedProjectId}
            onBack={() => {
              setSelectedProjectId(null)
              setProjectView('config')
            }}
            onOpenGraphItems={() => setProjectView('graph-items')}
            onOpenModified={() => setProjectView('modified')}
          />
        )
      ) : (
        <>

          <div className="card" style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 8 }}>Workspace root</label>
            <input
              style={{ width: '100%', marginBottom: 12 }}
              value={workspaceRoot}
              onChange={(e) => setWorkspaceRoot(e.target.value)}
              placeholder="K:/hytale-asset-studio-workspace"
            />

            <button onClick={openWorkspace} disabled={!canOpen}>
              {isBusy ? 'Opening…' : 'Open workspace'}
            </button>

            {error && (
              <p style={{ marginTop: 12, color: 'salmon' }}>
                {error}
              </p>
            )}
          </div>

          {workspace && (
            <div className="card" style={{ textAlign: 'left' }}>
              <h2 style={{ marginTop: 0 }}>Projects</h2>
              <p style={{ marginTop: 0, opacity: 0.8 }}>workspaceId: {workspace.workspaceId}</p>
              {projects.length === 0 ? (
                <p>No projects found.</p>
              ) : (
                <ul style={{ paddingLeft: 18 }}>
                  {projects.map((p) => (
                    <li key={p.projectId} style={{ marginBottom: 8 }}>
                      <button onClick={() => setSelectedProjectId(p.projectId)} style={{ marginRight: 8 }}>
                        Open
                      </button>
                      <strong>{p.projectId}</strong>
                      {p.displayName ? ` — ${p.displayName}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}

export default App
