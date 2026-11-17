// The ink's fluid for Photography → Chess, baked once in the background (glsl/ink-sim.js has the solver;
// glsl/plume.js plays the result back by scroll, so scrubbing it either way is exact).
//   Two runs, each a real 2D flow (incompressible, buoyant, its small curls kept by vorticity
// confinement), each kept as keyframes of its flow map (where the water at each point was at the start),
// not of its ink: the ink is then always its first picture carried through the map, sharp at any size.
//   rain      the screen's shape, and a third more above it: some forty drops of black and white ink
//             above the surface, falling, entering one after another, rolling up and breaking
//   dissolve  the screen's shape: the board's own ink where the board stands (board3d.js renderMask)
//             dissolved by stirrers that turn harder and harder until it hangs in the whole screen.
//             Played backward, it is the ink finding the board: every thread retraces its way and lands
//             where it began.
// The bake spends a few steps a frame (work), rain first; a run is made again only when its shape changes.
// Without float targets nothing is baked and ready() stays false (the seam is then the plain one).
import { VERTEX } from './glsl/index.js';
import { INKSIM } from './glsl/ink-sim.js';

// The runs' grids (fine pointer, touch), lengths and how they are kept.
// (The rain's storm: stirrers from storm[0] of the way through, as hard as storm[1] of the dissolve's.)
export const RAIN = Object.freeze({ cells: [256, 144], above: 0.3, steps: 400, keys: 64, dt: 1 / 50, v0: 120, grav: 460, eps: 10, damp: 0.9995, drops: [80, 44], storm: [0.32, 0.8], stirrers: 7 });
export const DISSOLVE = Object.freeze({ cells: [224, 144], steps: 350, keys: 36, dt: 1 / 50, grav: 110, eps: 8, damp: 0.9993, stirrers: 7, mask: 1024 });
// The pressure's iterations a step (each starts from the last step's pressure).
const JACOBI = 18;

// A seeded generator (mulberry32), so the bake is the same every visit.
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// The rain's drops on its grid (nx × ny cells, y up; the screen's top at ny / (1 + above)): [x, y, radius,
// black], cells. widthPx: the screen's width, for their sizes (6 … 40 px, most between).
export function rainDrops(nx, ny, widthPx, n, above = RAIN.above, seed = 7) {
  const r = rng(seed), top = ny / (1 + above), out = [], px = nx / widthPx;
  for (let i = 0; i < n; i++) {
    const u = r(), size = u < 0.2 ? 30 + 34 * r() : u < 0.7 ? 16 + 14 * r() : 6 + 8 * r();
    const rad = Math.max(1.6, size * px);
    out.push([nx * (0.05 + 0.9 * r()), top + rad + 1 + (ny - top - 2 * rad - 2) * Math.pow(r(), 0.85), rad, r() < 0.5 ? 1 : 0]);
  }
  return out;
}
// Stirrers at time t (s) of a run T long on an nx × ny grid: [x, y, reach, strength]. They wheel slowly round
// (cx, cy) (the dissolve's: the board's middle), alternately one way and the other, harder as the run goes
// on, from start of the way through, as hard as gain.
export function stirrers(t, T, nx, ny, n = DISSOLVE.stirrers, cx = nx / 2, cy = ny / 2, start = 0, gain = 1) {
  const out = [], ramp = gain * Math.min(1, Math.max(0, t / T - start) / 0.45) ** 1.5, k = nx / 200;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.35 * t * (i % 2 ? 1 : -0.7), R = (0.14 + 0.22 * ((i * 37) % 5) / 4) * Math.min(nx, ny);
    out.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.9, (26 + 12 * (i % 3)) * k, (i % 2 ? 1 : -1) * (560 + 180 * (i % 3)) * k * ramp]);
  }
  return out;
}

