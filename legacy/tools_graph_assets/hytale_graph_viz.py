import argparse
import json
import os
import pickle
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

import networkx as nx
import pyvis.network as net

# Mapping type → couleur (tu peux en ajouter)
COLOR_MAP = {
    'item': '#FF6B6B',        # Rouge
    'block': '#4ECDC4',       # Cyan
    'model': '#45B7D1',       # Bleu
    'texture': '#96CEB4',     # Vert
    'sound': '#FFEAA7',       # Jaune
    'particle': '#DDA0DD',    # Violet
    'category': '#F4A261',    # Orange
    'lang': '#778DA9',        # Gris bleu
    'json_other': '#9B9B9B',  # Gris clair
    'other': '#95A5A6',        # Gris
    'interaction': '#F4A261',     # Orange pour interactions (Knife_Attack, etc.)
    'projectile': '#FF9FF3',      # Rose pour projectiles
    'sound_event': '#FFE66D',     # Jaune clair pour sound events / sets
    'effect': '#D4A5A5',          # Gris-rose pour effets divers
    'json_data': '#9B9B9B'       # On renomme json_other en json_data pour plus de clarté
}

DEFAULT_SHAPE_MAP = {
    'item': 'box',
    'block': 'box',
    'interaction': 'diamond',
    'projectile': 'dot',
    'sound_event': 'triangle',
    'sound': 'triangleDown',
    'model': 'ellipse',
    'texture': 'ellipse',
    'particle': 'star',
    'category': 'database',
    'lang': 'database',
    'json_data': 'ellipse',
    'other': 'ellipse',
}

def get_asset_type(relpath: str) -> str:
    path_lower = relpath.lower().replace('\\', '/')
    name_lower = Path(relpath).name.lower()

    if path_lower.endswith('.json'):
        # Items
        if any(kw in path_lower for kw in [
            'server/item/items/', '/items/', 'item/items/',
            'server/item/weapon/', 'server/item/tool/', 'server/item/armor/',
            'server/item/consumable/', 'server/item/material/', 'server/item/misc/'
        ]):
            return 'item'
        
        # Blocks
        # Vanilla blocks are not necessarily stored as Server/Block/Blocks/*.json; the repo contains
        # block-related JSON primarily under BlockTypeList and some under Server/Item/Block/Blocks.
        if any(
            kw in path_lower
            for kw in [
                'server/blocktypelist/',
                'server/item/block/blocks/',
                'server/item/blocks/',
                'server/block/blocks/',
            ]
        ):
            return 'block'
        
        # Interactions & projectiles
        if any(kw in path_lower for kw in ['/interactions/', 'interaction/', '/projectile/', 'projectiles/']):
            if 'projectile' in path_lower:
                return 'projectile'
            return 'interaction'
        
        # Sons & events
        if any(kw in path_lower for kw in ['/sound/', '/sounds/', 'soundset', 'soundevent', '/sfx/']):
            return 'sound_event'
        
        # Autres catégories
        if any(kw in path_lower for kw in ['/category/', 'categories/', 'item/category']):
            return 'category'
        if 'language' in path_lower or 'languages/' in path_lower:
            return 'lang'
        if 'drop' in path_lower or 'drops/' in path_lower:
            return 'drop_table'
        if 'npc' in path_lower or 'npcs/' in path_lower:
            return 'npc'
        
        return 'json_data'  # JSON divers (inclut les anciens json_other)

    elif path_lower.endswith(('.blockymodel', '.hym', '.model', '.blockyanim')):
        return 'model'

    elif path_lower.endswith(('.png', '.jpg', '.jpeg', '.tga')):
        return 'texture'

    elif path_lower.endswith(('.ogg', '.wav', '.mp3')) or '/sound/' in path_lower or '/audio/' in path_lower:
        return 'sound'

    elif any(x in path_lower for x in ['particle', 'vfx', 'effect', 'particles/', 'fx/']):
        return 'particle'

    return 'other'

_URL_PREFIXES = ('http://', 'https://', 'data:', '#', 'javascript:')

