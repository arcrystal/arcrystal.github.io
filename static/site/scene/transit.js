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
import { createTerrainResources } from './terrain-resources.js';
import { makeLead } from './lead-plan.js';
import { FIRE, FIREC, makeIgnition, ignitionTexels } from './fire-plan.js';
import { createInkSim } from './ink-sim.js';
import { UNMIX, rainAt, unmixAt, weightsAt, smoothIn } from './unmix-plan.js';
import { UNMIX_SEEN } from './glsl/unmix.js';
import { VERTEX } from './glsl/index.js';
import { UNIT_PROGRAMS } from './glsl/units.js';
import { transitP, carveMaze, vortexPlan, vortexPlanTexels } from '../lerp.js';
import { SPOTS, FREEZE, CLICK } from './dew-plan.js';

// Upper style id - lower style id (scene.js STYLE_ID) → the seam, each told apart by its process.
// plan: its choreography is worked out ahead in lerp.js (PLANS below) and read from unit 5. mips: the
// lower world's snapshot is mipmapped, to be read blurred; mipsA: the upper world's too. live: both
// worlds are drawn live where they show, so no snapshots are kept.
const KINDS = {
  '0-3': { id: 'cubes', units: ['cubes:back', 'flow', 'cubes:front'], plan: true, mips: true },   // About Me → Science: a vortex
  '3-2': { id: 'dew', units: ['fieldlines', 'drops', 'shards'], mips: true, mipsA: true },   // Science → Racing: remnants, gravity's spots, cold from the card, the vacuum
  '2-4': { id: 'peaks', units: [], live: true },                     // Racing → Outdoors: paint into the White Mountains into art glass
  '4-5': { id: 'fire', units: ['embers', 'ribbons', 'grains'], live: true },   // Outdoors → Photography: fire becoming memory
  '5-1': { id: 'unmix', units: [], live: true },                     // Photography → Chess: ink, unmixed
};
// Cell sizes in CSS px (fine pointer, touch).
const CELL = { cubes: [18, 22], streaks: [26, 36], flow: [30, 44], clickCubes: [13, 17], clickStreaks: [28, 38], glitter: [7, 11], embers: [16, 24], grains: [6, 10] };
// Outdoors → Photography's ribbons: strands a family round the torus's tube, ribbons a strand round its ring (fine pointer, touch).
const RIBBONS = [[30, 12], [20, 10]];
const FLY = 420;   // how far, CSS px, a unit can stray from its row
// Outdoors' layers of sheets (glsl/flight.js layerGrid): [cols, rows] of layer k.
const SHEET_LAYERS = 3;
function layerGrid(k, w, h) {
  const rows = Math.max(3, Math.floor(h / (112 + 26 * k) + 0.5));
  return [Math.max(3, Math.floor(w / ((h / rows) * 0.9) + 0.5)), rows];
}

