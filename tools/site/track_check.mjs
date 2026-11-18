#!/usr/bin/env node
// Focused Racing playback: exact progress seeks, screenshots and frame pacing.
// node tools/site/track_check.mjs [--size 1440x900] [--out /tmp/racing-track] [--preset gpu|nowebgl] [--reduced-motion]
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {launch} from './cdp.mjs';
const {values:o}=parseArgs({options:{size:{type:'string',default:'1440x900'},out:{type:'string',default:'/tmp/racing-track'},preset:{type:'string',default:'gpu'},'reduced-motion':{type:'boolean',default:false},lifecycle:{type:'boolean',default:false},paused:{type:'boolean',default:false},'context-loss':{type:'boolean',default:false}}});
const [width,height]=o.size.split('x').map(Number),wait=ms=>new Promise(r=>setTimeout(r,ms));
fs.mkdirSync(o.out,{recursive:true});
const browser=await launch({preset:o.preset});
try{
 const page=await browser.newPage({width,height,deviceScaleFactor:width<600?2:1,mobile:width<600});
 await page.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.__trackWarnings=[];window.__trackDraws=[];if(typeof WebGL2RenderingContext!=='undefined'){const draw=WebGL2RenderingContext.prototype.drawArraysInstanced;WebGL2RenderingContext.prototype.drawArraysInstanced=function(...a){if(a[2]===6&&a[3]>100){window.__trackDraws.push(a[3]);if(window.__trackDraws.length>100)window.__trackDraws.shift();}return draw.apply(this,a);};}const warn=console.warn;console.warn=(...a)=>{window.__trackWarnings.push(a.map(String).join(' '));warn.apply(console,a);};"});
 if(o.paused)await page.send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.setItem('ac-motion','paused');"});
 if(o['reduced-motion'])await page.setMedia({reducedMotion:true});
 await page.goto('http://localhost:8100/',{waitUntil:'load'});
 await page.waitFor(()=>document.documentElement.classList.contains('app-ready'));
 if(!o.paused&&!o['reduced-motion']&&o.preset!=='nowebgl')await page.waitFor(async()=>{const {getScene}=await import('/static/site/scene/scene.js');return getScene()?.iceReady();},{timeout:120000});
 await page.waitFor(()=>!document.documentElement.classList.contains('site-loading'),{timeout:125000});
 await wait(1000);
 const seek=async P=>page.eval(async P=>{
   const {glassRaw,holdFor,HOLD}=await import('/static/site/lerp.js');
   const band=document.querySelector('[data-band="racing"]'),wrap=band.closest('.seam-wrap');
   if(!wrap){scrollTo({top:band.getBoundingClientRect().top+scrollY-90,behavior:'instant'});return false;}
   const h=wrap.querySelector('[data-to="glass"]'),top=wrap.getBoundingClientRect().top+scrollY,lead=holdFor('glass').leadIn*innerHeight;
   scrollTo({top:top-lead+glassRaw(P,innerWidth<700||matchMedia('(pointer:coarse)').matches?HOLD.pinTouch:HOLD.pin)*(h.offsetHeight+lead),behavior:'instant'});return true;
 },P);
 await seek(-.2);await wait(1000);
 for(const P of [.50,.54,.58,.65,.78,.84,.89,.93,.97,1.02,1.08,1.14,1.19]){
   await page.eval(()=>{window.__trackDraws=[];});
   const on=await seek(P);await wait(350);
   if(P===.89&&on&&!(await page.eval(()=>window.__trackDraws.length)))throw new Error('The full shard transition did not draw (unexpected plain fallback).');await page.screenshot(path.join(o.out,`p${P}.png`));if(!on)break;
 }
 // Exercise moving playback in both directions rather than relying solely on exact seeks.
 const pacing=await page.eval(async()=>{
   const {glassRaw,holdFor,HOLD}=await import('/static/site/lerp.js');
   const band=document.querySelector('[data-band="racing"]'),wrap=band.closest('.seam-wrap');if(!wrap)return null;
   const h=wrap.querySelector('[data-to="glass"]'),top=wrap.getBoundingClientRect().top+scrollY,lead=holdFor('glass').leadIn*innerHeight,dt=[],raf=[];
   let last=performance.now(),lastStamp=null;
   for(let i=0;i<220;i++){
     const stamp=await new Promise(requestAnimationFrame);if(lastStamp!==null)raf.push(stamp-lastStamp);lastStamp=stamp;const t=performance.now();dt.push(t-last);last=t;
     const P=i<140?.52+i/140*.65:1.17-(i-140)/80*.65;
     scrollTo({top:top-lead+glassRaw(P,innerWidth<700||matchMedia('(pointer:coarse)').matches?HOLD.pinTouch:HOLD.pin)*(h.offsetHeight+lead),behavior:'instant'});
   }
   dt.sort((a,b)=>a-b);raf.sort((a,b)=>a-b);return {p50:dt[110],p90:dt[198],worst:dt[219],rafP90:raf[Math.floor(raf.length*.9)],rafWorst:raf.at(-1),missedFrames:raf.filter(x=>x>25).length};
 });
 await seek(.9);await wait(300);await page.screenshot(path.join(o.out,'reverse-p0.9.png'));
 await seek(1.19);await wait(300);
 await page.eval(()=>scrollBy({top:200,behavior:'instant'}));await wait(350);
 await page.screenshot(path.join(o.out,'released.png'));
 if(o.lifecycle){
   for(const [w,h] of [[900,650],[390,844],[width,height]])await page.setViewport({width:w,height:h,deviceScaleFactor:1});
   await page.waitFor(async()=>{const {getScene}=await import('/static/site/scene/scene.js');return getScene()?.iceReady();},{timeout:120000});await seek(-.2);await wait(800);await seek(.9);await wait(400);
   await page.screenshot(path.join(o.out,'resized-p0.9.png'));
   if(!(await page.eval(()=>window.__trackDraws.length)))throw new Error('Resize did not recover the shard renderer.');
   await page.click('.site-nav [data-nav="racing"]');
   await page.waitFor(()=>location.pathname.includes('/athletics/'),{timeout:12000});await wait(2000);
   await page.screenshot(path.join(o.out,'destination.png'));
 }
 if(o['context-loss']){
   if(!(await page.eval(()=>!!document.querySelector('[data-band="racing"]')))){await page.goto('http://localhost:8100/',{waitUntil:'load'});await page.waitFor(async()=>{const {getScene}=await import('/static/site/scene/scene.js');return getScene()?.iceReady();},{timeout:120000});}
   await page.eval(()=>{const c=document.querySelector('canvas'),gl=c.getContext('webgl2');window.__lostGL=gl.getExtension('WEBGL_lose_context');window.__lostGL.loseContext();});
   await wait(300);await page.screenshot(path.join(o.out,'context-lost.png'));
   await page.eval(()=>window.__lostGL.restoreContext());
   await page.waitFor(async()=>{const {getScene}=await import('/static/site/scene/scene.js');return getScene()?.iceReady();},{timeout:120000});
   await seek(-.2);await wait(300);await seek(.84);await wait(300);await page.screenshot(path.join(o.out,'context-restored.png'));
 }
 console.log(JSON.stringify({size:o.size,pacing,card:await page.eval(()=>{const r=document.querySelector('.r-band-race')?.getBoundingClientRect();if(!r)return null;return [r.x,r.y,r.width,r.height];}),warnings:await page.eval(()=>window.__trackWarnings),problems:page.problems()},null,2));
 const p=page.problems();if((await page.eval(()=>window.__trackWarnings)).length||p.consoleErrors.length||p.exceptions.length||p.httpErrors.length||p.failedRequests.length)process.exitCode=1;
}finally{await browser.close();}
