// CIE 2019 datasets: doi:10.25039/CIE.DS.xvudnb9b and doi:10.25039/CIE.DS.hjfjmt59.
// Reproducible D65 / 1931 2-degree retarder integral, XYZ -> linear sRGB, white Y = 1.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const read = name => new Map(fs.readFileSync(new URL(`data/${name}.csv`, import.meta.url), 'utf8').trim().split(/\r?\n/).map(l => l.split(',').map(Number)).map(([l,...v])=>[l,v]));
const xyz = read('CIE_xyz_1931_2deg'), d65 = read('CIE_std_illum_D65');
export function integral(gamma, step=5) {
  const v=[0,0,0];let norm=0;
  for(let l=380;l<=780;l+=step){const c=xyz.get(l),e=d65.get(l)[0]*(l===380||l===780?0.5:1),s=Math.sin(Math.PI*gamma/l)**2;norm+=e*c[1];for(let k=0;k<3;k++)v[k]+=e*c[k]*s;}
  const [x,y,z]=v.map(a=>a/norm);
  return [3.2406*x-1.5372*y-0.4986*z,-0.9689*x+1.8758*y+0.0415*z,0.0557*x-0.204*y+1.057*z];
}
export function spectrum(){const a=new Float32Array(2048*4);for(let i=0;i<2048;i++)a.set([...integral(i/2047*2200),1],4*i);return a;}
if(process.argv[1]===fileURLToPath(import.meta.url)){const a=spectrum();fs.writeFileSync(new URL('../../static/site/scene/data/ice-spectrum.bin',import.meta.url),Buffer.from(a.buffer));let err=0;for(let g=0;g<=2200;g+=2.3){const a=integral(g),b=integral(g,1);err=Math.max(err,...a.map((x,k)=>Math.abs(x-b[k])));}console.log({samples:2048,maxIntegrationError:err});if(err>.005)process.exitCode=1;}
