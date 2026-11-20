// Photography → Chess: the ink comes alive (P .575 … .745). Under water, the heads of the four foreground
// plumes (two black, two ivory) congeal into masses of viscous ink, live, and mist away again into the water
// the figures gather from. Everything here is a function of the scroll's clock P (and, for idle life, of
// time), so scrolling back rewinds it; glsl/living-mass.js draws it, the worker splats its mist.
//   The mathematics it rides on:
// · Each body's centre follows a streamline of the Arnold–Beltrami–Childress flow, a steady exact solution of
//   Euler's equations whose streamlines are chaotic (A = 1, B = √⅔, C = √⅓), held in the frame by a weak
//   restoring pull; black and ivory repel at short range, two immiscible inks.
// · A body breathes in the shape modes of a free liquid drop (Rayleigh): r = R(1 + Σ a_l P_l(cos θ)), each mode
//   at ω_l ∝ √(l(l−1)(l+2)) (ratios 1 : 1.94 : 3 for l = 2, 3, 4).
// · Its state cycles smooth (a drop, globs congealing into it), sharp (shear-thickened, it jams into spikes
//   where a field would raise a ferrofluid's Rosensweig peaks), gaseous (it re-mists).
// · Its tendrils are whips: a wave travelling along a tapering line slows and grows toward the tip (phase
//   speed ∝ μ^−½, amplitude ∝ μ^−¼ for mass per length μ), twisting as it goes; after each lash it recoils
//   (critically damped) and its tip pinches into droplets (Rayleigh–Plateau). Nothing reaches the screen.
import { smooth, mix } from './ink-tank.js';

export const BODIES = Object.freeze([{ id: 0, white: 0 }, { id: 1, white: 1 }, { id: 10, white: 0 }, { id: 23, white: 1 }].map(Object.freeze));
export const MASS = Object.freeze({ start: .575, congeal: .63, remist: .70, end: .745 });
// How much of each trunk's head is a body (rather than sheets and mist).
export const presence = P => smooth(MASS.start, MASS.congeal, P) * (1 - smooth(MASS.remist, MASS.end, P));
export const GLASS = .92;            // the nearest any of it comes to the screen (tank depth)
export const TENDRILS = 3, POINTS = 10, SATELLITES = 6;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const TAU = 2 * Math.PI;

// ---- the flow ----------------------------------------------------------------------------------------
const A = 1, B = Math.sqrt(2 / 3), C = Math.sqrt(1 / 3);
export const abc = ([x, y, z]) => [A * Math.sin(z) + C * Math.cos(y), B * Math.sin(x) + A * Math.cos(z), C * Math.sin(y) + B * Math.cos(x)];
const K = TAU / 1.15;  // flow cells per screen height
// The bodies' centres (x a share of the width, y of the height from the bottom, z tank depth) and radii
// (screen heights), SAMPLES of them from MASS.start to MASS.end, from where the trunks' heads are as they
// congeal (seeds: [x, y, z, r] per body).
export const SAMPLES = 512;
// (Kept in a box of the frame, short of the screen's edges and of the glass.)
export const BOX = Object.freeze({ x: [.2, .8], y: [.24, .76], z: [.3, .8] });
export function trajectories(seeds, aspect) {
  const n = BODIES.length, out = new Float32Array(SAMPLES * n * 4);
  const lo = [BOX.x[0] * aspect, BOX.y[0], BOX.z[0]], hi = [BOX.x[1] * aspect, BOX.y[1], BOX.z[1]];
  const hold = p => p.map((v, k) => clamp(v, lo[k], hi[k]));
  const pos = seeds.map(s => hold([s[0] * aspect, s[1], s[2]]));
  // A body is a size the screen's short side can hold.
  const largest = .11 * Math.max(.55, Math.min(1, aspect));
  const span = MASS.end - MASS.start, flowTime = 3.2, dt = flowTime / (SAMPLES - 1), gain = .55 / K;
  const velocity = (p, b) => {
    const f = abc([p[0] * K, p[1] * K, p[2] * K * .7]).map(v => v * gain);
    // Held in the frame, and apart from the other ink.
    for (let k = 0; k < 3; k++) f[k] += 4 * (Math.max(0, lo[k] + .05 - p[k]) - Math.max(0, p[k] - hi[k] + .05));
    for (let o = 0; o < n; o++) {
      if (o === b || BODIES[o].white === BODIES[b].white) continue;
      const q = pos[o], d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]], r = Math.hypot(...d) + 1e-6;
      if (r < .3) for (let k = 0; k < 3; k++) f[k] += .35 * (.3 - r) * d[k] / r;
    }
    return f;
  };
  for (let i = 0; i < SAMPLES; i++) {
    const P = MASS.start + span * i / (SAMPLES - 1);
    for (let b = 0; b < n; b++) {
      const R = Math.min(largest, seeds[b][3]) * mix(1, 1.25, smooth(MASS.start, MASS.congeal, P)) * (1 - .55 * smooth(MASS.remist, MASS.end, P));
      out.set([pos[b][0] / aspect, pos[b][1], pos[b][2], R], 4 * (i * n + b));
    }
    // RK4, every body a step.
    const next = pos.map((p, b) => {
      const k1 = velocity(p, b), p2 = p.map((v, k) => v + .5 * dt * k1[k]), k2 = velocity(p2, b);
      const p3 = p.map((v, k) => v + .5 * dt * k2[k]), k3 = velocity(p3, b), p4 = p.map((v, k) => v + dt * k3[k]), k4 = velocity(p4, b);
      return p.map((v, k) => v + dt / 6 * (k1[k] + 2 * k2[k] + 2 * k3[k] + k4[k]));
    });
    next.forEach((p, b) => { pos[b] = hold(p); });
  }
  return out;
}
function sample(traj, b, P) {
  const n = BODIES.length, x = clamp((P - MASS.start) / (MASS.end - MASS.start)) * (SAMPLES - 1), i = Math.min(SAMPLES - 2, Math.floor(x)), t = x - i;
  return [0, 1, 2, 3].map(k => mix(traj[4 * (i * n + b) + k], traj[4 * ((i + 1) * n + b) + k], t));
}

