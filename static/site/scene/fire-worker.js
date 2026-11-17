// Outdoors → Photography's ignition plan (fire-plan.js makeIgnition), worked out off the main thread:
// given Outdoors' plate and a screen's size, when the fire reaches each point of the window, as half
// floats for an R16F texture.
import { makeIgnition, ignitionTexels } from './fire-plan.js';
self.onmessage = ({ data: { km, n, W, H, key } }) => {
  try {
    const plan = makeIgnition(km, n, W, H), half = ignitionTexels(plan);
    self.postMessage({ key, w: plan.w, h: plan.h, half }, [half.buffer]);
  } catch (error) {
    self.postMessage({ key, error: String(error.stack || error) });
  }
};
