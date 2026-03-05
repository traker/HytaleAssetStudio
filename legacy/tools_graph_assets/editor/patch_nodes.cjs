const fs = require('fs');
let code = fs.readFileSync('src/InteractionEditor.tsx', 'utf8');

const replacement = `contentSummary: ["Nouveau nœud"],
          rawFields: {},
          onUpdateFields: (nodeId: string, newFields: any) => {
             setNodes(nds => nds.map(node => {
                 if (node.id === nodeId) {
                     return { ...node, data: { ...node.data, rawFields: newFields } };
                 }
                 return node;
             }));
          },
          onDelete:`;

code = code.split('contentSummary: ["Nouveau nœud"],\n          onDelete:').join(replacement);

fs.writeFileSync('src/InteractionEditor.tsx', code);
