#!/usr/bin/env node
// Opening readiness, focus/scroll isolation, ambient circulation and the larger resting artwork.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { launch } from './cdp.mjs';
const {values:o}=parseArgs({options:{size:{type:'string',default:'1440x900'},out:{type:'string',default:'/tmp/scene-opening'},mode:{type:'string',default:'normal'}}});
const [width,height]=o.size.split('x').map(Number),sleep=ms=>new Promise(r=>setTimeout(r,ms));
fs.mkdirSync(o.out,{recursive:true});
const browser=await launch({preset:o.mode==='no-gl'?'nowebgl':'gpu'});
try {
 const page=await browser.newPage({width,height,deviceScaleFactor:1,mobile:width<600});
 if(o.mode==='low-refresh') await page.send('Page.addScriptToEvaluateOnNewDocument',{source:`
   // Deliver every other frame after loading, as on a 30 Hz display.
   const frame = requestAnimationFrame.bind(window);
   window.requestAnimationFrame = fn => frame(t => window.__slowFrames ? frame(fn) : fn(t));
   window.__transitionDraws = 0;
   const draw = WebGL2RenderingContext.prototype.drawArraysInstanced;
   WebGL2RenderingContext.prototype.drawArraysInstanced = function(...args) {
     if (args[3] > 100) window.__transitionDraws++;
     return draw.apply(this,args);
   };
 `});
 if(o.mode==='reduced')await page.setMedia({reducedMotion:true});
 if(o.mode==='paused')await page.send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.setItem('ac-motion','paused')"});
 if(o.mode==='failed-worker')await page.send('Page.addScriptToEvaluateOnNewDocument',{source:"const W=Worker;window.Worker=class extends W{constructor(url,opts){if(String(url).includes('dew-worker'))throw new Error('Test blocked worker');super(url,opts)}}"});
 if(o.mode==='failed-shell')await page.send('Network.setBlockedURLs',{urls:['*shell.js*']});
 const start=Date.now();await page.goto('http://localhost:8100/',{waitUntil:'load'});
 await sleep(700);await page.screenshot(path.join(o.out,'loading.png'));
 const initial=await page.eval(()=>({loading:document.documentElement.classList.contains('site-loading'),inert:document.querySelector('main').inert,focus:document.activeElement?.className,status:document.querySelector('[data-loading-status]')?.textContent}));
 if(o.mode==='normal'||o.mode==='skip'){
   assert.equal(initial.loading,true);assert.equal(initial.inert,true);
   await page.wheel(600,{x:width/2,y:height/2});await sleep(100);
   assert.equal(await page.eval(()=>scrollY),0,'the opening screen prevents hidden scrolling');
 }
 if(o.mode==='skip')await page.click('.loading-enter');
 await page.waitFor(()=>!document.documentElement.classList.contains('site-loading'),{timeout:125000});
 const elapsedMs=Date.now()-start;
 const loaded=await page.eval(async()=>{
  const {getScene}=await import('/static/site/scene/scene.js');const s=getScene();
  return {status:s?.loadingStatus(),ice:s?.iceReady(),ink:s?.inkReady(),inert:document.querySelector('main').inert,paused:document.documentElement.classList.contains('motion-paused')};
 });
 assert.equal(loaded.inert,false);if(o.mode==='normal'){assert.equal(loaded.status.ready,true);assert.equal(loaded.ice,true);assert.equal(loaded.ink,true);}
 if(o.mode==='skip')assert.equal(loaded.paused,true);
 await page.screenshot(path.join(o.out,'entered.png'));
 if(o.mode==='low-refresh'){
   assert.equal(loaded.status.ready,true);
   await page.eval(()=>{
     const spacer=document.querySelector('.seam-hold[data-to="cosmos"]');
     scrollBy(0,spacer.getBoundingClientRect().top+spacer.offsetHeight*.43);
     window.__slowFrames=true;
   });
   await sleep(6500);
   const draws=await page.eval(()=>window.__transitionDraws);
   await sleep(500);
   assert.ok(await page.eval(()=>document.querySelectorAll('.seam-hold').length===5 && scrollY>0));
   assert.ok(await page.eval(()=>window.__transitionDraws)>draws,'the transition keeps drawing after 90 slow frames');
 }
 if(o.mode==='direct-ink'){
   assert.equal(loaded.ink,true);
   const result=await page.eval(async()=>{
     const { getScene }=await import('/static/site/scene/scene.js');
     const spacer=document.querySelector('.seam-hold[data-to="ink"]');
     const band=spacer.parentElement.querySelector('.band--chess');
     const board=band.querySelector('.pv-board-wrap');
     const offset=()=>board.getBoundingClientRect().top-band.getBoundingClientRect().top;
     const before=offset(), top=spacer.parentElement.getBoundingClientRect().top+scrollY;
     scrollTo({top:top+.48*spacer.offsetHeight,behavior:'instant'});
     let invalid=0;
     for(let i=0;i<100;i++){
       await new Promise(requestAnimationFrame);
       if(!getScene().inkReady()) invalid++;
     }
     return {before,after:offset(),invalid};
   });
   assert.ok(Math.abs(result.after-result.before)<1,'entering the band must preserve the baked board position '+JSON.stringify(result));
   assert.equal(result.invalid,0,'the prepared ink remains usable on first entry');
 }
 let card=null;
 if(o.mode==='normal'){
  const seek=async P=>page.eval(async P=>{
   const {glassRaw,holdFor,HOLD}=await import('/static/site/lerp.js');
   const band=document.querySelector('[data-band="racing"]'),wrap=band.closest('.seam-wrap'),h=wrap.querySelector('[data-to="glass"]');
   const top=wrap.getBoundingClientRect().top+scrollY,lead=holdFor('glass').leadIn*innerHeight;
   scrollTo({top:top-lead+glassRaw(P,innerWidth<700||matchMedia('(pointer:coarse)').matches?HOLD.pinTouch:HOLD.pin)*(h.offsetHeight+lead),behavior:'instant'});
  },P);
  await seek(-.2);await sleep(600);
  for(const P of [.84,.89,.97,1.02,1.08,1.14,1.19]){
   await seek(P);await sleep(450);await page.screenshot(path.join(o.out,`p${P}-a.png`));
   if(P===.89||P===.97||P===1.19){await sleep(1800);await page.screenshot(path.join(o.out,`p${P}-b.png`));}
  }
  card=await page.eval(()=>{const r=document.querySelector('.r-band-race').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,viewport:[innerWidth,innerHeight]};});
  assert.equal(card.viewport[0],width,'the enlarged track must not widen the mobile viewport');
 }
 const result={size:o.size,mode:o.mode,elapsedMs,initial,loaded,card,problems:page.problems()};
 fs.writeFileSync(path.join(o.out,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 if(o.mode!=='failed-shell'){assert.equal(result.problems.consoleErrors.length,0);assert.equal(result.problems.exceptions.length,0);}
}finally{await browser.close();}
