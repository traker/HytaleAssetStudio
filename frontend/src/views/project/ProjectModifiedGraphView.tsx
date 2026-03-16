import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { HasApiError, hasApi } from '../../api'
import type { AssetGetResponse, GraphEdge as RawEdge, GraphNode as RawNode, ModifiedAssetEntry } from '../../api'
import { AssetSidePanel } from '../../components/editor/AssetSidePanel'
import { BlueprintNode } from '../../components/graph/BlueprintNode'
import type { BlueprintNodeData, OutgoingDep } from '../../components/graph/blueprintTypes'
import { getBlueprintNodeDisplay, isInteractionBlueprintGroup } from '../../components/graph/blueprintTypes'
import { getColorForGroup, getColorForEdgeType } from '../../components/graph/colors'
import { layoutGraphElk } from '../../components/graph/layoutDagre'
import { UnsavedChangesDialog } from '../../components/ui/UnsavedChangesDialog'
import { measureAsync, measureSync, schedulePaintMeasure } from '../../perf/audit'

const SEMANTIC_EDGE_TYPES = new Set([
  'next', 'failed', 'replace', 'fork', 'blocked', 'collisionNext', 'groundNext',
])
const nodeTypes = { blueprint: BlueprintNode }

type Props = {
  projectId: string
  isVisible: boolean
  onBack: () => void
  onOpenInteractions: (root: { assetKey: string; display: string }) => void
}

type HighlightState = {
  edgeIds: Set<string>
  nodeIds: Set<string>
}

type PendingViewportAction = { kind: 'fit-all' } | { kind: 'focus-node'; id: string }

function isExpandableNodeId(nodeId: string): boolean {
  return nodeId.startsWith('server:') || nodeId.startsWith('server-path:')
}

function hasLoadedChildren(nodeId: string, rawEdges: RawEdge[]): boolean {
  return rawEdges.some((edge) => edge.from === nodeId)
}

function computeNodeDepthsFromRoots(rootIds: string[], rawEdges: RawEdge[]): Map<string, number> {
  const outgoingMap = new Map<string, string[]>()
  for (const edge of rawEdges) {
    const list = outgoingMap.get(edge.from)
    if (list) list.push(edge.to)
    else outgoingMap.set(edge.from, [edge.to])
  }

  const depths = new Map<string, number>()
  const queue = [...rootIds]
  for (const rootId of rootIds) depths.set(rootId, 0)

  while (queue.length > 0) {
    const current = queue.shift()!
    const nextDepth = (depths.get(current) ?? 0) + 1
    for (const targetId of outgoingMap.get(current) ?? []) {
      if (depths.has(targetId)) continue
      depths.set(targetId, nextDepth)
      queue.push(targetId)
    }
  }

  return depths
}

function collectHydratedNodeIds(nodeDepths: Map<string, number>, rawEdges: RawEdge[], depth: number): Set<string> {
  return new Set(
    Array.from(nodeDepths.entries())
      .filter(([, nodeDepth]) => nodeDepth < depth)
      .map(([nodeId]) => nodeId)
      .filter((nodeId) => hasLoadedChildren(nodeId, rawEdges)),
  )
}

function resolveEntryModificationKind(entry: ModifiedAssetEntry): 'override' | 'new' {
  return entry.modificationKind ?? (entry.isNew ? 'new' : 'override')
}

function applyModificationKindsToNodes(rawNodes: RawNode[], modifiedEntries: ModifiedAssetEntry[]): RawNode[] {
  const kindByPath = new Map<string, 'override' | 'new'>()
  for (const entry of modifiedEntries) {
    kindByPath.set(entry.vfsPath, resolveEntryModificationKind(entry))
  }

  return rawNodes.map((node) => {
    if (node.modificationKind || !node.path) return node
    const modificationKind = kindByPath.get(node.path)
    return modificationKind ? { ...node, modificationKind } : node
  })
}

function computeIsolatedSubgraph(rootId: string, edges: RawEdge[]): Set<string> {
  const nodeIds = new Set<string>([rootId])
  const queue = [rootId]
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const e of edges) {
      if (e.from === cur && !nodeIds.has(e.to)) {
        nodeIds.add(e.to)
        queue.push(e.to)
      }
    }
  }
  return nodeIds
}

function findPathFromRoots(rootIds: string[], targetId: string, rawEdges: RawEdge[]): string[] | null {
  if (rootIds.includes(targetId)) return [targetId]

  const outgoingMap = new Map<string, string[]>()
  for (const edge of rawEdges) {
    const list = outgoingMap.get(edge.from)
    if (list) list.push(edge.to)
    else outgoingMap.set(edge.from, [edge.to])
  }

  const queue = [...rootIds]
  const previousByNode = new Map<string, string | null>()
  for (const rootId of rootIds) previousByNode.set(rootId, null)

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const nextId of outgoingMap.get(current) ?? []) {
      if (previousByNode.has(nextId)) continue
      previousByNode.set(nextId, current)
      if (nextId === targetId) {
        const path: string[] = [targetId]
        let cursor: string | null = current
        while (cursor) {
          path.push(cursor)
          cursor = previousByNode.get(cursor) ?? null
        }
        path.reverse()
        return path
      }
      queue.push(nextId)
    }
  }

  return null
}

