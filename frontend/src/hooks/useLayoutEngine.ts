import { useCallback, useState } from 'react'

export type LayoutEngine = 'dagre' | 'elk'

const STORAGE_KEY = 'has.layout-engine'

export function useLayoutEngine() {
  const [engine, setEngine] = useState<LayoutEngine>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'dagre' ? 'dagre' : 'elk'
  })

  const toggleEngine = useCallback(() => {
    setEngine((prev) => {
      const next: LayoutEngine = prev === 'dagre' ? 'elk' : 'dagre'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  return { engine, toggleEngine }
}
