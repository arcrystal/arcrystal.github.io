// Worker preparation and incremental GPU upload. No geometry construction in the render loop.
export function createIceResources(gl, coarse) {
  const cache = new Map();
  let dead = false, spectrum = null, worker = null;
  const idle = fn => setTimeout(fn, 0);
  const release = entry => {
    entry.disposed = true;
    gl.deleteTexture(entry.plan);
    gl.deleteTexture(entry.atlas);
  };
  function texture(w, h) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, w, h);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    return t;
  }
  async function upload(w, h, data, entry = {}) {
    if (dead || entry.disposed) return null;
    const t = texture(w, h);
    for (let y = 0; y < h; y += 32) {
      if (dead || entry.disposed || gl.isContextLost()) { gl.deleteTexture(t); return null; }
      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(gl.TEXTURE_2D, t);
      const n = Math.min(32, h - y);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, w, n, gl.RGBA, gl.FLOAT, data.subarray(y*w*4, (y+n)*w*4));
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      if (y + 32 < h) await new Promise(idle);
    }
    return t;
  }
  fetch(new URL('./data/ice-spectrum.bin', import.meta.url))
    .then(r => { if (!r.ok) throw Error('Ice spectrum unavailable'); return r.arrayBuffer(); })
    .then(async b => { if (!dead) spectrum = await upload(2048, 1, new Float32Array(b)); })
    .catch(e => console.warn(e.message));
  try {
    worker = new Worker(new URL('./ice-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = async ({ data: r }) => {
      const entry = cache.get(r.key);
      if (!entry || dead || entry.token !== r.token) return;
      if (r.error) { entry.failed = true; console.warn('Ice preparation failed', r.error); return; }
      entry.plan = await upload(r.width, r.height, r.data, entry);
      entry.atlas = await upload(r.aw, r.ah, r.atlas, entry);
      entry.stats = r.stats;
      entry.ready = !entry.disposed && !!entry.plan && !!entry.atlas;
    };
    worker.onerror = () => { for (const e of cache.values()) e.failed = true; };
  } catch { worker = null; }
  let serial = 0;
  function request(W, H) {
    const key = `${Math.round(W)}x${Math.round(H)}`;
    if (!cache.has(key)) {
      // Keep the active size and one previous size; cancel evicted uploads as well as textures.
      if (cache.size >= 2) {
        const [k, entry] = cache.entries().next().value;
        release(entry); cache.delete(k);
      }
      const token = ++serial;
      cache.set(key, { ready: false, token });
      worker?.postMessage({ key, token, W: Math.round(W), H: Math.round(H), phone: coarse || W < 700 });
    }
    return cache.get(key);
  }
  request(innerWidth, innerHeight);
  return {
    request,
    ready(W, H) { return !!spectrum && request(W, H).ready; },
    bind(W, H) {
      const entry = request(W, H);
      if (!spectrum || !entry.ready) return false;
      for (const [unit, t] of [[5, entry.plan], [6, entry.atlas], [7, spectrum]]) {
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      }
      gl.activeTexture(gl.TEXTURE0);
      return true;
    },
    stats(W, H) { return request(W, H).stats; },
    dispose() {
      dead = true; worker?.terminate();
      for (const entry of cache.values()) release(entry);
      gl.deleteTexture(spectrum); cache.clear();
    },
  };
}
