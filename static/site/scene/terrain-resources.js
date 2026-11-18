// The White Mountains' heightfield for Racing → Outdoors (glsl/peaks.js): built once in
// terrain-worker.js while the page is idle, uploaded a few rows at a time, then kept; and the paint's
// plan for the screen's shape (paint-plan.js), made by the same worker. Filtered
// (RGBA16F, linear), on texture unit 4 while the seam draws; its fine relief, a repeating tile with its
// mipmaps, on 6.
import { paintKey } from './paint-plan.js';
import { toHalf } from './terrain-plan.js';
export function createTerrainResources(gl, coarse) {
  let tex = null, detail = null, ready = false, asked = false, dead = false, worker = null, info = null;
  let failed = false;
  const idle = fn => setTimeout(fn, 0);
  // Outdoors' plate (terrain-plan.js makePlate, shipped as data/plate.bin): heights for the art-glass
  // world, on unit 7 from the moment it arrives, for good (nothing else uses that unit).
  let plate = null, plateKm = null, plateN = 0;
  const fromHalf = x => { const sg = x >> 15 ? -1 : 1, e = (x >> 10) & 31, m = x & 1023; return e === 0 ? sg * m * 2 ** -24 : sg * (1 + m / 1024) * 2 ** (e - 15); };
  fetch(new URL('./data/plate.bin' + new URL(import.meta.url).search, import.meta.url))
    .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
    .then(buf => {
      if (dead || gl.isContextLost()) return;
      const ft = new Uint16Array(buf), n = Math.round(Math.sqrt(ft.length)), km = new Float32Array(ft.length);
      for (let i = 0; i < ft.length; i++) km[i] = ft[i] * 0.0003048;
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE7);
      gl.bindTexture(gl.TEXTURE_2D, t);
      const half = toHalf(km);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, n, n, 0, gl.RED, gl.HALF_FLOAT, half);
      // (Kept as the GPU has it, for the click's plan: lead-plan.js.)
      plateKm = Float32Array.from(half, fromHalf); plateN = n;
      for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
      for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
      gl.activeTexture(gl.TEXTURE0);
      plate = t;
    })
    .catch(e => { failed = true; console.warn('Outdoors plate unavailable', e); });
  function tile({ dn, detail: levels }) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, levels.length, gl.RGBA16F, dn, dn);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.REPEAT);
    levels.forEach((d, l) => gl.texSubImage2D(gl.TEXTURE_2D, l, 0, 0, dn >> l, dn >> l, gl.RGBA, gl.HALF_FLOAT, d));
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    return t;
  }
  async function upload({ N, data, ...rest }) {
    detail = tile(rest);
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, N, N);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    for (let y = 0; y < N; y += 64) {
      if (dead || gl.isContextLost()) { gl.deleteTexture(t); return; }
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, t);
      const n = Math.min(64, N - y);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, N, n, gl.RGBA, gl.HALF_FLOAT, data.subarray(y * N * 4, (y + n) * N * 4));
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      if (y + 64 < N) await new Promise(idle);
    }
    tex = t; ready = true;
  }
  // The paint's plans (paint-plan.js), one per screen shape, made by the same worker once the field is
  // built: float texels for unit 5 while the seam draws. The two most recent are kept.
  const plans = new Map();
  let fieldDone = false, pending = null, asking = null;
  const keyOf = (W, H) => paintKey(W, H, coarse || W < 700);
  function askPaint(W, H) {
    const key = keyOf(W, H);
    if (plans.has(key) || asking === key) return;
    if (!fieldDone || !worker) { pending = [W, H]; return; }
    asking = key;
    worker.postMessage({ paint: { W: Math.round(W), H: Math.round(H), phone: coarse || W < 700, key } });
  }
  function takePaint({ key, w, h, data, count, ms }) {
    asking = null;
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    plans.set(key, { t, count, ms });
    while (plans.size > 2) { const [k0, v] = plans.entries().next().value; gl.deleteTexture(v.t); plans.delete(k0); }
    if (pending) { const [W, H] = pending; pending = null; askPaint(W, H); }
  }
  return {
    // Ask for it (once); it is ready some time later. (W, H: the screen, for the paint's first plan.)
    request(W = innerWidth, H = innerHeight) {
      if (dead) return;
      if (asked) { askPaint(W, H); return; }
      pending = [W, H];
      asked = true;
      try {
        worker = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => {
          if (data.error) { failed = true; console.warn('Terrain preparation failed', data.error); worker?.terminate(); worker = null; return; }
          if (data.paint) { if (!dead) takePaint(data.paint); return; }
          info = { N: data.N, ms: data.ms };
          fieldDone = true;
          upload(data);
          if (pending) { const [W, H] = pending; pending = null; askPaint(W, H); }
        };
        worker.onerror = () => { failed = true; };
        worker.postMessage({ N: coarse ? 384 : 512 });
      } catch (e) { failed = true; console.warn('Terrain worker unavailable', e); }
    },
    ready: (W = innerWidth, H = innerHeight) => ready && plans.has(keyOf(W, H)),
    failed: () => failed,
    plateReady: () => !!plate,
    plateData: () => (plateKm ? { km: plateKm, n: plateN } : null),
    stats: () => info && { ...info, plans: [...plans].map(([k, v]) => ({ key: k, count: v.count, ms: v.ms })) },
    // The field (4), its relief (6) and this screen's paint (5); false (and the paint asked for) until
    // all are in.
    bind(W = innerWidth, H = innerHeight) {
      const plan = plans.get(keyOf(W, H));
      if (!plan) askPaint(W, H);
      if (!ready || !plan) return false;
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, detail);
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, plan.t);
      gl.activeTexture(gl.TEXTURE0);
      return true;
    },
    unbind() { for (const u of [gl.TEXTURE4, gl.TEXTURE5, gl.TEXTURE6]) { gl.activeTexture(u); gl.bindTexture(gl.TEXTURE_2D, null); } gl.activeTexture(gl.TEXTURE0); },
    dispose() {
      dead = true; worker?.terminate(); worker = null;
      if (tex) gl.deleteTexture(tex); if (detail) gl.deleteTexture(detail); if (plate) gl.deleteTexture(plate);
      plans.forEach(v => gl.deleteTexture(v.t)); plans.clear();
      tex = detail = plate = null; ready = false;
    },
  };
}
