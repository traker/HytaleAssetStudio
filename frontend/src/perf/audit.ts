type PerfMeta = Record<string, unknown>

let activationLogged = false

function canUseWindow(): boolean {
  return typeof window !== 'undefined'
}

export function isPerfAuditEnabled(): boolean {
  if (!canUseWindow()) return false
  try {
    if (window.location.search.includes('perfAudit=1')) return true
    return window.localStorage.getItem('hasPerfAudit') === '1'
  } catch {
    return false
  }
}

function formatMeta(meta?: PerfMeta): string {
  if (!meta) return ''
  const entries = Object.entries(meta)
  if (entries.length === 0) return ''
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(' ')
}

export function logPerf(label: string, durationMs: number, meta?: PerfMeta): void {
  if (!isPerfAuditEnabled()) return
  const suffix = formatMeta(meta)
  console.info(`[HAS PERF] ${label} ${durationMs.toFixed(2)}ms${suffix ? ` ${suffix}` : ''}`)
}

export function announcePerfAuditEnabled(): void {
  if (!isPerfAuditEnabled() || activationLogged) return
  activationLogged = true
  console.info('[HAS PERF] frontend audit enabled')
}

export function startPerfSpan(label: string, meta?: PerfMeta): () => void {
  const start = performance.now()
  return () => logPerf(label, performance.now() - start, meta)
}

export async function measureAsync<T>(label: string, run: () => Promise<T>, meta?: PerfMeta): Promise<T> {
  const end = startPerfSpan(label, meta)
  try {
    return await run()
  } finally {
    end()
  }
}

export function measureSync<T>(label: string, run: () => T, meta?: PerfMeta): T {
  const end = startPerfSpan(label, meta)
  try {
    return run()
  } finally {
    end()
  }
}

export function schedulePaintMeasure(label: string, startMs: number, meta?: PerfMeta): void {
  if (!isPerfAuditEnabled()) return
  requestAnimationFrame(() => {
    logPerf(label, performance.now() - startMs, meta)
  })
}