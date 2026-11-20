// The scene: one WebGL2 canvas fixed behind every page, drawing the styles' worlds, the seams where
// two meet and the expand effects from a single fragment shader (glsl/). It outlives router swaps.
//
// Pages register hosts. Every frame the scene calls each host's update(dt), which does the host's
// own DOM work and returns what to draw (or null): a viewport region and the uniforms. Before the
// shader is ready, or without WebGL2, update() still runs and the CSS art stays in place; html.gl
// marks the moment the canvas takes over. Effects draw in front of the page (.scene.is-front) for
// their cover and behind it for their reveal.
import { onTick, motion } from '../lib/util.js';
import { transitP } from '../lerp.js';
import { VERTEX, fragment } from './glsl/index.js';
import { createTransit } from './transit.js';
import { createBoard3D } from './board3d.js';
import { startSlots } from './staunton.js';

export const STYLE_ID = { house: 0, ink: 1, glass: 2, cosmos: 3, folio: 4, darkroom: 5 };
const UNIFORMS = ['uRes', 'uDpr', 'uTime', 'uOrbitSeconds', 'uMode', 'uA', 'uB', 'uH', 'uVel', 'uPointer', 'uPtrOn', 'uCard', 'uCardR',
  'uCardMix', 'uRegion', 'uCrystal', 'uHover', 'uE', 'uPoint', 'uOrigin', 'uView', 'uTexA', 'uTexB', 'uSim', 'uSimOn', 'uGrid',
  'uReach', 'uBaked', 'uIceAtlas', 'uIceSpectrum', 'uIceReady', 'uIceDetail', 'uNoDrops', 'uSkyP', 'uGas', 'uTerrain', 'uTerrainDetail', 'uPlate', 'uPlateOn', 'uFlow', 'uB3', 'uB3Mask', 'uB3Box', 'uB3On', 'uInkAir', 'uBathRoom'];
// The reach takes its time: it grows out to every edge before the new world fills in behind it.
const COVER_MS = 1300, REVEAL_MS = 1200, CLOSE_MS = 260, FOG_MS = 900;
const EFFECT_PX = 6e6;
// Science → Racing's pane is wet glass and frost, soft by nature: on big screens it draws at no more
// than about 2.2 megapixels while its seam is in play.
const DEW_PX = 2.2e6, DEW_PX_BIG = 1.85e6;
const root = document.documentElement;

let instance;
// The scene, or null where WebGL2 is unavailable.
export function getScene() {
  if (instance === undefined) instance = createScene();
  return instance;
}

