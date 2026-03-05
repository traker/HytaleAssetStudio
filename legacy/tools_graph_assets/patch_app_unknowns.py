import json

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

app_code = read_file('K:/projet/java/TestPluginHytale/tools/graph_assets/ui/app.py')

old_code = """    node_id = base_id
    t = data.get('Type', 'Unknown')
    if base_id == "root" and 'Interactions' in data and 'Type' not in data:
        t = "Root (List)"

    summary = []
    raw_fields = {}
    for k, v in data.items():
        if k not in ['Type', 'Next', 'Failed', 'Interactions'] and not isinstance(v, (dict, list)):
            summary.append(f"{k}: {v}")
        if k not in ['Next', 'Failed', 'Interactions']:
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
                if 'Type' in val:
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
    handle_hook('Next', 'next')
    handle_hook('Failed', 'failed')
    handle_hook('Interactions', 'child')

    return node_id"""

new_code = """    node_id = base_id
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

    return node_id"""

app_code = app_code.replace(old_code, new_code)
with open('K:/projet/java/TestPluginHytale/tools/graph_assets/ui/app.py', 'w', encoding='utf-8') as f:
    f.write(app_code)
