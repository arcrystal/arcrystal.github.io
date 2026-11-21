// Photography → Chess: the vortex rings' choreography. Every plume is a vortex ring (an ink drop entering
// water is one: a dense rolling head trailing a thin stem), and one law moves them all, Biot–Savart, the
// law by which loops of current make magnetic fields: so rings draw one another on, push apart, and pass
// through each other. Integrated once, in the bake (living-ink-plan.js, per aspect), along the scroll's
// standard pace; then read by the scroll (vortex-ink.js), so it is the same however fast it is scrolled,
// and scrolling back un-builds it. glsl/living-ink.js headInk draws each ring.
//
// The frame (V): screen heights under the final, underwater camera: x by the aspect, y up, and the mist
// volume's depth (0 the back wall … 1 the glass). Time: seconds at the standard pace, two a screen.
import { DROPS, PRECIPITATION, LATE, CAMERA, projectTank, seeded } from './ink-tank.js';
import { inkRaw, holdFor, HOLD } from '../lerp.js';

export const RINGS = Object.freeze({
  // P from the first drop's entry to the last piece's: every ring's state each `step`.
  from: .12, to: 1.10, step: .002,
  secondsPerScreen: 2,
  // A ring's core as a share of its radius (thick: a drop's), how fast it takes in water (its radius grows
  // `grow` for each radius it travels) and how its circulation decays (s).
  core: .45, grow: .1, decay: 7, most: .1,
  // Sizes (V) from a drop's radius (tank): primaries, the late heads, the rain.
  size: Object.freeze({ primary: 1.7, late: 2, rain: 1.3 }),
  // How long each kind lives (P): the small drops spend themselves before the camera is under (their ink
  // is the water's haze); the rain is swallowed by its parent; a calved ring trails off. The four trunks
  // and the six late heads live until they unmix into their pieces.
  // (Every drop's own ring lives on until its piece: after its plunge a small one disperses into the water
  // (vortex-ink.js thins it) and gathers again for its piece.)
  life: Object.freeze({ rain: .07, child: .12 }),
  // The unmixing (per family, from its site's formStart − `lead` to its formPeak): the plume played
  // backward: its rings glide to the piece's place, draw in to the piece's size (`size` of its height) and
  // turn upright, its mini-rings drawn back into it; then its ink is the piece's (glsl/living-ink.js
  // INK_PIECE's ink stage).
  unmix: Object.freeze({ lead: .025, size: .3 }),
  trunks: Object.freeze([0, 1, 10, 23]),
  // How far each kind would travel on its own (V), before the others and the walls have their say.
  reach: Object.freeze({ primary: .55, late: .62, rain: .18 }),
  // The cascade: a ring that has travelled `after` of its own radii, and is big enough, calves `count`
  // mini-rings round its rim (each `size` of it, `share` of its circulation, thrown out by `splay` rad).
  calve: Object.freeze({ after: 5.5, least: .035, count: [2, 3], size: .42, share: .4, splay: .65 }),
  // The frame it keeps to (V): margins at the sides, the floor, depth.
  frame: Object.freeze({ side: .06, floor: .07, near: .9, far: .12, push: 1.6 }),
  // The dance (P): each hero ring (the trunks and the late heads) drawn toward its nearest partner of the
  // other ink, as magnets are (stronger as they near, `pull` V/s² at a screen's distance, most `most`),
  // turning to swim at it (`turn` per s), pushed off when they come within `apart` of touching (`push`); and each settling toward a
  // depth of its own (`home`: y from … to, `settle` per s), so the plumes spread through the frame.
  // Partners also swing round each other (`swing`: the sideways share of the pull, its sense by the pair),
  // so a pair orbits and the nearest partner changes as they go: it never settles.
  dance: Object.freeze({ window: Object.freeze([.55, .6, .69, .74]), pull: .008, most: .04, turn: .5, push: .3, apart: 1.7, home: Object.freeze([.24, .72]), settle: .35, swing: .9 }),
});

const smooth01 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const screensDesktop = P => { const h = holdFor('ink', HOLD.pin); return inkRaw(P, HOLD.pin) * (h.pin * HOLD.pin + h.leadIn); };
// Seconds (at the standard pace) from the start of the rings' span to P.
export function ringTime(P) { return RINGS.secondsPerScreen * (screensDesktop(P) - screensDesktop(RINGS.from)); }

// The underwater camera's map from tank coordinates to V (x by the aspect, y up, depth).
export function toV(x, d, z, aspect) { const p = projectTank(x, d, z, CAMERA.below, aspect); return [p[0] * aspect, p[1], p[2]]; }

const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const basis = n => { const e1 = norm(cross(n, Math.abs(n[2]) < .9 ? [0, 0, 1] : [1, 0, 0])); return [e1, cross(n, e1)]; };

