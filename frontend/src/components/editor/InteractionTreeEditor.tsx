import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { HasApiError, hasApi } from '../../api'
import type { InteractionTreeResponse } from '../../api'

import { AssetSidePanel } from './AssetSidePanel'
import { InteractionPalette, DRAG_MIME } from './InteractionPalette'
import { InteractionFormPanel } from './InteractionFormPanel'
import { InteractionNode, type InteractionNodeData } from '../../components/graph/InteractionNode'
import { getColorForEdgeType } from '../../components/graph/colors'
import { layoutGraph, MAX_DAGRE_NODES } from '../../components/graph/layoutDagre'
import { exportInteractionTree } from '../../components/graph/interactionExport'
import { useAsset } from '../../hooks/useAsset'

type Props = {
  projectId: string
  root: { assetKey: string; display: string }
  onBack: () => void
  onOpenItem?: (root: { assetKey: string; display: string }) => void
}

type Status = { kind: 'idle' | 'loading'; message?: string }
type SaveStatus = 'idle' | 'saving' | 'ok' | 'error'

const nodeTypes = { interaction: InteractionNode }

const SEMANTIC_EDGE_TYPES = new Set([
  'next', 'failed', 'replace', 'fork', 'blocked', 'collisionNext', 'groundNext', 'start', 'cancel', 'hitBlock', 'hitEntity', 'hitNothing', 'calls', 'child',
])

const EDGE_TYPE_BY_SOURCE_HANDLE: Record<string, string> = {
  failed: 'failed',
  next: 'next',
  replace: 'replace',
  child: 'child',
  fork: 'fork',
  blocked: 'blocked',
  collisionNext: 'collisionNext',
  groundNext: 'groundNext',
  start: 'start',
  cancel: 'cancel',
  hitBlock: 'hitBlock',
  hitEntity: 'hitEntity',
  hitNothing: 'hitNothing',
}

function edgeTypeToSourceHandle(edgeType: string): string {
  return EDGE_TYPE_BY_SOURCE_HANDLE[edgeType] ?? (edgeType === 'failed' ? 'failed' : edgeType === 'next' ? 'next' : 'child')
}

function toFlow(data: InteractionTreeResponse): { nodes: Node[]; edges: Edge[]; truncatedAt?: number } {
  const rootNodeIds = new Set(data.nodes.filter((n) => n.type === 'Root').map((n) => n.id))

  const nodes: Node[] = data.nodes.map((n) => ({
    id: n.id,
    type: 'interaction',
    position: { x: 0, y: 0 },
    data: {
      label: n.label,
      nodeType: n.type,
      isExternal: n.isExternal,
      rawFields: n.rawFields,
    } satisfies InteractionNodeData,
  }))

  const edges: Edge[] = data.edges.map((e) => {
    const sourceHandle = rootNodeIds.has(e.from) ? undefined : edgeTypeToSourceHandle(e.type)
    const color = getColorForEdgeType(e.type)
    return {
      id: `${e.from}->${e.to}:${e.type}`,
      source: e.from,
      target: e.to,
      sourceHandle,
      type: 'smoothstep',
      label: SEMANTIC_EDGE_TYPES.has(e.type) ? e.type : undefined,
      animated: false,
      style: { stroke: color, strokeWidth: 1.5 },
      labelStyle: { fill: color, fontSize: 9, fontStyle: 'italic', fontWeight: 600 },
      labelShowBg: false,
      markerEnd: { type: 'arrowclosed' as const, color },
      data: { edgeType: e.type },
    }
  })

  return layoutGraph(nodes, edges, 'TB')
}

// ─────────────────────────────────────────────────────────────
// Button style helper
// ─────────────────────────────────────────────────────────────

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '5px 10px',
    background: bg,
    color: '#fff',
    border: '1px solid #555',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: 12,
  }
}

