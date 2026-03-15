import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  Panel,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { HasApiError, hasApi } from '../../api'
import type { GraphNode, GraphEdge, SearchResult } from '../../api'

import { AssetSidePanel } from './AssetSidePanel'
import { BlueprintNode } from '../../components/graph/BlueprintNode'
import type { BlueprintNodeData, OutgoingDep } from '../../components/graph/blueprintTypes'
import { getBlueprintNodeDisplay, isInteractionBlueprintGroup } from '../../components/graph/blueprintTypes'
import { getColorForGroup, getColorForEdgeType } from '../../components/graph/colors'
import { formatGraphTruncationWarning, layoutGraph, layoutGraphElk } from '../../components/graph/layoutDagre'
import { measureAsync, measureSync, schedulePaintMeasure } from '../../perf/audit'
import { useAsset } from '../../hooks/useAsset'
import { useLayoutEngine } from '../../hooks/useLayoutEngine'
import { UnsavedChangesDialog } from '../ui/UnsavedChangesDialog'

type Props = {
  projectId: string
  onBack: () => void
  title?: string
  searchPlaceholder?: string
  searchEnabled?: boolean
  root?: { assetKey: string; display: string }
  autoLoad?: boolean
  onOpenInteractions?: (root: { assetKey: string; display: string }) => void
}

type Status = { kind: 'idle' | 'loading'; message?: string }
type PendingViewportAction = { kind: 'fit-all' }

const nodeTypes = {
  blueprint: BlueprintNode,
}

// Relation types that are meaningful enough to show as edge labels on the graph.
const SEMANTIC_EDGE_TYPES = new Set(['next', 'failed', 'replace', 'fork', 'blocked', 'collisionNext', 'groundNext'])

function isExpandableNodeId(nodeId: string): boolean {
  return nodeId.startsWith('server:') || nodeId.startsWith('server-path:')
}

function hasLoadedChildren(nodeId: string, rawEdges: GraphEdge[]): boolean {
  return rawEdges.some((edge) => edge.from === nodeId)
}

