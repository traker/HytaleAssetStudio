import { httpJson } from './http'
import type {
  AssetGetResponse,
  AssetPutRequest,
  AssetPutResponse,
  ExportZipRequest,
  ExportZipResponse,
  ModifiedAssetsResponse,
  OkResponse,
  ProjectConfig,
  ProjectCreateRequest,
  ProjectCreateResponse,
  ProjectGraphResponse,
  ProjectLayersPutRequest,
  ProjectSearchResponse,
  InteractionTreeResponse,
  WorkspaceOpenRequest,
  WorkspaceOpenResponse,
  WorkspaceProjectsResponse,
} from './types'

const API_BASE = '/api/v1'

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const hasApi = {
  workspaceOpen(req: WorkspaceOpenRequest): Promise<WorkspaceOpenResponse> {
    return httpJson(`${API_BASE}/workspace/open`, {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  workspaceProjects(workspaceId: string): Promise<WorkspaceProjectsResponse> {
    return httpJson(`${API_BASE}/workspace/${encodeURIComponent(workspaceId)}/projects`)
  },

  workspaceCreateProject(workspaceId: string, req: ProjectCreateRequest): Promise<ProjectCreateResponse> {
    return httpJson(`${API_BASE}/workspace/${encodeURIComponent(workspaceId)}/projects/create`, {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  projectConfig(projectId: string): Promise<ProjectConfig> {
    return httpJson(`${API_BASE}/projects/${encodeURIComponent(projectId)}/config`)
  },

  projectPutLayers(projectId: string, req: ProjectLayersPutRequest): Promise<OkResponse> {
    return httpJson(`${API_BASE}/projects/${encodeURIComponent(projectId)}/layers`, {
      method: 'PUT',
      body: JSON.stringify(req),
    })
  },

  projectSearch(projectId: string, q: string, limit = 50): Promise<ProjectSearchResponse> {
    return httpJson(
      `${API_BASE}/projects/${encodeURIComponent(projectId)}/search${qs({ q, limit })}`,
    )
  },

  projectGraph(projectId: string, root: string, depth = 2): Promise<ProjectGraphResponse> {
    return httpJson(
      `${API_BASE}/projects/${encodeURIComponent(projectId)}/graph${qs({ root, depth })}`,
    )
  },

  projectInteractionTree(projectId: string, root: string): Promise<InteractionTreeResponse> {
    return httpJson(
      `${API_BASE}/projects/${encodeURIComponent(projectId)}/interaction/tree${qs({ root })}`,
    )
  },

  assetGet(projectId: string, key: string): Promise<AssetGetResponse> {
    return httpJson(`${API_BASE}/projects/${encodeURIComponent(projectId)}/asset${qs({ key })}`)
  },

  assetPut(projectId: string, key: string, body: AssetPutRequest): Promise<AssetPutResponse> {
    return httpJson(`${API_BASE}/projects/${encodeURIComponent(projectId)}/asset${qs({ key })}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },

  exportZip(projectId: string, req: ExportZipRequest): Promise<ExportZipResponse> {
    return httpJson(`${API_BASE}/projects/${encodeURIComponent(projectId)}/export`, {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  projectModified(projectId: string): Promise<ModifiedAssetsResponse> {
    return httpJson(`${API_BASE}/projects/${encodeURIComponent(projectId)}/modified`)
  },

  browseDialog(mode: 'folder' | 'file', filter?: 'zip'): Promise<{ path: string | null }> {
    const params = new URLSearchParams({ mode })
    if (filter) params.set('filter', filter)
    return httpJson(`${API_BASE}/dialog/browse?${params.toString()}`)
  },
}
