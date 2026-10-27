(() => {
'use strict';
const $=id=>document.getElementById(id), data=window.ATLAS_DATA;
if(!data?.nodes?.length){$('empty').hidden=false;$('empty').querySelector('span').textContent='收藏数据暂时无法加载';return;}
const {nodes,edges,stats}=data, canvas=$('sky'),ctx=canvas.getContext('2d'),motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=motionPreference.matches;
const aura=window.AtlasAura?new window.AtlasAura($('aura')):null;
const background=window.AtlasShards?new window.AtlasShards($('shard-background')):null;
let sphereBackdropLayout='';
const colors={single:[174,216,236],multi:[177,161,240],none:[141,159,181]};
const profiles=new Map();nodes.forEach((n,i)=>{n.p.forEach(p=>{if(!profiles.has(p))profiles.set(p,[]);profiles.get(p).push(i)});n.search=[n.prompt,n.number,n.imageId,...n.p].join(' ').toLowerCase();n.color=n.p.length>1?colors.multi:n.p.length?colors.single:colors.none;});
const golden=Math.PI*(3-Math.sqrt(5));
const points=nodes.map((n,i)=>{const y=1-2*(i+.5)/nodes.length,r=Math.sqrt(1-y*y),a=golden*i;return{x:Math.cos(a)*r,y,z:Math.sin(a)*r};});
let width=0,height=0,dpr=1,angleY=.38,angleX=-.14,zoom=1,auto=!reduced,hover=-1,selected=-1,keyboardIndex=0,drag=null,moved=false,lastTime=0,query='',profileFilter='',visible=nodes.map((_,i)=>i),visibleSet=new Set(visible),projected=[],centerX=0,centerY=0,radius=0,frame=0;
let toastTimer, searchTimer, lastFocus=null, rotationResume=false, pointers=new Map(),pinchDistance=0,initialPinchZoom=1;
const auraTilt={x:0,y:0};
let auraAuto=auto;
let edgeFlowTime=0;
let focusTransition=null,selectionPulseStart=0;
const thumbCache=new Map(),heroIds=[0,1,2,3,4,8,10,14,19,24,30,45,58,70,92,108,135,170,204,241,277,300].filter(i=>i<nodes.length);
function thumb(i){if(!thumbCache.has(i)){const img=new Image();img.src=`assets/thumbs/${nodes[i].imageId}.webp`;thumbCache.set(i,img)}return thumbCache.get(i)}
heroIds.forEach(thumb);
$('node-count').textContent=stats.nodes;$('profile-count').textContent=stats.profiles;
$('dedup-note').textContent=stats.mode==='single'?'相同 P 值仅保留一个星点。':`来自 ${stats.original} 张收藏，已合并 ${stats.duplicates} 张重复 P 组合。`;
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2300)}
function setAuto(value,keepAura=false){auto=value&&selected<0;if(!keepAura){auraAuto=value;if(selected>=0)rotationResume=value}$('rotate').setAttribute('aria-pressed',String(auraAuto));$('rotate-icon').textContent=auraAuto?'Ⅱ':'▷';$('rotate-label').textContent=auraAuto?(selected>=0?'动态效果':'自动旋转'):(selected>=0?'继续动效':'继续旋转')}
setAuto(auto);
motionPreference.addEventListener('change',e=>{reduced=e.matches;if(reduced){setAuto(false);if(focusTransition){angleX=focusTransition.targetX;angleY=focusTransition.targetY;focusTransition=null}}});
function setZoom(value){zoom=Math.max(.65,Math.min(2.2,value));$('zoom-label').textContent=`${Math.round(zoom*100)}%`;$('zoom-in').disabled=zoom>=2.2;$('zoom-out').disabled=zoom<=.65}
function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
new ResizeObserver(resize).observe(canvas);resize();
function viewPoint(p){const cy=Math.cos(angleY),sy=Math.sin(angleY),cx=Math.cos(angleX),sx=Math.sin(angleX);const x=p.x*cy+p.z*sy,z0=-p.x*sy+p.z*cy;return{x,y:p.y*cx-z0*sx,z:p.y*sx+z0*cx}}
function project(p){const v=viewPoint(p),depth=3.7/(3.7-v.z);return{x:centerX+v.x*radius*depth,y:centerY+v.y*radius*depth,z:v.z,depth,vx:v.x,vy:v.y}}
function centerOnNode(i){const p=points[i],yaw=-Math.atan2(p.x,p.z),deltaY=Math.atan2(Math.sin(yaw-angleY),Math.cos(yaw-angleY)),targetX=Math.atan2(p.y,Math.hypot(p.x,p.z)),targetY=angleY+deltaY;
auraTilt.x=0;auraTilt.y=0;
if(reduced){angleX=targetX;angleY=targetY;focusTransition=null;return}
focusTransition={fromX:angleX,fromY:angleY,targetX,targetY,elapsed:0,duration:650+150*Math.min(1,Math.max(Math.abs(deltaY),Math.abs(targetX-angleX))/Math.PI)};
}
function rgba(c,a){return `rgba(${c[0]},${c[1]},${c[2]},${a})`}
function easeLayout(value,target,amount){return Math.abs(target-value)<.01?target:value+(target-value)*amount}
function glow(x,y,size,color,opacity){const g=ctx.createRadialGradient(x,y,0,x,y,size);g.addColorStop(0,rgba(color,opacity));g.addColorStop(.18,rgba(color,opacity*.3));g.addColorStop(1,rgba(color,0));ctx.fillStyle=g;ctx.fillRect(x-size,y-size,size*2,size*2)}
function drawRelationship(A,B,index,active){
const dx=B.x-A.x,dy=B.y-A.y;if(Math.hypot(dx,dy)<1)return;
const depth=Math.max(0,Math.min(1,(A.z+B.z+2)/4)),opacity=active?.52:.035+depth*.065;
ctx.save();ctx.lineCap='round';
const base=ctx.createLinearGradient(A.x,A.y,B.x,B.y);
base.addColorStop(0,rgba([126,224,235],opacity));base.addColorStop(.5,rgba([163,185,239],opacity));base.addColorStop(1,rgba([190,158,241],opacity));
ctx.strokeStyle=base;ctx.lineWidth=active?1.1:.65;ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke();
// Each shared-P link carries one tapered glow, with a stable offset and its own pace.
const phase=(edgeFlowTime/(3.6+index*.24)+index*.381966)%1,head=phase*1.40-.04,tail=head-.30,front=head+.045;
const start=Math.max(0,tail),end=Math.min(1,front);
if(end>start){
const strength=active?.96:.23+depth*.25,flow=ctx.createLinearGradient(A.x+dx*tail,A.y+dy*tail,A.x+dx*front,A.y+dy*front);
flow.addColorStop(0,rgba([112,219,233],0));flow.addColorStop(.28,rgba([126,224,235],strength*.18));flow.addColorStop(.65,rgba([179,165,244],strength*.68));flow.addColorStop(.84,rgba([222,236,255],strength));flow.addColorStop(1,rgba([168,221,243],0));
ctx.strokeStyle=flow;ctx.shadowColor=rgba([153,199,239],strength*.65);ctx.shadowBlur=active?11:7;
ctx.lineWidth=active?3.8:2.5;ctx.globalAlpha=.32;ctx.beginPath();ctx.moveTo(A.x+dx*start,A.y+dy*start);ctx.lineTo(A.x+dx*end,A.y+dy*end);ctx.stroke();
ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.lineWidth=active?1.65:1.05;ctx.stroke();
}
ctx.restore();
}
function draw(time){frame=requestAnimationFrame(draw);if(document.hidden)return;const frameInterval=(time-lastTime)||16,dt=Math.min(frameInterval,45);lastTime=time;
if(focusTransition){const f=focusTransition;f.elapsed=Math.min(f.duration,f.elapsed+dt);const t=f.elapsed/f.duration,ease=t*t*(3-2*t);angleX=f.fromX+(f.targetX-f.fromX)*ease;angleY=f.fromY+(f.targetY-f.fromY)*ease;if(t===1)focusTransition=null}
else if(auto&&!drag&&!pointers.size&&hover<0)angleY+=dt*.000035;
if(!reduced&&auraAuto)edgeFlowTime+=dt/1000;
ctx.clearRect(0,0,width,height);const mobile=width<700;
const layoutEase=reduced||radius===0?1:1-Math.exp(-dt/110);
// The canvas spans the page, so enlarged stars, smoke and backdrop can pass beneath the header.
// Keep the original default radius; only the drawable area grows, not the 100% sphere.
centerX=easeLayout(centerX,width*.5,layoutEase);centerY=easeLayout(centerY,height*.5,layoutEase);
const sphereHeight=Math.max(1,height-(mobile?78:98));
radius=easeLayout(radius,Math.min(sphereHeight*(mobile?.29:.355),width*(mobile?.375:.31))*zoom,layoutEase);
// A fully opaque disc sits behind the volume, outside its translucent aura container.
// Include the projected sphere silhouette (perspective increases its radius slightly).
const maskSize=radius*2.12,maskLayout=`${centerX}:${centerY}:${maskSize}`;
if(maskLayout!==sphereBackdropLayout){const mask=$('sphere-backdrop');mask.style.width=mask.style.height=maskSize+'px';mask.style.transform=`translate(${centerX-maskSize/2}px,${centerY-maskSize/2}px)`;sphereBackdropLayout=maskLayout}
background?.render({dt,frameInterval,running:!reduced&&auraAuto});
projected=points.map(project);
const focused=selected>=0?projected[selected]:null;
aura?.render({x:centerX,y:centerY,radius,dt,now:time,running:!reduced&&auraAuto,mobile,tiltX:auraTilt.y,tiltY:auraTilt.x,focusId:selected,focusReady:!!focused&&!focusTransition&&focused.z>.99&&Math.hypot(focused.vx,focused.vy)<.01,focusSource:focused?[focused.vx,-focused.vy,focused.z]:[0,0,1]});
edges.forEach(([a,b],index)=>{if(!visibleSet.has(a)||!visibleSet.has(b))return;drawRelationship(projected[a],projected[b],index,selected===a||selected===b||hover===a||hover===b)});
const sorted=nodes.map((n,i)=>({i,...projected[i]})).sort((a,b)=>a.z-b.z);
for(const p of sorted){const n=nodes[p.i],isVisible=visibleSet.has(p.i),isSelected=p.i===selected,active=isSelected||p.i===hover;
const pulse=isSelected?(reduced?.5:.5+.5*Math.cos((edgeFlowTime-selectionPulseStart)*Math.PI*2/1.6)):0;
const opacity=isSelected?.64+pulse*.32:isVisible?.23+(p.z+1)*.34:.04,r=isSelected?5.1+pulse*1.2:active?5.4:(n.p.length>1?2.7:2.1)*p.depth;
if((isVisible||isSelected)&&(p.z>-.1||active))glow(p.x,p.y,isSelected?30+pulse*13:active?26:11*p.depth,n.color,isSelected?.42+pulse*.30:active?.55:.19);
ctx.fillStyle=rgba(active?[238,227,210]:n.color,opacity);ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
if(active){if(isSelected){ctx.strokeStyle=rgba(n.color,.12+pulse*.20);ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,15+pulse*3,0,Math.PI*2);ctx.stroke()}ctx.strokeStyle=`rgba(221,205,177,${isSelected?.48+pulse*.38:.75})`;ctx.lineWidth=.8;ctx.beginPath();ctx.arc(p.x,p.y,isSelected?10+pulse:10,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#cfc0ab';ctx.font='10px Consolas,monospace';ctx.fillText('#'+n.imageId,p.x+(isSelected?23:15),p.y+4)}
}
if(!query&&!profileFilter){let shown=0;for(const i of heroIds){const p=projected[i];if(p.z<.27||selected===i||hover===i||shown>=7)continue;const img=thumb(i);if(!img.complete||!img.naturalWidth)continue;const s=mobile?22:30;ctx.save();ctx.globalAlpha=.42+p.z*.5;ctx.shadowColor='#000';ctx.shadowBlur=15;ctx.drawImage(img,p.x-s/2,p.y-s/2,s,s);ctx.shadowBlur=0;ctx.strokeStyle='rgba(195,217,233,.5)';ctx.lineWidth=.6;ctx.strokeRect(p.x-s/2-2,p.y-s/2-2,s+4,s+4);ctx.restore();shown++}}
}
requestAnimationFrame(draw);
function hit(x,y){let best=-1,dist=Infinity;for(const i of visible){const p=projected[i];if(!p)continue;const d=Math.hypot(p.x-x,p.y-y),limit=heroIds.includes(i)&&p.z>.27?21:13;if(d<limit&&d<dist){best=i;dist=d}}return best}
function hoverAt(x,y){hover=hit(x,y);canvas.style.cursor=hover>=0?'pointer':'grab';const card=$('hover-card');card.hidden=hover<0||width<700;if(hover<0)return;const n=nodes[hover];card.querySelector('img').src=`assets/thumbs/${n.imageId}.webp`;card.querySelector('span').textContent='#'+n.imageId+' · '+(n.p.length?`${n.p.length} P`:'未标注 P');card.querySelector('p').textContent=n.prompt;card.style.left=Math.max(8,Math.min(width-213,x+20))+'px';card.style.top=Math.max(8,Math.min(height-100,y+14))+'px'}
canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!drag&&width>=700){auraTilt.x=Math.max(-.16,Math.min(.16,(e.offsetX-centerX)/Math.max(radius,1)*.10));auraTilt.y=Math.max(-.12,Math.min(.12,(e.offsetY-centerY)/Math.max(radius,1)*.08))}});
canvas.addEventListener('pointerleave',()=>{auraTilt.x=0;auraTilt.y=0});
canvas.addEventListener('pointerdown',e=>{focusTransition=null;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.offsetX,y:e.offsetY});if(pointers.size===2){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);initialPinchZoom=zoom;moved=true;drag=null;return}drag={x:e.offsetX,y:e.offsetY};moved=false;$('hover-card').hidden=true});
canvas.addEventListener('pointermove',e=>{if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.offsetX,y:e.offsetY});if(pointers.size===2){const p=[...pointers.values()];setZoom(initialPinchZoom*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/Math.max(1,pinchDistance));return}if(drag){const dx=e.offsetX-drag.x,dy=e.offsetY-drag.y;if(Math.abs(dx)+Math.abs(dy)>2)moved=true;angleY+=dx*.005;angleX=Math.max(-Math.PI/2+.01,Math.min(Math.PI/2-.01,angleX+dy*.005));drag={x:e.offsetX,y:e.offsetY};hover=-1}else if(e.pointerType!=='touch')hoverAt(e.offsetX,e.offsetY)});
canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);drag=null;hover=-1;$('hover-card').hidden=true});
canvas.addEventListener('click',e=>{if(moved)return;const i=hit(e.offsetX,e.offsetY);if(i>=0)openDetail(i)});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);drag=null;hover=-1});canvas.addEventListener('pointerleave',()=>{if(!drag){hover=-1;$('hover-card').hidden=true}});
canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.001))},{passive:false});
$('rotate').onclick=()=>setAuto(!auraAuto);$('zoom-in').onclick=()=>setZoom(zoom+.15);$('zoom-out').onclick=()=>setZoom(zoom-.15);$('reset-view').onclick=()=>{focusTransition=null;setZoom(1);if(selected>=0)centerOnNode(selected);else{angleY=.38;angleX=-.14}setAuto(!reduced)};
function updateFilter(){const q=query.toLowerCase().trim();visible=nodes.map((_,i)=>i).filter(i=>(!profileFilter||nodes[i].p.includes(profileFilter))&&(!q||nodes[i].search.includes(q)));visibleSet=new Set(visible);$('visible-count').textContent=`${visible.length} / ${nodes.length} STARS`;$('empty').hidden=visible.length>0;$('filter-banner').hidden=!profileFilter;$('filter-label').textContent=`P ${profileFilter} · ${visible.length} 个星点`;keyboardIndex=0}
function makeResult(i){const n=nodes[i],b=document.createElement('button');b.className='search-result';b.type='button';const image=document.createElement('img');image.src=`assets/thumbs/${n.imageId}.webp`;image.alt='';image.loading='lazy';const div=document.createElement('div'),strong=document.createElement('strong'),p=document.createElement('p');strong.textContent='#'+n.imageId+' · '+(n.p.join(' / ')||'未标注 P');p.textContent=n.prompt;div.append(strong,p);b.append(image,div);b.onclick=()=>{openDetail(i);$('search-results').hidden=true;$('search').setAttribute('aria-expanded','false')};return b}
function searchResults(){const results=$('search-results');results.replaceChildren();results.hidden=!query.trim();$('search').setAttribute('aria-expanded',String(!results.hidden));if(results.hidden)return;const summary=document.createElement('div');summary.className='search-summary';summary.textContent=visible.length?`${visible.length} 个结果${visible.length>40?' · 显示前 40 个，其余已在星图中点亮':''}`:'没有匹配结果';results.append(summary);visible.slice(0,40).forEach(i=>results.append(makeResult(i)))}
$('search').addEventListener('input',e=>{clearTimeout(searchTimer);query=e.target.value;updateFilter();searchResults()});$('search').addEventListener('focus',searchResults);$('search').addEventListener('keydown',e=>{if(e.key==='Enter'&&visible.length){e.preventDefault();openDetail(visible[0]);$('search-results').hidden=true;$('search').setAttribute('aria-expanded','false')}if(e.key==='ArrowDown'){$('search-results').querySelector('button')?.focus();e.preventDefault()}if(e.key==='Escape'){$('search-results').hidden=true;$('search').setAttribute('aria-expanded','false');$('search').blur()}});
document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap')){$('search-results').hidden=true;$('search').setAttribute('aria-expanded','false')}});
function clearFilter(){profileFilter='';query='';$('search').value='';updateFilter();searchResults()}
$('clear-filter').onclick=clearFilter;$('reset-search').onclick=clearFilter;
function openDetail(i){if(i<0||!nodes[i])return;if(selected<0){lastFocus=document.activeElement;rotationResume=auraAuto}if(selected!==i)selectionPulseStart=edgeFlowTime;selected=i;setAuto(false,true);centerOnNode(i);hover=-1;const n=nodes[i];$('hover-card').hidden=true;$('detail').hidden=false;$('app').classList.add('detail-open');$('detail-number').textContent='COLLECTION / '+n.imageId;$('detail-image').src=`assets/images/${n.imageId}.webp`;$('detail-image').alt=n.prompt;$('image-link').querySelector('.image-error').hidden=true;$('detail-image').onerror=()=>{$('image-link').querySelector('.image-error').hidden=false};$('prompt').textContent=n.prompt;$('p-values').replaceChildren();
for(const p of n.p){const chip=document.createElement('button');chip.className='p-chip';chip.textContent=p;chip.title=`在星图中查看使用 ${p} 的图片`;const count=profiles.get(p).length;if(count>1){const countEl=document.createElement('span');countEl.textContent=count;chip.append(countEl)}chip.onclick=()=>{profileFilter=p;query='';$('search').value='';updateFilter();closeDetail();toast('已点亮使用该 P 值的星点')};$('p-values').append(chip)}
if(!n.p.length){const note=document.createElement('span');note.className='small-note';note.textContent='原页面未标注 P 值';$('p-values').append(note)}
$('copy-p').disabled=!n.p.length;$('p-help').textContent=n.p.length?'点击 P 值，查看关联星点。':'';
$('parameters').replaceChildren();for(const p of n.parameters){const code=document.createElement('code');code.textContent=p;$('parameters').append(code)}if(!n.parameters.length){const note=document.createElement('p');note.className='small-note';note.textContent='原页面未标注其他参数';$('parameters').append(note)}$('parameter-count').textContent=String(n.parameters.length);
const related=[...new Set(n.p.flatMap(p=>profiles.get(p)))].filter(j=>j!==i);$('related-section').hidden=!related.length;$('related-count').textContent=related.length+' 个';$('related').replaceChildren();for(const j of related){const b=document.createElement('button'),im=document.createElement('img');im.src=`assets/thumbs/${nodes[j].imageId}.webp`;im.alt=`查看收藏 ${nodes[j].imageId}`;im.loading='lazy';b.title='#'+nodes[j].imageId;b.append(im);b.onclick=()=>openDetail(j);$('related').append(b)}
$('image-size').textContent=`${n.width} × ${n.height}`;$('detail-scroll').scrollTop=0;$('a11y-status').textContent=`已打开图片 ${n.imageId}，${n.p.length} 个 P 值`;$('detail').focus({preventScroll:true});
}
const preview=$('image-preview');
let previewBackdrop=false;
function openPreview(){if(selected<0)return;const n=nodes[selected],image=$('preview-image');$('preview-title').textContent='COLLECTION / '+n.imageId+' · '+(n.width&&n.height?`${n.width} × ${n.height}`:'大图预览');$('preview-error').hidden=true;image.hidden=false;image.alt=n.prompt;image.onload=()=>{$('preview-error').hidden=true};image.onerror=()=>{image.hidden=true;$('preview-error').hidden=false};image.src=`assets/images/${n.imageId}.webp`;preview.showModal()}
function closePreview(){if(preview.open)preview.close()}
$('image-link').onclick=openPreview;$('close-preview').onclick=closePreview;
preview.addEventListener('pointerdown',e=>{previewBackdrop=e.target===preview||e.target.classList.contains('preview-stage')});
preview.addEventListener('click',e=>{if(previewBackdrop&&(e.target===preview||e.target.classList.contains('preview-stage')))closePreview();previewBackdrop=false});
preview.addEventListener('cancel',e=>{e.preventDefault();closePreview()});
preview.addEventListener('close',()=>{if(selected>=0&&!$('detail').hidden)$('image-link').focus({preventScroll:true})});
function closeDetail(){closePreview();focusTransition=null;selected=-1;$('detail').hidden=true;$('app').classList.remove('detail-open');setAuto(rotationResume&&!reduced);if(lastFocus&&document.contains(lastFocus))lastFocus.focus({preventScroll:true});else canvas.focus({preventScroll:true})}
$('close-detail').onclick=closeDetail;function adjacent(delta){const list=visible.length?visible:nodes.map((_,i)=>i),index=list.indexOf(selected);openDetail(list[(Math.max(0,index)+delta+list.length)%list.length])}$('previous').onclick=()=>adjacent(-1);$('next').onclick=()=>adjacent(1);
async function copy(text){try{await navigator.clipboard.writeText(text);toast('已复制到剪贴板')}catch{const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0;left:0;top:0';document.body.append(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch{}ta.remove();toast(ok?'已复制到剪贴板':'复制失败，请选中文本手动复制')}}
$('copy-p').onclick=()=>selected>=0&&copy('--p '+nodes[selected].p.join(' '));$('copy-prompt').onclick=()=>selected>=0&&copy(nodes[selected].prompt);
canvas.addEventListener('keydown',e=>{if(!visible.length)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();focusTransition=null;setAuto(false,true);keyboardIndex=(keyboardIndex+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+visible.length)%visible.length;hover=visible[keyboardIndex];const n=nodes[hover];$('a11y-status').textContent=`图片 ${n.imageId}：${n.prompt.slice(0,110)}。按 Enter 查看`;const p=points[hover];angleY=-Math.atan2(p.x,p.z);angleX=Math.atan2(p.y,Math.sqrt(p.x*p.x+p.z*p.z));}if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetail(hover>=0?hover:visible[keyboardIndex])}});
document.addEventListener('keydown',e=>{if(preview.open){if(e.key==='Escape'){e.preventDefault();closePreview()}if(e.key==='Tab'){e.preventDefault();$('close-preview').focus()}return}if(e.key==='Escape'&&selected>=0){e.preventDefault();closeDetail()}if(e.key==='/'&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();$('search').focus()}if(selected>=0&&e.key==='Tab'){const focusable=[...$('detail').querySelectorAll('a[href],button:not([disabled]),summary')].filter(el=>el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
updateFilter();
})();
