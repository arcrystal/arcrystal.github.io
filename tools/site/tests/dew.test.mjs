// Stars, remnants, gravity's spots, cold from the card, the vacuum (Science → Racing): the supernovae
// and their spherical remnants, the gas's mirror, the Jeans clumps and their free fall, the stars'
// beads, the front from Racing's card and each drop's freezing and splitting, the field the shards are
// pulled along, the card's fuse clock, the optics, a click's freeze and burst, and the seam's timing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  makeDewPlan, packDew, spotLists, radiusAt, clearAt, clearStart, holdStartP, DEW, KIND, upOf,
  CLICK, clickEcho, clickSpots, clickFreeze, clickFlight, clickOpen, clickPull,
  SN, SHELL, remnantFrac, remnantInverse, lightCurve, nebDensity, nebulaRadius, shockAt, scienceDrops, hotOf,
  SKY, skyStars, hashG, hash2G, tri, NEB_RGB, hash3G, noise3G, turb3G, fbm3G, sphereGas, gasAt,
  SPOTS, jeansLength, freeFallTime, fallAngle, freeFall, supportAt,
  FREEZE, FIELD, SHARD_TEXELS, CLEAVE, frontSpeed, freezeTime, frontWave, pieceCount, ringsOf, aimShards,
} from '../../../static/site/scene/dew-plan.js';
import { TRACK, trackFrame, trackDistance, trackToWorld, trackLocal, trackPoint, trackTangent, trackShardAt } from '../../../static/site/scene/track-plan.js';
import { PALETTE, lineRGB, rgb } from '../../../static/site/scene/palette.js';
import { GIANTS, blackbody, lineColour } from '../../../static/site/scene/giants.js';
import { HOLD, holdFor, holdAt, glassEase, glassRaw, transitP, GLASS_RELEASE, HELD } from '../../../static/site/lerp.js';

