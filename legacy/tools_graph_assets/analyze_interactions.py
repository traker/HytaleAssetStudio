import os
import json
from collections import defaultdict
from pathlib import Path

interactions_dir = Path(r"K:\\projet\\java\\TestPluginHytale\\Assets\\Server\\Item\\Interactions")

types_data = defaultdict(lambda: {"count": 0, "keys": defaultdict(int), "next_types": defaultdict(int), "failed_types": defaultdict(int), "interactions_types": defaultdict(int)})
missing_type_count = 0

def analyze_node(data):
    global missing_type_count
    if not isinstance(data, dict):
        return
    
    t = data.get("Type")
    if not t:
        missing_type_count += 1
        t = "UNKNOWN_OR_ROOT_LIST"
        if "Interactions" in data:
            t = "Parallel/RootList"
            
    stats = types_data[t]
    stats["count"] += 1
    
    for k, v in data.items():
        stats["keys"][k] += 1
        
        if k == "Next":
            stats["next_types"][type(v).__name__] += 1
            if isinstance(v, dict) and "Type" in v:
                 analyze_node(v)
            elif isinstance(v, dict):
                 for key, val in v.items():
                     if isinstance(val, dict):
                         analyze_node(val)
                     elif isinstance(val, list):
                         for x in val:
                             if isinstance(x, dict): analyze_node(x)
            elif isinstance(v, list):
                 for x in v:
                     if isinstance(x, dict): analyze_node(x)
        elif k == "Failed":
            stats["failed_types"][type(v).__name__] += 1
            if isinstance(v, dict) and "Type" in v:
                 analyze_node(v)
            elif isinstance(v, dict):
                 for key, val in v.items():
                     if isinstance(val, dict):
                         analyze_node(val)
                     elif isinstance(val, list):
                         for x in val:
                             if isinstance(x, dict): analyze_node(x)
            elif isinstance(v, list):
                 for x in v:
                     if isinstance(x, dict): analyze_node(x)
        elif k == "Interactions":
            stats["interactions_types"][type(v).__name__] += 1
            if isinstance(v, list):
                 for x in v:
                     if isinstance(x, dict): analyze_node(x)

def analyze_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            if isinstance(data, list):
                for item in data:
                     analyze_node(item)
            elif isinstance(data, dict):
                analyze_node(data)
    except Exception as e:
        print(f"Error parsing {filepath}: {e}")

if __name__ == "__main__":
    count = 0
    for root, dirs, files in os.walk(interactions_dir):
        for file in files:
            if file.endswith(".json"):
                analyze_file(os.path.join(root, file))
                count += 1
                
    print(f"Investigated {count} files.")
    
    # Generate markdown report
    report_path = Path(r"K:\projet\java\TestPluginHytale\tools\graph_assets\INTERACTIONS_REPORT.md")
    with report_path.open("w", encoding="utf-8") as f:
        f.write("# Vanilla Interactions Analysis Report\n\n")
        
        sorted_types = sorted(types_data.items(), key=lambda x: x[1]["count"], reverse=True)
        
        for t, stats in sorted_types:
            f.write(f"## Type: `{t}` (Found {stats['count']} times)\n")
            
            f.write("### Keys:\n")
            for k, c in sorted(stats["keys"].items(), key=lambda x: x[1], reverse=True):
                f.write(f"- `{k}` : {c} times\n")
                
            if stats["next_types"]:
                f.write("\n### `Next` Structure Types:\n")
                for k, c in stats["next_types"].items():
                    f.write(f"- `{k}` : {c} times\n")
                    
            if stats["failed_types"]:
                f.write("\n### `Failed` Structure Types:\n")
                for k, c in stats["failed_types"].items():
                    f.write(f"- `{k}` : {c} times\n")
                    
            if stats["interactions_types"]:
                f.write("\n### `Interactions` Structure Types:\n")
                for k, c in stats["interactions_types"].items():
                    f.write(f"- `{k}` : {c} times\n")
                    
            f.write("\n---\n")

    print(f"Report written to {report_path}")
