// Photography → Chess: the vortex ink at run time. Every plume is a vortex ring (vortex-plan.js bakes their
// choreography); here each ring alive at P is taken through the camera of the moment into the mist
// volume's own space, and handed to the mist volume (glsl/living-ink.js headInk), which draws it from the
// plume studies, revolved and rolling. A function of P and the clock alone: scrolling back un-builds it.
import { ringAt, RINGS } from './vortex-plan.js';
import { END } from './living-ink-plan.js';
import { CAMERA, tankCamera, projectTank, smooth } from './ink-tank.js';

// Heads at most (the most important first: each pixel keeps the first 24 that reach it), texels a head.
export const HEADS = Object.freeze({ most: 32, texels: 7 });

// The final camera's map is affine (it is fully under from CAMERA.end): V → tank coordinates, exactly.
export function fromV(V, aspect) {
  const [ax, ay, az, aw] = CAMERA.below, sx = V[0] / aspect, sy = V[1], sz = V[2];
  // sy = ax + ay(.5 − z) − d·az; sz = .22 + .60z − .13d (w = 1 under water).
  const d0 = (ax + .5 * ay - sy) / az, k = -ay / az;               // d = d0 + k z
  const z = (sz - .22 + .13 * d0) / (.60 - .13 * k), d = d0 + k * z;
  const x = sx - .5 - (z - .5) * .072 * aw / Math.max(1, aspect) + .5;
  return [x, d, z];
}
// V → the mist volume's space at P (x by the aspect, y up, depth), through the camera of the moment.
function toNow(V, cam, aspect) { const [x, d, z] = fromV(V, aspect), p = projectTank(x, d, z, cam, aspect); return [p[0] * aspect, p[1], p[2]]; }

