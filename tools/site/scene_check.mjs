#!/usr/bin/env node
// The scene, headless: the shader builds, and screenshots for looking at. The homepage hero at rest
// and with each phrase's world filling the crystal; each band; each seam with the bands' meeting line
// at a quarter, half and three quarters of the screen (no seam may be muddy, and the text must stay
// readable); and the hero of every destination page.
//   node tools/site/scene_check.mjs [--out DIR] [--size 1440x900] [--preset gpu|swiftshader|nowebgl] [--reduced-motion]
//     [--only NAME] [--base URL]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { launch } from './cdp.mjs';

const { values: o } = parseArgs({ options: {
  out: { type: 'string', default: 'scene-shots' },
  size: { type: 'string', default: '1440x900' },
  preset: { type: 'string', default: 'gpu' },
  base: { type: 'string', default: 'http://127.0.0.1:8100' },
  only: { type: 'string' },
  'reduced-motion': { type: 'boolean', default: false },
} });
const [width, height] = o.size.split('x').map(Number);
fs.mkdirSync(o.out, { recursive: true });
const want = name => !o.only || name.includes(o.only);
const wait = ms => new Promise(r => setTimeout(r, ms));

const browser = await launch({ preset: o.preset });
let failed = false;
try {
  const page = await browser.newPage({ width, height, deviceScaleFactor: width < 600 ? 2 : 1, mobile: width < 600 });
  if (o['reduced-motion']) await page.setMedia({ reducedMotion: true });
  const shoot = async name => { await page.screenshot(path.join(o.out, `${name}.png`)); process.stdout.write('.'); };
  const ready = () => page.waitFor(() => document.documentElement.classList.contains('gl') || document.documentElement.classList.contains('no-gl'), { timeout: 20000 })
    .then(() => page.eval(() => document.documentElement.classList.contains('gl')));

  await page.goto(`${o.base}/`, { waitUntil: 'load', timeout: 30000 });
  console.log(`scene: ${(await ready()) ? 'drawing' : 'not available (CSS fallback)'}`);
  await wait(900);
  if (want('hero')) await shoot('hero');

  // The crystal filled with each phrase's world.
  const worlds = await page.eval(() => [...document.querySelectorAll('.ph')].map(p => p.dataset.world));
  for (const w of worlds) {
    if (!want(`crystal-${w}`)) continue;
    await page.eval(id => document.querySelector(`.ph[data-world="${id}"]`).dispatchEvent(new PointerEvent('pointerenter')), w);
    await wait(1300);
    await shoot(`crystal-${w}`);
  }
  await page.eval(() => document.querySelectorAll('.ph').forEach(p => p.dispatchEvent(new PointerEvent('pointerleave'))));

  // Each band at rest, then each seam with the meeting line at h of the screen.
  const bands = await page.eval(() => [...document.querySelectorAll('.band')].map(b => ({ id: b.dataset.band, top: b.getBoundingClientRect().top + scrollY })));
  const vh = await page.eval(() => innerHeight);
  for (const b of bands) {
    if (!want(`band-${b.id}`)) continue;
    await page.eval(y => window.scrollTo({ top: y, behavior: 'instant' }), b.top);
    await wait(1600);
    await shoot(`band-${b.id}`);
  }
  for (let i = 1; i < bands.length; i++) {
    for (const h of [0.25, 0.5, 0.75]) {
      const name = `seam-${bands[i - 1].id}-${bands[i].id}-h${h}`;
      if (!want(name)) continue;
      await page.eval(y => window.scrollTo({ top: y, behavior: 'instant' }), bands[i].top - h * vh);
      await wait(700);
      await shoot(name);
    }
  }

  // Each destination's hero.
  const pages = await page.eval(() => JSON.parse(document.getElementById('site-data').textContent).registry.destinations.map(d => ({ id: d.id, url: d.url })));
  for (const p of pages) {
    if (!want(`page-${p.id}`)) continue;
    await page.goto(`${o.base}${p.url}`, { waitUntil: 'load', timeout: 30000 });
    await ready();
    await wait(1800);
    await shoot(`page-${p.id}`);
  }
  const problems = page.problems?.() ?? {};
  console.log('\n' + JSON.stringify({ consoleErrors: problems.consoleErrors, exceptions: problems.exceptions }));
  if (problems.consoleErrors?.length || problems.exceptions?.length) failed = true;
} finally {
  await browser.close();
}
if (failed) process.exitCode = 1;
