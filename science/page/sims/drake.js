// The Drake equation (Frank Drake, 1961): the number of civilisations in our galaxy we could hear
// from is the product of seven factors, most of them unknown. Each slider sets one; ranges span the
// guesses people actually argue about, on a log scale where they cover orders of magnitude.
export const FACTORS = [
  { key: 'R', label: 'New stars per year', min: 0.5, max: 10, value: 1.5, log: false, fmt: v => v.toFixed(1) },
  { key: 'fp', label: 'Share with planets', min: 0.1, max: 1, value: 1, log: false, fmt: v => v.toFixed(2) },
  { key: 'ne', label: 'Habitable planets per system', min: 0.01, max: 5, value: 0.2, log: true, fmt: v => v.toPrecision(2) },
  { key: 'fl', label: 'Where life starts', min: 1e-6, max: 1, value: 0.1, log: true, fmt: v => v.toPrecision(2) },
  { key: 'fi', label: 'Where it becomes intelligent', min: 1e-6, max: 1, value: 0.1, log: true, fmt: v => v.toPrecision(2) },
  { key: 'fc', label: 'That send signals', min: 1e-3, max: 1, value: 0.1, log: true, fmt: v => v.toPrecision(2) },
  { key: 'L', label: 'Years they keep sending', min: 10, max: 1e9, value: 1e4, log: true, fmt: v => Math.round(v).toLocaleString('en-US') },
];
export const drake = f => f.R * f.fp * f.ne * f.fl * f.fi * f.fc * f.L;

export const caption = 'N = R* · fp · ne · fl · fi · fc · L: Frank Drake’s 1961 way of organising our ignorance about who else is out there.';
export const sources = [{ title: 'SETI Institute, The Drake equation', url: 'https://www.seti.org/drake-equation-index' }];

const toSlider = (f, v) => (f.log ? (Math.log10(v) - Math.log10(f.min)) / (Math.log10(f.max) - Math.log10(f.min)) : (v - f.min) / (f.max - f.min));
const fromSlider = (f, x) => (f.log ? 10 ** (Math.log10(f.min) + x * (Math.log10(f.max) - Math.log10(f.min))) : f.min + x * (f.max - f.min));

export function mount(el) {
  const box = document.createElement('div');
  box.className = 'sx-drake';
  const values = Object.fromEntries(FACTORS.map(f => [f.key, f.value]));
  box.innerHTML = `<p class="sx-drake-n"><span>N =</span> <output data-n></output> <small>civilisations we could hear</small></p>
    <div class="sx-drake-rows">${FACTORS.map(f => `<label><span>${f.label}</span><input type="range" min="0" max="1" step="0.001" data-k="${f.key}" value="${toSlider(f, f.value)}"><output data-v="${f.key}"></output></label>`).join('')}</div>`;
  el.append(box);
  const n = box.querySelector('[data-n]');
  const show = () => {
    FACTORS.forEach(f => { box.querySelector(`[data-v="${f.key}"]`).textContent = f.fmt(values[f.key]); });
    const N = drake(values);
    n.textContent = N >= 1 ? Math.round(N).toLocaleString('en-US') : N.toPrecision(2);
  };
  box.addEventListener('input', e => {
    const f = FACTORS.find(x => x.key === e.target.dataset.k);
    if (f) { values[f.key] = fromSlider(f, Number(e.target.value)); show(); }
  });
  show();
  el.classList.add('sx-sim--form');
  return { destroy() { box.remove(); } };
}
