import {ART,PERIOD,DURATION,clamp,wrap,coverFor,entryCoverFor,warpAt,pixelRatioFor,createTicker,createQualityMonitor,VERTEX,FRAGMENT} from './scene.js?v=a1fff46682e0';

const canvas=document.querySelector('.scene-canvas');
const poster=document.querySelector('.scene-poster');
const stage=document.querySelector('.observatory');
const button=document.querySelector('.motion-control');
const enter=document.querySelector('.enter');
const blackout=document.querySelector('.blackout');
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const coarse=matchMedia('(pointer: coarse)');
const params=new URLSearchParams(location.search);
const qa=params.get('qa')==='1';
const forceFallback=qa&&params.get('fallback')==='1';
const forceReduced=qa&&params.get('reduced')==='1';
const abort=new AbortController();
const signal=abort.signal;
const animations=new Set();
let reduced=motion.matches||forceReduced;
let manualPause=false,hidden=document.hidden,away=false,disposed=false,contextLost=false;
let gl=null,program=null,buffer=null,texture=null,shaders=[],uniforms={};
let frame=coverFor(stage.clientWidth,stage.clientHeight),dpr=1;
let elapsed=0,theta=0,velocity=0,hover=0,hoverTarget=0,drag=null;
let par={x:0,y:0},parTarget={x:0,y:0};
let warpStart=null,warpAngles=null,qaWarp=null,renderedGate=null,navTimer=0,navved=false,rippleIndex=0;
const ripples=[-10,-10,-10];
let draws=0,pixelEnergy=0,introduced=false;
let quality='standard';
const ticker=createTicker({request:requestAnimationFrame.bind(window),cancel:cancelAnimationFrame.bind(window),draw:drawFrame,fps:30});
const qualityMonitor=createQualityMonitor(level=>{
  if(level==='low'){quality='low';ticker.setFps(24);resize();}
  else fallback('low-performance');
});