def is_likely_asset_ref(s: str) -> bool:
    if not isinstance(s, str):
        return False
    s = s.strip()
    if len(s) < 3:
        return False
    # Chemins avec /
    if '/' in s and not s.startswith(_URL_PREFIXES):
        return True
    # IDs logiques Hytale : souvent avec _, CamelCase ou ALL_CAPS
    if '_' in s and s.replace('_', '').replace('-', '').isalnum():
        return True
    return False

def find_asset_refs(obj) -> set:
    """Trouve récursivement les références dans un JSON"""
    refs = set()
    if isinstance(obj, str):
        if is_likely_asset_ref(obj):
            refs.add(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            refs.update(find_asset_refs(v))
    elif isinstance(obj, list):
        for v in obj:
            refs.update(find_asset_refs(v))
    return refs

def _normalize_slashes(p: str) -> str:
    return p.strip().replace('\\', '/').replace('//', '/')

def normalize_ref(ref: str, current_file: str, all_files_set: Set[str]) -> Optional[str]:
    """Tente de résoudre la référence vers un chemin existant"""
    ref = _normalize_slashes(ref)

    candidates = []

    # 1. Tel quel
    candidates.append(ref)

    # 2. Avec Common/ devant
    if not ref.startswith('Common/'):
        candidates.append(f"Common/{ref}")

    # 3. Relatif au dossier du fichier courant
    current_dir = str(Path(current_file).parent).replace('\\', '/')
    if current_dir != '.':
        candidates.append(f"{current_dir}/{ref}".replace('//', '/'))

    # 4. Relatif + Common/
    if current_dir != '.' and not ref.startswith('Common/'):
        candidates.append(f"Common/{current_dir}/{ref}".replace('//', '/'))

    for cand in candidates:
        if cand in all_files_set:
            return cand

    return None

def _iter_files(roots: Sequence[Path]) -> Iterable[Tuple[Path, str]]:
    for root in roots:
        if not root.exists() or not root.is_dir():
            continue
        for p in root.rglob('*'):
            if p.is_file():
                rel = str(p.relative_to(root)).replace('\\', '/')
                yield root, rel

def _read_text(path: Path) -> str:
    return path.read_text(encoding='utf-8', errors='ignore')


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')

def _is_probably_json(path: str) -> bool:
    return path.lower().endswith('.json')

def _build_stem_index(all_files: Dict[str, str]) -> Dict[str, List[str]]:
    stem_to_paths: Dict[str, List[str]] = defaultdict(list)
    for rel in all_files:
        stem_to_paths[Path(rel).stem.lower()].append(rel)
    return stem_to_paths

def _pick_best_id_targets(ref_id: str, candidates: List[str], all_files: Dict[str, str]) -> List[str]:
    if len(candidates) <= 1:
        return candidates

    ref_lower = ref_id.lower()
    preferred_types: List[str] = []
    if 'projectile' in ref_lower:
        preferred_types.append('projectile')
    if ref_lower.startswith(('root_', 'interaction_', 'finecraft_')) or 'interaction' in ref_lower:
        preferred_types.append('interaction')
    if ref_lower.startswith(('sfx_', 'sound_', 'music_')) or 'sound' in ref_lower:
        preferred_types.extend(['sound_event', 'sound'])

    if preferred_types:
        filtered = [p for p in candidates if all_files.get(p) in preferred_types]
        if filtered:
            return filtered
    return candidates

def build_graph(roots: Sequence[Path]) -> Tuple[nx.DiGraph, Dict[str, str]]:
    """Construit le graphe complet (multi-roots).

    Les nœuds sont indexés par leur chemin relatif dans la racine (ex: Server/Item/...).
    Si plusieurs roots contiennent le même relpath, le dernier root gagne pour la lecture
    (mais on ne duplique pas le nœud).
    """
    G = nx.DiGraph()
    all_files: Dict[str, str] = {}
    all_files_set: Set[str] = set()
    rel_to_disk: Dict[str, Path] = {}

    print('Scan des fichiers...')
    for root, rel in _iter_files(roots):
        asset_type = get_asset_type(rel)
        all_files[rel] = asset_type
        all_files_set.add(rel)
        rel_to_disk[rel] = root / rel
        if rel not in G:
            G.add_node(rel, type=asset_type, label=Path(rel).name)
        else:
            G.nodes[rel]['type'] = asset_type
            G.nodes[rel]['label'] = Path(rel).name

    print(f'{len(all_files)} fichiers trouvés (roots={len(roots)}).')

    json_files = [f for f in all_files if _is_probably_json(f)]
    raw_refs_by_source: Dict[str, Set[str]] = defaultdict(set)

    print('Parse des JSON et création des arêtes (refs par chemin)...')
    for i, rel in enumerate(json_files, 1):
        if i % 750 == 0:
            print(f'  {i}/{len(json_files)} JSON traités...')
        try:
            data = json.loads(_read_text(rel_to_disk[rel]))
        except json.JSONDecodeError:
            continue
        except Exception as e:
            print(f'Erreur {rel}: {e}')
            continue

        refs = find_asset_refs(data)
        for ref in refs:
            full_ref = normalize_ref(ref, rel, all_files_set)
            if full_ref:
                G.add_edge(rel, full_ref)
            else:
                raw_refs_by_source[rel].add(ref)

    print('Résolution des refs par ID (stems) quand possible...')
    stem_to_paths = _build_stem_index(all_files)

    # Réduit le bruit : seules les refs qui ressemblent à un ID Hytale (letters/digits/_) sont candidates.
    id_pat = re.compile(r'^[A-Za-z0-9_\-]{3,}$')

    added_id_edges = 0
    for source, raw_refs in raw_refs_by_source.items():
        for ref_id in raw_refs:
            ref_id = ref_id.strip()
            if '/' in ref_id or not id_pat.match(ref_id):
                continue
            candidates = stem_to_paths.get(ref_id.lower())
            if not candidates:
                continue

            for target in _pick_best_id_targets(ref_id, candidates, all_files):
                if not G.has_edge(source, target):
                    G.add_edge(source, target, label=ref_id)
                    added_id_edges += 1

    print(f'→ {added_id_edges} arêtes ajoutées via résolution d\'IDs (label=ID original)')

    # Ajout des couleurs et tooltips
    for node, data in G.nodes(data=True):
        t = data.get('type', 'other')
        data['color'] = COLOR_MAP.get(t, '#95A5A6')
        data['shape'] = DEFAULT_SHAPE_MAP.get(t, DEFAULT_SHAPE_MAP['other'])
        data['title'] = f"Type: {t}\nChemin: {node}\nDegré: {G.degree(node)}"

    print(f'Graphe construit : {G.number_of_nodes()} nœuds, {G.number_of_edges()} arêtes')
    return G, all_files


def _retag_nodes_in_place(G: nx.DiGraph) -> None:
    for node in list(G.nodes()):
        asset_type = get_asset_type(node)
        G.nodes[node]['type'] = asset_type
        G.nodes[node]['label'] = Path(node).name
        G.nodes[node]['color'] = COLOR_MAP.get(asset_type, '#95A5A6')
        G.nodes[node]['shape'] = DEFAULT_SHAPE_MAP.get(asset_type, DEFAULT_SHAPE_MAP['other'])
        G.nodes[node]['title'] = (
            f'Type: {asset_type}\nChemin: {node}\nDegré: {G.degree(node)}'
        )

def _depth_limited_descendants(G: nx.DiGraph, source: str, max_depth: Optional[int]) -> Set[str]:
    if max_depth is None:
        return nx.descendants(G, source)
    if max_depth < 0:
        return set()

    visited: Set[str] = set()
    frontier: List[Tuple[str, int]] = [(source, 0)]
    while frontier:
        node, depth = frontier.pop(0)
        if depth >= max_depth:
            continue
        for succ in G.successors(node):
            if succ in visited or succ == source:
                continue
            visited.add(succ)
            frontier.append((succ, depth + 1))
    return visited

def _resolve_item_node(G: nx.DiGraph, item: str) -> Optional[str]:
    item = item.strip()
    if not item:
        return None

    # 1) Chemin exact
    if item in G:
        return item

    # 2) Stem match (case-insensitive)
    item_lower = item.lower()
    candidates = [n for n in G.nodes() if Path(n).stem.lower() == item_lower]
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]

    # Heuristique: si plusieurs matches, on préfère les items.
    item_candidates = [n for n in candidates if G.nodes[n].get('type') == 'item']
    if len(item_candidates) == 1:
        return item_candidates[0]
    if item_candidates:
        return sorted(item_candidates)[0]
    return sorted(candidates)[0]

