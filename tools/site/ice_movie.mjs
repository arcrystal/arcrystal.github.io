#!/usr/bin/env node
// Real-time CDP screencasts; timestamps are preserved in the ffmpeg concat manifest.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {launch} from './cdp.mjs';
const{values:o}=parseArgs({options:{out:{type:'string',default:'/tmp/ice-movies'},size:{type:'string',default:'1440x900'}}});
const[width,height]=o.size.split('x').map(Number);fs.mkdirSync(o.out,{recursive:true});
const b=await launch({preset:'gpu'});
try{
 const p=await b.newPage({width,height,mobile:width<600});await p.goto('http://127.0.0.1:8100/');await p.waitFor(async()=>{const{getScene}=await import('/static/site/scene/scene.js');return getScene()?.iceReady();},{timeout:30000});
 await p.eval(async()=>{const{holdFor,HOLD,glassRaw}=await import('/static/site/lerp.js');const el=document.querySelector('.seam-hold[data-to="glass"]'),L=holdFor('glass',matchMedia('(pointer:coarse)').matches||innerWidth<700?HOLD.pinTouch:HOLD.pin),W_=el.parentElement.classList.contains('seam-wrap')?el.parentElement:el,T=W_.getBoundingClientRect().top+scrollY;window.__seek=P=>scrollTo({top:T-L.leadIn*innerHeight+glassRaw(P)*((W_===el?el.offsetHeight-innerHeight:el.offsetHeight)+(L.leadIn+L.leadOut)*innerHeight),behavior:'instant'});});
 async function record(name,action){
  const dir=path.join(o.out,`${o.size}-${name}-frames`);fs.mkdirSync(dir,{recursive:true});const frames=[];
  const off=p.on('Page.screencastFrame',e=>{const file=`${String(frames.length).padStart(5,'0')}.jpg`;fs.writeFileSync(path.join(dir,file),Buffer.from(e.data,'base64'));frames.push({file,time:e.metadata.timestamp});p.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});});
  await p.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:width,maxHeight:height,everyNthFrame:2});await action();await new Promise(r=>setTimeout(r,180));await p.send('Page.stopScreencast');off();
  const manifest=frames.map((f,i)=>`file '${f.file}'\nduration ${Math.min(.25,Math.max(.01,(frames[i+1]?.time??f.time+1/30)-f.time))}`).join('\n')+`\nfile '${frames.at(-1).file}'\n`;
  fs.writeFileSync(path.join(dir,'frames.txt'),manifest);
  const target=path.join(o.out,`${o.size}-${name}.mp4`),r=spawnSync('/opt/homebrew/bin/ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',path.join(dir,'frames.txt'),'-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',target],{encoding:'utf8'});
  if(r.status)throw Error(r.stderr);console.log(target,frames.length,'frames');
 }
 for(const[name,a,z]of[['forward',-.2,1.12],['reverse',1.12,-.2]]){
  await p.eval(a=>window.__seek(a),a);await new Promise(r=>setTimeout(r,350));
  await record(name,()=>p.eval((a,z)=>new Promise(resolve=>{let start;const tick=t=>{start??=t;const r=Math.min(1,(t-start)/8000);window.__seek(a+(z-a)*r);if(r<1)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);}),a,z));
 }
 await p.eval(()=>scrollTo({top:0,behavior:'instant'}));await new Promise(r=>setTimeout(r,300));
 await record('click',async()=>{await p.eval(()=>document.querySelector('a[href*="athletics"]:not(.ph)').click());await p.waitFor(()=>location.pathname.includes('athletics')&&!document.documentElement.dataset.xp,{timeout:12000});});
 const problems=p.problems();fs.writeFileSync(path.join(o.out,`${o.size}-movie-checks.json`),JSON.stringify(problems,null,2));if(problems.exceptions.length||problems.consoleErrors.length)throw Error(JSON.stringify(problems));
}finally{await b.close();}
