export type HasErrorPayload = {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export class HasApiError extends Error {
  status: number
  /** Structured error code from the backend (e.g. 'WORKSPACE_NOT_FOUND'). */
  code: string | undefined
  payload?: HasErrorPayload | unknown

  constructor(message: string, status: number, payload?: HasErrorPayload | unknown) {
    super(message)
    this.name = 'HasApiError'
    this.status = status
    this.payload = payload
    this.code =
      typeof payload === 'object' && payload && 'error' in payload
        ? (payload as HasErrorPayload).error.code
        : undefined
  }
}

const WS_ID_KEY = 'has_workspace_id'

export function setApiWorkspaceId(workspaceId: string | null): void {
  if (workspaceId === null) {
    sessionStorage.removeItem(WS_ID_KEY)
  } else {
    sessionStorage.setItem(WS_ID_KEY, workspaceId)
  }
}

export function buildHeaders(init?: RequestInit): HeadersInit {
  const wsId = sessionStorage.getItem(WS_ID_KEY)
  return {
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(wsId ? { 'X-HAS-Workspace-Id': wsId } : {}),
    ...(init?.headers ?? {}),
  }
}
