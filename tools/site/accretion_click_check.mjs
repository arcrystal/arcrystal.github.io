#!/usr/bin/env node
// Verify the early fracture texture and the first public Racing click after the opening screen.
import assert from 'node:assert/strict';
import {launch} from './cdp.mjs';
const browser=await launch({preset:'gpu'});
try {
 const page=await browser.newPage({width:1440,height:900});
 await page.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.__earlyShards=0;const draw=WebGL2RenderingContext.prototype.drawArraysInstanced;WebGL2RenderingContext.prototype.drawArraysInstanced=function(...a){if(a[2]===6&&a[3]>2000)window.__earlyShards++;return draw.apply(this,a);};"});
 await page.goto('http://localhost:8100/');
 await page.waitFor(()=>document.documentElement.classList.contains('app-ready'));
 await page.waitFor(async()=>{const {getScene}=await import('/static/site/scene/scene.js');return getScene().iceClickReady();},{timeout:10000});
 const fullBakeReadyAtFirstClickTexture=await page.eval(async()=>{const {getScene}=await import('/static/site/scene/scene.js');return getScene().iceReady();});
 await page.waitFor(()=>!document.documentElement.classList.contains('site-loading'),{timeout:125000});
 await page.eval(()=>window.__earlyShards=0);const start=performance.now();
 await page.click('.site-nav [data-nav="racing"]');
 await page.waitFor(()=>location.pathname.includes('/athletics/'),{timeout:12000});
 const pageSwapMs=performance.now()-start;
 await new Promise(r=>setTimeout(r,1500));
 const shardDraws=await page.eval(()=>window.__earlyShards),problems=page.problems();
 console.log(JSON.stringify({fullBakeReadyAtFirstClickTexture,pageSwapMs,shardDraws,problems},null,2));
 assert.ok(shardDraws>0,'the fast click must draw its shards');
 assert.equal(problems.consoleErrors.length+problems.exceptions.length+problems.failedRequests.length,0);
}finally{await browser.close();}
