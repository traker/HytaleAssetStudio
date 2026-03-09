import { useState } from 'react'
import './App.css'

import { HasApiError, hasApi } from './api'
import type { ProjectInfo, WorkspaceOpenResponse } from './api'
import { HomePage } from './views/HomePage'
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
      setError(e instanceof HasApiError ? e.message : 'Unexpected error')
    } finally {
      setIsBusy(false)
    }
  }

  function selectProject(id: string): void {
    setSelectedProjectId(id)
    setProjectView('config')
  }

  function backToHome(): void {
    setSelectedProjectId(null)
    setProjectView('config')
  }

  // Truncate long workspace path for breadcrumb display
  const workspaceCrumb = workspaceRoot.length > 36
    ? '…' + workspaceRoot.slice(-33)
    : workspaceRoot

  return (
    <div className="app-shell">
      {/* ── Top bar ── */}
      <header className="top-bar">
        <div className="top-bar-logo" onClick={backToHome} style={{ cursor: 'pointer' }}>
          <div className="top-bar-logo-icon">H</div>
          <span className="top-bar-title">Hytale Asset Studio</span>
        </div>

        <div className="top-bar-breadcrumb">
          {workspace && (
            <>
              <span className="top-bar-breadcrumb-item">{workspaceCrumb}</span>
              {selectedProjectId && (
                <>
                  <span className="top-bar-breadcrumb-sep">/</span>
                  <span className="top-bar-breadcrumb-item active">{selectedProjectId}</span>
                </>
              )}
            </>
          )}
        </div>

        {selectedProjectId && (
          <nav className="top-bar-nav">
            <button
              className={`top-bar-nav-btn${projectView === 'config' ? ' active' : ''}`}
              onClick={() => setProjectView('config')}
            >
              Config
            </button>
            <button
              className={`top-bar-nav-btn${projectView === 'graph-items' ? ' active' : ''}`}
              onClick={() => setProjectView('graph-items')}
            >
              Items
            </button>
            <button
              className={`top-bar-nav-btn${projectView === 'graph-interactions' ? ' active' : ''}`}
              onClick={() => setProjectView('graph-interactions')}
              disabled={!interactionRoot}
              title={!interactionRoot ? 'Open from an item node first' : undefined}
            >
              Interactions
            </button>
            <button
              className={`top-bar-nav-btn${projectView === 'modified' ? ' active' : ''}`}
              onClick={() => setProjectView('modified')}
            >
              Modified
            </button>
            <button className="top-bar-nav-btn" onClick={backToHome} style={{ color: '#444' }}>
              ← Projects
            </button>
          </nav>
        )}
      </header>

      {/* ── Shell views ── */}
      {!selectedProjectId ? (
        <HomePage
          workspaceRoot={workspaceRoot}
          onWorkspaceRootChange={setWorkspaceRoot}
          onOpen={openWorkspace}
          isBusy={isBusy}
          error={error}
          workspace={workspace}
          projects={projects}
          onSelectProject={selectProject}
        />
      ) : projectView === 'graph-items' ? (
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
        <div className="page-content">
          <ProjectModifiedAssetsView
            projectId={selectedProjectId}
            onBack={() => setProjectView('config')}
          />
        </div>
      ) : (
        <ProjectConfigView
          projectId={selectedProjectId}
          onBack={backToHome}
          onOpenGraphItems={() => setProjectView('graph-items')}
          onOpenModified={() => setProjectView('modified')}
        />
      )}
    </div>
  )
}

export default App
