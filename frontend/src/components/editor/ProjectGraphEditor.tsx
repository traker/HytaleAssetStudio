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
import { layoutGraph, layoutGraphElk, MAX_DAGRE_NODES } from '../../components/graph/layoutDagre'
import { measureAsync, measureSync, schedulePaintMeasure } from '../../perf/audit'
import { useAsset } from '../../hooks/useAsset'
import { useLayoutEngine } from '../../hooks/useLayoutEngine'

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

const nodeTypes = {
  blueprint: BlueprintNode,
}

// Relation types that are meaningful enough to show as edge labels on the graph.
const SEMANTIC_EDGE_TYPES = new Set(['next', 'failed', 'replace', 'fork', 'blocked', 'collisionNext', 'groundNext'])

function toFlow(
  rawNodes: GraphNode[],
  rawEdges: GraphEdge[],
  rootId: string,
  onSelectNode: (sourceId: string, targetId: string) => void,
): { nodes: Node<BlueprintNodeData>[]; edges: Edge[]; truncatedAt?: number } {
  return measureSync('graph.to_flow', () => {
    const nodeInfoMap = new Map(rawNodes.map((n) => [n.id, { label: n.label, group: n.group ?? 'json_data' }]))

    const outgoingMap = new Map<string, OutgoingDep[]>()
    for (const e of rawEdges) {
      if (!outgoingMap.has(e.from)) outgoingMap.set(e.from, [])
      const target = nodeInfoMap.get(e.to)
      outgoingMap.get(e.from)!.push({
        edgeLabel: e.type,
        targetId: e.to,
        targetLabel: target?.label ?? e.to,
        targetGroup: target?.group ?? 'json_data',
      })
    }

    const nodes: Node<BlueprintNodeData>[] = rawNodes.map((n) => ({
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
  }, { nodes: rawNodes.length, edges: rawEdges.length, rootId })
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
  const reactFlowInstanceRef = useRef<{ fitView: (opts?: { nodes?: Array<{ id: string }>; padding?: number; duration?: number }) => void } | null>(null)
  const pendingFocusRef = useRef<string | null>(null)
  const selectedNodeIdRef = useRef<string | null>(null)
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

  // Sync isSelected + isConnected on nodes, and highlight edges
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSelected: n.id === selectedNodeId,
          isConnected: activeHighlight?.nodeIds.has(n.id) === true && n.id !== selectedNodeId,
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
              style: { ...(e.style as object), stroke: '#00D4FF', strokeDasharray: '6 3', strokeWidth: 2.5 },
              markerEnd: { type: 'arrowclosed' as const, color: '#00D4FF' },
            }
          : e,
      ),
    )
  }, [selectedNodeId, activeHighlight, layoutTick])

  const rebuildFlow = useCallback(() => {
    const onSelectNode = (sourceId: string, targetId: string) => {
      setSelectedNodeId(targetId)
      const matchingEdges = baseEdgesRef.current.filter(
        (e) => e.source === sourceId && e.target === targetId,
      )
      setActiveHighlight({
        edgeIds: new Set(matchingEdges.map((e) => e.id)),
        nodeIds: new Set([targetId]),
      })
    }
    const flow = toFlow(rawNodesRef.current, rawEdgesRef.current, rootIdRef.current, onSelectNode)
    graphPaintStartedAtRef.current = performance.now()
    baseEdgesRef.current = flow.edges
    layoutNodesRef.current = flow.nodes
    layoutEdgesRef.current = flow.edges
    setNodes(flow.nodes)
    setEdges(flow.edges)
    setTruncationWarning(
      flow.truncatedAt != null
        ? `⚠ Graph truncated to ${MAX_DAGRE_NODES} nodes (${flow.truncatedAt} total — increase depth or narrow search)`
        : null,
    )
    setLayoutTick((t) => t + 1)
  }, [])

  const expandNode = useCallback(async (nodeId: string) => {
    if (expandedNodeIdsRef.current.has(nodeId)) return
    if (!nodeId.startsWith('server:') && !nodeId.startsWith('server-path:')) return
    expandedNodeIdsRef.current.add(nodeId)
    setExpandLoading(true)
    try {
      const resp = await hasApi.projectGraph(props.projectId, nodeId, 1)
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
      if (changed) {
        pendingFocusRef.current = selectedNodeIdRef.current
        rebuildFlow()
      }
    } catch {
      expandedNodeIdsRef.current.delete(nodeId)
    } finally {
      setExpandLoading(false)
    }
  }, [props.projectId, rebuildFlow])

  const load = useCallback(async () => {
    if (!selected) return

    setStatus({ kind: 'loading' })
    setError(null)
    setNodes([])
    setEdges([])
    setSelectedNodeId(null)
    setActiveHighlight(null)
    rawNodesRef.current = []
    rawEdgesRef.current = []
    rootIdRef.current = selected.assetKey
    expandedNodeIdsRef.current = new Set()
    layoutNodesRef.current = []
    layoutEdgesRef.current = []

    try {
      const data = await measureAsync('view.project_graph.fetch', () => hasApi.projectGraph(props.projectId, selected.assetKey, depth), {
        projectId: props.projectId,
        root: selected.assetKey,
        depth,
      })
      rawNodesRef.current = data.nodes
      rawEdgesRef.current = data.edges
      expandedNodeIdsRef.current.add(selected.assetKey)
      rebuildFlow()
      setStatus({ kind: 'idle', message: `Loaded: ${data.nodes.length} nodes, ${data.edges.length} edges` })
      setTimeout(() => setStatus({ kind: 'idle' }), 1500)
    } catch (e) {
      setStatus({ kind: 'idle' })
      setError(e instanceof HasApiError ? e.message : 'Unexpected error')
    }
  }, [props.projectId, selected, depth, rebuildFlow])

  // Re-apply layout when engine or data changes; pre-set focus target so the
  // focus effect fires after setNodes completes.
  useEffect(() => {
    if (!layoutNodesRef.current.length) return
    if (selectedNodeIdRef.current) pendingFocusRef.current = selectedNodeIdRef.current
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
  }, [engine, layoutTick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep selectedNodeIdRef in sync for use inside stable callbacks
  useEffect(() => { selectedNodeIdRef.current = selectedNodeId }, [selectedNodeId])

  // Expand adjacent nodes on selection
  useEffect(() => {
    if (!selectedNodeId) return
    void expandNode(selectedNodeId)
  }, [selectedNodeId, expandNode])

  // Focus the selected node after each layout update
  useEffect(() => {
    const id = pendingFocusRef.current
    if (!id) return
    pendingFocusRef.current = null
    reactFlowInstanceRef.current?.fitView({ nodes: [{ id }], padding: 0.5, duration: 400 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [props.root?.assetKey, props.root?.display])

  useEffect(() => {
    if (!props.autoLoad) return
    if (!selected) return
    void load()
  }, [props.autoLoad, selected?.assetKey, load])

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
  }, [isDropdownOpen, searchTerm, props.projectId])

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

  function handleSelect(r: SearchResult): void {
    setSelected(r)
    setIsDropdownOpen(false)
    setSearchTerm('')
    setSearchResults([])
  }

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#1e1e1e' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={(inst) => { reactFlowInstanceRef.current = inst }}
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
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
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
              title="Profondeur"
            />

            <button
              onClick={load}
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
              {status.kind === 'loading' ? 'Chargement...' : 'Charger'}
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
          onClose={() => { setSelectedNodeId(null); setActiveHighlight(null) }}
          onRefresh={reloadAsset}
          onOpenInteractions={
            props.onOpenInteractions
              ? () => {
                  if (!canOpenInteractionEditor || !selectedNodeId || !selectedNode) return
                  props.onOpenInteractions?.({
                    assetKey: selectedNodeId,
                    display: getBlueprintNodeDisplay(selectedNode.data, selectedNodeId),
                  })
                }
              : undefined
          }
          canOpenInteractions={canOpenInteractionEditor}
        />
      )}
    </div>
  )
}
