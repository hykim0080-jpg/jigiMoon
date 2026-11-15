// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// The verdict for the selected place, big on the map: GO / NO-GO, each criterion that misses its limit (value vs limit),
// and the fix (or, with none within the limits, the one-sentence reason from failreason.js).
// verdictFor() is plain data so other views (3D hover card, Find a site) can show the same words.
import { moved } from './drag.js';
import { t } from './strings.js';
import { THRESHOLDS } from './config.js';
import { status, nearestOk, blockage, fixes, bestFix, mastTag } from './logic.js';
import { state, setState, limitsOf } from './state.js';
import { failStats, failReason } from './failreason.js';
import { sector, bearing } from './orient.js';

// one decimal, rounded down so a miss never reads as the limit (48.8 %, as the API gives it)
const pct1 = v => (Math.floor(v * 10) / 10).toFixed(1);
const ARROW = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
const lang = () => (document.documentElement.lang || 'en').startsWith('ko') ? 'ko' : 'en';

// { go, capped, fails: [{k, text}], fix: text | '', why: text | '' }
export function verdictFor(st, data, lim) {
  const site = data.site, e = data.index.modes[st.mission]?.sites[st.site];
  if (!site || !e) return null;
  const c = st.crit || THRESHOLDS, d = st.day, s = status(e, d, st.mast, lim);
  const h = s.mast || st.mast, m = h && site.mast && site.mast.sun[h] ? site.mast : null;   // the numbers at the mast top when GO needs one
  const sun = m ? m.sun[h][d] : site.cal.sun[d], earth = m ? m.earth[h][d] : site.cal.earth[d], dark = m ? m.dark[h][d] : site.cal.dark[d];
  const b = site.sky ? blockage(site.sky, d * 24 + st.hour) : {}, hid = k => b[k] ? ` · ${t('hiddenRidge')}` : '';   // the ridge that hides it now
  const fails = [];
  if (sun < c.sun) fails.push({ k: 'sun', text: `${t('sun')} ${pct1(sun)} % < ${c.sun} %${hid('sun')}` });
  if (earth < c.earth) fails.push({ k: 'earth', text: `${t('earth')} ${pct1(earth)} % < ${c.earth} %${hid('earth')}` });
  if (dark > c.dark) fails.push({ k: 'dark', text: `${t('dark')} ${Math.ceil(dark)} h > ${c.dark} h` });
  let fix = '', why = '';
  if (s.kind === 'move') {
    const n = nearestOk(site, d);
    fix = `${t('nearGo')} ${t('km', s.value)}${n && n.d > 0 ? ' ' + ARROW[sector(bearing(n.c.dx, n.c.dy))] : ''}`;
  } else if (s.kind === 'mast') fix = `${t('mast')} ${t('m', s.value)}`;
  else if (s.kind === 'wait') fix = `${t('wait')} ${t('d', s.value)}`;
  else if (s.kind === 'none') {
    try { why = failReason(failStats(site, d, c, lim, st.mission), lang()).text; } catch (err) { console.error(err); }
  }
  return { go: s.kind === 'ok', capped: !!s.capped, mastH: s.mast || 0, fails: s.kind === 'ok' ? [] : fails, fix, fixKind: s.kind, why };
}

