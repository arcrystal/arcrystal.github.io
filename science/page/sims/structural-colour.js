// Structural colour: wing scales whose blue is made by their shape, not a pigment. Each scale is
// treated as a thin layer of chitin (refractive index 1.56) about 75 nm thick: light reflected from
// its top and bottom surfaces interferes, and the wavelengths that add up depend on the angle you
// look from. Moving the pointer tilts the wing. Colours are summed over the visible spectrum with
// an analytic fit to the CIE colour-matching functions. A canvas without WebGL keeps its still.
export const CHITIN = 1.56;
// Reflectance of a thin film for wavelength lambda (nm), thickness d (nm), index n and the cosine
// of the refraction angle inside it, sharpened to stand in for the stack of layers in a real scale.
export function reflectance(lambda, d, n, cosT, layers = 30) {
  const delta = (4 * Math.PI * n * d * cosT) / lambda;
  return Math.sin(delta / 2) ** (2 * layers);
}
// The first-order peak: 2·n·d·cosθ = λ/2 (with the half-wave shift at the top surface).
export const peakWavelength = (d, n = CHITIN, cosT = 1) => 4 * n * d * cosT;

export const caption = 'A morpho butterfly’s blue comes from nanoscale structure in its wing scales: reflections interfere, so the colour shifts with the angle of view.';
export const sources = [{ title: 'Vukusic and Sambles (2003), Nature 424, 852', url: 'https://doi.org/10.1038/nature01941' }];

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uTilt;
out vec4 o;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// CIE 1931 colour matching, Wyman, Sloan and Shirley (2013) multi-lobe fit.
vec3 cie(float l) {
  float t1 = (l - 442.0) * (l < 442.0 ? 0.0624 : 0.0374), t2 = (l - 599.8) * (l < 599.8 ? 0.0264 : 0.0323), t3 = (l - 501.1) * (l < 501.1 ? 0.0490 : 0.0382);
  float x = 0.362 * exp(-0.5 * t1 * t1) + 1.056 * exp(-0.5 * t2 * t2) - 0.065 * exp(-0.5 * t3 * t3);
  float u1 = (l - 568.8) * (l < 568.8 ? 0.0213 : 0.0247), u2 = (l - 530.9) * (l < 530.9 ? 0.0613 : 0.0322);
  float y = 0.821 * exp(-0.5 * u1 * u1) + 0.286 * exp(-0.5 * u2 * u2);
  float v1 = (l - 437.0) * (l < 437.0 ? 0.0845 : 0.0278), v2 = (l - 459.0) * (l < 459.0 ? 0.0385 : 0.0725);
  float z = 1.217 * exp(-0.5 * v1 * v1) + 0.681 * exp(-0.5 * v2 * v2);
  return vec3(x, y, z);
}
vec3 xyz2rgb(vec3 c) { return mat3(3.2406, -0.9689, 0.0557, -1.5372, 1.8758, -0.2040, -0.4986, 0.0415, 1.0570) * c; }
void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  // Scales in overlapping rows, like roof tiles: each a long rounded blade, its base tucked under
  // the row above, leaning a little.
  vec2 cell = vec2(22.0, 30.0);
  vec3 rgb = vec3(0.012, 0.016, 0.035);
  for (int k = 0; k < 2; k++) {
    float row = floor(px.y / cell.y) - float(k);
    vec2 q = vec2(px.x + mod(row, 2.0) * cell.x * 0.5, px.y);
    vec2 id = vec2(floor(q.x / cell.x), row);
    vec2 f = vec2(fract(q.x / cell.x) - 0.5, (px.y - row * cell.y) / cell.y - 0.2);
    float h = hash(id);
    float lean = (h - 0.5) * 0.25;
    f.x += f.y * lean;
    // Blade: narrow ellipse, slightly toothed at the tip.
    float e = length(f / vec2(0.46, 0.92)) + 0.015 * sin(f.x * 60.0) * step(0.3, f.y);
    float body = smoothstep(1.0, 0.94, e) * step(-0.25, f.y);
    if (body <= 0.0) continue;
    float ridge = 0.72 + 0.28 * sin(f.x * 150.0);
    // The angle of view: the wing tilted by the pointer, plus each scale's own lean and curve.
    float tilt = clamp(length(uTilt + vec2(lean, f.y * 0.35)) * 1.15, 0.0, 1.35);
    float sinT = sin(tilt) / 1.56;
    float cosT = sqrt(1.0 - sinT * sinT);
    float d = 78.0 * (1.0 + (hash(id + 3.1) - 0.5) * 0.1);
    vec3 xyz = vec3(0.0);
    for (int i = 0; i < 16; i++) {
      float l = 400.0 + float(i) * 20.0;
      float delta = 12.5663706 * 1.56 * d * cosT / l;
      xyz += cie(l) * pow(abs(sin(delta * 0.5)), 60.0);
    }
    // The reflected colour at full strength; how much of it there is shows as brightness.
    vec3 c = max(xyz2rgb(xyz), 0.0);
    float peak = max(max(c.r, c.g), max(c.b, 1e-4));
    c = c / peak * clamp(peak * 1.6, 0.25, 1.0);
    // Each blade darkens toward its base, where the next row shades it, and catches a sheen.
    c *= ridge * (0.45 + 0.55 * smoothstep(-0.25, 0.6, f.y));
    c += vec3(0.6, 0.8, 1.0) * pow(max(0.0, 1.0 - abs(f.x + uTilt.x * 0.3) * 6.0), 6.0) * 0.08;
    rgb = mix(rgb, c, body);
    break;
  }
  o = vec4(pow(rgb, vec3(1.0 / 2.2)), 1.0);
}`;

export function mount(el, { reducedMotion = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
  if (!gl) return { destroy() {} };
  el.append(canvas);
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return { destroy() {} }; }
  gl.useProgram(prog);
  const U = { res: gl.getUniformLocation(prog, 'uRes'), time: gl.getUniformLocation(prog, 'uTime'), tilt: gl.getUniformLocation(prog, 'uTilt') };
  let tx = 0.25, ty = 0.1, gx = tx, gy = ty, raf = 0, visible = false, dead = false, t0 = performance.now();
  const size = () => {
    const r = el.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw();
  };
  const draw = () => {
    gx += (tx - gx) * 0.08; gy += (ty - gy) * 0.08;
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.time, (performance.now() - t0) / 1000);
    gl.uniform2f(U.tilt, gx, gy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = () => { if (dead) return; draw(); raf = visible && !reducedMotion && !document.hidden ? requestAnimationFrame(loop) : 0; };
  const wake = () => { if (!raf && visible && !reducedMotion) raf = requestAnimationFrame(loop); };
  // Without a pointer the wing rocks gently on its own.
  let idle = 0;
  const auto = () => { idle += 0.012; if (!reducedMotion) { tx = 0.3 + 0.35 * Math.sin(idle); ty = 0.15 * Math.cos(idle * 0.7); } };
  const autoTimer = setInterval(() => { if (visible && !el.matches(':hover')) auto(); }, 16);
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 1.4; ty = ((e.clientY - r.top) / r.height - 0.5) * 1.4;
    if (reducedMotion) { gx = tx; gy = ty; draw(); }
  });
  const ro = new ResizeObserver(size); ro.observe(el);
  const io = new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); wake(); }); io.observe(el);
  return { destroy() { dead = true; cancelAnimationFrame(raf); clearInterval(autoTimer); ro.disconnect(); io.disconnect(); canvas.remove(); } };
}
