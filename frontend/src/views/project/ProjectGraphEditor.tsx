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
import type { AssetGetResponse, ProjectGraphResponse, SearchResult } from '../../api'

import { AssetSidePanel } from '../../components/editor/AssetSidePanel'
import { BlueprintNode } from '../../components/graph/BlueprintNode'
import { layoutGraph } from '../../components/graph/layoutDagre'

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

type AssetStatus = { kind: 'idle' | 'loading' }

const nodeTypes = {
  blueprint: BlueprintNode,
}

function toFlow(data: ProjectGraphResponse, rootId: string): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = data.nodes.map((n) => ({
    id: n.id,
    type: 'blueprint',
    position: { x: 0, y: 0 },
    data: {
      label: n.label,
      group: n.group ?? 'json_data',
      isModified: n.state === 'local',
      isRoot: n.id === rootId,
    },
    style: {
      borderRadius: 6,
      boxShadow: '2px 2px 5px rgba(0,0,0,0.5)',
    },
  }))

  const edges: Edge[] = data.edges.map((e) => ({
    id: `${e.from}->${e.to}:${e.type}`,
    source: e.from,
    target: e.to,
    type: 'smoothstep',
    label: e.type,
    animated: false,
    style: { stroke: '#666', strokeWidth: 1.5 },
    labelStyle: { fill: '#aaa', fontSize: 10, fontStyle: 'italic' },
    labelShowBg: false,
  }))

  return layoutGraph(nodes, edges, 'LR')
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

  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [assetStatus, setAssetStatus] = useState<AssetStatus>({ kind: 'idle' })
  const [assetError, setAssetError] = useState<string | null>(null)
  const [asset, setAsset] = useState<AssetGetResponse | null>(null)
  const assetSeq = useRef(0)

  const searchEnabled = props.searchEnabled ?? true
  const canLoad = useMemo(() => status.kind !== 'loading' && selected !== null, [status.kind, selected])

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((prev) => applyNodeChanges(changes, prev)), [])
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((prev) => applyEdgeChanges(changes, prev)), [])

  const load = useCallback(async () => {
    if (!selected) return

    setStatus({ kind: 'loading' })
    setError(null)
    setNodes([])
    setEdges([])
    setSelectedNodeId(null)
    setAsset(null)
    setAssetError(null)

    try {
      const data = await hasApi.projectGraph(props.projectId, selected.assetKey, depth)
      const flow = toFlow(data, selected.assetKey)
      setNodes(flow.nodes)
      setEdges(flow.edges)
      setStatus({ kind: 'idle', message: `Loaded: ${data.nodes.length} nodes, ${data.edges.length} edges` })
      setTimeout(() => setStatus({ kind: 'idle' }), 1500)
    } catch (e) {
      setStatus({ kind: 'idle' })
      setError(e instanceof HasApiError ? e.message : 'Unexpected error')
    }
  }, [props.projectId, selected, depth])

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
  }, [props.autoLoad, selected?.assetKey])

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

  useEffect(() => {
    if (!selectedNodeId) {
      setAsset(null)
      setAssetError(null)
      setAssetStatus({ kind: 'idle' })
      return
    }

    if (selectedNodeId.startsWith('common:')) {
      setAsset(null)
      setAssetStatus({ kind: 'idle' })
      setAssetError('Common resource (no server JSON)')
      return
    }

    const mySeq = ++assetSeq.current
    setAssetStatus({ kind: 'loading' })
    setAssetError(null)

    ;(async () => {
      try {
        const a = await hasApi.assetGet(props.projectId, selectedNodeId)
        if (assetSeq.current !== mySeq) return
        setAsset(a)
        setAssetStatus({ kind: 'idle' })
      } catch (e) {
        if (assetSeq.current !== mySeq) return
        setAsset(null)
        setAssetStatus({ kind: 'idle' })
        setAssetError(e instanceof HasApiError ? e.message : 'Unexpected error')
      }
    })()
  }, [props.projectId, selectedNodeId])

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return nodes.find((n) => n.id === selectedNodeId) ?? null
  }, [nodes, selectedNodeId])

  const canOpenInteractionEditor = Boolean(
    props.onOpenInteractions &&
      selectedNodeId &&
      selectedNode &&
      typeof (selectedNode.data as any)?.group === 'string' &&
      (selectedNode.data as any).group === 'interaction',
  )

  function handleSelect(r: SearchResult): void {
    setSelected(r)
    setIsDropdownOpen(false)
    setSearchTerm('')
    setSearchResults([])
  }

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
                        padding: '8px',
                        cursor: 'pointer',
                        color: selected?.assetKey === r.assetKey ? '#61dafb' : 'white',
                        borderBottom: '1px solid #333',
                        background: selected?.assetKey === r.assetKey ? '#111' : 'transparent',
                        fontSize: '12px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = selected?.assetKey === r.assetKey ? '#111' : 'transparent')
                      }
                    >
                      {r.display}
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

      {selectedNodeId && (
        <AssetSidePanel
          selectedNodeId={selectedNodeId}
          asset={asset}
          loading={assetStatus.kind === 'loading'}
          error={assetError}
          onClose={() => setSelectedNodeId(null)}
          onOpenInteractions={
            props.onOpenInteractions
              ? () => {
                  if (!canOpenInteractionEditor || !selectedNodeId || !selectedNode) return
                  props.onOpenInteractions?.({
                    assetKey: selectedNodeId,
                    display: String((selectedNode.data as any)?.label ?? selectedNodeId),
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