// ---- a body's state ------------------------------------------------------------------------------------
// smooth, sharp, gaseous: weights summing to about 1, the cycle offset per body so all three show at once.
export function stateOf(b, P) {
  const c = ((P - .60) / .034 + .31 * b) % 1, u = c < 0 ? c + 1 : c;
  const sharp = smooth(.36, .45, u) * (1 - smooth(.58, .66, u));
  let gas = smooth(.6, .7, u) * (1 - smooth(.86, .96, u));
  gas = Math.max(gas, smooth(MASS.remist, MASS.end - .01, P));
  const congeal = smooth(MASS.start, MASS.congeal, P);
  return { smooth: clamp(1 - sharp - gas), sharp: sharp * (1 - gas) * congeal, gas: mix(.85, gas, congeal), cycle: u };
}
// The Rayleigh modes' amplitudes and phases (l = 2, 3, 4) and the clock they ring on.
export const RAYLEIGH = [2, 3, 4].map(l => Math.sqrt(l * (l - 1) * (l + 2)) / Math.sqrt(8));

// ---- a frame -------------------------------------------------------------------------------------------
// Everything the shader needs for each body at P (time: seconds, for the idle writhing), in screen-height
// units (x scaled by the aspect): centre and radius, state, its globs and its tendrils' centrelines.
export function massFrame(traj, P, time, aspect, tendrils = TENDRILS) {
  const tau = 140 * (P - .575) + .8 * time, bodies = [];
  const centres = BODIES.map((_, b) => { const s = sample(traj, b, P); return [s[0] * aspect, s[1], s[2], s[3]]; });
  BODIES.forEach((body, b) => {
    const [x, y, z, R] = centres[b], st = stateOf(b, P), here = presence(P);
    const congeal = smooth(MASS.start, MASS.congeal, P);
    // Globs drawn in from the head's spread as it congeals, then orbiting in its skin.
    const sat = [];
    for (let i = 0; i < SATELLITES; i++) {
      const a = TAU * i / SATELLITES + .35 * tau * (1 + .13 * i) / 6 + b, e = .9 * Math.sin(1.7 * i + .2 * tau + b);
      const far = R * mix(2.4, .78 + .16 * Math.sin(.5 * tau + i), congeal);
      sat.push([x + far * Math.cos(a) * Math.cos(e), y + far * Math.sin(e), Math.min(GLASS - .03, z + .6 * far * Math.sin(a) * Math.cos(e)), R * (.26 + .1 * ((i * 7) % 3))]);
    }
    // Tendrils: lash, whip, recoil, pinch.
    const ten = [];
    for (let k = 0; k < tendrils; k++) {
      const lash = (((P - .58) / .022 + .37 * k + .19 * b) % 1 + 1) % 1;
      const reach = R * (2.3 + .6 * Math.sin(1.3 * k + b));
      const out = lash < .35 ? 1 - (1 - lash / .35) ** 3 : lash < .55 ? 1 : (() => { const u = (lash - .55) / .45 * 5; return (1 + u) * Math.exp(-u); })();
      const L = reach * (.15 + .85 * out) * congeal * (1 - .7 * st.gas);
      const whip = lash > .3 && lash < .75 ? Math.sin(Math.PI * (lash - .3) / .45) : 0;
      const theta = TAU * k / tendrils + .9 * Math.sin(.07 * tau + b) + .4 * b, phi = .45 * Math.sin(.05 * tau + k);
      const dir = [Math.cos(theta) * Math.cos(phi), Math.sin(theta) * Math.cos(phi), .4 * Math.sin(phi)];
      const dl = Math.hypot(...dir); dir.forEach((v, i) => { dir[i] = v / dl; });
      let e1 = [-dir[1], dir[0], 0]; const l1 = Math.hypot(...e1) || 1; e1 = e1.map(v => v / l1);
      const e2 = [dir[1] * e1[2] - dir[2] * e1[1], dir[2] * e1[0] - dir[0] * e1[2], dir[0] * e1[1] - dir[1] * e1[0]];
      const pts = [];
      for (let i = 0; i < POINTS; i++) {
        const s = i / (POINTS - 1), mu = 1 - .9 * s;
        const phase = 9 * (1 - mu ** 1.5) / 1.35 - 2.2 * tau / TAU * 6 - 2 * Math.PI * lash * 2;
        const amp = (.18 + .5 * whip) * L * s * mu ** -.25;
        const psi = 2.4 * s + .07 * tau + k;
        const off = amp * Math.sin(phase), writhe = .05 * R * Math.sin(3 * s + 1.3 * time + k + b);
        const base = R * .85 + L * s;
        const p = [0, 1, 2].map(i2 => [x, y, z][i2] + dir[i2] * base + (off + writhe) * (Math.cos(psi) * e1[i2] + Math.sin(psi) * e2[i2]));
        // Immiscible: the other colour's bodies push it away.
        BODIES.forEach((o, ob) => {
          if (o.white === body.white) return;
          const c = centres[ob], d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], r = Math.hypot(...d) + 1e-6, keep = c[3] * 1.35 + .03;
          if (r < keep) for (let i2 = 0; i2 < 3; i2++) p[i2] += (keep - r) * d[i2] / r;
        });
        p[2] = Math.min(GLASS - .02, p[2]);
        // Thick at the root, tapering; recoiling, the tip beads.
        const pinch = lash > .55 && s > .7 ? .5 + .5 * Math.cos(TAU * s / .1 + 3 * lash) : 1;
        const r = R * .3 * (1 - .8 * s) * mix(1, .45 + .55 * pinch, smooth(.55, .7, lash) * s);
        pts.push([...p, r]);
      }
      ten.push(pts);
    }
    bodies.push({ white: body.white, c: [x, y, z], R: R * here, here, state: st, sat, ten, tau, spin: .11 * tau + 1.7 * b });
  });
  return bodies;
}
// The pixels a body can reach (CSS px from the bottom left: x0, y0, x1, y1).
export function massBounds(body, W, H) {
  let x0 = body.c[0] - 1.8 * body.R, x1 = body.c[0] + 1.8 * body.R, y0 = body.c[1] - 1.8 * body.R, y1 = body.c[1] + 1.8 * body.R;
  for (const t of body.ten) for (const p of t) { x0 = Math.min(x0, p[0] - p[3] - .02); x1 = Math.max(x1, p[0] + p[3] + .02); y0 = Math.min(y0, p[1] - p[3] - .02); y1 = Math.max(y1, p[1] + p[3] + .02); }
  for (const s of body.sat) { x0 = Math.min(x0, s[0] - s[3]); x1 = Math.max(x1, s[0] + s[3]); y0 = Math.min(y0, s[1] - s[3]); y1 = Math.max(y1, s[1] + s[3]); }
  return [x0 * H, y0 * H, x1 * H, y1 * H];
}