def _render_html(subG: nx.DiGraph, html_file: Path) -> None:
    html_file.parent.mkdir(parents=True, exist_ok=True)

    nt = net.Network(
        height='900px',
        width='100%',
        directed=True,
        notebook=False,
        bgcolor='#222222',
        font_color='white',
        cdn_resources='remote',
    )
    nt.from_nx(subG)

    nt.set_options(
        """
    {
      "physics": {
        "enabled": true,
        "barnesHut": {
          "gravitationalConstant": -8000,
          "springLength": 150,
          "springConstant": 0.04
        },
        "stabilization": {
          "enabled": true,
          "iterations": 300
        }
      },
      "nodes": {
        "font": {"size": 14, "color": "white"},
        "scaling": {"min": 10, "max": 35}
      },
      "edges": {
        "arrows": {"to": {"enabled": true, "scaleFactor": 0.5}},
        "color": {"inherit": "from"}
      }
    }
    """
    )

    nt.show(str(html_file), notebook=False)


def _resolve_disk_path(roots: Sequence[Path], rel: str) -> Optional[Path]:
    for root in roots:
        candidate = root / rel
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def _rewrite_json_strings_exact(obj, replacements: Dict[str, str]):
    """Recursively rewrites strings in JSON where the full string matches a key."""
    if isinstance(obj, str):
        return replacements.get(obj, obj)
    if isinstance(obj, dict):
        return {k: _rewrite_json_strings_exact(v, replacements) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_rewrite_json_strings_exact(v, replacements) for v in obj]
    return obj


