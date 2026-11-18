// Gravity becoming a track: the plan per screen size, prepared in dew-worker.js and uploaded a few rows at a
// time while the page is idle. Keeps the active size and one before it; a size dropped mid-upload is
// cancelled. Nothing is built in the render loop.
export function createDewResources(gl, coarse) {
  const cache = new Map();
  let dead = false, worker = null, serial = 0;
  const idle = fn => setTimeout(fn, 0);
  const release = entry => { entry.disposed = true; if (entry.plan) gl.deleteTexture(entry.plan); if(entry.fast)gl.deleteTexture(entry.fast); };
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
  async function upload(w, h, data, entry, reportRows) {
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
      reportRows?.((y + n) / h);
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
      if (r.stage === 'progress') { entry.percent = r.percent; return; }
      if(r.stage==='click'){
        const fast=await upload(r.width,r.height,r.data,entry);
        if(entry.ready){if(fast)gl.deleteTexture(fast);}else{entry.fast=fast;entry.fastStats=r.stats;entry.fastBytes=r.stats.bytes;}
        return;
      }
      entry.bytes=r.stats.bytes;
      const budget=entry.budget;
      let bytes=[...cache.values()].reduce((n,e)=>n+(e.bytes||0)+(e.fastBytes||0),0);
      for(const [k,e] of cache){if(bytes<=budget)break;if(e!==entry){bytes-=(e.bytes||0)+(e.fastBytes||0);release(e);cache.delete(k);}}
      entry.plan = await upload(r.width, r.height, r.data, entry, fraction => { entry.percent = 95 + 5 * fraction; });
      entry.stats = r.stats;
      entry.ready = !entry.disposed && !!entry.plan;
      if(entry.ready&&entry.fast){gl.deleteTexture(entry.fast);entry.fast=null;entry.fastBytes=0;}
    };
    worker.onerror = () => { for (const e of cache.values()) e.failed = true; };
  } catch { worker = null; }
  // card: Racing's card on screen during the hold (the track settles here, to layout-pixel precision), or null.
  let lastCard = null;
  function request(W, H, card = lastCard) {
    const c = card ? card.slice(0, 4).map(v => Math.round(v * 64) / 64) : null;
    if (c) lastCard = c;
    const key = `${Math.round(W)}x${Math.round(H)}|${c ? c.join(',') : '-'}`;
    if (!cache.has(key)) {
      if (cache.size >= 2) { const [k, entry] = cache.entries().next().value; release(entry); cache.delete(k); }
      const token = ++serial;
      cache.set(key, { ready: false, failed: !worker, token, budget:(coarse||W<700?16:32)*1024*1024 });
      worker?.postMessage({ key, token, W: Math.round(W), H: Math.round(H), phone: coarse || W < 700, card: c });
    }
    return cache.get(key);
  }
  request(document.documentElement.clientWidth, innerHeight);
  return {
    request,
    ready(W, H, card) { return request(W, H, card).ready; },
    percent(W, H) { return request(W, H).percent ?? 0; },
    failed(W, H, card) { return !!request(W, H, card).failed; },
    clickReady(W,H,card) { const e=request(W,H,card);return e.ready||!!e.fast; },
    stats(W, H, card) { const e=request(W,H,card);return e.stats||e.fastStats; },
    bind(W, H, card, click=false) {
      const entry = request(W, H, card);
      if (!entry.ready && !(click&&entry.fast)) return false;
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, entry.plan||entry.fast);
      gl.activeTexture(gl.TEXTURE0);
      return true;
    },
    dispose() { dead = true; worker?.terminate(); for (const entry of cache.values()) release(entry); cache.clear(); },
  };
}
