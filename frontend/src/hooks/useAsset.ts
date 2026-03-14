import { useEffect, useRef, useState } from 'react'
import { HasApiError, hasApi } from '../api'
import type { AssetGetResponse } from '../api'

interface UseAssetResult {
  asset: AssetGetResponse | null
  loading: boolean
  error: string | null
  /** Increment to force a refresh without changing selectedNodeId. */
  reload: () => void
  reloadTick: number
}

/**
 * Fetch an asset by node ID whenever `projectId` or `selectedNodeId` changes.
 *
 * Pass `enabled = false` to skip the fetch (e.g. for common: nodes or external
 * nodes that are not server assets). The hook still resets its state in that case.
 */
export function useAsset(
  projectId: string,
  selectedNodeId: string | null,
  enabled = true,
): UseAssetResult {
  const [asset, setAsset] = useState<AssetGetResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const seq = useRef(0)

  const reload = () => setReloadTick((t) => t + 1)

  useEffect(() => {
    if (!enabled || !selectedNodeId) {
      setAsset(null)
      setError(null)
      setLoading(false)
      return
    }

    const mySeq = ++seq.current
    setLoading(true)
    setError(null)
    setAsset(null)

    ;(async () => {
      try {
        const a = await hasApi.assetGet(projectId, selectedNodeId)
        if (seq.current !== mySeq) return
        setAsset(a)
      } catch (e) {
        if (seq.current !== mySeq) return
        setError(e instanceof HasApiError ? e.message : 'Unexpected error')
      } finally {
        if (seq.current === mySeq) setLoading(false)
      }
    })()
  }, [projectId, selectedNodeId, enabled, reloadTick])

  return { asset, loading, error, reload, reloadTick }
}
