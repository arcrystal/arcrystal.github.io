// The pieces' distance fields (staunton.js), built off the page's thread: each turned profile, then the
// knight's carved head with its relief (staunton-relief.js). board3d.js uploads them.
self.onmessage = async ({ data }) => {
  try {
    const { LAYERS, PROF, bodyOf, profileField, sculptedHeadField, decodeRelief } = await import(data.staunton);
    const { KNIGHT_RELIEF, KNIGHT_RELIEF_DATA } = await import(data.relief);
    const all = new Float32Array(PROF.w * PROF.h * LAYERS.length);
    [...LAYERS].forEach((t, i) => all.set(profileField(bodyOf(t)), i * PROF.w * PROF.h));
    const head = sculptedHeadField(decodeRelief(KNIGHT_RELIEF, KNIGHT_RELIEF_DATA));
    self.postMessage({ all, head }, [all.buffer, head.buffer]);
  } catch (e) { self.postMessage({ failed: String(e && e.stack || e) }); }
};
