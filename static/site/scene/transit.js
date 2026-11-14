// Transits: the five seams of the homepage, where one world comes apart into small pieces that fly,
// flow and settle into the next. The scene (scene.js) hands over each seam it would draw; for the
// pairs below, this draws instead:
//
//   1. snapshots: the two worlds over the seam's region, rendered by the scene's own shader into
//      half-resolution textures (one of the two refreshed each frame);
//   2. the ground (mode 8 of the scene's shader, glsl/transit.js): each point's live world while it
//      is at rest, and what shows through while its piece is away;
//   3. the units (glsl/units.js), instanced: one or two draw calls per seam, each unit placed by
//      the seam's progress and its own seed alone, so scrolling back un-builds it (a click into
//      Science draws its cubes the same way, over its cover: prepareEffect, drawEffect);
//   Racing reads a worker-prepared condensation plan (dew-plan.js); no time-integrated state.
//
// Only seams on screen do any work, and only rows of units that can be in flight are drawn. The
// grids coarsen on touch screens and when the scene's resolution has dropped; reduced motion keeps
// the scene's plain seams.
import { createDewResources } from './dew-resources.js';
import { VERTEX } from './glsl/index.js';
import { UNIT_PROGRAMS, REACH_BAKE } from './glsl/units.js';
import { transitP, carveMaze, vortexPlan, vortexPlanTexels } from '../lerp.js';
import { DEW, FRAG } from './dew-plan.js';

// Upper style id - lower style id (scene.js STYLE_ID) → the seam, each told apart by its process.
// bake: what the seam's texture holds (glsl/flight.js): the ink's branching reach. plan: its
// choreography is worked out ahead in lerp.js (PLANS below) and read from the same slot. mips: the
// lower world's snapshot is mipmapped, to be read blurred; mipsA: the upper world's too.
const KINDS = {
  '0-3': { id: 'cubes', units: ['cubes:back', 'flow', 'cubes:front'], plan: true, mips: true },   // About Me → Science: a vortex
  '3-2': { id: 'dew', units: ['grains', 'fieldlines', 'frags'], mips: true, mipsA: true },   // Science → Racing: nebulae, stardust, drops, gems, field lines into the card
  '2-4': { id: 'sheets', units: ['sheets', 'glitter'] },             // Racing → Outdoors: peeling sheets
  '4-5': { id: 'film', units: ['film'] },                            // Outdoors → Photography: film, developed
  '5-1': { id: 'ink', units: ['filaments'], bake: 'reach' },         // Photography → Chess: branching ink
};
// Cell sizes in CSS px (fine pointer, touch).
const CELL = { cubes: [18, 22], streaks: [26, 36], flow: [30, 44], clickCubes: [13, 17], clickStreaks: [28, 38], glitter: [7, 11], filaments: [14, 22] };
const FLY = 420;   // how far, CSS px, a unit can stray from its row
// Outdoors' layers of sheets (glsl/flight.js layerGrid): [cols, rows] of layer k.
const SHEET_LAYERS = 3;
function layerGrid(k, w, h) {
  const rows = Math.max(3, Math.floor(h / (112 + 26 * k) + 0.5));
  return [Math.max(3, Math.floor(w / ((h / rows) * 0.9) + 0.5)), rows];
}

