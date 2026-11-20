// Photography → Chess: the water leaves as it came.
//   The tank (ink-tank.js DRAIN) plays the rise backward screen for screen, pauses on the opening pose while
// the darkroom's lights come on, then keeps falling until its far contact line slides off the bottom: the
// rise's own surface, drawn by the rise's own code (glsl/unmix.js umFill).
//   Ahead of that line the water leaves by height. One plane in the board's world (staunton.js units: the
// board's top y = 0, the page y = −SLAB, z toward the viewer) is the surface: y = h + s·(z − FRONT). h is
// solved each frame so the plane meets the page exactly on the tank's far line, so the line the tank draws
// and the line the plane leaves on the page are the same line; tipped by s toward the back, the plane is
// lower than the page behind that line and higher in front of it, so the crowns, then the bodies, then the
// board come out of the water before the line reaches them.
//   The shader reads it from one uniform (drainUniforms); home.js reads dryEdge for the band's words.
import { BOARD, TALL, TYPES, frameCamera, project, startSlots } from './staunton.js';
import { tankCamera, DRAIN, CLEAR, smooth } from './ink-tank.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

export { CLEAR };
// The front edge of the board's frame: the plane's tilt is measured from there.
export const FRONT = BOARD.half + BOARD.frame;
// The plane's tilt over the fall and the sink (eased between): steep enough that a crown breaks through
// well ahead of the line, never as steep as the camera's own view of the page (≈ 1.26), so whatever is
// above the far line on the screen is out of the water in both pictures.
export const TIP = Object.freeze([0.42, 0.30]);
export const tipAt = P => TIP[0] + (TIP[1] - TIP[0]) * smooth(DRAIN.sink[0], DRAIN.sink[1], P);
// The darkroom's lights come on during the pause: the highlights a beat before the fill.
export const LIGHTS = Object.freeze([
  DRAIN.pause[0] + 0.15 * (DRAIN.pause[1] - DRAIN.pause[0]),
  DRAIN.pause[0] + 0.85 * (DRAIN.pause[1] - DRAIN.pause[0]),
]);
const LEAD = 0.004;
export const lightsAt = (P, highlights = false) => smooth(LIGHTS[0] - (highlights ? LEAD : 0), LIGHTS[1] - (highlights ? LEAD : 0), P);
// The water's last sheen, gone by the end of DRAIN.last.
export const exposureAt = P => P < CLEAR[0] ? 1 : 1 - smooth(DRAIN.last[0], DRAIN.last[1], P);

// The tank's far contact line (uv, y up), without its chop.
export const farLine = P => { const c = tankCamera(P); return c[0] + 0.5 * c[1]; };

// ---- the board's camera over the whole screen ----------------------------------------------------
// The board is framed in its box (CSS px [x, y, w, h], y from the top) by frameCamera at the box's
// proportion; a screen point outside the box is the same camera's ray, extended.
const cams = new Map();
export function boxCamera(box) {
  const aspect = box[2] / box[3], key = aspect.toFixed(5);
  if (!cams.has(key)) { if (cams.size > 8) cams.clear(); cams.set(key, frameCamera(aspect)); }
  return cams.get(key);
}
export function screenRay(cam, box, x, y) {
  const u = (2 * (x - box[0]) / box[2] - 1) * cam.tanY * cam.aspect, v = (1 - 2 * (y - box[1]) / box[3]) * cam.tanY;
  const d = [cam.fwd[0] + cam.right[0] * u + cam.up[0] * v, cam.fwd[1] + cam.right[1] * u + cam.up[1] * v, cam.fwd[2] + cam.right[2] * u + cam.up[2] * v];
  const l = Math.hypot(...d);
  return d.map(c => c / l);
}
// A world point's place on the screen (CSS px, y from the top), or null behind the camera.
export function toScreen(cam, box, p) {
  const [u, v, depth] = project(cam, p);
  if (depth <= 1e-6) return null;
  return [box[0] + (u + 1) * box[2] / 2, box[1] + (1 - v) * box[3] / 2];
}

// ---- the plane --------------------------------------------------------------------------------------
// h at P: the plane through the page point the far line's row sees (centre column). A row at or above
// the page's horizon sees no page: the water then stands over everything (h large).
export function waterPlane(P, box, W, H) {
  const s = tipAt(P), page = -BOARD.slab;
  const row = (1 - farLine(P)) * H, cam = boxCamera(box), d = screenRay(cam, box, W / 2, row);
  if (d[1] > -1e-4) return { h: 99, s, row, z: -Infinity };
  const z = cam.eye[2] + d[2] * (page - cam.eye[1]) / d[1];
  return { h: page - s * (z - FRONT), s, row, z };
}
// Everything the shader needs at P: [the plane's height, its tilt, the lights (fill), the lights
// (highlights)]. Before the water returns, the plane is far above everything.
export function drainUniforms(P, box, W, H) {
  if (P < CLEAR[0]) return [99, 0, 0, 0];
  const { h, s } = waterPlane(P, box, W, H);
  return [h, s, lightsAt(P), lightsAt(P, true)];
}
// Where the page is dry: the screen row (CSS px from the top) of the far line. Everything above it is
// dry, everything below still under water. 0: none of it; H: all of it (and once the sheen is gone).
export function dryEdge(P, box, H) {
  if (P < CLEAR[0]) return 0;
  if (exposureAt(P) <= 0) return H;
  return clamp((1 - farLine(P)) * H, 0, H);
}

// ---- the crowns breaking the surface ----------------------------------------------------------------
// Each piece of the starting position, where it stands, and the moment the falling plane first uncovers
// its crown (a ring of capillary waves leaves it then: glsl/ink-impact.js INK_EMERGE). For a layout.
export function emergence(box, W, H) {
  return startSlots().map(s => {
    const top = TALL[TYPES[s.type]];
    const above = P => { const { h, s: tip } = waterPlane(P, box, W, H); return h + tip * (s.z - FRONT) <= top; };
    let lo = CLEAR[0], hi = DRAIN.last[1];
    if (above(lo)) return { x: s.x, z: s.z, P: lo, top };
    if (!above(hi)) return { x: s.x, z: s.z, P: hi, top };
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (above(m)) hi = m; else lo = m; }
    return { x: s.x, z: s.z, P: (lo + hi) / 2, top };
  });
}
