// GLSL for the 3D scene (ai-scene.tsx).
//  - PORTRAIT_*: the AI's portrait, as points (and the constellation of lines between the glowing
//    nodes on her face), all moved on the GPU by displace(). While she is whole she breathes, a
//    keystroke sends a ripple across her and a scan of light passes down her now and then. As
//    uProgress runs 0 -> 1 she burns away along a front that sweeps across her from her right to
//    her left (each point in its turn, order(); the points at the front flare as they go), the
//    points lifting off like embers, carried by a swirling flow (flow(): the curl of a smooth field,
//    so they eddy like smoke instead of clumping) into a spiral galaxy of three arms turning round
//    her (galaxy()). As it runs back to 0 (uBack) she is printed back, from her neck up, the far
//    layers of each height before the near, the points falling in from the galaxy and flaring as they
//    land. The pointer (uMouse, in her own space) pushes the points near it aside. While whole her
//    eyes are alive: her irises turn towards where she looks (uGaze) and now and then she blinks
//    (uBlink); her face is in focus and what lies behind it (the wires) is drawn larger, softer and
//    dimmer, as through a lens (uFocus). A wrong password jolts her in slices (uGlitch); a right one
//    lights her as she is printed back (uFlash). Midway through her calm stretch her points travel
//    through other forms (form(): a globe with calls arcing between its cities, a speaking voice,
//    the Avortyx mark) and come back as her face. Points and lines run the same displace() with the
//    same seeds, so the lines stay on their nodes (and fade as she comes apart). Her points are
//    coloured by depth, deep blue at her back to near-white blue nearest you.
//  - NODE_*, LINK_*, RIBBON_*: the network behind the scene, on the left (network-field.tsx).
//  - FIELD_*: faint points floating at many depths behind the scene, drifting slowly upward and twinkling.
// Colour: one electric blue (#3b82f6, the circuit's and the chip's), varying in brightness, with the
// portrait shading to a deep blue and to the ice accent by depth; additively blended. All small, so they compile quickly (the scene waits for them to start).

// a swirling flow for the scattered points: the curl of a smooth field of sines, so it turns and
// eddies like smoke without clumping. (Cheap to compile and to run: true curl noise built from
// simplex noise made the shaders slow to compile, which held up the scene's first frame.)
const FLOW = /* glsl */ `
vec3 flow(vec3 p,float t){
  return normalize(vec3(
    sin(p.y*1.7+t*0.3)+cos(p.z*1.3-t*0.2),
    sin(p.z*1.9-t*0.25)+cos(p.x*1.5+t*0.15),
    sin(p.x*1.4+t*0.2)+cos(p.y*1.1-t*0.3)
  )+vec3(0.0001));
}
`;

// where a point of the portrait is now; e: how far it has come apart (0 whole .. 1 in the galaxy);
// scan: how much the passing scan lights it
const DISPLACE = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uBack;
uniform float uRipple;
uniform vec3 uMouse;
uniform vec4 uEyes;
uniform vec2 uGaze;
uniform float uBlink;
uniform float uGlitch;
uniform float uShapeA;
uniform float uShapeB;
uniform float uMorph;
uniform float uFaceX;
attribute float aRandom;
attribute float aSize;
${FLOW}
// its turn, 0 first .. 1 last: coming apart, from her right (-x) and the crown across to her
// left; coming back (the last to leave is the first back), from her neck up, far before near
float order(vec3 p){
  float apart=clamp(0.5+p.x*0.24-p.y*0.1,0.0,1.0);
  float back=clamp(0.5-p.y*0.3-p.z*0.12,0.0,1.0);
  return mix(apart*0.8+aRandom*0.2,back*0.94+aRandom*0.06,uBack);
}
// its place in the galaxy: on one of three arms, winding out, turning (the inner faster), tipped
// towards the camera (its own random numbers drawn from its home, so they don't line up)
vec3 hash3(vec3 p){
  return fract(sin(vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))))*43758.5453);
}
vec3 galaxy(vec3 p0){
  vec3 h=hash3(p0);
  float arm=floor(fract(aRandom*7.13)*3.0)*2.0944;
  float rad=0.3+1.4*pow(h.x,0.75);
  float a=arm+rad*2.2+(h.y-0.5)*(0.3+0.45*rad)+uTime*0.6/(0.4+rad);
  vec3 g=vec3(cos(a)*rad*1.1,(h.z-0.5)*0.2*(1.6-rad*0.5),sin(a)*rad);
  return vec3(g.x,g.y*0.42-g.z*0.91,g.y*0.91+g.z*0.42);
}
// how much a point is in one of her eyes (0 .. 1 at its centre), and its offset from that eye's centre
float eyeOf(vec2 p,out vec2 d){
  vec2 a=p-uEyes.xy,b=p-uEyes.zw;
  d=dot(a,a)<dot(b,b)?a:b;
  return exp(-pow(d.x/0.15,2.0)-pow(d.y/0.07,2.0));
}
vec3 rotY(vec3 p,float a){
  float c=cos(a),s=sin(a);
  return vec3(c*p.x+s*p.z,p.y,c*p.z-s*p.x);
}
// the forms she takes between her looks (form(); 0 is her face), each lighting some of its points
// (fGlow: in the ice accent) and dimming others (fDim)
float fGlow;
float fDim;
// ten cities (latitude, longitude) and the calls between them, for the globe
const vec2 CITY[10]=vec2[10](vec2(40.7,-74.0),vec2(34.0,-118.2),vec2(-23.5,-46.6),vec2(51.5,-0.1),vec2(6.5,3.4),
  vec2(25.2,55.3),vec2(19.1,72.9),vec2(1.3,103.8),vec2(35.7,139.7),vec2(-33.9,151.2));
