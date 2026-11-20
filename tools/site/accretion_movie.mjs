#!/usr/bin/env node
// Real-time CDP screencasts; timestamps are preserved in the ffmpeg concat manifest.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {launch} from './cdp.mjs';
const{values:o}=parseArgs({options:{seam:{type:'string',default:'glass'},out:{type:'string',default:'/tmp/accretion-movies'},quarter:{type:'boolean',default:false},size:{type:'string',default:'1440x900'}}});
const[width,height]=o.size.split('x').map(Number);fs.mkdirSync(o.out,{recursive:true});
if(!['glass','ink'].includes(o.seam))throw Error('Expected --seam glass or ink');
const ink=o.seam==='ink';
const b=await launch({preset:'gpu'});
try{
 const p=await b.newPage({width,height,mobile:width<600,timeout:o.quarter?145000:40000});await p.goto('http://127.0.0.1:8100/');
 await p.waitFor(()=>!document.documentElement.classList.contains('site-loading'),{timeout:125000});
 await p.eval(async seam=>{
   const {getScene}=await import('/static/site/scene/scene.js');
   const {holdFor,HOLD,glassRaw,inkRaw}=await import('/static/site/lerp.js');
   if(!(seam==='ink'?getScene()?.inkReady():getScene()?.iceReady()))throw Error('Missing prepared '+seam);
   const el=document.querySelector('.seam-hold[data-to="'+seam+'"]');
   const pin=matchMedia('(pointer:coarse)').matches||innerWidth<700?HOLD.pinTouch:HOLD.pin;
   const L=holdFor(seam,pin),wrap=el.closest('.seam-wrap')||el,raw=seam==='ink'?inkRaw:glassRaw;
   const shift=Number.parseFloat(getComputedStyle(wrap.querySelector('.band')).getPropertyValue('--held-shift'))||0;
   const start=wrap.getBoundingClientRect().top+scrollY-L.leadIn*innerHeight;
   const travel=el.offsetHeight+shift+(L.leadIn+L.leadOut)*innerHeight;
   const seekRaw=r=>scrollTo({top:start+r*travel,behavior:'instant'});
   window.__seek=P=>seekRaw(raw(P,pin));
   window.__scrollInk=(a,z,t)=>seekRaw(raw(a,pin)+(raw(z,pin)-raw(a,pin))*t);
 },o.seam);
 async function record(name,action){
  const dir=path.join(o.out,`${o.size}-${name}-frames`);fs.mkdirSync(dir,{recursive:true});const frames=[];
  const off=p.on('Page.screencastFrame',e=>{const file=`${String(frames.length).padStart(5,'0')}.jpg`;fs.writeFileSync(path.join(dir,file),Buffer.from(e.data,'base64'));frames.push({file,time:e.metadata.timestamp});p.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});});
  await p.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:width,maxHeight:height,everyNthFrame:2});await action();await new Promise(r=>setTimeout(r,180));await p.send('Page.stopScreencast');off();
  const manifest=frames.map((f,i)=>`file '${f.file}'\nduration ${Math.min(.25,Math.max(.01,(frames[i+1]?.time??f.time+1/30)-f.time))}`).join('\n')+`\nfile '${frames.at(-1).file}'\n`;
  fs.writeFileSync(path.join(dir,'frames.txt'),manifest);
  const target=path.join(o.out,`${o.size}-${name}.mp4`),r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',path.join(dir,'frames.txt'),'-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',target],{encoding:'utf8'});
  if(r.status)throw Error(r.stderr);console.log(target,frames.length,'frames');
 }
 const first=ink?-.08:.49;
 const takes=o.quarter?[['quarter',first,1.2]]:[['forward',first,1.2],['reverse',1.2,first]];
 for(const[name,a,z]of takes){
  await p.eval(a=>window.__seek(a),a);await new Promise(r=>setTimeout(r,350));
  await record(name,()=>p.eval((a,z,ink,speed)=>new Promise(resolve=>{let start;const tick=t=>{start??=t;const elapsed=(t-start)*speed;
    const holds=ink?Math.min(1100,Math.max(0,elapsed-12800))+Math.min(700,Math.max(0,elapsed-19000)):0;
    const r=Math.min(1,(elapsed-holds)/(ink?25100:14000));
    if(ink)window.__scrollInk(a,z,r);else window.__seek(a+(z-a)*r);
    if(r<1)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);}),a,z,ink,o.quarter?.25:1));
 }
 const sheets=path.join(o.out,`${o.size}-stages`);fs.mkdirSync(sheets,{recursive:true});
 let frame=0;for(const P of ink?[.09,.49,.564,.62,.645,.68,.72,.786,.84,.94,1.09,1.12,1.138,1.145,1.16,1.195]:[.50,.54,.58,.70,.84,.89,.93,.97,1.02,1.08,1.14,1.2]){
  await p.eval(P=>window.__seek(P),P);await new Promise(r=>setTimeout(r,240));
  await p.screenshot(path.join(sheets,`${String(frame++).padStart(2,'0')}-P${P}.png`));
 }
 const contact=path.join(o.out,`${o.size}-contact.png`);
 const tiled=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-pattern_type','glob','-i',path.join(sheets,'*.png'),'-vf',`scale=${width<600?195:360}:-1,tile=4x3`,'-frames:v','1',contact],{encoding:'utf8'});
 if(tiled.status)throw Error(tiled.stderr);console.log(contact);
 const problems=p.problems();fs.writeFileSync(path.join(o.out,`${o.size}-movie-checks.json`),JSON.stringify(problems,null,2));if(p.console.some(v=>v.type==='warning'&&/did not build|INVALID_|framebuffer incomplete/i.test(v.text))||problems.exceptions.length||problems.consoleErrors.length)throw Error(JSON.stringify(problems));
}finally{await b.close();}
