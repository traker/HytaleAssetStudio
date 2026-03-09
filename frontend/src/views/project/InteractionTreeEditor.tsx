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
import type { AssetGetResponse, InteractionTreeResponse } from '../../api'

import { AssetSidePanel } from '../../components/editor/AssetSidePanel'
import { InteractionNode, type InteractionNodeData } from '../../components/graph/InteractionNode'
import { layoutGraph } from '../../components/graph/layoutDagre'

type Props = {
  projectId: string
  root: { assetKey: string; display: string }
  onBack: () => void
}

type Status = { kind: 'idle' | 'loading'; message?: string }

const nodeTypes = {
  interaction: InteractionNode,
}

function toFlow(data: InteractionTreeResponse): { nodes: Node[]; edges: Edge[] } {
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
    style: {
      borderRadius: 6,
      boxShadow: '2px 2px 5px rgba(0,0,0,0.5)',
    },
  }))

  const edges: Edge[] = data.edges.map((e) => {
    const sourceHandle = e.type === 'next' ? 'next' : e.type === 'failed' ? 'failed' : 'child'
    return {
      id: `${e.from}->${e.to}:${e.type}`,
      source: e.from,
      target: e.to,
      sourceHandle,
      type: 'smoothstep',
      label: e.type,
      animated: false,
      style: { stroke: '#666', strokeWidth: 1.5 },
      labelStyle: { fill: '#aaa', fontSize: 10, fontStyle: 'italic' },
      labelShowBg: false,
    }
  })

  return layoutGraph(nodes, edges, 'TB')
}

export function InteractionTreeEditor(props: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const loadSeq = useRef(0)

  const [treeReloadTick, setTreeReloadTick] = useState(0)

  const [asset, setAsset] = useState<AssetGetResponse | null>(null)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [assetLoading, setAssetLoading] = useState(false)
  const assetSeq = useRef(0)
  const [assetReloadTick, setAssetReloadTick] = useState(0)

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((prev) => applyNodeChanges(changes, prev)), [])
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((prev) => applyEdgeChanges(changes, prev)), [])

  useEffect(() => {
    setSelectedNodeId(null)
    setAsset(null)
    setAssetError(null)
    setAssetLoading(false)
  }, [props.projectId, props.root.assetKey])

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
        const flow = toFlow(data)
        setNodes(flow.nodes)
        setEdges(flow.edges)
        setStatus({ kind: 'idle', message: `Loaded: ${data.nodes.length} nodes, ${data.edges.length} edges` })
        setTimeout(() => setStatus({ kind: 'idle' }), 1500)
      } catch (e) {
        if (loadSeq.current !== mySeq) return
        setStatus({ kind: 'idle' })
        setError(e instanceof HasApiError ? e.message : 'Unexpected error')
      }
    })()
  }, [props.projectId, props.root.assetKey, treeReloadTick])

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return nodes.find((n) => n.id === selectedNodeId) ?? null
  }, [nodes, selectedNodeId])

  const selectedRaw = (selectedNode?.data as any)?.rawFields as Record<string, unknown> | undefined

  const selectedIsExternal = Boolean((selectedNode?.data as any)?.isExternal)
  const selectedIsServerAsset = Boolean(selectedNodeId && selectedNodeId.startsWith('server:') && selectedIsExternal)

  useEffect(() => {
    if (!selectedIsServerAsset || !selectedNodeId) {
      setAsset(null)
      setAssetError(null)
      setAssetLoading(false)
      return
    }

    const mySeq = ++assetSeq.current
    setAssetLoading(true)
    setAssetError(null)
    setAsset(null)

    ;(async () => {
      try {
        const a = await hasApi.assetGet(props.projectId, selectedNodeId)
        if (assetSeq.current !== mySeq) return
        setAsset(a)
      } catch (e) {
        if (assetSeq.current !== mySeq) return
        setAsset(null)
        setAssetError(e instanceof HasApiError ? e.message : 'Unexpected error')
      } finally {
        if (assetSeq.current === mySeq) setAssetLoading(false)
      }
    })()
  }, [props.projectId, selectedIsServerAsset, selectedNodeId, assetReloadTick])

  return (
    <div className="editor-container" style={{ position: 'fixed', inset: 0 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, n) => setSelectedNodeId(n.id)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background gap={20} size={1} color="#444" />
        <Controls />

        <Panel position="top-left" className="panel">
          <h3>Interactions</h3>
          <div style={{ opacity: 0.85, marginBottom: 8, fontSize: 12 }}>{props.root.display}</div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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

          {status.message && <p style={{ marginTop: 10, opacity: 0.8 }}>{status.message}</p>}
          {error && <p style={{ marginTop: 8, color: '#FF6B6B' }}>{error}</p>}
        </Panel>
      </ReactFlow>

      {selectedNodeId && selectedIsServerAsset && (
        <AssetSidePanel
          projectId={props.projectId}
          selectedNodeId={selectedNodeId}
          asset={asset}
          loading={assetLoading}
          error={assetError}
          onClose={() => setSelectedNodeId(null)}
          onRefresh={() => {
            setAssetReloadTick((t) => t + 1)
            setTreeReloadTick((t) => t + 1)
          }}
        />
      )}

      {selectedNodeId && !selectedIsServerAsset && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            height: '100%',
            width: 460,
            background: 'rgba(30, 30, 30, 0.96)',
            borderLeft: '1px solid #333',
            boxShadow: '0 0 20px rgba(0,0,0,0.5)',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid #333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  color: '#61dafb',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedNodeId}
              </div>
              <div style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                type: {String((selectedNode?.data as any)?.nodeType ?? '')}
              </div>
            </div>

            <button
              onClick={() => setSelectedNodeId(null)}
              style={{
                padding: '4px 8px',
                background: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: 4,
                cursor: 'pointer',
              }}
              title="Fermer"
            >
              X
            </button>
          </div>

          <div style={{ padding: 12, overflow: 'auto', flex: 1 }}>
            {!selectedRaw ? (
              <div style={{ color: '#ccc', fontStyle: 'italic' }}>No fields (external node).</div>
            ) : (
              <pre
                style={{
                  margin: 0,
                  padding: 10,
                  background: '#1e1e1e',
                  border: '1px solid #333',
                  borderRadius: 6,
                  fontSize: 12,
                  lineHeight: 1.35,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(selectedRaw, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