function collectVisibleSubgraph(
  rawNodes: RawNode[],
  rawEdges: RawEdge[],
  rootIds: string[],
  collapsedNodeIds: Set<string>,
  revealedChildIdsBySource: Map<string, Set<string>>,
): { nodes: RawNode[]; edges: RawEdge[] } {
  const nodeById = new Map(rawNodes.map((node) => [node.id, node]))
  const outgoingMap = new Map<string, RawEdge[]>()
  for (const edge of rawEdges) {
    const list = outgoingMap.get(edge.from)
    if (list) list.push(edge)
    else outgoingMap.set(edge.from, [edge])
  }

  const visibleNodeIds = new Set<string>()
  const queue = rootIds.filter((rootId) => nodeById.has(rootId))
  queue.forEach((rootId) => visibleNodeIds.add(rootId))

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of outgoingMap.get(current) ?? []) {
      const isExplicitlyRevealed = revealedChildIdsBySource.get(current)?.has(edge.to) === true
      if (collapsedNodeIds.has(current) && !isExplicitlyRevealed) continue
      if (!nodeById.has(edge.to) || visibleNodeIds.has(edge.to)) continue
      visibleNodeIds.add(edge.to)
      queue.push(edge.to)
    }
  }

  return {
    nodes: rawNodes.filter((node) => visibleNodeIds.has(node.id)),
    edges: rawEdges.filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)),
  }
}

function buildFlowSignature(
  visibleNodes: RawNode[],
  visibleEdges: RawEdge[],
  dependencyEdges: RawEdge[],
  modifiedIdSet: Set<string>,
  collapsedNodeIds: Set<string>,
): string {
  const nodePart = visibleNodes
    .map((node) => `${node.id}|${node.path ?? ''}|${node.group ?? ''}|${node.state}|${node.modificationKind ?? ''}|${modifiedIdSet.has(node.id) ? '1' : '0'}`)
    .join('~')
  const edgePart = visibleEdges
    .map((edge) => `${edge.from}>${edge.to}:${edge.type}`)
    .join('~')
  const dependencyPart = dependencyEdges
    .map((edge) => `${edge.from}>${edge.to}:${edge.type}`)
    .join('~')
  const collapsedPart = Array.from(collapsedNodeIds)
    .filter((nodeId) => visibleNodes.some((node) => node.id === nodeId))
    .sort()
    .join('~')
  return `${nodePart}#${edgePart}#${dependencyPart}#${collapsedPart}`
}

function collectAffectedNodeIds(
  previousSelectedNodeId: string | null,
  nextSelectedNodeId: string | null,
  previousHighlight: HighlightState | null,
  nextHighlight: HighlightState | null,
): Set<string> {
  const ids = new Set<string>()
  if (previousSelectedNodeId) ids.add(previousSelectedNodeId)
  if (nextSelectedNodeId) ids.add(nextSelectedNodeId)
  previousHighlight?.nodeIds.forEach((id) => ids.add(id))
  nextHighlight?.nodeIds.forEach((id) => ids.add(id))
  return ids
}

function collectAffectedEdgeIds(previousHighlight: HighlightState | null, nextHighlight: HighlightState | null): Set<string> {
  const ids = new Set<string>()
  previousHighlight?.edgeIds.forEach((id) => ids.add(id))
  nextHighlight?.edgeIds.forEach((id) => ids.add(id))
  return ids
}

