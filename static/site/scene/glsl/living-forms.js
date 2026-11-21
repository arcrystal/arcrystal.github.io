// The live ink's glossy bodies (ink-sim.js, live-ink.js): drawn at the canvas's own resolution from the
// fluid's body fields (black and ivory shares on a grid twice the fluid's). The edge is the 0.5 contour of
// a Catmull–Rom reconstruction, antialiased by its own screen derivative, so it stays a clean curve however
// far the grid is magnified; a thread thinner than the contour still shows, as thin as it is. The bulge
// (the normals) comes from the bodies' smoothed thickness. The material is the old forms': wet obsidian,
// milky ivory, lit from the bright ceiling of the water and reflecting its chamber. Where black meets ivory
// the shares give the marbling, sharpened. Output: premultiplied colour, or (uDepthOnly) the bodies' depth
// into the figures' (as the pieces write it: 1 − z), so the mist and the pieces part round them.
export const INK_BODIES = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uB, uThick, uSlope, uC;
uniform vec2 uSize, uCells;        // the target (px); the body grid
uniform float uLive;
uniform int uDepthOnly;
out vec4 o;
// Catmull–Rom from nine bilinear taps (the weights of each middle pair folded into one tap between them).
vec4 catmull(vec2 uv) {
  vec2 p = uv * uCells - .5, f = fract(p), c = floor(p) + .5;
  vec2 w0 = f * (-.5 + f * (1. - .5 * f)), w1 = 1. + f * f * (-2.5 + 1.5 * f), w2 = f * (.5 + f * (2. - 1.5 * f)), w3 = f * f * (-.5 + .5 * f);
  vec2 w12 = w1 + w2, o12 = w2 / w12;
  vec2 t0 = (c - 1.) / uCells, t3 = (c + 2.) / uCells, t12 = (c + o12) / uCells;
  return texture(uB, vec2(t0.x, t0.y)) * w0.x * w0.y + texture(uB, vec2(t12.x, t0.y)) * w12.x * w0.y + texture(uB, vec2(t3.x, t0.y)) * w3.x * w0.y
       + texture(uB, vec2(t0.x, t12.y)) * w0.x * w12.y + texture(uB, vec2(t12.x, t12.y)) * w12.x * w12.y + texture(uB, vec2(t3.x, t12.y)) * w3.x * w12.y
       + texture(uB, vec2(t0.x, t3.y)) * w0.x * w3.y + texture(uB, vec2(t12.x, t3.y)) * w12.x * w3.y + texture(uB, vec2(t3.x, t3.y)) * w3.x * w3.y;
}
float ivory_pre(vec4 b) { return smoothstep(.4, .6, b.g / max(b.r + b.g, 1e-3)); }
float thick(vec2 uv) { vec2 t = texture(uThick, uv).rg; return t.r + t.g; }
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec4 near = texture(uB, uv);
  if (uLive <= 0. || (near.r + near.g < .02 && thick(uv) < .02)) discard;
  vec4 b = catmull(uv);
  float t = max(b.r + b.g, 0.);
  // How condensed the ink is here (0: mist just thickening; 1: oobleck), from the body's own share and
  // its surroundings' (the wide thickness), so a whole body turns together: condensing ink comes in as a
  // soft, matte, translucent cloud and gains a clean edge, bulge and gloss only as it sets; melting ink
  // goes back the same way. Nothing pops at the contour.
  vec4 tk = texture(uThick, uv);
  float set = smoothstep(.3, .85, .5 * t + .5 * (tk.b + tk.a));
  float aa = max(fwidth(t) * .75, 1e-3), w = mix(.32, aa, set);
  float a = smoothstep(.5 - w, .5 + w, t);
  // (A thread thinner than the contour: as much of it as there is; a cloud: as dense as it is.)
  a = max(a, smoothstep(.06, .45, t) * mix(.9, 1.1, set) * t);
  a *= uLive;
  if (a < .004) discard;
  float z = clamp(b.b / max(t, 1e-3), .02, .98);
  if (uDepthOnly == 1) {
    if (a < .5) discard;
    gl_FragDepth = 1. - z;
    o = vec4(0);
    return;
  }
  // The bulge: the smoothed thickness as a height.
  // The surface's slope (per body cell; live-ink.js keeps it, interpolated here so the normals are smooth).
  vec2 sl = texture(uSlope, uv).rg;
  float gain = mix(.15, 1., set), hx = sl.x, hy = sl.y;
  vec3 n = normalize(vec3(-hx * gain, -hy * gain, 1.));
  // Marbling: the shares, sharpened to bands with a soft edge a pixel or two wide.
  float s = b.g / max(t, 1e-3), sw = max(fwidth(s), .02);
  float ivory = smoothstep(.5 - sw, .5 + sw, s);
  vec3 v = vec3(0, 0, 1), L = normalize(vec3(-.3, .85, .42)), refl = reflect(-v, n);
  float nv = max(dot(n, v), 0.), fres = .04 + .96 * pow(1. - nv, 5.), nl = dot(n, L);
  vec3 chamber = mix(vec3(.09, .10, .11), vec3(.88, .86, .82), smoothstep(-.3, .9, refl.y)) + vec3(.5, .48, .45) * pow(max(0., dot(refl, normalize(vec3(.35, .8, .45)))), 40.);
  float spec = pow(max(0., dot(refl, L)), 90.) * 1.6 + pow(max(0., dot(refl, normalize(vec3(.55, .5, .67)))), 220.) * 1.2;
  // Where black is stretched (its conformation, A − I) fine lines run along the stretch, as in pulled
  // taffy: its principal direction from A, the lines' spacing about two pixels.
  vec4 Cv = texture(uC, uv);
  float stretch = Cv.x + Cv.z;
  float ang = .5 * atan(2. * Cv.y, Cv.x - Cv.z);
  vec2 along = vec2(cos(ang), sin(ang)), px = gl_FragCoord.xy;
  float lines = .5 + .5 * sin(dot(px, vec2(-along.y, along.x)) * 2.2 + 3. * sin(dot(px, along) * .013));
  // (Only a faint sheen where it is drawn well out: lines any stronger read as ribbed cloth, not liquid.)
  float taut = .35 * smoothstep(1.5, 8., stretch) * (1. - ivory_pre(b)) * set;
  float streak = mix(.5 + .5 * sin(dot(uv * vec2(uSize.x / uSize.y, 1.), vec2(31., 47.)) * 3. + 9. * hx * gain + 7. * hy * gain), lines, taut);
  vec3 black = vec3(.008, .007, .009) * (.4 + .6 * max(nl, 0.)) + (.06 + fres) * chamber * (.75 + .25 * streak) + spec * vec3(.95, .93, .9) * (1. + .8 * taut * lines)
             + .02 * taut * lines * chamber
             + vec3(.11, .08, .085) * pow(1. - nv, 2.2);
  float wrap = max((nl + .5) / 1.5, 0.);
  vec3 milk = mix(vec3(.50, .52, .54), vec3(.94, .925, .88), wrap) * (.92 + .08 * streak);
  milk += vec3(.26, .21, .16) * pow(1. - nv, 1.6);
  milk *= .88 + .12 * smoothstep(-.4, .8, n.y);
  milk = milk * (1. - .3 * fres) + fres * chamber * .35 + spec * .5;
  // (Thin ivory lets the water's light through.)
  milk = mix(vec3(.62), milk, smoothstep(.35, .9, thick(uv) * 1.4));
  vec3 c = mix(black, milk, ivory);
  // (Unset, it is ink in water still: the mist's own soot and steam, lit from the ceiling, no gloss.)
  vec3 cloud = mix(mix(vec3(.035, .033, .036), vec3(.16, .15, .15), .4 * nv), mix(vec3(.55, .56, .57), vec3(.86, .85, .81), .6), ivory);
  c = mix(cloud, c, smoothstep(.15, .9, set));
  c *= .82; c = pow(clamp((c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14), 0., 1.), vec3(1. / 2.2));
  o = vec4(c * a, a);
}`;
