// Transits: the five seams of the homepage, where one world comes apart into small pieces that fly,
// flow and settle into the next. The scene (scene.js) hands over each seam it would draw; for the
// pairs below, this draws instead:
//
//   1. snapshots: the two worlds over the seam's region, rendered by the scene's own shader into
//      half-resolution textures (one of the two refreshed each frame);
//   2. the ground (mode 8 of the scene's shader, glsl/transit.js): each point's live world while it
//      is at rest, and what shows through while its piece is away;
//   3. the units (glsl/units.js), instanced: one or two draw calls per seam, each unit placed by
//      the seam's progress and its own seed alone, so scrolling back un-builds it;
//   4. for Science → Racing, a small fluid sim that stirs the flow.
//
// Only seams on screen do any work, and only rows of units that can be in flight are drawn. The
// grids coarsen on touch screens and when the scene's resolution has dropped; reduced motion keeps
// the scene's plain seams.
import { VERTEX } from './glsl/index.js';
import { UNIT_PROGRAMS, SIM, REACH_BAKE } from './glsl/units.js';
import { transitP, activeRows, carveMaze } from '../lerp.js';

// Upper style id - lower style id (scene.js STYLE_ID) → the seam, each told apart by its process.
// bake: what the seam's texture holds (glsl/flight.js): the ink's branching reach, or the crystals.
const KINDS = {
  '0-3': { id: 'cubes', units: ['cubes'] },                           // About Me → Science: a Hilbert curve
  '3-2': { id: 'crystals', units: [], sim: true, bake: 'crystals' },  // Science → Racing: crystal growth
  '2-4': { id: 'sheets', units: ['sheets', 'glitter'] },             // Racing → Outdoors: peeling sheets
  '4-5': { id: 'iris', units: [] },                                  // Outdoors → Photography: an iris, halftone
  '5-1': { id: 'ink', units: ['filaments'], bake: 'reach' },         // Photography → Chess: branching ink
};
// Cell sizes in CSS px (fine pointer, touch).
const CELL = { cubes: [9, 14], glitter: [7, 11], filaments: [16, 26] };
const FLY = 420;   // how far, CSS px, a unit can stray from its row

