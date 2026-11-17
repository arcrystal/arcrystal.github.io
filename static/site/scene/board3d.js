// Chess in three dimensions, on the scene's canvas (glsl/board3d.js shades it; staunton.js gives the shapes,
// the position and the camera). The homepage's Chess tile draws its board with it, and so does the
// transition that builds that board, so the two are the same picture.
//   The picture is kept in a target of its own, at about the device's resolution for the box it fills,
// and averaged over jittered passes while nothing on it moves (each pass one sample a pixel: the average
// is antialiased and its soft shadows smooth). When a piece moves, only the rectangle it sweeps (with its
// shadow and its reflection) is drawn again, at one sample, and refined once it is still. Idle, the board
// costs one textured rectangle a frame.
//   The profiles' fields are worked out from the silhouettes a layer per idle moment, and the programs
// compile off the main thread where the driver allows; until both are in, ready() is false and the page's
// SVG board stays.
import { VERTEX } from './glsl/index.js';
import { BOARD3D_FS, BOARD3D_BLIT } from './glsl/board3d.js';
import { LAYERS, PROF, HEAD, bodyOf, profileField, headField, frameCamera, project, TALL, TYPES, startSlots, MARGIN } from './staunton.js';

const SAMPLES = [16, 8];       // passes averaged while still (fine pointer, touch)
const PIXELS = [1.4e6, 0.65e6];  // the target's most pixels
const LOOSE = 6;

const UNITS = { prof: 14, head: 15, tex: 13 };
// Halton points for the passes' places in their pixels.
const halton = (i, b) => { let f = 1, r = 0; for (i += 1; i > 0; i = Math.floor(i / b)) { f /= b; r += f * (i % b); } return r; };

