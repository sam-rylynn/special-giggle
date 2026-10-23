export const ART = Object.freeze({width:1672,height:941,x:1184,y:469,radius:192});
export const DURATION = 2000;
export const PERIOD = 150;
export const GATE = Object.freeze({radius:216,feather:1,seam:94,travel:315,recessX:.12,recessY:.08,turn:.5,arc:52,press:.035});
export const clamp = (value,low,high) => Math.max(low,Math.min(high,value));
export const smooth = value => {const v=clamp(value,0,1);return v*v*(3-2*v);};
export const ease = value => {const v=clamp(value,0,1);return v*v*v*(v*(v*6-15)+10);};
export const wrap = angle => Math.atan2(Math.sin(angle),Math.cos(angle));

export function coverFor(width,height){
  const wide=width>=760&&width/height>1.1;
  const scale=Math.max(width/ART.width,height/ART.height)*(wide?1.035:1.07);
  const x=clamp(width*(wide?.72:.5)-ART.x*scale,width-ART.width*scale,0);
  const y=clamp(height*(wide?.51:.53)-ART.y*scale,height-ART.height*scale,0);
  return {scale,x,y,wide,cx:x+ART.x*scale,cy:y+ART.y*scale,radius:ART.radius*scale};
}

export function warpAt(elapsed){
  const progress=clamp(elapsed/DURATION,0,1);
  // Retiming preserves the selected 4.4-second choreography and all visual parameters.
  const time=progress*4400;
  // Unlock, withdraw, hold, then enter. Each movement starts and settles at zero velocity.
  const press=ease(time/550);
  const open=ease((time-550)/2450);
  const push=ease((time-3450)/950);
  return {progress,press,open,center:push,push,ui:1-ease(time/600),zoom:1+.55*push,light:Math.sin(Math.PI*clamp(time/3450,0,1))*.18,black:ease((time-4020)/380),done:progress===1};
}

export function entryCoverFor(width,height,frame,warp,par={x:0,y:0}){
  const scale=frame.scale*(warp?.zoom||1);
  const center=frame.cx+(width*.5-frame.cx)*(warp?.center||0);
  // The camera must not expose texture clamp-to-edge streaks during its lateral move.
  return {scale,x:clamp(center-ART.x*scale+par.x,width-ART.width*scale,0),y:clamp(frame.cy-ART.y*scale+par.y,height-ART.height*scale,0)};
}

export function pixelRatioFor(width,height,deviceRatio,wide,low=false){
  return Math.min(deviceRatio||1,low?1.5:wide?2:3,Math.sqrt(8000000/(width*height)));
}

export function gateSeam(y){return GATE.seam*Math.sin(Math.PI*clamp(y/GATE.radius,-1,1));}

// One pending frame, reset clock after suspension; no hidden-time catch-up.
export function createTicker({request,cancel,draw,fps=30}){
  let id=0,active=false,disposed=false,previous=null,rate=fps;
  function frame(now){
    id=0;
    if(!active||disposed)return;
    if(previous===null||now-previous>=1000/rate-1){
      const dt=previous===null?0:Math.min((now-previous)/1000,.1);
      previous=now;draw(dt,now);
    }
    if(active&&!disposed&&!id)id=request(frame);
  }
  return {
    start(){if(disposed||active)return;active=true;previous=null;id=request(frame);},
    stop(){active=false;previous=null;if(id)cancel(id);id=0;},
    setFps(value){rate=clamp(value,15,60);},
    destroy(){this.stop();disposed=true;},
    get active(){return active;},
    get pending(){return id?1:0;}
  };
}

export function createQualityMonitor(onChange){
  let start=null,previous=null,count=0,slow=0,level=0;
  return {
    sample(now){
      // A suspended tab may throttle rAF even before visibilitychange arrives.
      if(previous!==null&&now-previous>750){start=null;count=0;slow=0;}
      previous=now;
      if(start===null){start=now;return null;}
      count++;
      if(now-start<3000)return null;
      const fps=count*1000/(now-start);
      slow=fps<19?slow+1:0;start=now;count=0;
      if(slow>=2&&level<2){level++;slow=0;onChange(level===1?'low':'static');}
      return fps;
    },
    reset(){start=null;previous=null;count=0;slow=0;}
  };
}

