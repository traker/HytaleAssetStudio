export type SourceType = 'folder' | 'zip'

export type PackSource = {
  sourceType: SourceType
  path: string
}

export type WorkspaceOpenRequest = {
  rootPath: string
}

export type WorkspaceOpenResponse = {
  workspaceId: string
  rootPath: string
  projectsDir: string
  defaults: { vanilla: PackSource }
}

export type ProjectInfo = {
  projectId: string
  displayName?: string | null
  rootPath: string
  assetsWritePath: string
  status: 'ready' | 'invalid'
  errorMessage?: string | null
}

export type WorkspaceProjectsResponse = {
  projects: ProjectInfo[]
}

export type ProjectLayer = {
  id: string
  displayName?: string | null
  sourceType: SourceType
  path: string
  enabled: boolean
}

export type ProjectConfig = {
  schemaVersion: number
  project: {
    id: string
    displayName: string
    rootPath: string
    assetsWritePath: string
  }
  vanilla: PackSource
  layers: ProjectLayer[]
}

export type ProjectLayersPutRequest = {
  vanilla: PackSource
  layers: ProjectLayer[]
}

export type OkResponse = { ok: true }

export type SearchResult = {
  assetKey: string
  kind: 'server-json'
  display: string
  origin: 'vanilla' | 'dependency' | 'project'
  group?: string
  path?: string
  ambiguous?: boolean
  ambiguousId?: string
  candidatePaths?: string[]
}

export type ProjectSearchResponse = {
  results: SearchResult[]
}

export type GraphNode = {
  id: string
  label: string
  title?: string
  group?: string
  path?: string
  state: 'vanilla' | 'local'
}

export type GraphEdge = {
  from: string
  to: string
  type: string
}

export type ProjectGraphResponse = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** IDs of the roots (only present in /graph-modified response) */
  modifiedIds?: string[]
}

export type AssetGetResponse = {
  assetKey: string
  resolvedPath: string
  origin: 'vanilla' | 'dependency' | 'project'
  json: Record<string, unknown>
}

export type AssetPutRequest = {
  json: Record<string, unknown>
  mode: 'override' | 'copy'
  newId?: string
}

export type AssetPutResponse = {
  ok: true
  assetKey: string
  resolvedPath: string
  origin: 'project'
}

export type ExportZipRequest = { outputPath: string }
export type ExportZipResponse = { ok: true; outputPath: string }

export type ProjectManifestAuthor = {
  Name: string
  Email?: string
  Url?: string
}

export type ProjectManifest = {
  Group: string
  Name: string
  Version: string
  Description?: string
  Authors?: ProjectManifestAuthor[]
  Website?: string
  ServerVersion?: string
  Dependencies?: Record<string, string>
  OptionalDependencies?: Record<string, string>
  DisabledByDefault?: boolean
  IncludesAssetPack?: boolean
}

export type ProjectCreateRequest = {
  projectId: string
  displayName: string
  targetDir: string
  vanilla: PackSource
  manifest?: Record<string, unknown> | null
}

export type ProjectCreateResponse = {
  projectId: string
  rootPath: string
  assetsWritePath: string
  configPath: string
}

export type ModifiedAssetEntry = {
  kind: 'server-json' | 'common-resource'
  vfsPath: string
  assetKey: string | null
  size: number
  mtimeMs: number
  origin: 'project'
  isNew: boolean
}

export type ModifiedAssetsResponse = {
  projectId: string
  count: number
  entries: ModifiedAssetEntry[]
}

export type InteractionTreeNode = {
  id: string
  type: string
  label: string
  isExternal: boolean
  rawFields?: Record<string, unknown>
}

export type InteractionTreeEdge = {
  from: string
  to: string
  type: string
}

export type InteractionTreeResponse = {
  root: string
  nodes: InteractionTreeNode[]
  edges: InteractionTreeEdge[]
}
