// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// The criteria, folded under the ranked spots in the left panel: five plain sliders (Sun, Earth, longest dark, slope,
// ice) with the limit on the right; "Reset" shows when any differs from the default. Sun / Earth / dark move between
// the computed levels (layers.json criterion_levels); slope and ice are thresholds; ice at 0 is off.
import { state, setState } from './state.js';
import { hue } from './config.js';
import { lang } from './strings.js';
import { defaults, isDefault } from './crit.js';
import { FX, trackCss } from './factor.js';

const TX = { en: { title: 'Criteria', reset: 'Reset', off: 'Off', sun: 'Sun', earth: 'Earth', dark: 'Dark', slope: 'Slope', ice: 'Ice' }, ko: { title: '기준', reset: '초기화', off: '끔', sun: '햇빛', earth: '지구', dark: '어둠', slope: '경사', ice: '얼음' } }[lang === 'ko' ? 'ko' : 'en'];
let el, data, setCrit, rows = {}, open = true;

export function initCritPanel(host, d, setCritFn) {
  data = d; setCrit = setCritFn;
  el = document.createElement('section'); el.className = 'lyr-cp';
  el.innerHTML = `<div class="lyr-cph"><button class="lyr-cpt" aria-expanded="true"><i>▾</i>${TX.title}</button><button class="lyr-cpr" hidden>${TX.reset}</button></div><div class="lyr-cpb"></div>`;
  host.append(el);
  const body = el.querySelector('.lyr-cpb');
  el.querySelector('.lyr-cpt').onclick = () => { open = !open; render(state); };
  el.querySelector('.lyr-cpr').onclick = async () => {
    const th = { ...state.threshold }; for (const m of data.layers) if (m.threshold != null && th[m.id] !== m.threshold) th[m.id] = m.threshold;
    const iceId = layerOf('ice');
    setState({ threshold: th, on: { ...state.on, mask: { ...state.on.mask, ...(iceId ? { [iceId]: false } : {}) } } });
    await setCrit(null, null, defaults());
  };
  const CL = data.meta.criterion_levels || {};
  for (const k of ['sun', 'earth', 'dark', 'slope', 'ice']) {
    const id = layerOf(k); if (!id) continue;
    const cl = Object.entries(CL).find(([lid]) => hue(lid) === k);
    const r = document.createElement('label'); r.className = 'lyr-cpl';
    r.innerHTML = `<button type="button" class="lyr-cpk" aria-pressed="false">${TX[k]}</button><input type="range"><b class="n"></b>`;
    const inp = r.querySelector('input'), m = data.layers.find(q => q.id === id), f = FX[k];
    // the name shows this factor on the map (again: off)
    r.querySelector('.lyr-cpk').onclick = e => { e.preventDefault(); setState({ factor: state.factor === k ? null : k }, 'pixels'); };
    if (cl) {
      // the track is the value scale (same as the colour steps); the thumb snaps to the computed levels
      const lv = Object.keys(cl[1].levels).map(Number).sort((a, b) => a - b), P = cl[1].param;
      Object.assign(inp, { min: f.lo, max: f.hi, step: 1 });
      const near = v => lv.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
      inp.oninput = () => { const v = near(+inp.value); if (v !== state.crit[P]) setCrit(P, v); };
      inp.onchange = () => { inp.value = String(state.crit[P]); render(state); };
      inp.onkeydown = e => {
        const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key]; if (!d) return;
        e.preventDefault(); const j = lv.indexOf(state.crit[P]) + d; if (j >= 0 && j < lv.length) { inp.value = String(lv[j]); setCrit(P, lv[j]); }
      };
      rows[k] = { inp, b: r.querySelector('b'), get: () => { const v = state.crit[P]; return { i: v, txt: `${cl[1].dir === '<=' ? '≤' : '≥'} ${v} ${cl[1].unit === '%' ? '%' : 'h'}` }; } };
    } else if (k === 'slope') {
      Object.assign(inp, { min: 0, max: 20, step: 1 });
      inp.oninput = () => { if (+inp.value < 1) inp.value = '1'; setState({ threshold: { ...state.threshold, [id]: +inp.value } }); };
      rows[k] = { inp, b: r.querySelector('b'), get: () => { const v = Math.round(state.threshold[id] ?? m.threshold); return { i: v, txt: `≤ ${v}°` }; } };
    } else {
      Object.assign(inp, { min: 0, max: 25, step: 0.5 });
      inp.oninput = () => { const v = +inp.value; setState({ threshold: { ...state.threshold, [id]: v > 0 ? v : state.threshold[id] }, on: { ...state.on, mask: { ...state.on.mask, [id]: v > 0 } } }); };
      rows[k] = { inp, b: r.querySelector('b'), get: () => { const on = !!state.on.mask[id], v = state.threshold[id]; return { i: on ? v : 0, txt: on ? `≤ ${(+v).toFixed(v % 1 ? 1 : 0)} km` : TX.off }; } };
    }
    rows[k].row = r;
    body.append(r);
  }
}
const layerOf = k => data.layers.find(m => m.threshold != null && hue(m.id) === k)?.id || (k === 'ice' && data.layers.find(m => m.id === 'ice') ? 'ice' : null);

export function render(st) {
  if (!el) return;
  el.classList.toggle('closed', !open);
  el.querySelector('.lyr-cpt').setAttribute('aria-expanded', String(open));
  let changed = !isDefault(data.meta, st.crit);
  for (const [k, r] of Object.entries(rows)) {
    const g = r.get(); if (+r.inp.value !== g.i && document.activeElement !== r.inp) r.inp.value = String(g.i);
    r.inp.style.setProperty('--p', ((g.i - r.inp.min) / (r.inp.max - r.inp.min) * 100).toFixed(1) + '%');
    r.b.textContent = g.txt;
    const fx = st.factor === k; r.row.classList.toggle('fx', fx); r.row.querySelector('.lyr-cpk').setAttribute('aria-pressed', String(fx));
    if (fx) r.inp.style.setProperty('--trk', trackCss(st, k)); else r.inp.style.removeProperty('--trk');
    if (k === 'slope') { const m = data.layers.find(q => q.id === layerOf('slope')); if (m && Math.round(st.threshold[m.id]) !== m.threshold) changed = true; }
    if (k === 'ice' && st.on.mask[layerOf('ice')]) changed = true;
  }
  el.querySelector('.lyr-cpr').hidden = !changed;
}