export const VERTEX=`attribute vec2 a_position; void main(){gl_Position=vec4(a_position,0.0,1.0);}`;
export const FRAGMENT=`
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec3 u_cover;
uniform vec3 u_angles;
uniform vec3 u_ripples;
uniform float u_time;
uniform float u_hover;
uniform float u_enter;
uniform float u_open;
uniform float u_press;
const vec2 SIZE=vec2(1672.0,941.0);
const vec2 CENTER=vec2(1184.0,469.0);
const vec2 GOLD=vec2(1191.0,365.0);
const vec2 TEAL=vec2(1169.0,577.0);
vec3 sampleArt(vec2 p){return texture2D(u_image,clamp(p/SIZE,vec2(.001),vec2(.999))).rgb;}
float luminance(vec3 c){return dot(c,vec3(.299,.587,.114));}
const float GATE_RADIUS=${GATE.radius.toFixed(1)};
const float GATE_FEATHER=${GATE.feather.toFixed(1)};
float apertureAt(vec2 q){return 1.0-smoothstep(GATE_RADIUS-GATE_FEATHER,GATE_RADIUS+GATE_FEATHER,length(q));}
float seam(float y){return ${GATE.seam.toFixed(1)}*sin(3.14159265*clamp(y/GATE_RADIUS,-1.0,1.0));}
vec4 leaf(vec2 q,float side,mat2 rotation){
  // A shallow recess followed by a curved, rotating path into the ring's pockets.
  vec2 local=rotation*q;
  vec2 track=side*vec2(${GATE.travel.toFixed(1)}*u_open,${GATE.arc.toFixed(1)}*sin(3.14159265*u_open));
  vec2 scale=vec2(1.0-${GATE.recessX}*u_open,1.0-${GATE.recessY}*u_open)*(1.0-${GATE.press}*u_press);
  local=(local-track)/scale;
  float circle=apertureAt(local);
  float edge=local.x-seam(local.y);
  float halfMask=smoothstep(-.7,.7,edge*side);
  float pocket=smoothstep(188.0,216.0,length(q))*u_press;
  vec3 color=sampleArt(CENTER+local)*(1.0-.10*u_press-.14*u_open-.22*pocket);
  color+=vec3(.8,.57,.25)*exp(-abs(edge)/1.6)*u_press*(1.0-u_open)*.16;
  return vec4(color,circle*halfMask*apertureAt(q));
}
void main(){
  vec2 pixel=vec2(gl_FragCoord.x,u_resolution.y-gl_FragCoord.y);
  vec2 p=(pixel-u_cover.yz)/u_cover.x;
  vec2 q=p-CENTER;
  float r=length(q);
  float angle=mix(u_angles.x,0.0,smoothstep(197.0,206.0,r));
  angle=mix(angle,u_angles.y,smoothstep(226.0,240.0,r));
  angle=mix(angle,u_angles.z,smoothstep(298.0,312.0,r));
  angle=mix(angle,0.0,smoothstep(365.0,379.0,r));
  float c=cos(angle),s=sin(angle);
  vec2 sampled=CENTER+mat2(c,-s,s,c)*q;
  float disc=1.0-smoothstep(222.0,236.0,r);
  float ground=smoothstep(592.0,652.0,p.y)*(1.0-disc);
  float strip=(1.0-smoothstep(26.0,44.0,abs(q.x)))*smoothstep(224.0,238.0,r);
  float upper=1.0-smoothstep(52.0,70.0,length(p-vec2(1184.0,124.0)));
  float lower=1.0-smoothstep(64.0,86.0,length(p-vec2(1184.0,795.0)));
  float still=clamp(ground+strip+upper+lower,0.0,1.0);
  vec3 color=mix(sampleArt(sampled),sampleArt(p),still);

  // Gem masks use the rotated source point, so highlights follow the stones.
  float gold=exp(-dot(sampled-GOLD,sampled-GOLD)/240.0);
  float teal=exp(-dot(sampled-TEAL,sampled-TEAL)/190.0);
  float pulse=.5+.5*sin(u_time*.72);
  float strength=.11+u_hover*.13+u_enter*.55;
  color+=gold*vec3(1.0,.72,.29)*strength*(.45+.55*pulse);
  color+=teal*vec3(.34,.82,.88)*strength*(1.0-.55*pulse);

  // A short grazing reflection, confined to existing bright metal.
  float ring=smoothstep(196.0,212.0,r)*(1.0-smoothstep(326.0,345.0,r));
  float theta=atan(q.y,q.x);
  float sweep=pow(max(0.0,cos(theta-u_time*.24)),90.0);
  float metal=smoothstep(.32,.72,luminance(color));
  color+=vec3(.7,.54,.28)*sweep*ring*metal*.16*(1.0-still);
  for(int i=0;i<3;i++){
    float age=i==0?u_ripples.x:(i==1?u_ripples.y:u_ripples.z);
    if(age>=0.0&&age<2.0){
      float radius=70.0+330.0*age;
      float width=16.0+18.0*age;
      float ripple=exp(-pow((r-radius)/width,2.0))*exp(-age*1.8);
      color+=ripple*metal*vec3(.48,.36,.17);
    }
  }
  if(u_press>0.0){
    // Leaves stay behind the aperture; no part can float outside the circular frame.
    float aperture=apertureAt(q);
    vec3 stars=sampleArt(vec2(330.0,300.0)+q*.85);
    float innerWall=smoothstep(185.0,216.0,r);
    vec3 portal=(stars*.72+vec3(.012,.024,.028))*(1.0-.62*innerWall);
    float rim=exp(-pow((r-216.0)/2.0,2.0));
    color=mix(color,portal,aperture);
    color+=rim*vec3(.55,.38,.16)*u_press*.16;
    float a=u_angles.x+${GATE.turn}*u_open;
    mat2 rotation=mat2(cos(a),-sin(a),sin(a),cos(a));
    vec4 left=leaf(q,-1.0,rotation),right=leaf(q,1.0,rotation);
    color=mix(color,left.rgb,left.a);
    color=mix(color,right.rgb,right.a);
  }
  gl_FragColor=vec4(color,1.0);
}`;