export function createTransit(gl, { renderWorld, renderPane, coarse, board3d }) {
  const dew = createDewResources(gl, coarse);
  const terrain = createTerrainResources(gl, coarse);
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
    { name: 'unmixSeen', vs: VERTEX, fs: UNMIX_SEEN },
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
    if (K.id === 'unmix' && !(programs.unmixSeen && inkFits())) return false;
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
    if (snap.gas) { gl.deleteTexture(snap.gas.t); gl.deleteFramebuffer(snap.gas.fb); }
  }
  // Racing's lit gas (glsl/dew.js dewGasField): soft, so drawn at a fraction of the screen's resolution
  // each frame it changes, into its own texture, for the ground to sample (on unit 3). Once the nebulae
  // have drained (P GAS_STILL) it no longer changes: drawn there once and kept, for the drops and gems
  // to see through.
  const GAS_STILL = SPOTS.still;
  const gasOn = P => P > -0.12 && P < 1.0;
  function gasPass(snap, s, w, h, P) {
    const sc = w * h > 2.5e6 ? 0.32 : w * h > 0.6e6 ? 0.6 : 0.75, tw = Math.max(1, Math.round(w * sc)), th = Math.max(1, Math.round(h * sc));
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

  // A click into Outdoors: when its lead reaches each joint of the window's came (lead-plan.js), once
  // per click (from the plate, once it is in; until then the cover spreads straight out).
  let lead = null;
  function leadTexture(O, far, w, h) {
    const plate = terrain.plateData();
    if (!plate) return null;
    const key = `${Math.round(O[0])} ${Math.round(O[1])} ${Math.round(w)} ${Math.round(h)}`;
    if (lead?.key === key) return lead.t;
    const p = makeLead(plate.km, plate.n, O, far, w, h);
    if (lead) gl.deleteTexture(lead.t);
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, p.w, p.h, 0, gl.RGBA, gl.FLOAT, p.data);
    for (const q of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, q, gl.NEAREST);
    for (const q of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, q, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    lead = { key, t };
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
    terrain.request(w, h);
  });

  // Outdoors → Photography (glsl/fire.js): when the fire reaches each point of the window (fire-plan.js
  // makeIgnition, from Outdoors' plate), once a screen size, worked out in fire-worker.js (here, should
  // the worker be unavailable): half floats, filtered, on unit 5 while the seam draws. Null until it is in.
  const fire = { key: null, t: null, asked: null, worker: undefined };
  function fireUpload(key, w, h, half) {
    if (gl.isContextLost()) return;
    if (fire.t) gl.deleteTexture(fire.t);
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, w, h, 0, gl.RED, gl.HALF_FLOAT, half);
    for (const q of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, q, gl.LINEAR);
    for (const q of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, q, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    fire.key = key; fire.t = t;
  }
  function fireTexture(w, h) {
    const W = Math.round(w), H = Math.round(h), key = `${W} ${H}`;
    if (fire.key === key) return fire.t;
    const plate = terrain.plateData();
    if (!plate || fire.asked === key) return null;
    fire.asked = key;
    if (fire.worker === undefined) {
      try {
        fire.worker = new Worker(new URL('./fire-worker.js', import.meta.url), { type: 'module' });
        fire.worker.onmessage = ({ data }) => {
          if (data.error) { console.warn('The fire\'s plan failed', data.error); return; }
          if (data.key === fire.asked) fireUpload(data.key, data.w, data.h, data.half);
        };
        fire.worker.onerror = () => { fire.worker = null; fire.asked = null; };
      } catch (e) { fire.worker = null; }
    }
    if (fire.worker) { fire.worker.postMessage({ km: plate.km, n: plate.n, W, H, key }); return null; }
    const plan = makeIgnition(plate.km, plate.n, W, H);
    fireUpload(key, plan.w, plan.h, ignitionTexels(plan));
    return fire.t;
  }
  // Asked for ahead, for this screen, once the plate has arrived.
  (function ahead(tries) {
    later(() => { if (!gl.isContextLost() && !fire.asked && !fireTexture(innerWidth, innerHeight) && !fire.asked && tries > 0) setTimeout(() => ahead(tries - 1), 500); });
  })(20);

  // Float targets (Photography → Chess's ink, seen: below).
  const floatOK = !!gl.getExtension('EXT_color_buffer_float'), halfOK = floatOK || !!gl.getExtension('EXT_color_buffer_half_float');
  const floatLinear = !!gl.getExtension('OES_texture_float_linear');
  function floatTarget(tw, th, mip) {
    const full = floatOK && floatLinear;
    const t = texture(tw, th, full ? gl.RGBA32F : gl.RGBA16F, gl.RGBA, full ? gl.FLOAT : gl.HALF_FLOAT);
    if (mip) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.bindTexture(gl.TEXTURE_2D, null); }
    const fb = target(t), ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) { gl.deleteTexture(t); gl.deleteFramebuffer(fb); return null; }
    return { t, fb, tw, th };
  }


  // Photography → Chess, "ink, unmixed" (glsl/unmix.js; unmix-plan.js has the clock). The fluid is baked in the
  // background (ink-sim.js; bake: a few steps a frame), the rain for the screen and the dissolve for the
  // board where its band waits (inkBoard): the board's ink, drawn once for that box (board3d.js renderMask),
  // is both the dissolve's first picture and the mask the cure reads. Each frame of the seam the ink as the
  // screen sees it goes into a float target (UNMIX_SEEN), mipmapped, for unit 8; the board's picture is on
  // 11, its mask on 12.
  const sim = createInkSim(gl, { coarse });
  const inkB = { box: null, W: 0, H: 0, mask: null, key: '' };
  const unmix = { seen: null, key: '' };
  // (Away from the homepage, a click into Chess still builds the board: the tile's size, in the middle.)
  const inkBox = (W, H) => { if (inkB.box) return inkB.box; const w = Math.min(560, W * 0.86), h = w / 1.2; return [(W - w) / 2, (H - h) / 2, w, h]; };
  // Whether the baked fluid is for the board where it now is: a dissolve kept while one for a new box bakes
  // would land its ink where the board was (and the cure reads the new box's mask), so until the new one is
  // in, the seam is the plain one.
  const inkFits = () => {
    const R = sim.ready('rain') && sim.ready('dissolve') && inkB.mask ? sim.run('dissolve') : null;
    return !!R && (!inkB.box || (!!R.box && R.box.every((v, i) => Math.abs(v - inkB.box[i]) < 3)));
  };
  function bake(n, W, H) {
    if (gl.isContextLost() || !W || !H) return;
    const b3 = board3d?.();
    if (b3?.ready()) {
      const box = inkBox(W, H), bw = inkB.box ? inkB.W : W, bh = inkB.box ? inkB.H : H;
      const key = `${box.map(Math.round).join(' ')} ${bw} ${bh}`;
      if (key !== inkB.key) { inkB.key = key; inkB.at = box; inkB.mask = b3.renderMask(box, bw, bh, 1024, Math.round(1024 * bh / bw)); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    }
    // The fluid, for the homepage's seam only.
    if (!inkB.box) return;
    sim.want('rain', { aspect: W / H, widthPx: W });
    if (inkB.mask && inkB.at === inkB.box) sim.want('dissolve', { aspect: inkB.W / inkB.H, W: inkB.W, H: inkB.H, box: inkB.box, mask: inkB.mask });
    sim.work(n);
  }
  function unmixPass(s, f) {
    const [, , w, h] = s.region, P = transitP(s.p ?? 0), R1 = sim.run('rain'), R2 = sim.run('dissolve');
    if (!R1 || !R2) return false;
    const key = `${Math.round(w)} ${Math.round(h)}`;
    if (unmix.key !== key) {
      if (unmix.seen) { gl.deleteTexture(unmix.seen.t); gl.deleteFramebuffer(unmix.seen.fb); }
      unmix.key = key;
      // (The ink is soft: seen at no more than about a megapixel.)
      const sc = Math.min(coarse ? 0.7 : 1, Math.sqrt(1.3e6 / (w * h)));
      unmix.seen = floatTarget(Math.max(2, Math.round(w * sc)), Math.max(2, Math.round(h * sc)), true);
    }
    if (!unmix.seen) return false;
    const { p, U } = programs.unmixSeen, [w1, w2] = weightsAt(P), tr = smoothIn(UNMIX.tremble, P);
    gl.bindFramebuffer(gl.FRAMEBUFFER, unmix.seen.fb);
    gl.viewport(0, 0, unmix.seen.tw, unmix.seen.th);
    gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND);
    gl.useProgram(p);
    const tx = [[gl.TEXTURE_2D_ARRAY, R1.keys, 'uKeys1'], [gl.TEXTURE_2D_ARRAY, R2.keys, 'uKeys2'], [gl.TEXTURE_2D, R1.dye0, 'uDye1'], [gl.TEXTURE_2D, R2.dye0, 'uDye2']];
    tx.forEach(([kind, t, name], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(kind, t); gl.uniform1i(U[name], i); });
    gl.uniform2f(U.uTexel, unmix.seen.tw, unmix.seen.th);
    gl.uniform2f(U.uN, R1.n, R2.n);
    gl.uniform2f(U.uK, rainAt(P) * (R1.n - 1), unmixAt(P) * (R2.n - 1));
    gl.uniform2f(U.uW, w1, w2);
    gl.uniform1f(U.uAbove, R1.above);
    gl.uniform2f(U.uTremble, 0.0028 * Math.sin(Math.PI * tr) * (1 - tr), f.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    tx.forEach(([kind], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(kind, null); });
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, unmix.seen.t);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  }

  let frame = 0;
  // A click into Racing (glsl/dew.js dewClick draws the ground): before the frame, the plan bound and
  // the remnants' gas drawn (once a size, still: the click shows it grown); after it, the drops, the
  // shards and their lines on the click's clocks. False until the plan and the programs are in.
  const clickGas = {};
  function prepareDewClick(s, f) {
    const w = f.vpW, h = f.vpH;
    if (!programs.drops || !programs.shards || !programs.fieldlines || !renderPane || !dew.bind(w, h)) return false;
    gasPass(clickGas, { ...s, region: [0, 0, w, h] }, w, h, SPOTS.still);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, clickGas.gas.t);
    gl.activeTexture(gl.TEXTURE0);
    return true;
  }
  function drawDewClick(s, f) {
    const w = f.vpW, h = f.vpH, st = dew.stats(w, h) ?? {};
    const P = -0.2 + 1.04 * (s.e ?? 0);
    gl.disable(gl.SCISSOR_TEST);
    dew.bind(w, h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, clickGas.gas?.t ?? null);
    gl.activeTexture(gl.TEXTURE0);
    for (const name of ['fieldlines', 'drops', 'shards']) {
      const count = name === 'drops' ? (P > -0.1 && P < CLICK.freeze[0] + CLICK.freeze[1] + CLICK.split + 0.01 ? st.records ?? 0 : 0) : (P > CLICK.freeze[0] && P < 0.86 ? st.shards ?? 0 : 0);
      if (!count) continue;
      const { p, U } = programs[name], def = UNIT_PROGRAMS[name];
      gl.useProgram(p);
      gl.uniform4f(U.uRegion, 0, 0, w, h);
      gl.uniform2f(U.uView, w, h);
      gl.uniform1f(U.uTime, f.time);
      gl.uniform1f(U.uH, (P + 0.2) / 1.4);
      gl.uniform1f(U.uVel, 0);
      gl.uniform4f(U.uGrid, 1, 1, 1, 1);
      gl.uniform1i(U.uFirst, 0);
      gl.uniform1f(U.uClick, 1);
      gl.uniform2f(U.uO, ...(s.origin ?? s.point ?? [w / 2, h / 2]));
      gl.uniform1i(U.uTexA, 0);
      gl.uniform1i(U.uTexB, 1);
      gl.uniform1i(U.uReach, 5);
      if (U.uGas) gl.uniform1i(U.uGas, 3);
      gl.enable(gl.BLEND);
      if (def.blend === 'add') gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, def.verts, count);
    }
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.SCISSOR_TEST);
  }
  // A click into Photography (glsl/fire.js fireCover draws the ground): its embers, lifting from the fire
  // on the cover's clock.
  function drawFireClick(s, f) {
    const w = f.vpW, h = f.vpH, { p, U } = programs.embers, def = UNIT_PROGRAMS.embers, g = grid('embers', w, h, f);
    gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(p);
    gl.uniform4f(U.uRegion, 0, 0, w, h);
    gl.uniform2f(U.uView, w, h);
    gl.uniform1f(U.uTime, f.time);
    gl.uniform1f(U.uH, ((s.e ?? 0) * 1.04 * FIREC.by + 0.2) / 1.4);
    gl.uniform4f(U.uGrid, ...g);
    gl.uniform1i(U.uFirst, 0);
    gl.uniform1f(U.uClick, 1);
    gl.uniform2f(U.uO, ...(s.origin ?? [w / 2, h / 2]));
    gl.uniform1i(U.uReach, 5);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, def.verts, g[0] * g[1]);
    gl.disable(gl.BLEND);
    gl.enable(gl.SCISSOR_TEST);
  }
  return {
    // Racing's plan (names kept from the ice transition this replaced; scene.js and the tools use them).
    iceReady: (w, h) => dew.ready(w, h),
    // Outdoors' plate (its world's heights), on unit 7 once it has arrived.
    plateReady: () => terrain.plateReady(),
    bindIce: (w, h) => dew.bind(w, h),
    iceStats: (w, h) => dew.stats(w, h),
    // The ink's fluid, baked a little at a time (scene.js calls this when no seam is playing), and the box
    // the Chess board waits in during its transition (home.js: CSS px, on a W × H screen).
    bake,
    inkReady: () => inkFits(),
    // The board for a click into Chess: where it stands, and its ink (null until drawn).
    inkClick: (W, H) => (inkB.mask ? { box: inkB.at || inkBox(W, H), mask: inkB.mask } : null),
    inkBoard(box, W, H) { if (box) { inkB.box = box; inkB.W = W; inkB.H = H; } },
    dispose() { sim.dispose(); if (unmix.seen) { gl.deleteTexture(unmix.seen.t); gl.deleteFramebuffer(unmix.seen.fb); } unmix.seen = null; dew.dispose(); terrain.dispose(); fire.worker?.terminate(); if (fire.t) gl.deleteTexture(fire.t); fire.t = fire.key = fire.asked = null; fire.worker = undefined; snaps.forEach(dropSnap); snaps.clear(); plans.forEach(p=>gl.deleteTexture(p.t)); if (lead) gl.deleteTexture(lead.t); lead = null; },
    // What a click's cover reads (opens.js), made once per click from its origin O and far corner:
    // the maze (house), the lead's run (Outdoors); null for processes computed on the fly.
    bakeEffect(style, O, far, w, h) {
      if (style === 0) return mazeTexture(O, w, h);
      if (style === 4) return leadTexture(O, far, w, h);
      return null;
    },
    // Whether this seam is a transit, and ready.
    handles(s) { const K = kindOf(s); return !!K && usable(K); },

    // Before drawing: refresh the snapshots.
    prepare(s, dt, f) {
      const K = kindOf(s);
      if (!K || !usable(K)) return false;
      const [, , w, h] = s.region;
      // The fire needs its plan (until the plate is in, the seam stays plain).
      if (K.id === 'fire') return !!fireTexture(w, h);
      if (K.id === 'unmix') return unmixPass(s, f);
      if (K.live) return true;
      // The dew is seen through drops and frost: its worlds' snapshots can be coarser on big screens.
      const ts = (K.id === 'dew' ? (w > 1800 ? 0.36 : coarse ? 0.45 : 0.5) : coarse || w > 1800 ? 0.5 : 0.6) * Math.max(0.5, f.scale);
      const tw = Math.max(1, Math.round(w * ts)), th = Math.max(1, Math.round(h * ts));
      const snap = snapFor(K, tw, th);
      snap.used = f.now;
      if (K.id === 'dew' && (snap.planMode === undefined || (!snap.planMode && (s.p <= 0 || s.p >= 1)))) snap.planMode = dew.ready(w, h);
      // Which snapshots this frame rendered: both when fresh, else the one whose turn it is.
      const drew = [snap.fresh, snap.fresh];
      if (snap.fresh) {
        renderWorld(s.a, snap.fb[0], tw, th, s.region, s.vel, K.id === 'dew' ? transitP(s.p ?? 0) : false);
        renderWorld(s.b, snap.fb[1], tw, th, s.region, s.vel);
        snap.fresh = false;
      } else if (K.id === 'dew') {
        // The scroll reads only Science's snapshot (the drops' lenses, then its sky once the cloud
        // veils it), and only from the drops' condensing until the cloud has closed (P .33 to .86): at
        // 15 Hz then, half that while the page is held still (the region unchanged). Racing is drawn
        // live (glsl/dew.js dewWinter).
        snap.tick = (snap.tick ?? 0) + 1;
        const at = s.region.join(' '), still = snap.at === at, P = transitP(s.p ?? 0);
        snap.at = at;
        if (P > 0.33 && P < 0.86 && snap.tick % (still ? 8 : 4) === 0) {
          renderWorld(s.a, snap.fb[0], tw, th, s.region, s.vel, P);
          drew[0] = true;
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
      const snap = K.live ? null : snaps.get(K.id);
      if (!snap && !K.live) return false;
      const [, , w, h] = s.region;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, snap?.tex[0] ?? null);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, snap?.tex[1] ?? null);
      const simOn = false;
      const ground = K.id === 'cubes' ? grid('cubes', w, h, f) : K.id === 'fire' ? grid('embers', w, h, f) : null;
      // The seam's plan (Racing's binds its own below).
      const reach = K.plan ? planTexture(K.id, w, h, ground) : K.id === 'fire' ? fireTexture(w, h) : null;
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, reach);
      gl.activeTexture(gl.TEXTURE0);
      // (Outdoors' mountains: their heightfield, on unit 4, in the same flag.)
      const iceReady = K.id === 'dew' ? snap.planMode && dew.bind(w, h) : K.id === 'peaks' ? terrain.bind(w, h) : K.id === 'fire' ? !!reach : false;
      // The drops from the first until the last has split, the shards and their lines until the last has
      // fused (the drops' lenses read Science's snapshot, unit 0, and its gas, unit 3).
      const P = transitP(s.p ?? 0), st = K.id === 'dew' && iceReady && renderPane ? dew.stats(w, h) : null;
      const nRecords = st && P > 0.15 && P < FREEZE.f1 + 0.05 ? st.records ?? 0 : 0;
      const nShards = st && P > FREEZE.f0 - 0.01 && P < 1.1 ? st.shards ?? 0 : 0;
      // The gas, while it shows: drawn now (it needs the plan, bound above), sampled by the ground.
      const gas = K.id === 'dew' && iceReady && renderPane && gasOn(P);
      if (gas) { gasPass(snap, s, w, h, P); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, snap.gas.t); gl.activeTexture(gl.TEXTURE0); }
      // (Chess: the flow pass on unit 8, the tile's pictures on 9 and 10, the view.)
      // (−1: the board is drawn in three dimensions over the seam instead: scene/board3d.js.)
      if (K.id === 'unmix') {
        const b3 = board3d?.(), on = !!(b3?.texture && inkB.mask);
        const bind = [[8, unmix.seen?.t ?? null], [11, on ? b3.texture : null], [12, on ? inkB.mask : null]];
        bind.forEach(([u, t]) => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); });
        gl.activeTexture(gl.TEXTURE0);
        const drewU = drawGround({ ...s, mode: 8, h: s.p ?? 0, iceReady: true, b3box: s.board?.rect ?? inkB.box, b3on: on });
        bind.forEach(([u]) => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, null); });
        gl.activeTexture(gl.TEXTURE0);
        return drewU;
      }
      const drew = drawGround({ ...s, mode: 8, h: s.p ?? 0, grid: ground, simOn, iceReady });
      const unbindGas = () => { if (gas) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0); } };
      if (K.id === 'peaks') terrain.unbind();
      if (!drew || !K.units.length) { unbindGas(); return drew; }
      // The units keep the ground's scissor: while the strip scrolls in or out, they stay in it.
      for (const unit of K.units) {
        // name:pass, where a kind draws in passes (Science's cubes: behind the wind, then in front).
        const [name, pass] = unit.split(':');
        const snow = name === 'drops' || name === 'shards' || name === 'fieldlines';
        if (snow && !(name === 'drops' ? nRecords : nShards)) continue;
        // The fire's units, each only while it shows.
        const fiery = K.id === 'fire';
        if (fiery && !(name === 'embers' ? P > FIRE.ignite[0] + FIRE.release[0] && P < FIRE.out[1] + 0.05
          : name === 'ribbons' ? P > FIRE.ribbon.on[0] && P < FIRE.ribbonOff[1] : P > FIRE.fronts[0][0] && P < FIRE.develop[1])) continue;
        const rib = RIBBONS[coarse ? 1 : 0];
        const prog = programs[name], def = UNIT_PROGRAMS[name];
        const g = name === 'sheets' || snow ? [1, 1, 1, 1] : name === 'cubes' || name === 'embers' ? ground : name === 'ribbons' ? [rib[0], rib[1], 0, 0] : grid(name, w, h, f);
        // The vortex carries its cubes the whole height of the screen, one a cell. The sheets draw a
        // layer at a time, the lowest first.
        const [first, count] = name === 'sheets' ? [0, 1] : snow ? [0, name === 'drops' ? nRecords : nShards] : name === 'flow' ? [0, g[0] * g[1]]
          : name === 'ribbons' ? [0, 2 * g[0] * g[1]] : name === 'cubes' || fiery ? [0, g[0] * g[1]] : span(g, s, f);
        if (!count) continue;
        const { p, U } = prog;
        gl.useProgram(p);
        gl.uniform4f(U.uRegion, ...s.region);
        gl.uniform2f(U.uView, f.vpW, f.vpH);
        gl.uniform1f(U.uTime, f.time);
        gl.uniform1f(U.uH, s.p ?? 0);
        gl.uniform1f(U.uVel, s.vel ?? 0);
        gl.uniform4f(U.uGrid, ...g);
        if (fiery && U.uGrid2) gl.uniform4f(U.uGrid2, ...ground);
        gl.uniform1i(U.uFirst, first);
        if (U.uClick) gl.uniform1f(U.uClick, 0);
        if (U.uPass) gl.uniform1i(U.uPass, pass === 'back' ? 0 : pass === 'front' ? 1 : 2);
        gl.uniform1i(U.uTexA, 0);
        gl.uniform1i(U.uTexB, 1);
        gl.uniform1i(U.uReach, 5);
        if (U.uGas) gl.uniform1i(U.uGas, 3);
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
      unbindGas();
      restore();
      return true;
    },

    // A click into Science: its cubes build the page out of a vortex at the click (opens.js draws the
    // ground). Before the frame: Science's world into a snapshot for the cubes' faces, and the grid
    // the cover and the cubes share (s.grid). False until the programs are in.
    prepareEffect(s, f) {
      if (s.a === 2) return prepareDewClick(s, f);
      if (s.a === 5) return !!programs.embers;
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
      if (s.a === 2) { drawDewClick(s, f); return; }
      if (s.a === 5) { drawFireClick(s, f); return; }
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
