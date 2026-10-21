// GLSL for the 3D scene (ai-scene.tsx), additively blended in the Avortyx blue.
//  - PORTRAIT_*: the AI's portrait as points and constellation lines, moved by displace().
//  - NODE_*, LINK_*, RIBBON_*: the network behind the scene, on the left (network-field.tsx).
//  - FIELD_*: faint points drifting at many depths (depth-field.tsx).

// curl of a field of sines (simplex curl noise compiled too slowly and held up the first frame)
const FLOW = /* glsl */ `
vec3 flow(vec3 p,float t){
  return normalize(vec3(
    sin(p.y*1.7+t*0.3)+cos(p.z*1.3-t*0.2),
    sin(p.z*1.9-t*0.25)+cos(p.x*1.5+t*0.15),
    sin(p.x*1.4+t*0.2)+cos(p.y*1.1-t*0.3)
  )+vec3(0.0001));
}
`;

// e: how far a point has gone into the grid (0 whole .. 1 in it)
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
uniform vec2 uFace;
uniform float uPattern;
attribute float aRandom;
attribute float aSize;
${FLOW}
vec3 hash3(vec3 p){
  return fract(sin(vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))))*43758.5453);
}
const float VOX=0.11;
const float GRID=40.0;
// 0 first .. 1 last: lattice rows from the crown down
float order(vec3 p){
  return clamp(floor((1.4-p.y)/VOX)*VOX/2.8,0.0,1.0)*0.9+fract(aRandom*3.7)*0.1;
}
vec3 rotX(vec3 p,float a){
  float c=cos(a),s=sin(a);
  return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);
}
vec3 rotY(vec3 p,float a){
  float c=cos(a),s=sin(a);
  return vec3(c*p.x+s*p.z,p.y,c*p.z-s*p.x);
}
// uPattern: 0 swell with falling column lights, 1 bar chart, 2 ripples from landing calls, 3 contoured terrain
vec3 gridOf(vec3 p0,out float lit,out float scan){
  vec3 h=hash3(p0*1.37+0.3);
  vec2 cell=floor(h.xy*GRID),uv=(cell+0.5)/GRID*2.0-1.0;
  float y=0.0;
  lit=0.0;
  if(uPattern<0.5){
    y=0.09*sin(uv.x*3.2+uTime*1.1)*cos(uv.y*2.4-uTime*0.7)+0.04*sin((uv.x-uv.y)*5.0-uTime*1.8);
    float k=fract(sin(cell.x*12.9898+3.1)*43758.5453);
    float d=fract(uTime*(0.22+0.25*k)+k*9.0)*1.4-0.2-(uv.y*0.5+0.5);
    lit=step(0.5,k)*(d>0.0?exp(-d*7.0):exp(d*40.0));
  }else if(uPattern<1.5){
    vec2 bar=floor((uv*0.5+0.5)*vec2(8.0,4.0)),inBar=fract((uv*0.5+0.5)*vec2(8.0,4.0));
    float r=fract(sin(dot(bar,vec2(12.99,78.23)))*43758.55);
    float v=0.15+0.6*(0.5+0.5*sin(uTime*(0.6+r*0.9)+r*20.0))*(0.55+0.45*r);
    float gap=step(0.15,inBar.x)*step(inBar.x,0.85)*step(0.15,inBar.y)*step(inBar.y,0.85);
    y=v*h.z*gap;
    lit=gap*(0.25+exp(-pow((h.z-1.0)*6.0,2.0))*1.2);
  }else if(uPattern<2.5){
    for(int i=0;i<3;i++){
      float t=uTime*0.45+float(i)/3.0,n=floor(t),age=fract(t);
      vec2 c=fract(sin(vec2(n*17.1+float(i)*3.7,n*31.7+float(i)*9.1))*43758.55)*1.6-0.8;
      float r=length(uv-c),front=r-age*1.6;
      y+=0.12*sin(front*12.0)*exp(-front*front*20.0)*(1.0-age);
      lit+=exp(-front*front*120.0)*(1.0-age)*1.5+exp(-r*r*150.0)*(1.0-age);
    }
  }else{
    y=0.22*(sin(uv.x*2.1+1.3)*cos(uv.y*1.7-0.4)+0.45*sin(uv.x*4.3-uv.y*3.1+uTime*0.25));
    lit=smoothstep(0.36,0.5,abs(fract(y*9.0+uTime*0.35)-0.5))*1.1;
  }
  vec3 g=vec3(uv.x*1.3,y,uv.y*1.3)+(h-0.5)*0.012;
  scan=exp(-pow((uv.x-1.1*sin(uTime*0.6))*7.0,2.0));
  return rotX(rotY(g,0.25*sin(uTime*0.2)),0.95);
}
float eyeOf(vec2 p,out vec2 d){
  vec2 a=p-uEyes.xy,b=p-uEyes.zw;
  d=dot(a,a)<dot(b,b)?a:b;
  return exp(-pow(d.x/0.15,2.0)-pow(d.y/0.07,2.0));
}
// set by form(): fGlow lifts a point towards the ice accent, fDim dims it
float fGlow;
float fDim;
const vec2 CITY[10]=vec2[10](vec2(40.7,-74.0),vec2(34.0,-118.2),vec2(-23.5,-46.6),vec2(51.5,-0.1),vec2(6.5,3.4),
  vec2(25.2,55.3),vec2(19.1,72.9),vec2(1.3,103.8),vec2(35.7,139.7),vec2(-33.9,151.2));
