#!/usr/bin/env node
// Screenshots for visual review, plus a JSON log of what went wrong on each page.
//
//   node tools/site/shoot.mjs --routes all --sizes 1440x900,390x844,844x390 --out /tmp/shots
//   node tools/site/shoot.mjs --base http://127.0.0.1:8000/ --routes /,/about/ --reduced-motion --out DIR
//   node tools/site/shoot.mjs --lab "route=gallery&view=overview" --wait-world --out DIR
//   node tools/site/shoot.mjs --routes /chess/chess.html --chess partial-failure --out DIR
//
// Without --base it serves the repository itself (tools/site/serve.mjs on a free port). Every shot
// gets a fresh tab with empty storage. Writes DIR/<route>-<size>[-variant].png and DIR/shots.json:
// per shot the console errors, exceptions, failed requests, HTTP errors, external requests,
// horizontal overflow and window.__world.metrics(). See tools/site/README.md.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { launch, parseSize, siteRoutes, routeSlug, environment, waitForWorld, worldMetrics, redact } from './cdp.mjs';
import { createServer } from './serve.mjs';

const USAGE = `usage: node tools/site/shoot.mjs --out DIR [options]
  --base URL            site to shoot (default: serve the repository on a free port)
  --faults FILE         with the built-in server: fault rules (tools/site/fixtures/faults/*.json)
  --routes LIST         all | comma-separated paths, e.g. /,/about/,/athletics/athletics.html#hikes
  --sizes LIST          WxH[@dpr],... (default 1440x900,390x844,844x390; a side <= 500 px means a phone)
  --lab QUERY           shoot design/world/lab.html?QUERY instead of routes (repeatable)
  --out DIR             output directory (required)
  --no-js               JavaScript disabled
  --reduced-motion      prefers-reduced-motion: reduce
  --text-zoom N         browser default font size x N (enlarged text)
  --zoom N              browser page zoom x N (200% zoom: --zoom 2; the CSS viewport shrinks by N)
  --color-scheme light|dark
  --wait-world          wait until window.__world reports the scene loaded (or the fallback shows)
  --wait-for EXPR       also wait until EXPR is truthy in the page
  --wait MS             extra settle time before each shot (default 250)
  --full-page           capture the whole page instead of the viewport
  --preset gpu|swiftshader|nowebgl   (default gpu)
  --init JS             script run before page scripts (repeatable)
  --chess SCENARIO      answer Chess.com API requests from tools/site/fixtures/chess (e.g. success, empty)
  --timeout MS          per-page timeout (default 30000)
  --strict              exit 2 when any shot logged errors or failed requests`;