function createScene() {
  if (typeof WebGL2RenderingContext === 'undefined' || root.classList.contains('no-gl')) { root.classList.add('no-gl'); return null; }
  const canvas = document.createElement('canvas');
  canvas.className = 'scene';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', {
    alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: false, powerPreference: 'high-performance',
  });
  if (!gl) { root.classList.add('no-gl'); return null; }
  // A software renderer has no GPU behind it: the CSS art is the better experience there.
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) { root.classList.add('no-gl'); return null; }
  document.body.prepend(canvas);

  const coarse = matchMedia('(pointer: coarse)').matches;
  const quality = coarse || innerWidth < 900 ? 4 : 5;
  const hosts = new Set();
  let program = null, U = {}, ready = false, drewLast = false, transit = null, board3d = null, inkBoardBox = null;
  let effect = null, stopTick = null;
  let cssW = 0, cssH = 0, dpr = 1, scale = 1, slow = 0, fast = 0, iceDetail = 1, slowShare = 0;
  // The tile is measured in CSS pixels. Follow the canvas's painted box too:
  // a scrollbar can change its width without a window resize at handoff.
  let vpW = canvas.clientWidth, vpH = canvas.clientHeight;
  function measureViewport() { vpW = canvas.clientWidth; vpH = canvas.clientHeight; }
  const surfaceSize = new ResizeObserver(([entry]) => {
    vpW = Math.round(entry.contentRect.width);
    vpH = Math.round(entry.contentRect.height);
  });
  surfaceSize.observe(canvas);
  addEventListener('resize', measureViewport, { passive: true });
  document.addEventListener('visuals:ready', measureViewport);
  let orbitSeconds = 0;
  let time = 7, ptrX = innerWidth * 0.62, ptrY = innerHeight * 0.4, tx = ptrX, ty = ptrY, ptrOn = 0, ptrTarget = 0;

  // ---- program ------------------------------------------------------------------------------
  function compile() {
    return new Promise(resolve => {
      const ext = gl.getExtension('KHR_parallel_shader_compile');
      const make = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const vs = make(gl.VERTEX_SHADER, VERTEX);
      const fs = make(gl.FRAGMENT_SHADER, fragment(quality));
      const p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      const check = () => {
        if (gl.isContextLost()) return resolve(false);
        if (ext && !gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR)) { setTimeout(check, 16); return; }
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
          console.warn('The scene shader did not build; the pages keep their CSS art.', gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(p));
          root.classList.add('no-gl');
          canvas.remove();
          return resolve(false);
        }
        program = p;
        U = Object.fromEntries(UNIFORMS.map(n => [n, gl.getUniformLocation(p, n)]));
        gl.useProgram(p);
        gl.uniform1i(U.uTexA, 0);
        gl.uniform1i(U.uTexB, 1);
        gl.uniform1i(U.uSim, 2);
        gl.uniform1i(U.uReach, 5);
        gl.uniform1i(U.uIceAtlas, 6);
        gl.uniform1i(U.uIceSpectrum, 7);
        gl.uniform1i(U.uGas, 3);
        gl.uniform1i(U.uTerrain, 4);
        gl.uniform1i(U.uTerrainDetail, 6);
        gl.uniform1i(U.uPlate, 7);
        gl.uniform1i(U.uFlow, 8);
        gl.uniform1i(U.uB3, 11);
        gl.uniform1i(U.uB3Mask, 12);
        gl.uniform1i(U.uInkAir, 9);
        gl.uniform1i(U.uBathRoom, 10);
        // Draw once, off screen, so the driver finishes the work before the first visible frame.
        gl.viewport(0, 0, 1, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        ready = true;
        transit = createTransit(gl, { renderWorld, renderPane, coarse, board3d: () => board3d });
        // Chess's board, in three dimensions (board3d.js): the tile's, and its transition's.
        board3d = createBoard3D(gl, { coarse });
        requestAnimationFrame(() => root.classList.add('gl'));
        resolve(true);
      };
      check();
    });
  }

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); ready = false; effect?.abort?.(); transit?.dispose(); transit = null; board3d?.dispose(); board3d = null; root.classList.remove('gl'); });
  canvas.addEventListener('webglcontextrestored', () => { compile(); });

  // ---- input ---------------------------------------------------------------------------------
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    tx = e.clientX; ty = e.clientY; ptrTarget = 1;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { ptrTarget = 0; });
  addEventListener('blur', () => { ptrTarget = 0; });

  // ---- drawing --------------------------------------------------------------------------------
  let dewSeam = false;
  function resize() {
    const w = vpW, h = vpH;
    let d = Math.min(devicePixelRatio || 1, w < 900 ? 1.25 : 1.5) * scale;
    // A click's transition is all motion: on big screens it draws at no more than about 6 megapixels.
    if (effect) d = Math.min(d, Math.sqrt(EFFECT_PX / Math.max(1, w * h)));
    // Very large screens (over 2.5 M CSS px) a little lower still: the dew is right at a frame there.
    if (dewSeam) d = Math.min(d, Math.sqrt((w * h > 2.5e6 ? DEW_PX_BIG : DEW_PX) / Math.max(1, w * h)));
    if (w === cssW && h === cssH && d === dpr) return;
    cssW = w; cssH = h; dpr = d;
    canvas.width = Math.max(1, Math.round(w * d));
    canvas.height = Math.max(1, Math.round(h * d));
  }

  // s.clip, where given, is the part of the region to show (a held seam scrolling in or out).
  function draw(s) {
    const [x, y, w, h] = s.region;
    const [cx, cy, cw, ch] = s.clip || s.region;
    const X0 = Math.max(0, Math.floor(cx * dpr)), Y1 = Math.min(canvas.height, Math.ceil((cy + ch) * dpr));
    const X1 = Math.min(canvas.width, Math.ceil((cx + cw) * dpr)), Y0 = Math.max(0, Math.floor(cy * dpr));
    if (X1 <= X0 || Y1 <= Y0) return false;
    gl.scissor(X0, canvas.height - Y1, X1 - X0, Y1 - Y0);
    const paused = motion.paused;
    gl.uniform1i(U.uMode, s.mode);
    gl.uniform4f(U.uRegion, x, y, w, h);
    gl.uniform1i(U.uA, s.a ?? 0);
    gl.uniform1i(U.uB, s.b ?? 0);
    gl.uniform1f(U.uH, s.h ?? 0);
    gl.uniform1f(U.uVel, paused ? 0 : (s.vel ?? 0));
    if (s.baked) { gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, s.baked); gl.activeTexture(gl.TEXTURE0); }
    gl.uniform1f(U.uBaked, s.baked ? 1 : 0);
    const iceEffect = (s.mode === 2 || s.mode === 3) && s.a === 2 && !s.h;
    const iceReady = iceEffect ? transit?.bindIce(cssW,cssH) : s.iceReady;
    gl.uniform1f(U.uIceReady, iceReady ? 1 : 0);
    gl.uniform1f(U.uPlateOn, transit?.plateReady() ? 1 : 0);
    gl.uniform1f(U.uIceDetail, iceDetail);
    const c = s.card;
    gl.uniform4f(U.uCard, c ? c[0] : 0, c ? c[1] : 0, c ? c[2] : 0, c ? c[3] : 0);
    gl.uniform1f(U.uCardR, s.cardR ?? 24);
    // (Photography → Chess's board, curing out of its ink: glsl/unmix.js.)
    const bb = s.b3box;
    gl.uniform4f(U.uB3Box, bb ? bb[0] : 0, bb ? bb[1] : 0, bb ? bb[2] : 1, bb ? bb[3] : 1);
    gl.uniform1f(U.uB3On, s.b3on ? 1 : 0);
    // (A click into Chess binds the board's picture and its ink itself; a seam's transit has bound them.)
    if (s.b3on && (s.mode === 2 || s.mode === 3)) {
      const ink = transit?.inkClick(cssW, cssH);
      gl.activeTexture(gl.TEXTURE11); gl.bindTexture(gl.TEXTURE_2D, board3d?.texture ?? null);
      gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, ink?.mask ?? null);
      gl.activeTexture(gl.TEXTURE0);
    }
    gl.uniform1f(U.uCardMix, s.cardMix ?? 1);
    const cr = s.crystal;
    gl.uniform3f(U.uCrystal, cr ? cr[0] : 0, cr ? cr[1] : 0, cr ? cr[2] : 0);
    gl.uniform1f(U.uHover, s.hover ?? -1);
    gl.uniform1f(U.uE, s.e ?? 0);
    gl.uniform2f(U.uPoint, s.point ? s.point[0] : cssW / 2, s.point ? s.point[1] : cssH / 2);
    const g = s.grid;
    gl.uniform4f(U.uGrid, g ? g[0] : 1, g ? g[1] : 1, g ? g[2] : 1, g ? g[3] : 1);
    gl.uniform1f(U.uSimOn, s.simOn ? 1 : 0);
    if (iceEffect) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (iceEffect) gl.disable(gl.BLEND);
    return true;
  }

  // A world over a region, into a snapshot (a transit's texture): the same shader, offset so its
  // pixels land where the region is on screen.
  // noDrops: Science → Racing's progress P, for Science without its chrome drops (it draws them live
  // over the snapshot) and without the stars that have condensed by P (they are its drops).
  function renderWorld(style, fb, tw, th, region, vel, noDrops = false) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, tw, th);
    gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(program);
    gl.uniform2f(U.uRes, tw, th);
    gl.uniform1f(U.uDpr, tw / Math.max(1, region[2]));
    gl.uniform2f(U.uOrigin, region[0], region[1]);
    gl.uniform4f(U.uRegion, region[0], region[1], region[2], region[3]);
    gl.uniform1i(U.uMode, 0);
    gl.uniform1i(U.uA, style);
    gl.uniform1f(U.uVel, motion.paused ? 0 : (vel ?? 0));
    gl.uniform4f(U.uCard, 0, 0, 0, 0);
    gl.uniform1f(U.uCardMix, 0);
    const sky = typeof noDrops === 'number';
    if (sky) { gl.uniform1f(U.uNoDrops, 1); gl.uniform1f(U.uSkyP, noDrops + 10); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (sky) { gl.uniform1f(U.uNoDrops, 0); gl.uniform1f(U.uSkyP, 0); }
  }

  // The ground over a seam's region into a texture (a transit's still: Racing's frozen pane).
  function renderPane(s, fb, tw, th) {
    const [x, y, w] = s.region;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, tw, th);
    gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(program);
    gl.uniform2f(U.uRes, tw, th);
    gl.uniform1f(U.uDpr, tw / Math.max(1, w));
    gl.uniform2f(U.uOrigin, x, y);
    draw(s);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform2f(U.uOrigin, 0, 0);
    gl.enable(gl.SCISSOR_TEST);
  }

  function tick(dt) {
    const paused = motion.paused;
    if (!paused) time += dt;
    const k = 1 - Math.exp(-dt / 0.12);
    ptrX += (tx - ptrX) * k; ptrY += (ty - ptrY) * k;
    ptrOn += ((paused ? 0 : ptrTarget) - ptrOn) * (1 - Math.exp(-dt / 0.3));
    const states = [];
    for (const host of hosts) {
      let s = null;
      try { s = host.update(dt); } catch (err) { console.error(err); }
      if (s && s.region) states.push(s);
    }
    if (effect) effect.step(dt);
    if (!ready || gl.isContextLost()) return;
    // Racing's dew is held to its pixel budget whether scrolled through or clicked into.
    // (So does the White Mountains' seam, Racing → Outdoors: a raymarch at every point.)
    dewSeam = effect ? !!effect.racing : states.some(s => s.mode === 6 && s.p > 0 && s.p < 1 && ((s.a === STYLE_ID.cosmos && s.b === STYLE_ID.glass) || (s.a === STYLE_ID.glass && s.b === STYLE_ID.folio)));
    resize();
    const front = effect?.front ? effect.state() : null;
    const behind = !front && effect?.behind ? effect.state() : null;
    const list = front ? [front] : behind ? [behind] : states;
    if (!list.length) {
      if (drewLast) { gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); drewLast = false; }
      return;
    }
    gl.useProgram(program);
    // Time spent reading other sections must not wind up the disc at first entry.
    const orbitVisible = list.some(s => s.mode === 6 && s.a === STYLE_ID.cosmos && s.b === STYLE_ID.glass && transitP(s.p) > .72);
    if (!orbitVisible) orbitSeconds = 0;
    else if (!paused) orbitSeconds += dt;
    gl.uniform1f(U.uOrbitSeconds, orbitSeconds);
    gl.uniform1f(U.uTime, time);
    gl.uniform2f(U.uPointer, ptrX, ptrY);
    gl.uniform1f(U.uPtrOn, ptrOn);
    gl.uniform2f(U.uView, cssW, cssH);
    // Transits first refresh their snapshots off screen. With reduced motion the
    // seams stay the plain, still ones.
    const now = performance.now();
    const info = transit && !paused ? { scale, now, time, orbitSeconds, vpW: cssW, vpH: cssH, ptr: { x: ptrX, y: ptrY, on: ptrOn } } : null;
    if (info) {
      for (const u of [0, 1, 2, 5]) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, null); }
      gl.activeTexture(gl.TEXTURE0);
      for (const s of list) {
        s.transit = s.mode === 6 && s.p !== undefined && transit.prepare(s, dt, info);
        s.revealInk?.(s.transit, s.p);
        // What a click's cover reads (opens.js): from the card's centre while covering, the click while revealing.
        if ((s.mode === 2 || s.mode === 3) && !s.h) {
          const c = s.card, O = s.mode === 2 ? (c ? [c[0] + c[2] / 2, c[1] + c[3] / 2] : [cssW / 2, cssH / 2]) : (s.point || [cssW / 2, cssH / 2]);
          const far = Math.hypot(Math.max(O[0], cssW - O[0]), Math.max(O[1], cssH - O[1])) * 1.02;
          s.baked = transit.bakeEffect(s.a, O, far, cssW, cssH);
          // Science's cover is built by cubes, drawn over it (transit.js drawEffect); Racing's has its
          // drops and shards, about the click.
          if (s.mode === 2 && s.a === STYLE_ID.cosmos) { s.origin = O; s.units = transit.prepareEffect(s, info); }
          if (s.mode === 2 && s.a === STYLE_ID.glass) { s.origin = s.point || O; s.units = transit.prepareEffect(s, info); }
          // Photography's has its embers, lifting from the fire (transit.js).
          if (s.mode === 2 && s.a === STYLE_ID.darkroom) { s.origin = O; s.units = transit.prepareEffect(s, info); }
        }
      }
      transit.sweep(now);
      // The worker's density frames arrive behind the loader in bounded GPU uploads.
      if (inkBoardBox) transit.inkBoard(inkBoardBox, cssW, cssH);
      transit.bake(cssW, cssH);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(program);
    }
    // The seam and the playing tile share a target. While pieces are aloft
    // only the seam has the right set of occupied squares. Updating that
    // target twice would also discard its accumulated antialiasing each frame.
    const inkBoard = list.find(s => s.transit && s.mode === 6 && s.b === STYLE_ID.ink && s.board);
    if (board3d) {
      for (const s of list) {
        if (s.board && (!inkBoard || s === inkBoard)) s.boardOk = board3d.render(s.board.rect, s.board.pos);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(program);
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform2f(U.uOrigin, 0, 0);
    drewLast = false;
    const boards = [];
    for (const s of list) {
      const drew = s.transit ? transit.draw(s, info, drawGround, restoreMain) : draw(s);
      if (drew && s.units) { transit.drawEffect(s, info); restoreMain(); }
      if (drew && s.boardOk && (s.board.alpha ?? 1) > 0) boards.push(s);
      drewLast = drew || drewLast;
    }
    // Chess's board is the band's content, as its card was: over every world, a seam's strip too (with motion
    // paused, the seam into Chess straddles the band's top, where the board is), and not cut to the band's
    // world (that strip's half is not the band's region, though the board's box is in the band).
    if (boards.length && !inkBoard) {
      gl.disable(gl.SCISSOR_TEST);
      for (const s of boards) { board3d.blit(s.board.rect, dpr, canvas.height, s.board.alpha ?? 1); restoreMain(); }
      gl.enable(gl.SCISSOR_TEST);
    }
    adapt(dt, list.some(s => (s.a === 2 && (s.mode === 2 || s.mode === 3)) || (s.b === 2 && s.mode === 6)));
  }

  const drawGround = s => { gl.useProgram(program); return draw(s); };
  const restoreMain = () => gl.useProgram(program);

  // Dynamic resolution: drop the buffer scale when frames run long, recover when they are quick.
  function adapt(dt, racing) {
    if (dt > 0.0205) { slow++; fast = 0; } else if (dt < 0.0178) { fast++; slow = Math.max(0, slow - 1); }
    // Frames just over budget miss every other vsync: no run of slow frames, but half of them late.
    // Their share over the last fifty or so counts too.
    slowShare += ((dt > 0.0205 ? 1 : 0) - slowShare) * 0.02;
    const behind = slow > 24 || slowShare > 0.15;
    // Drop only fine fractures and secondary glints before reducing principal ice quality.
    if (behind && racing && iceDetail > 0) { iceDetail = 0; slow = 0; slowShare = 0; }
    else if (behind && scale > 0.5) { scale = Math.max(0.5, scale - 0.15); slow = 0; slowShare = 0; }
    // A 30 Hz display or browser power policy also produces long frames. Keep the
    // prepared scene alive at the minimum scale until the browser schedules it faster.
    // Quick again for a while: the resolution back first, then the fine detail.
    if (fast > 300 && scale < 1) { scale = Math.min(1, scale + 0.1); fast = 0; }
    else if (fast > 300 && iceDetail < 1) { iceDetail = 1; fast = 0; }
  }

  function wake() { if (!stopTick) stopTick = onTick(tick); }
  function sleepIfIdle() { if (!hosts.size && !effect && stopTick) { stopTick(); stopTick = null; } }

  // ---- effects ----------------------------------------------------------------------------
  // A two-act run in the shape effects.js uses: covered resolves once the cover fills the screen;
  // reveal() uncovers the new page. cancel/fail let go, skip finishes, slow shows a waiting line.
  // kind: a style (its reach), 'close' (back into the homepage's band) or 'fog' (a history step,
  // in the colours of to).
  function open(kind, { rect, point, from, to: dest, cardR = 24 }) {
    const close = kind === 'close', fog = kind === 'fog';
    const style = STYLE_ID[close ? from : fog ? dest : kind] ?? 0;
    const vw = innerWidth, vh = innerHeight;
    const card = rect ? [rect.left, rect.top, rect.width, rect.height] : null;
    const at = point ? [point.x, point.y] : [vw / 2, vh / 2];
    const racing = style === STYLE_ID.glass && !close && !fog;
    let revealing = false, heroStarted = false, revealMain = null, revealRect = null, headingRect = null;
    const heroReveal = () => { if (!heroStarted) { heroStarted=true; document.dispatchEvent(new CustomEvent('xp:reveal')); } };
    let e = 0, goal = 1, ms = close ? CLOSE_MS : fog ? FOG_MS : COVER_MS, done = null, dead = false, wait = null;
    const run = {
      front: true, behind: false, racing,
      state() {
        const region = [0, 0, vpW, vpH];
        const h = fog ? 1 : 0;
        // (Into Chess: the board it builds, where it stands, and its ink: glsl/unmix.js umClickCover.)
        const ink = style === STYLE_ID.ink && !close && !fog && board3d?.ready() ? transit?.inkClick(vpW, vpH) : null;
        const b3 = ink ? { board: { rect: ink.box, pos: { slots: startSlots(), marks: null }, alpha: 0 }, b3box: ink.box, b3on: true } : null;
        if (run.front) return { region, mode: revealing ? 3 : close ? 4 : 2, a: style, e, h, card, cardR, point: at, ...b3 };
        return { region, mode: 3, a: style, e, h, point: at, ...b3 };
      },
      step(dt) {
        if (dead || e === goal) return;
        e = goal > e ? Math.min(goal, e + (dt * 1000) / ms) : Math.max(goal, e - (dt * 1000) / ms);
        if (racing && revealing) {
          const far=Math.hypot(Math.max(at[0],vw-at[0]),Math.max(at[1],vh-at[1]));
          // Conservative boundary: the complete circular DOM aperture is already fully clear,
          // including the shader's bounded spatial variation. No layout reads during playback.
          const radius=Math.max(0,(.36*e-.086)/.18)*far;
          revealMain?.style.setProperty('--ice-radius', `${radius}px`);
          if (!heroStarted) {
            const r=headingRect;
            const radial=r ? Math.max(...[[r.left,r.top],[r.right,r.top],[r.left,r.bottom],[r.right,r.bottom]].map(p=>Math.hypot(p[0]-at[0],p[1]-at[1])/far)) : 1;
            if (.36*e >= .18*radial+.086) heroReveal();
          }
        }
        if (e === goal) { const d = done; done = null; d?.(); }
      },
    };
    const to = (g, dur) => new Promise(r => { goal = g; ms = dur; if (e === g) r(); else done = r; });
    const end = () => {
      if (dead) return;
      dead = true;
      const pending = done; done = null; pending?.();
      wait?.remove();
      for (const p of ['--ice-radius','--ice-x','--ice-y']) revealMain?.style.removeProperty(p);
      if (effect === run) { effect = null; canvas.classList.remove('is-front'); delete root.dataset.xpReveal; }
      sleepIfIdle();
    };
    const letGo = async () => {
      if (dead) return;
      if (racing) { const pending=done; done=null; pending?.(); }
      run.front = true;
      await to(0, 200);
      end();
    };
    run.abort = end;
    if (effect) effect.abort?.();
    effect = run;
    canvas.classList.add('is-front');
    wake();
    const covered = (ready ? to(1, ms) : Promise.resolve()).then(() => !dead);
    return {
      covered,
      async reveal(info = {}) {
        if (dead) { if (racing) heroReveal(); return; }
        await covered;
        if (dead) return;
        wait?.remove();
        if (!racing) { canvas.classList.remove('is-front'); heroReveal(); }
        if (close) {
          run.front = false;
          end();
          await flipIn(info.card?.());
          return;
        }
        root.dataset.xpReveal = racing ? 'ice' : '';
        if (racing) {
          revealMain=document.querySelector('main');revealRect=revealMain?.getBoundingClientRect();
          headingRect=document.querySelector('[data-hero] h1')?.getBoundingClientRect();
          revealMain?.style.setProperty('--ice-x',`${at[0]-(revealRect?.left||0)}px`);
          revealMain?.style.setProperty('--ice-y',`${at[1]-(revealRect?.top||0)}px`);
          revealMain?.style.setProperty('--ice-radius','0px');
        }
        revealing = true;
        run.front = racing; run.behind = !racing;
        e = 0;
        await to(1, fog ? FOG_MS : REVEAL_MS);
        heroReveal();
        end();
      },
      skip() { if (!dead) { if (revealing) heroReveal(); e = goal; done?.(); done = null; } },
      cancel() { letGo(); },
      fail() { letGo(); },
      slow() {
        if (dead || wait) return;
        wait = document.createElement('div');
        wait.className = 'xp-wait xp-wait--scene';
        document.body.append(wait);
      },
      cancelNow: end,
    };
  }

  // Back on the homepage the band's piece grows back down from the full screen into its place.
  function flipIn(el) {
    if (!el) return Promise.resolve();
    const r = el.getBoundingClientRect();
    if (r.width < 2) return Promise.resolve();
    const sx = innerWidth / r.width, sy = innerHeight / r.height;
    const dx = innerWidth / 2 - (r.left + r.width / 2), dy = innerHeight / 2 - (r.top + r.height / 2);
    const a = el.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.2 },
      { transform: 'none', opacity: 1 },
    ], { duration: 620, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', composite: 'replace' });
    return a.finished.catch(() => {});
  }

  const api = {
    get ready() { return ready; },
    compiled: null,
    loadingStatus: () => ready && transit
      ? transit.loadingStatus(vpW, vpH, document.body.dataset.page === 'home')
      : { stage: 'light', ready: false, failed: gl.isContextLost() || root.classList.contains('no-gl') },
    add(host) { hosts.add(host); wake(); return () => { hosts.delete(host); sleepIfIdle(); }; },
    open,
    iceReady: () => !!transit?.iceReady(vpW,vpH),
    iceClickReady: () => !!transit?.iceClickReady(vpW,vpH),
    iceStats: () => ({ ...transit?.iceStats(vpW,vpH), renderScale: scale, detail: iceDetail, fallback: !ready }),
    get pointer() { return { x: ptrX, y: ptrY, on: ptrOn }; },
    // Whether Chess's board is drawn by the scene (its tile then gives way to it).
    boardDrawn: () => !!board3d?.drawn,
    // Where Chess's board waits during its transition (CSS px [x, y, w, h] on the screen): its fluid is baked for
    // it; and the scroll at which that transition begins (document px), so the bake is in by then.
    setInkBoard(box) { inkBoardBox = box; },
    // Whether that fluid is baked (for the tools).
    inkReady: () => !!transit?.inkReady(),
  };
  // Compile once the page has painted.
  api.compiled = new Promise(r => requestAnimationFrame(() => setTimeout(() => compile().then(r), 0)));
  return api;
}
