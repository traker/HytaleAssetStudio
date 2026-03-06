import type { Edge, Node } from '@xyflow/react'
import dagre from 'dagre'

export function layoutGraph(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'LR'): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  const nodeWidth = 350
  const nodeHeight = 80

  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 120 })

  for (const node of nodes) {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  }
  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target)
  }

  dagre.layout(dagreGraph)

  for (const node of nodes) {
    const p = dagreGraph.node(node.id)
    node.position = { x: p.x - nodeWidth / 2, y: p.y - nodeHeight / 2 }
  }

  return { nodes, edges }
}