def _insert_namespace_in_path(rel: str, namespace: str) -> str:
    rel = _normalize_slashes(rel)
    parts = rel.split('/')
    if len(parts) < 2:
        return rel
    if parts[0].lower() != 'server':
        # keep as-is; caller can decide.
        return rel

    # Put the namespace under well-known asset buckets.
    # Server/Item/<bucket>/... -> Server/Item/<bucket>/<namespace>/...
    # Server/ProjectileConfigs/... -> Server/ProjectileConfigs/<namespace>/...
    if len(parts) >= 3 and parts[1].lower() == 'item':
        # Server/Item/<bucket>
        if len(parts) >= 4:
            bucket = parts[2]
            return '/'.join([parts[0], parts[1], bucket, namespace] + parts[3:])
        return rel

    if len(parts) >= 2 and parts[1].lower() in ('projectileconfigs', 'projectiles', 'particles', 'models', 'audio'):
        return '/'.join([parts[0], parts[1], namespace] + parts[2:])

    return '/'.join([parts[0], namespace] + parts[1:])


def _rename_filename_with_prefix(rel: str, prefix: str) -> str:
    rel = _normalize_slashes(rel)
    p = Path(rel)
    if not p.suffix:
        return rel
    new_name = f'{prefix}{p.stem}{p.suffix}'
    return str(p.with_name(new_name)).replace('\\', '/')


def _select_clone_nodes(nodes: Set[str], mode: str) -> Set[str]:
    """Select which nodes to clone based on mode. Only JSON files are considered."""
    json_nodes = {n for n in nodes if n.lower().endswith('.json')}
    if mode == 'minimal':
        # will be refined by caller to include the starting item node only
        return set()
    if mode == 'behavior':
        allow_prefixes = (
            'server/item/',
            'server/projectileconfigs/',
            'server/projectiles/',
        )
        return {n for n in json_nodes if n.lower().startswith(allow_prefixes)}
    if mode == 'full-json':
        return json_nodes
    raise ValueError(f'Unknown clone mode: {mode}')