const ivec2 CALL[12]=ivec2[12](ivec2(0,3),ivec2(0,1),ivec2(0,2),ivec2(3,4),ivec2(3,5),ivec2(5,6),ivec2(6,7),
  ivec2(7,8),ivec2(7,9),ivec2(8,1),ivec2(3,6),ivec2(1,9));
vec3 sph(vec2 ll){
  vec2 r=radians(ll);
  return vec3(cos(r.x)*sin(r.y),sin(r.x),cos(r.x)*cos(r.y));
}
// its place in one of the forms, from its seed (0 is her face, f):
//  1. a globe of parallels and meridians (every 20 degrees), its cities lit (the nodes, aSize > 2), and calls
//     arcing between them, each with a pulse of light running along it;
//  2. a voice: a waveform of bars rising and falling as if speaking, along a line, bowed towards you;
//  3. the Avortyx mark: its three open rings round a dot (avortyx-logo.tsx), set at three depths and
//     held as in the logo (their gaps at the upper right), the whole turning a little so its layers show.
vec3 form(float id,vec3 p0,vec3 f){
  fGlow=0.0;
  fDim=1.0;
  if(id<0.5)return f;
  vec3 h=hash3(p0+1.7),g;
  float k=fract(aRandom*13.7),node=step(2.0,aSize);
  if(id<1.5){
    if(node>0.5){
      g=sph(CITY[int(fract(aRandom*7.7)*10.0)])*1.01+(h-0.5)*0.025;
      fGlow=0.7;
    }else if(k<0.5){
      float lat,lon;
      if(k<0.27){lat=radians(floor(h.y*8.0)*20.0-70.0);lon=h.x*6.2832;}
      else{lon=radians(floor(h.x*18.0)*20.0);lat=(h.y-0.5)*2.9;}
      g=vec3(cos(lat)*sin(lon),sin(lat),cos(lat)*cos(lon));
      fDim=1.15;
    }else if(k<0.55){
      float lat=asin(h.y*2.0-1.0),lon=h.x*6.2832;
      g=vec3(cos(lat)*sin(lon),sin(lat),cos(lat)*cos(lon));
      fDim=0.3;
    }else{
      int i=int(h.x*12.0);
      vec3 a=sph(CITY[CALL[i].x]),b=sph(CITY[CALL[i].y]);
      float t=h.y,w=acos(clamp(dot(a,b),-1.0,1.0));
      g=(sin((1.0-t)*w)*a+sin(t*w)*b)/max(sin(w),0.001)*(1.0+sin(3.14159*t)*(0.05+0.13*w))+(h.zxy-0.5)*0.012;
      float head=fract(uTime*0.28+float(i)*0.37);
      fGlow=exp(-pow((t-head)*11.0,2.0))*1.8;
      fDim=0.6;
    }
    g=rotY(g,uTime*0.22+1.2);
    return vec3(g.x,g.y*0.94-g.z*0.34,g.y*0.34+g.z*0.94);
  }
  if(id<2.5){
    float i=floor(h.x*44.0),x=(i+0.5)/44.0*2.6-1.3;
    float talk=abs(sin(uTime*3.3+i*0.71)*sin(uTime*1.9+i*0.29)+0.4*sin(uTime*6.1+i*1.73));
    float H=0.05+0.85*exp(-x*x*1.3)*min(1.0,talk);
    if(k<0.88){
      float v=h.y*2.0-1.0;
      g=vec3(x+(h.z-0.5)*0.035,v*H,-x*x*0.3+(fract(aRandom*5.1)-0.5)*0.05);
      fGlow=smoothstep(0.75,1.0,abs(v))*0.6;
    }else{
      float x2=h.y*2.6-1.3;
      g=vec3(x2,(h.z-0.5)*0.01,-x2*x2*0.3);
      fGlow=0.25;
    }
    return rotY(g,sin(uTime*0.35)*0.4);
  }
  float u=1.15/20.0;
  if(k<0.82||node>0.5){
    float ring=node>0.5?floor(fract(aRandom*3.3)*3.0):k<0.46?0.0:k<0.68?1.0:2.0;
    // each ring held as in the logo, its gap at the upper right, swaying only a few degrees (each at
    // its own pace) so it stays the mark rather than spinning out of it
    float r=ring<0.5?20.0:ring<1.5?12.5:6.0,wd=ring<0.5?3.0:ring<1.5?2.5:2.0,sway=ring<0.5?0.5:ring<1.5?-0.7:0.9;
    float a=radians(70.0)+h.y*radians(290.0)+0.09*sin(uTime*sway),rr=(r+(h.z-0.5)*wd)*u;
    g=vec3(cos(a)*rr,sin(a)*rr,ring*0.14-0.14+(fract(aRandom*5.3)-0.5)*wd*u);
    fGlow=(1.0-smoothstep(0.0,0.03,min(h.y,1.0-h.y)))*0.3;
  }else if(k<0.826){
    g=(h-0.5)*0.07+vec3(0.0,0.0,0.16);
    fGlow=0.5;
  }else{
    float rad=sqrt(h.x)*1.1,a=h.y*6.2832;
    g=vec3(cos(a)*rad,sin(a)*rad,(h.z-0.5)*0.1);
    fDim=0.3*(1.0-rad/1.1);
  }
  return rotY(g,sin(uTime*0.45)*0.45);
}
// the glow and dimming of where it is now, between two forms
float pGlow;
float pDim;
// lid: how much a blink has closed over it; sh: how much it is in a form rather than her face;
// tr: how far it is on its way between two of them (0 at either end, 1 midway)
vec3 displace(vec3 p0,out float e,out float scan,out float lid,out float sh,out float tr){
  vec3 p=p0;
  // her irises turn towards where she looks; a blink closes her eyes to a line
  vec2 ed;
  float eye=eyeOf(p0.xy,ed);
  p.xy+=uGaze*vec2(0.035,0.02)*exp(-dot(ed,ed)/0.0025);
  p.y-=ed.y*0.85*uBlink*eye;
  lid=uBlink*eye;
  // a breath, a keystroke's ripple out from her nose, a scan of light down her every 12 seconds
  p.z+=0.015*sin(uTime*1.4+p0.y*2.0)+uRipple*0.07*sin(length(p0.xy-vec2(0.03,-0.14))*9.0-uTime*10.0);
  float sy=1.9-mod(uTime*0.4,4.8);
  scan=exp(-pow((p0.y-sy)*7.0,2.0));
  p.z+=scan*0.04;
  // her face centred where she is placed (the midpoint between her eyes, which in her picture sits a
  // little right of its middle); the forms are centred on their own
  p.x-=uFaceX;
  // from one form to the next (uShapeA -> uShapeB as uMorph runs 0 -> 1), from her crown down,
  // each point swirling on its way
  float m=clamp((uMorph-(clamp(0.5-p0.y*0.3,0.0,1.0)*0.6+aRandom*0.4)*0.45)/0.55,0.0,1.0);
  m=m*m*(3.0-2.0*m);
  tr=sin(3.14159*m)*step(0.5,abs(uShapeA-uShapeB));
  sh=mix(step(0.5,uShapeA),step(0.5,uShapeB),m);
  scan*=1.0-sh;
  pGlow=0.0;
  pDim=1.0;
  if(sh+tr>0.001){
    vec3 fa=form(uShapeA,p0,p);
    float ga=fGlow,da=fDim;
    vec3 fb=form(uShapeB,p0,p);
    pGlow=mix(ga,fGlow,m);
    pDim=mix(da,fDim,m);
    p=mix(fa,fb,m)+flow(p0*1.3,uTime)*0.35*tr;
  }
  // each point's own stretch of uProgress: coming back, a short one, so she is printed along a sharp line
  float span=mix(0.3,0.14,uBack);
  float l=clamp((uProgress-order(p0)*(1.0-span))/span,0.0,1.0);
  e=l*l*(3.0-2.0*l);
  if(e>0.001){
    float arc=sin(3.14159*e);
    // lifting away like embers (coming apart) or falling in from below (coming back)
    vec3 drift=mix(vec3(-0.35,0.6,-0.15),vec3(0.15,-0.55,0.3),uBack)*(0.4+aRandom);
    p=mix(p,galaxy(p0),e)+(flow(p0*1.4,uTime)*0.45+drift)*arc;
  }
  vec3 d=p-uMouse;
  p+=d/max(length(d),0.001)*0.16*exp(-dot(d,d)*3.0);
  // a wrong password: some bands of her jump sideways and every point shivers, a few times a second
  if(uGlitch>0.001){
    float tick=floor(uTime*18.0);
    float band=fract(sin(floor(p0.y*9.0)*91.7+tick*13.1)*4375.85);
    p.x+=(band-0.5)*0.6*uGlitch*step(0.6,band);
    p+=(hash3(p0*3.1+tick)-0.5)*0.07*uGlitch;
  }
  return p;
}
`;

export const PORTRAIT_POINTS_VS = /* glsl */ `
uniform float uSize;
uniform float uGain;
uniform float uFocus;
uniform float uFlash;
attribute float aBright;
varying float vB;
varying float vSoft;
varying vec2 vTone;
${DISPLACE}
void main(){
  float e,scan,lid,sh,tr;
  vec3 p=displace(position,e,scan,lid,sh,tr);
  // how near it is (0 at her back .. 1 at her front), for its colour
  float near=clamp(p.z*0.75+0.5,0.0,1.0);
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*mv;
  // the front: the points just leaving (or just landing) flare
  float front=smoothstep(0.0,0.06,e)*(1.0-smoothstep(0.06,0.5,e))+tr*0.5;
  float node=step(2.0,aSize);
  // out of focus behind her face (while she is whole): larger, its light spread over the larger disc
  float blur=smoothstep(0.15,0.7,uFocus-position.z)*(1.0-e)*(1.0-sh),grow=1.0+blur*1.3;
  gl_PointSize=max(1.0,uSize*aSize*grow*(1.0+front*1.4+e*0.25)*(6.0/max(-mv.z,0.1)));
  // in a form every point is lit about alike (her picture's dark parts would leave holes in it)
  float b=3.4*pow(mix(aBright,(0.42+0.3*aRandom)*pDim,sh),1.5)*(1.0+scan*1.3)*(1.0-0.6*lid)*(1.0+blur*0.6)/(grow*grow);
  b+=node*(0.35+0.35*sin(uTime*(1.5+aRandom*2.0)+aRandom*40.0));
  // a form's far side dimmer, its lit points (calls, the voice's peaks, the mark's ends) brighter
  b*=mix(1.0,0.4+0.6*near,sh);
  b+=pGlow*sh*1.6;
  b=b*mix(1.0,0.5+0.7*aRandom,e)+front*1.4;
  vB=b*uGain*(1.0+uFlash*1.6);
  vSoft=blur;
  vTone=vec2(near,clamp(pGlow*sh*0.8+uFlash*0.5,0.0,1.0));
}
`;

export const PORTRAIT_POINTS_FS = /* glsl */ `
uniform float uEnergy;
varying float vB;
varying float vSoft;
varying vec2 vTone;
void main(){
  float d=length(gl_PointCoord-0.5);
  if(d>0.5)discard;
  // in focus a bright core; out of focus a flatter disc
  float a=smoothstep(0.5,0.0,d);
  a=mix(a*a,a*0.7,vSoft)*vB*(0.85+0.3*uEnergy);
  // coloured by depth: a deep blue at her back, the blue through her, near-white blue nearest you (and
  // where a form is lit)
  vec3 c=mix(vec3(0.118,0.251,0.686),vec3(0.231,0.51,0.965),smoothstep(0.0,0.45,vTone.x));
  c=mix(c,vec3(0.859,0.918,0.996),clamp(smoothstep(0.7,1.0,vTone.x)*0.35+vTone.y,0.0,0.85));
  gl_FragColor=vec4(c*a,a);
}
`;

export const PORTRAIT_LINES_VS = /* glsl */ `
uniform float uFlash;
varying float vA;
${DISPLACE}
void main(){
  float e,scan,lid,sh,tr;
  vec3 p=displace(position,e,scan,lid,sh,tr);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
  // the constellation pulses: rings of light running out from her left eye; it fades as she comes apart or takes another form
  float pulse=0.3+0.7*pow(0.5+0.5*sin(length(position.xy-vec2(0.35,0.17))*7.0-uTime*2.6),4.0);
  vA=(1.0-e)*(1.0-e)*(1.0-sh)*(1.0-sh)*(1.0-tr)*pulse*(1.0+scan)*(1.0+uFlash*2.0);
}
`;

export const PORTRAIT_LINES_FS = /* glsl */ `
uniform float uEnergy;
varying float vA;
void main(){
  float a=vA*(0.45+0.3*uEnergy);
  gl_FragColor=vec4(vec3(0.231,0.51,0.965)*a,a);
}
`;

// network positions are -1..1 of the view at NET_Z (uView: its half size), so it stays left at any aspect
const NET = /* glsl */ `
uniform float uTime;
uniform vec2 uView;
uniform float uEnergy;
uniform float uLevel;
const float NET_Z=-3.0;
float fadeAcross(float x){
  return (1.0-smoothstep(-0.15,0.4,x))*uLevel;
}
`;
const SHADE = /* glsl */ `
uniform vec4 uShade;
float unshaded(){
  vec2 q=gl_FragCoord.xy,s=max(uShade.zw-uShade.xy,1.0)*0.12;
  return 1.0-0.4*smoothstep(-s.x,s.x,min(q.x-uShade.x,uShade.z-q.x))*smoothstep(-s.y,s.y,min(q.y-uShade.y,uShade.w-q.y));
}
`;
// links run the same drift from their nodes' places and seeds, so they stay attached
const NODE = /* glsl */ `
${NET}
vec3 nodeAt(vec3 b,float r){
  float t=uTime*(0.1+0.08*r)+r*40.0;
  vec2 n=b.xy+vec2(sin(t),cos(t*1.3))*0.04;
  return vec3(n.x*uView.x,n.y*uView.y,NET_Z+b.z);
}
`;

export const NODE_VS = /* glsl */ `
uniform float uPixelRatio;
attribute float aRandom;
attribute float aSize;
varying float vA;
varying float vHub;
${NODE}
void main(){
  vec4 mv=modelViewMatrix*vec4(nodeAt(position,aRandom),1.0);
  gl_Position=projectionMatrix*mv;
  // the glow falls off softly, so it's drawn well larger than the dot it reads as
  float s=uPixelRatio*aSize*2.6*(9.0/max(-mv.z,0.1)),m=1.5*uPixelRatio;
  gl_PointSize=max(s,m);
  vHub=step(4.0,aSize);
  vA=fadeAcross(position.x)*min(1.0,s/m)*(0.6+0.4*sin(uTime*(0.5+aRandom)+aRandom*30.0))*(1.0+0.3*uEnergy);
}
`;

export const NODE_FS = /* glsl */ `
varying float vA;
varying float vHub;
${SHADE}
void main(){
  float d=length(gl_PointCoord-0.5);
  if(d>0.5)discard;
  float g=smoothstep(0.5,0.0,d),core=smoothstep(0.2,0.05,d);
  float a=(g*g*0.9+core*1.3)*vA*unshaded();
  vec3 c=mix(vec3(0.231,0.51,0.965),vec3(0.576,0.773,0.992),core*(0.35+0.5*vHub));
  gl_FragColor=vec4(c*a,a);
}
`;

export const LINK_VS = /* glsl */ `
attribute float aRandom;
attribute float aEnd;
attribute float aSeed;
varying float vA;
varying float vT;
varying float vSeed;
${NODE}
void main(){
  gl_Position=projectionMatrix*modelViewMatrix*vec4(nodeAt(position,aRandom),1.0);
  vT=aEnd;
  vSeed=aSeed;
  vA=fadeAcross(position.x)*(1.0+0.3*uEnergy);
}
`;

export const LINK_FS = /* glsl */ `
uniform float uTime;
varying float vA;
varying float vT;
varying float vSeed;
${SHADE}
void main(){
  float h=fract(uTime*0.16+vSeed*7.0)*1.6-0.3;
  float pulse=step(0.66,vSeed)*exp(-pow((vT-h)*9.0,2.0));
  float a=(0.55+pulse*1.2)*vA*unshaded();
  vec3 c=mix(vec3(0.231,0.51,0.965),vec3(0.749,0.859,0.996),pulse);
  gl_FragColor=vec4(c*a,a);
}
`;

// position: (along 0..1, strand across 0..1, ribbon index); each a twisting band along a drifting Bezier
export const RIBBON_VS = /* glsl */ `
varying float vA;
${NET}
const vec2 PATH[12]=vec2[12](
  vec2(-0.12,1.2),vec2(-0.45,0.62),vec2(-0.85,0.62),vec2(-1.25,0.05),
  vec2(-1.25,0.42),vec2(-0.55,0.08),vec2(-0.5,-0.62),vec2(-0.02,-1.25),
  vec2(-1.25,-0.32),vec2(-0.85,-0.62),vec2(-0.32,-0.42),vec2(0.12,-1.2));
