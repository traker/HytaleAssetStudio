import { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Panel,
  Handle,
  Position
} from '@xyflow/react';
import type { 
  Node, 
  Edge, 
  NodeChange, 
  EdgeChange, 
  Connection,
  NodeMouseHandler
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import Editor from '@monaco-editor/react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import InteractionEditor from './InteractionEditor';
import './App.css';

// Type from our API
interface ApiNode {
  id: string;
  label: string;
  title: string;
  group: string;
  path: string;
  isOverride?: boolean;
}

interface ApiEdge {
  from: string;
  to: string;
  label: string;
}

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = 350; // Plus large pour afficher les paths complets si besoin
  const nodeHeight = 80; // Plus haut pour respirer

  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 80, // Espace vertical entre les nœuds adjacents
    ranksep: 120 // Espace horizontal entre les "rangées" dépendantes
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

// Fonctions utilitaires pour le style
const getColorForGroup = (group: string) => {
  const colors: Record<string, string> = {
    item: '#FF6B6B',        // Rouge vif
    block: '#4ECDC4',       // Cyan
    model: '#45B7D1',       // Bleu
    texture: '#96CEB4',     // Vert pastel
    sound: '#FFEAA7',       // Jaune
    particle: '#DDA0DD',    // Violet
    interaction: '#F4A261', // Orange
    effect: '#D4A5A5',      // Rose grisé
    json_data: '#9B9B9B',   // Gris
    default: '#555555'
  };
  return colors[group] || colors.default;
};

// --- Composant Nœud Personnalisé (Blueprint Style avec Ports) ---
const BlueprintNode = ({ data, id }: any) => {
  const typeColor = getColorForGroup(data.group);
  return (
    <div style={{
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      minWidth: '220px',
      backgroundColor: '#1e1e1e',
      borderRadius: '6px',
      border: `2px solid ${typeColor}`,
      overflow: 'hidden',
      color: '#fff',
      fontFamily: 'monospace',
    }}>
      {/* Port d'entrée (Target) - Caché visuellement mais actif pour les Edges */}
      <Handle type="target" position={Position.Left} style={{ background: '#555', width: '8px', height: '8px', border: '2px solid #222' }} />

      {/* Header */}
      <div style={{ 
        backgroundColor: typeColor, 
        color: '#111', 
        padding: '6px 10px', 
        fontSize: '11px', 
        fontWeight: 'bold', 
        textTransform: 'uppercase',
        borderBottom: `1px solid ${typeColor}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: data.isSearchResult ? `inset 0 0 10px rgba(255,255,255,0.8)` : 'none'
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
          <span>{data.group}</span>
          {data.isModified && <span style={{ fontSize: '10px', background: '#ffaa00', color: '#000', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold' }} title="Overridden / Modified">OVERRIDE</span>}
        </div>
        {data.isRoot && <span style={{ fontSize: '10px', background: '#111', color: typeColor, padding: '2px 5px', borderRadius: '4px' }}>ROOT</span>}
      </div>

      {/* Body */}
      <div style={{ padding: '12px 10px', wordBreak: 'break-all', fontSize: '13px', borderBottom: '1px solid #333' }}>
        {data.label}
      </div>

      {/* Section des Ports de Sortie (Simulation UI) */}
      {data.childrenInfos && data.childrenInfos.length > 0 && (
        <div style={{ padding: '8px 10px', backgroundColor: '#252526', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>DÉPENDANCES</span>
          {data.childrenInfos.map((child: any, idx: number) => (
             <div 
               key={idx} 
               onClick={(e) => {
                 e.stopPropagation(); // Évite de sélectionner le noeud entier
                 if (data.onPortClick) {
                   data.onPortClick(id, child.targetId);
                 }
               }}
               style={{ 
                 display: 'flex', 
                 justifyContent: 'space-between', 
                 alignItems: 'center', 
                 fontSize: '11px', 
                 color: '#bbb',
                 cursor: 'pointer',
                 padding: '2px 0'
               }}
               onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
               onMouseLeave={(e) => e.currentTarget.style.color = '#bbb'}
             >
               <span>{child.relation}</span>
               {/* Bulle colorée représentant le pin de sortie vers ce type d'enfant */}
               <div style={{ 
                 width: '10px', 
                 height: '10px', 
                 borderRadius: '50%', 
                 backgroundColor: getColorForGroup(child.group),
                 boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                 border: '1px solid #111'
               }} title={`Vers ${child.group}`} />
             </div>
          ))}
        </div>
      )}

      {/* Port de sortie (Source) générique invisible mais fonctionnel */}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
};

const nodeTypes = {
  blueprint: BlueprintNode
};

function App() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('iron_sword');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeConnection, setActiveConnection] = useState<{source: string, target: string} | null>(null);
  const [graphSearchTerm, setGraphSearchTerm] = useState<string>(''); // Nouvel état pour la recherche intra-graphe

  // Édition
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeContent, setNodeContent] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, any>>({});
  const [nodeSchemas, setNodeSchemas] = useState<Record<string, any>>({});
  const [editorMode, setEditorMode] = useState<'raw' | 'form'>('form');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [focusedInteraction, setFocusedInteraction] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const [cloneMsg, setCloneMsg] = useState('');
  
  // Projects (VFS)
  const [projects, setProjects] = useState<string[]>([]);
  const [activeProject, setActiveProject] = useState<string>('');
  const [newProjectName, setNewProjectName] = useState<string>('');

// Fetch Items on mount
  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/items')
      .then(res => res.json())
      .then(data => {
        setItems(data);
      })
      .catch(console.error);
      
    fetch('http://127.0.0.1:5000/api/projects')
      .then(res => res.json())
      .then(data => {
        setProjects(data.projects || []);
        setActiveProject(data.active || '');
      })
      .catch(console.error);
  }, []);

  const handleProjectSelect = (project: string) => {
    fetch('http://127.0.0.1:5000/api/projects/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setActiveProject(data.active);
          loadGraph(); // Recharger le graphe pour prendre en compte les overrides
        }
      });
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    fetch('http://127.0.0.1:5000/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: newProjectName.trim() })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setProjects(prev => [...prev, data.active]);
          setActiveProject(data.active);
          setNewProjectName('');
          loadGraph();
        }
      });
  };

  // Fetch Graph when item changes
  const loadGraph = useCallback(() => {
    if (!selectedItem) return;
    setLoading(true);
    fetch(`http://127.0.0.1:5000/api/graph?item=${selectedItem}`)
      .then(res => res.json())
      .then(data => {
        if(data.error) {
          console.error(data.error);
          setLoading(false);
          return;
        }

        const rfNodes: Node[] = data.nodes.map((n: ApiNode) => {
          // Préparer les infos sur les enfants pour les ports de sortie
          const childrenInfos = data.edges
            .filter((e: ApiEdge) => e.from === n.id)
            .map((e: ApiEdge) => {
               const targetNode = data.nodes.find((tn: ApiNode) => tn.id === e.to);
               return {
                 relation: e.label || 'requires',
                 group: targetNode ? targetNode.group : 'default',
                 targetId: e.to
               };
            });

          return {
            id: n.id,
            type: 'blueprint',
            position: { x: 0, y: 0 },
            data: { 
              label: n.label, 
              group: n.group, 
              path: n.path,
              isRoot: n.id === data.rootId,
              isModified: n.isOverride || false, // Marquer les nœuds surchargés
              childrenInfos: childrenInfos,
              onPortClick: (sourceId: string, targetId: string) => {
                setActiveConnection({ source: sourceId, target: targetId });
              }
            },
            style: { 
              boxShadow: n.id === data.rootId ? `0 0 15px ${getColorForGroup(n.group)}` : '2px 2px 5px rgba(0,0,0,0.5)',
              borderRadius: '6px'
            }
          }
        });

        const rfEdges: Edge[] = data.edges.map((e: ApiEdge) => ({
          id: `${e.from}-${e.to}`,
          source: e.from,
          target: e.to,
          label: e.label,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#666', strokeWidth: 1.5 },
          labelStyle: { fill: '#aaa', fontSize: 10, fontStyle: 'italic', background: 'transparent' }, 
          // Enlever le gros fond noir moche du texte des edges pour qu'ils ne ressemblent pas à des nœuds
          labelShowBg: false,
        }));

        const layouted = getLayoutedElements(rfNodes, rfEdges, 'LR');
        
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        setLoading(false);
        // Reset editor state on new graph
        setSelectedNodeId(null);
        setIsPanelOpen(false);
        setOverrides({});
        setNodeContent("");
        setCloneMsg('');
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedItem]);

  // Load initial graph
  useEffect(() => {
    if (items.length > 0 && nodes.length === 0) {
      loadGraph();
    }
  }, [items, loadGraph, nodes.length]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    // Si ce n'est pas du JSON, on ne peut pas vraiment l'éditer avec Monaco
    if (!node.id.endsWith('.json')) {
      alert("Seuls les fichiers JSON peuvent être édités pour l'instant.");
      return;
    }
    
    setSelectedNodeId(node.id);
    setIsPanelOpen(true);
    setActiveConnection(null); // Reset la connexion spécifique si on clique sur un nœud entier

    // On demande le contenu original au back-end (et on récupère le schema)
    setNodeContent("// Chargement en cours...");
    fetch(`http://127.0.0.1:5000/api/node/content?id=${encodeURIComponent(node.id)}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setNodeContent(`// Erreur: ${data.error}`);
        } else {
          // Check if we have overrides, if so apply them, else apply original data
          if (overrides[node.id]) {
            setNodeContent(JSON.stringify(overrides[node.id], null, 2));
          } else {
            setNodeContent(JSON.stringify(data.data, null, 2));
          }
          if (data.schema) {
            setNodeSchemas(prev => ({ ...prev, [node.id]: data.schema }));
          }
        }
      })
      .catch(err => {
        setNodeContent(`// Erreur de connexion: ${err.message}`);
      });
  }, [overrides]);

  const onNodeMouseEnter: NodeMouseHandler = useCallback((_, node) => {
    setHoveredNode(node.id);
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setActiveConnection({ source: edge.source, target: edge.target });
  }, []);

  const onPaneClick = useCallback(() => {
    setActiveConnection(null);
  }, []);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setNodeContent(value);
    }
  };

  const saveOverride = () => {
    if (!selectedNodeId) return;
    try {
      const parsed = JSON.parse(nodeContent);
      setOverrides(prev => ({ ...prev, [selectedNodeId]: parsed }));
      
      // Mettre à jour l'état visuel local
      setNodes(nds => nds.map(n => {
        if(n.id === selectedNodeId) {
          return { ...n, data: { ...n.data, isModified: true } };
        }
        return n;
      }));

      // VFS Save
      if (activeProject) {
        fetch('http://127.0.0.1:5000/api/save_node', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedNodeId, content: parsed })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            alert(`✅ ${data.message}`);
          } else {
            alert(`❌ Erreur VFS: ${data.error}`);
          }
        });
      } else {
        alert("⚠️ Modifications enregistrées uniquement en mémoire (sélectionnez un projet pour les persister).");
      }
    } catch (e: any) {
      alert(`Erreur de syntaxe JSON :\n${e.message}`);
    }
  };

  const runClone = () => {
    if (!selectedItem) return;
    setCloning(true);
    
    // On veut cloner la racine choisie et potentiellement ce qu'on a modifié
    const selectedNodes = [selectedItem];
    if (selectedNodeId && !selectedNodes.includes(selectedNodeId)) {
        selectedNodes.push(selectedNodeId);
    }

    fetch('http://127.0.0.1:5000/api/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: selectedItem,
        mode: 'behavior', // ou full-json si tu veux tout l'arbre
        overrides: overrides,
        selectedNodes: Object.keys(overrides).length > 0 ? Object.keys(overrides) : undefined 
      })
    })
    .then(res => res.json())
    .then(data => {
      setCloning(false);
      if (data.error) {
        setCloneMsg(`Erreur: ${data.error}`);
      } else {
        setCloneMsg(`✨ Actifs clonés dans le projet actif !`);
        console.log("Plan de clone :", data.plan);
      }
    })
    .catch(err => {
      setCloning(false);
      setCloneMsg(`Erreur réseau: ${err.message}`);
    });
  };

  const handleSelect = (item: string) => {
    setSelectedItem(item);
    setSearchTerm('');
    setIsDropdownOpen(false);
  };

  const filteredItems = items.filter(it => 
    it.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Calcul Visuel du Survol & Sélection ---
  const displayNodes = nodes.map(n => {
    // Si une connexion ("port") est active, elle prime sur la recherche textuelle
    if (activeConnection) {
        n.data.isSearchResult = false;
        const isConnectedNode = n.id === activeConnection.source || n.id === activeConnection.target;
        const typeColor = getColorForGroup(n.data.group as string);
        return {
          ...n,
          style: {
            ...n.style,
            opacity: isConnectedNode ? 1 : 0.1,
            boxShadow: isConnectedNode ? `0 0 25px ${typeColor}` : n.style?.boxShadow,
            zIndex: isConnectedNode ? 1000 : 0,
            pointerEvents: (isConnectedNode ? 'auto' : 'none') as any
          }
        };
    }

    // Ensuite on check la recherche globale
    if (graphSearchTerm) {
      const match = (n.data.label as string).toLowerCase().includes(graphSearchTerm.toLowerCase()) || 
                    (n.data.group as string).toLowerCase().includes(graphSearchTerm.toLowerCase());
      
      const typeColor = getColorForGroup(n.data.group as string);
      return {
        ...n,
        data: { ...n.data, isSearchResult: match },
        style: {
          ...n.style,
          opacity: match ? 1 : 0.1,
          boxShadow: match ? `0 0 30px ${typeColor}` : n.style?.boxShadow,
          zIndex: match ? 1000 : 0,
          pointerEvents: (match ? 'auto' : 'none') as any
        }
      };
    }

    n.data.isSearchResult = false; // Reset si pas de recherche

    const activeNode = hoveredNode || (isPanelOpen ? selectedNodeId : null);
    if (!activeNode) return n;
    
    const isActive = activeNode === n.id;
    // Est-ce que ce noeud est connecté au noeud actif ?
    const isConnected = edges.some(e => 
      (e.source === activeNode && e.target === n.id) || 
      (e.target === activeNode && e.source === n.id)
    );
    
    const isFaded = !isActive && !isConnected;
    const typeColor = getColorForGroup(n.data.group as string);

    return {
      ...n,
      style: {
        ...n.style,
        opacity: isFaded ? 0.3 : 1,
        // Éclat sur le noeud actif ou connecté
        boxShadow: isActive ? `0 0 25px ${typeColor}` : (isConnected ? `0 0 10px ${typeColor}` : n.style?.boxShadow),
        zIndex: isActive || isConnected ? 1000 : 0,
        pointerEvents: (isFaded ? 'none' : 'auto') as any // Empêche le clic sur les fantômes
      }
    };
  });

  const displayEdges = edges.map(e => {
    // Si un port manuel est sélectionné, focus strict sur cet edge avant tout le reste
    if (activeConnection) {
        const isTheConnection = e.source === activeConnection.source && e.target === activeConnection.target;
        return {
          ...e,
          style: {
            ...e.style,
            stroke: isTheConnection ? '#E2C044' : '#222', // #E2C044 = Jaune moutarde très visible
            strokeWidth: isTheConnection ? 3.5 : 1.5,
          },
          animated: isTheConnection,
          zIndex: isTheConnection ? 1000 : 0
        };
    }

    // Si la recherche globale est active, on tamise toutes les edges
    if (graphSearchTerm) {
        return { ...e, style: { ...e.style, opacity: 0.1 } };
    }

    const activeNode = hoveredNode || (isPanelOpen ? selectedNodeId : null);
    if (!activeNode) return e;

    const isConnected = activeNode === e.source || activeNode === e.target;
    const isFaded = !isConnected;

    return {
      ...e,
      style: {
        ...e.style,
        // Si connecté on colore en clair, sinon on assombrit l'edge
        stroke: isConnected ? '#fff' : (isFaded ? '#222' : '#666'),
        strokeWidth: isConnected ? 2.5 : 1.5,
      },
      animated: isConnected || e.animated,
      zIndex: isConnected ? 1000 : 0
    };
  });

  return (
    <div className="editor-container" style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background gap={20} size={1} color="#444" />
        <Controls />
        
        <Panel position="top-left" className="panel">
          <h3>FineCraft Asset Editor</h3>            
            {/* VFS Project Selector */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #444' }}>
              <select 
                value={activeProject} 
                onChange={e => handleProjectSelect(e.target.value)}
                style={{ padding: '5px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
              >
                <option value="">-- Read-Only (Vanilla) --</option>
                {projects.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input 
                type="text" 
                placeholder="Nouveau projet..." 
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                style={{ padding: '5px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', width: '120px' }}
              />
              <button 
                onClick={handleCreateProject}
                style={{ padding: '5px 10px', background: '#4CAF50', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
              >Créer</button>
            </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Rechercher un item..."
                value={isDropdownOpen ? searchTerm : selectedItem}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => {
                  setSearchTerm('');
                  setIsDropdownOpen(true);
                }}
                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                style={{
                  padding: '5px',
                  background: '#333',
                  color: 'white',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  width: '300px'
                }}
              />
              {isDropdownOpen && (
                <div style={{
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
                  boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                }}>
                  {filteredItems.slice(0, 100).map((it) => (
                    <div 
                      key={it} 
                      onClick={() => handleSelect(it)}
                      style={{
                        padding: '8px',
                        cursor: 'pointer',
                        color: it === selectedItem ? '#61dafb' : 'white',
                        borderBottom: '1px solid #333',
                        background: it === selectedItem ? '#111' : 'transparent',
                        fontSize: '12px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                      onMouseLeave={(e) => e.currentTarget.style.background = it === selectedItem ? '#111' : 'transparent'}
                    >
                      {it}
                    </div>
                  ))}
                  {filteredItems.length === 0 && (
                    <div style={{ padding: '8px', color: '#888', fontStyle: 'italic', fontSize: '12px' }}>Aucun résultat</div>
                  )}
                  {filteredItems.length > 100 && (
                    <div style={{ padding: '8px', color: '#888', fontStyle: 'italic', fontSize: '10px', textAlign: 'center', background: '#111' }}>
                      +{filteredItems.length - 100} autres résultats... affinez la recherche.
                    </div>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={loadGraph}
              disabled={loading}
              style={{ padding: '5px 10px', background: '#61dafb', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {loading ? 'Chargement...' : 'Charger'}
            </button>
            
            <div style={{ marginLeft: '20px', borderLeft: '1px solid #555', paddingLeft: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={runClone}
                disabled={loading || cloning}
                style={{ padding: '5px 15px', background: '#DDA0DD', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {cloning ? 'Clonage...' : '🚀 CLONER'}
              </button>
            </div>
            {cloneMsg && <span style={{fontSize: '12px', color: '#96CEB4', marginLeft: '10px'}}>{cloneMsg}</span>}
          </div>

          {/* Deuxième ligne: Outils internes au Graphe */}
          {nodes.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px', padding: '10px', background: 'rgba(30,30,30,0.8)', border: '1px solid #444', borderRadius: '6px' }}>
              <span style={{ fontSize: '11px', color: '#888' }}>🔍 RECHERCHE :</span>
              <input
                 type="text"
                 placeholder="Filtrer par nom ou groupe (ex: texture)..."
                 value={graphSearchTerm}
                 onChange={(e) => setGraphSearchTerm(e.target.value)}
                 style={{
                   padding: '5px',
                   background: '#222',
                   color: 'white',
                   border: '1px solid #555',
                   borderRadius: '4px',
                   width: '250px',
                   fontSize: '11px'
                 }}
              />
              <span style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>
                {graphSearchTerm ? `${nodes.filter(n => (n.data.label as string).toLowerCase().includes(graphSearchTerm.toLowerCase()) || (n.data.group as string).toLowerCase().includes(graphSearchTerm.toLowerCase())).length} trouvé(s)` : `${nodes.length} nœuds au total`}
              </span>
            </div>
          )}
        </Panel>

        {isPanelOpen && selectedNodeId && (
          <Panel position="top-right" style={{ 
            width: '450px', 
            height: '80vh', 
            background: '#1e1e1e', 
            border: '1px solid #444',
            display: 'flex', 
            flexDirection: 'column',
            boxShadow: '-5px 0 15px rgba(0,0,0,0.5)'
          }}>
            <div style={{ padding: '10px', background: '#333', borderBottom: '1px solid #555', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '12px', wordBreak: 'break-all', color: '#fff' }}>{selectedNodeId}</strong>
              <div style={{ display: 'flex', gap: '5px' }}>
                {selectedNodeId.includes("Interactions") && (
                   <button 
                     onClick={() => setFocusedInteraction(selectedNodeId)}
                     style={{ background: '#F4A261', color: '#000', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '2px 5px', fontWeight: 'bold', marginRight: '10px' }}
                   >⚡ Éditeur Nodal</button>
                )}
                <button 
                  onClick={() => setEditorMode('form')}
                  style={{ background: editorMode === 'form' ? '#61dafb' : '#444', color: editorMode === 'form' ? '#000' : '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '2px 5px' }}
                >Form</button>
                <button 
                  onClick={() => setEditorMode('raw')}
                  style={{ background: editorMode === 'raw' ? '#61dafb' : '#444', color: editorMode === 'raw' ? '#000' : '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '2px 5px' }}
                >JSON</button>
                <button 
                  onClick={() => { setIsPanelOpen(false); setSelectedNodeId(null); }}
                  style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer', marginLeft: '5px' }}
                >X</button>
              </div>
            </div>
            
            <div style={{ flex: 1, overflow: 'auto', background: '#1e1e1e' }}>
              {editorMode === 'raw' || !nodeSchemas[selectedNodeId] ? (
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  theme="vs-dark"
                  value={nodeContent}
                  onChange={handleEditorChange}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    wordWrap: 'on'
                  }}
                />
              ) : (
                <div style={{ padding: '10px', color: '#fff' }}>
                  <Form
                    schema={nodeSchemas[selectedNodeId] || {}}
                    validator={validator}
                    formData={
                      (function() {
                        try { return JSON.parse(nodeContent); }
                        catch(e) { return {}; }
                      })()
                    }
                    onChange={(e) => {
                      setNodeContent(JSON.stringify(e.formData, null, 2));
                    }}
                    onSubmit={saveOverride}
                    uiSchema={{
                      // Options pour rendre le RJSF plus compact en Dark Mode
                      'ui:submitButtonOptions': { norender: true } 
                    }}
                  />
                </div>
              )}
            </div>

            <div style={{ padding: '10px', background: '#333', borderTop: '1px solid #555', display: 'flex', justifyContent: 'flex-end' }}>
               <button 
                 onClick={saveOverride}
                 style={{ padding: '5px 15px', background: '#4ECDC4', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
               >
                 Enregistrer l'Override
               </button>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Editor Modal is a sibling to avoid context collision with the main ReactFlow instance */}
      {focusedInteraction && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, background: '#000' }}>
          <InteractionEditor rootId={focusedInteraction} onClose={() => setFocusedInteraction(null)} />
        </div>
      )}
    </div>
  );
}

export default App;