function diagnostics(){
  if(!qa)return;
  Object.assign(document.documentElement.dataset,{openingMode:document.body.dataset.renderMode||'loading',draws:String(draws),pixelEnergy:String(pixelEnergy),quality,angle:theta.toFixed(4),elapsed:elapsed.toFixed(3),paused:String(manualPause||reduced),gemGold:JSON.stringify(projectGem(1191,365)),gemTeal:JSON.stringify(projectGem(1169,577))});
}
function projectGem(x,y){
  const angle=elapsed*Math.PI*2/PERIOD+theta,c=Math.cos(angle),s=Math.sin(angle);
  const qx=x-ART.x,qy=y-ART.y;
  return {x:frame.x+(ART.x+c*qx-s*qy)*frame.scale+par.x,y:frame.y+(ART.y+s*qx+c*qy)*frame.scale+par.y};
}
function setMode(value){document.body.dataset.renderMode=value;diagnostics();}
function cancelIntroductions(){for(const a of animations)a.cancel();animations.clear();}
function introduce(){
  if(introduced||reduced||hidden||away||manualPause)return;
  introduced=true;
  for(const [selector,delay] of [['.brand-lockup',0],['.entry-action',100]]){
    const node=document.querySelector(selector);
    if(!node.animate)continue;
    const animation=node.animate([{opacity:.15,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:650,delay,easing:'cubic-bezier(.2,.65,.3,1)',fill:'backwards'});
    animations.add(animation);animation.finished.then(()=>animations.delete(animation),()=>animations.delete(animation));
  }
}
function cancelNavigation(restore=true){
  clearTimeout(navTimer);navTimer=0;warpStart=null;navved=false;
  warpAngles=null;qaWarp=null;
  renderedGate=null;
  ticker.setFps(quality==='low'?24:30);
  if(restore){
    document.body.classList.remove('is-entering');blackout.style.opacity='0';
    document.body.style.removeProperty('--entry-opacity');enter.removeAttribute('aria-busy');
  }
}
function syncPlayback(){
  const running=!!gl&&!reduced&&!manualPause&&!hidden&&!away&&!disposed&&!contextLost;
  if(running){ticker.start();introduce();}else ticker.stop();
  button.hidden=!gl||contextLost;
  button.disabled=reduced;
  const paused=reduced||manualPause;
  button.setAttribute('aria-pressed',String(paused));
  const label=reduced?'已遵循系统减少动态设置':paused?'播放动态':'暂停动态';
  button.setAttribute('aria-label',label);button.dataset.tooltip=label;
  if(!running){cancelIntroductions();qualityMonitor.reset();}
  diagnostics();
}
function resize(){
  if(disposed)return;
  frame=coverFor(stage.clientWidth,stage.clientHeight);
  Object.assign(poster.style,{width:ART.width*frame.scale+'px',height:ART.height*frame.scale+'px',left:frame.x+'px',top:frame.y+'px'});
  dpr=pixelRatioFor(stage.clientWidth,stage.clientHeight,devicePixelRatio,frame.wide,quality==='low');
  canvas.width=Math.round(stage.clientWidth*dpr);canvas.height=Math.round(stage.clientHeight*dpr);
  if(gl&&!contextLost){gl.viewport(0,0,canvas.width,canvas.height);if(!ticker.active)drawFrame(0,performance.now());}
  diagnostics();
}
function cleanupGL(){
  if(gl&&!contextLost){
    if(texture)gl.deleteTexture(texture);
    if(buffer)gl.deleteBuffer(buffer);
    if(program)gl.deleteProgram(program);
    for(const shader of shaders)gl.deleteShader(shader);
  }
  gl=null;texture=null;buffer=null;program=null;shaders=[];uniforms={};
}
function fallback(mode){
  ticker.stop();cancelIntroductions();cancelNavigation();cleanupGL();
  setMode(mode);syncPlayback();
}
function compile(type,source){
  const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error('Opening shader compile failed');
  return shader;
}
function boot(){
  if(disposed||contextLost||!poster.naturalWidth)return;
  if(reduced){setMode('reduced-motion');syncPlayback();return;}
  if(forceFallback){setMode('fallback');return;}
  if(gl){syncPlayback();return;}
  try{
    gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:false});
    if(!gl){fallback('fallback');return;}
    program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Opening shader link failed');
    gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,poster);
    for(const edge of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,edge,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    for(const name of ['u_resolution','u_cover','u_angles','u_time','u_ripples','u_hover','u_enter','u_open','u_press'])uniforms[name]=gl.getUniformLocation(program,name);
    setMode('webgl');resize();syncPlayback();
  }catch{fallback('fallback');}
}
function samplePixels(){
  const data=new Uint8Array(4);let energy=0;
  for(const [x,y] of [[.25,.25],[.5,.5],[.75,.5],[.75,.75],[.5,.75]]){
    gl.readPixels(Math.floor(canvas.width*x),Math.floor(canvas.height*y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,data);
    energy+=data[0]+data[1]+data[2];
  }
  pixelEnergy=energy;
}
function navigate(){
  if(navved||disposed)return;
  navved=true;clearTimeout(navTimer);navTimer=0;ticker.stop();cancelIntroductions();
  location.assign(enter.href);
}
function drawFrame(dt,now){
  if(!gl||contextLost||disposed)return;
  elapsed+=dt;
  if(!drag){theta+=velocity*dt;velocity*=Math.exp(-dt/1.1);}
  par.x+=(parTarget.x-par.x)*(1-Math.exp(-dt*5));par.y+=(parTarget.y-par.y)*(1-Math.exp(-dt*5));
  hover+=(hoverTarget-hover)*(1-Math.exp(-dt*5));
  const warp=qaWarp===null?(warpStart===null?null:warpAt(now-warpStart)):warpAt(qaWarp);
  renderedGate=warp;
  const {scale,x,y}=entryCoverFor(stage.clientWidth,stage.clientHeight,frame,warp,par);
  gl.uniform2f(uniforms.u_resolution,canvas.width,canvas.height);
  gl.uniform3f(uniforms.u_cover,scale*dpr,x*dpr,y*dpr);
  const angles=warpAngles||[elapsed*Math.PI*2/PERIOD+theta,-elapsed*Math.PI*2/720,elapsed*Math.PI*2/1080];
  gl.uniform3f(uniforms.u_angles,...angles);
  gl.uniform1f(uniforms.u_time,elapsed);gl.uniform1f(uniforms.u_hover,hover);gl.uniform1f(uniforms.u_enter,warp?.light||0);
  gl.uniform1f(uniforms.u_open,warp?.open||0);
  gl.uniform1f(uniforms.u_press,warp?.press||0);
  gl.uniform3f(uniforms.u_ripples,...ripples.map(time=>time<0?-1:elapsed-time));
  gl.drawArrays(gl.TRIANGLES,0,3);draws++;
  if(qa&&(draws%30===1||qaWarp!==null))samplePixels();
  if(warp){
    document.body.style.setProperty('--entry-opacity',String(warp.ui));
    blackout.style.opacity=String(warp.black);if(warp.done&&qaWarp===null)navigate();
  }
  else if(dt>0){const fps=qualityMonitor.sample(now);if(qa&&fps!==null)document.documentElement.dataset.fps=fps.toFixed(1);}
  diagnostics();
}
function pointerPoint(event){
  const rect=stage.getBoundingClientRect();
  const x=(event.clientX-rect.left-frame.x-par.x)/frame.scale-ART.x;
  const y=(event.clientY-rect.top-frame.y-par.y)/frame.scale-ART.y;
  return {x,y,r:Math.hypot(x,y),angle:Math.atan2(y,x)};
}
function release(event){
  if(!drag||event.pointerId!==drag.id)return;
  if(event.type==='pointerup'&&drag.moved<.06)ripples[rippleIndex++%3]=elapsed;
  if(event.type!=='pointerup')velocity=0;
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  drag=null;canvas.classList.remove('is-dragging');
}
canvas.addEventListener('pointerdown',event=>{
  if(!ticker.active||warpStart!==null||event.button!==0||drag)return;
  const point=pointerPoint(event);
  if(point.r>350)return;
  drag={id:event.pointerId,angle:point.angle,time:performance.now(),moved:0};
  canvas.setPointerCapture(event.pointerId);canvas.classList.add('is-dragging');velocity=0;
},{signal});
canvas.addEventListener('pointermove',event=>{
  if(!ticker.active||warpStart!==null)return;
  const point=pointerPoint(event);hoverTarget=point.r<240?1:0;
  if(!coarse.matches){parTarget.x=-(event.clientX/stage.clientWidth-.5)*8;parTarget.y=-(event.clientY/stage.clientHeight-.5)*6;}
  if(!drag||event.pointerId!==drag.id)return;
  const now=performance.now(),delta=wrap(point.angle-drag.angle),dt=Math.max(8,now-drag.time)/1000;
  theta+=delta;velocity=clamp(.6*velocity+.4*delta/dt,-.7,.7);
  drag.angle=point.angle;drag.time=now;drag.moved+=Math.abs(delta);
},{signal});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,release,{signal});
canvas.addEventListener('pointerleave',()=>{hoverTarget=0;parTarget={x:0,y:0};},{signal});
button.addEventListener('click',()=>{if(reduced)return;manualPause=!manualPause;syncPlayback();},{signal});
enter.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  if(!ticker.active||reduced)return;
  event.preventDefault();if(warpStart!==null)return;
  warpAngles=[elapsed*Math.PI*2/PERIOD+theta,-elapsed*Math.PI*2/720,elapsed*Math.PI*2/1080];
  velocity=0;
  warpStart=performance.now();enter.setAttribute('aria-busy','true');
  document.body.style.setProperty('--entry-opacity','1');document.body.classList.add('is-entering');
  ticker.setFps(quality==='low'?30:60);cancelIntroductions();
  navTimer=setTimeout(navigate,DURATION+350);
},{signal});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;fallback('context-lost');},{signal});
motion.addEventListener('change',()=>{
  reduced=motion.matches||forceReduced;
  cancelNavigation();
  if(reduced){syncPlayback();setMode('reduced-motion');}
  else if(gl){setMode('webgl');syncPlayback();}else boot();
},{signal});
document.addEventListener('visibilitychange',()=>{
  hidden=document.hidden;qualityMonitor.reset();
  if(hidden){cancelNavigation(false);drag=null;velocity=0;}
  else cancelNavigation();
  syncPlayback();
},{signal});
addEventListener('pagehide',()=>{away=true;cancelNavigation(false);syncPlayback();},{signal});
addEventListener('pageshow',()=>{away=false;hidden=document.hidden;qualityMonitor.reset();cancelNavigation();syncPlayback();},{signal});
addEventListener('resize',resize,{signal});
poster.addEventListener('load',()=>{resize();boot();},{signal});
poster.addEventListener('error',()=>fallback('image-error'),{signal});
export function destroy(){
  if(disposed)return;disposed=true;abort.abort();cancelNavigation();cancelIntroductions();ticker.destroy();cleanupGL();setMode('destroyed');button.hidden=true;
}
if(qa)window.ZXOpeningQA={destroy,loseContext(){gl?.getExtension('WEBGL_lose_context')?.loseContext();},previewGate(ms,angle=0){
  if(!gl||disposed||reduced)return false;
  ticker.stop();cancelNavigation();cancelIntroductions();
  qaWarp=clamp(ms,0,DURATION);warpAngles=[angle,0,0];
  document.body.classList.toggle('is-entering',ms>0);drawFrame(0,performance.now());return true;
},snapshot(){return {draws,pending:ticker.pending,animations:animations.size,navigationTimers:navTimer?1:0,disposed,quality,pixelEnergy,dpr,gate:renderedGate,frame:{...frame}};}};
resize();
if(qa&&params.get('image-error')==='1')poster.src='./missing-test-image.webp';
else if(poster.complete){if(poster.naturalWidth)boot();else fallback('image-error');}
if(window.lucide)window.lucide.createIcons();