def _make_clone_plan(
    roots: Sequence[Path],
    subgraph_nodes: Set[str],
    item_node: str,
    namespace: str,
    prefix: str,
    mode: str,
) -> Dict:
    """Build a clone plan (mapping + file list) but does not write anything."""
    to_clone = _select_clone_nodes(subgraph_nodes, mode)
    if mode == 'minimal':
        to_clone = {item_node} if item_node.lower().endswith('.json') else set()
    else:
        # Always include the root item node if it's JSON (even if not matching allowlist)
        if item_node.lower().endswith('.json'):
            to_clone.add(item_node)

    # Only keep files we can actually locate on disk.
    rel_to_disk = {rel: _resolve_disk_path(roots, rel) for rel in to_clone}
    rel_to_disk = {rel: p for rel, p in rel_to_disk.items() if p is not None}
    to_clone = set(rel_to_disk.keys())

    path_map: Dict[str, str] = {}
    id_map: Dict[str, str] = {}

    for rel in sorted(to_clone):
        dst_rel = _insert_namespace_in_path(rel, namespace)
        dst_rel = _rename_filename_with_prefix(dst_rel, prefix)
        path_map[rel] = dst_rel
        id_map[Path(rel).stem] = Path(dst_rel).stem

    # Build exact-string replacements. We only replace exact matches of old IDs/paths.
    replacements: Dict[str, str] = {}
    for old_rel, new_rel in path_map.items():
        replacements[old_rel] = new_rel
        if not old_rel.startswith('Common/'):
            replacements[f'Common/{old_rel}'] = f'Common/{new_rel}'

    for old_id, new_id in id_map.items():
        replacements[old_id] = new_id

    files = []
    for rel in sorted(to_clone):
        disk_path = rel_to_disk[rel]
        files.append(
            {
                'sourceRel': rel,
                'sourceDisk': str(disk_path),
                'destRel': path_map[rel],
                'type': get_asset_type(rel),
            }
        )

    return {
        'item': item_node,
        'namespace': namespace,
        'prefix': prefix,
        'mode': mode,
        'files': files,
        'pathMap': path_map,
        'idMap': id_map,
        'replacementsExact': replacements,
    }


def _write_clone_assets(plan: Dict, clone_root: Path) -> None:
    replacements = plan.get('replacementsExact', {})
    overrides = plan.get('overrides', {})
    for entry in plan['files']:
        src_disk = Path(entry['sourceDisk'])
        dst_rel = entry['destRel']
        dst_disk = clone_root / dst_rel
        dst_disk.parent.mkdir(parents=True, exist_ok=True)

        # Only rewrite JSON; everything else is intentionally not cloned by default.
        if dst_disk.suffix.lower() == '.json':
            source_rel = entry.get('sourceRel')
            if source_rel and source_rel in overrides:
                data = overrides[source_rel]
            else:
                try:
                    data = json.loads(_read_text(src_disk))
                except Exception:
                    # fallback: copy as text
                    shutil.copyfile(src_disk, dst_disk)
                    continue

            rewritten = _rewrite_json_strings_exact(data, replacements)
            _write_text(dst_disk, json.dumps(rewritten, indent=2, ensure_ascii=False))
        else:
            shutil.copyfile(src_disk, dst_disk)


def _export_subgraph_json(subG: nx.DiGraph, json_file: Path) -> None:
    json_file.parent.mkdir(parents=True, exist_ok=True)

    nodes = []
    for node, data in subG.nodes(data=True):
        nodes.append(
            {
                'id': node,
                'label': data.get('label') or Path(node).name,
                'type': data.get('type') or get_asset_type(node),
                'path': node,
            }
        )

    edges = []
    for source, target, data in subG.edges(data=True):
        edge = {'source': source, 'target': target}
        if isinstance(data, dict) and data.get('label'):
            edge['label'] = data['label']
        edges.append(edge)

    payload = {
        'nodeCount': len(nodes),
        'edgeCount': len(edges),
        'nodes': nodes,
        'edges': edges,
    }
    json_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding='utf-8')