let box = null;
let lastArgs = null;
export const refresh = () => { if (lastArgs) render(...lastArgs); };
export function render(st, data, panel, lim) {
  lastArgs = [st, data, panel, lim];
  if (!box) {
    box = document.createElement('div'); box.id = 'vbadge'; panel.appendChild(box);
    // the three fixes in one line under the verdict: MOVE flies to the place at Site zoom (the MOVE ring and arrow),
    // MAST raises the mast on the lander (again: lowers it), WAIT moves the landing date
    box.addEventListener('click', ev => {
      const b = ev.target.closest('[data-fx]'); if (!b || b.disabled) return;
      if (b.dataset.fx === 'move') document.querySelector('#zoom [data-z="4"]')?.click();
      else if (b.dataset.fx === 'wait') setState({ day: state.day + +b.dataset.v });
    });
  }
  const v = st.view === 'focus' ? verdictFor(st, data, lim) : null;
  box.hidden = !v;
  const main = document.getElementById('main');
  if (!v) { main.style.setProperty('--vbh', '0px'); return; }
  const e = data.index.modes[st.mission]?.sites[st.site], row = e && !v.go ? fixRow(st, data, e, lim) : '';
  const key = JSON.stringify(v) + row;
  if (box.dataset.k === key) { vbh(main, box); return; }
  box.dataset.k = key;
  box.className = v.go ? 'go' : 'nogo';
  box.innerHTML = `<b>${v.go ? t('go') : t('nogo')}</b>`
    + (v.go && v.capped ? mastTag(v.mastH) : '')
    + (v.fails.length ? `<span class="vfail">${v.fails.map(f => f.text).join(' · ')}</span>` : '')   // the reasons on the verdict's line
    + (v.fix && !row ? `<span class="vfix" style="color:var(--${v.fixKind})">→ ${v.fix}</span>` : '')   // the row below carries the fix
    + (v.why ? `<span class="vwhy">${v.why}</span>` : '')
    + row;
  vbh(main, box);
}
// far ground (beyond the MOVE grid): the nearest GO from the 3D map's GO field, set by view3d.js
let farOf = () => null;
export const setFar = f => { farOf = f; };
function fixRow(st, data, e, lim) {
  const f = fixes(e, st.day), best = bestFix(e, st.day, lim), n = data.site ? nearestOk(data.site, st.day) : null;
  const item = (k, label, v, unit, extra = '') => {
    const ok = v != null && v <= lim[k];
    // MAST: the height only (no switch; the verdict stays on the ground). Over 10 m (more than a lander carries) in
    // orange, from 15 m 'tall': 20 m is the practical limit (lunar/README.md, mast heights)
    const tall = k === 'mast' && ok && v > 10, cls = [best && best.kind === k ? 'best' : '', k === 'mast' ? 'ro' : '', tall ? 'tall' : ''].join(' ').trim();
    return `<button type="button" data-fx="${k}" data-v="${ok ? v : ''}"${ok && k !== 'mast' ? '' : ' disabled'}${cls ? ` class="${cls}"` : ''} style="--fc:var(--${k})"><i>${label}</i> ${ok ? `<b>${v}</b> ${unit}${extra}${k === 'mast' && v >= 15 ? ` <em>${t('mastTall')}</em>` : ''}` : '—'}</button>`;
  };
  const arrow = n && n.d > 0 ? ' ' + ARROW[sector(bearing(n.c.dx, n.c.dy))] : '';
  // Nearest GO within the MOVE limit: a fix (a button); farther: grey text at the end, not a fix
  const inLim = f.move != null && f.move <= lim.move;
  let far = '';
  if (!inLim) {
    const s = data.index.byId[st.site], g = f.move != null ? { km: f.move, arrow } : s ? farOf(s.x_m, s.y_m) : null;
    if (g && g.km) far = `<span class="vfar">${t('nearGo')} ${g.km < 10 ? (+g.km).toFixed(1) : Math.round(g.km)} km${g.arrow ? ' ' + g.arrow.trim() : ''}</span>`;
  }
  return `<span class="vfx">${inLim ? item('move', t('nearGo'), f.move, 'km', arrow) : ''}${item('mast', t('mast'), f.mast, 'm')}${item('wait', t('wait'), f.wait, 'd')}${far}</span>`;
}
// the dock, sky pop-up and 3D legend sit below the block, unless it was dragged away
const vbh = (main, box) => main.style.setProperty('--vbh', moved('verdict') ? '0px' : box.offsetHeight + 8 + 'px');

// how a NO-GO place is staged on the lander model in 3D (figs.js MAST_RIG): cold = too little Sun or too long dark,
// comm = Earth too little in view, slope = degrees when steeper than the landing limit (8°). GO: nothing.
export function stageFx(st, data) {
  const site = data.site, e = data.index.modes[st.mission]?.sites[st.site], s = data.index.byId[st.site];
  if (!site || !e || !s || status(e, st.day, st.mast, limitsOf(st)).kind === 'ok') return {};
  const c = st.crit || THRESHOLDS, d = st.day, m = st.mast && site.mast;
  const sun = m ? m.sun[st.mast][d] : site.cal.sun[d], earth = m ? m.earth[st.mast][d] : site.cal.earth[d], dark = m ? m.dark[st.mast][d] : site.cal.dark[d];
  return { cold: sun < c.sun || dark > c.dark, comm: earth < c.earth, slope: s.slope_deg > 8 ? s.slope_deg : 0 };
}
// the one short line under the model for a NO-GO place
export function stageLine(fx) {
  const w = [fx.cold && t('fxCold'), fx.comm && t('fxComm'), fx.slope && t('fxSteep', Math.round(fx.slope))].filter(Boolean);
  return w.length ? `${t('nogo')} · ${w.join(' · ')}` : '';
}
