// Stardust, then frost: the plan per screen size, prepared in dew-worker.js and uploaded a few rows at a
// time while the page is idle. Keeps the active size and one before it; a size dropped mid-upload is
// cancelled. Nothing is built in the render loop.
export function createDewResources(gl, coarse) {
  const cache = new Map();
  let dead = false, worker = null, serial = 0;
  const idle = fn => setTimeout(fn, 0);
  const release = entry => { entry.disposed = true; if (entry.plan) gl.deleteTexture(entry.plan); };
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
  async function upload(w, h, data, entry) {
    if (dead || entry.disposed) return null;
    const t = texture(w, h);
    for (let y = 0; y < h; y += 32) {
      if (dead || entry.disposed || gl.isContextLost()) { gl.deleteTexture(t); return null; }
      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(gl.TEXTURE_2D, t);
      const n = Math.min(32, h - y);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, w, n, gl.RGBA, gl.FLOAT, data.subarray(y * w * 4, (y + n) * w * 4));
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      if (y + 32 < h) await new Promise(idle);
    }
    return t;
  }
  try {
    worker = new Worker(new URL('./dew-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = async ({ data: r }) => {
      const entry = cache.get(r.key);
      if (!entry || dead || entry.token !== r.token) return;
      if (r.error) { entry.failed = true; console.warn('Dew preparation failed', r.error); return; }
      entry.plan = await upload(r.width, r.height, r.data, entry);
      entry.stats = r.stats;
      entry.ready = !entry.disposed && !!entry.plan;
    };
    worker.onerror = () => { for (const e of cache.values()) e.failed = true; };
  } catch { worker = null; }
  // card: Racing's card on screen during the hold (its fragments' field lines end there), or null.
  let lastCard = null;
  function request(W, H, card = lastCard) {
    const c = card ? card.slice(0, 4).map(v => Math.round(v / 4) * 4) : null;
    if (c) lastCard = c;
    const key = `${Math.round(W)}x${Math.round(H)}|${c ? c.join(',') : '-'}`;
    if (!cache.has(key)) {
      if (cache.size >= 2) { const [k, entry] = cache.entries().next().value; release(entry); cache.delete(k); }
      const token = ++serial;
      cache.set(key, { ready: false, token });
      worker?.postMessage({ key, token, W: Math.round(W), H: Math.round(H), phone: coarse || W < 700, card: c });
    }
    return cache.get(key);
  }
  request(innerWidth, innerHeight);
  return {
    request,
    ready(W, H, card) { return request(W, H, card).ready; },
    stats(W, H, card) { return request(W, H, card).stats; },
    bind(W, H, card) {
      const entry = request(W, H, card);
      if (!entry.ready) return false;
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, entry.plan);
      gl.activeTexture(gl.TEXTURE0);
      return true;
    },
    dispose() { dead = true; worker?.terminate(); for (const entry of cache.values()) release(entry); cache.clear(); },
  };
}