def _audit_unresolved_refs(
    roots: Sequence[Path],
    G: nx.DiGraph,
    subgraph_nodes: Set[str],
    limit: int,
) -> Dict[str, List[str]]:
    """Retourne un mapping relpath -> liste des refs non résolues (brutes)"""
    all_nodes_set: Set[str] = set(G.nodes())
    stem_to_paths = {Path(n).stem.lower(): n for n in G.nodes()}

    unresolved_by_source: Dict[str, List[str]] = {}
    for rel in sorted(subgraph_nodes):
        if not rel.lower().endswith('.json'):
            continue
        disk_path = _resolve_disk_path(roots, rel)
        if not disk_path:
            continue

        try:
            data = json.loads(_read_text(disk_path))
        except Exception:
            continue

        refs = find_asset_refs(data)
        unresolved: List[str] = []
        for ref in refs:
            ref = ref.strip()
            resolved_path = normalize_ref(ref, rel, all_nodes_set)
            if resolved_path:
                continue

            if '/' not in ref:
                # tentative par stem
                if ref.lower() in stem_to_paths:
                    continue

            unresolved.append(ref)

        if unresolved:
            unresolved_by_source[rel] = unresolved

    if not unresolved_by_source:
        return {}

    # Réduit pour l'affichage: top refs globales
    all_unresolved = [r for refs in unresolved_by_source.values() for r in refs]
    counts = Counter(all_unresolved)
    print('\n=== AUDIT: refs non résolues (top) ===')
    for ref, count in counts.most_common(max(1, limit)):
        print(f'- {ref} : {count}')
    print('====================================')

    return unresolved_by_source

def _default_roots(repo_root: Path) -> List[Path]:
    return [
        repo_root / 'Assets',
        repo_root / 'src' / 'main' / 'resources',
        repo_root / 'plugin-poison' / 'src' / 'main' / 'resources',
        repo_root / 'plugin-qualitybench' / 'src' / 'main' / 'resources',
        repo_root / 'plugin-harmony' / 'src' / 'main' / 'resources',
    ]

