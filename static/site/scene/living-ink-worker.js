function noiseTile(ease){
  const N=40,out=new Uint8Array(N**3*4);
  const hash=(x,y,z,k)=>{let h=Math.imul(x+173*k,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791);h=Math.imul(h^(h>>>16),0x45d9f3b);return ((h^(h>>>16))>>>0)/4294967295;};
  function periodic(x,y,z,n,k){
    const a=x*n/N,b=y*n/N,c=z*n/N,ix=Math.floor(a),iy=Math.floor(b),iz=Math.floor(c);
    const u=ease(0,1,a-ix),v=ease(0,1,b-iy),w=ease(0,1,c-iz);
    let h=0;
    for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)
      h+=hash((ix+dx)%n,(iy+dy)%n,(iz+dz)%n,k)*(dx?u:1-u)*(dy?v:1-v)*(dz?w:1-w);
    return h;
  }
  for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const i=4*(x+N*(y+N*z));
    // Periodic cellular cavities give billows a coherent lit side and a torn lip.
    const X=x*4/N,Y=y*4/N,Z=z*4/N;
    let nearest=3;
    for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const a=Math.floor(X)+dx,b=Math.floor(Y)+dy,c=Math.floor(Z)+dz;
      const A=(a+4)%4,B=(b+4)%4,C=(c+4)%4;
      nearest=Math.min(nearest,(a+.14+.72*hash(A,B,C,3)-X)**2
        +(b+.14+.72*hash(A,B,C,4)-Y)**2+(c+.14+.72*hash(A,B,C,5)-Z)**2);
    }
    out[i+3]=255*Math.min(1,Math.sqrt(nearest));
    for(let k=0;k<3;k++)out[i+k]=255*(.69*periodic(x,y,z,3,k)+.23*periodic(x,y,z,7,k)+.08*periodic(x,y,z,13,k));
  }
  return out;
}

async function prepare(data){
  const {bakeLivingInk,ease}=await import(data.planner);
  bakeLivingInk(data.aspect,data.mobile,packet=>{
    const transfer=packet.density?[packet.density.buffer,packet.mesh.buffer]:packet.ledger?[packet.ledger.buffer,packet.massBook.buffer,packet.tracks.buffer]:[];
    if(packet.meta && data.needsNoise){packet.noise=noiseTile(ease);transfer.push(packet.noise.buffer);}
    self.postMessage(packet,transfer);
  });
}

self.onmessage=({data})=>{
  prepare(data).catch(()=>self.postMessage({failed:true}));
};