// A ring's own speed through the water (Kelvin, a thin-cored ring): Γ/(4πR)(ln(8R/a) − ¼).
export const selfSpeed = (G, R, a) => G / (4 * Math.PI * R) * (Math.log(8 * R / a) - .25);
// Its 12 straight segments (their ends), kept on the ring and renewed each step.
const COS = Array.from({ length: 13 }, (_, k) => Math.cos(2 * Math.PI * k / 12)), SIN = Array.from({ length: 13 }, (_, k) => Math.sin(2 * Math.PI * k / 12));
function nodes(r) {
  const [e1, e2] = basis(r.n), out = new Float64Array(39);
  for (let k = 0; k <= 12; k++) for (let j = 0; j < 3; j++) out[3 * k + j] = r.c[j] + r.R * (COS[k] * e1[j] + SIN[k] * e2[j]);
  r.nodes = out; r.e1 = e1; r.e2 = e2;
}
// Its velocity at x (a Rosenhead–Moore core: smooth inside the core).
export function induced(ring, x) {
  if (!ring.nodes) nodes(ring);
  const P = ring.nodes, a2 = ring.a * ring.a;
  let vx = 0, vy = 0, vz = 0;
  for (let k = 0; k < 12; k++) {
    const o = 3 * k, dx = P[o + 3] - P[o], dy = P[o + 4] - P[o + 1], dz = P[o + 5] - P[o + 2];
    const qx = x[0] - .5 * (P[o] + P[o + 3]), qy = x[1] - .5 * (P[o + 1] + P[o + 4]), qz = x[2] - .5 * (P[o + 2] + P[o + 5]);
    const s = qx * qx + qy * qy + qz * qz + a2, w = 1 / (s * Math.sqrt(s));
    vx += (dy * qz - dz * qy) * w; vy += (dz * qx - dx * qz) * w; vz += (dx * qy - dy * qx) * w;
  }
  const k = ring.G / (4 * Math.PI);
  return [vx * k, vy * k, vz * k];
}

// One ring's step among the others: carried by their flow at its centre, its radius changed by their flow
// across its rim (a ring in another's wake shrinks and speeds through it; the one ahead widens and slows:
// leapfrogging), its axis turned by the difference of their flow across it; on its own way at its own
// speed; growing as it takes in water; held in frame. (Every rate is held within what water does: a close
// pass can't fling a ring away.)
const clampV = (v, most) => { const l = Math.hypot(...v); return l > most ? [v[0] * most / l, v[1] * most / l, v[2] * most / l] : v; };
function stepRing(r, others, dt) {
  let v = r.drift ?? [0, 0, 0], dR = 0, tilt = [0, 0, 0];
  const out = [0, 0, 0], at = [0, 0, 0];
  for (const o of others) {
    if (o === r) continue;
    const qx = r.c[0] - o.c[0], qy = r.c[1] - o.c[1], qz = r.c[2] - o.c[2], reach = 3 * (o.R + r.R);
    if (qx * qx + qy * qy + qz * qz > reach * reach) continue;
    v = add(v, induced(o, r.c));
    // (Round its rim: four points.)
    for (let k = 0; k < 12; k += 3) {
      for (let j = 0; j < 3; j++) { out[j] = COS[k] * r.e1[j] + SIN[k] * r.e2[j]; at[j] = r.c[j] + r.R * out[j]; }
      const u = induced(o, at);
      dR += .25 * dot(u, out);
      tilt = add(tilt, cross(out, r.n), .25 * dot(u, r.n) / r.R);
    }
  }
  const U = selfSpeed(r.G, r.R, r.a);
  // Held in frame: soft walls (V).
  const F = RINGS.frame, aspect = r.aspect, wall = [0, 0, 0];
  if (r.c[0] < F.side) wall[0] += F.side - r.c[0];
  if (r.c[0] > aspect - F.side) wall[0] -= r.c[0] - aspect + F.side;
  if (r.c[1] < F.floor) wall[1] += F.floor - r.c[1];
  if (r.c[2] > F.near) wall[2] -= r.c[2] - F.near;
  if (r.c[2] < F.far) wall[2] += F.far - r.c[2];
  v = clampV(add(add(clampV(v, .5), r.n, U), wall, F.push), .7);
  if (r.swim) r.n = norm(add(r.n, r.swim, dt));
  r.next = { c: add(r.c, v, dt), R: Math.min(RINGS.most * r.narrow, Math.max(.004, r.R * (1 + dt * Math.max(-.25, Math.min(.35, (dR + RINGS.grow * U) / r.R))))), n: norm(add(r.n, clampV(tilt, 1.2), dt)) };
  r.travel += U * dt;
}
function commit(r, dt) {
  Object.assign(r, r.next); r.a = RINGS.core * r.R; r.G *= Math.exp(-dt / RINGS.decay);
  // (Never far from side on to the camera: |n·z| ≤ .35.)
  if (Math.abs(r.n[2]) > .35) { const k = Math.sqrt((1 - .35 * .35) / Math.max(1e-6, r.n[0] ** 2 + r.n[1] ** 2)); r.n = [r.n[0] * k, r.n[1] * k, Math.sign(r.n[2]) * .35]; }
  nodes(r);
}