function InteractionTreeEditorInner(props: Props) {
  const { screenToFlowPosition } = useReactFlow()

  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [truncationWarning, setTruncationWarning] = useState<string | null>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [activeHighlight, setActiveHighlight] = useState<{ edgeIds: Set<string>; nodeIds: Set<string> } | null>(null)
  const baseEdgesRef = useRef<Edge[]>([])
  const loadSeq = useRef(0)
  const treeRootRef = useRef<string | null>(null)

  const [treeReloadTick, setTreeReloadTick] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((prev) => applyNodeChanges(changes, prev)),
    [],
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((prev) => applyEdgeChanges(changes, prev)),
    [],
  )

  // Sync isSelected + isConnected + edge highlight
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
  }, [selectedNodeId, activeHighlight])

  // Reset on asset key change
  useEffect(() => {
    setSelectedNodeId(null)
    setActiveHighlight(null)
    setEditMode(false)
    setSaveStatus('idle')
    setSaveError(null)
  }, [props.projectId, props.root.assetKey])

  // Load tree
  useEffect(() => {
    const mySeq = ++loadSeq.current
    setStatus({ kind: 'loading' })
    setError(null)
    setNodes([])
    setEdges([])

    ;(async () => {
      try {
        const data = await hasApi.projectInteractionTree(props.projectId, props.root.assetKey)
        if (loadSeq.current !== mySeq) return
        treeRootRef.current = data.root
        const flow = toFlow(data)
        baseEdgesRef.current = flow.edges
        setNodes(flow.nodes)
        setEdges(flow.edges)
        setTruncationWarning(
          flow.truncatedAt != null
            ? `⚠ Graph truncated to ${MAX_DAGRE_NODES} nodes (${flow.truncatedAt} total)`
            : null,
        )
        setStatus({ kind: 'idle', message: `Loaded: ${data.nodes.length} nodes, ${data.edges.length} edges` })
        setTimeout(() => setStatus({ kind: 'idle' }), 1500)
      } catch (e) {
        if (loadSeq.current !== mySeq) return
        setStatus({ kind: 'idle' })
        setError(e instanceof HasApiError ? e.message : 'Unexpected error')
      }
    })()
  }, [props.projectId, props.root.assetKey, treeReloadTick])

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  const selectedData = selectedNode?.data as (InteractionNodeData & { rawFields?: Record<string, unknown> }) | undefined
  const selectedIsExternal = Boolean(selectedData?.isExternal)
  const selectedIsServerAsset = Boolean(
    selectedIsExternal && selectedNodeId && (selectedNodeId.startsWith('server:') || selectedNodeId.startsWith('server-path:')),
  )

  const { asset, loading: assetLoading, error: assetError, reload: reloadAsset } = useAsset(
    props.projectId,
    selectedNodeId,
    selectedIsServerAsset,
  )

  // ── Edit mode: connect edges ──
  const onConnect = useCallback(
    (connection: Connection) => {
      const handle = connection.sourceHandle ?? 'next'
      const edgeType = EDGE_TYPE_BY_SOURCE_HANDLE[handle] ?? 'next'
      const color = getColorForEdgeType(edgeType)
      const edgeId = `${connection.source}->${connection.target}:${edgeType}:${Date.now()}`
      const newEdge: Edge = {
        ...connection,
        id: edgeId,
        type: 'smoothstep',
        label: SEMANTIC_EDGE_TYPES.has(edgeType) ? edgeType : undefined,
        style: { stroke: color, strokeWidth: 1.5 },
        labelStyle: { fill: color, fontSize: 9, fontStyle: 'italic', fontWeight: 600 },
        labelShowBg: false,
        markerEnd: { type: 'arrowclosed' as const, color },
        data: { edgeType },
      }
      setEdges((prev) => addEdge(newEdge, prev))
      baseEdgesRef.current = [...baseEdgesRef.current, newEdge]
    },
    [],
  )

  // ── Edit mode: drag from palette ──
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain')
      if (!type) return
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const newId = `internal:new_${Date.now()}_${Math.floor(Math.random() * 10000)}`
      const newNode: Node = {
        id: newId,
        type: 'interaction',
        position,
        data: {
          label: type,
          nodeType: type,
          isExternal: false,
          rawFields: { Type: type },
        } satisfies InteractionNodeData,
      }
      setNodes((prev) => [...prev, newNode])
      setSelectedNodeId(newId)
      setActiveHighlight(null)
    },
    [screenToFlowPosition],
  )

  // ── Edit mode: delete nodes/edges ──
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const deletedIds = new Set(deleted.map((n) => n.id))
      if (selectedNodeId && deletedIds.has(selectedNodeId)) {
        setSelectedNodeId(null)
        setActiveHighlight(null)
      }
      baseEdgesRef.current = baseEdgesRef.current.filter(
        (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target),
      )
    },
    [selectedNodeId],
  )

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    const deletedIds = new Set(deleted.map((e) => e.id))
    baseEdgesRef.current = baseEdgesRef.current.filter((e) => !deletedIds.has(e.id))
  }, [])

  // ── Form panel: apply node field edits ──
  function handleNodeApply(updatedFields: Record<string, unknown>) {
    if (!selectedNodeId) return
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== selectedNodeId) return n
        const newType =
          typeof updatedFields['Type'] === 'string'
            ? updatedFields['Type']
            : (n.data as InteractionNodeData).nodeType
        return {
          ...n,
          data: { ...n.data, rawFields: updatedFields, nodeType: newType, label: newType },
        }
      }),
    )
  }

  // ── Save tree to server ──
  async function handleSaveTree() {
    const root = treeRootRef.current
    if (!root) { setSaveError('No tree root — reload first'); setSaveStatus('error'); return }
    setSaveStatus('saving')
    setSaveError(null)
    const { json, errors } = exportInteractionTree(root, nodes, edges)
    if (!json) { setSaveStatus('error'); setSaveError('Export produced empty result'); return }
    if (errors.length > 0) console.warn('[InteractionTree] Export warnings:', errors)
    try {
      await hasApi.assetPut(props.projectId, props.root.assetKey, {
        json: json as Record<string, unknown>,
        mode: 'override',
      })
      setSaveStatus('ok')
      setTimeout(() => setSaveStatus('idle'), 2500)
      setTreeReloadTick((t) => t + 1)
    } catch (e) {
      setSaveStatus('error')
      setSaveError(e instanceof HasApiError ? e.message : 'Unexpected save error')
    }
  }

  const handleNodeClick = useCallback((_: React.MouseEvent, n: Node) => {
    setSelectedNodeId(n.id)
    const connectedEdges = baseEdgesRef.current.filter((e) => e.source === n.id || e.target === n.id)
    const neighborIds = new Set<string>()
    connectedEdges.forEach((e) => {
      if (e.source !== n.id) neighborIds.add(e.source)
      if (e.target !== n.id) neighborIds.add(e.target)
    })
    setActiveHighlight({ edgeIds: new Set(connectedEdges.map((e) => e.id)), nodeIds: neighborIds })
  }, [])

  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, n: Node) => {
    const data = n.data as InteractionNodeData | undefined
    const isServerRef = Boolean(
      data?.isExternal && (n.id.startsWith('server:') || n.id.startsWith('server-path:')),
    )
    if (!isServerRef) return

    const display = typeof data?.rawFields?.ServerId === 'string' && data.rawFields.ServerId.trim()
      ? data.rawFields.ServerId.trim()
      : data?.label ?? n.id

    props.onOpenItem?.({
      assetKey: n.id,
      display,
    })
  }, [props])

  const saveLabel =
    saveStatus === 'saving' ? 'Saving…'
    : saveStatus === 'ok' ? '✓ Saved'
    : saveStatus === 'error' ? '✗ Error'
    : 'Save Tree'

  const saveColor =
    saveStatus === 'ok' ? '#55EFC4'
    : saveStatus === 'error' ? '#FF6B6B'
    : saveStatus === 'saving' ? '#aaa'
    : '#74B9FF'

  const showAssetPanel = Boolean(selectedNodeId && selectedIsServerAsset)
  const showFormPanel = Boolean(selectedNodeId && !selectedIsServerAsset && selectedData)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0, position: 'relative', overflow: 'hidden', background: '#1e1e1e' }}>
      {/* Palette (edit mode only) */}
      {editMode && <InteractionPalette />}

      {/* Canvas */}
      <div
        style={{ flex: 1, position: 'relative', minWidth: 0 }}
        onDrop={editMode ? onDrop : undefined}
        onDragOver={editMode ? onDragOver : undefined}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={editMode ? onConnect : undefined}
          onNodesDelete={editMode ? onNodesDelete : undefined}
          onEdgesDelete={editMode ? onEdgesDelete : undefined}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          nodesConnectable={editMode}
          elementsSelectable={true}
          deleteKeyCode={editMode ? 'Delete' : null}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background gap={20} size={1} color="#444" />
          <Controls />

          <Panel position="top-left" className="panel">
            <h3 style={{ margin: '0 0 4px' }}>Interactions</h3>
            <div style={{ opacity: 0.85, marginBottom: 8, fontSize: 12 }}>{props.root.display}</div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <button onClick={props.onBack} disabled={status.kind === 'loading'} style={btnStyle('#333')}>
                ← Back
              </button>
              <button
                onClick={() => { setEditMode((v) => !v); if (editMode) { setSelectedNodeId(null); setActiveHighlight(null) } }}
                style={{ ...btnStyle(editMode ? '#1a3a1a' : '#2a2a3a'), color: editMode ? '#55EFC4' : '#aaa', borderColor: editMode ? '#55EFC4' : '#555' }}
              >
                {editMode ? '✏ Edit ON' : '✏ Edit'}
              </button>
              {editMode && (
                <button
                  onClick={handleSaveTree}
                  disabled={saveStatus === 'saving'}
                  style={{ ...btnStyle('#1a2a3a'), color: saveColor, borderColor: saveColor }}
                >
                  {saveLabel}
                </button>
              )}
            </div>

            {editMode && (
              <div style={{ marginTop: 6, fontSize: 10, color: '#666', lineHeight: 1.4 }}>
                Drag from palette → canvas to add nodes.<br />
                Drag handle → node to connect. Delete removes selected.
              </div>
            )}
            {status.message && <p style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>{status.message}</p>}
            {truncationWarning && <p style={{ marginTop: 6, color: '#FF9500', fontSize: 11 }}>{truncationWarning}</p>}
            {error && <p style={{ marginTop: 8, color: '#FF6B6B', fontSize: 12 }}>{error}</p>}
            {saveStatus === 'error' && saveError && (
              <p style={{ marginTop: 6, color: '#FF6B6B', fontSize: 11 }}>{saveError}</p>
            )}
          </Panel>
        </ReactFlow>
      </div>

      {/* Right: Asset panel (external nodes) */}
      {showAssetPanel && (
        <div style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 460, zIndex: 20 }}>
          <AssetSidePanel
            projectId={props.projectId}
            selectedNodeId={selectedNodeId!}
            asset={asset}
            loading={assetLoading}
            error={assetError}
            onClose={() => { setSelectedNodeId(null); setActiveHighlight(null) }}
            onRefresh={() => { reloadAsset(); setTreeReloadTick((t) => t + 1) }}
          />
        </div>
      )}

      {/* Right: Form panel (inline nodes) */}
      {showFormPanel && selectedData && (
        <div style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 420, zIndex: 20, boxShadow: '-4px 0 20px rgba(0,0,0,0.5)' }}>
          <InteractionFormPanel
            nodeId={selectedNodeId!}
            nodeType={selectedData.nodeType}
            rawFields={selectedData.rawFields ?? {}}
            isExternal={selectedData.isExternal ?? false}
            onApply={handleNodeApply}
            onClose={() => { setSelectedNodeId(null); setActiveHighlight(null) }}
          />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Public export — wraps with ReactFlowProvider
// ─────────────────────────────────────────────────────────────

export function InteractionTreeEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <InteractionTreeEditorInner {...props} />
    </ReactFlowProvider>
  )
}
