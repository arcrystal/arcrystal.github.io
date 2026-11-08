// The scene: one WebGL2 canvas fixed behind every page, drawing the styles' worlds, the seams where
// two meet and the expand effects from a single fragment shader (glsl/). It outlives router swaps.
//
// Pages register hosts. Every frame the scene calls each host's update(dt), which does the host's
// own DOM work and returns what to draw (or null): a viewport region and the uniforms. Before the
// shader is ready, or without WebGL2, update() still runs and the CSS art stays in place; html.gl
// marks the moment the canvas takes over. Effects draw in front of the page (.scene.is-front) for
// their cover and behind it for their reveal.
import { onTick, motion } from '../lib/util.js';
import { VERTEX, fragment } from './glsl/index.js';
import { createTransit } from './transit.js';

export const STYLE_ID = { house: 0, ink: 1, glass: 2, cosmos: 3, folio: 4, darkroom: 5 };
const UNIFORMS = ['uRes', 'uDpr', 'uTime', 'uMode', 'uA', 'uB', 'uH', 'uVel', 'uPointer', 'uPtrOn', 'uCard', 'uCardR',
  'uCardMix', 'uRegion', 'uCrystal', 'uHover', 'uE', 'uPoint', 'uOrigin', 'uView', 'uTexA', 'uTexB', 'uSim', 'uSimOn', 'uGrid',
  'uReach', 'uBaked'];
