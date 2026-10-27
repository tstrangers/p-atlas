const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function check({half=true,reject=false}={}){
  let type,sceneFramebuffer,currentFramebuffer;
  const allocations=[],viewports=[],uniforms=[];
  const constants=['UNSIGNED_BYTE','FLOAT','TEXTURE_2D','RGBA','FRAMEBUFFER','FRAMEBUFFER_COMPLETE','COLOR_ATTACHMENT0','VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','ARRAY_BUFFER','STATIC_DRAW','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','LINEAR','TEXTURE_WRAP_S','TEXTURE_WRAP_T','CLAMP_TO_EDGE','DEPTH_TEST','TEXTURE0','TEXTURE1','TRIANGLES'];
  const gl=Object.fromEntries(constants.map((name,i)=>[name,i+1]));
  Object.assign(gl,{
    getExtension(name){return name==='OES_texture_half_float'?(half?{HALF_FLOAT_OES:5131}:null):name==='OES_standard_derivatives'?null:half?{}:null},
    createShader(){return {}},shaderSource(){},compileShader(){},getShaderParameter(){return true},deleteShader(){},
    createProgram(){return {}},attachShader(){},bindAttribLocation(){},linkProgram(){},getProgramParameter(){return true},useProgram(){},
    createBuffer(){return {}},bindBuffer(){},bufferData(){},enableVertexAttribArray(){},vertexAttribPointer(){},
    getUniformLocation(_,name){return name},uniform3fv(){},uniform4fv(){},uniform2f(){},uniform1i(){},uniform1f(name,value){uniforms.push([name,value])},
    createTexture(){return {}},createFramebuffer(){const f={};sceneFramebuffer??=f;return f},bindTexture(){},texParameteri(){},framebufferTexture2D(){},
    bindFramebuffer(_,f){currentFramebuffer=f},texImage2D(...args){type=args[7];allocations.push(type)},checkFramebufferStatus(){return reject&&type===5131?0:gl.FRAMEBUFFER_COMPLETE},
    disable(){},activeTexture(){},drawArrays(){},viewport(...args){viewports.push({framebuffer:currentFramebuffer,width:args[2]})}
  });
  const canvas={width:0,height:0,addEventListener(){},getContext(){return gl}};
  const host={dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},querySelector(){return canvas}};
  const scope={window:{devicePixelRatio:2},getComputedStyle(){return {getPropertyValue(){return '#72d8e6'}}},console};
  vm.createContext(scope);vm.runInContext(fs.readFileSync('dist/aura.js','utf8'),scope);
  const aura=new scope.window.AtlasAura(host);assert(aura.ready);
  const args={x:600,y:400,radius:250,dt:16,now:0,running:false,mobile:false};
  aura.render(args);
  const expectedHalf=half&&!reject;
  assert.equal(host.dataset.lightPrecision,expectedHalf?'16-bit-float':'8-bit-dithered');
  assert.equal(aura.targetResolution,440);assert.equal(canvas.width,1536);
  assert.equal(viewports.find(v=>v.framebuffer===sceneFramebuffer).width,440);
  assert.equal(viewports.at(-1).width,1536);
  assert.equal(uniforms.find(([name])=>name==='quantizationStep')[1],expectedHalf?0:1/255);
  const frames=viewports.length;aura.render({...args,now:100});assert.equal(viewports.length,frames,'paused rendering stays frozen');
  if(reject){assert.equal(allocations.filter(t=>t===5131).length,1);assert.equal(allocations.filter(t=>t===gl.UNSIGNED_BYTE).length,3)}
}
check();check({half:false});check({reject:true});
console.log('PASS: half-float rendering, unsupported/incomplete float fallback, intermediate versus display resolution, precision-specific dithering, and frozen pause.');
