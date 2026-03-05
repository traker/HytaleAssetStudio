import React, { useState, useCallback, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Panel,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import type {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';

const INTERACTION_TYPES = [
  "External", "Simple", "UseBlock", "Condition", "MovementCondition", "StatsCondition", 
  "Serial", "EffectCondition", "ApplyEffect", "Seating", "DestroyCondition", 
  "Parallel", "Replace", "BlockCondition", "ChangeState", "OpenContainer", 
  "OpenProcessingBench", "MemoriesCondition", "PlacementCountCondition",
  "PlaceBlock", "ContextualUseNPC", "ModifyInventory", "RefillContainer", 
  "Charging", "StatsConditionWithModifier", "Door", "Explode", "Selector", 
  "LaunchProjectile", "ApplyForce", "Projectile", "Chaining", "SpawnPrefab",
  "Wielding", "Repeat", "SpawnNPC", "BreakBlock", "ChangeBlock", "DamageEntity", 
  "FirstClick", "OpenCustomUI", "TeleportInstance", "UseEntity", "FertilizeSoil", 
  "UseWateringCan", "ClearEntityEffect", "ChangeStat", "RemoveEntity", 
  "SpawnDeployableFromRaycast"
].sort();

// Sidebar pour le glisser/déposer
const Sidebar = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredTypes = INTERACTION_TYPES.filter(type => 
    type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside style={{ 
      width: '240px', background: '#1e1e1e', borderRight: '1px solid #333', 
      display: 'flex', flexDirection: 'column', color: '#fff', zIndex: 10
    }}>
      <div style={{ padding: '15px 10px', fontSize: '13px', fontWeight: 'bold', background: '#252526', borderBottom: '1px solid #444', color: '#F4A261' }}>
        🧩 Boîte à outils
        <div style={{fontSize:'10px', color:'#aaa', fontWeight:'normal', marginTop:'5px'}}>Glissez un nœud vers l'éditeur</div>
      </div>
      
      <div style={{ padding: '10px', borderBottom: '1px solid #333' }}>
        <input 
          type="text" 
          placeholder="Rechercher un nœud..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%', padding: '6px', background: '#333', color: '#fff', 
            border: '1px solid #555', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredTypes.map(type => (
          <div
            key={type}
            onDragStart={(event) => onDragStart(event, type)}
            draggable
            style={{ 
              padding: '6px 8px', border: '1px solid #555', borderRadius: '4px',
              background: '#2d2d2d', cursor: 'grab', fontSize: '11px', transition: '0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F4A261'; e.currentTarget.style.background = '#333'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.background = '#2d2d2d'; }}
          >
            {type}
          </div>
        ))}
        {filteredTypes.length === 0 && (
          <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '10px' }}>
            Aucun type trouvé
          </div>
        )}
      </div>
    </aside>
  );
};

