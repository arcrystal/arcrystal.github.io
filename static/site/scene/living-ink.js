// Scroll reads immutable optical volumes and material-sheet keyframes. Aspect changes
// cancel worker and GPU data together. Tile-only movement updates the camera.
import { KEYS,END,piecePoses,ease,orbitCentres } from './living-ink-plan.js';
import { frameCamera } from './staunton.js';
import { INK_DRIP_INSTANCES } from './glsl/ink-impact.js';
import { PRECIPITATION } from './ink-tank.js';
import { CLEAR, waterPlane, emergence, boxCamera, toScreen } from './ink-drain.js';
import { DRAIN, tankCamera } from './ink-tank.js';
import { startSlots } from './staunton.js';
import { rollUp, breath as capBreath, spinAt, orbitAt } from './ink-swirl.js';
import { clockP } from './living-forms.js';
import { HOLD } from '../lerp.js';

// Workers have their own module map. Send the versioned planner URL from
// the document so a cached pre-sheet bake cannot reach the new GPU layout.
function sceneModule(relative){
  if(import.meta.resolve)return import.meta.resolve(relative);
  const url=new URL(relative,import.meta.url);
  url.search=new URL(import.meta.url).search;
  return url.href;
}
// Wave units per world unit of the board for the crowns' rings: their packets the size the rain's were.
const CROWN_WAVES=.45;
// How much quicker than the rain's the returning water's rings age: they live as many screens of scroll.
const LAND_AGE=2.2;
// The tank's surface point (x, z) under a screen point (uv, y up), as glsl/unmix.js waterXZ maps it; null
// off the band between the far line and the near meniscus.
function waterUnder(x,y,cam,aspect){
  const f=(cam[0]+.5*cam[1]-y)/cam[1];
  if(f<=0||f>=1)return null;
  const k=.66*(1-cam[3]),z=f*(1+k)/(1+k*f),w=1+k*(1-z);
  return [.5+(x-.5-(z-.5)*.072*cam[3]/Math.max(1,aspect))*w/(1+.22*(1-cam[3])),z];
}
export function createLivingInk(gl,coarse,programs){
  const orbitData=new Float32Array(8),orbitTurn=new Float32Array(4);
  let worker=null,plannedAspect=0,plannedMobile=null,meta=null,ledger=null,queue=[],uploaded=0,failed=false;
  let pigment=null,knightPigment=null,figurePigment=null,bathRoom=null,plates=null,sheetDepth=null,interiorCount=0,sheetCount=0;
  let registration=null,volume=null,mesh=null,grid=null,indices=null,ripples=null,noise=null,noiseData=null,cam=null,camAspect=0;
  let layers=null,figures=null,threads=null,air=null,warmFence=null,warmed=false,sheetLayout=null;
  // Instance zero draws the wet lip. Each other record describes one physical
  // drop for both the airborne silhouette and its water-surface impulse.
  const dripGeometry=gl.createVertexArray(),dripEvents=gl.createBuffer(),dripCorners=gl.createBuffer();
  gl.bindVertexArray(dripGeometry);
  gl.bindBuffer(gl.ARRAY_BUFFER,dripEvents);
  gl.bufferData(gl.ARRAY_BUFFER,INK_DRIP_INSTANCES,gl.STATIC_DRAW);
  for(let field=0;field<3;field++){
    gl.enableVertexAttribArray(field);
    gl.vertexAttribPointer(field,4,gl.FLOAT,false,48,16*field);
    gl.vertexAttribDivisor(field,1);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER,dripCorners);
  gl.bufferData(gl.ARRAY_BUFFER,Float32Array.from({length:18},(_,i)=>i),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3,1,gl.FLOAT,false,0,0);
  gl.bindVertexArray(null);
  // The drain's crowns: one record a piece (ink-drain.js emergence), rebuilt if the pieces' heights change.
  const crownGeometry=gl.createVertexArray(),crownRecords=gl.createBuffer();
  let crownKey='',crownCount=0;
  gl.bindVertexArray(crownGeometry);
  gl.bindBuffer(gl.ARRAY_BUFFER,crownRecords);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,4,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(0,1);
  gl.bindBuffer(gl.ARRAY_BUFFER,dripCorners);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.FLOAT,false,0,0);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER,null);
  // The pieces landing under the falling band ring its surface, as the rain rang the rising one: records in
  // the drips' layout (a zero record first), at the tank's point over each landing, drawn by INK_RIPPLE.
  const landGeometry=gl.createVertexArray(),landRecords=gl.createBuffer();
  let landKey='',landCount=0;
  gl.bindVertexArray(landGeometry);
  gl.bindBuffer(gl.ARRAY_BUFFER,landRecords);
  for(let field=0;field<3;field++){
    gl.enableVertexAttribArray(field);gl.vertexAttribPointer(field,4,gl.FLOAT,false,48,16*field);gl.vertexAttribDivisor(field,1);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER,dripCorners);
  gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,1,gl.FLOAT,false,0,0);
  gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);
  function landings(box,W,H){
    const key=`${box.map(v=>Math.round(v)).join()} ${W} ${H} ${meta?.sites?.length}`;
    if(key!==landKey && meta){
      landKey=key;
      const slots=startSlots(),cam=boxCamera(box),aspect=W/H,out=Array(12).fill(0);
      for(const site of meta.sites){
        if(site.land<=CLEAR[0])continue;
        const s=slots[site.slot],at=toScreen(cam,box,[s.x,0,s.z]);
        if(!at)continue;
        const tank=waterUnder(at[0]/W,1-at[1]/H,tankCamera(site.land),aspect);
        if(!tank)continue;
        out.push(tank[0],tank[1],0,.005, 0,0,site.land,Number(!site.piece.black), 0,0,site.slot*1.7,0);
      }
      landCount=out.length/12;
      gl.bindBuffer(gl.ARRAY_BUFFER,landRecords);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,null);
    }
    return landCount;
  }
  // Two rings a crown: as it breaks through, and a smaller one a moment later as the film drips off it.
  function crowns(box,W,H){
    const key=`${box.map(v=>Math.round(v)).join()} ${W} ${H}`;
    if(key!==crownKey){
      crownKey=key;
      const list=emergence(box,W,H).filter(c=>c.P>CLEAR[0] && c.P<DRAIN.last[1]);
      crownCount=2*list.length;
      gl.bindBuffer(gl.ARRAY_BUFFER,crownRecords);
      gl.bufferData(gl.ARRAY_BUFFER,Float32Array.from(list.flatMap(c=>[c.x,c.z,c.P,.02,c.x,c.z,c.P+.009,.0032])),gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER,null);
    }
    return crownCount;
  }
  function texParams(type,filter,wrap=gl.CLAMP_TO_EDGE){
    gl.texParameteri(type,gl.TEXTURE_MAG_FILTER,filter);gl.texParameteri(type,gl.TEXTURE_MIN_FILTER,filter);
    gl.texParameteri(type,gl.TEXTURE_WRAP_S,wrap);gl.texParameteri(type,gl.TEXTURE_WRAP_T,wrap);
    if(type!==gl.TEXTURE_2D)gl.texParameteri(type,gl.TEXTURE_WRAP_R,wrap);
  }
  function allocate(type,fmt,w,h,d,filter){
    const t=gl.createTexture();gl.bindTexture(type,t);gl.texStorage3D(type,1,fmt,w,h,d);
    texParams(type,filter);return t;
  }
  function materialTexture(image,monochrome){
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    // Only the room holds colour. Store one transmission channel for each
    // pigment study, including its mip chain, on desktop and phone.
    gl.texImage2D(gl.TEXTURE_2D,0,monochrome?gl.R8:gl.RGBA8,monochrome?gl.RED:gl.RGBA,gl.UNSIGNED_BYTE,image);
    texParams(gl.TEXTURE_2D,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    return tex;
  }
  function stop(){
    worker?.terminate();worker=null;
    if(warmFence)gl.deleteSync(warmFence);
    warmFence=null;warmed=false;
    for(const t of [volume,mesh,registration])if(t)gl.deleteTexture(t);
    if(grid)gl.deleteVertexArray(grid);
    if(indices)gl.deleteBuffer(indices);
    grid=indices=volume=mesh=registration=meta=ledger=noiseData=sheetLayout=null;queue=[];uploaded=0;failed=false;
  }
  function prepare(w,h,box,board){
    const aspect=w/h,mobile=coarse||w<700;
    // A desktop scrollbar can appear mid-shot. Its small horizontal change
    // stretches the normalized plume coordinates while the tile pose and
    // framebuffer follow the new size immediately. Keep that bake resident.
    if(mobile!==plannedMobile || Math.abs(aspect-plannedAspect)*h>18){
      stop();plannedAspect=aspect;plannedMobile=mobile;
      if(!pigment&&!plates){
        plates=['./data/ink-density.webp','./data/ink-knight-density.webp','./data/ink-figure-density.webp','./data/darkroom-reflection.webp'].map(path=>{
          const image=new Image();image.src=new URL(path,import.meta.url).href;return image;
        });
      }
      try{
        const job=new Worker(sceneModule('./living-ink-worker.js'),{type:'module'});
        worker=job;
        job.onmessage=({data})=>{if(worker!==job)return;
          if(data.failed){stop();failed=true;return;}
          if(data.meta){
            if(!data.meta.registration?.data || !data.meta.rows || !data.meta.cols || data.meta.vaporFigures?.length!==4*data.meta.order.length){
              stop();failed=true;return;
            }
            meta=data.meta;noiseData=data.noise;
          }
          else if(data.ledger){ledger=data.ledger;job.terminate();worker=null;}
          else queue.push(data);
        };
        job.onerror=()=>{if(worker===job){stop();failed=true;}};
        job.postMessage({aspect:Math.round(aspect*100)/100,mobile,needsNoise:!noise,planner:sceneModule('./living-ink-plan.js')});
      }catch{failed=true;}
    }
    if(!meta||failed)return;
    if(!pigment){
      if(!plates.every(image=>image.complete))return;
      if(plates.some(image=>!image.naturalWidth)){failed=true;return;}
      gl.activeTexture(gl.TEXTURE0);
      [pigment,knightPigment,figurePigment,bathRoom]=plates.map((image,i)=>materialTexture(image,i<3));plates=null;
    }
    const {nx,ny,nz,rows,cols,order}=meta;
    gl.activeTexture(gl.TEXTURE0);
    if(!volume){
      const table=meta.registration;
      registration=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,registration);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,table.width,table.height,0,gl.RGBA,gl.FLOAT,table.data);
      texParams(gl.TEXTURE_2D,gl.LINEAR);
      // Use a 2D array so atlas width is independent of the smaller 3D texture limit.
      volume=allocate(gl.TEXTURE_2D_ARRAY,gl.RG8,nx*10,ny*8,nz,gl.LINEAR);
      mesh=allocate(gl.TEXTURE_2D_ARRAY,gl.RGBA16UI,cols+4,rows*order.length,KEYS,gl.NEAREST);
      const tris=[];
      for(let slab=0;slab<5;slab++){
        // The long optical sections follow every bend down the stem. Across
        // a section the four rails interpolate smoothly, so fewer columns suffice.
        const rowStep=slab===4 || !mobile?1:2,colStep=slab===4?1:4,base=slab*cols*rows;
        for(let j=0;j<rows-1;j+=rowStep)for(let k=0;k<cols-1;k+=colStep){
          const endRow=Math.min(rows-1,j+rowStep),endCol=Math.min(cols-1,k+colStep);
          const a=base+j*cols+k,b=base+j*cols+endCol,c=base+endRow*cols+k,d=base+endRow*cols+endCol;
          tris.push(a,b,c,c,b,d);
        }
        if(slab===3)interiorCount=tris.length;
      }
      sheetCount=tris.length;
      grid=gl.createVertexArray();indices=gl.createBuffer();gl.bindVertexArray(grid);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(tris),gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      if(!noise){
        noise=allocate(gl.TEXTURE_3D,gl.RGBA8,40,40,40,gl.LINEAR);
        texParams(gl.TEXTURE_3D,gl.LINEAR,gl.REPEAT);
        gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,40,40,40,gl.RGBA,gl.UNSIGNED_BYTE,noiseData);
        noiseData=null;
      }
    }
    if(!queue.length){
      if(uploaded===KEYS && ledger && !warmed && board?.ready() &&
          programs.inkImpact && programs.inkFigure && programs.unmixSeen && programs.inkWake && programs.inkSheet && programs.inkRipple && programs.inkEmerge){
        if(!warmFence){
          // Compile the actual attachment/depth/blend variants under the loader.
          draw(.156,w,h,box,0,board,{});
          draw(.98,w,h,box,0,board,{});
          draw(1.15,w,h,box,0,board,{});
          draw(.66,w,h,box,0,board,{});
          warmFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
          if(!warmFence)warmed=true;
        }else{
          const status=gl.clientWaitSync(warmFence,0,0);
          if(status!==gl.TIMEOUT_EXPIRED){
            gl.deleteSync(warmFence);warmFence=null;
            warmed=status!==gl.WAIT_FAILED;failed=!warmed;
          }
        }
      }
      return;
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    for(let i=0;i<3 && queue.length;i++){
      const {frame,density,mesh:sheet}=queue.shift();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY,volume);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,(frame%10)*nx,Math.floor(frame/10)*ny,0,nx,ny,nz,gl.RG,gl.UNSIGNED_BYTE,density);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY,mesh);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,frame,cols+4,rows*order.length,1,gl.RGBA_INTEGER,gl.UNSIGNED_SHORT,sheet);
      uploaded++;
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);gl.bindTexture(gl.TEXTURE_2D_ARRAY,null);
  }
  function release(target){
    if(!target)return;
    target.textures.forEach(t=>gl.deleteTexture(t));gl.deleteFramebuffer(target.fb);
    if(target.depth)gl.deleteRenderbuffer(target.depth);
    if(target.depthTexture)gl.deleteTexture(target.depthTexture);
  }
  function resize(target,w,h,count,depth=false){
    if(target?.w===w && target.h===h)return target;
    release(target);const fb=gl.createFramebuffer(), textures=[],attachments=[];
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
    for(let i=0;i<count;i++){
      const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,w,h);texParams(gl.TEXTURE_2D,gl.LINEAR);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,t,0);
      textures.push(t);attachments.push(gl.COLOR_ATTACHMENT0+i);
    }
    gl.drawBuffers(attachments);
    let z=null,depthTexture=null;
    if(depth==='sample'){
      depthTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,depthTexture);
      gl.texStorage2D(gl.TEXTURE_2D,1,gl.DEPTH_COMPONENT16,w,h);
      texParams(gl.TEXTURE_2D,gl.NEAREST);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depthTexture,0);
    }else if(depth){z=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,z);
      gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,z);}
    return {w,h,textures,fb,depth:z,depthTexture};
  }
  function bind(unit,type,tex,loc){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(type,tex);gl.uniform1i(loc,unit);}
  function target(t){gl.bindFramebuffer(gl.FRAMEBUFFER,t.fb);gl.viewport(0,0,t.w,t.h);}
  function draw(P,w,h,box,time,board,s){
    if(!meta||!ledger||uploaded!==KEYS||!board?.ready())return false;
    const aspect=box[2]/box[3];
    if(camAspect!==aspect){cam=frameCamera(aspect);camAspect=aspect;}
    const poses=piecePoses(meta.sites,P,w,h,box,ledger,cam);
    // Each solid hands its own slot to the real board at touchdown.
    if(s.board){const slots=s.board.pos.slots.slice();
      for(const p of poses)if(p.flight<1)slots[p.slot]=null;
      s.board.pos={...s.board.pos,slots};
    }
    // The pieces and veils at the device's own resolution, up to a 4K screen's.
    const scale=Math.min(devicePixelRatio||1,Math.sqrt((coarse?1.6e6:4.2e6)/(w*h)));
    const W=Math.round(w*scale),H=Math.round(h*scale);
    // (The veils are soft: they keep the earlier budget; only the solids are drawn at the device's own.)
    const scaleT=Math.min(devicePixelRatio||1,Math.sqrt((coarse?1.05e6:1.6e6)/(w*h)));
    const WT=Math.round(w*scaleT),HT=Math.round(h*scaleT);
    figures=resize(figures,W,H,1,'sample');threads=resize(threads,WT,HT,1);
    const low=Math.min(.83,Math.sqrt((coarse?178000:355000)/(w*h)));
    layers=resize(layers,Math.max(1,Math.round(w*low)),Math.max(1,Math.round(h*low)),2);
    gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);target(figures);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);
    gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const piece=programs.inkFigure;
    gl.useProgram(piece.p);board.bindPieceProfiles(piece.U);gl.enable(gl.SCISSOR_TEST);
    gl.uniform1f(piece.U.uStudies,1);
    bind(3,gl.TEXTURE_2D,registration,piece.U.uRegistration);
    bind(4,gl.TEXTURE_2D,knightPigment,piece.U.uKnightPigment);
    bind(5,gl.TEXTURE_2D,figurePigment,piece.U.uFigurePigment);
    for(const [id,pose] of poses.entries()){
      if(pose.growth<=.001 || pose.flight===1)continue;
      const {x,y,pixels,tall,distance,roll,spin,elev,growth,type,black,z,slopeX,slopeY}=pose;
      const radius=Math.ceil(pixels*scale*(1.2+Math.abs(slopeX)+Math.abs(slopeY)));
      gl.scissor(Math.floor(x*scale-radius),Math.floor(y*scale-radius),2*radius+2,2*radius+2);
      gl.uniform4f(piece.U.uPose,x*scale,y*scale,pixels*scale,distance);
      gl.uniform4f(piece.U.uTurn,spin,roll,elev,growth);gl.uniform4f(piece.U.uModel,type,Number(black),tall,z);
      gl.uniform2f(piece.U.uInkOrientation,id,meta.sites[id].piece.spin+meta.sites[id].turn);
      gl.uniform3fv(piece.U.uNuclei,pose.nuclei);gl.uniform1f(piece.U.uSeed,pose.slot);
      gl.uniform2f(piece.U.uSlope,slopeX,slopeY);gl.uniform2f(piece.U.uCure,pose.fill,pose.set);gl.drawArrays(gl.TRIANGLES,0,3);
    }
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.SCISSOR_TEST);
    const key=Math.max(0,Math.min(KEYS-1,P/END*(KEYS-1)));
    const breath=Math.sin(time*.43);
    const flowPhase=time*.69,spin=spinAt(P,time),Pc=clockP(P,coarse||w<700?HOLD.pinTouch:HOLD.pin);
    const sheetsLive=P>.127 && P<END;
    function drawSheets(depthOnly){
      const sheet=programs.inkSheet;gl.useProgram(sheet.p);
      bind(0,gl.TEXTURE_2D_ARRAY,mesh,sheet.U.uMesh);
      bind(1,gl.TEXTURE_2D,figures.textures[0],sheet.U.uFigures);
      bind(7,gl.TEXTURE_2D,figures.depthTexture,sheet.U.uFigureDepth);
      bind(2,gl.TEXTURE_2D,layers.textures[0],sheet.U.uMist);
      gl.uniform2f(sheet.U.uSize,WT,HT);gl.uniform1f(sheet.U.uKey,key);
      gl.uniform1f(sheet.U.uProgress,P);gl.uniform1f(sheet.U.uBreath,breath);
      gl.uniform1f(sheet.U.uFlowPhase,flowPhase);gl.uniform1f(sheet.U.uRollUp,rollUp(P));gl.uniform4fv(sheet.U.uBreathe,capBreath(P,time,Pc));gl.uniform1f(sheet.U.uClockP,Pc);
      if(sheetLayout!==meta){
        gl.uniform4fv(sheet.U.uVaporFigure,meta.vaporFigures);
        gl.uniform1iv(sheet.U.uOrder,meta.order);
        gl.uniform1i(sheet.U.uCols,meta.cols);gl.uniform1i(sheet.U.uRows,meta.rows);
        sheetLayout=meta;
      }
      bind(3,gl.TEXTURE_2D,pigment,sheet.U.uPigment);
      bind(4,gl.TEXTURE_2D,knightPigment,sheet.U.uKnightPigment);
      bind(5,gl.TEXTURE_2D,figurePigment,sheet.U.uFigurePigment);
      gl.uniform1i(sheet.U.uDepthOnly,depthOnly?1:0);
      gl.bindVertexArray(grid);
      gl.drawElementsInstanced(gl.TRIANGLES,depthOnly?interiorCount:sheetCount,gl.UNSIGNED_SHORT,0,meta.order.length);
      gl.bindVertexArray(null);
    }
    sheetDepth=resize(sheetDepth,layers.w,layers.h,1,true);
    target(sheetDepth);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    if(sheetsLive){
      gl.enable(gl.DEPTH_TEST);drawSheets(true);gl.disable(gl.DEPTH_TEST);
    }
    // The pairs' turn between this P's two keys (living-ink-plan.js orbitCentres), so the mist's keys meet.
    orbitData.fill(0);orbitTurn.fill(0);
    const k0=Math.floor(key),k1=Math.min(KEYS-1,k0+1),P0=k0*END/(KEYS-1),P1=k1*END/(KEYS-1);
    if(orbitAt(P1)>orbitAt(P0))orbitCentres(P,plannedAspect||w/h).forEach((o,i)=>{
      orbitData.set([o.centre[0],o.centre[1],Math.max(.02,o.half),1],4*i);
      orbitTurn.set([o.sense*(orbitAt(P)-orbitAt(P0)),o.sense*(orbitAt(P1)-orbitAt(P))],2*i);
    });
    const view=programs.unmixSeen;
    target(layers);gl.useProgram(view.p);gl.uniform1f(view.U.uSpin,spin);
    gl.uniform4fv(view.U.uOrbit,orbitData);gl.uniform2fv(view.U.uOrbitTurn,orbitTurn);
    bind(0,gl.TEXTURE_2D_ARRAY,volume,view.U.uVolume);
    bind(1,gl.TEXTURE_3D,noise,view.U.uNoise);bind(2,gl.TEXTURE_2D,figures.depthTexture,view.U.uFigureDepth);
    bind(3,gl.TEXTURE_2D,sheetDepth.textures[0],view.U.uSheetDepth);
    gl.uniform2f(view.U.uSize,layers.w,layers.h);gl.uniform3f(view.U.uCells,meta.nx,meta.ny,meta.nz);
    gl.uniform1f(view.U.uAspect,w/h);gl.uniform1f(view.U.uProgress,P);gl.uniform1f(view.U.uKey,key);
    gl.uniform1f(view.U.uBreath,breath);gl.uniform1f(view.U.uFlowPhase,flowPhase);gl.drawArrays(gl.TRIANGLES,0,3);
    target(threads);gl.clear(gl.COLOR_BUFFER_BIT);
    if(sheetsLive){
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      drawSheets(false);gl.disable(gl.BLEND);
    }
    air=resize(air,W,H,1);
    // Airborne paint reflects the room directly. Keep it separate from
    // submerged sheets so the Fresnel layer can obscure those independently.
    if(P>0 && P<.68){
      target(air);gl.clear(gl.COLOR_BUFFER_BIT);
      const impact=programs.inkImpact;gl.useProgram(impact.p);
      bind(2,gl.TEXTURE_2D,bathRoom,impact.U.uBathRoom);
      gl.uniform2f(impact.U.uSize,W,H);gl.uniform1f(impact.U.uProgress,P);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(dripGeometry);
      gl.drawArraysInstanced(gl.TRIANGLES,0,18,PRECIPITATION.length+1);
      gl.bindVertexArray(null);gl.disable(gl.BLEND);
    }
    if(P>.82 && P<END){
      target(threads);
      const wake=programs.inkWake, past=piecePoses(meta.sites,P-.057,w,h,box,ledger,cam);
      gl.useProgram(wake.p);bind(1,gl.TEXTURE_2D,figures.depthTexture,wake.U.uFigureDepth);
      gl.uniform2f(wake.U.uSize,WT,HT);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      for(let i=0;i<poses.length;i++){
        const head=poses[i],tail=past[i],site=meta.sites[i];
        const strength=ease(site.depart,site.depart+.015,P)*(1-ease(site.land-.008,site.land+.026,P));
        if(strength<=0)continue;
        gl.uniform4f(wake.U.uHead,head.x*scaleT,(head.y-head.pixels*head.tall*.25)*scaleT,head.z,head.pixels*.32*scaleT);
        gl.uniform4f(wake.U.uTail,tail.x*scaleT,(tail.y-tail.pixels*tail.tall*.30)*scaleT,tail.z,0);
        gl.uniform4f(wake.U.uClock,strength,head.flight,head.slot,Number(!head.black));
        gl.drawArraysInstanced(gl.TRIANGLES,0,24*6,7);
      }
      gl.disable(gl.BLEND);
    }
    ripples=resize(ripples,Math.ceil(W*.58),Math.ceil(H*.58),1);
    target(ripples);gl.clear(gl.COLOR_BUFFER_BIT);
    if(P>0 && P<.68){
      const ripple=programs.inkRipple;gl.useProgram(ripple.p);
      gl.uniform2f(ripple.U.uSize,W,H);gl.uniform1f(ripple.U.uProgress,P);gl.uniform1f(ripple.U.uAgeScale,1);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
      gl.bindVertexArray(dripGeometry);
      gl.drawArraysInstanced(gl.TRIANGLES,0,6,PRECIPITATION.length+1);
      gl.bindVertexArray(null);gl.disable(gl.BLEND);
    }
    if(P>CLEAR[0] && P<DRAIN.pause[1]){
      const n=landings(box,w,h);
      if(n>1){
        const ripple=programs.inkRipple;gl.useProgram(ripple.p);
        gl.uniform2f(ripple.U.uSize,W,H);gl.uniform1f(ripple.U.uProgress,P);gl.uniform1f(ripple.U.uAgeScale,LAND_AGE);
        gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
        gl.bindVertexArray(landGeometry);gl.drawArraysInstanced(gl.TRIANGLES,0,6,n);
        gl.bindVertexArray(null);gl.disable(gl.BLEND);
      }
    }
    if(P>CLEAR[0] && P<DRAIN.last[1]){
      // Each crown rings the falling plane as it breaks through (ink-drain.js), in the rain's own packets.
      const emerge=programs.inkEmerge,plane=waterPlane(P,box,w,h);gl.useProgram(emerge.p);
      gl.uniform2f(emerge.U.uScreen,w,h);gl.uniform4f(emerge.U.uBox,...box);gl.uniform3fv(emerge.U.uEye,cam.eye);
      gl.uniform4f(emerge.U.uDrain,plane.h,plane.s,CROWN_WAVES,1);gl.uniform1f(emerge.U.uProgress,P);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
      const n=crowns(box,w,h);gl.bindVertexArray(crownGeometry);
      gl.drawArraysInstanced(gl.TRIANGLES,0,6,n);
      gl.bindVertexArray(null);gl.disable(gl.BLEND);
    }
    gl.activeTexture(gl.TEXTURE0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    return true;
  }
  return {prepare,draw,ready:()=>warmed,progress:()=>uploaded/KEYS,failed:()=>failed,
    get textures(){return [layers.textures[0],layers.textures[1],figures.textures[0],threads.textures[0],ripples.textures[0],air.textures[0],bathRoom];},
    dispose(){
      stop();
      for(const target of [ripples,sheetDepth,layers,figures,threads,air])release(target);
      for(const tex of [pigment,knightPigment,figurePigment,bathRoom,noise])if(tex)gl.deleteTexture(tex);
      gl.deleteVertexArray(dripGeometry);gl.deleteBuffer(dripEvents);gl.deleteBuffer(dripCorners);
      gl.deleteVertexArray(crownGeometry);gl.deleteBuffer(crownRecords);
    }
  };
}