function computeNodeDepths(rootId: string, rawEdges: GraphEdge[]): Map<string, number> {
  const outgoingMap = new Map<string, string[]>()
  for (const edge of rawEdges) {
    const list = outgoingMap.get(edge.from)
    if (list) list.push(edge.to)
    else outgoingMap.set(edge.from, [edge.to])
  }

  const depths = new Map<string, number>()
  const queue: string[] = [rootId]
  depths.set(rootId, 0)

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

function collectVisibleSubgraph(
  rawNodes: GraphNode[],
  rawEdges: GraphEdge[],
  rootIds: string[],
  collapsedNodeIds: Set<string>,
  revealedChildIdsBySource: Map<string, Set<string>>,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeById = new Map(rawNodes.map((node) => [node.id, node]))
  const outgoingMap = new Map<string, GraphEdge[]>()
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

function toFlow(
  visibleNodes: GraphNode[],
  visibleEdges: GraphEdge[],
  dependencyNodes: GraphNode[],
  dependencyEdges: GraphEdge[],
  rootId: string,
  onSelectNode: (sourceId: string, targetId: string) => void,
  onToggleExpand: (nodeId: string) => void,
  collapsedNodeIds: Set<string>,
): { nodes: Node<BlueprintNodeData>[]; edges: Edge[]; truncatedAt?: number } {
  return measureSync('graph.to_flow', () => {
    const nodeInfoMap = new Map(dependencyNodes.map((n) => [n.id, { label: n.label, group: n.group ?? 'json_data' }]))

    const outgoingMap = new Map<string, OutgoingDep[]>()
    for (const e of dependencyEdges) {
      if (!outgoingMap.has(e.from)) outgoingMap.set(e.from, [])
      const target = nodeInfoMap.get(e.to)
      outgoingMap.get(e.from)!.push({
        edgeLabel: e.type,
        targetId: e.to,
        targetLabel: target?.label ?? e.to,
        targetGroup: target?.group ?? 'json_data',
      })
    }

    const nodes: Node<BlueprintNodeData>[] = visibleNodes.map((n) => ({
      id: n.id,
      type: 'blueprint',
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        group: n.group ?? 'json_data',
        path: n.path,
        isModified: n.state === 'local',
        isRoot: n.id === rootId,
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

    return layoutGraph(nodes, edges, 'LR')
  }, { nodes: visibleNodes.length, edges: visibleEdges.length, rootId })
}

export function ProjectGraphEditor(props: Props) {
  const [depth, setDepth] = useState(2)

  const [selected, setSelected] = useState<SearchResult | null>(() => {
    if (!props.root) return null
    return { assetKey: props.root.assetKey, display: props.root.display, kind: 'server-json', origin: 'vanilla' }
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const searchSeq = useRef(0)

  const [nodes, setNodes] = useState<Array<Node<BlueprintNodeData>>>([])
  const [edges, setEdges] = useState<Edge[]>([])

  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [truncationWarning, setTruncationWarning] = useState<string | null>(null)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [activeHighlight, setActiveHighlight] = useState<{ edgeIds: Set<string>; nodeIds: Set<string> } | null>(null)
  const [assetPanelDirty, setAssetPanelDirty] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const baseEdgesRef = useRef<Edge[]>([])
  const graphPaintStartedAtRef = useRef<number | null>(null)
  const layoutNodesRef = useRef<Node[]>([])
  const layoutEdgesRef = useRef<Edge[]>([])
  const [layoutTick, setLayoutTick] = useState(0)

  const { engine, toggleEngine } = useLayoutEngine()

  const rawNodesRef = useRef<GraphNode[]>([])
  const rawEdgesRef = useRef<GraphEdge[]>([])
  const rootIdRef = useRef<string>('')
  const expandedNodeIdsRef = useRef<Set<string>>(new Set())
  const collapsedNodeIdsRef = useRef<Set<string>>(new Set())
  const revealedChildIdsRef = useRef<Map<string, Set<string>>>(new Map())
  const rebuildFlowRef = useRef<() => void>(() => {})
  const visibleNodeIdsRef = useRef<Set<string>>(new Set())
  const reactFlowInstanceRef = useRef<{ fitView: (opts?: { nodes?: Array<{ id: string }>; padding?: number; duration?: number }) => void } | null>(null)
  const pendingViewportActionRef = useRef<PendingViewportAction | null>(null)
  const pendingAssetActionRef = useRef<(() => void) | null>(null)
  const [expandLoading, setExpandLoading] = useState(false)

  const assetEnabled = Boolean(
    selectedNodeId &&
      !selectedNodeId.startsWith('common:'),
  )
  const { asset, loading: assetLoading, error: assetError, reload: reloadAsset } = useAsset(
    props.projectId,
    selectedNodeId,
    assetEnabled,
  )

  const searchEnabled = props.searchEnabled ?? true
  const canLoad = useMemo(() => status.kind !== 'loading' && selected !== null, [status.kind, selected])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((prev) => applyNodeChanges(changes, prev) as Array<Node<BlueprintNodeData>>),
    [],
  )
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((prev) => applyEdgeChanges(changes, prev)), [])

  const requestAssetPanelAction = useCallback((action: () => void) => {
    if (!selectedNodeId || !assetPanelDirty) {
      action()
      return
    }
    pendingAssetActionRef.current = action
    setShowUnsavedDialog(true)
  }, [selectedNodeId, assetPanelDirty])

  const confirmDiscardAssetChanges = useCallback(() => {
    setShowUnsavedDialog(false)
    setAssetPanelDirty(false)
    const action = pendingAssetActionRef.current
    pendingAssetActionRef.current = null
    action?.()
  }, [])

  const cancelDiscardAssetChanges = useCallback(() => {
    setShowUnsavedDialog(false)
    pendingAssetActionRef.current = null
  }, [])

  // Sync isSelected + isConnected on nodes, and highlight edges
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSelected: n.id === selectedNodeId,
          isConnected: activeHighlight?.nodeIds.has(n.id) === true,
        },
      }))
    )
    setEdges(
      baseEdgesRef.current.map((e) =>
        activeHighlight?.edgeIds.has(e.id)
          ? {
              ...e,
              animated: true,
              zIndex: 1000,
              style: {
                ...(e.style as object),
                stroke: '#00D4FF',
                strokeWidth: 2.5,
                strokeDasharray: '6 4',
              },
              markerEnd: { type: 'arrowclosed' as const, color: '#00D4FF' },
            }
          : e,
      ),
    )
  }, [selectedNodeId, activeHighlight, layoutTick])

  const expandNode = useCallback(async (nodeId: string) => {
    if (expandedNodeIdsRef.current.has(nodeId)) return
    if (!nodeId.startsWith('server:') && !nodeId.startsWith('server-path:')) return
    expandedNodeIdsRef.current.add(nodeId)
    setExpandLoading(true)
    try {
      const resp = await hasApi.projectGraph(props.projectId, nodeId, 2)
      const existingNodeIds = new Set(rawNodesRef.current.map((n) => n.id))
      const existingEdgeKeys = new Set(rawEdgesRef.current.map((e) => `${e.from}->${e.to}:${e.type}`))
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
      collapsedNodeIdsRef.current.delete(nodeId)
      revealedChildIdsRef.current.delete(nodeId)
      for (const edge of rawEdgesRef.current) {
        if (edge.from === nodeId && hasLoadedChildren(edge.to, rawEdgesRef.current)) {
          collapsedNodeIdsRef.current.add(edge.to)
        }
      }
      if (changed) rebuildFlowRef.current()
      else rebuildFlowRef.current()
    } catch {
      expandedNodeIdsRef.current.delete(nodeId)
    } finally {
      setExpandLoading(false)
    }
  }, [props.projectId])

  const rebuildFlow = useCallback(() => {
    const handleToggleExpand = (nodeId: string) => {
      if (!nodeId) return
      if (collapsedNodeIdsRef.current.has(nodeId)) {
        if (expandedNodeIdsRef.current.has(nodeId)) {
          collapsedNodeIdsRef.current.delete(nodeId)
          rebuildFlowRef.current()
        } else {
          void expandNode(nodeId)
        }
        return
      }
      if (hasLoadedChildren(nodeId, rawEdgesRef.current)) {
        collapsedNodeIdsRef.current.add(nodeId)
        revealedChildIdsRef.current.delete(nodeId)
        rebuildFlowRef.current()
        return
      }
      void expandNode(nodeId)
    }
    const onSelectNode = (sourceId: string, targetId: string) => {
      requestAssetPanelAction(() => {
        const matchingEdges = rawEdgesRef.current.filter(
          (e) => e.from === sourceId && e.to === targetId,
        )
        if (!visibleNodeIdsRef.current.has(targetId)) {
          setSelectedNodeId(targetId)
          setActiveHighlight({
            edgeIds: new Set(matchingEdges.map((e) => `${e.from}->${e.to}:${e.type}`)),
            nodeIds: new Set([targetId]),
          })
          if (collapsedNodeIdsRef.current.has(sourceId)) {
            collapsedNodeIdsRef.current.delete(sourceId)
            revealedChildIdsRef.current.delete(sourceId)
            rebuildFlowRef.current()
          } else if (!expandedNodeIdsRef.current.has(sourceId)) {
            void expandNode(sourceId)
          }
          return
        }
        setSelectedNodeId(targetId)
        setActiveHighlight({
          edgeIds: new Set(matchingEdges.map((e) => `${e.from}->${e.to}:${e.type}`)),
          nodeIds: new Set([targetId]),
        })
      })
    }
    const visible = collectVisibleSubgraph(
      rawNodesRef.current,
      rawEdgesRef.current,
      rootIdRef.current ? [rootIdRef.current] : [],
      collapsedNodeIdsRef.current,
      revealedChildIdsRef.current,
    )
    visibleNodeIdsRef.current = new Set(visible.nodes.map((node) => node.id))
    const flow = toFlow(
      visible.nodes,
      visible.edges,
      rawNodesRef.current,
      rawEdgesRef.current,
      rootIdRef.current,
      onSelectNode,
      handleToggleExpand,
      collapsedNodeIdsRef.current,
    )
    graphPaintStartedAtRef.current = performance.now()
    baseEdgesRef.current = flow.edges
    layoutNodesRef.current = flow.nodes
    layoutEdgesRef.current = flow.edges
    setNodes(flow.nodes)
    setEdges(flow.edges)
    setTruncationWarning(
      flow.truncatedAt != null
        ? formatGraphTruncationWarning(
            flow.truncatedAt,
            'Reduce depth or load a narrower root from search to inspect more.',
          )
        : null,
    )
    setLayoutTick((t) => t + 1)
  }, [expandNode, requestAssetPanelAction])
  rebuildFlowRef.current = rebuildFlow

  const loadGraph = useCallback(async (target = selected) => {
    if (!target) return

    setStatus({ kind: 'loading' })
    setError(null)
    setNodes([])
    setEdges([])
    setSelectedNodeId(null)
    setActiveHighlight(null)
    rawNodesRef.current = []
    rawEdgesRef.current = []
    rootIdRef.current = target.assetKey
    expandedNodeIdsRef.current = new Set()
    collapsedNodeIdsRef.current = new Set()
    revealedChildIdsRef.current = new Map()
    visibleNodeIdsRef.current = new Set()
    layoutNodesRef.current = []
    layoutEdgesRef.current = []

    try {
      const data = await measureAsync('view.project_graph.fetch', () => hasApi.projectGraph(props.projectId, target.assetKey, depth + 1), {
        projectId: props.projectId,
        root: target.assetKey,
        depth: depth + 1,
      })
      rawNodesRef.current = data.nodes
      rawEdgesRef.current = data.edges
      expandedNodeIdsRef.current.add(target.assetKey)
      const nodeDepths = computeNodeDepths(target.assetKey, data.edges)
      collapsedNodeIdsRef.current = new Set(
        Array.from(nodeDepths.entries())
          .filter(([, nodeDepth]) => nodeDepth === depth)
          .map(([nodeId]) => nodeId)
          .filter((nodeId) => nodeId !== target.assetKey && hasLoadedChildren(nodeId, data.edges)),
      )
      pendingViewportActionRef.current = { kind: 'fit-all' }
      rebuildFlow()
      setStatus({ kind: 'idle', message: `Graph ready: ${data.nodes.length} nodes, ${data.edges.length} edges loaded. One extra level was prefetched for local expansion.` })
      setTimeout(() => setStatus({ kind: 'idle' }), 1500)
    } catch (e) {
      setStatus({ kind: 'idle' })
      setError(e instanceof HasApiError ? e.message : 'Unable to load graph.')
    }
  }, [props.projectId, selected, depth, rebuildFlow])

  // Re-apply layout when engine or data changes.
  useEffect(() => {
    if (!layoutNodesRef.current.length) return
    const freshNodes = layoutNodesRef.current.map((n) => ({ ...n, position: { x: 0, y: 0 } }))
    const edges = layoutEdgesRef.current
    const applyPositions = (newNodes: typeof freshNodes) => {
      const posMap = new Map(newNodes.map((n) => [n.id, n.position]))
      setNodes((prev) => prev.map((n) => ({ ...n, position: posMap.get(n.id) ?? n.position })))
    }
    if (engine === 'elk') {
      void layoutGraphElk(freshNodes, edges, 'LR').then((r) => applyPositions(r.nodes))
    } else {
      applyPositions(layoutGraph(freshNodes, edges, 'LR').nodes)
    }
  }, [engine, layoutTick])

  // Apply only explicit viewport actions after graph rebuilds.
  useEffect(() => {
    const action = pendingViewportActionRef.current
    if (!action) return
    pendingViewportActionRef.current = null
    reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 400 })
  }, [nodes])

  useEffect(() => {
    if (graphPaintStartedAtRef.current == null) return
    const startedAt = graphPaintStartedAtRef.current
    graphPaintStartedAtRef.current = null
    schedulePaintMeasure('view.project_graph.paint', startedAt, {
      projectId: props.projectId,
      nodes: nodes.length,
      edges: edges.length,
    })
  }, [props.projectId, nodes, edges])

  useEffect(() => {
    if (!props.root) return
    setSelected({ assetKey: props.root.assetKey, display: props.root.display, kind: 'server-json', origin: 'vanilla' })
    setIsDropdownOpen(false)
    setSearchTerm('')
    setSearchResults([])
  }, [props.root])

  useEffect(() => {
    if (!props.autoLoad) return
    if (!selected) return
    void loadGraph()
  }, [props.autoLoad, selected, loadGraph])

  useEffect(() => {
    if (!searchEnabled) return
    if (!isDropdownOpen) return
    const q = searchTerm.trim()
    if (!q) {
      setSearchResults([])
      return
    }

    const mySeq = ++searchSeq.current
    const t = setTimeout(async () => {
      try {
        const resp = await hasApi.projectSearch(props.projectId, q, 100)
        if (searchSeq.current !== mySeq) return
        setSearchResults(resp.results)
      } catch {
        if (searchSeq.current !== mySeq) return
        setSearchResults([])
      }
    }, 200)
    return () => clearTimeout(t)
  }, [searchEnabled, isDropdownOpen, searchTerm, props.projectId])

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return nodes.find((n) => n.id === selectedNodeId) ?? null
  }, [nodes, selectedNodeId])

  const canOpenInteractionEditor = Boolean(
    props.onOpenInteractions &&
      selectedNodeId &&
      selectedNode &&
      isInteractionBlueprintGroup(selectedNode.data.group),
  )

  const currentAssetLabel = asset?.resolvedPath ?? selectedNode?.data.path ?? selectedNode?.data.label ?? selectedNodeId

  function handleSelect(r: SearchResult): void {
    setSelected(r)
    setIsDropdownOpen(false)
    setSearchTerm('')
    setSearchResults([])
    void loadGraph(r)
  }

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#1e1e1e' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        autoPanOnNodeFocus={false}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={(inst) => { reactFlowInstanceRef.current = inst }}
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
        onPaneClick={() => requestAssetPanelAction(() => { setSelectedNodeId(null); setActiveHighlight(null) })}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background gap={20} size={1} color="#444" />
        <Controls />

        <Panel position="top-left" className="panel">
          <h3>{props.title ?? 'Hytale Asset Studio'}</h3>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder={props.searchPlaceholder ?? ''}
                value={isDropdownOpen ? searchTerm : selected?.display ?? ''}
                onChange={(e) => {
                  if (!searchEnabled) return
                  setSearchTerm(e.target.value)
                  setIsDropdownOpen(true)
                }}
                onFocus={() => {
                  if (!searchEnabled) return
                  setSearchTerm('')
                  setIsDropdownOpen(true)
                }}
                onBlur={() => searchEnabled && setTimeout(() => setIsDropdownOpen(false), 200)}
                disabled={!searchEnabled}
                style={{
                  padding: '5px',
                  background: '#333',
                  color: 'white',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  width: '300px',
                }}
              />
              {searchEnabled && isDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    width: '100%',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    background: '#222',
                    border: '1px solid #555',
                    borderRadius: '4px',
                    zIndex: 1000,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                  }}
                >
                  {searchResults.slice(0, 100).map((r) => (
                    <div
                      key={r.assetKey}
                      onClick={() => handleSelect(r)}
                      style={{
                        padding: '6px 8px',
                        cursor: 'pointer',
                        color: selected?.assetKey === r.assetKey ? '#61dafb' : 'white',
                        borderBottom: '1px solid #333',
                        background: selected?.assetKey === r.assetKey ? '#111' : 'transparent',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = selected?.assetKey === r.assetKey ? '#111' : 'transparent')
                      }
                    >
                      {r.group && (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '1px 5px',
                            borderRadius: 3,
                            fontSize: 10,
                            fontWeight: 'bold',
                            background: getColorForGroup(r.group),
                            color: '#111',
                            textTransform: 'uppercase',
                            flexShrink: 0,
                          }}
                        >
                          {r.group}
                        </span>
                      )}
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display}</span>
                        {r.path && (
                          <span style={{ fontSize: 10, color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.path}
                          </span>
                        )}
                      </div>
                      {r.ambiguous && (
                        <span style={{ fontSize: 10, color: '#ffb347', flexShrink: 0 }}>AMBIG</span>
                      )}
                      {r.origin === 'project' && (
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#FFB347', flexShrink: 0 }}>LOCAL</span>
                      )}
                    </div>
                  ))}
                  {searchTerm.trim() && searchResults.length === 0 && (
                    <div style={{ padding: '8px', color: '#888', fontStyle: 'italic', fontSize: '12px' }}>Aucun résultat</div>
                  )}
                </div>
              )}
            </div>

            <input
              type="number"
              min={0}
              max={10}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              style={{
                padding: '5px',
                background: '#333',
                color: 'white',
                border: '1px solid #555',
                borderRadius: '4px',
                width: '70px',
              }}
              title="Depth"
            />

            <button
              onClick={() => void loadGraph()}
              disabled={!canLoad}
              style={{
                padding: '5px 10px',
                background: '#61dafb',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {status.kind === 'loading' ? 'Loading…' : 'Load'}
            </button>

            <button
              onClick={toggleEngine}
              title="Basculer moteur de layout"
              style={{
                padding: '5px 10px',
                background: engine === 'elk' ? '#4a3f7a' : '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              {engine === 'elk' ? 'ELK' : 'Dagre'}
            </button>

            <button
              onClick={props.onBack}
              disabled={status.kind === 'loading'}
              style={{
                padding: '5px 10px',
                background: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          </div>

          <p style={{ marginTop: 8, marginBottom: 0, fontSize: 10, color: '#7f8a96', lineHeight: 1.4 }}>
            Select a search result to load it immediately. Use the plus/minus control on a node to reveal or hide descendants without recentering the graph.
          </p>

          {expandLoading && <p style={{ marginTop: 4, fontSize: 10, color: '#888', fontStyle: 'italic' }}>⟳ Expanding…</p>}
          {status.message && <p style={{ marginTop: 10, opacity: 0.8 }}>{status.message}</p>}
          {truncationWarning && <p style={{ marginTop: 8, color: '#FF9500', fontSize: 11 }}>{truncationWarning}</p>}
          {error && <p style={{ marginTop: 8, color: '#FF6B6B' }}>{error}</p>}
        </Panel>
      </ReactFlow>

      {selectedNodeId && (
        <AssetSidePanel
          projectId={props.projectId}
          selectedNodeId={selectedNodeId}
          asset={asset}
          loading={assetLoading}
          error={assetError}
          onClose={() => requestAssetPanelAction(() => { setSelectedNodeId(null); setActiveHighlight(null) })}
          onRefresh={reloadAsset}
          onDirtyChange={setAssetPanelDirty}
          onOpenInteractions={canOpenInteractionEditor
            ? () => {
                if (!selectedNodeId || !selectedNode) return
                props.onOpenInteractions?.({
                  assetKey: selectedNodeId,
                  display: getBlueprintNodeDisplay(selectedNode.data, selectedNodeId),
                })
              }
            : undefined}
          canOpenInteractions={canOpenInteractionEditor}
          interactionHint={canOpenInteractionEditor
            ? 'Open the interaction tree for the selected item from here.'
            : undefined}
        />
      )}

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        assetLabel={currentAssetLabel}
        onCancel={cancelDiscardAssetChanges}
        onDiscard={confirmDiscardAssetChanges}
      />
    </div>
  )
}
