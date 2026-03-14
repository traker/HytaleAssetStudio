import { useEffect, useState } from 'react'
import './App.css'

import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import { HomePage } from './views/HomePage'
import { ProjectConfigView } from './views/ProjectConfigView'
import { ProjectGraphItemsView } from './views/project/ProjectGraphItemsView'
import { ProjectGraphInteractionsView } from './views/project/ProjectGraphInteractionsView'
import { ProjectModifiedGraphView } from './views/project/ProjectModifiedGraphView'

type ProjectView = 'config' | 'graph-items' | 'graph-interactions' | 'modified'
type GraphRoot = { assetKey: string; display: string }

function AppShell() {
  const { workspace, refreshProjects } = useWorkspace()
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectView, setProjectView] = useState<ProjectView>('config')
  const [itemRoot, setItemRoot] = useState<GraphRoot | null>(null)
  const [interactionRoot, setInteractionRoot] = useState<GraphRoot | null>(null)

  // Reset navigation when workspace changes (re-open / session expired)
  useEffect(() => {
    setSelectedProjectId(null)
    setProjectView('config')
    setItemRoot(null)
    setInteractionRoot(null)
  }, [workspace])

  function selectProject(id: string): void {
    setSelectedProjectId(id)
    setProjectView('config')
    setItemRoot(null)
    setInteractionRoot(null)
  }

  async function refreshAndSelect(projectId: string): Promise<void> {
    await refreshProjects()
    selectProject(projectId)
  }

  function backToHome(): void {
    setSelectedProjectId(null)
    setProjectView('config')
    setItemRoot(null)
    setInteractionRoot(null)
  }

  const workspaceCrumb = (workspace?.rootPath ?? '').length > 36
    ? '…' + (workspace?.rootPath ?? '').slice(-33)
    : (workspace?.rootPath ?? '')

  return (
    <div className="app-shell">
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
            <button className={`top-bar-nav-btn${projectView === 'config' ? ' active' : ''}`} onClick={() => setProjectView('config')}>Config</button>
            <button className={`top-bar-nav-btn${projectView === 'graph-items' ? ' active' : ''}`} onClick={() => setProjectView('graph-items')}>Items</button>
            <button
              className={`top-bar-nav-btn${projectView === 'graph-interactions' ? ' active' : ''}`}
              onClick={() => setProjectView('graph-interactions')}
              disabled={!interactionRoot}
              title={!interactionRoot ? 'Open from an item node first' : undefined}
            >Interactions</button>
            {!interactionRoot && (
              <span
                style={{
                  fontSize: 10,
                  color: '#8c8ca5',
                  padding: '3px 8px',
                  borderRadius: 999,
                  border: '1px solid #2e2e4a',
                  background: '#171724',
                  whiteSpace: 'nowrap',
                }}
                title="Open Items, select an item, then use Open Interactions"
              >
                Pick an item in Items to unlock Interactions
              </span>
            )}
            <button className={`top-bar-nav-btn${projectView === 'modified' ? ' active' : ''}`} onClick={() => setProjectView('modified')}>Modified</button>
            <button className="top-bar-nav-btn" onClick={backToHome} style={{ color: '#444' }}>← Projects</button>
          </nav>
        )}
      </header>

      {!selectedProjectId ? (
        <HomePage onSelectProject={selectProject} onProjectCreated={refreshAndSelect} />
      ) : (
        <>
          <div style={{ display: projectView === 'graph-items' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
            <ProjectGraphItemsView
              projectId={selectedProjectId}
              root={itemRoot}
              onBack={() => setProjectView('config')}
              onOpenInteractions={(root) => { setItemRoot(root); setInteractionRoot(root); setProjectView('graph-interactions') }}
            />
          </div>
          <div style={{ display: projectView === 'graph-interactions' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
            <ProjectGraphInteractionsView
              projectId={selectedProjectId}
              root={interactionRoot}
              onBack={() => setProjectView('graph-items')}
              onOpenReference={(root) => { setInteractionRoot(root); setProjectView('graph-interactions') }}
            />
          </div>
          <div style={{ display: projectView === 'modified' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
            <ProjectModifiedGraphView
              projectId={selectedProjectId}
              onBack={() => setProjectView('config')}
              onOpenInteractions={(root) => { setInteractionRoot(root); setProjectView('graph-interactions') }}
            />
          </div>
          {projectView === 'config' && (
            <ProjectConfigView
              projectId={selectedProjectId}
              onBack={backToHome}
              onOpenGraphItems={() => setProjectView('graph-items')}
              onOpenModified={() => setProjectView('modified')}
            />
          )}
        </>
      )}
    </div>
  )
}

function App() {
  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  )
}

export default App
