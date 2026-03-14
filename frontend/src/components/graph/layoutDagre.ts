import type { Edge, Node } from '@xyflow/react'
import dagre from 'dagre'

import { measureSync } from '../../perf/audit'

const LAYOUT_CACHE_LIMIT = 24
const layoutCache = new Map<string, Map<string, { x: number; y: number }>>()

/** Maximum nodes passed to Dagre before truncating the graph.
 *  Beyond this limit the synchronous Dagre layout freezes the main thread.
 *  TODO: consider offloading to a Web Worker for large graphs. */
export const MAX_DAGRE_NODES = 200

const NODE_WIDTH = 260
const NODE_HEIGHT_BASE = 80   // header + label + path
const NODE_HEIGHT_DEP_ROW = 26 // per outgoing dep row
const NODE_HEIGHT_DEP_HEADER = 22 // "Dépendances" label
const NODE_HEIGHT_MAX_DEPS = 400 // capped to maxHeight of scroll area

function getOutgoingCount(node: Node): number {
  const data = node.data
  if (!data || typeof data !== 'object' || !('outgoing' in data)) {
    return 0
  }

  const outgoing = data.outgoing
  return Array.isArray(outgoing) ? outgoing.length : 0
}

function estimateNodeHeight(node: Node): number {
  const outgoingCount = getOutgoingCount(node)
  if (outgoingCount === 0) return NODE_HEIGHT_BASE
  const visibleRows = Math.min(outgoingCount, Math.floor(NODE_HEIGHT_MAX_DEPS / NODE_HEIGHT_DEP_ROW))
  return NODE_HEIGHT_BASE + NODE_HEIGHT_DEP_HEADER + visibleRows * NODE_HEIGHT_DEP_ROW + 8
}

function makeLayoutCacheKey(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR'): string {
  const nodeKey = nodes
    .map((node) => `${node.id}:${estimateNodeHeight(node)}`)
    .join('|')
  const edgeKey = edges
    .map((edge) => `${edge.source}->${edge.target}`)
    .join('|')
  return `${direction}::${nodeKey}::${edgeKey}`
}

function getCachedLayout(key: string): Map<string, { x: number; y: number }> | undefined {
  const cached = layoutCache.get(key)
  if (!cached) return undefined

  layoutCache.delete(key)
  layoutCache.set(key, cached)
  return cached
}

function setCachedLayout(key: string, positions: Map<string, { x: number; y: number }>): void {
  layoutCache.set(key, positions)
  if (layoutCache.size <= LAYOUT_CACHE_LIMIT) return

  const oldestKey = layoutCache.keys().next().value
  if (oldestKey) {
    layoutCache.delete(oldestKey)
  }
}

export function layoutGraph<TNode extends Node>(nodes: TNode[], edges: Edge[], direction: 'TB' | 'LR' = 'LR'): { nodes: TNode[]; edges: Edge[]; truncatedAt?: number } {
  return measureSync('graph.layout_dagre', () => {
    let truncatedAt: number | undefined
    let layoutNodes = nodes
    let layoutEdges = edges

    if (nodes.length > MAX_DAGRE_NODES) {
      truncatedAt = nodes.length
      layoutNodes = nodes.slice(0, MAX_DAGRE_NODES)
      const visibleIds = new Set(layoutNodes.map((n) => n.id))
      layoutEdges = edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
    }

    const cacheKey = makeLayoutCacheKey(layoutNodes, layoutEdges, direction)
    const cachedPositions = getCachedLayout(cacheKey)
    if (cachedPositions) {
      for (const node of layoutNodes) {
        const position = cachedPositions.get(node.id)
        if (!position) continue
        node.position = position
      }
      return { nodes: layoutNodes, edges: layoutEdges, truncatedAt }
    }

    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 140 })

    for (const node of layoutNodes) {
      const h = estimateNodeHeight(node)
      dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: h })
    }
    for (const edge of layoutEdges) {
      dagreGraph.setEdge(edge.source, edge.target)
    }

    dagre.layout(dagreGraph)

    const positions = new Map<string, { x: number; y: number }>()

    for (const node of layoutNodes) {
      const p = dagreGraph.node(node.id)
      const position = { x: p.x - NODE_WIDTH / 2, y: p.y - p.height / 2 }
      node.position = position
      positions.set(node.id, position)
    }

    setCachedLayout(cacheKey, positions)

    return { nodes: layoutNodes, edges: layoutEdges, truncatedAt }
  }, { direction, nodes: nodes.length, edges: edges.length })
}
