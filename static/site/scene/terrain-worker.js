// The White Mountains' heightfield (terrain-plan.js), built off the main thread once and sent as half
// floats for an RGBA16F texture; then, asked for a screen's shape, the paint's plan for it
// (paint-plan.js), as float texels.
import { makeTerrain, makeDetail, mipChain, toHalf } from './terrain-plan.js';
import { makePaint } from './paint-plan.js';
let field = null;
self.onmessage = ({ data }) => {
  try {
    if (data.paint) {
      if (!field) return;
      const t0 = performance.now(), { W, H, phone, key } = data.paint, p = makePaint(field, W, H, phone);
      self.postMessage({ paint: { key, w: p.w, h: p.h, data: p.data, count: p.splashes.length, ms: performance.now() - t0 } }, [p.data.buffer]);
      return;
    }
    const t0 = performance.now();
    field = makeTerrain({ N: data.N });
    const half = toHalf(field.data), d = makeDetail(), mips = mipChain(d.data, d.n).map(toHalf);
    self.postMessage({ N: field.N, size: field.size, data: half, dn: d.n, detail: mips, ms: performance.now() - t0 }, [half.buffer, ...mips.map(m => m.buffer)]);
  } catch (error) {
    self.postMessage({ error: String(error.stack || error) });
  }
};
