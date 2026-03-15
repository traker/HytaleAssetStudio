import type { Edge, Node } from '@xyflow/react'

type ElkLayoutNode = {
  id: string
  x?: number
  y?: number
}

type ElkLayoutResult = {
  children?: ElkLayoutNode[]
}

type ElkLayoutGraph = {
  id: string
  layoutOptions: Record<string, string>
  children: Array<{ id: string; width: number; height: number }>
  edges: Array<{ id: string; sources: string[]; targets: string[] }>
}

type ElkLayoutEngine = {
  layout: (graph: ElkLayoutGraph) => Promise<ElkLayoutResult>
}

let elkPromise: Promise<ElkLayoutEngine> | null = null

async function getElk(): Promise<ElkLayoutEngine> {
  if (!elkPromise) {
    elkPromise = import('elkjs/lib/elk.bundled.js').then(({ default: ELK }) => new ELK())
  }
  return elkPromise
}



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



export async function layoutGraphElk<TNode extends Node>(
  nodes: TNode[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'LR',
): Promise<{ nodes: TNode[]; edges: Edge[] }> {
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction === 'LR' ? 'RIGHT' : 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '140',
      'elk.spacing.nodeNode': '60',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: NODE_WIDTH,
      height: estimateNodeHeight(n),
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  } satisfies ElkLayoutGraph

  const elk = await getElk()
  const result = await elk.layout(elkGraph)

  const posMap = new Map<string, { x: number; y: number }>()
  for (const child of result.children ?? []) {
    if (child.x != null && child.y != null) {
      posMap.set(child.id, { x: child.x, y: child.y })
    }
  }

  for (const node of nodes) {
    const pos = posMap.get(node.id)
    if (pos) node.position = pos
  }

  return { nodes, edges }
}
