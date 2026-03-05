import os
import json
from pathlib import Path
from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from genson import SchemaBuilder
import sys
import interaction_schema

# Import core generation logic from CLI tool
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import hytale_graph_viz as viz

app = Flask(__name__, static_folder='static')
CORS(app)

# Global graph state
graph_data = {
    'G': None,
    'roots': []
}

class WorkspaceManager:
    def __init__(self, repo_root: Path):
        self.repo_root = repo_root
        self.vanilla_dir = repo_root / 'Assets'
        self.projects_dir = repo_root / 'projects'
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self.active_project = None
        
    def set_active_project(self, project_name: str):
        if project_name:
            p_dir = self.projects_dir / project_name
            p_dir.mkdir(exist_ok=True)
            (p_dir / 'overrides').mkdir(exist_ok=True)
            self.active_project = project_name
        else:
            self.active_project = None
            
    def list_projects(self):
        projects = []
        for p in self.projects_dir.iterdir():
            if p.is_dir():
                projects.append(p.name)
        return projects
        
    def get_roots(self) -> list[Path]:
        roots = []
        if self.active_project:
            p_dir = self.projects_dir / self.active_project / 'overrides'
            if p_dir.exists():
                roots.append(p_dir)
        # We always keep Vanilla as fallback
        roots.append(self.vanilla_dir)
        # We also might want to keep the plugins from default roots to show them
        # Let's just append the rest from default roots but omit Assets duplicates
        for r in viz._default_roots(self.repo_root):
            if r != self.vanilla_dir:
                roots.append(r)
        return [r for r in roots if r.exists() and r.is_dir()]
        
    def resolve_file(self, rel_path: str) -> Path | None:
        """Finds a file prioritizing active project overrides, then Vanilla"""
        if self.active_project:
            override_path = self.projects_dir / self.active_project / 'overrides' / rel_path
            if override_path.exists():
                return override_path
                
        # Fallback to other roots
        for r in self.get_roots():
            p = r / rel_path
            if p.exists() and p.is_file():
                return p
        return None
        
    def save_override(self, rel_path: str, content: dict):
        if not self.active_project:
            raise ValueError("No active project is selected. Cannot save override.")
            
        override_path = self.projects_dir / self.active_project / 'overrides' / rel_path
        override_path.parent.mkdir(parents=True, exist_ok=True)
        
        with override_path.open('w', encoding='utf-8') as f:
            json.dump(content, f, indent=4)
            
workspace_manager = WorkspaceManager(Path(__file__).resolve().parents[3])

def rebuild_graph():
    """Forces a graph rebuild using current workspace roots."""
    roots = workspace_manager.get_roots()
    print("Rebuilding graph with roots:", [r.name for r in roots])
    G, _ = viz.build_graph(roots)
    graph_data['G'] = G
    graph_data['roots'] = roots
    print(f"Graph rebuilt. {G.number_of_nodes()} nodes.")

def init_graph():
    roots = workspace_manager.get_roots()
    pickle_path = Path(__file__).resolve().parent.parent / '.cache' / 'hytale_graph.gpickle'
    
    import pickle
    if pickle_path.exists():
        print(f"Loading graph cache from {pickle_path}")
        with pickle_path.open('rb') as f:
            G = pickle.load(f)
        viz._retag_nodes_in_place(G)
        graph_data['G'] = G
        graph_data['roots'] = roots
        print(f"Graph loaded. {G.number_of_nodes()} nodes.")
    else:
        print("Building graph...")
        rebuild_graph()
        # Ensure we cache the baseline if no project active
        if not workspace_manager.active_project:
            try:
                pickle_path.parent.mkdir(parents=True, exist_ok=True)
                with pickle_path.open('wb') as f:
                    pickle.dump(graph_data['G'], f, protocol=pickle.HIGHEST_PROTOCOL)
            except Exception as e:
                pass


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/projects', methods=['GET'])
def list_projects():
    return jsonify({
        'projects': workspace_manager.list_projects(),
        'active': workspace_manager.active_project
    })

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json
    project_name = data.get('project')
    if project_name:
        workspace_manager.set_active_project(project_name)
        rebuild_graph()
        return jsonify({
            'success': True,
            'active': workspace_manager.active_project
        })
    return jsonify({'error': 'Missing project name'}), 400