export function createTransit(gl, { renderWorld, renderPane, coarse }) {
  const dew = createDewResources(gl, coarse);
  // Where Racing's card sits during its hold (home.js measures it and says so): its fragments' field
  // lines end there. Read from the page too, in case that was said before this was listening.
  document.addEventListener('dew:card', e => { if (Array.isArray(e.detail)) dew.request(innerWidth, innerHeight, e.detail); });
  const heldCard = () => {
    const card = document.querySelector('.seam-wrap > .band--racing .r-band-race'), band = card?.closest('.band--racing');
    if (!card) return undefined;
    const cr = card.getBoundingClientRect(), br = band.getBoundingClientRect();
    return [cr.left, cr.top - br.top, cr.width, cr.height];
  };
  const programs = {};
  const snaps = new Map();

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
    for (const u of K.units) if (!programs[u.split(':')[0]]) return false;
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
    if (snap.ice) { gl.deleteTexture(snap.ice.t); gl.deleteFramebuffer(snap.ice.fb); }
    if (snap.gas) { gl.deleteTexture(snap.gas.t); gl.deleteFramebuffer(snap.gas.fb); }
  }
  // Racing's lit gas (glsl/dew.js dewGasField): soft, so drawn at a fraction of the screen's resolution
  // each frame it changes, into its own texture, for the ground to sample (on unit 3). Once the nebulae
  // have drained (P GAS_STILL) it no longer changes: drawn there once and kept, for the drops and gems
  // to see through.
  const GAS_STILL = 0.55;
  const gasOn = P => P > -0.12 && P < 1.0;
  function gasPass(snap, s, w, h, P) {
    const sc = w * h > 2.5e6 ? 0.3 : w * h > 0.6e6 ? 0.45 : 0.7, tw = Math.max(1, Math.round(w * sc)), th = Math.max(1, Math.round(h * sc));
    let fresh = false;
    if (!snap.gas || snap.gas.tw !== tw || snap.gas.th !== th) {
      if (snap.gas) { gl.deleteTexture(snap.gas.t); gl.deleteFramebuffer(snap.gas.fb); }
      const t = texture(tw, th, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
      snap.gas = { t, fb: target(t), tw, th, tick: 0, still: false };
      fresh = true;
    }
    const still = P >= GAS_STILL;
    if (still && snap.gas.still && !fresh) return;
    // It changes smoothly with P: every other frame is plenty.
    if (!fresh && !still && !snap.gas.still && ++snap.gas.tick % 2) return;
    snap.gas.still = still;
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0);
    renderPane({ ...s, mode: 9, h: still ? (GAS_STILL + 0.2) / 1.4 : s.p ?? 0, e: 0, clip: null }, snap.gas.fb, tw, th);
  }
  // The gems as they were at P = DEW.still, still (no push, no squeeze, no shake): the fragments'
  // faces (glsl/units.js frags). Rendered once per size, the first time the seam passes that point;
  // the same every time, so scrolling back and forth is exact.
  function iceSnap(snap, s, w, h) {
    const key = `${w} ${h}`;
    if (snap.ice?.key === key) return snap.ice.t;
    if (snap.ice) { gl.deleteTexture(snap.ice.t); gl.deleteFramebuffer(snap.ice.fb); }
    const sc = Math.min(1, Math.max(0.45, 1100 / w));
    const tw = Math.max(1, Math.round(w * sc)), th = Math.max(1, Math.round(h * sc));
    const t = texture(tw, th, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    snap.ice = { key, t, fb: target(t) };
    renderPane({ ...s, mode: 8, h: (DEW.still + 0.2) / 1.4, e: 1, iceReady: true, clip: null }, snap.ice.fb, tw, th);
    return t;
  }
  // The seam's reach, baked once for its size (flight.js SEAM_TEX): about a texel per CSS px, a
  // little coarser on big screens.
  // kind: 'reach' (the ink's branches).
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
      // The world below read blurred, from its mipmaps (glsl/flight.js vortexBlur).
      for (const [i, on] of [[1, K.mips], [0, K.mipsA]]) {
        if (!on) continue;
        gl.bindTexture(gl.TEXTURE_2D, tex[i]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
      snap = { w, h, tex, fb: tex.map(target), fresh: true, flip: 0, used: 0, mips: !!K.mips, mipsA: !!K.mipsA };
      snaps.set(K.id, snap);
    }
    return snap;
  }

  // ---- instanced unit grids -----------------------------------------------------------------------
  function grid(name, w, h, f) {
    const coarsen = f.scale < 0.8 ? 1.35 : 1;
    const cell = CELL[name][coarse ? 1 : 0] * coarsen;
    const cols = Math.max(1, Math.round(w / cell)), rows = Math.max(1, Math.round(h / cell));
    return [cols, rows, w / cols, h / rows];
  }
  // The rows near the screen, as [first instance, count] (a held seam's region is the screen).
  function span(g, s, f) {
    const [cols, rows, , ch] = g;
    let [from, to] = [0, rows];
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

  // Plans: a seam's choreography worked out ahead in lerp.js, as float texels its shaders read from
  // uReach. Each kind's entry gives, for the screen (w, h) and its cube grid g, a key and the texture
  // (width, height, data), made once per key. The vortex: a texel a cell (the cell its cube lands on,
  // when it leaves, when the cube bound for it lands). Racing owns its separate worker resources.
  const PLANS = {
    cubes: (w, h, g) => ({ key: `${g[0]} ${g[1]}`, make: () => ({ tw: g[0], th: g[1], data: vortexPlanTexels(vortexPlan(g[0], g[1])) }) }),
  };
  const plans = new Map();
  function planTexture(kind, w, h, g) {
    const spec = PLANS[kind](w, h, g);
    const had = plans.get(kind);
    if (had?.key === spec.key) return had.t;
    const { tw, th, data } = spec.make();
    if (had) gl.deleteTexture(had.t);
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, tw, th, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    plans.set(kind, { key: spec.key, t });
    return t;
  }
  // Made ahead, while the page is idle, for this screen, so the seams start without the work.
  later(() => {
    if (gl.isContextLost()) return;
    const w = innerWidth, h = innerHeight;
    planTexture('cubes', w, h, grid('cubes', w, h, { scale: 1 }));
    dew.request(w, h, heldCard());
  });

  let frame = 0;
  const effectSnap = { tex: [], fb: [], reach: null };
  return {
    // Racing's plan (names kept from the ice transition this replaced; scene.js and the tools use them).
    iceReady: (w, h) => dew.ready(w, h),
    bindIce: (w, h) => dew.bind(w, h),
    iceStats: (w, h) => dew.stats(w, h),
    dispose() { dew.dispose(); snaps.forEach(dropSnap); snaps.clear(); plans.forEach(p=>gl.deleteTexture(p.t)); },
    // What a click's cover reads (opens.js), made once per click from its origin O and far corner:
    // the maze (house), the ink's reach; null for processes computed on the fly, or
    // while the bake program is still compiling (the effect then computes what it can live).
    bakeEffect(style, O, far, w, h) {
      if (style === 0) return mazeTexture(O, w, h);
      if (style !== 1) return null;
      if (!programs.bake) return null;
      bake(effectSnap, style, w, h, [Math.round(O[0]), Math.round(O[1]), Math.round(far)], 'reach');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return effectSnap.reach.t;
    },
    // Whether this seam is a transit, and ready.
    handles(s) { const K = kindOf(s); return !!K && usable(K); },

    // Before drawing: refresh the snapshots.
    prepare(s, dt, f) {
      const K = kindOf(s);
      if (!K || !usable(K)) return false;
      const [, , w, h] = s.region;
      // The dew is seen through drops and frost: its worlds' snapshots can be coarser on big screens.
      const ts = (K.id === 'dew' ? (w > 1800 ? 0.36 : coarse ? 0.45 : 0.5) : coarse || w > 1800 ? 0.5 : 0.6) * Math.max(0.5, f.scale);
      const tw = Math.max(1, Math.round(w * ts)), th = Math.max(1, Math.round(h * ts));
      const snap = snapFor(K, tw, th);
      snap.used = f.now;
      if (K.id === 'dew' && (snap.planMode === undefined || (!snap.planMode && (s.p <= 0 || s.p >= 1)))) snap.planMode = dew.ready(w, h);
      if (K.bake) bake(snap, s.b, w, h, null, K.bake);
      // Which snapshots this frame rendered: both when fresh, else the one whose turn it is.
      const drew = [snap.fresh, snap.fresh];
      if (snap.fresh) {
        renderWorld(s.a, snap.fb[0], tw, th, s.region, s.vel, K.id === 'dew');
        renderWorld(s.b, snap.fb[1], tw, th, s.region, s.vel);
        snap.fresh = false;
      } else if (K.id === 'dew') {
        // The pane is mostly wet glass and frost: a snapshot every other frame (each world at 15 Hz)
        // is plenty, and once the dawn has hidden Science everywhere (P .88) only Racing's. While the
        // page is held still (the region unchanged), the worlds only drift: every fourth frame.
        snap.tick = (snap.tick ?? 0) + 1;
        const at = s.region.join(' '), still = snap.at === at;
        snap.at = at;
        if (snap.tick % (still ? 4 : 2) === 0) {
          snap.flip = transitP(s.p ?? 0) < 0.88 ? snap.flip ^ 1 : 1;
          renderWorld(snap.flip ? s.b : s.a, snap.fb[snap.flip], tw, th, s.region, s.vel, !snap.flip);
          drew[snap.flip] = true;
        }
      } else {
        snap.flip ^= 1;
        renderWorld(snap.flip ? s.b : s.a, snap.fb[snap.flip], tw, th, s.region, s.vel);
        drew[snap.flip] = true;
      }
      for (const [i, on] of [[1, snap.mips], [0, snap.mipsA]]) {
        if (!on || !drew[i]) continue;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, snap.tex[i]);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
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
      const simOn = false;
      const ground = K.id === 'cubes' ? grid('cubes', w, h, f) : null;
      // The ink's reach, or the seam's plan.
      const reach = K.plan ? planTexture(K.id, w, h, ground) : snap.reach?.t ?? null;
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, reach);
      gl.activeTexture(gl.TEXTURE0);
      const iceReady = K.id === 'dew' && snap.planMode && dew.bind(w, h);
      // Racing's fragments need the frozen pane once the rift is near; their field lines show a little before.
      const P = transitP(s.p ?? 0);
      const fragsOn = K.id === 'dew' && iceReady && renderPane && P > DEW.detach0 - 0.07 && P < DEW.detach1 + FRAG.maxFly + 0.03;
      const ice = fragsOn ? iceSnap(snap, s, w, h) : null;
      const nFrags = fragsOn ? (dew.stats(w, h)?.frags ?? 0) : 0;
      // The stardust, while it falls.
      const nGrains = K.id === 'dew' && iceReady && P > 0 && P < 0.5 ? (dew.stats(w, h)?.grains ?? 0) : 0;
      // The gas, while it shows: drawn now (it needs the plan, bound above), sampled by the ground.
      const gas = K.id === 'dew' && iceReady && renderPane && gasOn(P);
      if (gas) { gasPass(snap, s, w, h, P); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, snap.gas.t); gl.activeTexture(gl.TEXTURE0); }
      const drew = drawGround({ ...s, mode: 8, h: s.p ?? 0, grid: ground, simOn, iceReady });
      if (gas) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0); }
      if (!drew || !K.units.length) return drew;
      // The units keep the ground's scissor: while the strip scrolls in or out, they stay in it.
      for (const unit of K.units) {
        // name:pass, where a kind draws in passes (Science's cubes: behind the wind, then in front).
        const [name, pass] = unit.split(':');
        if ((name === 'frags' || name === 'fieldlines') && (!ice || !nFrags)) continue;
        if (name === 'grains' && !nGrains) continue;
        const prog = programs[name], def = UNIT_PROGRAMS[name];
        const g = name === 'sheets' || name === 'film' || name === 'frags' || name === 'fieldlines' || name === 'grains' ? [1, 1, 1, 1] : name === 'cubes' ? ground : grid(name, w, h, f);
        // The vortex carries its cubes the whole height of the screen, one a cell. The sheets draw a
        // layer at a time, the lowest first.
        const [first, count] = name === 'sheets' ? [0, 1] : name === 'frags' || name === 'fieldlines' ? [0, nFrags] : name === 'grains' ? [0, nGrains] : name === 'flow' ? [0, g[0] * g[1]] : name === 'film' ? [0, Math.max(4, Math.floor(h / 84 + 0.5))]
          : name === 'cubes' || name === 'filaments' ? [0, g[0] * g[1]] : span(g, s, f);
        if (!count) continue;
        const { p, U } = prog;
        gl.useProgram(p);
        gl.uniform4f(U.uRegion, ...s.region);
        gl.uniform2f(U.uView, f.vpW, f.vpH);
        gl.uniform1f(U.uTime, f.time);
        gl.uniform1f(U.uH, s.p ?? 0);
        gl.uniform1f(U.uVel, s.vel ?? 0);
        gl.uniform4f(U.uGrid, ...g);
        gl.uniform1i(U.uFirst, first);
        if (U.uClick) gl.uniform1f(U.uClick, 0);
        if (U.uPass) gl.uniform1i(U.uPass, pass === 'back' ? 0 : pass === 'front' ? 1 : 2);
        gl.uniform1i(U.uTexA, 0);
        gl.uniform1i(U.uTexB, 1);
        gl.uniform1i(U.uReach, 5);
        // The fragments' faces: the frozen pane, on unit 3 (the scene's shader leaves it free).
        if (name === 'frags') { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, ice); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(U.uTexA, 3); }
        if (def.blend === 'opaque') gl.disable(gl.BLEND);
        else {
          gl.enable(gl.BLEND);
          if (def.blend === 'add') gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        }
        if (name === 'sheets') {
          for (let k = SHEET_LAYERS - 1; k >= 0; k--) {
            const [cols, rows] = layerGrid(k, w, h);
            gl.uniform1i(U.uLayer, k);
            gl.drawArraysInstanced(gl.TRIANGLES, 0, def.verts, (cols + 1) * rows);
          }
        } else gl.drawArraysInstanced(gl.TRIANGLES, 0, def.verts, count);
      }
      gl.disable(gl.BLEND);
      if (ice) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0); }
      restore();
      return true;
    },

    // A click into Science: its cubes build the page out of a vortex at the click (opens.js draws the
    // ground). Before the frame: Science's world into a snapshot for the cubes' faces, and the grid
    // the cover and the cubes share (s.grid). False until the programs are in.
    prepareEffect(s, f) {
      if (!programs.cubes || !programs.streaks) return false;
      const w = f.vpW, h = f.vpH;
      const ts = (coarse || w > 1800 ? 0.5 : 0.6) * Math.max(0.5, f.scale);
      const tw = Math.max(1, Math.round(w * ts)), th = Math.max(1, Math.round(h * ts));
      const snap = snapFor({ id: 'click' }, tw, th);
      snap.used = f.now;
      // The world moves: refreshed every other frame.
      if (snap.fresh || (snap.flip ^= 1)) renderWorld(3, snap.fb[1], tw, th, [0, 0, w, h], 0);
      snap.fresh = false;
      s.grid = grid('clickCubes', w, h, f);
      return true;
    },
    // After the cover: the streamlines, then the cubes, on the whole screen.
    drawEffect(s, f) {
      const snap = snaps.get('click');
      if (!snap || !s.grid) return;
      const w = f.vpW, h = f.vpH;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, snap.tex[1]);
      gl.activeTexture(gl.TEXTURE0);
      gl.disable(gl.SCISSOR_TEST);
      for (const name of ['streaks', 'cubes']) {
        const { p, U } = programs[name], def = UNIT_PROGRAMS[name];
        const g = name === 'cubes' ? s.grid : grid('clickStreaks', w, h, f);
        gl.useProgram(p);
        gl.uniform4f(U.uRegion, 0, 0, w, h);
        gl.uniform2f(U.uView, w, h);
        gl.uniform1f(U.uTime, f.time);
        gl.uniform1f(U.uH, (s.e ?? 0) * 1.04);
        gl.uniform1f(U.uVel, 0);
        gl.uniform4f(U.uGrid, ...g);
        gl.uniform1i(U.uFirst, 0);
        gl.uniform1f(U.uClick, 1);
        if (U.uPass) gl.uniform1i(U.uPass, 2);
        gl.uniform2f(U.uO, s.origin[0], s.origin[1]);
        gl.uniform1i(U.uTexA, 0);
        gl.uniform1i(U.uTexB, 1);
        gl.uniform1i(U.uReach, 5);
        // The fragments' faces: the frozen pane, on unit 3 (the scene's shader leaves it free).
        if (name === 'frags') { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, ice); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(U.uTexA, 3); }
        if (def.blend === 'opaque') gl.disable(gl.BLEND);
        else { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
        gl.drawArraysInstanced(gl.TRIANGLES, 0, def.verts, g[0] * g[1]);
      }
      gl.disable(gl.BLEND);
      gl.enable(gl.SCISSOR_TEST);
    },

    // Let go of the snapshots of seams that have been off screen for a while.
    sweep(now) {
      if (++frame % 120) return;
      for (const [id, snap] of snaps) if (now - snap.used > 4000) { dropSnap(snap); snaps.delete(id); }
    },
  };
}