// The whole choreography for an aspect: every ring's state each RINGS.step of P while it lives.
// Returns { rings: [{ id, kind, family, ink, study, seed, parent, born, dies, from }], track: Float32Array
// (8 floats a sample: centre, axis, R, Γ), step }.
export function bakeRings(aspect, sites = null) {
  const random = seeded(4242), rings = [], live = [];
  // (On a narrow screen the plumes are as narrow as the screen allows: sizes by its width, from a desktop's.)
  const narrow = Math.min(1, Math.max(.5, aspect));
  const steps = Math.round((RINGS.to - RINGS.from) / RINGS.step);
  const samples = [];
  // The drops and the rain, each a ring at its entry, falling straight in (tilted a little).
  const births = [
    ...DROPS.map(s => ({ s, kind: LATE.some(l => l.id === s.id) ? 'late' : 'primary', family: s.id })),
    ...PRECIPITATION.slice(DROPS.length).map(s => ({ s, kind: 'rain', family: s.parent })),
  ].sort((a, b) => a.s.hit - b.s.hit);
  let next = 0;
  const spawn = (props) => {
    const r = { id: rings.length, travel: 0, aspect, narrow, ...props };
    rings.push({ id: r.id, kind: r.kind, family: r.family, ink: r.ink, study: r.study, seed: r.seed, parent: r.parent ?? -1, born: r.born, dies: RINGS.to, from: samples.length });
    live.push(r); return r;
  };
  for (let i = 0; i <= steps; i++) {
    const P = RINGS.from + i * RINGS.step, dt = ringTime(P + RINGS.step) - ringTime(P);
    while (next < births.length && births[next].s.hit <= P) {
      const { s, kind, family } = births[next++], R = RINGS.size[kind] * s.radius * narrow;
      const at = toV(s.x, .015, s.z, aspect), tilt = (random() - .5) * .35, n = norm([Math.sin(tilt), -Math.cos(tilt), (random() - .5) * .3]);
      // (Γ for the reach it would travel on its own: U₀τ.)
      // (Each drop plunges as deep as its own momentum carries it: its plunge, a share of the tank.)
      const a = RINGS.core * R, U0 = RINGS.reach[kind] * (kind === 'rain' ? 1 : .55 + .75 * s.plunge) / RINGS.decay * 1.6;
      const ends = kind === 'rain' ? P + RINGS.life.rain : RINGS.to;
      const hero = kind === 'late' || (kind === 'primary' && RINGS.trunks.includes(s.id));
      spawn({ kind, family, ink: s.white, study: kind === 'rain' ? 1 : (s.id % 2 ? 2 : 0), seed: 6.283 * random(), born: P, ends, c: at, n, R, a, hero, home: random(),
        G: 4 * Math.PI * R * U0 / (Math.log(8 * R / a) - .25), parent: -1 });
    }
    // The cascade.
    for (const r of [...live]) {
      // (Only the hero rings calve, the trunks and the late heads, once: their children are the cascade's
      // last generation.)
      if (r.calved || !(r.kind === 'late' || RINGS.trunks.includes(r.family) && r.kind === 'primary') || r.R < RINGS.calve.least || r.travel < RINGS.calve.after * r.R) continue;
      r.calved = true;
      const C = RINGS.calve, m = C.count[0] + Math.floor(random() * (C.count[1] - C.count[0] + 1)), [e1, e2] = basis(r.n), t0 = 6.283 * random();
      for (let k = 0; k < m; k++) {
        const t = t0 + 6.283 * k / m + .3 * (random() - .5), out = add(add([0, 0, 0], e1, Math.cos(t)), e2, Math.sin(t));
        spawn({ kind: 'child', family: r.family, ink: r.ink, study: 1, seed: 6.283 * random(), born: P, ends: P + RINGS.life.child * (.8 + .4 * random()), parent: r.id,
          c: add(r.c, out, r.R * 1.05), n: norm(add(r.n, out, Math.tan(C.splay * (.8 + .4 * random())))), R: C.size * r.R, a: RINGS.core * C.size * r.R, G: C.share * r.G });
      }
      r.G *= 1 - C.share;
    }
    for (const r of live) if (!r.nodes) nodes(r);
    // The dance: partners drawn on, pushed off, each settling toward its own depth. (Its drift persists, as
    // momentum, eased by the water.)
    const D = RINGS.dance, w = smooth01(D.window[0], D.window[1], P) * (1 - smooth01(D.window[2], D.window[3], P));
    for (const r of live) {
      r.swim = null;
      r.drift = (r.drift ?? [0, 0, 0]).map(x => x * Math.exp(-dt / 1.5));
      if (w <= 0 || !r.hero) continue;
      let best = null, bd = Infinity;
      for (const o of live) {
        if (!o.hero || o.family === r.family) continue;
        const dd = Math.hypot(o.c[0] - r.c[0], o.c[1] - r.c[1], o.c[2] - r.c[2]) * (o.ink === r.ink ? 1.6 : 1);
        if (dd < bd) { bd = dd; best = o; }
      }
      const acc = [0, (D.home[0] + (D.home[1] - D.home[0]) * r.home - r.c[1]) * D.settle, 0];
      if (best) {
        const q = [best.c[0] - r.c[0], best.c[1] - r.c[1], best.c[2] - r.c[2]], d = Math.hypot(...q) || 1, u = q.map(x => x / d), touch = D.apart * (r.R + best.R);
        const pull = d > touch ? Math.min(D.most, D.pull / (d * d)) : -D.push * (touch - d) / touch;
        for (let j = 0; j < 3; j++) acc[j] += pull * u[j];
        // (Round each other: across the line between them, in the screen's plane, one way or the other.)
        const sense = (r.family + best.family) % 2 ? 1 : -1, side = Math.abs(pull) * D.swing * sense;
        acc[0] += -u[1] * side; acc[1] += u[0] * side;
        // (It turns within the screen's plane: seen down its own axis a ring is a disc, its form lost.)
        const uf = norm([u[0], u[1], .25 * u[2]]);
        r.swim = [(uf[0] - r.n[0]) * D.turn * w, (uf[1] - r.n[1]) * D.turn * w, (uf[2] - r.n[2]) * D.turn * w];
      }
      r.drift = add(r.drift, acc, w * dt);
    }
    for (const r of live) stepRing(r, live, dt);
    for (const r of live) commit(r, dt);
    // The unmixing: each family glides to its piece, exactly (an eased blend toward it, all of it by formPeak).
    if (sites) for (const r of live) {
      const site = sites[r.family];
      if (!site) continue;
      const e = smooth01(site.formStart - RINGS.unmix.lead, site.formPeak, P), was = r.unmixed ?? 0;
      if (e <= was && e < 1) continue;
      // (Once there, it stays: it is the piece's now.)
      const k = e >= 1 ? 1 : (e - was) / Math.max(1e-6, 1 - was), T = [site.x * aspect, site.y, site.z];
      r.c = add(r.c, [T[0] - r.c[0], T[1] - r.c[1], T[2] - r.c[2]], k);
      // (The piece's height in screen heights: its size is a share of the screen's shorter side.)
      r.R += (RINGS.unmix.size * site.size * Math.min(1, aspect) - r.R) * k;
      r.n = norm(add(r.n, [-r.n[0], 1 - r.n[1], -r.n[2]], k));
      r.a = RINGS.core * r.R; r.unmixed = e; nodes(r);
    }
    // (A ring whose circulation is spent is the water's: it stops moving the others.)
    for (let k = live.length - 1; k >= 0; k--) if (P >= live[k].ends || (live[k].G < 2e-5 && P - rings[live[k].id].born > .05)) live.splice(k, 1);
    for (const r of live) samples.push(r.id, ...r.c, ...r.n, r.R, r.G);
  }
  // Sorted per ring: each ring's samples in one run.
  const per = rings.map(() => []);
  for (let k = 0; k < samples.length; k += 9) per[samples[k]].push(samples.slice(k + 1, k + 9));
  const track = new Float32Array(per.reduce((n, l) => n + l.length, 0) * 8);
  let o = 0;
  rings.forEach((r, i) => { r.from = o / 8; for (const s of per[i]) { track.set(s, o); o += 8; } r.count = per[i].length; r.dies = r.born + (r.count - 1) * RINGS.step; });
  return { rings, track, step: RINGS.step };
}

// A ring's state at P (linear between its samples), or null before its birth.
export function ringAt(plan, r, P) {
  if (P < r.born) return null;
  const x = Math.min(r.count - 1, (P - r.born) / plan.step), k = Math.min(r.count - 2, Math.floor(x)), f = r.count > 1 ? x - k : 0;
  const o = 8 * (r.from + Math.max(0, k)), t = plan.track, lerp = j => t[o + j] + f * ((r.count > 1 ? t[o + 8 + j] : t[o + j]) - t[o + j]);
  return { c: [lerp(0), lerp(1), lerp(2)], n: norm([lerp(3), lerp(4), lerp(5)]), R: lerp(6), G: lerp(7) };
}
