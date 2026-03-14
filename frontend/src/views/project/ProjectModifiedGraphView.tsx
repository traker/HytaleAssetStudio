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
import { getColorForEdgeType } from '../../components/graph/colors'
import { layoutGraph, layoutGraphElk, MAX_DAGRE_NODES } from '../../components/graph/layoutDagre'
import { measureAsync, measureSync, schedulePaintMeasure } from '../../perf/audit'
import { useLayoutEngine } from '../../hooks/useLayoutEngine'

const SEMANTIC_EDGE_TYPES = new Set([
  'next', 'failed', 'replace', 'fork', 'blocked', 'collisionNext', 'groundNext',
])
const nodeTypes = { blueprint: BlueprintNode }

type Props = {
  projectId: string
  onBack: () => void
  onOpenInteractions: (root: { assetKey: string; display: string }) => void
}

type HighlightState = {
  edgeIds: Set<string>
  nodeIds: Set<string>
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

function buildFlowSignature(rawNodes: RawNode[], rawEdges: RawEdge[], modifiedIdSet: Set<string>): string {
  const nodePart = rawNodes
    .map((node) => `${node.id}|${node.path ?? ''}|${node.group ?? ''}|${node.state}|${node.modificationKind ?? ''}|${modifiedIdSet.has(node.id) ? '1' : '0'}`)
    .join('~')
  const edgePart = rawEdges
    .map((edge) => `${edge.from}>${edge.to}:${edge.type}`)
    .join('~')
  return `${nodePart}#${edgePart}`
}

function collectAffectedNodeIds(previousSelectedNodeId: string | null, previousHighlight: HighlightState | null, nextSelectedNodeId: string | null, nextHighlight: HighlightState | null): Set<string> {
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
  rawNodes: RawNode[],
  rawEdges: RawEdge[],
  modifiedIdSet: Set<string>,
  onSelectNode: (src: string, tgt: string) => void,
) {
  return measureSync('graph.modified_to_flow', () => {
    const nodeById = new Map<string, RawNode>()
    for (const node of rawNodes) {
      nodeById.set(node.id, node)
    }

    const outgoingMap = new Map<string, OutgoingDep[]>()
    for (const n of rawNodes) outgoingMap.set(n.id, [])
    for (const e of rawEdges) {
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

    const nodes: Array<Node<BlueprintNodeData>> = rawNodes.map((n) => ({
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
      },
    }))

    const edges: Edge[] = rawEdges.map((e) => {
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
  }, { nodes: rawNodes.length, edges: rawEdges.length, modifiedRoots: modifiedIdSet.size })
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ProjectModifiedGraphView(props: Props) {
  const [depth, setDepth] = useState(1)
  const [loading, setLoading] = useState(false)
  const [expandLoading, setExpandLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [truncationWarning, setTruncationWarning] = useState<string | null>(null)
  const [modifiedEntries, setModifiedEntries] = useState<ModifiedAssetEntry[]>([])
  const [filterText, setFilterText] = useState('')

  // Raw accumulated data (grows on expand clicks)
  const rawNodesRef = useRef<RawNode[]>([])
  const rawEdgesRef = useRef<RawEdge[]>([])
  const modifiedIdSetRef = useRef<Set<string>>(new Set())
  const expandedNodeIdsRef = useRef<Set<string>>(new Set())

  const [nodes, setNodes] = useState<Array<Node<BlueprintNodeData>>>([])
  const [edges, setEdges] = useState<Edge[]>([])
  // Plain (un-highlighted) edges — source of truth for re-applying highlight
  const baseEdgesRef = useRef<Edge[]>([])
  // Incremented on each rebuildFlow to re-trigger the highlight useEffect
  const [rebuildTick, setRebuildTick] = useState(0)
  const graphPaintStartedAtRef = useRef<number | null>(null)
  const lastFlowSignatureRef = useRef<string | null>(null)
  const layoutNodesRef = useRef<Array<Node<BlueprintNodeData>>>([])
  const layoutEdgesRef = useRef<Edge[]>([])

  const { engine, toggleEngine } = useLayoutEngine()

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
  const [asset, setAsset] = useState<AssetGetResponse | null>(null)
  const [assetLoading, setAssetLoading] = useState(false)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [assetReloadTick, setAssetReloadTick] = useState(0)
  const assetSeq = useRef(0)
  const previousProjectIdRef = useRef<string | null>(null)

  const [activeHighlight, setActiveHighlight] = useState<HighlightState | null>(null)
  const previousSelectedNodeIdRef = useRef<string | null>(null)
  const previousActiveHighlightRef = useRef<HighlightState | null>(null)
  const reactFlowInstanceRef = useRef<{ fitView: (opts?: { nodes?: Array<{ id: string }>, padding?: number, duration?: number }) => void } | null>(null)
  const pendingFocusRef = useRef<string | null>(null)

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

  const filteredEntries = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return visibleModifiedEntries
    return visibleModifiedEntries.filter((e) =>
      e.vfsPath.toLowerCase().includes(q) ||
      (e.assetKey ?? '').toLowerCase().includes(q),
    )
  }, [visibleModifiedEntries, filterText])

  const handleModifiedEntryClick = useCallback((entry: ModifiedAssetEntry) => {
    if (!entry.assetKey) return
    const assetKey = entry.assetKey
    // assetKey from the modified list is always "server-path:…" but the graph node
    // may use "server:SomeId" when the ID is unique — resolve by path or direct match
    const graphNode = rawNodesRef.current.find(
      (n) => n.id === assetKey || (n.path != null && assetKey === `server-path:${n.path}`),
    )
    if (graphNode) {
      // Use the graph node's actual ID so the highlight effect updates `nodes`
      // (which triggers the focus useEffect to call fitView)
      pendingFocusRef.current = graphNode.id
      setSelectedNodeId(graphNode.id)
    } else {
      setSelectedNodeId(assetKey)
    }
    setActiveHighlight(null)
  }, [])

  // ── Sync isSelected + isConnected on nodes, animate highlighted edges ─────
  useEffect(() => {
    const previousSelectedNodeId = previousSelectedNodeIdRef.current
    const previousActiveHighlight = previousActiveHighlightRef.current
    const affectedNodeIds = collectAffectedNodeIds(previousSelectedNodeId, previousActiveHighlight, selectedNodeId, activeHighlight)
    const affectedEdgeIds = collectAffectedEdgeIds(previousActiveHighlight, activeHighlight)

    setNodes((prev) => {
      if (affectedNodeIds.size === 0) return prev
      let changed = false
      const next = prev.map((node) => {
        if (!affectedNodeIds.has(node.id)) return node
        const isSelected = node.id === selectedNodeId
        const isConnected = activeHighlight?.nodeIds.has(node.id) === true && node.id !== selectedNodeId
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
            style: { ...(edge.style as object), stroke: '#00D4FF', strokeDasharray: '6 3', strokeWidth: 2.5 },
            markerEnd: { type: 'arrowclosed' as const, color: '#00D4FF' },
          }
        }
        if (existing && existing.animated === false) {
          return existing
        }
        changed = true
        return edge
      })
      return changed ? next : prev
    })

    previousSelectedNodeIdRef.current = selectedNodeId
    previousActiveHighlightRef.current = activeHighlight
  // rebuildTick ensures this re-runs after an expand merges new edges into baseEdgesRef
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId, activeHighlight, rebuildTick])

  // Focus graph on a node requested from the list (runs after nodes state is updated)
  useEffect(() => {
    const id = pendingFocusRef.current
    if (!id) return
    pendingFocusRef.current = null
    reactFlowInstanceRef.current?.fitView({
      nodes: [{ id }] as { id: string }[],
      padding: 0.5,
      duration: 500,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes])

  // dep-ref click from inside a BlueprintNode
  const handleSelectNode = useCallback((sourceId: string, targetId: string) => {
    setSelectedNodeId(targetId)
    const matchingEdges = baseEdgesRef.current.filter(
      (e) => e.source === sourceId && e.target === targetId,
    )
    setActiveHighlight({
      edgeIds: new Set(matchingEdges.map((e) => e.id)),
      nodeIds: new Set([targetId]),
    })
  }, [])

  // Rebuild ReactFlow display from accumulated raw data
  const rebuildFlow = useCallback(() => {
    const flowSignature = buildFlowSignature(rawNodesRef.current, rawEdgesRef.current, modifiedIdSetRef.current)
    if (lastFlowSignatureRef.current === flowSignature) {
      return
    }

    const { nodes: fn, edges: fe, truncatedAt } = toFlow(
      rawNodesRef.current,
      rawEdgesRef.current,
      modifiedIdSetRef.current,
      handleSelectNode,
    )
    lastFlowSignatureRef.current = flowSignature
    graphPaintStartedAtRef.current = performance.now()
    baseEdgesRef.current = fe
    layoutNodesRef.current = fn
    layoutEdgesRef.current = fe
    setNodes(fn)
    setEdges(fe)
    setTruncationWarning(
      truncatedAt != null
        ? `⚠ Graph truncated to ${MAX_DAGRE_NODES} nodes (${truncatedAt} total)`
        : null,
    )
    setRebuildTick((t) => t + 1)
  }, [handleSelectNode])

  // Re-apply layout when engine or rebuild tick changes
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
  }, [engine, rebuildTick]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Soft graph refresh after a save (keeps current selection) ────────────
  const softReloadGraph = useCallback(async () => {
    try {
      const [graphResp, modifiedResp] = await Promise.all([
        measureAsync('view.modified_graph.fetch_graph', () => hasApi.projectGraphModified(props.projectId, depth), {
          projectId: props.projectId,
          depth,
        }),
        measureAsync('view.modified_graph.fetch_list', () => hasApi.projectModified(props.projectId), {
          projectId: props.projectId,
        }),
      ])
      rawNodesRef.current = applyModificationKindsToNodes(graphResp.nodes, modifiedResp.entries)
      rawEdgesRef.current = graphResp.edges
      modifiedIdSetRef.current = new Set(graphResp.modifiedIds ?? [])
      expandedNodeIdsRef.current = new Set(graphResp.modifiedIds ?? [])
      setModifiedEntries(modifiedResp.entries)
      rebuildFlow()
      setError(null)
    } catch (e) {
      setError(e instanceof HasApiError ? e.message : 'Failed to refresh modified graph')
    }
  }, [props.projectId, depth, rebuildFlow])

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
      lastFlowSignatureRef.current = null
      setModifiedEntries([])
      setNodes([])
      setEdges([])
    }

    ;(async () => {
      try {
        const [graphResp, modifiedResp] = await Promise.all([
          measureAsync('view.modified_graph.fetch_graph', () => hasApi.projectGraphModified(props.projectId, depth), {
            projectId: props.projectId,
            depth,
          }),
          measureAsync('view.modified_graph.fetch_list', () => hasApi.projectModified(props.projectId), {
            projectId: props.projectId,
          }),
        ])
        if (cancelled) return
        rawNodesRef.current = applyModificationKindsToNodes(graphResp.nodes, modifiedResp.entries)
        rawEdgesRef.current = graphResp.edges
        modifiedIdSetRef.current = new Set(graphResp.modifiedIds ?? [])
        // Modified roots were already traversed by the BFS
        expandedNodeIdsRef.current = new Set(graphResp.modifiedIds ?? [])
        setModifiedEntries(modifiedResp.entries)
        rebuildFlow()

        if (selectedNodeId && !graphResp.nodes.some((node) => node.id === selectedNodeId)) {
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
  }, [props.projectId, depth, rebuildFlow])

  // ── Expand a node (load its depth-1 subgraph and merge) ───────────────────
  const expandNode = useCallback(
    async (nodeId: string) => {
      if (expandedNodeIdsRef.current.has(nodeId)) return
      if (!nodeId.startsWith('server:') && !nodeId.startsWith('server-path:')) return
      setExpandLoading(true)
      try {
        const resp = await measureAsync('view.modified_graph.expand', () => hasApi.projectGraph(props.projectId, nodeId, 1), {
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
        if (changed) rebuildFlow()
        setError(null)
      } catch (e) {
        expandedNodeIdsRef.current.delete(nodeId)
        setError(e instanceof HasApiError ? e.message : 'Failed to expand node')
      } finally {
        setExpandLoading(false)
      }
    },
    [props.projectId, rebuildFlow],
  )

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
          <button
            onClick={toggleEngine}
            title="Basculer moteur de layout"
            style={{
              background: engine === 'elk' ? '#2e1e5a' : 'none',
              border: `1px solid ${engine === 'elk' ? '#5544aa' : '#3a3a55'}`,
              borderRadius: 4,
              color: engine === 'elk' ? '#8877ee' : '#888',
              fontSize: 10,
              cursor: 'pointer',
              padding: '2px 8px',
              fontWeight: 600,
            }}
          >
            {engine === 'elk' ? 'ELK' : 'Dagre'}
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
              {truncationWarning && (
                <div style={{ color: '#FF9500', marginBottom: 4, fontSize: 10 }}>{truncationWarning}</div>
              )}
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
                  Click a node to reveal its children
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10 }}>
          <span style={{ color: '#dff8ea', background: '#36c275', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>
            NEW = only in current project
          </span>
          <span style={{ color: '#2b1800', background: '#ffb347', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>
            OVERRIDE = ID exists below
          </span>
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
              <span style={{ fontSize: 10, color: filterText ? '#aaaaff' : '#555', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {filterText
                  ? `${filteredEntries.length}/${visibleModifiedEntries.length}`
                  : `${visibleModifiedEntries.length} file${visibleModifiedEntries.length !== 1 ? 's' : ''}`
                }
              </span>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
            {filteredEntries.length === 0 && (
              <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic', textAlign: 'center', marginTop: 12 }}>Aucun résultat</div>
            )}
            {filteredEntries.map((entry) => {
              const isSelected = selectedNodeId === entry.assetKey
              const badgeLabel = entry.modificationKind === 'new' ? 'NEW' : 'OVERRIDE'
              const badgeColor = entry.modificationKind === 'new' ? '#36c275' : '#ffb347'
              const badgeTextColor = entry.modificationKind === 'new' ? '#dff8ea' : '#2b1800'
              const rowBackground = isSelected
                ? '#1e2a36'
                : entry.modificationKind === 'new'
                  ? 'rgba(13, 42, 27, 0.55)'
                  : 'rgba(48, 30, 12, 0.55)'
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
                    border: `1px solid ${badgeColor}66`,
                    borderLeft: `4px solid ${badgeColor}`,
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
                    <span style={{ fontSize: 9, color: badgeTextColor, background: badgeColor, border: `1px solid ${badgeColor}`, borderRadius: 999, padding: '1px 5px', flexShrink: 0, fontWeight: 700 }}>
                      {badgeLabel}
                    </span>
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={(instance) => { reactFlowInstanceRef.current = instance as typeof reactFlowInstanceRef.current }}
        onNodeClick={(_, n) => {
          setSelectedNodeId(n.id)
          const connectedEdges = baseEdgesRef.current.filter(
            (e) => e.source === n.id || e.target === n.id,
          )
          const neighborIds = new Set<string>()
          connectedEdges.forEach((e) => {
            if (e.source !== n.id) neighborIds.add(e.source)
            if (e.target !== n.id) neighborIds.add(e.target)
          })
          setActiveHighlight({
            edgeIds: new Set(connectedEdges.map((e) => e.id)),
            nodeIds: neighborIds,
          })
          void expandNode(n.id)
        }}
        onPaneClick={() => {
          setSelectedNodeId(null)
          setActiveHighlight(null)
        }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
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
          onClose={() => {
            setSelectedNodeId(null)
            setActiveHighlight(null)
          }}
          onRefresh={handleAssetRefresh}
          onOpenInteractions={
            props.onOpenInteractions
              ? () => {
                  if (!canOpenInteractions || !selectedNodeId || !selectedNode) return
                  props.onOpenInteractions?.({
                    assetKey: selectedNodeId,
                    display: getBlueprintNodeDisplay(selectedNode.data, selectedNodeId),
                  })
                }
              : undefined
          }
          canOpenInteractions={canOpenInteractions}
        />
      )}
    </div>
  )
}

