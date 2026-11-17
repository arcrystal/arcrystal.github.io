// What the transitions draw, shared by the click covers (opens.js) and the seams (transit.js). Each
// destination is told apart by its process, not its colours (flight.js has the maths):
//   Science      a vortex: cubes drawn in, spun and stretched along an axis (vortexCore, the light at its heart)
//   (Photography's fire is glsl/fire.js; Chess's ink, glsl/plume.js.)
export const REACH_LOOK = /* glsl */ `
// ---- Science: the vortex's core --------------------------------------------------------------------
// Light along the axis where the vortex is busy (amt 0..1, the caller's, by height): a narrow orange
// heart, where it turns fastest, in a wider sheath of blue and teal, with streaks running along the
// axis the way the flow goes (dir: 1 down, -1 up). ax: the axis; rc: the core's radius. Added over
// everything.
vec3 vortexCore(vec2 q, float ax, float dir, float rc, float amt) {
  if (amt <= 0.001) return vec3(0.0);
  float dx = abs(q.x - ax);
  float streak = 0.55 + 0.45 * noise(vec2(dx * 0.06 + sign(q.x - ax) * 3.0, q.y * 0.012 - dir * T * 1.6));
  vec3 heart = vortexHue(1.0) * exp(-pow(dx / (rc * 0.16), 2.0)) * 0.95;
  vec3 sheath = mix(vortexHue(0.45), vortexHue(0.0), smoothstep(0.3, 1.2, dx / rc)) * exp(-pow(dx / (rc * 0.8), 2.0)) * 0.38;
  return (heart + sheath) * streak * amt;
}
`;
