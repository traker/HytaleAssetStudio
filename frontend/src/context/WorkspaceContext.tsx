import { useState, type ReactNode } from 'react'
import { HasApiError, hasApi } from '../api'
import type { ProjectInfo, WorkspaceOpenResponse } from '../api'
import { WorkspaceContext } from './WorkspaceContext.shared'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceRoot, setWorkspaceRoot] = useState(
    (import.meta.env.VITE_DEFAULT_WORKSPACE_ROOT as string | undefined) ?? '',
  )
  const [workspace, setWorkspace] = useState<WorkspaceOpenResponse | null>(null)
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openWorkspace(): Promise<void> {
    setIsBusy(true)
    setError(null)
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

  async function refreshProjects(): Promise<void> {
    if (!workspace) return
    try {
      const resp = await hasApi.workspaceProjects(workspace.workspaceId)
      setProjects(resp.projects)
      setError(null)
    } catch (e) {
      setError(e instanceof HasApiError ? e.message : 'Project list refresh failed')
    }
  }

  return (
    <WorkspaceContext.Provider
      value={{ workspaceRoot, setWorkspaceRoot, workspace, projects, isBusy, error, openWorkspace, refreshProjects }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}
