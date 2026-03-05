import os
import json
from pathlib import Path

# Extract names of all interaction configurations available in the game
def get_all_interaction_names(roots):
    names = []
    # Search specific folders for interactions
    for r in roots:
        target1 = r / "Server/Item/Interactions"
        target2 = r / "Server/Item/RootInteractions"
        
        for tgt in [target1, target2]:
            if tgt.exists():
                for root, dirs, files in os.walk(tgt):
                    for f in files:
                        if f.endswith('.json'):
                            # The interaction name referenced in Next is usually the file name without extension
                            names.append(f[:-5])
    return sorted(list(set(names)))


def build_interaction_schema(base_schema, all_names):
    """
    Enhances the generic schema with specific ENUMS and structural rules 
    for Hytale Interactions.
    """
    
    # 0. Load the audit results to get dynamic properties per Type
    type_props_map = {}
    try:
        audit_path = Path(__file__).parent / 'audit_results.txt'
        if audit_path.exists():
            with open(audit_path, 'r', encoding='utf-8') as f:
                content = f.read().split('---')
                for block in content:
                    block = block.strip()
                    if not block: continue
                    lines = block.split('\n')
                    t_name = None
                    k_list = []
                    for line in lines:
                        if line.startswith('Type:'):
                            t_name = line.replace('Type:', '').strip()
                        elif line.startswith('Keys:'):
                            k_str = line.replace('Keys:', '').strip()
                            if k_str.startswith('[') and k_str.endswith(']'):
                                import ast
                                try:
                                    k_list = ast.literal_eval(k_str)
                                except:
                                    pass
                    if t_name and k_list:
                        type_props_map[t_name] = [k for k in k_list if k not in ('Type', 'Next', 'Failed', 'Interactions', '$Comment')]
    except Exception as e:
        print(f"Failed to load audit results: {e}")

    # Let's create an elegant schema using RJSF ANYOF definition for the 'Next' and 'Failed' fields.
    next_failed_schema = {
        "anyOf": [
            {
                "type": "string",
                "title": "Reference by Name",
                "enum": all_names
            },
            {
                "type": "object",
                "title": "Inline Interaction Object",
                "properties": {
                    "Type": {
                        "type": "string",
                        "enum": [
                            "Simple", "UseBlock", "Condition", "MovementCondition", 
                            "StatsCondition", "Serial", "EffectCondition", "ApplyEffect",
                            "Seating", "DestroyCondition", "Parallel", "Replace",
                            "BlockCondition", "ChangeState", "OpenContainer", 
                            "OpenProcessingBench", "MemoriesCondition", "PlacementCountCondition",
                            "PlaceBlock", "ContextualUseNPC", "ModifyInventory", 
                            "RefillContainer", "Charging", "StatsConditionWithModifier",
                            "Door", "Explode", "Selector", "LaunchProjectile", 
                            "ApplyForce", "Projectile", "Chaining", "SpawnPrefab",
                            "Wielding", "Repeat", "SpawnNPC", "BreakBlock", 
                            "ChangeBlock", "DamageEntity", "FirstClick", "OpenCustomUI",
                            "TeleportInstance", "UseEntity", "FertilizeSoil", "UseWateringCan",
                            "ClearEntityEffect", "ChangeStat", "RemoveEntity", "SpawnDeployableFromRaycast"
                        ]
                    }
                }
            }
        ]
    }
    
    # We alter the root properties if it's an interaction object
    if "properties" not in base_schema:
        base_schema["properties"] = {}
        
    props = base_schema["properties"]
    
    # 1. Provide an ENUM for the "Type" field to avoid typos
    if "Type" not in props:
        props["Type"] = {"type": "string"}
    
    props["Type"]["enum"] = next_failed_schema["anyOf"][1]["properties"]["Type"]["enum"]
    
    # 2. Assign the Next and Failed schema
    props["Next"] = next_failed_schema
    props["Failed"] = next_failed_schema
    
    # 3. For interactions that have a list of interactions (Chaining, Serial, Parallel)
    if "Interactions" not in props:
        props["Interactions"] = {
            "type": "array",
            "items": next_failed_schema
        }
        
    # 4. Inject Dynamic Dependencies based on Type
    if type_props_map:
        dependencies = {
            "Type": {
                "oneOf": []
            }
        }
        for t_name, keys in type_props_map.items():
            if not keys: 
                dependencies["Type"]["oneOf"].append({"properties": {"Type": {"enum": [t_name]}}})
                continue
            
            sub_props = {"Type": {"enum": [t_name]}}
            for k in keys:
                if k in props:
                    continue # Field already built from genson
                # Smart heuristic for missing fields
                if "Multiplier" in k or k in ("Duration", "Delay", "GroundCheckDelay", "Force", "RunTime", "StaminaCost"):
                    sub_props[k] = {"type": "number"}
                elif "Adjust" in k or "Cancel" in k or "Allow" in k or "Wait" in k or "Require" in k or "FailOn" in k:
                    sub_props[k] = {"type": "boolean"}
                elif k in ("Effects", "Keys", "Rules", "Changes", "Tags", "Matchers", "Forks"):
                    sub_props[k] = {"type": "array", "items": {"type": "object"}}
                else:
                    sub_props[k] = {"type": "string"}
            
            dependencies["Type"]["oneOf"].append({
                "properties": sub_props
            })
            
        base_schema["dependencies"] = dependencies

    return base_schema
