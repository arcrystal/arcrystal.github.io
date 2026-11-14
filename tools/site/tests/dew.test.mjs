// Stars, nebulae, stardust, drops, ice (Science → Racing): the nebulae and their physics, the stardust's
// collapse, the drops, the freezing chain, the crystals and the rift, the optics, the break-apart and the
// seam's timing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  makeDewPlan, packDew, tileLists, radiusAt, liveAt, extentOf, visibleFrom, coldAt, clearAt, clearStart, lensTrace, holdStartP, WATER, DEW, KIND,
  SN, remnantFrac, remnantInverse, shellFrac, lightCurve, nucleationRate, nucleationDelay, makeFragments, FRAG, CORE, fallAngle, freeFall, grainAt, coreVolume,
  NEB, isPlanetary, nebDensity, nebColour, nebFrame, nebulaRadius, shockAt, capHeight, chainSeeds, chainAt, frontAt, riftOpening, crackY,
} from '../../../static/site/scene/dew-plan.js';
import { GIANTS, blackbody, lineColour } from '../../../static/site/scene/giants.js';
import { HOLD, holdFor, holdAt, glassEase, glassRaw, transitP, GLASS_RELEASE } from '../../../static/site/lerp.js';

const screens = [[1440, 900], [390, 844]];
const plans = screens.map(([w, h]) => makeDewPlan(w, h));
const near = (a, b, e = 1e-6, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} != ${b}`);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const statics = p => p.records.filter(r => r.science === undefined);
const src = readFileSync(new URL('../../../static/site/scene/glsl/dew.js', import.meta.url), 'utf8');
const units = readFileSync(new URL('../../../static/site/scene/glsl/units.js', import.meta.url), 'utf8');
// Spearman's rank correlation.
const ranks = a => { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length); o.forEach(([, i], k) => { r[i] = k; }); return r; };
const spearman = (a, b) => { const ra = ranks(a), rb = ranks(b), n = a.length, m = (n - 1) / 2; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (ra[i] - m) * (rb[i] - m); saa += (ra[i] - m) ** 2; sbb += (rb[i] - m) ** 2; } return sab / Math.sqrt(saa * sbb); };

test('plans reproduce exactly from the seed and the size', () => {
  const again = makeDewPlan(390, 844);
  assert.equal(again.records.length, plans[1].records.length);
  assert.deepEqual(JSON.stringify(again.records), JSON.stringify(plans[1].records));
  assert.deepEqual(JSON.stringify(again.cells.map(c => [c.c, c.t0, c.poly])), JSON.stringify(plans[1].cells.map(c => [c.c, c.t0, c.poly])));
  for (const p of plans) for (const r of p.records) for (const v of [r.c[0], r.c[1], r.V0, r.t0]) assert.ok(Number.isFinite(v));
});

test('nebulae: each whole, only the outer fringes of neighbours crossing; remnants from the hot giants, planetaries from the cool', () => {
  for (const p of plans) {
    const ev = p.events;
    assert.equal(ev.length, p.phone ? 4 : 7);
    assert.equal(new Set(ev.map(e => e.type)).size, ev.length, 'every nebula a different kind');
    for (const e of ev) {
      assert.equal(isPlanetary(e.type), GIANTS[e.giant].T < 5000, 'a supernova from a hot giant, a planetary from a cool one');
      near(e.S[0], GIANTS[e.giant].x * p.W, 1e-9); near(e.S[1], GIANTS[e.giant].y * p.H, 1e-9);
    }
    assert.equal(ev.filter(e => !isPlanetary(e.type)).length, p.phone ? 2 : 4);
    for (let a = 0; a < ev.length; a++) for (let b = a + 1; b < ev.length; b++) {
      // Each reaches at most Rmax × aspect (its long axis): their bodies (the inner four-fifths) never
      // meet; at most the outer fringes cross.
      const d = dist(ev[a].S, ev[b].S), Ra = ev[a].Rmax * ev[a].aspect, Rb = ev[b].Rmax * ev[b].aspect;
      assert.ok(0.8 * (Ra + Rb) <= d, `bodies overlap (${p.W}: ${a}, ${b})`);
      assert.ok(Ra + Rb <= 1.21 * d, `more than the fringes cross (${p.W}: ${a}, ${b})`);
    }
    // The order of endings is not a sweep across or down the screen.
    const order = ev.map(e => e.t);
    assert.ok(Math.abs(spearman(order, ev.map(e => e.S[1]))) <= 0.4 + 1e-9 && Math.abs(spearman(order, ev.map(e => e.S[0]))) <= 0.4 + 1e-9, `a sweep (${p.W})`);
  }
});

test('supernovae and shells: the Sedov–Taylor slope, the Ni→Co light curve, a planetary\'s steady shell', () => {
  const slope = (x, h = 1e-4) => Math.log(remnantFrac(x * (1 + h)) / remnantFrac(x)) / Math.log(1 + h);
  near(slope(1e-4), 1, 0.01, 'free expansion');
  near(slope(5), 0.4, 0.01, 'Sedov–Taylor');
  assert.ok(slope(1) > 0.4 && slope(1) < 0.45, 'well into the Sedov phase by the final radius');
  for (let x = 0.001; x < 1; x += 0.001) { assert.ok(remnantFrac(x + 0.001) > remnantFrac(x)); assert.ok(shellFrac(x + 0.001) > shellFrac(x)); }
  near(remnantFrac(1), 1, 1e-12); near(shellFrac(1), 1, 1e-12);
  for (const y of [0.1, 0.5, 0.9]) near(remnantFrac(remnantInverse(y)), y, 1e-9, 'inverse');
  near(SN.tauCo / SN.tauNi, 111.3 / 8.8, 1e-9, 'mean lives');
  const late = s => Math.log(lightCurve(s) / lightCurve(s + 0.001)) / 0.001;
  near(1 / late(0.15), SN.tauCo, SN.tauCo * 0.02, 'the cobalt tail');
  for (const p of plans) for (const e of p.events) {
    assert.ok(e.t >= holdStartP(p.phone) + 0.01 && e.t <= SN.end + 1e-9, 'in its window');
    near(nebulaRadius(e, e.t + e.span), e.Rmax, 1e-9, 'full size by cover');
    // The gas at a point is swept up once its nebula has reached it (or a neighbour's fringe, sooner).
    for (const u of [0.2, 0.5, 0.9]) {
      const q = [e.S[0] + Math.cos(e.angle + Math.PI / 2) * u * e.Rmax, e.S[1] + Math.sin(e.angle + Math.PI / 2) * u * e.Rmax];
      let lo = e.t, hi = e.t + e.span;
      for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (nebulaRadius(e, m) < u * e.Rmax) lo = m; else hi = m; }
      assert.ok(shockAt(p, q) <= hi + 1e-6, 'swept up when reached');
    }
  }
  for (let t = 0.001; t < 0.2; t += 0.005) assert.ok(nucleationRate(t + 0.005) >= nucleationRate(t));
  for (let u = 0.05; u < 0.95; u += 0.05) assert.ok(nucleationDelay(u + 0.05) >= nucleationDelay(u));
});

test('stardust: each grain falls as a shell of a collapsing cloud, keeping its angular momentum, in an exact spiral', () => {
  // r/r₀ = cos²β, t/t_ff = (β + sin β cos β)/(π/2).
  for (let tau = 0; tau <= 1; tau += 0.05) { const b = fallAngle(tau); near((b + Math.sin(b) * Math.cos(b)) / (Math.PI / 2), tau, 1e-9, 'Kepler'); near(freeFall(tau), Math.cos(b) ** 2, 1e-12); }
  const core = plans[0].cores[3], D = core.td - core.ts;
  for (const u0 of [0.2, 0.6, 1]) {
    // Angular momentum per mass, r² dθ/dt, the same all the way in (until the grain meets the drop).
    const L = [];
    const ta = core.ts + D * (0.2 + 0.8 * u0), Tff = D * (0.35 + 0.3 * u0);
    for (let f = 0.1; f < 0.9; f += 0.1) {
      const P = ta - Tff + f * Tff, h = 1e-7, a = grainAt(core, u0, 0.3, 1.7, P), b = grainAt(core, u0, 0.3, 1.7, P + h);
      L.push(a[2] * a[2] * (b[3] - a[3]) / h);
      assert.ok(b[2] <= a[2] + 1e-9, 'falls inward');
    }
    for (const l of L) near(l / L[0], 1, 1e-3, 'r² dθ/dt conserved');
    // It reaches the middle as it arrives.
    assert.ok(grainAt(core, u0, 0.3, 1.7, ta)[2] < 2e-3 * core.Rg, 'arrives');
  }
  // Arrivals spread evenly over the core's fall (uniform in r₀, the mass of a ρ ∝ r⁻² cloud): its drop's
  // volume grows at a steady rate (Shu's inside-out collapse), and its drop in the plan follows it.
  for (const P of [0.3, 0.5, 0.7].map(f => core.ts + 0.2 * D + f * 0.8 * D)) near(coreVolume(core, P) / core.r ** 3, (P - core.ts - 0.2 * D) / (0.8 * D), 1e-9, 'steady');
  for (const p of plans) {
    let checked = 0;
    p.records.forEach(r => {
      if (r.kind !== KIND.drop || r.core === undefined) return;
      const c = p.cores[r.core];
      for (const f of [0.3, 0.7]) { const P = c.ts + 0.2 * (c.td - c.ts) + f * 0.8 * (c.td - c.ts); if (P < r.end) { near(radiusAt(r, P) ** 3, coreVolume(c, P), 1e-6 * c.r ** 3 + 1e-9, 'the drop holds what has arrived'); checked++; } }
    });
    assert.ok(checked > 50, `${checked} checks`);
  }
});

test('cores form where the nebula is dense, after it has swept up their gas, in its colours, of many sizes', () => {
  for (const p of plans) {
    const at = q => Math.max(...p.events.map(e => nebDensity(e, q)));
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const inCore = mean(p.cores.map(c => at(c.c)));
    const random = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const pts = []; while (pts.length < 3000) { const q = [random() * p.W, random() * p.H]; if (at(q) > 0.02) pts.push(at(q)); }
    assert.ok(inCore > 1.3 * mean(pts), `cores ${inCore.toFixed(2)} vs ${mean(pts).toFixed(2)} (${p.W})`);
    for (const c of p.cores) {
      assert.ok(c.ts >= shockAt(p, c.c) + CORE.delay[0] - 1e-9 || c.td <= CORE.by + 1e-9, 'falls after its gas is swept up');
      assert.ok(c.td <= CORE.by + 1e-9 && c.td < DEW.chain0, 'a drop before the freeze');
      assert.ok(c.col.every(v => v >= 0 && v <= 1) && Math.max(...c.col) === 1, 'a colour of its nebula');
    }
    // Sizes: many small, a few large (the power law).
    const rs = p.cores.map(c => c.r).sort((a, b) => a - b);
    assert.ok(rs[Math.floor(rs.length / 2)] < 0.35 * rs.at(-1), 'many small, a few large');
  }
});

test('merging keeps volume at the volume-weighted centroid, and mixes colours by volume', () => {
  for (const p of plans) {
    const merged = p.records.filter(r => r.kind === KIND.merged);
    assert.ok(merged.length > 20, `${merged.length} merges`);
    for (const r of merged) {
      const Va = r.ra ** 3, Vb = r.rb ** 3;
      near(r.V0, Va + Vb, 1e-9 * r.V0, 'volume');
      const cb = [(r.c[0] * (Va + Vb) - r.pa[0] * Va) / Vb, (r.c[1] * (Va + Vb) - r.pa[1] * Va) / Vb];
      assert.ok(dist(r.pa, cb) <= r.ra + r.rb + 2.5, 'parents were in contact');
      assert.ok(r.col.every(v => v >= -1e-9 && v <= 1 + 1e-9));
    }
  }
});

test('the spatial lists hold every drop, its frost and its bridge that can touch a point (exhaustive check)', () => {
  for (const p of plans) {
    packDew(p);
    const L = tileLists(p), T = DEW.tile;
    const random = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    for (let n = 0; n < 2500; n++) {
      const q = [random() * p.W, random() * p.H], P = -0.15 + random() * 1.0;
      const e = Math.max(0, Math.min(DEW.epochs - 1, Math.floor((P - DEW.epoch0) / DEW.epochLen)));
      const drops = new Set(L.drops[(e * L.rows + Math.min(L.rows - 1, Math.floor(q[1] / T))) * L.cols + Math.min(L.cols - 1, Math.floor(q[0] / T))]);
      p.records.forEach((r, id) => {
        if (r.science !== undefined || P < Math.max(r.t0, visibleFrom(r)) || P >= r.end) return;
        // Long after it froze, only the bead itself is drawn (its halo and bridge have faded).
        const reach = DEW.epoch0 + e * DEW.epochLen > r.tf + DEW.iceFade ? radiusAt(r, P) * 1.12 + 1.5 : Math.min(extentOf(p, r), radiusAt(r, P) * 2.25 + 1.5);
        if (dist(q, r.c) < reach) assert.ok(drops.has(id), 'drop missing');
      });
    }
  }
});

test('a drop is a lens: inverted, focal length R/(n − 1), blue bent more than red; its colour deepest at its middle', () => {
  for (const th of [50, 62, 75].map(d => d * Math.PI / 180)) {
    const n = WATER[1];
    near(lensTrace(0, th, n).delta, 0, 1e-12);
    let last = -1;
    for (let s = 0; s <= 1; s += 0.01) { const d = lensTrace(s, th, n).delta; assert.ok(d > last - 1e-12); last = d; }
    const s = 1e-4, Rc = 1 / Math.sin(th);
    near(lensTrace(s, th, n).delta / s, (n - 1) / Rc, 1e-6, 'paraxial');
    assert.ok(lensTrace(0.8, th, WATER[2]).delta > lensTrace(0.8, th, WATER[0]).delta, 'dispersion');
    for (let k = 0; k <= 1; k += 0.05) assert.ok(n * Math.sin(lensTrace(k, Math.PI / 2 - 1e-9, n).gamma) < 1);
    // The cap's depth (Beer–Lambert's path): R(1 − cos θc) at the middle, nothing at the rim.
    near(capHeight(0, 10, th), 10 / Math.sin(th) * (1 - Math.cos(th)), 1e-9);
    near(capHeight(10, 10, th), 0, 1e-9);
  }
  assert.match(src, /vec3 g = a - asin\(sa \/ DEW_WATER\);/);
  assert.match(src, /col \*= pow\(max\(tint, vec3\(\.02\)\), vec3\(h\)\);/);
});

test('the hold lets go as the transition ends (GLASS_RELEASE 1.2); the strip comes in as Science; the slow ending is longer', () => {
  assert.equal(GLASS_RELEASE, 1.2);
  for (const p of plans) {
    const pin = p.phone ? HOLD.pinTouch : HOLD.pin, L = holdFor('glass', pin), H = p.H * (1 + pin * L.pin), T = 4000;
    assert.equal(L.leadOut, 0);
    const release = T + H - p.H;
    near(transitP(glassEase(holdAt(release, T, H, p.H, L.leadIn, L.leadOut).p)), GLASS_RELEASE, 1e-12);
    const first = Math.min(...p.events.map(e => e.t));
    for (let sy = T - L.leadIn * p.H; sy < release; sy += 13) {
      const { y, p: raw } = holdAt(sy, T, H, p.H, L.leadIn, L.leadOut), P = transitP(glassEase(raw));
      if (y > 0) assert.ok(P <= first - 0.022 + 1e-9, `a nebula while the strip comes in at ${p.W}, P=${P}`);
    }
  }
  // From the rift on (P .88) the scroll moves slowest: over a third of the hold, and in screens more
  // than the ending had before (a hold of 3.6 screens gave P .95 → 1.15 about .73 of a screen).
  const share = 1 - glassRaw(0.88);
  assert.ok(share > 1 / 3, `ending share ${share}`);
  assert.ok((glassRaw(1.15) - glassRaw(0.95)) * HOLD.by.glass.pin > 0.85, 'longer than it was');
  for (let r = 0; r <= 1; r += 0.01) near(glassRaw(transitP(glassEase(r))), r, 1e-6, 'its inverse');
  const home = readFileSync(new URL('../../../static/site/home.js', import.meta.url), 'utf8');
  assert.match(home, /sf = clamp\(\(P - 1\.02\) \/ 0\.16\)/);
  assert.match(src, /if \(!click && P >= 1\.18\) \{ gCardMix = 1\.0; return vec4\(sceneGlacier\(px\), 1\.0\); \}/);
  assert.match(src, /gCardMix = smoothstep\(1\.13, 1\.18, P\);/);
});

test('a click begins uncovered, swaps fully covered and ends clear; every piece clears ahead of the DOM aperture', () => {
  for (const p of plans) for (const O of [[0, 0], [p.W / 2, p.H / 2], [p.W - 1, p.H - 1]]) {
    const far = Math.hypot(Math.max(O[0], p.W - O[0]), Math.max(O[1], p.H - O[1]));
    for (let y = 0; y <= p.H; y += 73) for (let x = 0; x <= p.W; x += 79) {
      const q = [x, y];
      assert.ok(coldAt(p, q, O) + 0.2 <= 0.84);
      assert.equal(clearAt(p, q, 0.84, O), 0);
      assert.equal(clearAt(p, q, 1.12, O), 1);
    }
    for (const c of p.cells) {
      const start = 0.84 + 0.18 * Math.min(1, Math.max(0, (Math.hypot(c.centroid[0] - O[0], c.centroid[1] - O[1]) - c.radius) / far));
      for (const v of [...c.poly, c.centroid]) assert.ok(start + 0.07 <= clearStart(p, v, O) + 0.08 + 0.0061, 'a piece over the open page');
    }
  }
});

test('the shader keeps the plan\'s schedules', () => {
  assert.match(src, /float dewCold\(vec2 q\) \{ return -\.18 \+ \.62 \* dewUp\(q\); \}/);
  assert.match(src, /float dewClearStart\(vec2 q\) \{ float up = dewUp\(q\); return \.84 \+ \.18 \* up/);
  assert.match(src, /\.84 \+ \.18 \* clamp\(\(length\(B\.xy \* toScreen - uPoint\) - B\.z \* toScreen\.y\) \/ far, 0\.0, 1\.0\)\)\) \/ \$\{f\(DEW\.fall\)\}\)/);
  assert.deepEqual({ ...DEW.click }, { clear0: 0.84, clearUp: 0.18, clearD: 0.08, flash: 0.035 });
  // The rift: a piece leaves the ground as it breaks away, the fragments take it from there.
  assert.match(src, /if \(!click\) \{ if \(P >= dewData\(sb \+ i1 \* 5 \+ 3\)\.z\) r\.cov = 0\.0; return r; \}/);
  assert.match(src, /float dewFront\(vec2 qp\) \{ return \$\{f\(DEW\.detach0 - DEW\.lead\)\} \+ \$\{f\(DEW\.detach1 - DEW\.detach0\)\} \* abs\(qp\.y - dewCrackY\(qp\.x\)\) \/ dewData\(24\)\.z; \}/);
  // The grains, as the plan's grainAt.
  assert.match(units, /float ta = A\.z \+ D \* \(\.2 \+ \.8 \* u0\), Tff = D \* \(\.35 \+ \.3 \* u0\);/);
  assert.match(units, /float th = th0 \+ w \* tan\(min\(b, 1\.55\)\);/);
  assert.match(units, /float P = transitP\(uH\), u = \(P - F1\.z\) \/ max\(F1\.w - F1\.z, 1e-4\);/);
});
test('supergiants: black-body colours from Planck and the CIE functions; nebulae glow in their lines', () => {
  const red = blackbody(3400), blue = blackbody(30000), sun = blackbody(5800);
  assert.ok(red[0] === 1 && red[2] < 0.35, `3400 K ${red}`);
  assert.ok(blue[2] === 1 && blue[0] < 0.5, `30000 K ${blue}`);
  assert.ok(Math.min(...sun) > 0.75, `5800 K near white ${sun}`);
  const ha = lineColour(656.3), o3 = lineColour(500.7);
  assert.ok(ha[0] === 1 && ha[1] < 0.1 && ha[2] < 0.1, 'Hα is red');
  assert.ok(o3[1] === 1 && o3[0] < 0.1, '[O III] is green-teal');
  for (const g of GIANTS) assert.ok(g.x > 0 && g.x < 1 && g.y > 0 && g.y < 1 && g.T >= 3000 && g.T <= 40000);
  // The Veil's strands: hydrogen red inside, oxygen out; the Ring's oxygen inside, hydrogen out.
  const p = plans[0], veil = p.events.find(e => e.type === NEB.veil), ring = p.events.find(e => e.type === NEB.ring);
  const along = (e, u) => [e.S[0] + Math.cos(e.angle) * u * e.Rmax * e.aspect, e.S[1] + Math.sin(e.angle) * u * e.Rmax * e.aspect];
  near(nebFrame(veil, along(veil, 0.5))[0], 0.5, 1e-9);
  assert.ok(nebColour(veil, along(veil, 0.92), 0.5)[0] === 1 && nebColour(veil, along(veil, 0.98), 0.9)[2] === 1, 'the Veil: red inside, blue out');
  assert.ok(nebColour(ring, along(ring, 0.55), 0.5)[1] > nebColour(ring, along(ring, 0.55), 0.5)[0] && nebColour(ring, along(ring, 0.8), 0.5)[0] === 1, 'the Ring: green inside, red out');
});

test('the freezing chain: seeds round the frame\'s edges, each drop frozen by the first bridge to reach it or the front behind, the middle last', () => {
  for (const p of plans) {
    const vb = DEW.bridge * p.H / 900;
    for (const sd of chainSeeds(p.W, p.H, p.phone)) assert.ok(Math.min(sd.p[0], p.W - sd.p[0], sd.p[1], p.H - sd.p[1]) < 0.06 * Math.max(p.W, p.H), 'a seed at an edge');
    const live = statics(p).filter(r => r.end === Infinity && r.t0 < DEW.end);
    let byBridge = 0;
    for (const r of live) {
      assert.ok(r.tf <= DEW.freezeBy + 1e-9, 'every drop frozen by freezeBy');
      assert.ok(r.tf <= chainAt(p, r.c) + 0.012 + DEW.dt + 1e-9, 'frozen once the front has passed');
      if (r.parent === undefined || r.parent < 0) continue;
      const o = p.records[r.parent];
      assert.ok(o.tf <= r.tf + 1e-9, 'a drop froze before the one that froze it');
      const gap = dist(r.c, o.c) - radiusAt(o, o.tf) - radiusAt(r, r.tf);
      assert.ok(gap <= DEW.bridgeMax + 1e-6, `bridge too long: ${gap.toFixed(1)}`);
      assert.ok(r.tf + DEW.dt + 1e-9 >= o.tf + Math.max(0, gap - 3) / vb, 'frozen before the bridge could arrive');
      byBridge++;
    }
    assert.ok(byBridge > live.length * 0.6, `${byBridge} of ${live.length} frozen by bridges`);
    assert.ok(chainAt(p, [p.W / 2, p.H / 2]) > chainAt(p, [p.W * 0.02, p.H / 2]), 'the middle freezes after the edge');
  }
});

test('crystals: seeds spaced apart, of several habits and none alike, in their drops\' colours; their cells tile the screen; the main crack runs the width', () => {
  for (const p of plans) {
    const cells = p.cells;
    for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) assert.ok(dist(cells[a].seed, cells[b].seed) > p.spacing * 0.6, 'seeds apart');
    let area = 0;
    for (const c of cells) c.poly.forEach((v, k) => { const w = c.poly[(k + 1) % c.poly.length]; area += (v[0] * w[1] - w[0] * v[1]) / 2; });
    near(Math.abs(area), p.W * p.H, p.W * p.H * 1e-6, 'cells tile the screen');
    assert.ok(new Set(cells.map(c => c.habit)).size >= 3, 'several habits');
    assert.equal(new Set(cells.map(c => c.hseed.toFixed(9))).size, cells.length, 'every crystal its own');
    // Most are dendrites, the finest; plates rarer.
    assert.ok(cells.filter(c => c.habit <= 1).length > cells.length * 0.4, 'mostly dendrites');
    // A crystal grown from a drop takes its colour.
    for (const c of cells.filter(c => c.r > 0)) assert.ok(c.col.every(v => v >= 0 && v <= 1));
    for (const c of cells) near(c.tc, chainAt(p, c.seed), 0.0041, 'grows as the freeze reaches it');
    assert.ok(p.crack[0][0] < 2 && p.crack.at(-1)[0] > p.W - 2, 'the crack runs the width');
    for (const v of p.crack) assert.ok(Math.abs(v[1] - p.H / 2) < p.H * 0.3, 'kept near the middle');
  }
});

test('the rift: an elliptical opening, a fracture front running out from the crack, pieces breaking away behind it', () => {
  for (const p of plans) {
    const mid = riftOpening(p, p.W / 2, DEW.riftWide), x = p.W * 0.8;
    near(mid, DEW.riftWidth * p.H, 1e-9);
    near(riftOpening(p, x, DEW.riftWide) / mid, Math.sqrt(1 - ((x - p.W / 2) / (0.53 * p.W)) ** 2), 1e-9, 'elliptical');
    assert.equal(riftOpening(p, p.W / 2, DEW.riftOpen), 0);
    for (const c of p.cells) {
      assert.ok(c.detach >= DEW.detach0 - 1e-9 && c.detach <= DEW.detach1 + 0.005);
      for (const v of c.poly) assert.ok(frontAt(p, v) <= c.detach + 1e-9, 'breaks away once the front has passed its corners');
    }
    // Rings outward from the crack go later on the whole.
    const byRing = new Map();
    for (const c of p.cells) { const a = byRing.get(c.ring) ?? []; a.push(c.detach); byRing.set(c.ring, a); }
    const means = [...byRing.keys()].sort((a, b) => a - b).map(k => byRing.get(k).reduce((s, v) => s + v, 0) / byRing.get(k).length);
    for (let k = 1; k < Math.min(4, means.length); k++) assert.ok(means[k] > means[k - 1], 'outward from the crack');
    near(crackY(p, p.crack[1][0]), p.crack[1][1], 1e-9);
  }
});

test('the break-apart: fragments tile each piece, leave as it breaks away, are vacuumed along the field and fuse into the card', () => {
  for (const p of plans) {
    const c = p.card, byCell = new Map();
    for (const f of p.frags) {
      const area = Math.abs((f.tri[1][0] - f.tri[0][0]) * (f.tri[2][1] - f.tri[0][1]) - (f.tri[2][0] - f.tri[0][0]) * (f.tri[1][1] - f.tri[0][1])) / 2;
      byCell.set(f.cell, (byCell.get(f.cell) ?? 0) + area);
      near(f.t0, p.cells[f.cell].detach, 1e-12, 'leaves as its piece breaks away');
      assert.ok(f.t1 > f.t0 && f.t1 <= GLASS_RELEASE - 0.05, 'fuses well before the hold lets go');
      const end = f.path.at(-1);
      assert.ok(end[0] >= c[0] - 1 && end[0] <= c[0] + c[2] + 1 && end[1] >= c[1] - 1 && end[1] <= c[1] + c[3] + 1, 'its line ends on the card');
      assert.equal(f.path.length, FRAG.path);
    }
    p.cells.forEach((cell, i) => {
      let area = 0;
      cell.poly.forEach((v, k) => { const w = cell.poly[(k + 1) % cell.poly.length]; area += (v[0] * w[1] - w[0] * v[1]) / 2; });
      assert.ok(Math.abs((byCell.get(i) ?? 0) - Math.abs(area)) <= Math.abs(area) * 0.03 + 20, `fragments tile piece ${i}`);
    });
  }
  const p = plans[0], k = Math.floor(p.frags.length / 3);
  assert.deepEqual(makeFragments(p, p.card)[k].path, p.frags[k].path, 'deterministic');
});
