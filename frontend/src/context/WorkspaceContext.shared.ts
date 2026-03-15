import { createContext } from 'react'
import type { ProjectInfo, WorkspaceOpenResponse } from '../api'

export type WorkspaceContextValue = {
  workspaceRoot: string
  setWorkspaceRoot: (value: string) => void
  workspace: WorkspaceOpenResponse | null
  projects: ProjectInfo[]
  isBusy: boolean
  error: string | null
  openWorkspace: () => Promise<void>
  refreshProjects: () => Promise<void>
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)