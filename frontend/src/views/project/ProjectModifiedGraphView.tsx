import { useCallback, useEffect, useRef, useState } from 'react'
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
import type { AssetGetResponse, GraphEdge as RawEdge, GraphNode as RawNode } from '../../api'
import { AssetSidePanel } from '../../components/editor/AssetSidePanel'
import type { OutgoingDep } from '../../components/graph/BlueprintNode'
import { BlueprintNode } from '../../components/graph/BlueprintNode'
import { getColorForEdgeType } from '../../components/graph/colors'
import { layoutGraph } from '../../components/graph/layoutDagre'

const SEMANTIC_EDGE_TYPES = new Set([
  'next', 'failed', 'replace', 'fork', 'blocked', 'collisionNext', 'groundNext',
])
const nodeTypes = { blueprint: BlueprintNode }

type Props = {
  projectId: string
  onBack: () => void
  onOpenInteractions: (root: { assetKey: string; display: string }) => void
}

// ── Build ReactFlow nodes+edges from raw API data ─────────────────────────────
function toFlow(
  rawNodes: RawNode[],
  rawEdges: RawEdge[],
  modifiedIdSet: Set<string>,
  onSelectNode: (src: string, tgt: string) => void,
) {
  const outgoingMap = new Map<string, OutgoingDep[]>()
  for (const n of rawNodes) outgoingMap.set(n.id, [])
  for (const e of rawEdges) {
    const list = outgoingMap.get(e.from) ?? []
    const target = rawNodes.find((n) => n.id === e.to)
    list.push({
      edgeLabel: e.type,
      targetId: e.to,
      targetLabel: target?.label ?? e.to,
      targetGroup: target?.group ?? 'json_data',
    })
    outgoingMap.set(e.from, list)
  }

  const nodes: Node[] = rawNodes.map((n) => ({
    id: n.id,
    type: 'blueprint',
    position: { x: 0, y: 0 },
    data: {
      label: n.label,
      group: n.group ?? 'json_data',
      path: n.path,
      isModified: n.state === 'local',
      isRoot: modifiedIdSet.has(n.id),
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
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ProjectModifiedGraphView(props: Props) {
  const [depth, setDepth] = useState(1)
  const [loading, setLoading] = useState(false)
  const [expandLoading, setExpandLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Raw accumulated data (grows on expand clicks)
  const rawNodesRef = useRef<RawNode[]>([])
  const rawEdgesRef = useRef<RawEdge[]>([])
  const modifiedIdSetRef = useRef<Set<string>>(new Set())
  const expandedNodeIdsRef = useRef<Set<string>>(new Set())

  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((n) => applyNodeChanges(changes, n)),
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

  const [activeHighlight, setActiveHighlight] = useState<{
    edgeIds: Set<string>
    nodeIds: Set<string>
  } | null>(null)

  // Rebuild ReactFlow display from accumulated raw data
  const rebuildFlow = useCallback(() => {
    const { nodes: fn, edges: fe } = toFlow(
      rawNodesRef.current,
      rawEdgesRef.current,
      modifiedIdSetRef.current,
      (_, targetId) => setSelectedNodeId(targetId),
    )
    setNodes(fn)
    setEdges(fe)
  }, [])

  // ── Full reload on mount / projectId / depth change ───────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSelectedNodeId(null)
    setActiveHighlight(null)
    rawNodesRef.current = []
    rawEdgesRef.current = []
    modifiedIdSetRef.current = new Set()
    expandedNodeIdsRef.current = new Set()
    setNodes([])
    setEdges([])

    ;(async () => {
      try {
        const resp = await hasApi.projectGraphModified(props.projectId, depth)
        if (cancelled) return
        rawNodesRef.current = resp.nodes
        rawEdgesRef.current = resp.edges
        modifiedIdSetRef.current = new Set(resp.modifiedIds ?? [])
        // Modified roots were already traversed by the BFS
        expandedNodeIdsRef.current = new Set(resp.modifiedIds ?? [])
        rebuildFlow()
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
      if (!nodeId.startsWith('server:')) return
      expandedNodeIdsRef.current.add(nodeId)
      setExpandLoading(true)
      try {
        const resp = await hasApi.projectGraph(props.projectId, nodeId, 1)
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
        if (changed) rebuildFlow()
      } catch {
        // silently ignore expand errors
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
      setAssetError('Common resource (no server JSON)')
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
  const displayNodes = activeHighlight
    ? nodes.map((n) => ({
        ...n,
        data: { ...n.data, isConnected: activeHighlight.nodeIds.has(n.id) },
      }))
    : nodes

  const displayEdges = activeHighlight
    ? edges.map((e) => ({
        ...e,
        style: {
          ...e.style,
          opacity: activeHighlight.edgeIds.has(e.id) ? 1 : 0.08,
          strokeWidth: activeHighlight.edgeIds.has(e.id) ? 2.5 : 1,
        },
      }))
    : edges

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId) ?? null
    : null
  const canOpenInteractions = Boolean(
    selectedNodeId &&
      selectedNode &&
      typeof (selectedNode.data as any)?.group === 'string' &&
      ((selectedNode.data as any).group === 'interaction' ||
        (selectedNode.data as any).group === 'rootinteraction'),
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#1e1e1e' }}>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, n) => {
          setSelectedNodeId(n.id)
          const connectedEdges = edges.filter(
            (e) => e.source === n.id || e.target === n.id,
          )
          const neighborIds = new Set<string>()
          connectedEdges.forEach((e) => {
            if (e.source !== n.id) neighborIds.add(e.source)
            if (e.target !== n.id) neighborIds.add(e.target)
          })
          setActiveHighlight({
            edgeIds: new Set(connectedEdges.map((e) => e.id)),
            nodeIds: new Set([n.id, ...neighborIds]),
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

        <Panel position="top-left">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: 'rgba(14,14,22,0.88)',
              border: '1px solid #2e2e45',
              borderRadius: 6,
              padding: '10px 14px',
              minWidth: 220,
              backdropFilter: 'blur(6px)',
            }}
          >
            {/* Title + Back */}
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

            {/* Depth selector */}
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

            {/* Stats */}
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
          </div>
        </Panel>
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
          onRefresh={() => setAssetReloadTick((t) => t + 1)}
          onOpenInteractions={
            props.onOpenInteractions
              ? () => {
                  if (!canOpenInteractions || !selectedNodeId || !selectedNode) return
                  props.onOpenInteractions?.({
                    assetKey: selectedNodeId,
                    display: String((selectedNode.data as any)?.label ?? selectedNodeId),
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