export function createTransit(gl, { renderWorld, coarse }) {
  const programs = {};
  const snaps = new Map();
  let sim = null;
  let simWanted = true;

  // ---- programs, compiled off the main thread where the driver allows ------------------------------
  const ext = gl.getExtension('KHR_parallel_shader_compile');
  function link(vs, fs) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const v = mk(gl.VERTEX_SHADER, vs), f = mk(gl.FRAGMENT_SHADER, fs);
    const p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    return { p, v, f };
  }
  function locations(p) {
    const U = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
      U[name] = gl.getUniformLocation(p, name);
    }
    return U;
  }
  function settle(name, L) {
    if (!gl.getProgramParameter(L.p, gl.LINK_STATUS)) {
      console.warn(`The ${name} transit did not build; its seam stays plain.`, gl.getShaderInfoLog(L.v) || gl.getShaderInfoLog(L.f) || gl.getProgramInfoLog(L.p));
      return null;
    }
    gl.deleteShader(L.v);
    gl.deleteShader(L.f);
    const prog = { p: L.p, U: locations(L.p) };
    const def = UNIT_PROGRAMS[name];
    if (def) warm(prog, def);
    if (name.startsWith('sim.')) later(warmSim);
    return prog;
  }
  // Draw once, a pixel, in the state the seam will use: the driver builds its pipeline now, while
  // nothing is on screen, rather than on the first frame the seam appears.
  function warm({ p, U }, def) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, 1, 1);
    gl.useProgram(p);
    gl.uniform4f(U.uGrid ?? U.uGrid2, 1, 1, 1, 1);
    if (U.uGrid2) gl.uniform4f(U.uGrid2, 1, 1, 1, 1);
    gl.uniform4f(U.uRegion, 0, 0, 1, 1);
    gl.uniform2f(U.uView, 1, 1);
    if (def.blend !== 'opaque') { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, def.blend === 'add' ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); }
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, 1);
    gl.disable(gl.BLEND);
  }
  const jobs = [
    ...Object.entries(UNIT_PROGRAMS).map(([name, def]) => ({ name, vs: def.vs, fs: def.fs, def })),
    ...Object.entries(SIM).map(([name, fs]) => ({ name: `sim.${name}`, vs: VERTEX, fs })),
    { name: 'bake', vs: VERTEX, fs: REACH_BAKE },
  ];
  const later = window.requestIdleCallback ? cb => requestIdleCallback(cb, { timeout: 600 }) : cb => setTimeout(cb, 40);
  if (ext) {
    const linked = jobs.map(j => ({ j, L: link(j.vs, j.fs) }));
    const poll = () => {
      if (gl.isContextLost()) return;
      const waiting = linked.filter(({ j, L }) => {
        if (programs[j.name] !== undefined) return false;
        if (!gl.getProgramParameter(L.p, ext.COMPLETION_STATUS_KHR)) return true;
        programs[j.name] = settle(j.name, L);
        return false;
      });
      if (waiting.length) setTimeout(poll, 50);
    };
    poll();
  } else {
    // One program per idle moment, so no single frame pays for them all.
    const next = () => {
      const j = jobs.find(x => programs[x.name] === undefined);
      if (!j || gl.isContextLost()) return;
      programs[j.name] = settle(j.name, link(j.vs, j.fs));
      later(next);
    };
    later(next);
  }

  // The scene's own shader drawing into a snapshot is a new pipeline too: warm it the same way.
  later(() => {
    if (gl.isContextLost()) return;
    const t = texture(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE), fb = target(t);
    renderWorld(0, fb, 1, 1, [0, 0, 1, 1], 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    gl.deleteTexture(t);
  });

  const kindOf = s => KINDS[`${s.a}-${s.b}`] || null;
  function usable(K) {
    if (!programs.bake) return false;
    for (const u of K.units) if (!programs[u]) return false;
    return true;
  }

  // ---- snapshots ------------------------------------------------------------------------------------
  function texture(w, h, internal, format, type) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  }
  function target(tex) {
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return fb;
  }
  function dropSnap(snap) {
    snap.tex.forEach(t => gl.deleteTexture(t));
    snap.fb.forEach(f => gl.deleteFramebuffer(f));
    if (snap.reach) { gl.deleteTexture(snap.reach.t); gl.deleteFramebuffer(snap.reach.fb); }
  }
  // The seam's reach, baked once for its size (flight.js SEAM_TEX): about a texel per CSS px, a
  // little coarser on big screens.
  // kind: 'reach' (the ink's branches) or 'crystals'.
  function bake(snap, style, w, h, polar = null, kind = 'reach') {
    const rs = w > 1600 ? 0.6 : 0.8;
    const tw = Math.max(1, Math.round(w * rs)), th = Math.max(1, Math.round(h * rs));
    const key = `${kind} ${style} ${w} ${h} ${polar}`;
    if (snap.reach?.key === key) return;
    if (snap.reach) { gl.deleteTexture(snap.reach.t); gl.deleteFramebuffer(snap.reach.fb); }
    const t = texture(tw, th, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    snap.reach = { key, t, fb: target(t) };
    const { p, U } = programs.bake;
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(p);
    gl.uniform1i(U.uPolar, polar ? 1 : 0);
    gl.uniform1i(U.uKind, kind === 'crystals' ? 1 : 0);
    if (polar) { gl.uniform2f(U.uO, polar[0], polar[1]); gl.uniform1f(U.uFar, polar[2]); }
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, tw, th);
    gl.uniform2f(U.uSize, w, h);
    gl.uniform2f(U.uTexel, tw, th);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function snapFor(K, w, h) {
    let snap = snaps.get(K.id);
    if (snap && (snap.w !== w || snap.h !== h)) { dropSnap(snap); snap = null; }
    if (!snap) {
      const tex = [0, 1].map(() => texture(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE));
      snap = { w, h, tex, fb: tex.map(target), fresh: true, flip: 0, used: 0 };
      snaps.set(K.id, snap);
    }
    return snap;
  }

  // ---- the fluid ----------------------------------------------------------------------------------
  function createSim() {
    if (!gl.getExtension('EXT_color_buffer_float')) return null;
    const P = name => programs[`sim.${name}`];
    if (!P('step') || !P('divergence') || !P('jacobi') || !P('gradient')) return undefined;   // not yet
    const NX = 128;
    let NY = 0, vel = [], pres = [], div = null, last = null;
    const make = (internal, format) => { const t = texture(NX, NY, internal, format, gl.HALF_FLOAT); return { t, fb: target(t) }; };
    function alloc(ny) {
      [...vel, ...pres, div].forEach(x => { if (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.fb); } });
      NY = ny;
      vel = [make(gl.RG16F, gl.RG), make(gl.RG16F, gl.RG)];
      pres = [make(gl.R16F, gl.RED), make(gl.R16F, gl.RED)];
      div = make(gl.R16F, gl.RED);
      const ok = [vel[0], div].every(x => { gl.bindFramebuffer(gl.FRAMEBUFFER, x.fb); return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; });
      return ok;
    }
    if (!alloc(64)) return null;
    function pass(name, out, inputs, set) {
      const { p, U } = P(name);
      gl.useProgram(p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb);
      gl.uniform2f(U.uCells, NX, NY);
      let unit = 3;
      for (const [uniform, tex] of inputs) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex.t);
        gl.uniform1i(U[uniform], unit++);
      }
      set?.(U);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    return {
      get texture() { return vel[0].t; },
      step(dt, s, f) {
        const [x, y, w, h] = s.region;
        const ny = Math.max(24, Math.min(128, Math.round(NX * h / w)));
        if (ny !== NY) alloc(ny);
        gl.viewport(0, 0, NX, NY);
        const px = f.ptr.x - x, py = f.ptr.y - y;
        const k = 1 / Math.max(dt, 1 / 120);
        const ptr = last ? [px, py, (px - last[0]) * k * f.ptr.on, (py - last[1]) * k * f.ptr.on] : [px, py, 0, 0];
        last = [px, py];
        pass('step', vel[1], [['uVelT', vel[0]]], U => {
          gl.uniform2f(U.uSize, w, h);
          gl.uniform1f(U.uDt, Math.min(dt, 1 / 30));
          gl.uniform1f(U.uTime, f.time);
          gl.uniform1f(U.uFront, transitP(s.p ?? 0));
          gl.uniform1f(U.uScroll, s.vel ?? 0);
          gl.uniform4f(U.uPtr, ptr[0], ptr[1], ptr[2], ptr[3]);
        });
        vel.reverse();
        pass('divergence', div, [['uVelT', vel[0]]]);
        for (let i = 0; i < 12; i++) { pass('jacobi', pres[1], [['uPres', pres[0]], ['uDiv', div]]); pres.reverse(); }
        pass('gradient', vel[1], [['uPres', pres[0]], ['uVelT', vel[0]]]);
        vel.reverse();
        for (const u of [3, 4]) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, null); }
        gl.activeTexture(gl.TEXTURE0);
      },
      drop() { [...vel, ...pres, div].forEach(x => { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.fb); }); },
    };
  }

  // Build the fluid and run one step off screen as soon as its programs are in.
  function warmSim() {
    if (sim || !simWanted || gl.isContextLost()) return;
    const made = createSim();
    if (made === null) { simWanted = false; return; }
    if (!made) return;
    sim = made;
    sim.step(1 / 60, { region: [0, 0, 1440, 900], p: 0.5, vel: 0 }, { ptr: { x: 0, y: 0, on: 0 }, time: 0 });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ---- grids ----------------------------------------------------------------------------------------
  function grid(name, w, h, f) {
    const coarsen = f.scale < 0.8 ? 1.35 : 1;
    const cell = CELL[name][coarse ? 1 : 0] * coarsen;
    const cols = Math.max(1, Math.round(w / cell)), rows = Math.max(1, Math.round(h / cell));
    return [cols, rows, w / cols, h / rows];
  }
  // Four or five rows of near-square panes filling the strip (odd rows are laid half a pane over,
  // one pane longer).
  function sheetGrid(w, h) {
    const rows = h > 640 ? 5 : 4, ph = h / rows;
    const cols = Math.max(3, Math.round(w / ph));
    return [cols, rows, w / cols, ph];
  }
  // The rows that can be in flight and are near the screen, as [first instance, count]. Only the
  // ink grows from the foot; the other processes can be anywhere on the screen at once.
  function span(g, s, f, fromFoot) {
    const [cols, rows, , ch] = g;
    let [from, to] = fromFoot ? activeRows(transitP(s.p ?? 0), rows) : [0, rows];
    const y = s.region[1];
    from = Math.max(from, Math.floor((-y - FLY) / ch));
    to = Math.min(to, Math.ceil((f.vpH - y + FLY) / ch));
    return to > from ? [from * cols, (to - from) * cols] : [0, 0];
  }

  // A maze for a click (opens.js): carved by depth-first backtracking from the click's cell, one
  // texel per cell, nearest-sampled: visit order in r, g (16 bits) and the side entered from in b.
  const MCELL = 34;
  let maze = null;
  function mazeTexture(O, w, h) {
    const cols = Math.ceil(w / MCELL), rows = Math.ceil(h / MCELL);
    const start = [Math.min(cols - 1, Math.max(0, Math.floor(O[0] / MCELL))), Math.min(rows - 1, Math.max(0, Math.floor(O[1] / MCELL)))];
    const key = `${cols} ${rows} ${start}`;
    if (maze?.key === key) return maze.t;
    const { order, from } = carveMaze(cols, rows, start, cols * 131 + rows * 17 + start[0] * 7 + start[1]);
    const data = new Uint8Array(cols * rows * 4);
    const n = Math.max(1, cols * rows - 1);
    for (let i = 0; i < cols * rows; i++) {
      const v = Math.round(order[i] / n * 65535);
      data.set([v >> 8, v & 255, from[i], 255], i * 4);
    }
    if (maze) gl.deleteTexture(maze.t);
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    maze = { key, t };
    return t;
  }

  let frame = 0;
  const effectSnap = { tex: [], fb: [], reach: null };
  return {
    // What a click's cover reads (opens.js), made once per click from its origin O and far corner:
    // the maze (house), the ink's reach, the crystals; null for processes computed on the fly, or
    // while the bake program is still compiling (the effect then computes what it can live).
    bakeEffect(style, O, far, w, h) {
      if (style === 0) return mazeTexture(O, w, h);
      if (style !== 1 && style !== 2) return null;
      if (!programs.bake) return null;
      bake(effectSnap, style, w, h, [Math.round(O[0]), Math.round(O[1]), Math.round(far)], style === 2 ? 'crystals' : 'reach');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return effectSnap.reach.t;
    },
    // Whether this seam is a transit, and ready.
    handles(s) { const K = kindOf(s); return !!K && usable(K); },

    // Before the frame's drawing: refresh the snapshots and step the fluid.
    prepare(s, dt, f) {
      const K = kindOf(s);
      if (!K || !usable(K)) return false;
      const [, , w, h] = s.region;
      const ts = (coarse || w > 1800 ? 0.5 : 0.6) * Math.max(0.5, f.scale);
      const tw = Math.max(1, Math.round(w * ts)), th = Math.max(1, Math.round(h * ts));
      const snap = snapFor(K, tw, th);
      snap.used = f.now;
      if (K.bake) bake(snap, s.b, w, h, null, K.bake);
      if (snap.fresh) {
        renderWorld(s.a, snap.fb[0], tw, th, s.region, s.vel);
        renderWorld(s.b, snap.fb[1], tw, th, s.region, s.vel);
        snap.fresh = false;
      } else {
        snap.flip ^= 1;
        renderWorld(snap.flip ? s.b : s.a, snap.fb[snap.flip], tw, th, s.region, s.vel);
      }
      if (K.sim && simWanted) {
        if (!sim) { const made = createSim(); if (made === null) simWanted = false; else if (made) sim = made; }
        if (sim) sim.step(dt, s, f);
      }
      return true;
    },

    // On the canvas: the ground through the scene's shader, then the units.
    draw(s, f, drawGround, restore) {
      const K = kindOf(s);
      const snap = snaps.get(K.id);
      if (!snap) return false;
      const [, , w, h] = s.region;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, snap.tex[0]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, snap.tex[1]);
      const simOn = K.sim && sim;
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, simOn ? sim.texture : null);
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, snap.reach?.t ?? null);
      gl.activeTexture(gl.TEXTURE0);
      const ground = K.id === 'cubes' ? grid('cubes', w, h, f) : K.id === 'sheets' ? sheetGrid(w, h) : null;
      const drew = drawGround({ ...s, mode: 8, h: s.p ?? 0, grid: ground, simOn });
      if (!drew || !K.units.length) return drew;
      gl.disable(gl.SCISSOR_TEST);
      for (const name of K.units) {
        const prog = programs[name], def = UNIT_PROGRAMS[name];
        const g = name === 'sheets' ? ground : name === 'cubes' ? ground : grid(name, w, h, f);
        const [first, count] = name === 'sheets' ? [0, (g[0] + 1) * g[1]] : span(g, s, f, name === 'filaments');
        if (!count) continue;
        const { p, U } = prog;
        gl.useProgram(p);
        gl.uniform4f(U.uRegion, ...s.region);
        gl.uniform2f(U.uView, f.vpW, f.vpH);
        gl.uniform1f(U.uTime, f.time);
        gl.uniform1f(U.uH, s.p ?? 0);
        gl.uniform1f(U.uVel, s.vel ?? 0);
        gl.uniform4f(U.uGrid, ...g);
        if (name === 'glitter') gl.uniform4f(U.uGrid2, ...ground);   // the panes the dust breaks from
        gl.uniform1i(U.uFirst, first);
        gl.uniform1i(U.uTexA, 0);
        gl.uniform1i(U.uTexB, 1);
        gl.uniform1i(U.uReach, 5);
        if (def.blend === 'opaque') gl.disable(gl.BLEND);
        else {
          gl.enable(gl.BLEND);
          if (def.blend === 'add') gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        }
        gl.drawArraysInstanced(gl.TRIANGLES, 0, def.verts, count);
      }
      gl.disable(gl.BLEND);
      gl.enable(gl.SCISSOR_TEST);
      restore();
      return true;
    },

    // Let go of the snapshots of seams that have been off screen for a while.
    sweep(now) {
      if (++frame % 120) return;
      for (const [id, snap] of snaps) if (now - snap.used > 4000) { dropSnap(snap); snaps.delete(id); }
    },
  };
}