const ivec2 CALL[12]=ivec2[12](ivec2(0,3),ivec2(0,1),ivec2(0,2),ivec2(3,4),ivec2(3,5),ivec2(5,6),ivec2(6,7),
  ivec2(7,8),ivec2(7,9),ivec2(8,1),ivec2(3,6),ivec2(1,9));
vec3 sph(vec2 ll){
  vec2 r=radians(ll);
  return vec3(cos(r.x)*sin(r.y),sin(r.x),cos(r.x)*cos(r.y));
}
// id: 0 her face (f), 1 globe with calls between cities, 2 speaking waveform, 3 the Avortyx mark
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
float pGlow;
float pDim;
float pGrid;
float pLit;
// lid: blink closure; sh: in a form rather than her face; tr: between two forms (1 midway)
vec3 displace(vec3 p0,out float e,out float scan,out float lid,out float sh,out float tr){
  vec3 p=p0;
  vec2 ed;
  float eye=eyeOf(p0.xy,ed);
  p.xy+=uGaze*vec2(0.035,0.02)*exp(-dot(ed,ed)/0.0025);
  p.y-=ed.y*0.85*uBlink*eye;
  lid=uBlink*eye;
  p.z+=0.015*sin(uTime*1.4+p0.y*2.0)+uRipple*0.07*sin(length(p0.xy-vec2(0.03,-0.14))*9.0-uTime*10.0);
  float sy=1.9-mod(uTime*0.4,4.8);
  scan=exp(-pow((p0.y-sy)*7.0,2.0));
  p.z+=scan*0.04;
  // her marked centre (the helmet) goes where she is placed; forms and grid centre themselves
  p.xy-=uFace;
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
  // pixelate into the lattice (s1), then fold into the grid (s2)
  float span=mix(0.32,0.3,uBack);
  float l=clamp((uProgress-order(p0)*(1.0-span))/span,0.0,1.0);
  e=l*l*(3.0-2.0*l);
  pGrid=0.0;
  pLit=0.0;
  if(e>0.001){
    float s1=smoothstep(0.0,0.45,e),s2=smoothstep(0.4,1.0,e),lit,gscan;
    vec3 vox=(floor(p0/VOX)+0.5)*VOX+(hash3(p0*2.3)-0.5)*VOX*0.3-vec3(uFace,0.0);
    vec3 g=gridOf(p0,lit,gscan);
    p=mix(mix(p,vox,s1),g,s2)+vec3(0.0,0.3,0.25)*sin(3.14159*s2)*(0.5+aRandom);
    pGrid=s2;
    pLit=lit*s2;
    scan=mix(scan,gscan,s2);
  }
  vec3 d=p-uMouse;
  p+=d/max(length(d),0.001)*0.16*exp(-dot(d,d)*3.0);
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
  float near=clamp(p.z*0.75+0.5,0.0,1.0);
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*mv;
  float front=smoothstep(0.0,0.06,e)*(1.0-smoothstep(0.06,0.5,e))*0.45+tr*0.5;
  float node=step(2.0,aSize);
  // depth of field: points behind her face drawn larger and dimmer
  float blur=smoothstep(0.15,0.7,uFocus-position.z)*(1.0-e)*(1.0-sh),grow=1.0+blur*1.3;
  gl_PointSize=max(1.0,uSize*aSize*grow*(1.0+front*1.4+e*0.25)*(6.0/max(-mv.z,0.1)));
  // in a form or the grid points are lit alike, or her picture's dark parts would leave holes
  float b=3.4*pow(mix(aBright,(0.42+0.3*aRandom)*pDim,sh),1.5)*(1.0+scan*1.3)*(1.0-0.6*lid)*(1.0+blur*0.6)/(grow*grow);
  b+=node*(0.35+0.35*sin(uTime*(1.5+aRandom*2.0)+aRandom*40.0));
  b*=mix(1.0,0.4+0.6*near,sh);
  b+=pGlow*sh*1.6;
  b=mix(b*(1.0+0.5*e),0.7+0.3*aRandom,pGrid)+pLit*2.4+front*1.4;
  vB=b*uGain*(1.0+uFlash*1.6);
  vSoft=blur;
  vTone=vec2(near,clamp(pGlow*sh*0.8+pLit*0.7+uFlash*0.5,0.0,1.0));
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
  float a=smoothstep(0.5,0.0,d);
  a=mix(a*a,a*0.7,vSoft)*vB*(0.85+0.3*uEnergy);
  // deep blue at her back to near-white nearest you
  vec3 c=mix(vec3(0.118,0.251,0.686),vec3(0.231,0.51,0.965),smoothstep(0.0,0.45,vTone.x));
  c=mix(c,vec3(0.859,0.918,0.996),clamp(smoothstep(0.7,1.0,vTone.x)*0.2+vTone.y,0.0,0.6));
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
  float pulse=0.3+0.7*pow(0.5+0.5*sin(length(position.xy-vec2(0.35,0.17))*7.0-uTime*2.6),4.0);
  vA=(1.0-e)*(1.0-e)*(1.0-sh)*(1.0-sh)*(1.0-tr)*pulse*(1.0+scan)*(1.0+uFlash*2.0);
}
`;

export const PORTRAIT_LINES_FS = /* glsl */ `
uniform float uEnergy;
varying float vA;
void main(){
  float a=vA*(0.22+0.15*uEnergy);
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