export function createVortexInk(gl, programs, { coarse }) {
  const data = new Float32Array(HEADS.most * HEADS.texels * 4);
  let tex = null, count = 0, shown = 0, time = 0;
  const dev = () => globalThis.__vortex ?? null;
  function texture(w, h) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return t;
  }

  // Each frame (living-ink.js draw): ctx is { P, dt, aspect, plan }. Returns how much of it shows.
  function frame(ctx) {
    const d = dev() ?? {}, plan = ctx.plan;
    count = 0; shown = 0;
    // (Across the rings' whole span, from the first drop on, it takes the bake's place; __vortex.off brings
    // the bake back.)
    if (!plan || d.off || ctx.P < RINGS.from || ctx.P > END) return 0;
    time += d.fixed || globalThis.__inkSim?.fixed ? 1 / 60 : Math.min(ctx.dt || 0, 1 / 20);
    const P = ctx.P, aspect = ctx.aspect, cam = tankCamera(P), list = [];
    for (const r of plan.rings) {
      if (P < r.born || P > r.dies || (d.kinds && !d.kinds.includes(r.kind)) || (d.family !== undefined && r.family !== d.family)) continue;
      const s = ringAt(plan, r, P);
      if (!s) continue;
      // (Its weight: in over its first moments, so nothing appears from nothing; a small drop's ring, after
      // its plunge, thinned into the water's haze; gathered again as its piece unmixes it; and let go as the
      // piece's own ink takes over (inkStage).)
      const site = ctx.sites?.[r.family], hero = r.kind === 'late' || (r.kind === 'primary' && [0, 1, 10, 23].includes(r.family));
      const gather = site ? smooth(site.formStart - .025, site.formPeak, P) : 0, handed = site ? smooth(site.formPeak - .02, site.formPeak + .015, P) : 0;
      const thinned = r.kind === 'primary' && !hero ? 1 - smooth(r.born + .06, r.born + .22, P) : 1;
      const w = smooth(r.born, r.born + .008, P) * (1 - smooth(r.dies - .01, r.dies, P)) * (thinned + (1 - thinned) * gather) * (1 - handed);
      if (w <= .01) continue;
      const c = toNow(s.c, cam, aspect), eps = .02;
      const nAt = toNow([s.c[0] + eps * s.n[0], s.c[1] + eps * s.n[1], s.c[2] + eps * s.n[2]], cam, aspect);
      const n = [nAt[0] - c[0], nAt[1] - c[1], nAt[2] - c[2]], ln = Math.hypot(...n) || 1;
      // (Its size through the camera: the map's stretch across the ring's plane.)
      const side = Math.abs(s.n[0]) < .9 ? [1, 0, 0] : [0, 1, 0], sAt = toNow([s.c[0] + eps * side[0], s.c[1] + eps * side[1], s.c[2] + eps * side[2]], cam, aspect);
      const R = s.R * Math.hypot(sAt[0] - c[0], sAt[1] - c[1], sAt[2] - c[2]) / eps;
      const first = ringAt(plan, r, r.born), born = toNow(first.c, cam, aspect), stem = Math.min(.6, Math.hypot(c[0] - born[0], c[1] - born[1]));
      list.push({ r, c, n: n.map(v => v / ln), R, w, stem, gather });
    }
    // The largest and nearest first, as many as there is room for.
    list.sort((a, b) => b.R * b.w - a.R * a.w);
    count = d.noHeads ? 0 : Math.min(HEADS.most, list.length);
    data.fill(0);
    const M = HEADS.most;
    for (let i = 0; i < count; i++) {
      const { r, c, n, R, w, stem, gather } = list[i];
      const put = (row, v) => data.set(v, 4 * (row * M + i));
      put(0, [...c, R]);
      put(1, [...n, .5 * R]);
      // (As it unmixes its roll turns over: the plume played backward.)
      put(2, [(d.roll ?? 2.2) * (1 - 2 * gather), 5, .05, r.seed]);
      put(3, [r.ink, (d.density ?? 2.6) * w * (r.kind === 'rain' ? .5 : 1), .3, r.seed]);
      put(4, [stem, r.study, time / 3.5 + .37 * r.seed, 0]);
      // (Its lobes' phases, as cos and sin: seed, −1.7 seed; 2.3 seed, its wave's.)
      put(5, [Math.cos(r.seed), Math.sin(r.seed), Math.cos(-1.7 * r.seed), Math.sin(-1.7 * r.seed)]);
      put(6, [Math.cos(2.3 * r.seed), Math.sin(2.3 * r.seed), Math.cos(r.seed), Math.sin(r.seed)]);
    }
    if (!tex) tex = texture(M, HEADS.texels);
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, M, HEADS.texels, gl.RGBA, gl.FLOAT, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
    shown = 1;
    if (globalThis.__vortex) globalThis.__vortex.stats = () => ({ heads: count, rings: plan.rings.length, shown, catching: false, settled: true });
    return shown;
  }

  // The heads for the mist volume (glsl/living-ink.js headInk), and whether the vortex ink
  // takes the bake's place.
  function bindVolume(U, units) {
    const on = shown > 0 && count > 0;
    gl.uniform1f(U.uVortex, shown > 0 ? 1 : 0);
    gl.uniform1i(U.uHeadCount, on ? count : 0);
    gl.activeTexture(gl.TEXTURE0 + units[0]); gl.bindTexture(gl.TEXTURE_2D, on ? tex : null); gl.uniform1i(U.uHeads, units[0]);
  }

  // A piece's ink stage (0 … 1): its plume handed over to it as ink (INK_PIECE), let go as the solid sets.
  function inkStage(site, P, set) {
    if (!site || shown <= 0) return 0;
    return smooth(site.formPeak - .02, site.formPeak + .015, P) * (1 - set);
  }

  return {
    frame, bindVolume, inkStage,
    get shown() { return shown; },
    // (Whether the rings are drawing: the veils and the 2D fluid then stand down.)
    get active() { return shown > 0; },
    dispose() { if (tex) gl.deleteTexture(tex); tex = null; },
  };
}
