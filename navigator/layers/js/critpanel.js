// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Layers, at the top of the left panel: one row per factor (Sun, Earth, longest dark, slope, ice); none picked = the GO
// ground of every criterion (the default; picking the picked row again goes back). A row picks that factor's map (factor.js); its slider is the limit, its track
// the factor's gradient; "Reset" shows when any differs from the default. Sun / Earth / dark move between
// the computed levels (layers.json criterion_levels); slope and ice are thresholds; ice at 0 is off.
import { photosOn } from './photos.js';
import { state, setState } from './state.js';
import { hue } from './config.js';
import { lang } from './strings.js';
import { defaults, isDefault } from './crit.js';
import { FX, trackCss } from './factor.js';

const TX = { en: { darkTip: 'Longest stretch without sunlight', lim: 'Limit', title: 'Layers', photos: 'ShadowCam', photosTip: 'Real photos inside permanently shadowed craters', credit: 'Photos: KPLO ShadowCam (NASA/KARI, MSSS/ASU); LROC NAC (NASA/GSFC/ASU)', all: 'All', allTxt: 'GO', reset: 'Reset', off: 'Off', sun: 'Sun', earth: 'Earth', dark: 'Dark', slope: 'Slope', ice: 'Ice' }, ko: { darkTip: '햇빛이 한 번에 가장 오래 끊긴 시간', lim: '기준선', title: '레이어', photos: 'ShadowCam', photosTip: '영구 그림자 크레이터 안을 찍은 실제 사진', credit: '사진: KPLO ShadowCam (NASA/KARI, MSSS/ASU); LROC NAC (NASA/GSFC/ASU)', all: '전체', allTxt: 'GO', reset: '초기화', off: '끔', sun: '햇빛', earth: '지구', dark: '어둠', slope: '경사', ice: '얼음' } }[lang === 'ko' ? 'ko' : 'en'];
let el, data, setCrit, rows = {};
export const LAYER_KEYS = [null, 'sun', 'earth', 'dark', 'slope', 'ice'];   // keys 0-5
const pick = k => { if (state.factor !== k) setState({ factor: k }, 'pixels'); };

export function initCritPanel(host, d, setCritFn) {
  data = d; setCrit = setCritFn;
  el = document.createElement('section'); el.className = 'lyr-cp';
  el.innerHTML = `<div class="lyr-cph"><h3 class="lyr-cpt">${TX.title}</h3><span><button class="lyr-cpsc" aria-pressed="false" title="${TX.photosTip}" hidden>${TX.photos}</button><button class="lyr-cplim" aria-pressed="true" hidden>${TX.lim}</button><button class="lyr-cpr" hidden>${TX.reset}</button></span></div><div class="lyr-cpb"></div><p class="lyr-cpcr" hidden></p>`;
  host.prepend(el);
  const body = el.querySelector('.lyr-cpb');

  // with a factor on the map: show or hide its limit (dimming + line); off = the plain gradient
  el.querySelector('.lyr-cpsc').onclick = () => setState({ photos: !state.photos }, 'pixels');
  el.querySelector('.lyr-cplim').onclick = () => setState({ fxLimit: state.fxLimit === false }, 'pixels');
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
    const r = document.createElement('div'); r.className = 'lyr-cpl';
    r.innerHTML = `<button type="button" class="lyr-cpk" aria-pressed="false">${TX[k]}</button><input type="range" aria-label="${TX[k]}"><b class="n"></b>`;
    if (k === 'dark') r.title = TX.darkTip;   // the longest single stretch without sunlight (same wording as the spot card)
    const inp = r.querySelector('input'), m = data.layers.find(q => q.id === id), f = FX[k];
    // the whole row picks this layer (again: back to All); touching its slider picks it too
    r.onclick = e => { if (e.target === inp) return; setState({ factor: state.factor === k ? null : k }, 'pixels'); };
    inp.addEventListener('pointerdown', () => pick(k)); inp.addEventListener('focus', () => pick(k));
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
      rows[k] = { inp, b: r.querySelector('b'), get: () => { const v = state.crit[P]; return { i: v, txt: `${k === 'dark' ? '⟷ ' : ''}${cl[1].dir === '<=' ? '≤' : '≥'} ${v} ${cl[1].unit === '%' ? '%' : 'h'}` }; } };
    } else if (k === 'slope') {
      Object.assign(inp, { min: 0, max: 20, step: 1 });
      inp.oninput = () => { if (+inp.value < 1) inp.value = '1'; setState({ threshold: { ...state.threshold, [id]: +inp.value } }); };
      rows[k] = { inp, b: r.querySelector('b'), get: () => { const v = Math.round(state.threshold[id] ?? m.threshold); return { i: v, txt: `≤ ${v}°` }; } };
    } else {
      Object.assign(inp, { min: 0, max: FX.ice.hi, step: 0.5 });
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
  let changed = !isDefault(data.meta, st.crit);
  for (const [k, r] of Object.entries(rows)) {
    const g = r.get(); if (+r.inp.value !== g.i && document.activeElement !== r.inp) r.inp.value = String(g.i);
    r.inp.style.setProperty('--p', ((g.i - r.inp.min) / (r.inp.max - r.inp.min) * 100).toFixed(1) + '%');
    r.b.textContent = g.txt;
    const fx = st.factor === k; r.row.classList.toggle('fx', fx); r.row.querySelector('.lyr-cpk').setAttribute('aria-pressed', String(fx));
    r.inp.style.setProperty('--trk', trackCss(st, k));
    if (k === 'slope') { const m = data.layers.find(q => q.id === layerOf('slope')); if (m && Math.round(st.threshold[m.id]) !== m.threshold) changed = true; }
    if (k === 'ice' && st.on.mask[layerOf('ice')]) changed = true;
  }
  el.querySelector('.lyr-cpr').hidden = !changed;
  { const b = el.querySelector('.lyr-cpsc'), on = photosOn(st), cr = el.querySelector('.lyr-cpcr');
    b.hidden = st.factor !== 'ice'; b.setAttribute('aria-pressed', String(on));
    cr.hidden = !on; if (on) cr.textContent = TX.credit; }
  { const lb = el.querySelector('.lyr-cplim'); lb.hidden = !st.factor; lb.setAttribute('aria-pressed', String(st.fxLimit !== false)); }
}
