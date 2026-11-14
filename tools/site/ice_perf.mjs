#!/usr/bin/env node
// Racing-specific GPU frame intervals. No screenshots or other browser runs during measurement.
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import {launch} from './cdp.mjs';
const{values:o}=parseArgs({options:{out:{type:'string',default:'/tmp/ice-performance.json'},size:{type:'string',default:'1440x900'},runs:{type:'string',default:'3'}}});
const[width,height]=o.size.split('x').map(Number),runs=[];
const stats=iv=>{const a=[...iv].sort((a,b)=>a-b),q=f=>a[Math.min(a.length-1,Math.floor(a.length*f))];return{frames:a.length,p50:+q(.5).toFixed(2),p90:+q(.9).toFixed(2),worst:+a.at(-1).toFixed(2),over33:a.filter(x=>x>33.4).length};};
for(let run=0;run<+o.runs;run++){
 const b=await launch({preset:'gpu'});
 try{
  const p=await b.newPage({width,height,mobile:width<600});await p.goto('http://127.0.0.1:8100/');
  await p.eval(()=>{window.__frames=[];window.__stop=false;let last;const tick=t=>{if(last!==undefined)window.__frames.push(t-last);last=t;if(!window.__stop)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  await p.waitFor(async()=>{const{getScene}=await import('/static/site/scene/scene.js');return getScene()?.iceReady();},{timeout:30000});
  const prep=stats(await p.eval(()=>{window.__stop=true;return window.__frames;}));
  const phases={preparation:prep};
  await p.eval(async()=>{const{holdFor,HOLD,glassRaw}=await import('/static/site/lerp.js');const el=document.querySelector('.seam-hold[data-to="glass"]'),L=holdFor('glass',matchMedia('(pointer:coarse)').matches||innerWidth<700?HOLD.pinTouch:HOLD.pin),W_=el.parentElement.classList.contains('seam-wrap')?el.parentElement:el,T=W_.getBoundingClientRect().top+scrollY;window.__seek=P=>scrollTo({top:T-L.leadIn*innerHeight+glassRaw(P)*((W_===el?el.offsetHeight-innerHeight:el.offsetHeight)+(L.leadIn+L.leadOut)*innerHeight),behavior:'instant'});});
  for(const[name,a,z]of[['firstEntry',-.2,.52],['crescendo',.52,.84],['clearing',.84,1.2],['reverse',1.2,-.2]]){
   const iv=await p.eval((a,z)=>new Promise(resolve=>{let start,last;const frames=[];const tick=t=>{start??=t;if(last!==undefined)frames.push(t-last);last=t;const r=Math.min(1,(t-start)/1800);window.__seek(a+(z-a)*r);if(r<1)requestAnimationFrame(tick);else resolve(frames);};requestAnimationFrame(tick);}),a,z);phases[name]=stats(iv);
  }
  await p.eval(()=>scrollTo({top:0,behavior:'instant'}));await new Promise(r=>setTimeout(r,400));
  const iv=await p.eval(()=>new Promise(resolve=>{const frames=[];let last,start;const tick=t=>{start??=t;if(last!==undefined)frames.push(t-last);last=t;if(t-start<3600)requestAnimationFrame(tick);else resolve(frames);};requestAnimationFrame(tick);document.querySelector('a[href*="athletics"]:not(.ph)').click();}));phases.click=stats(iv);
  const state=await p.eval(async()=>{const{getScene}=await import('/static/site/scene/scene.js');const c=document.querySelector('.scene');return{...getScene().iceStats(),buffer:[c.width,c.height],page:location.pathname};});
  const problems=p.problems(),result={run:run+1,size:[width,height],phases,state,problems};runs.push(result);console.log(JSON.stringify(result));
 }finally{await b.close();}
}
fs.writeFileSync(o.out,JSON.stringify(runs,null,2));
if(runs.some(r=>r.state.fallback||r.problems.exceptions.length||Object.values(r.phases).some(s=>s.p90>17.5||s.worst>75)))process.exitCode=1;