def _parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Explore les dépendances d\'assets Hytale (graph) à partir d\'un item.'
    )
    parser.add_argument(
        '--repo-root',
        default=str(Path(__file__).resolve().parents[2]),
        help='Racine du repo (par défaut: déduite depuis tools/).',
    )
    parser.add_argument(
        '--root',
        action='append',
        default=None,
        help='Ajoute une racine d\'assets (peut être répétée). Ex: --root Assets --root plugin-poison/src/main/resources',
    )
    parser.add_argument(
        '--pickle',
        default=None,
        help='Chemin du cache gpickle (par défaut: tools/graph_assets/.cache/hytale_graph.gpickle).',
    )
    parser.add_argument(
        '--rebuild',
        action='store_true',
        help='Ignore le cache et reconstruit le graphe.',
    )
    parser.add_argument(
        '--item',
        default=None,
        help='Item à explorer (stem ou chemin rel). Si absent, prompt interactif.',
    )
    parser.add_argument(
        '--depth',
        type=int,
        default=None,
        help='Profondeur max (descendants). Ex: 3. Par défaut: illimité.',
    )
    parser.add_argument(
        '--out-dir',
        default=str(Path(__file__).resolve().parent / 'out'),
        help='Dossier de sortie HTML.',
    )
    parser.add_argument(
        '--export-json',
        default=None,
        help='Exporte le sous-graphe en JSON (chemin). Par défaut: <out-dir>/hytale_<item>_graph.json',
    )
    parser.add_argument(
        '--audit',
        action='store_true',
        help='Audit: affiche les refs non résolues dans le sous-graphe (utile pour debug).',
    )
    parser.add_argument(
        '--audit-limit',
        type=int,
        default=50,
        help='Nombre max de refs affichées dans l\'audit (top occurrences).',
    )
    parser.add_argument(
        '--audit-out',
        default=None,
        help='Écrit l\'audit JSON (mapping fichier -> refs non résolues). Par défaut: <out-dir>/hytale_<item>_audit.json',
    )

    parser.add_argument(
        '--clone-plan',
        action='store_true',
        help='Génère un plan de clonage (mapping IDs/paths + liste des JSON à copier) pour créer une variante sans override vanilla.',
    )
    parser.add_argument(
        '--clone-namespace',
        default='FineCraft',
        help='Namespace inséré dans les paths clonés (ex: FineCraft).',
    )
    parser.add_argument(
        '--clone-prefix',
        default='FineCraft_Clone_',
        help='Préfixe ajouté aux stems clonés (ex: FineCraft_Clone_).',
    )
    parser.add_argument(
        '--clone-mode',
        choices=['minimal', 'behavior', 'full-json'],
        default='behavior',
        help='Quels fichiers JSON cloner: minimal=item seul, behavior=item+behaviour JSON, full-json=tous les JSON du sous-graphe.',
    )
    parser.add_argument(
        '--clone-out',
        default=None,
        help='Chemin du plan JSON (par défaut: <out-dir>/hytale_<item>_clone_plan.json).',
    )
    parser.add_argument(
        '--clone-write',
        action='store_true',
        help='Écrit réellement les assets clonés sur disque (ATTENTION: crée des fichiers).',
    )
    parser.add_argument(
        '--clone-root',
        default=None,
        help='Racine où écrire les assets clonés (ex: plugin-poison/src/main/resources). Requis si --clone-write.',
    )
    parser.add_argument(
        '--clone-from',
        default=None,
        help='Applique un clone plan existant (JSON). Utile si tu as édité le plan pour exclure certains fichiers.',
    )
    return parser.parse_args(argv)

