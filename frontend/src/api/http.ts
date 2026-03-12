export type HasErrorPayload = {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

import { logPerf, measureAsync, isPerfAuditEnabled } from '../perf/audit'

export class HasApiError extends Error {
  status: number
  payload?: HasErrorPayload | unknown

  constructor(message: string, status: number, payload?: HasErrorPayload | unknown) {
    super(message)
    this.name = 'HasApiError'
    this.status = status
    this.payload = payload
  }
}

let activeWorkspaceId: string | null = null

export function setApiWorkspaceId(workspaceId: string | null): void {
  activeWorkspaceId = workspaceId
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function httpJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const requestUrl = typeof input === 'string' ? input : input.toString()
  const method = init?.method ?? 'GET'
  const res = await measureAsync(`http.${method}`, async () => fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(activeWorkspaceId ? { 'X-HAS-Workspace-Id': activeWorkspaceId } : {}),
      ...(init?.headers ?? {}),
    },
  }), { url: requestUrl })

  if (isPerfAuditEnabled()) {
    logPerf('http.server_timing', 0, {
      method,
      url: requestUrl,
      status: res.status,
      perfId: res.headers.get('X-HAS-Perf-Id') ?? 'n/a',
      serverTiming: res.headers.get('Server-Timing') ?? 'none',
      totalMs: res.headers.get('X-HAS-Perf-Total-Ms') ?? 'n/a',
    })
  }

  if (!res.ok) {
    const payload = await readJsonSafe(res)
    const msg = (() => {
      if (typeof payload === 'object' && payload) {
        if ('error' in payload) {
          return (payload as HasErrorPayload).error.message
        }
        if ('detail' in payload) {
          const detail = (payload as { detail?: unknown }).detail
          if (typeof detail === 'string') return detail
          try {
            return JSON.stringify(detail)
          } catch {
            // fallthrough
          }
        }
      }
      return `HTTP ${res.status}`
    })()
    throw new HasApiError(msg, res.status, payload)
  }

  return (await res.json()) as T
}
