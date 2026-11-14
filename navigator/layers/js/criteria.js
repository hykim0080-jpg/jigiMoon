// Default left-top panel: one line + one handle per criterion (layers that carry a threshold). Hover = "why" view (focusCrit).
import { state, setState } from './state.js';
import { hue } from './config.js';
import { layerColor } from './ramps.js';
import { fmt } from './data.js';
import { t, layerName } from './strings.js';

let el, data, rows = {}, drag = null;
const CRIT_KEY = { sun: ['c_sun', 'min_sun_pct'], earth: ['c_earth', 'min_earth_pct'], dark: ['c_dark', 'max_dark_h'] };
const stepOf = m => (m.max - m.min) / 250;
export function critName(m) {
  const k = CRIT_KEY[hue(m.id)], p = k && data.meta.criteria?.[k[1]];
  if (k && p != null) return t(k[0], p);
  return hue(m.id) === 'slope' ? t('c_slope') : layerName(m);
}
export function critValue(m, v) {
  const n = fmt(m, v);
  if (m.unit === '일' && m.direction !== '<=') return t('ge_d', n);
  if (m.unit === '°' && m.direction === '<=') return t('le_deg', n);
  return `${m.direction === '<=' ? '≤' : '≥'} ${n}${m.unit}`;
}
export function initCriteria(root, d) {
  el = root; data = d;
  for (const m of data.layers.filter(m => m.threshold != null)) {
    const r = document.createElement('div'); r.className = 'lyr-cr'; r.dataset.id = m.id; r.title = data.meta.definitions?.[m.id] || '';
    const c = layerColor(m.id, false);
    r.innerHTML = `<div class="lyr-cl1"><button class="lyr-tg" aria-pressed="true" style="--c:${c}"></button><span class="lyr-nm">${critName(m)}</span><span class="n lyr-cv"></span></div><div class="lyr-ct" tabindex="0" role="slider"><i class="lyr-ctk"></i><b class="lyr-hd2"></b><u class="lyr-pt2"></u></div>`;
    const q = s => r.querySelector(s), tr = q('.lyr-ct');
    rows[m.id] = { r, m, tg: q('.lyr-tg'), cv: q('.lyr-cv'), tr, hd: q('.lyr-hd2'), tick: q('.lyr-pt2') };
    q('.lyr-tg').onclick = () => setState({ on: { ...state.on, mask: { ...state.on.mask, [m.id]: !state.on.mask[m.id] } } });
    const setT = x => {
      const f = Math.max(0, Math.min(1, x)), val = m.min + Math.round(f * 250) * stepOf(m);
      if (val !== state.threshold[m.id]) setState({ threshold: { ...state.threshold, [m.id]: val } });
    };
    const fromEv = e => { const b = tr.getBoundingClientRect(); return (e.clientX - b.left) / b.width; };
    tr.onpointerdown = e => { e.preventDefault(); tr.setPointerCapture(e.pointerId); drag = m.id; setT(fromEv(e)); tr.onpointermove = ev => setT(fromEv(ev)); };
    tr.onpointerup = () => { tr.onpointermove = null; drag = null; if (!r.matches(':hover')) setState({ focusCrit: null }); };
    tr.ondblclick = () => setState({ threshold: { ...state.threshold, [m.id]: m.threshold } });
    tr.onkeydown = e => {
      const dd = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!dd) return; e.preventDefault(); e.stopPropagation();
      const v = Math.max(0, Math.min(250, Math.round((state.threshold[m.id] - m.min) / stepOf(m)) + dd));
      setState({ threshold: { ...state.threshold, [m.id]: m.min + v * stepOf(m) } });
    };
    r.onpointerenter = () => { if (state.focusCrit !== m.id) setState({ focusCrit: m.id }); };
    r.onpointerleave = () => { if (!drag && state.focusCrit === m.id) setState({ focusCrit: null }); };
    r.addEventListener('focusin', () => { if (state.focusCrit !== m.id) setState({ focusCrit: m.id }); });
    r.addEventListener('focusout', () => { if (!drag && state.focusCrit === m.id) setState({ focusCrit: null }); });
    el.append(r);
  }
}
export function renderCriteria(st) {
  for (const { r, m, tg, cv, tr, hd } of Object.values(rows)) {
    const thr = st.threshold[m.id], p = 100 * (thr - m.min) / (m.max - m.min), ge = m.direction !== '<=', c = layerColor(m.id, false), on = !!st.on.mask[m.id];
    r.classList.toggle('off', !on); tg.setAttribute('aria-pressed', on);
    cv.textContent = critValue(m, thr);
    tr.style.background = ge ? `linear-gradient(to right,var(--line) ${p}%,${c} ${p}%)` : `linear-gradient(to right,${c} ${p}%,var(--line) ${p}%)`;
    hd.style.left = p + '%'; tr.setAttribute('aria-valuenow', thr);
  }
}
export function renderCritTick(sm) {
  for (const { m, tick } of Object.values(rows)) {
    const v = sm?.values[m.id];
    if (v == null || v === Infinity) tick.style.display = 'none';
    else { tick.style.display = 'block'; tick.style.left = Math.max(0, Math.min(100, 100 * (v - m.min) / (m.max - m.min))) + '%'; }
  }
}