const screens = [[1440, 900], [390, 844]];
const plans = screens.map(([w, h]) => makeDewPlan(w, h));
const near = (a, b, e = 1e-6, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} != ${b}`);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const statics = p => p.records.filter(r => r.science === undefined);
const src = readFileSync(new URL('../../../static/site/scene/glsl/dew.js', import.meta.url), 'utf8');
const units = readFileSync(new URL('../../../static/site/scene/glsl/units.js', import.meta.url), 'utf8');
const kOf = p => Math.max(0.8, Math.min(1.5, p.H / 900));
const ranks = a => { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length); o.forEach(([, i], k) => { r[i] = k; }); return r; };
const spearman = (a, b) => { const ra = ranks(a), rb = ranks(b), n = a.length, m = (n - 1) / 2; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (ra[i] - m) * (rb[i] - m); saa += (ra[i] - m) ** 2; sbb += (rb[i] - m) ** 2; } return sab / Math.sqrt(saa * sbb); };
const pk = p => { const d = packDew(p).data; return i => [...d.subarray(i * 4, i * 4 + 4)]; };

test('plans reproduce exactly from the seed and the size', () => {
  const again = makeDewPlan(390, 844);
  assert.deepEqual(JSON.stringify(again.records), JSON.stringify(plans[1].records));
  assert.deepEqual(JSON.stringify(again.shards), JSON.stringify(plans[1].shards));
  assert.deepEqual([...again.fuse.t], [...plans[1].fuse.t]);
  for (const p of plans) for (const r of p.records) for (const v of [r.c[0], r.c[1], r.V0, r.t0]) assert.ok(Number.isFinite(v));
});

test('supernovae: spheres, each with room of its own (only the outer fringes of neighbours crossing), in an order that is not a sweep', () => {
  for (const p of plans) {
    const ev = p.events;
    assert.equal(ev.length, p.phone ? 4 : 7);
    for (const e of ev) {
      assert.equal(e.aspect, 1, 'a sphere');
      near(e.S[0], GIANTS[e.giant].x * p.W, 1e-9); near(e.S[1], GIANTS[e.giant].y * p.H, 1e-9);
      near(e.hot, hotOf(GIANTS[e.giant].T), 1e-12);
      assert.ok(e.t >= holdStartP(p.phone) + 0.01 && e.t <= SN.end + 1e-9, 'in its window');
      near(nebulaRadius(e, e.t + e.span), e.Rmax, 1e-9, 'full size by cover');
    }
    assert.equal(new Set(ev.map(e => e.giant)).size, ev.length);
    for (let a = 0; a < ev.length; a++) for (let b = a + 1; b < ev.length; b++) {
      const d = dist(ev[a].S, ev[b].S);
      assert.ok(0.8 * (ev[a].Rmax + ev[b].Rmax) <= d, `bodies overlap (${p.W}: ${a}, ${b})`);
      assert.ok(ev[a].Rmax + ev[b].Rmax <= 1.21 * d, `more than the fringes cross (${p.W}: ${a}, ${b})`);
    }
    const order = ev.map(e => e.t);
    assert.ok(Math.abs(spearman(order, ev.map(e => e.S[1]))) <= 0.4 + 1e-9 && Math.abs(spearman(order, ev.map(e => e.S[0]))) <= 0.4 + 1e-9, `a sweep (${p.W})`);
  }
  // A blue progenitor is hot, a red one cool.
  assert.ok(hotOf(30000) > 0.99 && hotOf(3400) < 0.01 && hotOf(9000) > hotOf(5000));
});

test('remnants: free expansion then the Sedov–Taylor slope, the Ni→Co light curve, the shell limb-brightened', () => {
  const slope = (x, h = 1e-4) => Math.log(remnantFrac(x * (1 + h)) / remnantFrac(x)) / Math.log(1 + h);
  near(slope(1e-4), 1, 0.01, 'free expansion');
  near(slope(5), 0.4, 0.01, 'Sedov–Taylor');
  assert.ok(slope(1) > 0.4 && slope(1) < 0.45, 'well into the Sedov phase by the final radius');
  for (let x = 0.001; x < 1; x += 0.001) assert.ok(remnantFrac(x + 0.001) > remnantFrac(x));
  near(remnantFrac(1), 1, 1e-12);
  for (const y of [0.1, 0.5, 0.9]) near(remnantFrac(remnantInverse(y)), y, 1e-9, 'inverse');
  near(SN.tauCo / SN.tauNi, 111.3 / 8.8, 1e-9, 'mean lives');
  const late = s => Math.log(lightCurve(s) / lightCurve(s + 0.001)) / 0.001;
  near(1 / late(0.15), SN.tauCo, SN.tauCo * 0.02, 'the cobalt tail');
  // A soft breakout: it swells, never more than about its peak.
  for (let s = 0; s < 0.004; s += 0.0002) assert.ok(lightCurve(s + 0.0002) >= lightCurve(s));
  assert.ok(Math.max(...Array.from({ length: 200 }, (_, i) => lightCurve(i * 0.0005))) < 1.4);
  // The column through the shell: brightest at the limb (ρ = the inner edge), dimmer through the middle.
  const e = plans[0].events[0], at = r => nebDensity(e, [e.S[0] + r * e.Rmax, e.S[1]]);
  assert.ok(at(SHELL.inner) > 1.5 * at(0.05), 'limb-brightened');
  assert.equal(at(1.2), 0);
  for (const p of plans) for (const e of p.events) for (const u of [0.2, 0.5, 0.9]) {
    const q = [e.S[0] + u * e.Rmax, e.S[1]];
    let lo = e.t, hi = e.t + e.span;
    for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (nebulaRadius(e, m) < u * e.Rmax) lo = m; else hi = m; }
    assert.ok(shockAt(p, q) <= hi + 1e-6, 'swept up when reached');
  }
});

test('the gas, mirrored: the shader\'s noise and remnant light, the same functions', () => {
  // Hoskins' hash in 3D, each lattice value through a triangle wave: uniform, and the noise continuous.
  const v = Array.from({ length: 20000 }, (_, i) => noise3G(i * 0.731, i * 0.377, i * 0.113));
  assert.ok(v.every(x => x >= 0 && x <= 1));
  for (let i = 0; i < 200; i++) { const x = i * 0.37, y = i * 0.21, z = i * 0.13; near(noise3G(x + 1e-5, y, z), noise3G(x, y, z), 1e-3, 'continuous'); }
  const hv = Array.from({ length: 20000 }, (_, i) => tri(hash3G(i, i * 3 + 1, i * 7 + 2)));
  for (const q of [0.25, 0.5, 0.75]) near(hv.filter(x => x < q).length / hv.length, q, 0.03, 'uniform');
  assert.ok(turb3G(1.3, 2.2, 0.4) >= 0 && fbm3G(1.3, 2.2, 0.4) >= 0);
  // The shader's are these (its source, as built).
  assert.match(src, /float dewH3\(vec3 p\) \{ p = fract\(p \* \.1031\); p \+= dot\(p, p\.zyx \+ 31\.32\); return fract\(\(p\.x \+ p\.y\) \* p\.z\); \}/);
  assert.match(src, /p = p \* 2\.07 \+ vec3\(1\.7, 9\.2, 4\.4\)/);
  assert.match(src, /p = p \* 2\.03 \+ vec3\(5\.1, 2\.3, 7\.9\)/);
  assert.match(src, /float front = cf \* \(\(\.03 \+ \.3 \* bf\) \* limb \+ 4\.8 \* wf \* \(\.35 \+ \.65 \* bf\)\)/);
  assert.match(src, /float af = \.8 \+ \.1 \* \(2\.0 \* dewN3\(pf \/ max\(length\(pf\), 1e-3\) \* 3\.4 \+ o\) - 1\.0\);/);
  // A remnant's light: its shell's and its ejecta's, zero beyond it, brighter toward its limb on the whole.
  const e = plans[0].events[1], k = (r, a) => sphereGas([r * Math.cos(a), r * Math.sin(a)], 1, e.seed, e.hot)[0];
  assert.equal(k(1.15, 0), 0);
  const mean = r => Array.from({ length: 64 }, (_, i) => k(r, i * 0.098)).reduce((s, x) => s + x, 0) / 64;
  assert.ok(mean(0.9) > mean(0.3), 'its shell brighter than its middle');
  const g = gasAt(plans[0], e.S);
  assert.ok(g.rho >= SPOTS.ism && g.gold >= 0 && g.teal >= 0);
});

test('gravity\'s spots: clumps about a Jeans length apart (∝ (c²/ρ)^½), the dense falling first, each drop its cell\'s gas', () => {
  for (const p of plans) {
    const k = kOf(p), cl = p.clumps;
    assert.ok(cl.length > (p.phone ? 60 : 250), `${cl.length} clumps (${p.W})`);
    // Spacing: each clump's nearest neighbour about its Jeans length away (the Poisson disc's mean of
    // the two, jittered), so the spacing falls as ρ^−½ where it is not clamped.
    const pts = [];
    for (const s of cl) {
      let dn = Infinity, o = null;
      for (const t of cl) if (t !== s) { const d = dist(s.c, t.c); if (d < dn) { dn = d; o = t; } }
      assert.ok(dn >= 0.5 * (s.ell + o.ell) * 0.9 - 1e-9, 'no closer than their Jeans lengths allow');
      near(s.ell, jeansLength(s.rho, k, s.c2), 1e-9);
      if (s.ell > SPOTS.ellMin * k * 1.05 && s.ell < SPOTS.ellMax * k * 0.95) pts.push([Math.log(s.rho / s.c2), Math.log(dn)]);
    }
    const n = pts.length, mx = pts.reduce((a, q) => a + q[0], 0) / n, my = pts.reduce((a, q) => a + q[1], 0) / n;
    const slope = pts.reduce((a, q) => a + (q[0] - mx) * (q[1] - my), 0) / pts.reduce((a, q) => a + (q[0] - mx) ** 2, 0);
    assert.ok(slope < -0.3 && slope > -0.7, `spacing ∝ (c²/ρ)^½: slope ${slope.toFixed(2)} (${p.W})`);
    // Free fall: the dense first; t_ff ∝ ρ^−½.
    assert.ok(spearman(cl.map(s => s.rho), cl.map(s => s.tsnap - s.ts)) < -0.9, 'the dense fall quicker');
    for (const s of cl) {
      near(s.tsnap - s.ts, freeFallTime(s.rho), 1e-9);
      assert.ok(s.tsnap < 0.5, 'every drop before the card appears');
      // Its drop: its gathered gas's volume (Jeans mass), no larger than rMax of its Jeans length.
      const r = Math.min(Math.cbrt(SPOTS.beta * s.mass / k ** 2) * k, SPOTS.rMax * s.ell);
      near(s.r, Math.max(0.9, r), 1e-9);
      assert.ok(Math.abs(Math.max(...s.col) - 1) < 1e-9 && Math.min(...s.col) >= 0);
      // Its record: its volume arriving over the last fifth of its fall.
      const rec = p.records[s.rec];
      near(radiusAt(rec, s.tsnap), s.r, 1e-6); near(rec.t0, s.tsnap - 0.2 * (s.tsnap - s.ts), 1e-12);
      assert.equal(radiusAt(rec, rec.t0), 0);
    }
    // Free fall's shell, r = r₀cos²β with t/t_ff = (β + sin β cos β)/(π/2).
    for (let tau = 0; tau <= 1; tau += 0.05) { const b = fallAngle(tau); near((b + Math.sin(b) * Math.cos(b)) / (Math.PI / 2), tau, 1e-9); near(freeFall(tau), Math.cos(b) ** 2, 1e-12); }
    // The tiles list every clump whose cell can reach them.
    const sl = spotLists(p);
    for (const s of cl) {
      const R = s.R * 1.35 + 4;
      for (const [x, y] of [[s.c[0] + R * 0.7, s.c[1]], [s.c[0], s.c[1] - R * 0.7], [s.c[0], s.c[1]]]) {
        if (x < 0 || y < 0 || x >= p.W || y >= p.H) continue;
        assert.ok(sl.lists[Math.floor(y / sl.T) * sl.cols + Math.floor(x / sl.T)].includes(s.rec), 'listed');
      }
    }
    assert.ok(supportAt([10, 10], 1) > supportAt([10, 10], 0), 'hotter gas is held up more');
  }
  // The shader falls the same way.
  assert.match(src, /b = clamp\(b - \(b \+ sin\(b\) \* cos\(b\) - tau \* PI \* \.5\) \/ max\(1\.0 \+ cos\(2\.0 \* b\), \.02\), 0\.0, PI \* \.5\);/);
});

test('cold from the track: a front out from it, each drop recalescing, freezing through in τ ∝ r², splitting along 60° planes into pieces that cover it', () => {
  for (const p of plans) {
    const k = kOf(p), card = p.cardRect;
    near(p.vFreeze, frontSpeed(p.W, p.H, card), 1e-9);
    // The front: f0 at the card's edge, f1 at the farthest corner, wavy by at most wobble.
    for (let i = 0; i < 300; i++) {
      const q = [(i * 0.618 % 1) * p.W, (i * 0.414 % 1) * p.H], d = trackDistance(q, trackFrame(p.W,p.H,card));
      near(freezeTime(p, q), FREEZE.f0 + d / p.vFreeze + FREEZE.wobble * frontWave(q) * Math.min(1, d / 160), 1e-12);
      assert.ok(Math.abs(freezeTime(p, q) - FREEZE.f0 - d / p.vFreeze) <= FREEZE.wobble + 1e-12);
    }
    near(Math.max(...[[0, 0], [p.W, 0], [0, p.H], [p.W, p.H]].map(q => FREEZE.f0 + trackDistance(q, trackFrame(p.W,p.H,card)) / p.vFreeze)), FREEZE.f1, 1e-9);
    near(trackDistance(trackToWorld(trackPoint(.2,3),trackFrame(p.W,p.H,card)),trackFrame(p.W,p.H,card)),0);
    let checked = 0;
    p.records.forEach((r, id) => {
      if (!r.freeze) return;
      const sci = r.science !== undefined, rr = sci ? Math.cbrt(r.V0) : radiusAt(r, 9), f = r.freeze;
      near(f.tf, freezeTime(p, r.c), 1e-12);
      near(f.tc - f.tf - FREEZE.cleave, Math.min(FREEZE.stefan * (rr / k) ** 2, FREEZE.through), 1e-12, 'Stefan: τ ∝ r²');
      assert.equal(f.n, sci ? 6 : pieceCount(rr, k, !!r.sky));
      const mine = p.shards.slice(f.first).filter(s => s.rec === id);
      const rings = f.n === 1 ? [0, 1] : ringsOf(rr, k, sci);
      assert.equal(mine.length, (sci ? 2 * f.n : f.n) * (rings.length - 1));
      // Its cracks: of the six prism directions θ₀ + 60°k (a chrome drop's halved again).
      for (const s of mine) {
        if (f.n === 1) { near(s.a1 - s.a0, 2 * Math.PI, 1e-9); continue; }
        const steps = (s.a0 - f.th0) / (Math.PI / (sci ? 6 : 3));
        near(steps, Math.round(steps), 1e-9, 'on a prism plane');
        assert.ok(s.t0 >= f.tc + FIELD.lag - 1e-12, 'pulled once split');
      }
      // The pieces cover it, once each.
      for (let m = 0; m < 24; m++) {
        const a = m * 2.399963, rad = rr * 0.97 * Math.sqrt((m + 0.5) / 24), q = [Math.cos(a) * rad, Math.sin(a) * rad];
        const hits = mine.filter(s => { const ang = ((Math.atan2(q[1], q[0]) - s.a0) % (2 * Math.PI) + 4 * Math.PI) % (2 * Math.PI), rq = Math.hypot(...q); return ang < s.a1 - s.a0 && rq >= s.rin - 1e-9 && rq < s.r; });
        assert.equal(hits.length, 1, `drop ${id} at ${m}`);
      }
      checked++;
    });
    assert.ok(checked > 200, `${checked} drops`);
    for (const [n, dirs] of Object.entries(CLEAVE)) assert.equal(dirs.length, +n === 1 ? 0 : +n);
  }
  // The shader's front and cracks are the plan's.
  assert.match(src, /float wave = \.6 \* sin\(qp\.x \* \.0061 \+ qp\.y \* \.0037\) \* sin\(qp\.y \* \.0053 - qp\.x \* \.0029\) \+ \.4 \* sin\(qp\.x \* \.0113 - qp\.y \* \.0071 \+ 1\.3\);/);
  assert.match(units, /bool on = n > 5\.5 \? true : n > 4\.5 \? k < 5 : n > 3\.5 \? \(k != 2 && k != 5\) : n > 2\.5 \? \(k == 0 \|\| k == 2 \|\| k == 4\) : \(k == 0 \|\| k == 3\);/);
});

test('track capture: every droplet fragments, every lane fills, arrivals settle before release, compact packing', () => {
  for (const [index,p] of plans.entries()) {
    const card=p.cardRect, sh=p.shards, lanes=new Array(8).fill(0);
    assert.ok(p.records.every(r=>r.freeze), 'no visible drops omitted');
    for(const r of p.records.filter(r=>r.sky)) assert.equal(r.freeze.n,2,'star beads cleave');
    for(const s of sh){
      assert.ok(s.t0<s.join && s.join<s.t1 && s.t1<1.14);
      lanes[Math.round(s.lane)]++;
      assert.ok(s.lane>-.5 && s.lane<7.5);
      near(dist(trackShardAt(s,s.t0,p.W,p.H,card),s.start),0);
      const entry=trackShardAt(s,s.join,p.W,p.H,card);
      near(dist(entry,s.entry),0,1e-6);
      // The entry has matching first derivatives, so it never snaps sideways into a lane.
      const before=trackShardAt(s,s.join-1e-6,p.W,p.H,card),after=trackShardAt(s,s.join+1e-6,p.W,p.H,card);
      const a=entry.map((x,j)=>x-before[j]),b=after.map((x,j)=>x-entry[j]);
      assert.ok((a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b))>.999,'tangent entry');
      const end=trackShardAt(s,s.t1,p.W,p.H,card),frame=trackFrame(p.W,p.H,card,s.t1);
      near(trackDistance(end,frame),0,1e-6,'lands on the track');
      const local=trackLocal(end,frame),want=trackPoint(s.phase+s.laps,s.lane);
      near(dist(local,want),0,1e-6);
      assert.deepEqual(trackShardAt(s,.91,p.W,p.H,card),trackShardAt(s,.91,p.W,p.H,card),'seek is stateless');
    }
    assert.ok(Math.max(...lanes)-Math.min(...lanes)<=1,'balanced lanes');
    const peak=sh.filter(s=>s.t0<.95&&s.t1>.95).length;
    assert.ok(peak>=[879,585][index]*1.5,'at least 1.5 times baseline simultaneous shards');
    for(const g of p.field.grid){near(Math.hypot(g[0],g[1]),1,1e-9);assert.ok(g[3]<1.02,'old world drains before settlement');}
    const moved=[card[0]+30,card[1]+24,card[2]-10,card[3]];
    const a=makeDewPlan(p.W,p.H,{phone:p.phone});aimShards(a,moved);
    const b=makeDewPlan(p.W,p.H,{phone:p.phone,card:moved});
    assert.deepEqual(a.shards,b.shards);assert.deepEqual([...a.fuse.t],[...b.fuse.t]);
    const cell=pk(p),h=cell(18);
    assert.equal(h[2],sh.length);
    sh.forEach((s,i)=>{const base=h[1]+i*SHARD_TEXELS,A=cell(base+1),C=cell(base+5);near(A[1],s.t0,1e-6);near(A[2],s.t1,1e-6);near(C[0],s.lane,1e-6);near(C[3],s.join,1e-6);});
    assert.ok(packDew(p).data.every(Number.isFinite),'finite GPU data');
    assert.ok(packDew(p).stats.bytes<[1130496,376832][index],'smaller than original packed plan');
  }
});

test('track geometry: continuous closed lanes, invertible placement, exact final tile fit',()=>{
 for(let lane=0;lane<8;lane++){
   near(dist(trackPoint(0,lane),trackPoint(1,lane)),0);
   const r=TRACK.inner+(lane+.5)*TRACK.lane,L=4*TRACK.straight+2*Math.PI*r;
   for(const s of [0,2*TRACK.straight,2*TRACK.straight+Math.PI*r,4*TRACK.straight+Math.PI*r,L]){
     const a=trackTangent(s/L-1e-6,lane),b=trackTangent(s/L+1e-6,lane);
     assert.ok(a[0]*b[0]+a[1]*b[1]>.99999);
   }
 }
 for(const p of plans){const card=p.cardRect,frame=trackFrame(p.W,p.H,card,1.2);
   assert.deepEqual(frame,trackFrame(p.W,p.H,card,1.14));
   for(let i=0;i<100;i++){const q=trackPoint(i/100,7.5),w=trackToWorld(q,frame);near(dist(trackLocal(w,frame),q),0,1e-9);assert.ok(w[0]>card[0]&&w[0]<card[0]+card[2]&&w[1]>card[1]&&w[1]<card[1]+card[3]);}
 }
});

test('the hold lets go as the transition ends (GLASS_RELEASE 1.2); the strip comes in as Science; the dawn is the slowest', () => {
  assert.equal(GLASS_RELEASE, 1.2);
  for (const p of plans) {
    const pin = p.phone ? HOLD.pinTouch : HOLD.pin, L = holdFor('glass', pin), H = p.H * (1 + pin * L.pin), T = 4000;
    assert.equal(L.leadOut, 0);
    const release = T + H - p.H;
    near(transitP(glassEase(holdAt(release, T, H, p.H, L.leadIn, L.leadOut).p)), GLASS_RELEASE, 1e-12);
    const first = Math.min(...p.events.map(e => e.t));
    for (let sy = T - L.leadIn * p.H; sy < release; sy += 13) {
      const { y, p: raw } = holdAt(sy, T, H, p.H, L.leadIn, L.leadOut), P = transitP(glassEase(raw));
      if (y > 0) assert.ok(P <= first - 0.022 + 1e-9, `a supernova while the strip comes in at ${p.W}, P=${P}`);
    }
  }
  // The card's light given back as Racing's dawn (P 1.02 → 1.11) gets the most scroll; the gas gathering
  // into its drops (.34 → .5) more than the supernovae.
  const rate = P => glassRaw(P + 0.01) - glassRaw(P);
  for (const P of [0, 0.2, 0.4, 0.6, 0.8, 0.9]) assert.ok(rate(P) < rate(1.04), `slower at the dawn than at ${P}`);
  assert.ok(rate(0.4) > rate(0.15), 'the spots unhurried');
  for (let r = 0; r <= 1; r += 0.01) near(glassRaw(transitP(glassEase(r))), r, 1e-6, 'its inverse');
  const home = readFileSync(new URL('../../../static/site/home.js', import.meta.url), 'utf8');
  // (home.js surfaces a held band from HELD: Racing's content from P 1.02 over .16.)
  assert.deepEqual(HELD.glass, [1.08, 0.10]);
  assert.match(home, /const \[s0, ds\] = HELD\[c\.style\], sf = clamp\(\(transitP\(p\) - s0\) \/ ds\)/);
  assert.match(src, /if \(!click && P >= 1\.18\) \{ gCardMix = 1\.0; return vec4\(sceneGlacier\(px\), 1\.0\); \}/);
  assert.match(src, /trSurface\(dewDisplay\(col\),qp,frame/);
});

test('a click: the old page covered by the light before it changes, every shard home and the night everywhere by then, the dawn the DOM opens behind', () => {
  // The light from the click covers every point well before the page changes (.84).
  assert.ok(clickEcho(1) + 0.03 < 0.84 && clickEcho(0) > -0.2, 'covered in time');
  for (let up = 0; up <= 1; up += 0.05) {
    assert.ok(clickSpots(up) > clickEcho(up), 'the gas falls after the light has lit it');
    assert.ok(clickFreeze(up) > clickSpots(up) + CLICK.kappa * SPOTS.tffMax, 'its drops formed before the cold');
    assert.ok(clickFreeze(up + 0.05) > clickFreeze(up) && clickFlight(up + 0.05) >= clickFlight(up), 'out from the click');
    assert.ok(clickOpen(up) < 0.84, `everything home and the night shown before the page changes (${up.toFixed(2)})`);
  }
  // A point sink's overdamped fall: r² falls steadily, r = r₀√(1 − u).
  const O = [300, 200], home = [900, 650], r0 = dist(home, O);
  for (let u = 0; u <= 1; u += 0.1) near(dist(clickPull(home, O, u), O) ** 2, r0 * r0 * (1 - u), 1e-6);
  // The ring of dawn: the new page behind it, clear by 1.12 everywhere.
  for (const p of plans) for (const O of [[0, 0], [p.W / 2, p.H / 2], [p.W - 1, p.H - 1]]) {
    for (let y = 0; y <= p.H; y += 73) for (let x = 0; x <= p.W; x += 79) {
      const q = [x, y];
      assert.equal(clearAt(p, q, 0.84, O), 0);
      assert.equal(clearAt(p, q, 1.12, O), 1);
      assert.ok(upOf(p, q, O) <= 1 + 1e-9);
    }
  }
  // scene.js's DOM aperture: within the fully clear ring (clear0 + clearUp·up + its wobble + clearD).
  const scene = readFileSync(new URL('../../../static/site/scene/scene.js', import.meta.url), 'utf8');
  assert.match(scene, /const radius=Math\.max\(0,\(\.36\*e-\.086\)\/\.18\)\*far;/);
  assert.deepEqual({ ...DEW.click }, { clear0: 0.84, clearUp: 0.18, clearD: 0.08 });
  // The shaders keep the click's clocks.
  assert.match(src, /float dewClickEcho\(float up\) \{ return \$\{f\(CLICK\.echo\[0\]\)\} \+ \$\{f\(CLICK\.echo\[1\]\)\} \* up; \}/);
  assert.match(src, /float dewClickFreeze\(float up\) \{ return \$\{f\(CLICK\.freeze\[0\]\)\} \+ \$\{f\(CLICK\.freeze\[1\]\)\} \* up; \}/);
  assert.match(src, /float dewClearStart\(vec2 q\) \{ float up = dewUp\(q\); return \.84 \+ \.18 \* up \+ \.006 \* sin\(q\.x \* \.008\) \* sin\(q\.y \* \.007\) \* up; \}/);
  assert.match(units, /float clickFreeze\(float up\) \{ return \$\{CLICK\.freeze\[0\]\.toFixed\(4\)\} \+ \$\{CLICK\.freeze\[1\]\.toFixed\(4\)\} \* up; \}/);
  assert.match(units, /float clickFlight\(float up\) \{ return \$\{CLICK\.fly\[0\]\.toFixed\(4\)\} \+ \$\{CLICK\.fly\[1\]\.toFixed\(4\)\} \* up \* up; \}/);
  assert.match(units, /float kk = sqrt\(max\(1\.0 - min\(u, 1\.0\), 0\.0\)\);/);
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
});

test('Science\'s stars: the plan\'s are the sky\'s; each condenses into a bead, and the beads turn to snow', () => {
  // The hash, worked in float32 as the GPU does: glsl/common.js hash and hash2 (Hoskins), here at a few
  // points worked by hand in double precision (they agree to float32's few last bits).
  const ref = (x, y) => { const fr = v => v - Math.floor(v); let a = fr(x * 0.1031), b = fr(y * 0.1031), c = a; const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33); a += d; b += d; c += d; return fr((a + b) * c); };
  for (const [x, y] of [[3, 7], [40, 12], [101.2, 33.1], [9, 9]]) { const e = Math.abs(hashG(x, y) - ref(x, y)); assert.ok(Math.min(e, 1 - e) < 0.01, `hash at ${x}, ${y}`); }
  assert.ok(hash2G(5, 6).every(v => v >= 0 && v < 1));
  // tri keeps a uniform draw uniform, and is continuous where the hash wraps.
  near(tri(0), tri(1), 1e-12); near(tri(0.5), 1, 1e-12);
  const u = Array.from({ length: 20000 }, (_, i) => tri(((i * 0.6180339887) % 1)));
  for (const q of [0.25, 0.5, 0.75]) near(u.filter(v => v < q).length / u.length, q, 0.02, 'uniform');
  for (const [W, H] of screens) {
    const stars = skyStars(W, H);
    // Each layer as dense as its threshold says (a star in 1 − cut of its cells), placed in its cell.
    for (let l = 0; l < 3; l++) {
      const sc = 46 - 12 * l, n = stars.filter(s => s.l === l).length, want = (W / sc) * (H / sc) * (1 - (0.86 - 0.05 * l));
      assert.ok(Math.abs(n - want) < Math.max(12, want * 0.3), `layer ${l}: ${n} stars, about ${want.toFixed(0)}`);
    }
    for (const s of stars) {
      assert.ok(s.t >= SKY.c0 && s.t <= SKY.c0 + SKY.span && s.tint >= 0 && s.tint <= 1);
      assert.ok(s.c[0] >= 0 && s.c[0] < W && s.c[1] >= 0 && s.c[1] < H);
    }
    // When each condenses is not a sweep down (or across) the screen.
    assert.ok(Math.abs(spearman(stars.map(s => s.t), stars.map(s => s.c[1]))) < 0.15 && Math.abs(spearman(stars.map(s => s.t), stars.map(s => s.c[0]))) < 0.15, 'random, not a sweep');
  }
  for (const p of plans) {
    const stars = skyStars(p.W, p.H), beads = p.records.filter(r => r.sky);
    // Nearly every star becomes a bead (one over a clump's drop falls into it); before the card
    // appears; brighter stars, larger beads; pale water.
    assert.ok(beads.length >= stars.length * 0.8, `${beads.length} beads of ${stars.length} stars`);
    for (const r of beads) {
      near(r.t0, r.sky.t, 1e-12);
      assert.ok(r.tg < FREEZE.f0, 'condensed before the card appears');
      near(radiusAt(r, 9), SKY.r[r.sky.l] * (0.85 + 0.3 * (r.sky.b - 0.76) / 0.24), 1e-9, 'its size by its star');
      assert.ok(Math.min(...r.col) > 0.5, 'pale: a star\'s light in clear water');
      assert.ok(p.clumps.every(s => dist(s.c, r.c) >= s.r + radiusAt(r, 9) + 1 - 1e-9), 'not inside a clump\'s drop');
      // It freezes whole and leaves as one point of light.
      assert.equal(r.freeze.n, 2);
    }
    // Packed: a bead's kind code marks it a star (+ 32), its star's data in its third texel.
    const cell = pk(p), recBase = cell(2)[0], k = p.records.indexOf(beads[0]);
    assert.ok(Math.floor(cell(recBase + k * 5)[3] / 1000) >= 32);
    near(cell(recBase + k * 5 + 2)[3], beads[0].sky.t, 1e-6);
  }
  const cosmos = readFileSync(new URL('../../../static/site/scene/glsl/cosmos.js', import.meta.url), 'utf8');
  assert.match(cosmos, /float b = tri\(hash\(id \+ fl \* 3\.1\)\);/);
  assert.match(cosmos, /tri\(hash\(id \+ vec2\(fl \* 7\.7, 23\.0\)\)\)/);
  assert.match(cosmos, /\(tri\(hash2\(id \+ fl \* 17\.0\)\) - 0\.5\) \* 0\.8/);
  assert.match(cosmos, /\$\{SKY\.c0\.toFixed\(4\)\} \+ \$\{SKY\.span\.toFixed\(4\)\}/);
  assert.match(units, /bool star = code >= 32\.0/);
});

test('Science\'s palette: one source for the page, the sky, the nebulae and the ice', () => {
  const css = PALETTE.css;
  const styles = JSON.parse(readFileSync(new URL('../../../static/site/styles.json', import.meta.url), 'utf8')).styles.cosmos.colors;
  for (const k of ['bg', 'surface', 'ink', 'mute', 'accent', 'accent2', 'accent3']) assert.equal(styles[k].toUpperCase(), css[k].toUpperCase(), `styles.json ${k}`);
  const sheet = readFileSync(new URL('../../../static/site/styles/cosmos.css', import.meta.url), 'utf8');
  const tok = { 'c-bg': 'bg', 'c-surface': 'surface', 'c-fg': 'ink', 'c-fg-mute': 'mute', 'c-fg-soft': 'soft', 'c-accent': 'accent', 'c-accent-2': 'accent2', 'c-accent-3': 'accent3' };
  for (const [t, k] of Object.entries(tok)) assert.match(sheet, new RegExp(`--${t}: ${css[k]};`, 'i'), `cosmos.css --${t}`);
  assert.equal(sheet.match(/--c-haze: (#[0-9A-F]{6});/i)?.[1].toUpperCase(), PALETTE.sky.body.toUpperCase());
  assert.deepEqual(NEB_RGB, lineRGB(PALETTE));
  // The nebulae's colours keep to two families, gold to amber and teal to sky blue, and the pale.
  const hsv = h => { const [r, g, b] = rgb(h), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let hue = 0; if (d) hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(hue * 60 + 360) % 360, mx ? d / mx : 0]; };
  for (const [k, h] of Object.entries(PALETTE.neb)) {
    const [hue, sat] = hsv(h);
    assert.ok(sat < 0.25 || (hue >= 22 && hue <= 50) || (hue >= 165 && hue <= 205), `${k} ${h}: hue ${hue.toFixed(0)}°`);
  }
  // Nothing of the old violet and magenta left in Science's own style.
  const old = /#22E6FF|#FF3DCB|#B9A6FF|#A29FC9|#ECE9FF|91 59 255|185 166 255|185,166,255|34,230,255|34, 230, 255|255, 61, 203/i;
  for (const rel of ['static/site/styles/cosmos.css', 'science/page/page.css', 'science/page/sims/stage.js', 'science/page/sims/trappist.js', 'science/page/sims/phyllotaxis.js', 'science/page/sims/voyager.js', 'science/page/sims/taalas.js', 'science/page/sims/supermountains.js', 'static/site/scene/glsl/cosmos.js'])
    assert.doesNotMatch(readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8'), old, rel);
});
