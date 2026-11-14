// Stardust, then frost: the plan, simulated off the main thread (dew-plan.js), packed for upload. The
// simulation depends only on the screen's size; the fragments' field lines also on where Racing's card
// sits, so a new card at the same size redoes only those.
import { makeDewPlan, makeFragments, packDew } from './dew-plan.js';
let last = null;
self.onmessage = ({ data: { key, token, W, H, phone, card } }) => {
  try {
    const start = performance.now();
    const size = `${W}x${H}x${phone}`;
    let plan;
    if (last?.size === size) { plan = last.plan; makeFragments(plan, card); }
    else { plan = makeDewPlan(W, H, { phone, card }); last = { size, plan }; }
    const packed = packDew(plan);
    packed.stats.prepareMs = performance.now() - start;
    self.postMessage({ key, token, ...packed }, [packed.data.buffer]);
  } catch (error) {
    self.postMessage({ key, token, error: String(error.stack || error) });
  }
};
