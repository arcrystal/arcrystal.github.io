// Outdoors' plate: the White Mountains' heights (ft) on a 128 × 128 grid, little-endian uint16, row 0
// the map's south edge (static/site/scene/terrain-plan.js makePlate). The art-glass world draws its
// window from it the moment a page opens. Usage: node tools/site/plate.mjs (writes the file; --check
// only compares).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makePlate } from '../../static/site/scene/terrain-plan.js';
export const PLATE_FILE = new URL('../../static/site/scene/data/plate.bin', import.meta.url);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = makePlate(), bytes = Buffer.from(a.buffer, a.byteOffset, a.byteLength);
  if (process.argv.includes('--check')) {
    const same = fs.existsSync(PLATE_FILE) && Buffer.compare(fs.readFileSync(PLATE_FILE), bytes) === 0;
    console.log({ plate: same ? 'current' : 'stale' });
    if (!same) process.exitCode = 1;
  } else {
    fs.writeFileSync(PLATE_FILE, bytes);
    console.log({ plate: a.length, max: Math.max(...a) });
  }
}
