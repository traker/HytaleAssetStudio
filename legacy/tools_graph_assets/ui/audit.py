import os
import json
from collections import defaultdict

path_interactions = r"k:\projet\java\TestPluginHytale\Assets\Server\Item\Interactions"
path_root = r"k:\projet\java\TestPluginHytale\Assets\Server\Item\RootInteractions"
types = defaultdict(set)

def scan(p):
    for root, dirs, files in os.walk(p):
        for f in files:
            if f.endswith('.json'):
                try:
                    with open(os.path.join(root, f), 'r', encoding='utf-8') as file:
                        data = json.load(file)
                        # Root interactions usually don't have a type but a list of Interactions
                        if isinstance(data, dict):
                            if 'Type' in data:
                                types[data['Type']].update(data.keys())
                            if 'Next' in data and isinstance(data['Next'], dict) and 'Type' in data['Next']:
                                types[data['Next']['Type']].update(data['Next'].keys())
                            # Also check if it's an array somewhere? Too complex for a simple script, we'll just check the root level and simple dicts.
                except Exception as e:
                    pass

scan(path_interactions)
scan(path_root)

for t, keys in types.items():
    print(f"Type: {t}")
    print(f"Keys: {list(keys)}")
    print("---")
