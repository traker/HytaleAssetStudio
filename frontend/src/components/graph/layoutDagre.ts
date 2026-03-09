import type { Edge, Node } from '@xyflow/react'
import dagre from 'dagre'

const NODE_WIDTH = 260
const NODE_HEIGHT_BASE = 80   // header + label + path
const NODE_HEIGHT_DEP_ROW = 26 // per outgoing dep row
const NODE_HEIGHT_DEP_HEADER = 22 // "Dépendances" label
const NODE_HEIGHT_MAX_DEPS = 400 // capped to maxHeight of scroll area

function estimateNodeHeight(node: Node): number {
  const outgoing = (node.data as any)?.outgoing
  if (!outgoing || outgoing.length === 0) return NODE_HEIGHT_BASE
  const visibleRows = Math.min(outgoing.length, Math.floor(NODE_HEIGHT_MAX_DEPS / NODE_HEIGHT_DEP_ROW))
  return NODE_HEIGHT_BASE + NODE_HEIGHT_DEP_HEADER + visibleRows * NODE_HEIGHT_DEP_ROW + 8
}

export function layoutGraph(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'LR'): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 140 })

  for (const node of nodes) {
    const h = estimateNodeHeight(node)
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: h })
  }
  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target)
  }

  dagre.layout(dagreGraph)

  for (const node of nodes) {
    const p = dagreGraph.node(node.id)
    node.position = { x: p.x - NODE_WIDTH / 2, y: p.y - p.height / 2 }
  }

  return { nodes, edges }
}
