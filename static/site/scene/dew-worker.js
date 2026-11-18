// Cancellation-aware worker preparation. Card changes reuse exactly the same physics.
import { makeDewPlan, aimShards, packDew } from './dew-plan.js';
import { prepareAccretion } from './accretion-plan.js';
let current=null,version=0;
self.onmessage=async ({data:{key,token,W,H,phone,card}})=>{
  const size=`${W}x${H}x${phone}`;
  try {
    if(current?.size!==size){
      const generation=++version,plan=makeDewPlan(W,H,{phone,card});
      const bake = current = { size, plan, key, token, percent: -1 };
      bake.promise = prepareAccretion(plan, {
        cancelled: () => generation !== version,
        onProgress(fraction) {
          const percent = Math.floor(100 * fraction);
          if (percent <= bake.percent || bake !== current) return;
          bake.percent = percent;
          self.postMessage({key: bake.key, token: bake.token, stage: 'progress', percent});
        },
      });
    }
    const task=current;
    task.key = key; task.token = token;
    if (task.percent >= 0) self.postMessage({key, token, stage: 'progress', percent: task.percent});
    // The abbreviated click needs only fractures, so it is available before the longer orbit bake.
    if(!task.plan.accretion){const fast=packDew(task.plan);self.postMessage({key,token,stage:'click',...fast},[fast.data.buffer]);}
    await task.promise;if(task!==current)return;
    if(card)aimShards(task.plan,card);
    const packed=packDew(task.plan),budget=(phone?16:32)*1024*1024;
    if(packed.data.byteLength>budget)throw new Error(`Accretion texture cache exceeds ${budget} bytes`);
    self.postMessage({key,token,...packed},[packed.data.buffer]);
  }catch(error){if(!String(error).includes('cancelled'))self.postMessage({key,token,error:String(error.stack||error)});}
};
