const fs = require('fs');

let code = fs.readFileSync('src/InteractionEditor.tsx', 'utf8');

const saveBtnHtml = `<button
                    onClick={onClose}
                    style={{ marginBottom: '10px', padding: '5px 10px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
              >
                ← Retour au graphe global
              </button>`;

const replacementSaveBtn = `<button
                    onClick={onClose}
                    style={{ marginBottom: '10px', marginRight: '10px', padding: '5px 10px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
              >
                ← Retour
              </button>
              <button
                    onClick={handleSaveTree}
                    style={{ marginBottom: '10px', padding: '5px 10px', background: '#005a9e', color: '#fff', border: '1px solid #0078d4', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                💾 Sauvegarder
              </button>`;

code = code.replace(saveBtnHtml, replacementSaveBtn);

const handleSaveTreeDef = `
  const handleSaveTree = () => {
    const buildNode = (nodeId: string): any => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return null;
      if (node.data.isExternal) return node.data.label;

      if (node.data.type === 'List') {
        const outEdges = edges.filter(e => e.source === nodeId).sort((a,b) => a.label.localeCompare(b.label));
        return outEdges.map(e => buildNode(e.target));
      }

      let result: any = { Type: node.data.type, ...(node.data.rawFields || {}) };
      if (node.data.type === 'Root (List)') {
         delete result.Type;
      }

      const outEdges = edges.filter(e => e.source === nodeId);
      
      const arrayGroups: Record<string, {idx: number, e: any}[]> = {};
      const dictGroups: Record<string, Record<string, any>> = {};
      const directKeys: Record<string, any> = {};

      outEdges.forEach(e => {
         const label = e.label || "";
         const arrayMatch = label.match(/^([^\\[\\{]+)\\[(\\d+)\\]$/);
         const dictMatch = label.match(/^([^\\[\\{]+)\\{([^}]+)\\}$/);

         if (arrayMatch) {
            const keyName = arrayMatch[1];
            if (!arrayGroups[keyName]) arrayGroups[keyName] = [];
            arrayGroups[keyName].push({ idx: parseInt(arrayMatch[2], 10), e });
         } else if (dictMatch) {
            const keyName = dictMatch[1];
            const dictKey = dictMatch[2];
            if (!dictGroups[keyName]) dictGroups[keyName] = {};
            dictGroups[keyName][dictKey] = e;
         } else {
            directKeys[label] = e;
         }
      });

      for (const [key, edgeList] of Object.entries(arrayGroups)) {
          edgeList.sort((a, b) => a.idx - b.idx);
          result[key] = edgeList.map(item => buildNode(item.e.target));
      }

      for (const [key, edgeMap] of Object.entries(dictGroups)) {
          result[key] = {};
          for (const [dictKey, e] of Object.entries(edgeMap)) {
               result[key][dictKey] = buildNode((e as any).target);
          }
      }

      for (const [key, e] of Object.entries(directKeys)) {
          result[key] = buildNode((e as any).target);
      }

      return result;
    };

    const payload = buildNode("root");
    fetch('http://127.0.0.1:5000/api/save_node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rootId, content: payload })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('✅ Graph saved successfully!');
      } else {
        alert('❌ Error: ' + data.error);
      }
    })
    .catch(err => alert("Server error: " + err));
  };
`;

code = code.replace("const handleMenuAction = (type: string) => {", handleSaveTreeDef + "\n\n  const handleMenuAction = (type: string) => {");

fs.writeFileSync('src/InteractionEditor.tsx', code);
