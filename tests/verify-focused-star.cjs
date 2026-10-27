const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const classList = () => ({ add(){}, remove(){}, toggle(){} });
const elements = new Map();
const ctx = { arcs:[], setTransform(){}, clearRect(){this.arcs=[]}, createLinearGradient(){return {addColorStop(){}}}, createRadialGradient(){return {addColorStop(){}}}, fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){}, fillText(){}, save(){}, restore(){}, arc(x,y,r){this.arcs.push({x,y,r})} };
function element(id) {
  if (!elements.has(id)) elements.set(id, { id, style:{}, classList:classList(), events:{}, value:'', disabled:false,
    addEventListener(name, fn){(this.events[name]??=[]).push(fn)}, setAttribute(name,value){this[name]=value},
    querySelector(s){return element(id+s)}, replaceChildren(){}, append(){}, remove(){},
    querySelectorAll(){return []}, focus(){doc.activeElement=this}, blur(){doc.activeElement=element('body')},
    getBoundingClientRect(){return {width:1280,height:800}}, getContext(){return ctx}, setPointerCapture(){} });
  return elements.get(id);
}
const doc = { hidden:false, activeElement:element('body'), getElementById:element, createElement:tag=>element('new-'+tag+'-'+Math.random()), contains:()=>true, addEventListener(){}, body:element('body') };
let raf, latest, time=0, preferenceChange;
const appScope = { window:{AtlasAura:class {render(args){latest=args}}}, document:doc,
  Image:class {constructor(){this.complete=false}}, ResizeObserver:class {observe(){}}, devicePixelRatio:1,
  matchMedia:()=>({matches:false,addEventListener(_,fn){preferenceChange=fn}}), requestAnimationFrame:fn=>(raf=fn,1),
  setTimeout:()=>1, clearTimeout(){}, navigator:{} };
vm.createContext(appScope);
vm.runInContext(fs.readFileSync('dist/data.js','utf8'),appScope);
vm.runInContext(fs.readFileSync('dist/app.js','utf8'),appScope);
function step(n=1){for(let i=0;i<n;i++){time+=16;raf(time)}}
function input(value){const s=element('search');s.value=value;s.events.input[0]({target:s})}
function select(value){input(value);element('search').events.keydown[0]({key:'Enter',preventDefault(){}});input('')}
function centered(){assert(latest.focusReady);assert(Math.hypot(latest.focusSource[0],latest.focusSource[1])<1e-10);assert(Math.abs(latest.focusSource[2]-1)<1e-10)}
function coreRadius(){return ctx.arcs.find(p=>Math.hypot(p.x-latest.x,p.y-latest.y)<1e-8&&p.r>4&&p.r<8)?.r}
step();select('0242');step(60);centered();assert(latest.running);
const radii=[];for(let i=0;i<100;i++){step();centered();radii.push(coreRadius())}
assert(Math.max(...radii)-Math.min(...radii)>1.1,'selected dot must pulse while its position stays centered');
element('next').onclick();step(8);element('previous').onclick();step(60);centered();
element('rotate').onclick();step();const stoppedRadius=coreRadius();step(60);assert.equal(coreRadius(),stoppedRadius);assert(!latest.running);
element('close-detail').onclick();step(60);assert.equal(latest.focusId,-1);assert(!latest.running,'close must preserve manual pause');
element('rotate').onclick();select('0001');step(60);centered();
const sky=element('sky');sky.events.pointerdown[0]({pointerId:1,offsetX:latest.x,offsetY:latest.y});
sky.events.pointermove[1]({pointerId:1,offsetX:latest.x,offsetY:latest.y,pointerType:'mouse'});step();centered();
sky.events.pointerup[0]({pointerId:1});element('next').onclick();preferenceChange({matches:true});step();centered();assert(!latest.running);assert(Math.abs(coreRadius()-5.7)<1e-10);

const auraScope={window:{},console};vm.createContext(auraScope);vm.runInContext(fs.readFileSync('dist/aura.js','utf8'),auraScope);
const makeAura=()=>new auraScope.window.AtlasAura({style:{},classList:classList(),querySelector:()=>({addEventListener(){},getContext:()=>null})});
function render(a,extras={}){a.render({x:300,y:300,radius:200,dt:16,now:time,running:false,mobile:false,focusId:7,focusReady:true,focusSource:[0,0,1],...extras});a.updatePulseAges()}
for(const phase of [.01,.10,.24,.41,1.49,5.96]) {
  const a=makeAura();a.clock=phase;render(a);
  assert.equal(a.pulseAges[3],.25);for(let i=1;i<9;i++)assert.equal(a.pulseAges[i*4+3],-100,'no historical selection waves');
  const before=Array.from(a.pulseAges);render(a);assert.deepEqual(Array.from(a.pulseAges),before,'pause must freeze all wave ages');
  a.clock=(Math.floor(phase/1.5)+1)*1.5;render(a);
  assert(a.pulseAges[3]<=-.049,'future wave must enter its cohort before birth');
  const oldBirths=Array.from(a.pulseAges).filter((_,i)=>i%4!==3);
  render(a,{focusId:-1,focusReady:false});assert.equal(a.focusGain,0);assert.equal(a.focusStart,null);
  assert.deepEqual(Array.from(a.pulseAges).filter((_,i)=>i%4!==3),oldBirths,'selection cannot change the original three schedules');
  for(let i=0;i<9;i++)assert.equal(a.pulseAges[i*4+3],-100);
}
const a=makeAura();render(a);render(a,{running:true,focusId:-1,focusReady:false});for(let i=0;i<120;i++)render(a,{running:true,focusId:-1,focusReady:false});assert.equal(a.focusGain,0);assert.equal(a.focusStart,null);
console.log('PASS: focus, shortest transition retargeting, stationary blinking, polar dragging, reduced motion, pause/close restoration, fresh source births, and unchanged ABC schedules.');
