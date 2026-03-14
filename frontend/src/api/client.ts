import { logPerf, measureAsync, isPerfAuditEnabled } from '../perf/audit'
import { HasApiError, buildHeaders } from './workspaceSession'
import type { HasErrorPayload } from './workspaceSession'

async function readJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function httpFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const requestUrl = typeof input === 'string' ? input : input.toString()
  const method = init?.method ?? 'GET'
  const res = await measureAsync(`http.${method}`, async () => fetch(input, {
    ...init,
    headers: buildHeaders(init),
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
          const errPayload = payload as HasErrorPayload
          if (errPayload.error.code === 'WORKSPACE_NOT_FOUND') {
            return 'Session expirée — le serveur a redémarré. Veuillez rouvrir le workspace.'
          }
          return errPayload.error.message
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

  return res
}

export async function httpJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await httpFetch(input, init)
  return (await res.json()) as T
}
