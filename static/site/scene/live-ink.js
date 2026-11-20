// Photography → Chess: the live ink on the GPU (ink-sim.js has the model, glsl/ink-sim.js the passes).
// It owns the grids, steps them on the clock, and lends the mist (and the flow-carried detail) to the mist
// volume (glsl/living-ink.js INK_VOLUME), which keeps its look and moves with it. Without 32-bit float
// targets it never runs, and the mist is the bake's alone.
import { SIM, live, showAt, energyAt, simSize, createStir, createForcing, createImpulses } from './ink-sim.js';
import { HEADS_MAX, VORTICES_MAX } from './glsl/ink-sim.js';
import { FORMS, trackAt } from './living-forms.js';
import { smooth } from './ink-tank.js';

export const LIVE_PROGRAMS = ['simMoments', 'simInit', 'simAux', 'simForces', 'simAdvect', 'simAdvectCorrect', 'simDivergence', 'simJacobi', 'simProject', 'simCarry', 'simReduce', 'simThermo', 'simSmooth'];

export function createLiveInk(gl, programs, { coarse }) {
  const floats = !!gl.getExtension('EXT_color_buffer_float');
  let grid = null, moments = null, momentsKey = '', bake = [1, 1, 1], broken = !floats;
  let running = false, catching = false, simP = 0, shown = 0, acc = 0, steps = 0, lastP = null;
  const stir = createStir(), heads = new Float32Array(4 * HEADS_MAX), headV = new Float32Array(4 * HEADS_MAX), vortices = new Float32Array(4 * VORTICES_MAX);
  let headCount = 0, vortexCount = 0, forcing = null, impulses = createImpulses(7), fresh = true, stirNow = { amount: 0, sense: 0 };
  const was = new Map();
  const dev = () => globalThis.__inkSim ?? null;

  function target(w, h, internal, filter) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internal, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) broken = true;
    return { tex, fb, w, h };
  }
  const drop = t => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } };
  const pair = (w, h, f, filter) => [target(w, h, f, filter), target(w, h, f, filter)];
  function release() {
    if (!grid) return;
    for (const c of grid.carry ?? []) gl.deleteFramebuffer(c.fb);
    for (const [k, v] of Object.entries(grid)) if (k !== 'carry') { if (Array.isArray(v)) v.forEach(drop); else if (v?.fb) drop(v); }
    grid = null; running = false;
  }
  function allocate(nx, ny) {
    release();
    const L = gl.LINEAR, N = gl.NEAREST;
    grid = {
      nx, ny,
      U: pair(nx, ny, gl.RG16F, L), Uf: target(nx, ny, gl.RG16F, L), aux: target(nx, ny, gl.RGBA16F, N),
      div: target(nx, ny, gl.R32F, N), P: pair(nx, ny, gl.R32F, N),
      M: pair(nx, ny, gl.RGBA16F, L), D: pair(nx, ny, gl.RG16F, L), Ds: target(Math.ceil(nx / 4), Math.ceil(ny / 4), gl.RG16F, L),
      r1: target(32, 18, gl.RGBA32F, N), r2: target(1, 1, gl.RGBA32F, N), thermo: pair(1, 1, gl.RGBA32F, N),
    };
    // The mist and its detail are written together (simCarry): one framebuffer for each of the pair.
    grid.carry = grid.M.map((m, i) => {
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, m.tex, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, grid.D[i].tex, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) broken = true;
      return { fb, w: nx, h: ny };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  const swap = a => { const t = a[0]; a[0] = a[1]; a[1] = t; };

  // One pass: the program over the whole of `out`, its textures on units 0…, its uniforms by `set`.
  function pass(name, out, textures, set) {
    const prog = programs[name];
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb); gl.viewport(0, 0, out.w, out.h);
    gl.uniform2f(prog.U.uCells, grid.nx, grid.ny);
    let unit = 0;
    for (const [uniform, tex] of Object.entries(textures)) {
      if (!(uniform in prog.U)) continue;
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.U[uniform], unit++);
    }
    set?.(prog.U);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    for (let i = 0; i < unit; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, null); }
  }
  function headsUniforms(U) {
    gl.uniform4fv(U.uHead, heads); gl.uniform4fv(U.uHeadV, headV); gl.uniform1i(U.uHeads, headCount);
  }
  function bakeUniforms(U, ctx) {
    gl.uniform3f(U.uBake, bake[0], bake[1], ctx.keyOf(simP));
    gl.uniform4fv(U.uOrbit, ctx.orbit); gl.uniform2fv(U.uOrbitTurn, ctx.orbitTurn); gl.uniform1f(U.uAspect, ctx.aspect);
  }

  // The columns of every key of the bake's volume, once it is all uploaded (living-ink.js).
  function buildMoments(volume, nx, ny, nz) {
    const key = `${nx} ${ny} ${nz}`;
    if (broken || !programs.simMoments || (moments && momentsKey === key)) return;
    drop(moments);
    moments = target(nx * 10, ny * 8, gl.RGBA16F, gl.LINEAR);
    momentsKey = key; bake = [nx, ny, 0];
    const prog = programs.simMoments;
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, moments.fb); gl.viewport(0, 0, moments.w, moments.h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, volume); gl.uniform1i(prog.U.uVolume, 0);
    gl.uniform1i(prog.U.uDepth, nz); gl.uniform2f(prog.U.uCells, moments.w, moments.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // The heads at simP: where each plume's head is (the bake's tracks), how big, how alive, how fast.
  function placeHeads(ctx) {
    const { tracks, forms, keyOf } = ctx, key = keyOf(simP);
    headCount = 0;
    if (!tracks || !forms?.length) return [];
    const out = [];
    forms.forEach((f, k) => {
      if (headCount >= HEADS_MAX) return;
      const t = trackAt(tracks, key, k);
      if (!t[3]) return;
      const weight = smooth(SIM.show[0], .60, simP) * (1 - smooth(f.d1 - .012, f.d1 + .02, simP));
      if (weight <= .002) { was.delete(f.id); return; }
      const x = t[0] * grid.nx, y = t[1] * grid.ny, radius = Math.min(.2, Math.max(.07, .9 * t[3])) * .55 * grid.ny;
      const prev = was.get(f.id);
      let vx = 0, vy = 0;
      if (prev) { vx = .5 * prev.vx + .5 * (x - prev.x); vy = .5 * prev.vy + .5 * (y - prev.y); const s = Math.hypot(vx, vy); if (s > SIM.speed) { vx *= SIM.speed / s; vy *= SIM.speed / s; } }
      was.set(f.id, { x, y, vx, vy });
      heads.set([x, y, radius, weight], 4 * headCount);
      headV.set([vx, vy, SIM.head.drag, 0], 4 * headCount);
      headCount++;
      out.push({ id: f.id, x, y, radius, weight });
    });
    return out;
  }

  function step(ctx, stirNow, pace) {
    const g = grid, h = SIM.h, U = g.U, M = g.M, D = g.D;
    const list = placeHeads(ctx);
    const cores = impulses.step(list, stirNow.amount);
    vortexCount = Math.min(VORTICES_MAX, cores.length);
    vortices.fill(0);
    cores.slice(0, VORTICES_MAX).forEach((c, i) => vortices.set(c, 4 * i));
    forcing.step();
    pass('simAux', g.aux, { uU: U[0].tex });
    pass('simForces', U[1], { uU: U[0].tex, uAux: g.aux.tex, uMist: M[0].tex, uThermo: g.thermo[0].tex }, u => {
      headsUniforms(u);
      gl.uniform4fv(u.uMode, forcing.data); gl.uniform1f(u.uGain, 1 + 1.5 * stirNow.amount);
      gl.uniform4fv(u.uVortex, vortices); gl.uniform1i(u.uVortices, vortexCount);
      gl.uniform1f(u.uSwirl, 2.2e-4 * stirNow.sense);
      gl.uniform3f(u.uFluid, SIM.confinement, SIM.buoyancy.black, SIM.buoyancy.ivory); gl.uniform1f(u.uSpeed, SIM.speed); gl.uniform1f(u.uDamp, 1 - SIM.damping); gl.uniform1f(u.uTarget, energyAt(simP, stirNow.amount));
    });
    swap(U);
    pass('simAdvect', g.Uf, { uVel: U[0].tex, uSrc: U[0].tex }, u => { headsUniforms(u); gl.uniform1f(u.uCarry, 0); });
    pass('simAdvectCorrect', U[1], { uVel: U[0].tex, uSrc: U[0].tex, uFwd: g.Uf.tex }, u => { headsUniforms(u); gl.uniform1f(u.uCarry, 0); });
    swap(U);
    pass('simDivergence', g.div, { uU: U[0].tex });
    const sweeps = coarse ? SIM.pressure.phone : SIM.pressure.desktop;
    for (let i = 0; i < sweeps; i++) {
      pass('simJacobi', g.P[1], { uP: g.P[0].tex, uDiv: g.div.tex }, u => gl.uniform1f(u.uWarm, i === 0 ? SIM.pressure.warm : 1));
      swap(g.P);
    }
    pass('simProject', U[1], { uU: U[0].tex, uP: g.P[0].tex });
    swap(U);
    pass('simCarry', g.carry[1], { uM: M[0].tex, uD: D[0].tex, uU: U[0].tex, uMoments: moments.tex }, u => {
      headsUniforms(u); bakeUniforms(u, ctx);
      gl.uniform1f(u.uCarry, SIM.mist.carried);
      gl.uniform2f(u.uKappa, SIM.mist.along, SIM.mist.across);
      gl.uniform3f(u.uRelax, SIM.mist.near, SIM.mist.far, SIM.mist.handoff * smooth(.74, .79, simP));
      gl.uniform2f(u.uTau, 1 / (SIM.detail.tau * 60), SIM.detail.max);
    });
    swap(M); swap(D); swap(g.carry);
    steps++;
    if (steps % 8 === 0) measure();
  }
  // The grid's health, a block at a time, then one texel, and the thermostat's step from it: all on the GPU.
  function measure() {
    const g = grid, bx = Math.ceil(g.nx / 32), by = Math.ceil(g.ny / 18);
    pass('simReduce', g.r1, { uU: g.U[0].tex, uM: g.M[0].tex }, u => { gl.uniform2i(u.uBlock, bx, by); gl.uniform1i(u.uFirst, 1); });
    const prog = programs.simReduce;
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.r2.fb); gl.viewport(0, 0, 1, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.r1.tex); gl.uniform1i(prog.U.uU, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, g.r1.tex); gl.uniform1i(prog.U.uM, 1);
    gl.uniform2f(prog.U.uCells, 32, 18); gl.uniform2i(prog.U.uBlock, 32, 18); gl.uniform1i(prog.U.uFirst, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
    const { tau, gain, min, max } = SIM.thermostat;
    pass('simThermo', g.thermo[1], { uHealth: g.r2.tex, uLast: g.thermo[0].tex }, u => {
      gl.uniform4f(u.uLaw, energyAt(simP, stirNow.amount), 1 - Math.exp(-8 * SIM.h / tau), gain, fresh ? 1 : 0);
      gl.uniform2f(u.uBounds, min, max);
    });
    swap(g.thermo); fresh = false;
  }
  // For the tools only (it waits on the GPU): the thermostat's state and the grid's health.
  function health() {
    if (!grid) return null;
    const out = new Float32Array(4), th = new Float32Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, grid.r2.fb); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, grid.thermo[0].fb); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, th);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { energy: +out[0].toExponential(2), most: +out[1].toFixed(3), mist: +out[2].toFixed(4), gain: +th[1].toFixed(2) };
  }
  function start(ctx, from) {
    const { nx, ny } = simSize(ctx.w, ctx.h, ctx.mobile);
    if (!grid || grid.nx !== nx || grid.ny !== ny) allocate(nx, ny);
    if (broken) { release(); return false; }
    for (const t of [...grid.U, ...grid.P, ...grid.D, grid.Uf]) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]); }
    for (const t of grid.thermo) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.clearBufferfv(gl.COLOR, 0, [0, 1, 0, 0]); }
    simP = from;
    for (const t of grid.M) pass('simInit', t, { uMoments: moments.tex }, u => bakeUniforms(u, ctx));
    forcing = createForcing(1009, ny); impulses = createImpulses(7); was.clear();
    fresh = true; steps = 0; running = true;
    return true;
  }

  // Each frame (living-ink.js draw, before the mist volume): ctx is { P, dt, vel, w, h, mobile, tracks, forms,
  // keyOf, orbit, orbitTurn, aspect }. Returns how much of the live mist shows (0 … 1).
  //   Coming in from outside the window, or after a jump, it starts again, hidden: on a page, at P, with a
  // second of flow run ahead (SIM.preroll steps); for the tools (__inkSim.fixed), from the window's start
  // along the standard forward scroll, so a still at P is what a visitor scrolling there would see.
  let pending = 0;
  function frame(ctx) {
    const d = dev();
    if (broken || d?.off || !moments || !ctx.dt || LIVE_PROGRAMS.some(n => !programs[n])) { shown = 0; running = false; return 0; }
    const fixed = !!d?.fixed, dt = fixed ? SIM.h : ctx.dt, P = ctx.P;
    if (!live(P) && !(running && shown > 0)) { running = false; lastP = P; shown = 0; return 0; }
    const jumped = running && Math.abs(P - (lastP ?? P)) > SIM.jump;
    if (!running || jumped) {
      if (!live(P)) { running = false; shown = 0; lastP = P; return 0; }
      if (!start(ctx, fixed ? SIM.window[0] : P)) return 0;
      catching = true; pending = fixed ? Infinity : SIM.preroll; shown = 0;
    }
    stirNow = stir.update(fixed ? (d.vel ?? .5) : (ctx.vel ?? 0), dt);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.SCISSOR_TEST);
    if (catching) {
      const most = fixed ? SIM.catchUp.tools : SIM.catchUp.page;
      for (let i = 0; i < most && pending > 0; i++, pending--) {
        if (fixed) { if (P - simP <= SIM.pace) { pending = 0; break; } simP = Math.min(SIM.window[1], simP + SIM.pace); }
        step({ ...ctx }, stirNow, fixed);
      }
      if (pending <= 0) { catching = false; simP = P; }
    } else {
      acc = Math.min(acc + dt, SIM.maxSteps * SIM.h);
      const from = lastP ?? P, n = Math.max(1, Math.floor(acc / SIM.h + 1e-6));
      for (let i = 1; i <= n; i++) { simP = from + (P - from) * i / n; step(ctx, stirNow, fixed); }
      acc = Math.max(0, acc - n * SIM.h);
    }
    lastP = P;
    // The veils' share of the flow (once a frame).
    {
      const prog = programs.simSmooth, Ds = grid.Ds;
      gl.useProgram(prog.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, Ds.fb); gl.viewport(0, 0, Ds.w, Ds.h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, grid.D[0].tex); gl.uniform1i(prog.U.uD, 0);
      gl.uniform2f(prog.U.uCells, Ds.w, Ds.h); gl.uniform2f(prog.U.uFine, grid.nx, grid.ny);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindTexture(gl.TEXTURE_2D, null);
    }
    const goal = catching ? 0 : showAt(P);
    shown = fixed && !catching ? goal : shown + Math.max(-dt / SIM.fade, Math.min(dt / SIM.fade, goal - shown));
    if (shown <= 0 && !live(P)) running = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (d) d.bench = n => {
      const c = { ...ctx }, px = new Float32Array(4), sync = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, grid.r2.fb); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, px); };
      sync(); const t0 = performance.now(); for (let i = 0; i < n; i++) step(c, stirNow, false); sync(); const t1 = performance.now();
      for (let i = 0; i < n; i++) pass('simAux', grid.aux, { uU: grid.U[0].tex }); sync();
      return { step: (t1 - t0) / n, emptyish: (performance.now() - t1) / n };
    };
    if (d) d.stats = () => ({ steps, simP: +simP.toFixed(4), shown: +shown.toFixed(3), stir: +stir.amount.toFixed(2), catching, settled: running && !catching && Math.abs(shown - showAt(P)) < .02, ...(d.health ? health() : {}) });
    return shown;
  }

  // The live mist, its carried detail and the bake's columns, for the mist volume (glsl/living-ink.js).
  function bindVolume(U, units) {
    const on = !!(running && grid && moments && shown > 0) && !dev()?.hideMist;
    gl.uniform1f(U.uLive, on ? shown : 0);
    const tex = on ? [grid.M[0].tex, grid.D[0].tex, moments.tex] : [null, null, moments?.tex ?? null];
    ['uLiveMist', 'uLiveDetail', 'uMoments'].forEach((name, i) => { gl.activeTexture(gl.TEXTURE0 + units[i]); gl.bindTexture(gl.TEXTURE_2D, tex[i]); gl.uniform1i(U[name], units[i]); });
  }

  // The carried detail, for the veils (glsl/living-ink.js INK_SHEET_VERTEX).
  function bindSheets(U, unit) {
    const on = !!(running && grid && shown > 0) && !dev()?.hideSheets;
    gl.uniform1f(U.uLive, on ? shown * SIM.veils : 0);
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, on ? grid.Ds.tex : null); gl.uniform1i(U.uLiveDetail, unit);
  }

  return {
    buildMoments, frame, bindVolume, bindSheets,
    get shown() { return shown; },
    get usable() { return !broken; },
    dispose() { release(); drop(moments); moments = null; },
  };
}
