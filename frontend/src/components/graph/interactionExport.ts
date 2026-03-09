/**
 * Converts a ReactFlow graph (nodes + edges) back to the Hytale JSON interaction format.
 *
 * Rules:
 * - External nodes (data.isExternal = true) → emitted as a bare server-ID string
 * - Internal nodes (data.isExternal = false) → emitted as an inline object { Type, ...fields }
 * - Edge type "next"  → stored in result["Next"]
 * - Edge type "failed" → stored in result["Failed"]
 * - Edge type "child"  → appended to result["Interactions"]
 * - Cycles / multi-parent situations are handled conservatively (emit ref string on revisit)
 *
 * Charging special case: Next is stored as a dict-time in rawFields (key "Next" is already
 * the timed dict) — we preserve it from rawFields and only override if a graph edge overrides it.
 */

import type { Edge, Node } from '@xyflow/react'

export interface ExportResult {
  json: unknown
  errors: string[]
}

/**
 * Build the Hytale JSON for a single root node, walking the graph recursively.
 * @param rootNodeId  ID of the root node in the ReactFlow graph
 * @param nodes       All ReactFlow nodes
 * @param edges       All ReactFlow edges (should have `data.edgeType` or we infer from label)
 */
export function exportInteractionTree(
  rootNodeId: string,
  nodes: Node[],
  edges: Edge[],
): ExportResult {
  const errors: string[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // Collect all outgoing edges per source node
  const edgesBySource = new Map<string, Edge[]>()
  for (const e of edges) {
    if (!edgesBySource.has(e.source)) edgesBySource.set(e.source, [])
    edgesBySource.get(e.source)!.push(e)
  }

  /**
   * Determine the semantic edge type from an edge object.
   * Priority: data.edgeType → edge label → 'child'
   */
  function resolveEdgeType(e: Edge): string {
    const dt = (e.data as Record<string, unknown> | undefined)?.edgeType
    if (typeof dt === 'string') return dt
    if (typeof e.label === 'string') return e.label
    return 'child'
  }

  /**
   * Recursively convert a node into its JSON representation.
   * `ancestors` guards against infinite loops.
   */
  function buildNode(nodeId: string, ancestors: ReadonlySet<string> = new Set()): unknown {
    const node = nodeMap.get(nodeId)
    if (!node) {
      errors.push(`Node not found: ${nodeId}`)
      return null
    }

    const data = node.data as Record<string, unknown>

    // External node → bare server-ID string (strip "server:" prefix)
    if (data.isExternal) {
      return nodeId.startsWith('server:') ? nodeId.slice('server:'.length) : nodeId
    }

    // Cycle guard → emit as ref string
    if (ancestors.has(nodeId)) {
      errors.push(`Cycle detected at node ${nodeId}, emitting as reference string`)
      const label = String(data.label ?? nodeId)
      return label
    }

    const newAncestors = new Set(ancestors).add(nodeId)

    // Start from rawFields (preserves fields the form panel may not know about)
    const rawFields = (data.rawFields as Record<string, unknown> | undefined) ?? {}
    const result: Record<string, unknown> = { ...rawFields }

    // Ensure Type is present
    if (data.nodeType && typeof data.nodeType === 'string' && data.nodeType !== 'Root') {
      result['Type'] = data.nodeType
    }

    // Remove edge-derived keys — we'll rebuild them from the graph edges
    // (so the user's graph connections always win over stale rawFields)
    delete result['Next']
    delete result['Failed']
    delete result['Interactions']
    delete result['ForkInteractions']
    delete result['CollisionNext']
    delete result['GroundNext']
    delete result['StartInteraction']
    delete result['CancelInteraction']

    const outEdges = edgesBySource.get(nodeId) ?? []

    const nextEdges = outEdges.filter((e) => resolveEdgeType(e) === 'next')
    const failedEdges = outEdges.filter((e) => resolveEdgeType(e) === 'failed')
    const childEdges = outEdges.filter((e) => resolveEdgeType(e) === 'child')

    // "Next" — single or ignored if multiple (ambiguous)
    if (nextEdges.length === 1) {
      result['Next'] = buildNode(nextEdges[0].target, newAncestors)
    } else if (nextEdges.length > 1) {
      // Charging uses a time-dict; preserve rawFields.Next in that case
      if (rawFields['Next'] && typeof rawFields['Next'] === 'object' && !Array.isArray(rawFields['Next'])) {
        result['Next'] = rawFields['Next']
      } else {
        errors.push(`Node ${nodeId} has ${nextEdges.length} "next" edges — only first used`)
        result['Next'] = buildNode(nextEdges[0].target, newAncestors)
      }
    }

    // "Failed"
    if (failedEdges.length === 1) {
      result['Failed'] = buildNode(failedEdges[0].target, newAncestors)
    } else if (failedEdges.length > 1) {
      errors.push(`Node ${nodeId} has ${failedEdges.length} "failed" edges — only first used`)
      result['Failed'] = buildNode(failedEdges[0].target, newAncestors)
    }

    // "Interactions" (child edges)
    if (childEdges.length > 0) {
      result['Interactions'] = childEdges.map((e) => buildNode(e.target, newAncestors))
    }

    return result
  }

  // The root node is usually type "Root" (external wrapper) pointing to the real interaction.
  // We expect one child edge from root → the real root interaction.
  const rootOutEdges = edgesBySource.get(rootNodeId) ?? []
  if (rootOutEdges.length === 0) {
    // No children from root — maybe the root IS the interaction itself
    const rootNode = nodeMap.get(rootNodeId)
    const rootData = rootNode?.data as Record<string, unknown> | undefined
    if (rootData?.nodeType === 'Root' || rootData?.isExternal) {
      return { json: null, errors: ['Root node has no children'] }
    }
    return { json: buildNode(rootNodeId), errors }
  }

  // If exactly one child: return just that child's JSON (typical: root → Charging)
  if (rootOutEdges.length === 1) {
    return { json: buildNode(rootOutEdges[0].target), errors }
  }

  // Multiple children from root: wrap them under root's structure
  const rootNode = nodeMap.get(rootNodeId)
  const rootData = rootNode?.data as Record<string, unknown> | undefined
  const rootRaw = (rootData?.rawFields as Record<string, unknown> | undefined) ?? {}
  const rootResult: Record<string, unknown> = { ...rootRaw }
  rootResult['Interactions'] = rootOutEdges.map((e) => buildNode(e.target))
  return { json: rootResult, errors }
}

/**
 * Checks if a node ID was created by us (vs loaded from database).
 * New nodes get IDs like "internal:new_1234567890_abc"
 */
export function isNewNode(nodeId: string): boolean {
  return nodeId.startsWith('internal:new_')
}

/**
 * Given a type string, create an initial rawFields object for a new node.
 */
export function createInitialRawFields(type: string): Record<string, unknown> {
  return { Type: type }
}
