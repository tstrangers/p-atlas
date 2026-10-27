import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const sourceArg=process.argv.indexOf('--source');
if(sourceArg<0||!process.argv[sourceArg+1])throw new Error('Usage: node prepare.mjs --source <folder>');
const source=path.resolve(process.argv[sourceArg+1]);
const require=createRequire(import.meta.url);
const sharp=require('sharp');
const manifest=JSON.parse(await fs.readFile(path.join(source,'清单.json'),'utf8'));
const extracted=JSON.parse(await fs.readFile(path.join(source,'提取.json'),'utf8'));
const mode=process.argv.includes('--single')?'single':'combination';
const nodes=[], keys=new Map(), allCodes=new Set();
for(let i=0;i<manifest.length;i++) {
  const m=manifest[i], e=extracted[i];
  if(m.pageUrl!==e.url) throw new Error(`Image/prompt mismatch: ${i+1}`);
  const p=[...new Set(e.parameters.filter(x=>/^--(?:profile|p)\s/.test(x)).flatMap(x=>x.trim().split(/\s+/).slice(1)))].sort();
  p.forEach(x=>allCodes.add(x));
  const sets=mode==='single'&&p.length?p.map(x=>[x]):[p];
  for(const selected of sets) {
    const key=selected.join('|')||`unprofiled-${m.number}`;
    if(keys.has(key)) {nodes[keys.get(key)].duplicateCount++; continue;}
    keys.set(key,nodes.length);
    nodes.push({id:nodes.length,number:m.number,imageId:String(m.number).padStart(4,'0'),p:selected,sourceP:p,prompt:e.prompt,
      parameters:e.parameters.filter(x=>!/^--(?:profile|p)(?:\s|$)/.test(x)),width:m.width,height:m.height,
      duplicateCount:0});
  }
}
const profileMap=new Map();
nodes.forEach((n,i)=>n.p.forEach(p=>{if(!profileMap.has(p))profileMap.set(p,[]);profileMap.get(p).push(i)}));
const edges=[],edgeKeys=new Set();
for(const [p,ids] of profileMap) for(let i=0;i<ids.length;i++) for(let j=i+1;j<ids.length;j++) {
  const key=`${ids[i]}:${ids[j]}`;
  if(!edgeKeys.has(key)){edgeKeys.add(key); edges.push([ids[i],ids[j]])}
}
await fs.mkdir(path.join(root,'dist/assets/thumbs'),{recursive:true});
await fs.mkdir(path.join(root,'dist/assets/images'),{recursive:true});
const unique=[...new Set(nodes.map(n=>n.number))];
for(let offset=0;offset<unique.length;offset+=8) await Promise.all(unique.slice(offset,offset+8).map(async num=>{
  const m=manifest[num-1], id=String(num).padStart(4,'0'), src=path.join(source,m.image);
  await Promise.all([
    sharp(src).rotate().resize(160,160,{fit:'cover'}).webp({quality:76}).toFile(path.join(root,`dist/assets/thumbs/${id}.webp`)),
    sharp(src).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toFile(path.join(root,`dist/assets/images/${id}.webp`))
  ]);
}));
const data={nodes,edges,stats:{original:manifest.length,nodes:nodes.length,profiles:allCodes.size,duplicates:manifest.length-new Set(nodes.map(n=>n.number)).size,missing:nodes.filter(n=>!n.p.length).length,mode}};
await fs.writeFile(path.join(root,'dist/data.js'),`window.ATLAS_DATA=${JSON.stringify(data).replace(/</g,'\\u003c')};\n`);
console.log(JSON.stringify({stats:data.stats,edges:edges.length,images:unique.length}));