// ── Build ReactFlow nodes+edges from raw API data ─────────────────────────────
function toFlow(
  visibleNodes: RawNode[],
  visibleEdges: RawEdge[],
  dependencyNodes: RawNode[],
  dependencyEdges: RawEdge[],
  modifiedIdSet: Set<string>,
  onSelectNode: (src: string, tgt: string) => void,
  onToggleExpand: (nodeId: string) => void,
  collapsedNodeIds: Set<string>,
) {
  return measureSync('graph.modified_to_flow', () => {
    const nodeById = new Map<string, RawNode>()
    for (const node of dependencyNodes) {
      nodeById.set(node.id, node)
    }

    const outgoingMap = new Map<string, OutgoingDep[]>()
    for (const n of dependencyNodes) outgoingMap.set(n.id, [])
    for (const e of dependencyEdges) {
      const list = outgoingMap.get(e.from) ?? []
      const target = nodeById.get(e.to)
      list.push({
        edgeLabel: e.type,
        targetId: e.to,
        targetLabel: target?.label ?? e.to,
        targetGroup: target?.group ?? 'json_data',
      })
      outgoingMap.set(e.from, list)
    }

    const nodes: Array<Node<BlueprintNodeData>> = visibleNodes.map((n) => ({
      id: n.id,
      type: 'blueprint',
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        group: n.group ?? 'json_data',
        path: n.path,
        isModified: n.state === 'local',
        isRoot: n.isModifiedRoot ?? modifiedIdSet.has(n.id),
        modificationKind: n.modificationKind,
        nodeId: n.id,
        outgoing: outgoingMap.get(n.id) ?? [],
        onSelectNode,
        canToggleExpand: isExpandableNodeId(n.id) && hasLoadedChildren(n.id, dependencyEdges),
        isExpanded: hasLoadedChildren(n.id, dependencyEdges) && !collapsedNodeIds.has(n.id),
        onToggleExpand,
      },
    }))

    const edges: Edge[] = visibleEdges.map((e) => {
      const color = getColorForEdgeType(e.type)
      const showLabel = SEMANTIC_EDGE_TYPES.has(e.type)
      return {
        id: `${e.from}->${e.to}:${e.type}`,
        source: e.from,
        target: e.to,
        type: 'smoothstep',
        label: showLabel ? e.type : undefined,
        animated: false,
        style: { stroke: color, strokeWidth: 1.5 },
        labelStyle: { fill: color, fontSize: 9, fontStyle: 'italic', fontWeight: 600 },
        labelShowBg: false,
        markerEnd: { type: 'arrowclosed' as const, color },
      }
    })

    return { nodes, edges }
  }, { nodes: visibleNodes.length, edges: visibleEdges.length, modifiedRoots: modifiedIdSet.size })
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ProjectModifiedGraphView(props: Props) {
  const [depth, setDepth] = useState(1)
  const [loading, setLoading] = useState(false)
  const [expandLoading, setExpandLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modifiedEntries, setModifiedEntries] = useState<ModifiedAssetEntry[]>([])
  const [filterText, setFilterText] = useState('')
  const [filterGroup, setFilterGroup] = useState<string | null>(null)
  const [isolatedRootId, setIsolatedRootId] = useState<string | null>(null)
  const isolatedRootIdRef = useRef<string | null>(null)

  // Raw accumulated data (grows on expand clicks)
  const rawNodesRef = useRef<RawNode[]>([])
  const rawEdgesRef = useRef<RawEdge[]>([])
  const modifiedIdSetRef = useRef<Set<string>>(new Set())
  const expandedNodeIdsRef = useRef<Set<string>>(new Set())
  const collapsedNodeIdsRef = useRef<Set<string>>(new Set())
  const revealedChildIdsRef = useRef<Map<string, Set<string>>>(new Map())
  const visibleNodeIdsRef = useRef<Set<string>>(new Set())

  const [nodes, setNodes] = useState<Array<Node<BlueprintNodeData>>>([])
  const [edges, setEdges] = useState<Edge[]>([])
  // Plain (un-highlighted) edges — source of truth for re-applying highlight
  const baseEdgesRef = useRef<Edge[]>([])
  // Incremented on each rebuildFlow to re-trigger the highlight useEffect
  const [rebuildTick, setRebuildTick] = useState(0)
  const graphPaintStartedAtRef = useRef<number | null>(null)
  const lastFlowSignatureRef = useRef<string | null>(null)
  // Forward ref so handleModifiedEntryClick (declared before rebuildFlow) can call it
  const rebuildFlowRef = useRef<() => void>(() => {})
  const layoutNodesRef = useRef<Array<Node<BlueprintNodeData>>>([])
  const layoutEdgesRef = useRef<Edge[]>([])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((n) => applyNodeChanges(changes, n) as Array<Node<BlueprintNodeData>>),
    [],
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((e) => applyEdgeChanges(changes, e)),
    [],
  )

  // Selected node + side panel
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const selectedNodeIdRef = useRef<string | null>(null)
  const [assetPanelDirty, setAssetPanelDirty] = useState(false)
  const assetPanelDirtyRef = useRef(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [asset, setAsset] = useState<AssetGetResponse | null>(null)
  const [assetLoading, setAssetLoading] = useState(false)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [assetReloadTick, setAssetReloadTick] = useState(0)
  const assetSeq = useRef(0)
  const previousProjectIdRef = useRef<string | null>(null)

  const [activeHighlight, setActiveHighlight] = useState<HighlightState | null>(null)
  const [viewportActionVersion, setViewportActionVersion] = useState(0)
  const previousSelectedNodeIdRef = useRef<string | null>(null)
  const previousActiveHighlightRef = useRef<HighlightState | null>(null)
  const reactFlowInstanceRef = useRef<{ fitView: (opts?: { nodes?: Array<{ id: string }>, padding?: number, duration?: number }) => void } | null>(null)
  const pendingViewportActionRef = useRef<PendingViewportAction | null>(null)
  const pendingAssetActionRef = useRef<(() => void) | null>(null)
  const expandNodeRef = useRef<(nodeId: string) => Promise<void>>(() => Promise.resolve())

  const scheduleViewportAction = useCallback((action: PendingViewportAction) => {
    pendingViewportActionRef.current = action
    setViewportActionVersion((value) => value + 1)
  }, [])

  const modifiedRootNodes = rawNodesRef.current.filter((node) => node.isModifiedRoot)
  const newRootCount = modifiedRootNodes.filter((node) => node.modificationKind === 'new').length
  const overrideRootCount = modifiedRootNodes.filter((node) => node.modificationKind === 'override').length

  const visibleModifiedEntries = useMemo(() => {
    const byPath = new Map<string, ModifiedAssetEntry>()
    for (const entry of modifiedEntries) {
      const assetKey = entry.assetKey ?? (entry.kind === 'server-json' ? `server-path:${entry.vfsPath}` : null)
      byPath.set(`${entry.kind}:${entry.vfsPath}`, {
        ...entry,
        assetKey,
        modificationKind: resolveEntryModificationKind(entry),
      })
    }
    return Array.from(byPath.values())
  }, [modifiedEntries])

  // Map assetKey → group resolved from rawNodesRef; re-computed when graph is rebuilt
  const entryGroupMap = (() => {
    const map = new Map<string, string>()
    for (const entry of visibleModifiedEntries) {
      if (!entry.assetKey) continue
      const node = rawNodesRef.current.find(
        (n) => n.id === entry.assetKey || (n.path != null && entry.assetKey === `server-path:${n.path}`),
      )
      map.set(entry.assetKey, node?.group ?? 'json_data')
    }
    return map
  })()

  const availableGroups = useMemo(() => {
    const groups = new Set<string>()
    for (const g of entryGroupMap.values()) groups.add(g)
    return Array.from(groups).sort()
  }, [entryGroupMap])

  const filteredEntries = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    return visibleModifiedEntries.filter((e) => {
      if (filterGroup && entryGroupMap.get(e.assetKey ?? '') !== filterGroup) return false
      if (q && !e.vfsPath.toLowerCase().includes(q) && !(e.assetKey ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [visibleModifiedEntries, filterText, filterGroup, entryGroupMap])

  const currentAssetLabel = asset?.resolvedPath
    ?? nodes.find((node) => node.id === selectedNodeId)?.data.path
    ?? nodes.find((node) => node.id === selectedNodeId)?.data.label
    ?? selectedNodeId

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId
  }, [selectedNodeId])

  useEffect(() => {
    assetPanelDirtyRef.current = assetPanelDirty
  }, [assetPanelDirty])

  const requestAssetPanelAction = useCallback((action: () => void) => {
    if (!selectedNodeIdRef.current || !assetPanelDirtyRef.current) {
      action()
      return
    }
    pendingAssetActionRef.current = action
    setShowUnsavedDialog(true)
  }, [])

  const confirmDiscardAssetChanges = useCallback(() => {
    setShowUnsavedDialog(false)
    setAssetPanelDirty(false)
    assetPanelDirtyRef.current = false
    const action = pendingAssetActionRef.current
    pendingAssetActionRef.current = null
    action?.()
  }, [])

  const cancelDiscardAssetChanges = useCallback(() => {
    setShowUnsavedDialog(false)
    pendingAssetActionRef.current = null
  }, [])

  const handleModifiedEntryClick = useCallback((entry: ModifiedAssetEntry) => {
    if (!entry.assetKey) return
    const assetKey = entry.assetKey

    // assetKey from the modified list is always "server-path:…" but the graph node
    // may use "server:SomeId" when the ID is unique — resolve by path or direct match
    const graphNode = rawNodesRef.current.find(
      (n) => n.id === assetKey || (n.path != null && assetKey === `server-path:${n.path}`),
    )
    requestAssetPanelAction(() => {
      const targetNodeId = graphNode?.id ?? assetKey

      let rootIds: string[]
      let viewportAction: PendingViewportAction = { kind: 'focus-node', id: targetNodeId }

      if (isolatedRootIdRef.current !== null) {
        const isolatedNodeIds = computeIsolatedSubgraph(isolatedRootIdRef.current, rawEdgesRef.current)
        if (isolatedNodeIds.has(targetNodeId)) {
          rootIds = [isolatedRootIdRef.current]
        } else {
          isolatedRootIdRef.current = targetNodeId
          setIsolatedRootId(targetNodeId)
          lastFlowSignatureRef.current = null
          rootIds = [targetNodeId]
          viewportAction = { kind: 'fit-all' }
        }
      } else {
        rootIds = rawNodesRef.current
          .filter((node) => node.isModifiedRoot ?? modifiedIdSetRef.current.has(node.id))
          .map((node) => node.id)
      }

      if (!visibleNodeIdsRef.current.has(targetNodeId)) {
        const path = findPathFromRoots(rootIds, targetNodeId, rawEdgesRef.current)
        if (path) {
          for (const nodeId of path.slice(0, -1)) {
            collapsedNodeIdsRef.current.delete(nodeId)
            revealedChildIdsRef.current.delete(nodeId)
          }
          lastFlowSignatureRef.current = null
        }
      }

      scheduleViewportAction(viewportAction)
      setSelectedNodeId(targetNodeId)
      setActiveHighlight(null)
      rebuildFlowRef.current()
    })
  }, [requestAssetPanelAction, scheduleViewportAction])

  // ── Sync isSelected + isConnected on nodes, animate highlighted edges ─────
  useEffect(() => {
    const previousSelectedNodeId = previousSelectedNodeIdRef.current
    const previousActiveHighlight = previousActiveHighlightRef.current
    const affectedNodeIds = collectAffectedNodeIds(
      previousSelectedNodeId,
      selectedNodeId,
      previousActiveHighlight,
      activeHighlight,
    )
    const affectedEdgeIds = collectAffectedEdgeIds(previousActiveHighlight, activeHighlight)

    setNodes((prev) => {
      if (affectedNodeIds.size === 0) return prev
      let changed = false
      const next = prev.map((node) => {
        if (!affectedNodeIds.has(node.id)) return node
        const isSelected = node.id === selectedNodeId
        const isConnected = activeHighlight?.nodeIds.has(node.id) === true
        if (node.data.isSelected === isSelected && node.data.isConnected === isConnected) {
          return node
        }
        changed = true
        return {
          ...node,
          data: {
            ...node.data,
            isSelected,
            isConnected,
          },
        }
      })
      return changed ? next : prev
    })

    setEdges((prev) => {
      if (affectedEdgeIds.size === 0 && rebuildTick === 0) return prev
      const prevById = new Map(prev.map((edge) => [edge.id, edge]))
      let changed = false
      const next = baseEdgesRef.current.map((edge) => {
        const shouldHighlight = activeHighlight?.edgeIds.has(edge.id) === true
        const existing = prevById.get(edge.id)
        if (!affectedEdgeIds.has(edge.id) && existing) {
          return existing
        }
        if (shouldHighlight) {
          changed = true
          return {
            ...edge,
            animated: true,
            zIndex: 1000,
            style: {
              ...(edge.style as object),
              stroke: '#00D4FF',
              strokeWidth: 2.5,
              strokeDasharray: '6 4',
            },
            markerEnd: { type: 'arrowclosed' as const, color: '#00D4FF' },
          }
        }
        if (existing !== edge) changed = true
        return edge
      })
      return changed ? next : prev
    })

    previousSelectedNodeIdRef.current = selectedNodeId
    previousActiveHighlightRef.current = activeHighlight
  }, [selectedNodeId, activeHighlight, rebuildTick])

  // Apply only explicit viewport actions after nodes state is updated.
  useEffect(() => {
    const action = pendingViewportActionRef.current
    if (!action) return
    if (!props.isVisible) return
    if (action.kind === 'focus-node' && !nodes.some((node) => node.id === action.id)) return
    pendingViewportActionRef.current = null
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (action.kind === 'fit-all') {
          reactFlowInstanceRef.current?.fitView({ padding: 0.15, duration: 400 })
          return
        }
        reactFlowInstanceRef.current?.fitView({
          nodes: [{ id: action.id }] as { id: string }[],
          padding: 0.5,
          duration: 500,
        })
      })
    })
  }, [nodes, props.isVisible, viewportActionVersion])

  // dep-ref click from inside a BlueprintNode
  const handleSelectNode = useCallback((sourceId: string, targetId: string) => {
    requestAssetPanelAction(() => {
      const matchingEdges = rawEdgesRef.current.filter(
        (e) => e.from === sourceId && e.to === targetId,
      )
      setSelectedNodeId(targetId)
      setActiveHighlight({
        edgeIds: new Set(matchingEdges.map((e) => `${e.from}->${e.to}:${e.type}`)),
        nodeIds: new Set([targetId]),
      })
      if (!visibleNodeIdsRef.current.has(targetId)) {
        if (collapsedNodeIdsRef.current.has(sourceId)) {
          if (expandedNodeIdsRef.current.has(sourceId)) {
            collapsedNodeIdsRef.current.delete(sourceId)
            revealedChildIdsRef.current.delete(sourceId)
            rebuildFlowRef.current()
          } else {
            void expandNodeRef.current(sourceId)
          }
        } else if (!expandedNodeIdsRef.current.has(sourceId)) {
          void expandNodeRef.current(sourceId)
        }
      }
    })
  }, [requestAssetPanelAction])

  // Rebuild ReactFlow display from accumulated raw data
  const rebuildFlow = useCallback(() => {
    const rootIds = isolatedRootIdRef.current
      ? [isolatedRootIdRef.current]
      : rawNodesRef.current
          .filter((node) => node.isModifiedRoot ?? modifiedIdSetRef.current.has(node.id))
          .map((node) => node.id)
    const isolated = isolatedRootIdRef.current
      ? computeIsolatedSubgraph(isolatedRootIdRef.current, rawEdgesRef.current)
      : null
    const candidateNodes = isolated
      ? rawNodesRef.current.filter((n) => isolated.has(n.id))
      : rawNodesRef.current
    const candidateEdges = isolated
      ? rawEdgesRef.current.filter((e) => isolated.has(e.from) && isolated.has(e.to))
      : rawEdgesRef.current
    const { nodes: visibleNodes, edges: visibleEdges } = collectVisibleSubgraph(
      candidateNodes,
      candidateEdges,
      rootIds,
      collapsedNodeIdsRef.current,
      revealedChildIdsRef.current,
    )
    visibleNodeIdsRef.current = new Set(visibleNodes.map((node) => node.id))
    const flowSignature = buildFlowSignature(
      visibleNodes,
      visibleEdges,
      candidateEdges,
      modifiedIdSetRef.current,
      collapsedNodeIdsRef.current,
    )
    if (lastFlowSignatureRef.current === flowSignature) {
      return
    }

    const { nodes: fn, edges: fe } = toFlow(
      visibleNodes,
      visibleEdges,
      candidateNodes,
      candidateEdges,
      modifiedIdSetRef.current,
      handleSelectNode,
      (nodeId: string) => {
        if (!nodeId) return
        const childrenAlreadyLoaded = hasLoadedChildren(nodeId, rawEdgesRef.current)
        if (collapsedNodeIdsRef.current.has(nodeId)) {
          if (childrenAlreadyLoaded) {
            collapsedNodeIdsRef.current.delete(nodeId)
            rebuildFlowRef.current()
          } else {
            void expandNodeRef.current(nodeId)
          }
          return
        }
        if (childrenAlreadyLoaded) {
          collapsedNodeIdsRef.current.add(nodeId)
          revealedChildIdsRef.current.delete(nodeId)
          rebuildFlowRef.current()
          return
        }
        void expandNodeRef.current(nodeId)
      },
      collapsedNodeIdsRef.current,
    )
    lastFlowSignatureRef.current = flowSignature
    graphPaintStartedAtRef.current = performance.now()
    baseEdgesRef.current = fe
    layoutNodesRef.current = fn
    layoutEdgesRef.current = fe
    setNodes(fn)
    setEdges(fe)
    setRebuildTick((t) => t + 1)
  }, [handleSelectNode])
  rebuildFlowRef.current = rebuildFlow

  // Re-apply layout when data changes
  useEffect(() => {
    if (!layoutNodesRef.current.length) return
    const freshNodes = layoutNodesRef.current.map((n) => ({ ...n, position: { x: 0, y: 0 } }))
    const edges = layoutEdgesRef.current
    const applyPositions = (newNodes: typeof freshNodes) => {
      const posMap = new Map(newNodes.map((n) => [n.id, n.position]))
      setNodes((prev) => prev.map((n) => ({ ...n, position: posMap.get(n.id) ?? n.position })))
    }
    void layoutGraphElk(freshNodes, edges, 'LR').then((r) => applyPositions(r.nodes))
  }, [rebuildTick])

  useEffect(() => {
    if (graphPaintStartedAtRef.current == null) return
    const startedAt = graphPaintStartedAtRef.current
    graphPaintStartedAtRef.current = null
    schedulePaintMeasure('view.modified_graph.paint', startedAt, {
      projectId: props.projectId,
      nodes: nodes.length,
      edges: edges.length,
    })
  }, [props.projectId, nodes, edges])

  // ── Isolate a node (show only it + its descendants) ─────────────────────
  const isolateNodeFromPanel = useCallback(() => {
    if (!selectedNodeId) return
    isolatedRootIdRef.current = selectedNodeId
    setIsolatedRootId(selectedNodeId)
    lastFlowSignatureRef.current = null
    scheduleViewportAction({ kind: 'fit-all' })
    rebuildFlowRef.current()
  }, [selectedNodeId, scheduleViewportAction])

  const clearIsolation = useCallback(() => {
    isolatedRootIdRef.current = null
    setIsolatedRootId(null)
    lastFlowSignatureRef.current = null
    scheduleViewportAction({ kind: 'fit-all' })
    rebuildFlowRef.current()
  }, [scheduleViewportAction])

  // ── Soft graph refresh after a save (keeps current selection) ────────────
  const softReloadGraph = useCallback(async () => {
    try {
      const [graphResp, modifiedResp] = await Promise.all([
        measureAsync('view.modified_graph.fetch_graph', () => hasApi.projectGraphModified(props.projectId, depth + 1), {
          projectId: props.projectId,
          depth: depth + 1,
        }),
        measureAsync('view.modified_graph.fetch_list', () => hasApi.projectModified(props.projectId), {
          projectId: props.projectId,
        }),
      ])
      rawNodesRef.current = applyModificationKindsToNodes(graphResp.nodes, modifiedResp.entries)
      rawEdgesRef.current = graphResp.edges
      modifiedIdSetRef.current = new Set(graphResp.modifiedIds ?? [])
      collapsedNodeIdsRef.current = new Set()
      revealedChildIdsRef.current = new Map()
      visibleNodeIdsRef.current = new Set()
      const modifiedRoots = rawNodesRef.current
        .filter((node) => node.isModifiedRoot ?? modifiedIdSetRef.current.has(node.id))
        .map((node) => node.id)
      const nodeDepths = computeNodeDepthsFromRoots(modifiedRoots, graphResp.edges)
      expandedNodeIdsRef.current = collectHydratedNodeIds(nodeDepths, graphResp.edges, depth)
      collapsedNodeIdsRef.current = new Set(
        Array.from(nodeDepths.entries())
          .filter(([, nodeDepth]) => nodeDepth === depth)
          .map(([nodeId]) => nodeId)
          .filter((nodeId) => hasLoadedChildren(nodeId, graphResp.edges)),
      )
      setModifiedEntries(modifiedResp.entries)
      scheduleViewportAction({ kind: 'fit-all' })
      rebuildFlowRef.current()
      setError(null)
    } catch (e) {
      setError(e instanceof HasApiError ? e.message : 'Failed to refresh modified graph')
    }
  }, [props.projectId, depth, scheduleViewportAction])

  const handleAssetRefresh = useCallback(async (nextSelectedNodeId?: string) => {
    if (nextSelectedNodeId) {
      setSelectedNodeId(nextSelectedNodeId)
      setActiveHighlight(null)
    }
    setAssetReloadTick((t) => t + 1)
    await softReloadGraph()
  }, [softReloadGraph])

  // ── Full reload on mount / projectId / depth change ───────────────────────
  useEffect(() => {
    let cancelled = false
    const projectChanged = previousProjectIdRef.current !== props.projectId
    previousProjectIdRef.current = props.projectId

    setLoading(true)
    setError(null)

    if (projectChanged) {
      setSelectedNodeId(null)
      setActiveHighlight(null)
      rawNodesRef.current = []
      rawEdgesRef.current = []
      modifiedIdSetRef.current = new Set()
      expandedNodeIdsRef.current = new Set()
      collapsedNodeIdsRef.current = new Set()
      revealedChildIdsRef.current = new Map()
      visibleNodeIdsRef.current = new Set()
      lastFlowSignatureRef.current = null
      setModifiedEntries([])
      setNodes([])
      setEdges([])
    }

    ;(async () => {
      try {
        const [graphResp, modifiedResp] = await Promise.all([
          measureAsync('view.modified_graph.fetch_graph', () => hasApi.projectGraphModified(props.projectId, depth + 1), {
            projectId: props.projectId,
            depth: depth + 1,
          }),
          measureAsync('view.modified_graph.fetch_list', () => hasApi.projectModified(props.projectId), {
            projectId: props.projectId,
          }),
        ])
        if (cancelled) return
        rawNodesRef.current = applyModificationKindsToNodes(graphResp.nodes, modifiedResp.entries)
        rawEdgesRef.current = graphResp.edges
        modifiedIdSetRef.current = new Set(graphResp.modifiedIds ?? [])
        collapsedNodeIdsRef.current = new Set()
        revealedChildIdsRef.current = new Map()
        visibleNodeIdsRef.current = new Set()
        const modifiedRoots = rawNodesRef.current
          .filter((node) => node.isModifiedRoot ?? modifiedIdSetRef.current.has(node.id))
          .map((node) => node.id)
        const nodeDepths = computeNodeDepthsFromRoots(modifiedRoots, graphResp.edges)
        expandedNodeIdsRef.current = collectHydratedNodeIds(nodeDepths, graphResp.edges, depth)
        collapsedNodeIdsRef.current = new Set(
          Array.from(nodeDepths.entries())
            .filter(([, nodeDepth]) => nodeDepth === depth)
            .map(([nodeId]) => nodeId)
            .filter((nodeId) => hasLoadedChildren(nodeId, graphResp.edges)),
        )
        setModifiedEntries(modifiedResp.entries)
        scheduleViewportAction({ kind: 'fit-all' })
        rebuildFlowRef.current()

        if (selectedNodeIdRef.current && !graphResp.nodes.some((node) => node.id === selectedNodeIdRef.current)) {
          setSelectedNodeId(null)
          setActiveHighlight(null)
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof HasApiError ? e.message : 'Unexpected error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [props.projectId, depth, scheduleViewportAction])

  // ── Expand a node (load its depth-1 subgraph and merge) ───────────────────
  const expandNode = useCallback(
    async (nodeId: string) => {
      if (expandedNodeIdsRef.current.has(nodeId)) return
      if (!nodeId.startsWith('server:') && !nodeId.startsWith('server-path:')) return
      setExpandLoading(true)
      try {
        const resp = await measureAsync('view.modified_graph.expand', () => hasApi.projectGraph(props.projectId, nodeId, 2), {
          projectId: props.projectId,
          nodeId,
        })
        const existingNodeIds = new Set(rawNodesRef.current.map((n) => n.id))
        const existingEdgeKeys = new Set(
          rawEdgesRef.current.map((e) => `${e.from}->${e.to}:${e.type}`),
        )
        let changed = false
        for (const n of resp.nodes) {
          if (!existingNodeIds.has(n.id)) {
            rawNodesRef.current.push(n)
            changed = true
          }
        }
        for (const e of resp.edges) {
          const key = `${e.from}->${e.to}:${e.type}`
          if (!existingEdgeKeys.has(key)) {
            rawEdgesRef.current.push(e)
            changed = true
          }
        }
        expandedNodeIdsRef.current.add(nodeId)
        collapsedNodeIdsRef.current.delete(nodeId)
        revealedChildIdsRef.current.delete(nodeId)
        for (const edge of rawEdgesRef.current) {
          if (edge.from === nodeId && hasLoadedChildren(edge.to, rawEdgesRef.current)) {
            collapsedNodeIdsRef.current.add(edge.to)
          }
        }
        if (changed) rebuildFlowRef.current()
        else rebuildFlowRef.current()
        setError(null)
      } catch (e) {
        expandedNodeIdsRef.current.delete(nodeId)
        setError(e instanceof HasApiError ? e.message : 'Failed to expand node')
      } finally {
        setExpandLoading(false)
      }
    },
    [props.projectId],
  )
  expandNodeRef.current = expandNode

  // ── Asset load for side panel ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedNodeId) {
      setAsset(null)
      setAssetError(null)
      setAssetLoading(false)
      return
    }
    if (selectedNodeId.startsWith('common:')) {
      setAsset(null)
      setAssetError(null)
      setAssetLoading(false)
      return
    }
    const mySeq = ++assetSeq.current
    setAssetLoading(true)
    setAssetError(null)
    ;(async () => {
      try {
        const a = await hasApi.assetGet(props.projectId, selectedNodeId)
        if (assetSeq.current !== mySeq) return
        setAsset(a)
      } catch (e) {
        if (assetSeq.current !== mySeq) return
        setAssetError(e instanceof HasApiError ? e.message : 'Unexpected error')
      } finally {
        if (assetSeq.current === mySeq) setAssetLoading(false)
      }
    })()
  }, [props.projectId, selectedNodeId, assetReloadTick])

  // ── Apply dim highlight to non-connected edges/nodes ──────────────────────
  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId) ?? null
    : null
  const canOpenInteractions = Boolean(
    selectedNodeId &&
      selectedNode &&
      isInteractionBlueprintGroup(selectedNode.data.group),
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#1e1e1e' }}>
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          bottom: 130,
          width: 320,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: 'rgba(14,14,22,0.92)',
          border: '1px solid #2e2e45',
          borderRadius: 8,
          padding: '10px 14px',
          backdropFilter: 'blur(6px)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
        }}
      >
        {isolatedRootId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: '#1a1a35', border: '1px solid #4444aa', borderRadius: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: '#8877ee', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Isolated</span>
            <span style={{ fontSize: 10, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }} title={isolatedRootId}>
              {isolatedRootId.replace(/^server(-path)?:/, '')}
            </span>
            <button
              onClick={clearIsolation}
              title="Exit isolation"
              style={{ background: 'none', border: 'none', color: '#8877ee', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
            >×</button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span
            style={{
              color: '#ddd',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}
          >
            Modified Assets
          </span>
          <button
            onClick={props.onBack}
            style={{
              background: 'none',
              border: '1px solid #3a3a55',
              borderRadius: 4,
              color: '#888',
              fontSize: 11,
              cursor: 'pointer',
              padding: '2px 8px',
            }}
          >
            ← Back
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, color: '#555', marginRight: 2 }}>Depth</span>
          {[0, 1, 2, 3, 4].map((d) => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              style={{
                background: depth === d ? '#2e2e50' : 'none',
                border: `1px solid ${depth === d ? '#5555aa' : '#333'}`,
                borderRadius: 4,
                color: depth === d ? '#aaaaff' : '#666',
                fontSize: 12,
                fontWeight: depth === d ? 700 : 400,
                cursor: 'pointer',
                padding: '2px 7px',
                transition: 'all 0.1s',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: '#555', lineHeight: 1.4 }}>
          {loading ? (
            'Loading…'
          ) : error ? (
            <span style={{ color: '#e06c75' }}>{error}</span>
          ) : (
            <>
              <span style={{ color: '#FF9500' }}>
                {modifiedIdSetRef.current.size} modified
              </span>
              {(newRootCount > 0 || overrideRootCount > 0) && (
                <>
                  {' · '}
                  <span style={{ color: '#7ee787' }}>{newRootCount} new/copy</span>
                  {' · '}
                  <span style={{ color: '#ffb347' }}>{overrideRootCount} override</span>
                </>
              )}
              {' · '}
              <span style={{ color: '#555' }}>{nodes.length} nodes</span>
              {expandLoading && (
                <span style={{ color: '#444' }}> · expanding…</span>
              )}
              {depth === 0 && nodes.length > 0 && (
                <div style={{ color: '#444', marginTop: 3, fontSize: 10 }}>
                  Use the plus/minus control on a node to reveal or hide its children
                </div>
              )}
            </>
          )}
        </div>

        {!loading && !error && visibleModifiedEntries.length > 0 && (
          <div
            style={{
              minHeight: 0,
              overflow: 'auto',
              borderTop: '1px solid #2a2a2a',
              paddingTop: 8,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filtrer…"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '4px 24px 4px 7px',
                    background: '#111',
                    color: '#ccc',
                    border: '1px solid #333',
                    borderRadius: 4,
                    fontSize: 11,
                    outline: 'none',
                  }}
                />
                {filterText && (
                  <button
                    onClick={() => setFilterText('')}
                    style={{
                      position: 'absolute',
                      right: 4,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#666',
                      cursor: 'pointer',
                      fontSize: 12,
                      padding: 0,
                      lineHeight: 1,
                    }}
                    title="Effacer le filtre"
                  >×</button>
                )}
              </div>
              <span style={{ fontSize: 10, color: filterText || filterGroup ? '#aaaaff' : '#555', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {filterText || filterGroup
                  ? `${filteredEntries.length}/${visibleModifiedEntries.length}`
                  : `${visibleModifiedEntries.length} file${visibleModifiedEntries.length !== 1 ? 's' : ''}`
                }
              </span>
            </div>
            {availableGroups.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8, flexShrink: 0 }}>
                {availableGroups.map((g) => {
                  const active = filterGroup === g
                  const color = getColorForGroup(g)
                  return (
                    <button
                      key={g}
                      onClick={() => setFilterGroup(active ? null : g)}
                      style={{
                        fontSize: 9,
                        padding: '2px 7px',
                        borderRadius: 999,
                        border: `1px solid ${active ? color : color + '66'}`,
                        background: active ? color : 'transparent',
                        color: active ? '#111' : color,
                        cursor: 'pointer',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        transition: 'all 0.1s',
                      }}
                    >
                      {g}
                    </button>
                  )
                })}
              </div>
            )}
            <div style={{ overflow: 'auto', flex: 1 }}>
            {filteredEntries.length === 0 && (
              <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic', textAlign: 'center', marginTop: 12 }}>Aucun résultat</div>
            )}
            {filteredEntries.map((entry) => {
              const isSelected = selectedNodeId === entry.assetKey
              const group = entryGroupMap.get(entry.assetKey ?? '') ?? 'json_data'
              const nodeColor = getColorForGroup(group)
              const badgeLabel = entry.modificationKind === 'new' ? 'NEW' : 'OVR'
              const badgeColor = entry.modificationKind === 'new' ? '#36c275' : '#ffb347'
              const badgeTextColor = entry.modificationKind === 'new' ? '#dff8ea' : '#2b1800'
              const rowBackground = isSelected
                ? `${nodeColor}22`
                : 'rgba(24,24,36,0.7)'
              const borderColor = isSelected ? nodeColor : `${nodeColor}88`
              const displayPath = entry.vfsPath.replace(/^Server\//, '').replace(/^Common\//, '')
              const lastSlash = displayPath.lastIndexOf('/')
              const fileName = lastSlash >= 0 ? displayPath.slice(lastSlash + 1) : displayPath
              const parentPath = lastSlash >= 0 ? displayPath.slice(0, lastSlash) : ''
              return (
                <button
                  key={`${entry.kind}:${entry.vfsPath}`}
                  onClick={() => handleModifiedEntryClick(entry)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: rowBackground,
                    border: `1px solid ${borderColor}`,
                    borderLeft: `4px solid ${nodeColor}`,
                    borderRadius: 6,
                    color: '#ddd',
                    padding: '7px 8px',
                    cursor: entry.assetKey ? 'pointer' : 'default',
                    marginBottom: 6,
                  }}
                  title={entry.vfsPath}
                  disabled={!entry.assetKey}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 11, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fileName}
                      </span>
                      {parentPath && (
                        <span style={{ fontSize: 10, color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {parentPath}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                      <span style={{ fontSize: 9, color: '#111', background: nodeColor, borderRadius: 999, padding: '1px 5px', fontWeight: 700, textTransform: 'uppercase' }}>
                        {group}
                      </span>
                      <span style={{ fontSize: 9, color: badgeTextColor, background: badgeColor, border: `1px solid ${badgeColor}`, borderRadius: 999, padding: '1px 5px', fontWeight: 700 }}>
                        {badgeLabel}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, color: '#777', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{entry.kind === 'server-json' ? 'Server JSON' : 'Common resource'}</span>
                    <span>{(entry.size / 1024).toFixed(1)} KB</span>
                  </div>
                </button>
              )
            })}
            </div>
          </div>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onlyRenderVisibleElements
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        autoPanOnNodeFocus={false}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={(instance) => { reactFlowInstanceRef.current = instance as typeof reactFlowInstanceRef.current }}
        onNodeClick={(_, n) => {
          requestAssetPanelAction(() => {
            setSelectedNodeId(n.id)
            const connectedEdges = baseEdgesRef.current.filter((edge) => edge.source === n.id || edge.target === n.id)
            const neighborIds = new Set<string>()
            connectedEdges.forEach((edge) => {
              if (edge.source !== n.id) neighborIds.add(edge.source)
              if (edge.target !== n.id) neighborIds.add(edge.target)
            })
            setActiveHighlight({ edgeIds: new Set(connectedEdges.map((edge) => edge.id)), nodeIds: neighborIds })
          })
        }}
        onPaneClick={() => requestAssetPanelAction(() => {
          setSelectedNodeId(null)
          setActiveHighlight(null)
        })}
        minZoom={0.05}
        maxZoom={2}
      >
        <Background color="#2a2a2a" />
        <Controls />
      </ReactFlow>

      {selectedNodeId && (
        <AssetSidePanel
          projectId={props.projectId}
          selectedNodeId={selectedNodeId}
          asset={asset}
          loading={assetLoading}
          error={assetError}
          onClose={() => requestAssetPanelAction(() => {
            setSelectedNodeId(null)
            setActiveHighlight(null)
          })}
          onRefresh={handleAssetRefresh}
          onDirtyChange={setAssetPanelDirty}
          onOpenInteractions={canOpenInteractions
            ? () => {
                if (!selectedNodeId || !selectedNode) return
                props.onOpenInteractions?.({
                  assetKey: selectedNodeId,
                  display: getBlueprintNodeDisplay(selectedNode.data, selectedNodeId),
                })
              }
            : undefined}
          canOpenInteractions={canOpenInteractions}
          onIsolateNode={isolateNodeFromPanel}
        />
      )}

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        assetLabel={typeof currentAssetLabel === 'string' ? currentAssetLabel : null}
        onCancel={cancelDiscardAssetChanges}
        onDiscard={confirmDiscardAssetChanges}
      />
    </div>
  )
}