// Nœud "Interaction" : plus compact, avec de multiples ports d'entrée/sortie (Next, Failed)
const InteractionBlueprintNode = ({ data, id }: any) => {
  const isExternal = data.isExternal;
  
  return (
    <div style={{
      width: '280px',
      backgroundColor: isExternal ? '#333' : '#1e1e1e',
      borderRadius: '8px',
      border: `2px solid ${isExternal ? '#888' : '#F4A261'}`,
      color: '#fff',
      fontFamily: 'sans-serif',
      boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
      opacity: isExternal ? 0.7 : 1
    }}>
      {/* Port d'entrée principal */}
      <Handle type="target" position={Position.Top} id="in" style={{ width: '12px', height: '12px', background: isExternal ? '#888' : '#F4A261' }} />
      
      {/* Header */}
      <div style={{ padding: '8px', background: isExternal ? '#555' : '#F4A261', color: '#000', fontWeight: 'bold', fontSize: '13px', borderRadius: '4px 4px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {isExternal ? '📎 Fichier Externe' : `⚙️ ${data.type}`}
          <div style={{ fontSize: '10px', fontWeight: 'normal', color: '#333' }}>{data.label || 'Nouveau nœud'}</div>
        </div>
        {!isExternal && data.onDelete && (
           <div
             onClick={(e) => { e.stopPropagation(); data.onDelete(id); }}
             style={{ cursor: 'pointer', background: 'rgba(0,0,0,0.1)', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontSize: '12px' }}
             title="Supprimer le nœud"
             onMouseEnter={(e) => e.currentTarget.style.background = '#FF6B6B'}
             onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
           >
             ✖
           </div>
        )}
      </div>
      
      {/* Mini Formulaire Intégré au Noeud (Summary) */}
      {!isExternal && (
        <div style={{ padding: '4px', background: '#1e1e1e' }}>
          <textarea
            defaultValue={JSON.stringify(data.rawFields || {}, null, 2)}
            onBlur={(e) => {
              if (data.onUpdateFields) {
                try {
                  const parsed = JSON.parse(e.target.value);
                  data.onUpdateFields(id, parsed);
                } catch(err) {}
              }
            }}
            style={{
              width: '100%',
              height: '80px',
              background: '#252526',
              color: '#d4d4d4',
              border: '1px solid #333',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '11px',
              padding: '4px',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        </div>
      )}

      {/* Ports de sortie spécialisés (Next, Failed) si on est pas externe */}
      {!isExternal && (
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '6px 10px', background: '#111', borderRadius: '0 0 4px 4px', borderTop: '1px solid #333' }}>
          
          {/* Next (Succès) */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#96CEB4' }}>Next</span>
            <Handle type="source" position={Position.Bottom} id="next" style={{ position: 'relative', transform: 'none', background: '#96CEB4', width: '10px', height: '10px', top: '4px' }} />
          </div>

          {/* Failed (Échec) */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#FF6B6B' }}>Failed</span>
            <Handle type="source" position={Position.Bottom} id="failed" style={{ position: 'relative', transform: 'none', background: '#FF6B6B', width: '10px', height: '10px', top: '4px' }} />
          </div>

          {/* Enfants / Liste (child) */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#45B7D1' }}>Child</span>
            <Handle type="source" position={Position.Bottom} id="child" style={{ position: 'relative', transform: 'none', background: '#45B7D1', width: '10px', height: '10px', top: '4px' }} />
          </div>

        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  interaction: InteractionBlueprintNode
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = 300; 
  const nodeHeight = 150; 

  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 50, 
    ranksep: 80 
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });

  return { nodes, edges };
};

// --- Composant interne de l'éditeur contenant les hooks dépendants du Provider ---
function InteractionEditorFlow({ rootId, onClose }: { rootId: string, onClose: () => void }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [menu, setMenu] = useState<{ show: boolean, x: number, y: number, sourceNode: string, sourceHandle: string | null } | null>(null);
  const [menuSearchTerm, setMenuSearchTerm] = useState('');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [editorMode, setEditorMode] = useState<'raw' | 'form'>('form');

  const { screenToFlowPosition } = useReactFlow();
  const connectingNodeId = useRef<string | null>(null);
  const connectingHandleId = useRef<string | null>(null);

  useEffect(() => {
    if (!rootId) return;
    setLoading(true);
    
    fetch(`http://127.0.0.1:5000/api/interaction/tree?id=${encodeURIComponent(rootId)}`)
      .then(res => res.json())
      .then(data => {
        if(data.error) {
          console.error(data.error);
          setLoading(false);
          return;
        }

        const rfNodes: Node[] = data.nodes.map((n: any) => ({
          id: n.id,
          type: 'interaction',
          position: { x: 0, y: 0 },
          data: {
             type: n.type,
             label: n.label,
             contentSummary: n.summary,
             rawFields: n.rawFields,
             isExternal: n.isExternal,
             onUpdateFields: (nodeId: string, newFields: any) => {
                 setNodes(nds => nds.map(node => {
                     if (node.id === nodeId) {
                         return { ...node, data: { ...node.data, rawFields: newFields } };
                     }
                     return node;
                 }));
             },
             onDelete: (id: string) => {
                setNodes(nds => nds.filter(node => node.id !== id));
                setEdges(eds => eds.filter(edge => edge.source !== id && edge.target !== id));
             }
          }
        }));

        const rfEdges: Edge[] = data.edges.map((e: any) => {
          let color = '#ccc';
          let sourceHandle = 'child';
          
          if(e.type === 'next') { color = '#96CEB4'; sourceHandle = 'next'; }
          if(e.type === 'failed') { color = '#FF6B6B'; sourceHandle = 'failed'; }
          
          return {
            id: `${e.source}-${e.target}-${e.type}`,
            source: e.source,
            sourceHandle: sourceHandle,
            target: e.target,
            targetHandle: 'in',
            label: e.label,
            type: 'smoothstep',
            animated: true,
            style: { stroke: color, strokeWidth: 2 },
            labelStyle: { fill: color, fontSize: 10, fontWeight: 'bold' },
            labelShowBg: true,
            labelBgStyle: { fill: '#111', color: '#fff' }
          };
        });

        const layouted = getLayoutedElements(rfNodes, rfEdges, 'TB');
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });

  }, [rootId]);

  
    const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
      const selected = nodes.filter(n => n.selected);
      if (selected.length === 1) setSelectedNodeId(selected[0].id);
      else setSelectedNodeId(null);
    }, []);
    const onNodesChange = useCallback((changes: NodeChange[]) => setNodes(nds => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges(eds => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((conn: Connection) => setEdges(eds => addEdge({ ...conn, type: 'smoothstep', style: { stroke: '#fff', strokeWidth: 2 } }, eds)), []);

  // Drag and Drop (Depuis la Sidebar)
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = `node_${Date.now()}`;
      const newNode = {
        id: newNodeId,
        type: 'interaction',
        position,
        data: { 
          type: type, 
          label: `New ${type}`,
          contentSummary: ["Nouveau nœud"],
          onDelete: (id: string) => {
             setNodes(nds => nds.filter(node => node.id !== id));
             setEdges(eds => eds.filter(edge => edge.source !== id && edge.target !== id));
          }
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes]
  );

  // Drag from Port to empty space (Création contextuelle)
  const onConnectStart = useCallback((_: any, { nodeId, handleId }: any) => {
    connectingNodeId.current = nodeId;
    connectingHandleId.current = handleId;
  }, []);

  const onConnectEnd = useCallback((event: any) => {
    if (!connectingNodeId.current) return;

    const targetIsPane = event.target.classList.contains('react-flow__pane');

    if (targetIsPane) {
      let clientX = 0;
      let clientY = 0;
      if ('clientX' in event) {
        clientX = event.clientX;
        clientY = event.clientY;
      } else if ('changedTouches' in event) {
        clientX = event.changedTouches[0].clientX;
        clientY = event.changedTouches[0].clientY;
      }

      setMenuSearchTerm('');
      setMenu({
        show: true,
        x: clientX,
        y: clientY,
        sourceNode: connectingNodeId.current,
        sourceHandle: connectingHandleId.current
      });
    }

    connectingNodeId.current = null;
    connectingHandleId.current = null;
  }, [screenToFlowPosition]);

  const onAddNodeFromMenu = (type: string) => {
    if (!menu) return;

    const position = screenToFlowPosition({ x: menu.x, y: menu.y });
    const newNodeId = `node_${Date.now()}`;
    const newNode = {
      id: newNodeId,
      type: 'interaction',
      position,
      data: { 
        type: type, 
        label: `New ${type}`, 
        contentSummary: ["Nouveau nœud"],
        onDelete: (id: string) => {
           setNodes(nds => nds.filter(node => node.id !== id));
           setEdges(eds => eds.filter(edge => edge.source !== id && edge.target !== id));
        }
      },
    };

    setNodes((nds) => nds.concat(newNode));
    
    let edgeColor = '#ccc';
    if(menu.sourceHandle === 'next') edgeColor = '#96CEB4';
    if(menu.sourceHandle === 'failed') edgeColor = '#FF6B6B';

    setEdges((eds) => eds.concat({
      id: `edge_${Date.now()}`,
      source: menu.sourceNode,
      sourceHandle: menu.sourceHandle,
      target: newNodeId,
      targetHandle: 'in',
      type: 'smoothstep',
      animated: true,
      style: { stroke: edgeColor, strokeWidth: 2 }
    }));

    setMenu(null);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: 1, background: '#0a0a0a', position: 'relative' }} className="interaction-flow-wrapper">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
            onSelectionChange={onSelectionChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
        >
          <Background gap={20} size={1} color="#333" />
          <Controls />
          <Panel position="top-left" style={{ marginTop: '10px', background: 'rgba(30,30,30,0.9)', padding: '15px', borderRadius: '8px', color: '#fff', border: '1px solid #444' }}>
            <button 
                  onClick={onClose}
                  style={{ marginBottom: '10px', padding: '5px 10px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
            >
              ← Retour au graphe global
            </button>
            <h3 style={{ margin: '0 0 10px 0', color: '#F4A261' }}>Éditeur d'Interaction</h3>
            <p style={{ margin: 0, fontSize: '11px', color: '#aaa', maxWidth: '300px', wordBreak: 'break-all' }}>
              Racine : <strong style={{color: '#fff'}}>{rootId}</strong>
            </p>
            {loading && <p style={{ color: '#F4A261', fontSize: '12px', marginTop: '10px' }}>Analyse de l'arbre en cours...</p>}
          </Panel>
        </ReactFlow>

          {/* Side Panel for Selected Node */}
          {selectedNodeId && nodes.find(n => n.id === selectedNodeId) && (() => {
             const selectedNode = nodes.find(n => n.id === selectedNodeId)!;
             const ds = selectedNode.data;
             return (
               <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '400px', background: '#1e1e1e', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
                 <div style={{ padding: '15px', background: '#252526', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <div style={{ color: '#F4A261', fontWeight: 'bold' }}>
      {ds.isExternal ? '📎 Noeud Externe' : `⚙️ ${ds.type}`}
    </div>
    {!ds.isExternal && (
      <>
        <button onClick={() => setEditorMode('form')} style={{ background: editorMode === 'form' ? '#61dafb' : '#444', color: editorMode === 'form' ? '#000' : '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '2px 5px', marginLeft: '10px' }}>Form</button>
        <button onClick={() => setEditorMode('raw')} style={{ background: editorMode === 'raw' ? '#61dafb' : '#444', color: editorMode === 'raw' ? '#000' : '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '2px 5px' }}>JSON</button>
      </>
    )}
</div>
                   <button onClick={() => setSelectedNodeId(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>X</button>
                 </div>
                 
                 <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {/* Label/Filename Edit */}
                    <div>
                      <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px' }}>{ds.isExternal ? 'Nom de référence du fichier:' : 'Label (Facultatif):'}</div>
                      <input 
                         type="text" 
                         value={typeof ds.label === 'string' ? ds.label : ''} 
                         onChange={(e) => {
                            const newLabel = e.target.value;
                            setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, label: newLabel } } : n));
                         }}
                         style={{ width: '100%', padding: '8px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Raw Fields JSON Editor */}
                    {!ds.isExternal && (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                         <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px' }}>Propriétés JSON (rawFields):</div>
                         <div style={{ flex: 1, border: '1px solid #444', borderRadius: '4px', overflow: 'hidden' }}>
                           {editorMode === 'raw' ? (
    <Editor
      height="100%"
      width="100%"
      defaultLanguage="json"
      theme="vs-dark"
      value={JSON.stringify(ds.rawFields || {}, null, 2)}
      onChange={(value) => {
        try {
          const parsed = JSON.parse(value || "{}");
          setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, rawFields: parsed } } : n));
        } catch(e) {}
      }}
      options={{
        minimap: { enabled: false },
        fontSize: 12,
        wordWrap: 'on'
      }}
    />
) : (
    <div className="rjsf" style={{ padding: '10px', overflow: 'auto', height: '100%', boxSizing: 'border-box', background: '#1e1e1e', color: '#fff' }}>
        <Form
           schema={{ type: "object", additionalProperties: true }}
           validator={validator}
           formData={ds.rawFields || {}}
           onChange={(e) => {
               if (e.formData) {
                   setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, rawFields: e.formData } } : n));
               }
           }}
           uiSchema={{
               'ui:submitButtonOptions': { norender: true }
           }}
        />
    </div>
)}
                         </div>
                      </div>
                    )}
                 </div>
               </div>
             );
          })()}


        {/* Menu Contextuel */}
        {menu && menu.show && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `translate(${menu.x}px, ${menu.y}px)`,
            background: '#1e1e1e',
            border: '1px solid #F4A261',
            borderRadius: '6px',
            padding: '5px',
            zIndex: 1000,
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            maxHeight: '300px',
            overflowY: 'auto',
            width: '180px'
          }}>
            <div style={{ fontSize: '11px', color: '#aaa', padding: '5px', borderBottom: '1px solid #333', marginBottom: '5px' }}>
              Relier à un nouveau nœud :
            </div>
            <div style={{ padding: '0 5px 5px 5px' }}>
              <input 
                type="text" 
                placeholder="Rechercher..." 
                autoFocus
                value={menuSearchTerm}
                onChange={e => setMenuSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '4px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>
            {INTERACTION_TYPES.filter(t => t.toLowerCase().includes(menuSearchTerm.toLowerCase())).map(type => (
              <div 
                key={type} 
                onClick={() => onAddNodeFromMenu(type)}
                style={{
                  padding: '6px', fontSize: '11px', color: '#fff', cursor: 'pointer', borderRadius: '3px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {type}
              </div>
            ))}
            {INTERACTION_TYPES.filter(t => t.toLowerCase().includes(menuSearchTerm.toLowerCase())).length === 0 && (
              <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '5px' }}>Aucun type</div>
            )}
            <div 
                onClick={() => setMenu(null)}
                style={{
                  padding: '6px', fontSize: '11px', color: '#FF6B6B', cursor: 'pointer', borderRadius: '3px', marginTop: '5px', borderTop: '1px solid #333', textAlign: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Annuler
              </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper principal
export default function InteractionEditor({ rootId, onClose }: { rootId: string, onClose: () => void }) {
  return (
    <ReactFlowProvider>
      <InteractionEditorFlow rootId={rootId} onClose={onClose} />
    </ReactFlowProvider>
  );
}