@app.route('/api/projects/active', methods=['POST'])
def set_active_project():
    data = request.json
    project_name = data.get('project')
    workspace_manager.set_active_project(project_name)
    rebuild_graph()
    return jsonify({
        'success': True,
        'active': workspace_manager.active_project
    })

@app.route('/api/save_node', methods=['POST'])
def save_node():
    if not workspace_manager.active_project:
        return jsonify({'error': 'No active project selected. Cannot save overrides.'}), 400
        
    data = request.json
    node_id = data.get('id')
    content = data.get('content')
    
    if not node_id or not content:
        return jsonify({'error': 'Missing id or content'}), 400
        
    try:
        rel_path = node_id.replace('\\', '/')
        workspace_manager.save_override(rel_path, content)
        
        # We need to rebuild the graph to pick up the override
        rebuild_graph()
        
        return jsonify({
            'success': True,
            'message': f"Saved override for {node_id} to project {workspace_manager.active_project}"
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/items')
def get_items():
    G = graph_data['G']
    # Return all items for a dropdown
    items = sorted([Path(n).stem for n, d in G.nodes(data=True) if d.get('type') == 'item'])
    return jsonify(list(set(items)))

@app.route('/api/graph')
def get_graph():
    item_query = request.args.get('item')
    depth_str = request.args.get('depth')
    
    if not item_query:
        return jsonify({'error': 'Missing item parameter'}), 400
        
    depth = int(depth_str) if depth_str and depth_str.isdigit() else None
    
    G = graph_data['G']
    item_node = viz._resolve_item_node(G, item_query)
    
    if not item_node:
        return jsonify({'error': f'Item not found: {item_query}'}), 404
        
    descendants = viz._depth_limited_descendants(G, item_node, depth)
    subgraph_nodes = descendants | {item_node}
    subG = G.subgraph(subgraph_nodes).copy()
    
    # Export to vis-network friendly JSON format
    nodes = []
    edges = []
    
    for node, data in subG.nodes(data=True):
        is_override = False
        resolved = workspace_manager.resolve_file(node)
        if resolved and workspace_manager.active_project and str(workspace_manager.projects_dir) in str(resolved):
            is_override = True
            
        nodes.append({
            'id': node,
            'label': data.get('label', Path(node).name),
            'title': data.get('title', node),
            'group': data.get('type', 'other'),
            'path': node,
            'isOverride': is_override
        })
        
    for u, v, data in subG.edges(data=True):
        edges.append({
            'from': u,
            'to': v,
            'label': data.get('label', '')
        })
        
    return jsonify({
        'nodes': nodes,
        'edges': edges,
        'rootId': item_node
    })

@app.route('/api/node/content')
def get_node_content():
    node_id = request.args.get('id')
    if not node_id:
        return jsonify({'error': 'Missing id parameter'}), 400
        
    G = graph_data['G']
    if node_id not in G:
        return jsonify({'error': 'Node not found in graph'}), 404
        
    candidate = workspace_manager.resolve_file(node_id)
    if candidate:
        try:
            with candidate.open('r', encoding='utf-8') as f:
                content = json.load(f)
            
            # Derive schema from data
            builder = SchemaBuilder()
            builder.add_schema({"type": "object", "properties": {}})
            builder.add_object(content)
            schema = builder.to_schema()

            # Add specific Intelligence for Interaction forms
            if "Interactions" in node_id or "RootInteractions" in node_id:
                all_int_names = interaction_schema.get_all_interaction_names(graph_data['roots'])
                schema = interaction_schema.build_interaction_schema(schema, all_int_names)

            # Inform frontend if it's an override
            is_override = False
            if workspace_manager.active_project and str(workspace_manager.projects_dir) in str(candidate):
                is_override = True

            return jsonify({
                'id': node_id, 
                'data': content, 
                'schema': schema,
                'isOverride': is_override
            })
        except Exception as e:
            return jsonify({'error': f'Failed to parse JSON: {e}'}), 500
            
    return jsonify({'error': 'File not found on disk or not JSON'}), 404

def parse_interaction_tree(data, base_id, nodes, edges):
    """
    Recursively parse an interaction dict into nodes and edges for the frontend.
    Returns the id of the primary node created.
    """
    if isinstance(data, list):
        node_id = base_id
        nodes.append({
            'id': node_id,
            'type': "List",
            'label': node_id,
            'summary': [],
            'rawFields': {},
            'isExternal': False
        })
        for i, item in enumerate(data):
            t_id = parse_interaction_tree(item, f"{base_id}[{i}]", nodes, edges)
            if t_id:
                edges.append({'source': node_id, 'target': t_id, 'label': f'[{i}]', 'type': 'child'})
        return node_id

    if isinstance(data, str):
        # external reference
        nodes.append({
            'id': data,
            'type': 'External',
            'label': data,
            'isExternal': True
        })
        return data

    if not isinstance(data, dict):
        return None

    node_id = base_id
    t = data.get('Type')
    if not t:
        if 'Interactions' in data:
            t = "Parallel/List"
        else:
            t = "Unknown"

    hook_keys_present = []
    for k in ['Next', 'Failed', 'Interactions', 'HitEntity', 'HitBlock', 'DefaultValue', 'FailOn']:
        if k in data:
            if k == 'DefaultValue' and not isinstance(data[k], (dict, list)):
                continue
            hook_keys_present.append(k)

    summary = []
    raw_fields = {}
    for k, v in data.items():
        if k not in hook_keys_present + ['Type'] and not isinstance(v, (dict, list)):
            summary.append(f"{k}: {v}")
        if k not in hook_keys_present:
            raw_fields[k] = v

    nodes.append({
        'id': node_id,
        'type': t,
        'label': node_id,
        'summary': summary,
        'rawFields': raw_fields,
        'isExternal': False
    })

    def handle_hook(key_name, rel_type):
        if key_name in data:
            val = data[key_name]
            if isinstance(val, dict):
                if 'Type' in val or 'Interactions' in val:
                    t_id = parse_interaction_tree(val, f"{node_id}.{key_name}", nodes, edges)
                    if t_id:
                        edges.append({'source': node_id, 'target': t_id, 'label': key_name, 'type': rel_type})
                else:
                    for k, item in val.items():
                        t_id = parse_interaction_tree(item, f"{node_id}.{key_name}{{{k}}}", nodes, edges)
                        if t_id:
                            edges.append({'source': node_id, 'target': t_id, 'label': f'{key_name}{{{k}}}', 'type': rel_type})
            elif isinstance(val, list):
                for i, item in enumerate(val):
                    t_id = parse_interaction_tree(item, f"{node_id}.{key_name}[{i}]", nodes, edges)
                    if t_id:
                        edges.append({'source': node_id, 'target': t_id, 'label': f'{key_name}[{i}]', 'type': rel_type})
            else:
                t_id = parse_interaction_tree(val, f"{node_id}.{key_name}", nodes, edges)
                if t_id:
                    edges.append({'source': node_id, 'target': t_id, 'label': key_name, 'type': rel_type})

    # Process hooks
    for hk in hook_keys_present:
        rel = 'next' if hk in ['Next'] else ('failed' if hk in ['Failed', 'FailOn'] else 'child')
        handle_hook(hk, rel)

    return node_id

@app.route('/api/interaction/tree')
def get_interaction_tree():
    node_id = request.args.get('id')
    if not node_id:
        return jsonify({'error': 'Missing id parameter'}), 400
        
    G = graph_data['G']
    candidate = workspace_manager.resolve_file(node_id)
    if candidate:
        try:
            with candidate.open('r', encoding='utf-8') as f:
                content = json.load(f)
            
            nodes = []
            edges = []
            parse_interaction_tree(content, "root", nodes, edges)
            
            return jsonify({'nodes': nodes, 'edges': edges})
        except Exception as e:
            return jsonify({'error': f'Failed to parse JSON: {e}'}), 500
                
    return jsonify({'error': 'File not found'}), 404

@app.route('/api/plugins')
def get_plugins():
    repo_root = Path(__file__).resolve().parents[3]
    plugins = []
    # On scanne les dossiers à la racine qui commencent par plugin- (ou src pour le root server)
    for p in repo_root.iterdir():
        if p.is_dir() and (p.name.startswith('plugin-') or p.name == 'src' or p.name == 'save'):
            plugins.append(p.name)
    return jsonify(sorted(plugins))

@app.route('/api/clone', methods=['POST'])
def run_clone():
    payload = request.json
    item = payload.get('item')
    depth = payload.get('depth')
    namespace = payload.get('namespace', 'FineCraft')
    prefix = payload.get('prefix', 'FineCraft_Clone_')
    mode = payload.get('mode', 'behavior')
    selected_nodes = payload.get('selectedNodes', []) # Array of exact node IDs to keep in the clone plan
    overrides = payload.get('overrides', {}) # Dictionary of sourceRel -> modified JSON payload
    
    G = graph_data['G']
    item_node = viz._resolve_item_node(G, item)
    if not item_node:
        return jsonify({'error': 'Item not found'}), 404
        
    # Generate full plan first
    descendants = viz._depth_limited_descendants(G, item_node, depth)
    subgraph_nodes = descendants | {item_node}
    
    plan = viz._make_clone_plan(
        roots=graph_data['roots'],
        subgraph_nodes=subgraph_nodes,
        item_node=item_node,
        namespace=namespace,
        prefix=prefix,
        mode=mode
    )
    
    if overrides:
        plan['overrides'] = overrides
        
    # Filter the plan based on UI selection
    if selected_nodes:
        # Keep only files explicitly selected by the user
        plan['files'] = [f for f in plan['files'] if f['sourceRel'] in selected_nodes]
        # Re-derive exact replacements for safety based only on kept files
        kept_rels = set([f['sourceRel'] for f in plan['files']])
        
        filtered_path_map = {k: v for k, v in plan['pathMap'].items() if k in kept_rels}
        filtered_id_map = {k: v for k, v in plan['idMap'].items() if any(Path(rel).stem == k for rel in kept_rels)}
        
        plan['pathMap'] = filtered_path_map
        plan['idMap'] = filtered_id_map
        
        replacements = {}
        for old_rel, new_rel in plan['pathMap'].items():
            replacements[old_rel] = new_rel
            if not old_rel.startswith('Common/'):
                replacements[f'Common/{old_rel}'] = f'Common/{new_rel}'
        for old_id, new_id in plan['idMap'].items():
            replacements[old_id] = new_id
            
        plan['replacementsExact'] = replacements
    
# Write to active project's overrides directory
    if not workspace_manager.active_project:
        return jsonify({'error': 'No active project selected. Cannot clone.'}), 400
        
    clone_root = workspace_manager.projects_dir / workspace_manager.active_project / 'overrides'

    try:
        viz._write_clone_assets(plan, clone_root=clone_root)
        
        # We might need to rebuild the graph after cloning to pick up new files
        rebuild_graph()
        
        return jsonify({
            'success': True,
            'message': f"Cloned {len(plan['files'])} files into project {workspace_manager.active_project}",
            'plan': plan
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    init_graph()
    from waitress import serve
    print("UI running on http://127.0.0.1:5000")
    serve(app, host='127.0.0.1', port=5000)
