/* P Atlas original Canvas background. MIT. No React Bits Pro source. */
(() => {'use strict';
class AtlasShards {
 constructor(host){
  this.host=host;this.canvas=host.querySelector('canvas');this.ctx=this.canvas.getContext('2d',{alpha:false});
  this.clock=0;this.phase=0;this.width=0;this.height=0;this.dirty=true;this.disposed=false;
  let state=7349;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  this.seeds=Array.from({length:1250},()=>({phase:random(),lane:random()*2-1,depth:random(),size:random(),roll:random()*Math.PI*2}));
  this.host.dataset.renderer='canvas';this.host.dataset.shards='atlas-folded-particles';
  this.pagehide=e=>{if(!e.persisted)this.dispose()};window.addEventListener('pagehide',this.pagehide);
 }
 render({dt,running,frameInterval=dt}){
  if(this.disposed||!this.ctx)return;
  const w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);
  const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(2200000/(w*h)));
  if(w!==this.width||h!==this.height||ratio!==this.ratio){this.width=w;this.height=h;this.ratio=ratio;this.canvas.width=Math.round(w*ratio);this.canvas.height=Math.round(h*ratio);this.dirty=true}
  if(!running&&!this.dirty)return;
  if(running){const elapsed=Math.min(Math.max(frameInterval,0),250)/1000;this.clock+=elapsed;this.phase=(this.phase+elapsed*.34/Math.hypot(2.44*w/h,Math.sqrt(5)))%1}
  this.draw();this.dirty=false;
 }
  draw(){
    // A smaller folded-shard field for browsers without WebGPU; keeps all atlas interactions available.
    const ctx=this.ctx,w=this.width,h=this.height,aspect=w/h,scale=this.canvas.width/w;
    ctx.setTransform(scale,0,0,scale,0,0);ctx.fillStyle='#120f17';ctx.fillRect(0,0,w,h);
    for(const seed of this.seeds){
      const t=(seed.phase+this.phase)%1,angle=(t*1.72-.2)*Math.PI;
      const y=Math.sin(angle)*.54+Math.sin(t*Math.PI*3)*.12;
      const derivative=Math.cos(angle)*1.72*Math.PI*.54+Math.cos(t*Math.PI*3)*Math.PI*3*.12;
      const rotation=Math.atan2(-derivative,aspect*2.44),lane=Math.sign(seed.lane)*Math.pow(Math.abs(seed.lane),.72)*.56;
      const z=(seed.depth*2-1)+Math.cos(t*Math.PI*2-.7)*.22,perspective=1/Math.max(.62,1-z*.34);
      const x=(aspect*(t*2.44-1.22)+Math.sin(rotation)*lane)*perspective;
      const py=(y+Math.cos(rotation)*lane)*perspective;
      const px=w/2+x*h/2,cy=h/2-py*h/2;
      const size=h*.00394*(.46+seed.size*.58+Math.pow(seed.size,12)*1.55)*perspective;
      if(px< -20||px>w+20||cy< -20||cy>h+20)continue;
      const roll=seed.roll+this.clock*.34*(seed.depth*3.2-1.5)*2.4;
      const facet=Math.cos(roll),alpha=.16+Math.pow(Math.max(0,facet),3)*.7;
      ctx.save();ctx.translate(px,cy);ctx.rotate(rotation);
      const length=size*1.5,width=size*.52*Math.max(.09,Math.abs(facet));
      ctx.globalAlpha=alpha;
      ctx.fillStyle=facet>0?'#69b7ff':'#24508e';ctx.beginPath();ctx.moveTo(-length,0);ctx.lineTo(0,-width);ctx.lineTo(length,0);ctx.fill();
      ctx.fillStyle=facet>0?'#b0d9ff':'#488bce';ctx.beginPath();ctx.moveTo(-length,0);ctx.lineTo(length,0);ctx.lineTo(0,width);ctx.fill();
      ctx.globalAlpha=alpha*.55;ctx.strokeStyle='#63cae3';ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(-length,.6);ctx.lineTo(length,.6);ctx.stroke();
      ctx.strokeStyle='#348bff';ctx.beginPath();ctx.moveTo(-length,-.6);ctx.lineTo(length,-.6);ctx.stroke();ctx.restore();
    }
    this.host.dataset.ready='true';
  }
 dispose(){this.disposed=true;window.removeEventListener('pagehide',this.pagehide)}
}
window.AtlasShards=AtlasShards;
})();
