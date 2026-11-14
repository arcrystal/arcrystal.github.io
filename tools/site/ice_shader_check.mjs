#!/usr/bin/env node
// Exercise shipped GLSL helpers in a float render target, against the CPU plan and atlas.
import {launch} from './cdp.mjs';
import assert from 'node:assert/strict';
const b=await launch({preset:'gpu'});
try{
 const p=await b.newPage({width:390,height:844,mobile:true});await p.goto('http://127.0.0.1:8100/');
 const result=await p.eval(async()=>{
  const [{makeIcePlan,packIce,arrivalAt,clearAt,ownerAt,crackOpen,facetAt},{fragment,VERTEX},{MAIN}]=await Promise.all([import('/static/site/scene/ice-plan.js'),import('/static/site/scene/glsl/index.js'),import('/static/site/scene/glsl/opens.js')]);
  const plan=makeIcePlan(390,844),pack=packIce(plan),canvas=document.createElement('canvas');canvas.width=96;canvas.height=1;
  const gl=canvas.getContext('webgl2');if(!gl.getExtension('EXT_color_buffer_float'))throw Error('Float readback unavailable');
  const make=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const body=`void main(){R=vec2(390,844);float i=floor(gl_FragCoord.x);vec2 q=vec2(mod(i*47.,390.),mod(i*79.,844.));
    vec4 offsets=iceData(2),info=iceData(3);float best=1e20;int id=0;
    for(int j=0;j<24;j++){vec2 n=iceData(int(offsets.x)+j*4).xy;float d=dot(n-q,n-q);if(d<best){best=d;id=j;}}
    int base=int(offsets.x)+id*4;vec4 g=iceData(base),box=iceData(base+1),attr=iceData(base+2);
    vec2 f=clamp((q-box.xy)/box.zw,0.,1.);float field=iceAtlas(attr.xy+f*(info.z-1.)).x;
    float arrival=max(-.18+.62*(1.-q.y/844.),-.11+.39*(1.-g.y/844.)+attr.z+field);
    int edge=int(i);vec4 e=iceData(int(offsets.y)+edge*3+1);float P=.52+i*.003;
    float open=smoothstep(0.,.018,P-mix(e.x,e.y,.37));
    outColor=vec4(arrival,iceClear(q,R,.94,false),iceClear(q,R,1.04,true),open);
    // Row 1: the nested cut (iceCut) at the same points, against facetAt.
    if(gl_FragCoord.y>1.0){IceCut c=iceCut(q,g.xy,int(iceData(base+3).z),int(iceData(base+3).w),true);outColor=vec4(c.h,c.grad,0.);}
  }`;
  const program=gl.createProgram();gl.attachShader(program,make(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,make(gl.FRAGMENT_SHADER,fragment().replace(MAIN,body)));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  const texture=(unit,w,h,data)=>{const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return t;};
  texture(0,pack.width,pack.height,pack.data);texture(1,pack.aw,pack.ah,pack.atlas);gl.uniform1i(gl.getUniformLocation(program,'uReach'),0);gl.uniform1i(gl.getUniformLocation(program,'uIceAtlas'),1);gl.uniform2f(gl.getUniformLocation(program,'uPoint'),173,420);
  const target=texture(2,96,2,null),fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete float target');gl.viewport(0,0,96,2);gl.drawArrays(gl.TRIANGLES,0,3);
  const values=new Float32Array(96*2*4);gl.readPixels(0,0,96,2,gl.RGBA,gl.FLOAT,values);let arrivalError=0,scheduleError=0,cutError=0;
  for(let i=0;i<96;i++){const q=[i*47%390,i*79%844],refs=[arrivalAt(plan,q,ownerAt(plan,q)),clearAt(plan,q,.94),clearAt(plan,q,1.04,[173,420]),crackOpen(plan.cracks[i],.52+i*.003,.37)];arrivalError=Math.max(arrivalError,Math.abs(values[i*4]-refs[0]));for(let k=1;k<4;k++)scheduleError=Math.max(scheduleError,Math.abs(values[i*4+k]-refs[k]));const f=facetAt(plan,q),o=(96+i)*4;cutError=Math.max(cutError,Math.abs(values[o]-f.height)/23,Math.abs(values[o+1]-f.gradient[0]),Math.abs(values[o+2]-f.gradient[1]));}
  const error=gl.getError();gl.getExtension('WEBGL_lose_context').loseContext();return{samples:96,arrivalError,scheduleError,cutError,glError:error};
 });
 assert.ok(result.arrivalError<.01);assert.ok(result.scheduleError<.00001);assert.ok(result.cutError<1e-3);assert.equal(result.glError,0);console.log(JSON.stringify(result));
}finally{await b.close();}
