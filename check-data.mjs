import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const sandbox={window:{}};
vm.runInNewContext(await fs.readFile('dist/data.js','utf8'),sandbox);
const {nodes,edges,stats}=sandbox.window.ATLAS_DATA;
assert.equal(nodes.length,stats.nodes);
const seen=new Set();const codes=new Set();
for(const n of nodes){
 const key=n.p.length?[...n.p].sort().join('|'):`missing-${n.number}`;
 assert.ok(!seen.has(key),`Duplicate P combination: ${key}`);seen.add(key);
 assert.ok(n.prompt.trim());assert.ok(!n.parameters.some(p=>/^--(?:profile|p)(?:\s|$)/.test(p)));
 n.p.forEach(p=>codes.add(p));
 for(const kind of ['images','thumbs'])await fs.access(`dist/assets/${kind}/${n.imageId}.webp`);
}
assert.equal(codes.size,stats.profiles);
for(const [a,b] of edges)assert.ok(nodes[a].p.some(p=>nodes[b].p.includes(p)),'Invalid P relationship');
console.log(JSON.stringify({nodes:nodes.length,distinctP:codes.size,validRelations:edges.length,localImages:nodes.length,duplicates:stats.duplicates,allAssetsPresent:true}));
