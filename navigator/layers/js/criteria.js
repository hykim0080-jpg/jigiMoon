// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Default left-top panel: one line + one handle per criterion (layers that carry a threshold). Hover = "why" view (focusCrit).
import { state, setState } from './state.js';
import { hue } from './config.js';
import { layerColor } from './ramps.js';
import { fmt } from './data.js';
import { t, layerName } from './strings.js';

let el, data, rows = {}, drag = null, picking = null, setCritFn = null;
const CRIT_KEY = { sun: ['c_sun', 'min_sun_pct'], earth: ['c_earth', 'min_earth_pct'], dark: ['c_dark', 'max_dark_h'] };
const stepOf = m => (m.max - m.min) / 250;
const CL = () => data.meta.criterion_levels || {};
const paramOf = m => { const cl = CL()[m.id], k = CRIT_KEY[hue(m.id)]; return cl && state.crit[cl.param] != null ? state.crit[cl.param] : k && data.meta.criteria?.[k[1]]; };
export function critName(m) {
  const k = CRIT_KEY[hue(m.id)], p = k && paramOf(m);
  if (k && p != null) return t(k[0], p);
  return hue(m.id) === 'slope' ? t('c_slope') : layerName(m);
}
// the number inside the name is the control (a dotted-underlined button); open = the segmented row of levels
function nameHtml(m, open) {
  const cl = CL()[m.id], p = paramOf(m), name = critName(m);
  if (!cl || p == null) return name;
  const lv = Object.keys(cl.levels).map(Number).sort((a, b) => a - b), cur = String(p);
  const ctl = open ? `<span class="seg lyr-lvs">${lv.map(v => `<button data-v="${v}" aria-pressed="${v == p}">${v}</button>`).join('')}</span>` : `<button class="lyr-lv" data-open="1">${p}</button>`;
  const i = name.lastIndexOf(cur);
  return name.slice(0, i) + ctl + name.slice(i + cur.length);
}
export function critValue(m, v) {
  const n = fmt(m, v);
  if (m.unit === '일' && m.direction !== '<=') return t('ge_d', n);
  if (m.unit === '°' && m.direction === '<=') return t('le_deg', n);
  return `${m.direction === '<=' ? '≤' : '≥'} ${n}${m.unit}`;
}
export function initCriteria(root, d, setCrit) {
  el = root; data = d; setCritFn = setCrit;
  for (const m of data.layers.filter(m => m.threshold != null)) {
    const r = document.createElement('div'); r.className = 'lyr-cr'; r.dataset.id = m.id; r.style.setProperty('--c', layerColor(m.id, false)); r.title = data.meta.definitions?.[m.id] || '';
    const c = layerColor(m.id, false);
    r.innerHTML = `<div class="lyr-cl1"><button class="lyr-tg" aria-pressed="true" style="--c:${c}"></button><span class="lyr-nm">${critName(m)}</span><span class="n lyr-cv"></span></div><div class="lyr-ct" tabindex="0" role="slider"><i class="lyr-ctk"></i><b class="lyr-hd2"></b><u class="lyr-pt2"></u></div>`;
    const q = s => r.querySelector(s), tr = q('.lyr-ct');
    q('.lyr-nm').onclick = e => {
      const b = e.target.closest('button');
      if (!b) { if (state.base !== hue(m.id)) setState({ base: hue(m.id) }, 'pixels'); return; }
      e.stopPropagation();
      if (b.dataset.open) { picking = m.id; renderCriteria(state); }
      else { picking = null; setCritFn(CL()[m.id].param, +b.dataset.v); renderCriteria(state); }
    };
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
    r.onpointerleave = () => { if (picking === m.id) { picking = null; renderCriteria(state); } if (!drag && state.focusCrit === m.id) setState({ focusCrit: null }); };
    r.addEventListener('focusin', () => { if (state.focusCrit !== m.id) setState({ focusCrit: m.id }); });
    r.addEventListener('focusout', () => { if (!drag && state.focusCrit === m.id) setState({ focusCrit: null }); });
    el.append(r);
  }
}
export function renderCriteria(st) {
  for (const { r, m, tg, cv, tr, hd } of Object.values(rows)) {
    const thr = st.threshold[m.id], p = 100 * (thr - m.min) / (m.max - m.min), ge = m.direction !== '<=', c = layerColor(m.id, false), on = !!st.on.mask[m.id];
    r.classList.toggle('off', !on); r.classList.toggle('base', state.base === hue(m.id)); tg.setAttribute('aria-pressed', on);
    cv.textContent = critValue(m, thr); r.querySelector('.lyr-nm').innerHTML = nameHtml(m, picking === m.id);
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
export const closePicker = () => { if (picking) { picking = null; renderCriteria(state); } };