def main(argv: Optional[Sequence[str]] = None) -> int:
    args = _parse_args(argv)
    repo_root = Path(args.repo_root).resolve()

    # Fast path: apply an existing clone plan (optionally edited) without rebuilding any graph.
    if args.clone_from:
        if not args.clone_write:
            print('Erreur: --clone-from requiert --clone-write')
            return 2
        if not args.clone_root:
            print('Erreur: --clone-root est requis avec --clone-write')
            return 2

        plan_path = Path(args.clone_from)
        if not plan_path.is_absolute():
            plan_path = repo_root / plan_path
        if not plan_path.exists():
            print(f'Erreur: clone plan introuvable: {plan_path}')
            return 2

        try:
            plan = json.loads(_read_text(plan_path))
        except Exception as e:
            print(f'Erreur: clone plan illisible: {plan_path} ({e})')
            return 2

        clone_root = Path(args.clone_root)
        if not clone_root.is_absolute():
            clone_root = repo_root / clone_root
        _write_clone_assets(plan, clone_root=clone_root)
        print(f'Clone written under: {clone_root.resolve()}')
        return 0

    if args.root:
        roots = [Path(r) for r in args.root]
        roots = [r if r.is_absolute() else (repo_root / r) for r in roots]
    else:
        roots = _default_roots(repo_root)

    roots = [r for r in roots if r.exists() and r.is_dir()]
    if not roots:
        print('Aucune racine valide. Utilise --root ou vérifie --repo-root.')
        return 2

    pickle_path = (
        Path(args.pickle)
        if args.pickle
        else (Path(__file__).resolve().parent / '.cache' / 'hytale_graph.gpickle')
    )
    pickle_path.parent.mkdir(parents=True, exist_ok=True)

    if pickle_path.exists() and not args.rebuild:
        print(f'Chargement du graphe (cache): {pickle_path}')
        with pickle_path.open('rb') as f:
            G = pickle.load(f)
        print('Graphe chargé.')
        _retag_nodes_in_place(G)
    else:
        print('Construction du graphe...')
        G, _all_files = build_graph(roots)
        print(f'Sauvegarde du graphe (cache): {pickle_path}')
        with pickle_path.open('wb') as f:
            pickle.dump(G, f, protocol=pickle.HIGHEST_PROTOCOL)

    types_count = Counter(d.get('type', 'other') for _, d in G.nodes(data=True))
    print('\n=== TYPES DE NŒUDS ===')
    for t, count in sorted(types_count.items(), key=lambda x: x[1], reverse=True):
        print(f'{t:15} : {count:6d}')
    print('=====================\n')

    items = [n for n, d in G.nodes(data=True) if d.get('type') == 'item']
    print(f'Items détectés : {len(items)}')
    if not items:
        print('Impossible de continuer : aucun item trouvé (vérifie get_asset_type()).')
        return 2

    item_query = args.item
    if not item_query:
        print("Entrez le nom (stem) d'un item (ex: sword, apple, iron_sword) :")
        item_query = input('> ').strip()

    item_node = _resolve_item_node(G, item_query)
    if not item_node:
        print(f'Item non trouvé: {item_query}')
        print('Exemples (premiers 12 items):')
        for p in sorted(items)[:12]:
            print(f'  - {p}')
        return 2

    descendants = _depth_limited_descendants(G, item_node, args.depth)
    subgraph_nodes = descendants | {item_node}
    subG = G.subgraph(subgraph_nodes).copy()

    out_dir = Path(args.out_dir)
    html_file = out_dir / f'hytale_{Path(item_node).stem}_graph.html'
    _render_html(subG, html_file)

    if args.export_json:
        export_json_path = Path(args.export_json)
        if not export_json_path.is_absolute():
            export_json_path = repo_root / export_json_path
    else:
        export_json_path = out_dir / f'hytale_{Path(item_node).stem}_graph.json'
    _export_subgraph_json(subG, export_json_path)

    if args.audit:
        unresolved_by_source = _audit_unresolved_refs(
            roots=roots,
            G=G,
            subgraph_nodes=subgraph_nodes,
            limit=args.audit_limit,
        )
        if unresolved_by_source:
            if args.audit_out:
                audit_path = Path(args.audit_out)
                if not audit_path.is_absolute():
                    audit_path = repo_root / audit_path
            else:
                audit_path = out_dir / f'hytale_{Path(item_node).stem}_audit.json'
            audit_path.parent.mkdir(parents=True, exist_ok=True)
            audit_path.write_text(
                json.dumps(unresolved_by_source, indent=2, ensure_ascii=False),
                encoding='utf-8',
            )

    if args.clone_plan:
        plan = _make_clone_plan(
            roots=roots,
            subgraph_nodes=subgraph_nodes,
            item_node=item_node,
            namespace=args.clone_namespace,
            prefix=args.clone_prefix,
            mode=args.clone_mode,
        )

        if args.clone_out:
            plan_path = Path(args.clone_out)
            if not plan_path.is_absolute():
                plan_path = repo_root / plan_path
        else:
            plan_path = out_dir / f'hytale_{Path(item_node).stem}_clone_plan.json'
        _write_text(plan_path, json.dumps(plan, indent=2, ensure_ascii=False))
        print(f'Clone plan: {plan_path.resolve()}')

        if args.clone_write:
            if not args.clone_root:
                print('Erreur: --clone-root est requis avec --clone-write')
                return 2
            clone_root = Path(args.clone_root)
            if not clone_root.is_absolute():
                clone_root = repo_root / clone_root
            _write_clone_assets(plan, clone_root=clone_root)
            print(f'Clone written under: {clone_root.resolve()}')

    print('\nGraphe généré → ouvre ce fichier dans ton navigateur :')
    print(f'  → {html_file.resolve()}')
    print(f'Nœuds: {len(subgraph_nodes)} | Arêtes: {subG.number_of_edges()} | Depth: {args.depth}')
    print(f'Export JSON: {export_json_path.resolve()}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())