// The reach takes its time: it grows out to every edge before the new world fills in behind it.
const COVER_MS = 1300, REVEAL_MS = 1200, CLOSE_MS = 260, FOG_MS = 900;
const EFFECT_PX = 6e6;
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
  let program = null, U = {}, ready = false, drewLast = false, transit = null;
  let effect = null, stopTick = null;
  let cssW = 0, cssH = 0, dpr = 1, scale = 1, slow = 0, fast = 0;
  // The viewport, cached: reading innerWidth after the hosts have written styles would force a layout.
  let vpW = innerWidth, vpH = innerHeight;
  addEventListener('resize', () => { vpW = innerWidth; vpH = innerHeight; }, { passive: true });
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
        // Draw once, off screen, so the driver finishes the work before the first visible frame.
        gl.viewport(0, 0, 1, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        ready = true;
        transit = createTransit(gl, { renderWorld, coarse });
        requestAnimationFrame(() => root.classList.add('gl'));
        resolve(true);
      };
      check();
    });
  }

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); ready = false; transit = null; root.classList.remove('gl'); });
  canvas.addEventListener('webglcontextrestored', () => { compile(); });

  // ---- input ---------------------------------------------------------------------------------
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    tx = e.clientX; ty = e.clientY; ptrTarget = 1;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { ptrTarget = 0; });
  addEventListener('blur', () => { ptrTarget = 0; });

  // ---- drawing --------------------------------------------------------------------------------
  function resize() {
    const w = vpW, h = vpH;
    let d = Math.min(devicePixelRatio || 1, w < 900 ? 1.25 : 1.5) * scale;
    // A click's transition is all motion: on big screens it draws at no more than about 6 megapixels.
    if (effect) d = Math.min(d, Math.sqrt(EFFECT_PX / Math.max(1, w * h)));
    if (w === cssW && h === cssH && d === dpr) return;
    cssW = w; cssH = h; dpr = d;
    canvas.width = Math.max(1, Math.round(w * d));
    canvas.height = Math.max(1, Math.round(h * d));
  }

  function draw(s) {
    const [x, y, w, h] = s.region;
    const X0 = Math.max(0, Math.floor(x * dpr)), Y1 = Math.min(canvas.height, Math.ceil((y + h) * dpr));
    const X1 = Math.min(canvas.width, Math.ceil((x + w) * dpr)), Y0 = Math.max(0, Math.floor(y * dpr));
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
    const c = s.card;
    gl.uniform4f(U.uCard, c ? c[0] : 0, c ? c[1] : 0, c ? c[2] : 0, c ? c[3] : 0);
    gl.uniform1f(U.uCardR, s.cardR ?? 24);
    gl.uniform1f(U.uCardMix, s.cardMix ?? 1);
    const cr = s.crystal;
    gl.uniform3f(U.uCrystal, cr ? cr[0] : 0, cr ? cr[1] : 0, cr ? cr[2] : 0);
    gl.uniform1f(U.uHover, s.hover ?? -1);
    gl.uniform1f(U.uE, s.e ?? 0);
    gl.uniform2f(U.uPoint, s.point ? s.point[0] : cssW / 2, s.point ? s.point[1] : cssH / 2);
    const g = s.grid;
    gl.uniform4f(U.uGrid, g ? g[0] : 1, g ? g[1] : 1, g ? g[2] : 1, g ? g[3] : 1);
    gl.uniform1f(U.uSimOn, s.simOn ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  }

  // A world over a region, into a snapshot (a transit's texture): the same shader, offset so its
  // pixels land where the region is on screen.
  function renderWorld(style, fb, tw, th, region, vel) {
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);
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
    resize();
    const front = effect?.front ? effect.state() : null;
    const behind = !front && effect?.behind ? effect.state() : null;
    const list = front ? [front] : behind ? [behind] : states;
    if (!list.length) {
      if (drewLast) { gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); drewLast = false; }
      return;
    }
    gl.useProgram(program);
    gl.uniform1f(U.uTime, time);
    gl.uniform2f(U.uPointer, ptrX, ptrY);
    gl.uniform1f(U.uPtrOn, ptrOn);
    gl.uniform2f(U.uView, cssW, cssH);
    // Transits first draw their snapshots and step their fluid, off screen. With reduced motion the
    // seams stay the plain, still ones.
    const now = performance.now();
    const info = transit && !paused ? { scale, now, time, vpW: cssW, vpH: cssH, ptr: { x: ptrX, y: ptrY, on: ptrOn } } : null;
    if (info) {
      for (const u of [0, 1, 2, 5]) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, null); }
      gl.activeTexture(gl.TEXTURE0);
      for (const s of list) {
        s.transit = s.mode === 6 && s.p !== undefined && transit.prepare(s, dt, info);
        // A click's reach (opens.js): from the card's centre while covering, the click while revealing.
        if ((s.mode === 2 || s.mode === 3) && !s.h) {
          const c = s.card, O = s.mode === 2 ? (c ? [c[0] + c[2] / 2, c[1] + c[3] / 2] : [cssW / 2, cssH / 2]) : (s.point || [cssW / 2, cssH / 2]);
          const far = Math.hypot(Math.max(O[0], cssW - O[0]), Math.max(O[1], cssH - O[1])) * 1.02;
          s.baked = transit.bakeEffect(s.a, O, far, cssW, cssH);
        }
      }
      transit.sweep(now);
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
    for (const s of list) {
      const drew = s.transit ? transit.draw(s, info, drawGround, restoreMain) : draw(s);
      drewLast = drew || drewLast;
    }
    adapt(dt);
  }

  const drawGround = s => { gl.useProgram(program); return draw(s); };
  const restoreMain = () => gl.useProgram(program);

  // Dynamic resolution: drop the buffer scale when frames run long, recover when they are quick.
  function adapt(dt) {
    if (dt > 0.0205) { slow++; fast = 0; } else if (dt < 0.0178) { fast++; slow = Math.max(0, slow - 1); }
    if (slow > 24 && scale > 0.5) { scale = Math.max(0.5, scale - 0.15); slow = 0; }
    // Still slow at half resolution: hand the pages back to their CSS art.
    if (slow > 90 && scale <= 0.5) giveUp();
    if (fast > 300 && scale < 1) { scale = Math.min(1, scale + 0.1); fast = 0; }
  }

  function giveUp() {
    ready = false;
    root.classList.remove('gl');
    root.classList.add('no-gl');
    canvas.remove();
    console.info('The scene runs too slowly here; the pages keep their CSS art.');
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
    let e = 0, goal = 1, ms = close ? CLOSE_MS : fog ? FOG_MS : COVER_MS, done = null, dead = false, wait = null;
    const run = {
      front: true, behind: false,
      state() {
        const region = [0, 0, vpW, vpH];
        const h = fog ? 1 : 0;
        if (run.front) return { region, mode: close ? 4 : 2, a: style, e, h, card, cardR, point: at };
        return { region, mode: 3, a: style, e, h, point: at };
      },
      step(dt) {
        if (dead || e === goal) return;
        e = goal > e ? Math.min(goal, e + (dt * 1000) / ms) : Math.max(goal, e - (dt * 1000) / ms);
        if (e === goal) { const d = done; done = null; d?.(); }
      },
    };
    const to = (g, dur) => new Promise(r => { goal = g; ms = dur; if (e === g) r(); else done = r; });
    const end = () => {
      dead = true;
      wait?.remove();
      if (effect === run) { effect = null; canvas.classList.remove('is-front'); delete root.dataset.xpReveal; }
      sleepIfIdle();
    };
    const letGo = async () => {
      if (dead) return;
      run.front = true;
      await to(0, 200);
      end();
    };
    if (effect) effect.cancel?.();
    effect = run;
    canvas.classList.add('is-front');
    wake();
    const covered = (ready ? to(1, ms) : Promise.resolve()).then(() => !dead);
    return {
      covered,
      async reveal(info = {}) {
        if (dead) return;
        await covered;
        if (dead) return;
        wait?.remove();
        canvas.classList.remove('is-front');
        document.dispatchEvent(new CustomEvent('xp:reveal'));
        if (close) {
          run.front = false;
          end();
          await flipIn(info.card?.());
          return;
        }
        root.dataset.xpReveal = '';
        run.front = false; run.behind = true;
        e = 0;
        await to(1, fog ? FOG_MS : REVEAL_MS);
        end();
      },
      skip() { if (!dead) { e = goal; done?.(); done = null; } },
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
    add(host) { hosts.add(host); wake(); return () => { hosts.delete(host); sleepIfIdle(); }; },
    open,
    get pointer() { return { x: ptrX, y: ptrY, on: ptrOn }; },
  };
  // Compile once the page has painted.
  api.compiled = new Promise(r => requestAnimationFrame(() => setTimeout(() => compile().then(r), 0)));
  return api;
}