const vec3 WIDTH=vec3(0.17,0.22,0.13);
vec2 bez(vec2 a,vec2 b,vec2 c,vec2 d,float t){
  float u=1.0-t;
  return u*u*u*a+3.0*u*u*t*b+3.0*u*t*t*c+t*t*t*d;
}
vec2 bezDir(vec2 a,vec2 b,vec2 c,vec2 d,float t){
  float u=1.0-t;
  return 3.0*u*u*(b-a)+6.0*u*t*(c-b)+3.0*t*t*(d-c);
}
void main(){
  float t=position.x,k=position.y-0.5,f=position.z;
  int i=int(f+0.5);
  vec2 a=PATH[i*4],b=PATH[i*4+1],c=PATH[i*4+2],d=PATH[i*4+3];
  b+=0.1*vec2(sin(uTime*0.13+f*2.0),cos(uTime*0.11+f*1.3));
  c+=0.1*vec2(cos(uTime*0.09+f*1.7),sin(uTime*0.15+f*0.7));
  // in half-heights, so the curves keep their shape at any aspect
  vec2 asp=vec2(uView.x/uView.y,1.0);
  vec2 C=bez(a,b,c,d,t)*asp,T=normalize(bezDir(a,b,c,d,t)*asp),N=vec2(-T.y,T.x);
  C+=N*0.05*sin(t*7.0-uTime*0.4+f*2.0);
  float w=WIDTH[i]*(0.4+0.6*sin(3.14159*t));
  float th=t*8.2+uTime*0.3+f*1.9+k*0.9;
  float o=k*w*2.0;
  vec3 p=vec3((C+N*o*cos(th))*uView.y,NET_Z+o*sin(th)*uView.y*0.8);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
  float ends=smoothstep(0.0,0.1,t)*(1.0-smoothstep(0.9,1.0,t));
  vA=fadeAcross(C.x/asp.x)*ends*(0.7+0.3*sin(t*18.0-uTime*1.2+k*6.0))*(1.0+0.3*uEnergy);
}
`;

export const RIBBON_FS = /* glsl */ `
varying float vA;
${SHADE}
void main(){
  float a=0.5*vA*unshaded();
  gl_FragColor=vec4(vec3(0.231,0.51,0.965)*a,a);
}
`;

export const FIELD_VS = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
attribute float aRandom;
varying float vA;
void main(){
  vec3 p=position;
  // drifting slowly upward (wrapping round), swaying a little
  p.y=mod(p.y+uTime*(0.05+0.08*aRandom)+7.0,16.0)-7.0;
  p.x+=sin(uTime*0.12+aRandom*30.0)*0.3;
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*mv;
  float depth=-mv.z;
  float s=uPixelRatio*(2.0+3.5*aRandom)*(8.0/max(depth,0.1)),m=1.5*uPixelRatio;
  gl_PointSize=max(s,m);
  float tw=0.7+0.3*sin(uTime*(0.5+aRandom*1.2)+aRandom*50.0);
  vA=min(1.0,s/m)*tw*(1.0-smoothstep(20.0,34.0,depth))*smoothstep(3.0,7.0,depth)*smoothstep(-7.0,-5.0,p.y)*(1.0-smoothstep(7.0,9.0,p.y));
}
`;

export const FIELD_FS = /* glsl */ `
varying float vA;
void main(){
  float d=length(gl_PointCoord-0.5);
  if(d>0.5)discard;
  float a=smoothstep(0.5,0.0,d);
  a=a*a*vA*0.75;
  gl_FragColor=vec4(vec3(0.231,0.51,0.965)*a,a);
}
`;
