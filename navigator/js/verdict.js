// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// The verdict for the selected place, big on the map: GO / NO-GO, each criterion that misses its limit (value vs limit),
// and the fix (or, with none within the limits, the one-sentence reason from failreason.js).
// verdictFor() is plain data so other views (3D hover card, Find a site) can show the same words.
import { moved } from './drag.js';
import { t } from './strings.js';
import { THRESHOLDS } from './config.js';
import { status, nearestOk, blockage, fixes, bestFix } from './logic.js';
import { state, setState } from './state.js';
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
  const c = st.crit || THRESHOLDS, d = st.day, m = st.mast && site.mast;
  const sun = m ? m.sun[st.mast][d] : site.cal.sun[d], earth = m ? m.earth[st.mast][d] : site.cal.earth[d], dark = m ? m.dark[st.mast][d] : site.cal.dark[d];
  const b = site.sky ? blockage(site.sky, d * 24 + st.hour) : {}, hid = k => b[k] ? ` · ${t('hiddenRidge')}` : '';   // the ridge that hides it now
  const fails = [];
  if (sun < c.sun) fails.push({ k: 'sun', text: `${t('sun')} ${pct1(sun)} % < ${c.sun} %${hid('sun')}` });
  if (earth < c.earth) fails.push({ k: 'earth', text: `${t('earth')} ${pct1(earth)} % < ${c.earth} %${hid('earth')}` });
  if (dark > c.dark) fails.push({ k: 'dark', text: `${t('dark')} ${Math.ceil(dark)} h > ${c.dark} h` });
  const s = status(e, d, st.mast, lim);
  let fix = '', why = '';
  if (s.kind === 'move') {
    const n = nearestOk(site, d);
    fix = `${t('move')} ${t('km', s.value)}${n && n.d > 0 ? ' ' + ARROW[sector(bearing(n.c.dx, n.c.dy))] : ''}`;
  } else if (s.kind === 'mast') fix = `${t('mast')} ${t('m', s.value)}`;
  else if (s.kind === 'wait') fix = `${t('wait')} ${t('d', s.value)}`;
  else if (s.kind === 'none') {
    try { why = failReason(failStats(site, d, c, lim, st.mission), lang()).text; } catch (err) { console.error(err); }
  }
  return { go: s.kind === 'ok', capped: !!s.capped, fails, fix, fixKind: s.kind, why };
}

let box = null;
export function render(st, data, panel, lim) {
  if (!box) {
    box = document.createElement('div'); box.id = 'vbadge'; panel.appendChild(box);
    // the three fixes in one line under the verdict: MOVE flies to the place at Site zoom (the MOVE ring and arrow),
    // MAST raises the mast on the lander (again: lowers it), WAIT moves the landing date
    box.addEventListener('click', ev => {
      const b = ev.target.closest('[data-fx]'); if (!b || b.disabled) return;
      if (b.dataset.fx === 'move') document.querySelector('#zoom [data-z="4"]')?.click();
      else if (b.dataset.fx === 'mast') setState({ mast: state.mast === +b.dataset.v ? 0 : +b.dataset.v });
      else if (b.dataset.fx === 'wait') setState({ day: state.day + +b.dataset.v });
    });
  }
  const v = st.view === 'focus' ? verdictFor(st, data, lim) : null;
  box.hidden = !v;
  const main = document.getElementById('main');
  if (!v) { main.style.setProperty('--vbh', '0px'); return; }
  const e = data.index.modes[st.mission]?.sites[st.site], row = e && !e.ok[st.day] ? fixRow(st, data, e, lim) : '';
  const key = JSON.stringify(v) + row;
  if (box.dataset.k === key) { vbh(main, box); return; }
  box.dataset.k = key;
  box.className = v.go ? 'go' : 'nogo';
  box.innerHTML = `<b>${v.go ? t('go') : t('nogo')}</b>`
    + (v.go && v.capped ? `<span class="vfix" style="color:var(--mast)">${t('mast')} ${t('m', st.mast)}</span>` : '')
    + v.fails.map(f => `<span class="vfail">${f.text}</span>`).join('')
    + (v.fix && !row ? `<span class="vfix" style="color:var(--${v.fixKind})">→ ${v.fix}</span>` : '')   // the row below carries the fix
    + (v.why ? `<span class="vwhy">${v.why}</span>` : '')
    + row;
  vbh(main, box);
}
function fixRow(st, data, e, lim) {
  const f = fixes(e, st.day), best = bestFix(e, st.day, lim), n = data.site ? nearestOk(data.site, st.day) : null;
  const item = (k, v, unit, extra = '') => {
    const ok = v != null && v <= lim[k];
    return `<button type="button" data-fx="${k}" data-v="${ok ? v : ''}"${ok ? '' : ' disabled'} class="${best && best.kind === k ? 'best' : ''}" style="--fc:var(--${k})"><i>${t(k)}</i> ${ok ? `${v} ${unit}${extra}` : '—'}</button>`;
  };
  return `<span class="vfx">${item('move', f.move, 'km', n && n.d > 0 ? ' ' + ARROW[sector(bearing(n.c.dx, n.c.dy))] : '')}${item('mast', f.mast, 'm')}${item('wait', f.wait, 'd')}</span>`;
}
// the dock, sky pop-up and 3D legend sit below the block, unless it was dragged away
const vbh = (main, box) => main.style.setProperty('--vbh', moved('verdict') ? '0px' : box.offsetHeight + 8 + 'px');

// how a NO-GO place is staged on the lander model in 3D (figs.js MAST_RIG): cold = too little Sun or too long dark,
// comm = Earth too little in view, slope = degrees when steeper than the landing limit (8°). GO: nothing.
export function stageFx(st, data) {
  const site = data.site, e = data.index.modes[st.mission]?.sites[st.site], s = data.index.byId[st.site];
  if (!site || !e || !s || e.ok[st.day]) return {};
  const c = st.crit || THRESHOLDS, d = st.day, m = st.mast && site.mast;
  const sun = m ? m.sun[st.mast][d] : site.cal.sun[d], earth = m ? m.earth[st.mast][d] : site.cal.earth[d], dark = m ? m.dark[st.mast][d] : site.cal.dark[d];
  return { cold: sun < c.sun || dark > c.dark, comm: earth < c.earth, slope: s.slope_deg > 8 ? s.slope_deg : 0 };
}
// the one short line under the model for a NO-GO place
export function stageLine(fx) {
  const w = [fx.cold && t('fxCold'), fx.comm && t('fxComm'), fx.slope && t('fxSteep', Math.round(fx.slope))].filter(Boolean);
  return w.length ? `${t('nogo')} · ${w.join(' · ')}` : '';
}
