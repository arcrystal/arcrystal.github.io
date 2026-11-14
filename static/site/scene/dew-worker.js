// Stardust, then snow: the plan, simulated off the main thread (dew-plan.js), packed for upload. The
// simulation depends only on the screen's size; where the flakes land, also on where Racing's card sits,
// so a new card at the same size redoes only that.
import { makeDewPlan, aimShards, packDew } from './dew-plan.js';
let last = null;
self.onmessage = ({ data: { key, token, W, H, phone, card } }) => {
  try {
    const start = performance.now();
    const size = `${W}x${H}x${phone}`;
    let plan;
    if (last?.size === size) { plan = last.plan; if (card) aimShards(plan, card); }
    else { plan = makeDewPlan(W, H, { phone, card }); last = { size, plan }; }
    const packed = packDew(plan);
    packed.stats.prepareMs = performance.now() - start;
    self.postMessage({ key, token, ...packed }, [packed.data.buffer]);
  } catch (error) {
    self.postMessage({ key, token, error: String(error.stack || error) });
  }
};
