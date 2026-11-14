#!/usr/bin/env node
// Reproducible visual review of Racing, at actual scroll positions. No production debug hooks.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {launch} from './cdp.mjs';
const {values:o}=parseArgs({options:{out:{type:'string',default:'/tmp/racing-review'},size:{type:'string',default:'1440x900'},base:{type:'string',default:'http://127.0.0.1:8100'},points:{type:'string',default:'-0.2,0,0.18,0.38,0.58,0.68,0.76,0.84,0.94,1.04,1.12'},preset:{type:'string',default:'gpu'}}});
const [width,height]=o.size.split('x').map(Number),points=o.points.split(',').map(Number),dir=path.join(o.out,o.size);fs.mkdirSync(dir,{recursive:true});
const b=await launch({preset:o.preset});
try{
 const page=await b.newPage({width,height,mobile:width<600});
 await page.goto(o.base,{waitUntil:'load'});
 await page.waitFor(async()=>{const {getScene}=await import('/static/site/scene/scene.js');return getScene()?.iceReady();},{timeout:30000});
 const stats=await page.eval(async()=>{const {getScene}=await import('/static/site/scene/scene.js');return getScene().iceStats();});
 const samples=[];
 for(const P of points){
  await page.eval(async P=>{const{holdFor,HOLD,glassRaw}=await import('/static/site/lerp.js');const el=document.querySelector('.seam-hold[data-to="glass"]');const L=holdFor('glass',matchMedia('(pointer:coarse)').matches||innerWidth<700?HOLD.pinTouch:HOLD.pin),raw=glassRaw(P),W_=el.parentElement.classList.contains('seam-wrap')?el.parentElement:el,T=W_.getBoundingClientRect().top+scrollY;scrollTo({top:T-L.leadIn*innerHeight+raw*((W_===el?el.offsetHeight-innerHeight:el.offsetHeight)+(L.leadIn+L.leadOut)*innerHeight),behavior:'instant'});},P);
  await new Promise(r=>setTimeout(r,300));
  const file=`P${P.toFixed(2)}.png`;await page.screenshot(path.join(dir,file));
  const state=await page.eval(()=>{const r=document.querySelector('#band-racing-title').getBoundingClientRect(),c=document.querySelector('.scene');return{scrollY,title:{x:r.x,y:r.y,w:r.width,h:r.height},buffer:[c.width,c.height],gl:document.documentElement.classList.contains('gl')};});samples.push({P,file,...state});
 }
 const report={size:o.size,stats,samples,problems:page.problems()};fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await b.close();}
