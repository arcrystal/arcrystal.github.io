#!/usr/bin/env node
// Browser acceptance: frozen-input reversibility, cover/swap continuity, navigation and recovery.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {launch} from './cdp.mjs';
const {values:o}=parseArgs({options:{out:{type:'string',default:'/tmp/ice-browser'},base:{type:'string',default:'http://127.0.0.1:8100'}}});
fs.mkdirSync(o.out,{recursive:true});
const report={checks:[]},sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ready=p=>p.waitFor(async()=>{const {getScene}=await import('/static/site/scene/scene.js');return getScene()?.iceReady();},{timeout:30000});
const check=(label,v)=>{assert.ok(v,label);report.checks.push(label);console.log('ok',label);};
const b=await launch({preset:'gpu'});
try{
 const p=await b.newPage({width:1440,height:900});
 await p.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__clock=1000;const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>raf(()=>fn(window.__clock));`});
 await p.goto(o.base);await ready(p);
 await p.eval(()=>{const st=document.createElement('style');st.textContent='*,*::before,*::after{animation-play-state:paused!important;transition:none!important}';document.head.append(st);});
 const seek=async P=>{await p.eval(async P=>{
   const{holdFor,HOLD,glassRaw}=await import('/static/site/lerp.js');const el=document.querySelector('.seam-hold[data-to="glass"]'),L=holdFor('glass',HOLD.pin),raw=glassRaw(P),W_=el.parentElement.classList.contains('seam-wrap')?el.parentElement:el,T=W_.getBoundingClientRect().top+scrollY;
   scrollTo({top:T-L.leadIn*innerHeight+raw*((W_===el?el.offsetHeight-innerHeight:el.offsetHeight)+(L.leadIn+L.leadOut)*innerHeight),behavior:'instant'});
 },P);await sleep(160);};
 for(const P of [.18,.58,.76,.94]){
  await seek(P);await p.screenshot(path.join(o.out,`forward-${P}.png`));
  await seek(1.12);await seek(P);await p.screenshot(path.join(o.out,`reverse-${P}.png`));
 }
 // Real renderer at the two sides of the page swap, with one immutable click origin.
 await p.eval(async()=>{scrollTo({top:0,behavior:'instant'});const{getScene}=await import('/static/site/scene/scene.js');window.__run=getScene().open('glass',{point:{x:500,y:260}});window.__run.skip();});
 await sleep(150);await p.screenshot(path.join(o.out,'cover-end.png'));
 await p.eval(()=>{window.__reveal=window.__run.reveal();});await sleep(150);await p.screenshot(path.join(o.out,'reveal-start.png'));
 await p.eval(async()=>{window.__run.skip();await window.__reveal;});
 check('skip releases the material and DOM aperture',await p.eval(()=>!document.querySelector('.scene.is-front')&&!document.documentElement.hasAttribute('data-xp-reveal')));
 await p.eval(async()=>{const{getScene}=await import('/static/site/scene/scene.js');const a=getScene().open('glass',{point:{x:30,y:60}});const pending=a.covered;a.cancelNow();window.__cancelled=await pending;});
 check('immediate cancellation settles the pending cover',await p.eval(()=>window.__cancelled===false));
 await p.eval(async()=>{const{getScene}=await import('/static/site/scene/scene.js');window.__failed=getScene().open('glass',{point:{x:60,y:90}});window.__failed.skip();window.__failed.slow();});
 await sleep(150);await p.screenshot(path.join(o.out,'slow-cover-before.png'));await sleep(300);await p.screenshot(path.join(o.out,'slow-cover-after.png'));
 await p.eval(()=>window.__failed.fail());
 for(let i=0;i<4;i++){await p.eval(()=>window.__clock+=100);await sleep(40);}
 check('failed navigation releases its held cover',await p.eval(()=>!document.querySelector('.scene.is-front')&&!document.querySelector('.xp-wait')));
 check('frozen-input capture has no browser errors',!p.problems().exceptions.length&&!p.problems().consoleErrors.length);
 // Navigation uses the unmodified browser clock and router.
 const n=await b.newPage({width:1440,height:900});await n.goto(o.base);await ready(n);
 await n.eval(()=>document.querySelector('a.ph[href*="athletics"]').click());
 await n.waitFor(()=>location.pathname.includes('athletics')&&!document.documentElement.dataset.xp,{timeout:12000});
 check('Racing navigation settles and reveals the hero',await n.eval(()=>!!document.querySelector('[data-hero] h1')&&!document.querySelector('.scene.is-front')));
 await n.screenshot(path.join(o.out,'racing-click-complete.png'));
 await n.goto(o.base);await ready(n);
 await n.eval(()=>{document.querySelector('a.ph[href*="athletics"]').click();setTimeout(()=>document.querySelector('a.ph[href*="science"]').click(),250);});
 await n.waitFor(()=>location.pathname.includes('science')&&!document.documentElement.dataset.xp,{timeout:15000});
 check('latest intent supersedes Racing and preserves Science navigation',true);
 // Context loss while covering must settle the transition and release the overlay.
 await n.goto(o.base);await ready(n);
 await n.eval(()=>{document.querySelector('a.ph[href*="athletics"]').click();setTimeout(()=>document.querySelector('.scene').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext(),120);});
 await n.waitFor(()=>location.pathname.includes('athletics')&&!document.documentElement.dataset.xp,{timeout:12000});
 check('WebGL loss during navigation releases the page',await n.eval(()=>!document.querySelector('.scene.is-front')&&!document.documentElement.dataset.xpReveal));
 await n.eval(()=>document.querySelector('.scene').getContext('webgl2').getExtension('WEBGL_lose_context').restoreContext());await ready(n);
 check('WebGL restoration rebuilds the ice resources',await n.eval(()=>document.documentElement.classList.contains('gl')));
 report.navigationProblems=n.problems();check('navigation and context-loss paths have no exceptions',!report.navigationProblems.exceptions.length&&!report.navigationProblems.consoleErrors.length);
 // Reduced motion uses the existing fade and removes only Racing's long hold.
 const r=await b.newPage({width:390,height:844,mobile:true});
 await r.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await r.goto(o.base);await sleep(1000);
 check('reduced motion removes the Racing pin',await r.eval(()=>!document.querySelector('.seam-hold[data-to="glass"]')));
 await r.eval(()=>{window.__kinds=[];new MutationObserver(()=>window.__kinds.push(document.documentElement.dataset.xp)).observe(document.documentElement,{attributes:true,attributeFilter:['data-xp']});document.querySelector('a[href*="athletics"]:not(.ph)').click();});
 await r.waitFor(()=>location.pathname.includes('athletics')&&!document.documentElement.dataset.xp,{timeout:12000});
 check('reduced-motion navigation uses fade',await r.eval(()=>window.__kinds.includes('fade')));
 // Resize repeatedly through worker preparation, then return to a usable viewport.
 const z=await b.newPage({width:908,height:978});await z.goto(o.base);await ready(z);
 for(const [width,height]of[[390,844],[1200,800],[1440,900]]){await z.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(80);}
 await ready(z);check('resize evicts pending uploads and prepares the final viewport',await z.eval(async()=>{const{getScene}=await import('/static/site/scene/scene.js');return getScene().iceStats().grains===48;}));
 check('resize produces no browser exceptions',!z.problems().exceptions.length);
}finally{await b.close();}
const fallback=await launch({preset:'nowebgl'});
try{const p=await fallback.newPage({width:390,height:844,mobile:true});await p.goto(o.base);await p.eval(()=>document.querySelector('a[href*="athletics"]:not(.ph)').click());await p.waitFor(()=>location.pathname.includes('athletics')&&!document.documentElement.dataset.xp,{timeout:12000});check('unavailable WebGL still navigates to Racing',true);}finally{await fallback.close();}
fs.writeFileSync(path.join(o.out,'browser-checks.json'),JSON.stringify(report,null,2));