export function createBoard3D(gl, { coarse = false } = {}) {
  const ext = gl.getExtension('KHR_parallel_shader_compile');
  const half = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
  let dead = false, march = null, blitP = null, profTex = null, headTex = null, drawn = false;

  // ---- programs -------------------------------------------------------------------------------------
  function locations(p) {
    const U = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ''); U[name] = gl.getUniformLocation(p, name); }
    return U;
  }
  function build(fs, done) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const v = mk(gl.VERTEX_SHADER, VERTEX), f = mk(gl.FRAGMENT_SHADER, fs), p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    const check = () => {
      if (dead || gl.isContextLost()) return;
      if (ext && !gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR)) { setTimeout(check, 40); return; }
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('The chess board did not build; the tile keeps its drawing.', gl.getShaderInfoLog(f) || gl.getProgramInfoLog(p)); return; }
      gl.deleteShader(v); gl.deleteShader(f);
      done({ p, U: locations(p) });
    };
    check();
  }
  if (half) {
    build(BOARD3D_FS, P => { march = P; });
    build(BOARD3D_BLIT, P => { blitP = P; });
  }

  // ---- the profiles ---------------------------------------------------------------------------------
  const later = window.requestIdleCallback ? cb => requestIdleCallback(cb, { timeout: 900 }) : cb => setTimeout(cb, 30);
  const fields = [];
  function buildNext() {
    if (dead || gl.isContextLost()) return;
    if (fields.length < LAYERS.length) { fields.push(profileField(bodyOf(LAYERS[fields.length]))); later(buildNext); return; }
    const all = new Float32Array(PROF.w * PROF.h * LAYERS.length);
    fields.forEach((f, i) => all.set(f, i * PROF.w * PROF.h));
    profTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + UNITS.prof);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, profTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R16F, PROF.w, PROF.h, LAYERS.length, 0, gl.RED, gl.FLOAT, all);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D_ARRAY, k, v);
    headTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + UNITS.head);
    gl.bindTexture(gl.TEXTURE_2D, headTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, HEAD.w, HEAD.h, 0, gl.RED, gl.FLOAT, headField());
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.activeTexture(gl.TEXTURE0);
  }
  if (half) later(buildNext);

  // ---- the target -----------------------------------------------------------------------------------
  // tex/fb: the averaged picture; w, h its pixels; cam the camera that frames it; n the passes averaged
  // over the rectangle being refined (refine), or done.
  const T = { tex: null, fb: null, w: 0, h: 0, cam: null, n: 0, refine: null, key: '' };
  const M = { tex: null, fb: null, w: 0, h: 0, cam: null };   // the board's ink, for the fluid
  function size(w, h) {
    if (T.tex) { gl.deleteTexture(T.tex); gl.deleteFramebuffer(T.fb); }
    T.tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + UNITS.tex);
    gl.bindTexture(gl.TEXTURE_2D, T.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    T.fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // (The camera frames the board in the box; the target sees the margin round it too.)
    T.w = w; T.h = h; T.cam = frameCamera(w / h); T.view = [1 + 2 * MARGIN, 1 + 2 * MARGIN, 0, 0]; T.n = 0; T.refine = [0, 0, w, h]; drawn = false;
    return ok;
  }

  // ---- the pieces -----------------------------------------------------------------------------------
  const P = new Float32Array(128), Q = new Float32Array(128), occ = new Int32Array(64), looseIdx = new Int32Array(LOOSE);
  let nLoose = 0, prev = null, marks = [-1, -1, -1, -1], markAge = [0, 1], prevMarks = '';
  const near = (a, b) => Math.abs(a - b) < 1e-4;
  // The rectangle (target px, from the lower left) a piece covers: itself, its shadow, its reflection.
  function bounds(s) {
    if (!s || !T.cam) return null;
    const top = TALL[TYPES[s.type]] + (s.lift || 0) + 0.06, r = 0.42 + 0.35 * Math.min(s.melt || 0, 1);
    const pts = [];
    for (const dx of [-r, r]) for (const dz of [-r, r]) for (const y of [-top, -0.01, top]) pts.push([s.x + dx, y, s.z + dz]);
    // (its shadow falls away from the key light: glsl/board3d.js LKEY)
    pts.push([s.x + 0.575 * top + 0.4, 0, s.z - 0.55 * top - 0.4]);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) {
      const [u, v] = project(T.cam, p), X = ((u - T.view[2]) / T.view[0] * 0.5 + 0.5) * T.w, Y = ((v - T.view[3]) / T.view[1] * 0.5 + 0.5) * T.h;
      x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
    }
    return [x0 - 3, y0 - 3, x1 + 3, y1 + 3];
  }
  const squareBox = (file, row) => bounds({ type: 5, x: file - 3.5, z: row - 3.5, lift: 0, melt: 1.2 });
  const union = (a, b) => (!a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  // The shader's arrays for a set of slots.
  function fill(slots) {
    occ.fill(-1); nLoose = 0;
    for (let i = 0; i < 32; i++) {
      const s = slots[i], gone = !s || s.melt >= 2;
      P[4 * i] = s ? s.x : 0; P[4 * i + 1] = s ? s.z : 0; P[4 * i + 2] = gone ? -1 : s.type + (s.black ? 8 : 0); P[4 * i + 3] = s ? s.lift : 0;
      Q[4 * i] = s ? s.melt : 0; Q[4 * i + 1] = s ? s.spin : 0;
      if (gone) continue;
      const f = s.x + 3.5, r = s.z + 3.5;
      if (near(f, Math.round(f)) && near(r, Math.round(r)) && !s.lift) occ[Math.round(f) + 8 * Math.round(r)] = i;
      else if (nLoose < LOOSE) looseIdx[nLoose++] = i;
    }
  }
  // Takes a position (staunton.js scotchAt's { slots, marks }); returns the rectangle it changed, if any.
  function setPosition(pos) {
    const slots = pos.slots;
    let dirty = null;
    for (let i = 0; i < 32; i++) {
      const s = slots[i], p = prev?.[i];
      if (!p || !s || p.x !== s.x || p.z !== s.z || p.lift !== s.lift || p.melt !== s.melt || p.spin !== s.spin || p.type !== s.type) {
        if (p) dirty = union(dirty, bounds(p));
        if (s) dirty = union(dirty, bounds(s));
      }
    }
    fill(slots);
    prev = slots.map(s => (s ? { ...s } : null));
    // The last move's squares (rows from the far rank, as the shader counts them).
    const m = pos.marks, key = m ? `${m.from}${m.to}` : '';
    const row = sq => 8 - Number(sq[1]), file = sq => 'abcdefgh'.indexOf(sq[0]);
    const wash = m ? Math.min(1, m.age / 220) * (m.age > 5e5 ? Math.max(0, 1 - (m.age - 1e6) / 400) : 1) : 0, drop = m ? Math.min(1, m.age / 1100) : 1;
    if (key !== prevMarks || Math.abs(wash - markAge[0]) > 1e-3 || Math.abs(drop - markAge[1]) > 1e-3) {
      for (const k of [key, prevMarks]) if (k) { dirty = union(dirty, squareBox(file(k.slice(0, 2)), row(k.slice(0, 2)))); dirty = union(dirty, squareBox(file(k.slice(2, 4)), row(k.slice(2, 4)))); }
    }
    prevMarks = key;
    marks = m ? [file(m.from), row(m.from), file(m.to), row(m.to)] : [-1, -1, -1, -1];
    markAge = [wash, drop];
    return dirty;
  }

  // ---- drawing ----------------------------------------------------------------------------------------
  const outer = b => [b[0] - b[2] * MARGIN, b[1] - b[3] * MARGIN, b[2] * (1 + 2 * MARGIN), b[3] * (1 + 2 * MARGIN)];
  function pass(rect, n, weight, to = T, mode = 0) {
    const { p, U } = march;
    gl.bindFramebuffer(gl.FRAMEBUFFER, to.fb);
    gl.viewport(0, 0, to.w, to.h);
    gl.enable(gl.SCISSOR_TEST);
    const x0 = Math.max(0, Math.floor(rect[0])), y0 = Math.max(0, Math.floor(rect[1])), x1 = Math.min(to.w, Math.ceil(rect[2])), y1 = Math.min(to.h, Math.ceil(rect[3]));
    if (x1 <= x0 || y1 <= y0) return;
    gl.scissor(x0, y0, x1 - x0, y1 - y0);
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0 + UNITS.prof); gl.bindTexture(gl.TEXTURE_2D_ARRAY, profTex);
    gl.activeTexture(gl.TEXTURE0 + UNITS.head); gl.bindTexture(gl.TEXTURE_2D, headTex);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(U.uProf, UNITS.prof);
    gl.uniform1i(U.uHead, UNITS.head);
    gl.uniform2f(U.uSize, to.w, to.h);
    gl.uniform2f(U.uJit, n ? halton(n, 2) - 0.5 : 0, n ? halton(n, 3) - 0.5 : 0);
    const c = to.cam;
    gl.uniform3fv(U.uEye, c.eye); gl.uniform3fv(U.uRight, c.right); gl.uniform3fv(U.uUp, c.up); gl.uniform3fv(U.uFwd, c.fwd);
    gl.uniform2f(U.uTan, c.tanY * c.aspect, c.tanY);
    gl.uniform4f(U.uView, ...to.view);
    gl.uniform4fv(U.uP, P); gl.uniform4fv(U.uQ, Q);
    gl.uniform1iv(U.uOcc, occ);
    gl.uniform1iv(U.uLoose, looseIdx);
    gl.uniform1i(U.uNLoose, nLoose);
    gl.uniform4f(U.uMarks, ...marks);
    gl.uniform2f(U.uMarkAge, ...markAge);
    gl.uniform1i(U.uMode, mode);
    if (weight < 1) {
      gl.enable(gl.BLEND);
      gl.blendColor(0, 0, 0, weight);
      gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  return {
    ready: () => !dead && !!march && !!blitP && !!profTex,
    // Whether a picture has been made (for the tile to give way to it).
    get drawn() { return drawn; },
    get texture() { return T.tex; },
    get camera() { return T.cam; },
    // Before the frame: brings the picture for a box (CSS px [x, y, w, h]) up to date with a position, a
    // pass at most. Leaves the canvas's framebuffer bound and the scissor test on.
    render(box, pos, deviceDpr = devicePixelRatio || 1) {
      if (!this.ready() || !box || box[2] < 8 || box[3] < 8) return false;
      const rect = outer(box);
      const want = Math.min(deviceDpr, 2), cap = PIXELS[coarse ? 1 : 0], k = Math.min(want, Math.sqrt(cap / (rect[2] * rect[3])));
      const w = Math.max(8, Math.round(rect[2] * k)), h = Math.max(8, Math.round(rect[3] * k));
      if (w !== T.w || h !== T.h) { if (!size(w, h)) return false; prev = null; }
      const dirty = setPosition(pos || { slots: [] });
      const N = SAMPLES[coarse ? 1 : 0];
      if (T.n === 0 && T.refine) { pass(T.refine, 0, 1); T.n = 1; }
      else if (dirty) { pass(dirty, 0, 1); T.refine = union(T.refine, dirty); T.n = 1; }
      else if (T.refine && T.n < N) { pass(T.refine, T.n, 1 / (T.n + 1)); T.n++; if (T.n >= N) T.refine = null; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      drawn = true;
      return true;
    },
    // The picture over the canvas, where the box is (CSS px), inside the scissor already set.
    blit(box, dpr, canvasH, alpha = 1) {
      if (!T.tex || !blitP) return;
      const rect = outer(box);
      const { p, U } = blitP;
      gl.useProgram(p);
      gl.activeTexture(gl.TEXTURE0 + UNITS.tex); gl.bindTexture(gl.TEXTURE_2D, T.tex); gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(U.uTex, UNITS.tex);
      gl.uniform4f(U.uRect, rect[0] * dpr, canvasH - (rect[1] + rect[3]) * dpr, rect[2] * dpr, rect[3] * dpr);
      gl.uniform1f(U.uAlpha, alpha);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND);
    },
    // The board's ink at the start (black pigment R, white G: glsl/board3d.js uMode 1) over a whole screen
    // (W × H CSS px), the board where its box is (CSS px [x, y, w, h]), seen by the box's own camera: the
    // picture the fluid dissolves (ink-sim.js). w × h pixels. One pass; the tile's own picture is left as it was.
    renderMask(box, W, H, w, h) {
      if (!this.ready()) return null;
      if (!M.tex || M.w !== w || M.h !== h) {
        if (M.tex) { gl.deleteTexture(M.tex); gl.deleteFramebuffer(M.fb); }
        M.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, M.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        gl.bindTexture(gl.TEXTURE_2D, null);
        M.fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, M.fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, M.tex, 0);
        M.w = w; M.h = h;
      }
      M.cam = frameCamera(box[2] / box[3]);
      const sx = W / box[2], sy = H / box[3], cx = (box[0] + box[2] / 2) / W * 2 - 1, cy = 1 - (box[1] + box[3] / 2) / H * 2;
      M.view = [sx, sy, -cx * sx, -cy * sy];
      const keep = [P.slice(), Q.slice(), occ.slice(), looseIdx.slice(), nLoose, marks, markAge];
      fill(startSlots()); marks = [-1, -1, -1, -1]; markAge = [0, 1];
      pass([0, 0, w, h], 0, 1, M, 1);
      P.set(keep[0]); Q.set(keep[1]); occ.set(keep[2]); looseIdx.set(keep[3]); [, , , , nLoose, marks, markAge] = keep;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return M.tex;
    },
    dispose() {
      dead = true;
      if (M.tex) { gl.deleteTexture(M.tex); gl.deleteFramebuffer(M.fb); M.tex = M.fb = null; }
      for (const t of [profTex, headTex, T.tex]) if (t) gl.deleteTexture(t);
      if (T.fb) gl.deleteFramebuffer(T.fb);
      for (const P_ of [march, blitP]) if (P_) gl.deleteProgram(P_.p);
      march = blitP = profTex = headTex = T.tex = T.fb = null;
    },
  };
}