export function createInkSim(gl, { coarse = false } = {}) {
  const ext = gl.getExtension('KHR_parallel_shader_compile');
  const full = !!gl.getExtension('EXT_color_buffer_float'), half = full || !!gl.getExtension('EXT_color_buffer_half_float');
  const floatLinear = !!gl.getExtension('OES_texture_float_linear');
  const P = {};
  let dead = false;
  // ---- programs --------------------------------------------------------------------------------------
  for (const [name, fs] of Object.entries(INKSIM)) {
    if (!half) break;
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const v = mk(gl.VERTEX_SHADER, VERTEX), f = mk(gl.FRAGMENT_SHADER, fs), p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    const check = () => {
      if (dead || gl.isContextLost()) return;
      if (ext && !gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR)) { setTimeout(check, 40); return; }
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(`The ink's ${name} pass did not build; its seam stays plain.`, gl.getShaderInfoLog(f) || gl.getProgramInfoLog(p)); P[name] = null; return; }
      const U = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ''); U[nm] = gl.getUniformLocation(p, nm); }
      P[name] = { p, U };
    };
    check();
  }
  const compiled = () => half && Object.keys(INKSIM).every(k => P[k]);

  // ---- targets ---------------------------------------------------------------------------------------
  function tex(w, h, internal, format, type, filter = gl.LINEAR) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.LINEAR_MIPMAP_LINEAR ? gl.LINEAR : filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  }
  function target(t) { const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return fb; }
  const field = (w, h, hi = false) => {
    const fmt = hi && full && floatLinear ? [gl.RGBA32F, gl.RGBA, gl.FLOAT] : [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT];
    const t = [tex(w, h, ...fmt), tex(w, h, ...fmt)];
    return { t, fb: t.map(target), i: 0, get cur() { return this.t[this.i]; }, get curFb() { return this.fb[this.i]; }, get nextFb() { return this.fb[1 - this.i]; }, swap() { this.i = 1 - this.i; } };
  };
  const dropField = f => { if (!f) return; f.t.forEach(t => gl.deleteTexture(t)); f.fb.forEach(b => gl.deleteFramebuffer(b)); };

  // ---- runs ------------------------------------------------------------------------------------------
  // A run: its grid, its fields, its keyframes (a texture array of the map, D, RG16F), its first picture
  // (dye0), its clock.
  const runs = { rain: null, dissolve: null };
  const wants = { rain: null, dissolve: null };
  // (A finished run stays in use while the one for a new shape is made.)
  const kept = { rain: null, dissolve: null };
  function freeRun(R) {
    if (!R) return;
    for (const f of [R.vel, R.rho, R.pres, R.map]) dropField(f);
    for (const t of [R.curl, R.div, R.keys, R.ownDye ? R.dye0 : null]) if (t) gl.deleteTexture(t);
    for (const b of [R.curlFb, R.divFb, R.keyFb, R.dyeFb, ...(R.carryFb || [])]) if (b) gl.deleteFramebuffer(b);
  }
  function makeRun(kind, w) {
    const C = kind === 'rain' ? RAIN : DISSOLVE, nx = C.cells[coarse ? 1 : 0];
    const ny = Math.max(16, Math.round(kind === 'rain' ? nx * (1 + C.above) / w.aspect : nx / w.aspect));
    const R = { kind, C, nx, ny, step: 0, key: 0, every: Math.round(C.steps / (C.keys - 1)), done: false, want: w, begun: false };
    // (The dissolve's stirrers wheel round the board, where it is on the screen.)
    if (w.box) R.mid = [(w.box[0] + w.box[2] / 2) / w.W * nx, (1 - (w.box[1] + w.box[3] / 2) / w.H) * ny];
    R.vel = field(nx, ny); R.rho = field(nx, ny); R.pres = field(nx, ny); R.map = field(nx, ny, true);
    // (The density and the map are carried in one pass, into both: a framebuffer for each way round.)
    R.carryFb = [0, 1].map(j => {
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, R.rho.t[j], 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, R.map.t[j], 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      return fb;
    });
    R.curl = tex(nx, ny, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT); R.curlFb = target(R.curl);
    R.div = tex(nx, ny, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT); R.divFb = target(R.div);
    const keyFmt = full ? [gl.RG16F, gl.RG, gl.HALF_FLOAT] : [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT];
    R.keys = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.keys);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, keyFmt[0], nx, ny, C.keys, 0, keyFmt[1], keyFmt[2], null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D_ARRAY, k, v);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    R.keyFb = gl.createFramebuffer();
    R.T = C.steps * C.dt;
    return R;
  }
  // Draw a pass over a run's grid into fb.
  function draw(R, name, fb, set) {
    const { p, U } = P[name];
    // (Whatever the page last left on: the grid is drawn whole, unblended.)
    gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, R.nx, R.ny);
    gl.useProgram(p);
    gl.uniform2f(U.uCells, R.nx, R.ny);
    let unit = 0;
    const bind = (u, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(U[u], unit++); };
    set?.(U, bind);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    for (let i = 0; i < unit; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, null); }
    gl.activeTexture(gl.TEXTURE0);
  }
  function keep(R) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.keyFb);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, R.keys, 0, R.key);
    draw(R, 'copy', R.keyFb, (U, bind) => bind('uSrc', R.map.cur));
    R.key++;
  }
  // The first picture, and the fields at the start.
  function begin(R) {
    if (R.kind === 'rain') {
      const W = 1024, H = Math.round(W * R.ny / R.nx);
      R.dye0 = tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR_MIPMAP_LINEAR); R.ownDye = true;
      R.dyeFb = target(R.dye0);
      R.drops = rainDrops(R.nx, R.ny, R.want.widthPx || 1440, R.C.drops[coarse ? 1 : 0]);
      const { p, U } = P.drops;
      gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, R.dyeFb);
      gl.viewport(0, 0, W, H);
      gl.useProgram(p);
      gl.uniform2f(U.uCells, R.nx, R.ny);
      gl.uniform2f(U.uSize, W, H);
      gl.uniform4fv(U.uDrop, new Float32Array(R.drops.flat().concat(new Array(Math.max(0, 256 - R.drops.length * 4)).fill(0)).slice(0, 256)));
      gl.uniform1i(U.uN, R.drops.length);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      R.dye0 = R.want.mask; R.ownDye = false;
      gl.bindTexture(gl.TEXTURE_2D, R.dye0);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
    gl.bindTexture(gl.TEXTURE_2D, R.dye0);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const lod = Math.max(0, Math.log2(1024 / R.nx));
    draw(R, 'initRho', R.rho.curFb, (U, bind) => { bind('uDye', R.dye0); gl.uniform1f(U.uLod, lod); });
    draw(R, 'initVel', R.vel.curFb, (U, bind) => { bind('uRho', R.rho.cur); gl.uniform1f(U.uV0, R.kind === 'rain' ? R.C.v0 * R.nx / 256 : 0); });
    for (const f of [R.map, R.pres]) { draw(R, 'zero', f.fb[0]); draw(R, 'zero', f.fb[1]); }
    keep(R);
  }
  function step(R) {
    const C = R.C, dt = C.dt, s = R.nx / 256, t = R.step * dt;
    draw(R, 'curl', R.curlFb, (U, bind) => bind('uVel', R.vel.cur));
    draw(R, 'velocity', R.vel.nextFb, (U, bind) => {
      bind('uVel', R.vel.cur); bind('uRho', R.rho.cur); bind('uCurl', R.curl);
      gl.uniform1f(U.uDt, dt); gl.uniform1f(U.uGrav, C.grav * s); gl.uniform1f(U.uEps, C.eps); gl.uniform1f(U.uDamp, C.damp);
      const st = R.kind === 'dissolve' ? stirrers(t, R.T, R.nx, R.ny, R.C.stirrers, R.mid[0], R.mid[1])
        : stirrers(t, R.T, R.nx, R.ny, R.C.stirrers, R.nx / 2, R.ny / (2 * (1 + R.C.above)), R.C.storm[0], R.C.storm[1]);
      gl.uniform4fv(U.uStir, new Float32Array(st.flat().concat(new Array(32).fill(0)).slice(0, 32)));
      gl.uniform1i(U.uNStir, st.length);
    });
    R.vel.swap();
    draw(R, 'divergence', R.divFb, (U, bind) => bind('uVel', R.vel.cur));
    for (let i = 0; i < JACOBI; i++) { draw(R, 'jacobi', R.pres.nextFb, (U, bind) => { bind('uPres', R.pres.cur); bind('uDiv', R.div); }); R.pres.swap(); }
    draw(R, 'gradient', R.vel.nextFb, (U, bind) => { bind('uPres', R.pres.cur); bind('uVel', R.vel.cur); });
    R.vel.swap();
    draw(R, 'carry', R.carryFb[1 - R.rho.i], (U, bind) => { bind('uVel', R.vel.cur); bind('uRho', R.rho.cur); bind('uMap', R.map.cur); gl.uniform1f(U.uDt, dt); });
    R.rho.swap(); R.map.swap();
    R.step++;
    if (R.step % R.every === 0 && R.key < C.keys) keep(R);
    if (R.step >= C.steps) {
      while (R.key < C.keys) keep(R);
      R.done = true;
      // (What the run needed only while it ran.)
      for (const f of [R.vel, R.rho, R.pres]) dropField(f);
      for (const t of [R.curl, R.div]) gl.deleteTexture(t);
      for (const b of [R.curlFb, R.divFb, R.dyeFb, ...R.carryFb]) if (b) gl.deleteFramebuffer(b);
      R.vel = R.rho = R.pres = R.curl = R.div = R.curlFb = R.divFb = R.dyeFb = R.carryFb = null;
      dropField(R.map); R.map = null;
    }
  }
  let warmed = 0, warmFb = null, warmTex = null;
  function warm() {
    const names = Object.keys(INKSIM);
    if (warmed >= names.length) return true;
    if (!warmTex) { warmTex = tex(1, 1, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT); warmFb = target(warmTex); }
    // Two a frame.
    for (let k = 0; k < 2 && warmed < names.length; k++, warmed++) draw({ nx: 1, ny: 1 }, names[warmed], warmFb);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (warmed >= names.length) { gl.deleteTexture(warmTex); gl.deleteFramebuffer(warmFb); warmTex = warmFb = null; return true; }
    return false;
  }
  const same = (a, b) => a && b && Math.abs(a.aspect - b.aspect) / b.aspect < 0.02 && (a.mask ?? null) === (b.mask ?? null)
    && (!a.box || (b.box && a.box.every((v, i) => Math.abs(v - b.box[i]) < 3)));

  return {
    // What to bake: rain for a screen ({ aspect: W / H, widthPx }), the dissolve for a board on a screen
    // ({ aspect: W / H, W, H, box: the board's [x, y, w, h], mask: its ink over the screen }). A run is made
    // again only when its shape changes.
    want(kind, w) {
      if (dead || !w || !(w.aspect > 0)) return;
      if (same(wants[kind], w)) return;
      wants[kind] = w;
      if (runs[kind] && !same(runs[kind].want, w)) {
        if (runs[kind].done) { freeRun(kept[kind]); kept[kind] = runs[kind]; } else freeRun(runs[kind]);
        runs[kind] = null;
      }
    },
    // Some of the bake: up to n steps (rain first). True while there is more to do.
    work(n) {
      if (dead || !compiled() || gl.isContextLost()) return false;
      // (First each program draws a pixel, so the driver builds it now rather than in the middle of a run.)
      if (!warm()) return true;
      for (const kind of ['rain', 'dissolve']) {
        if (!wants[kind]) continue;
        // (A run's start has a frame of its own.)
        if (!runs[kind]) { runs[kind] = makeRun(kind, wants[kind]); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return true; }
        const R = runs[kind];
        if (!R.begun) { begin(R); R.begun = true; gl.bindFramebuffer(gl.FRAMEBUFFER, null); return true; }
        while (!R.done && n-- > 0) step(R);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (!R.done) return true;
        if (kept[kind]) { freeRun(kept[kind]); kept[kind] = null; }
      }
      return false;
    },
    ready: kind => !!(runs[kind]?.done || kept[kind]),
    // A finished run, for playing back: its keyframes (texture array), how many, its grid, its first
    // picture, its length in seconds, its drops (rain).
    run(kind) { const R = runs[kind]?.done ? runs[kind] : kept[kind]; return R?.done ? { keys: R.keys, n: R.C.keys, cells: [R.nx, R.ny], dye0: R.dye0, T: R.T, drops: R.drops, above: R.C.above, box: R.want.box } : null; },
    dispose() { dead = true; for (const k of ['rain', 'dissolve']) { freeRun(runs[k]); freeRun(kept[k]); runs[k] = kept[k] = null; } Object.values(P).forEach(q => q && gl.deleteProgram(q.p)); },
  };
}