function fail(message) {
  console.error(message);
  console.error(USAGE);
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    options: {
      base: { type: 'string' },
      faults: { type: 'string' },
      routes: { type: 'string', default: 'all' },
      sizes: { type: 'string', default: '1440x900,390x844,844x390' },
      lab: { type: 'string', multiple: true, default: [] },
      out: { type: 'string' },
      'no-js': { type: 'boolean', default: false },
      'reduced-motion': { type: 'boolean', default: false },
      'text-zoom': { type: 'string', default: '1' },
      zoom: { type: 'string', default: '1' },
      chess: { type: 'string' },
      'color-scheme': { type: 'string' },
      'wait-world': { type: 'boolean', default: false },
      'wait-for': { type: 'string' },
      wait: { type: 'string', default: '250' },
      'full-page': { type: 'boolean', default: false },
      preset: { type: 'string', default: 'gpu' },
      init: { type: 'string', multiple: true, default: [] },
      timeout: { type: 'string', default: '30000' },
      strict: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) { console.log(USAGE); return 0; }
  if (!values.out) fail('--out DIR is required');
  const out = path.resolve(values.out);
  fs.mkdirSync(out, { recursive: true });

  const sizes = values.sizes.split(',').filter(Boolean).map((s) => parseSize(s));
  const { routes: known, source } = siteRoutes();
  const targets = values.lab.length
    ? values.lab.map((q) => ({ path: `/design/world/lab.html?${q.replace(/^\?/, '')}`, slug: 'lab-' + q.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() }))
    : (values.routes === 'all' ? known.map((r) => r.url) : values.routes.split(',').map((r) => r.trim()).filter(Boolean))
      .map((r) => ({ path: r, slug: routeSlug(r, known) }));
  const textZoom = +values['text-zoom'] || 1;
  const zoom = +values.zoom || 1;
  const fixtures = values.chess ? await import('./fixtures/chess/index.mjs') : null;
  if (fixtures && !fixtures.scenarioNames().includes(values.chess)) fail(`unknown --chess scenario ${values.chess} (${fixtures.scenarioNames().join(', ')})`);
  const variant = [
    values['no-js'] && 'nojs',
    values['reduced-motion'] && 'rm',
    textZoom !== 1 && `text${textZoom}`,
    zoom !== 1 && `zoom${zoom}`,
    values.chess && `chess-${values.chess}`,
    values.faults && path.basename(values.faults, '.json'),
    values['color-scheme'],
    values.preset !== 'gpu' && values.preset,
    values['full-page'] && 'full',
  ].filter(Boolean).join('-');

  if (values.faults && values.base) fail('--faults needs the built-in server (omit --base)');
  let server = null;
  let base = values.base;
  if (!base) {
    server = await createServer({ port: 0, faultsFile: values.faults ? path.resolve(values.faults) : null });
    base = server.url;
  }
  if (!base.endsWith('/')) base += '/';

  const browser = await launch({ preset: values.preset, timeout: +values.timeout });
  const report = { tool: 'shoot', base, routesFrom: values.lab.length ? 'lab' : source, faults: values.faults ? path.basename(values.faults) : null, env: null, shots: [] };
  let problems = 0;
  try {
    for (const target of targets) {
      for (const size of sizes) {
        const url = /^https?:/.test(target.path) ? target.path : new URL(target.path.replace(/^\//, ''), base).href;
        const file = path.join(out, `${target.slug}-${size.label}${variant ? '-' + variant : ''}.png`);
        const shot = { route: target.path, slug: target.slug, size: size.label, dpr: size.deviceScaleFactor, mobile: size.mobile, zoom, variant: variant || 'default', file };
        const t0 = performance.now();
        const page = await browser.newPage({
          ...size,
          isolate: true,
          reducedMotion: values['reduced-motion'],
          colorScheme: values['color-scheme'],
          javaScript: !values['no-js'],
          textZoom,
          zoom,
          // The retired first-visit preloader blocks the page for seconds; harmless once it is gone.
          init: ["sessionStorage.setItem('ac-loaded', '1')", ...values.init],
        });
        const chess = fixtures ? await fixtures.useChessFixtures(page, values.chess) : null;
        try {
          if (!report.env) report.env = await environment(browser, values['no-js'] ? null : page);
          const nav = await page.goto(url, { waitUntil: 'load' });
          shot.status = nav.status;
          shot.loadMs = nav.ms;
          if (values['wait-world'] && !values['no-js']) {
            const w = await waitForWorld(page, { timeout: Math.min(+values.timeout, 30000) });
            shot.worldState = w.state;
            shot.worldWaitMs = w.ms;
            // The canvas fades in over the poster (world.css): wait for it, so no poster ghosts.
            if (w.state === 'ready') {
              await page.waitFor(() => { const c = document.querySelector('.world-canvas'); return !c || getComputedStyle(c).opacity === '1'; }, { timeout: 3000 }).catch(() => {});
            }
          }
          if (values['wait-for']) await page.waitFor(values['wait-for']);
          await page.waitForNetworkIdle({ idleMs: 300, timeout: 8000 }).catch((e) => { shot.note = e.message; });
          if (!values['no-js']) await page.eval(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))).catch(() => {});
          if (+values.wait) await new Promise((r) => setTimeout(r, +values.wait));
          Object.assign(shot, await page.eval(() => ({
            title: document.title,
            h1: document.querySelector('h1')?.textContent.trim().replace(/\s+/g, ' ') || null,
            innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            scrollHeight: document.documentElement.scrollHeight,
          })));
          // A phone-sized page that overflows widens its layout viewport, so compare with the
          // requested width rather than innerWidth.
          shot.overflowX = shot.scrollWidth > Math.round(size.width / zoom);
          const s = await page.screenshot(file, { fullPage: values['full-page'] });
          shot.png = { width: s.width, height: s.height, bytes: s.bytes };
          shot.world = values['no-js'] ? null : await worldMetrics(page).catch(() => null);
        } catch (e) {
          shot.error = e.message;
        }
        const p = page.problems();
        shot.requests = page.requests.length;
        shot.bytes = page.requests.reduce((sum, r) => sum + (r.dataLength || 0), 0);
        Object.assign(shot, p);
        if (chess) shot.chess = { scenario: chess.scenario, calls: chess.calls };
        shot.ms = Math.round(performance.now() - t0);
        await page.close();
        // HTTP errors the fixtures answered on purpose are logged but are not problems.
        const count = p.consoleErrors.length + p.exceptions.length + p.failedRequests.length + p.httpErrors.filter((h) => !h.fixture).length + (shot.error ? 1 : 0);
        problems += count;
        report.shots.push(shot);
        const flags = [shot.error && `ERROR ${shot.error}`, count && `${count} problem(s)`, shot.overflowX && 'overflow-x', shot.worldState && `world:${shot.worldState}`].filter(Boolean).join(' ');
        console.log(`${String(shot.status ?? '-').padEnd(4)} ${size.label.padEnd(10)} ${redact(target.path).padEnd(40)} ${path.basename(file)} ${flags}`);
      }
    }
  } finally {
    await browser.close();
    if (server) await server.close();
  }
  // One log per directory: runs with other variants or routes add to it; a re-shot file replaces its entry.
  const json = path.join(out, 'shots.json');
  let previous = [];
  try {
    const old = JSON.parse(fs.readFileSync(json, 'utf8'));
    if (old.tool === 'shoot') previous = (old.shots || []).filter((s) => !report.shots.some((n) => n.file === s.file));
  } catch { /* first run */ }
  report.shots = [...previous, ...report.shots];
  fs.writeFileSync(json, JSON.stringify(report, (k, v) => (typeof v === 'string' ? redact(v) : v), 2) + '\n');
  console.log(`${report.shots.length} shot(s), ${problems} problem(s) -> ${json}`);
  return values.strict && problems ? 2 : 0;
}

main().then((code) => process.exit(code), (e) => { console.error(redact(e.stack || String(e))); process.exit(1); });
