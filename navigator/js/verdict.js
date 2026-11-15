// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// The verdict for the selected place, big on the map: GO / NO-GO, each criterion that misses its limit (value vs limit),
// and the fix (or, with none within the limits, the one-sentence reason from failreason.js).
// verdictFor() is plain data so other views (3D hover card, Find a site) can show the same words.
import { moved } from './drag.js';
import { t } from './strings.js';
import { THRESHOLDS } from './config.js';
import { status, nearestOk, blockage } from './logic.js';
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
  if (!box) { box = document.createElement('div'); box.id = 'vbadge'; panel.appendChild(box); }
  const v = st.view === 'focus' ? verdictFor(st, data, lim) : null;
  box.hidden = !v;
  const main = document.getElementById('main');
  if (!v) { main.style.setProperty('--vbh', '0px'); return; }
  const key = JSON.stringify(v);
  if (box.dataset.k === key) { vbh(main, box); return; }
  box.dataset.k = key;
  box.className = v.go ? 'go' : 'nogo';
  box.innerHTML = `<b>${v.go ? t('go') : t('nogo')}</b>`
    + (v.go && v.capped ? `<span class="vfix" style="color:var(--mast)">${t('mast')} ${t('m', st.mast)}</span>` : '')
    + v.fails.map(f => `<span class="vfail">${f.text}</span>`).join('')
    + (v.fix ? `<span class="vfix" style="color:var(--${v.fixKind})">→ ${v.fix}</span>` : '')
    + (v.why ? `<span class="vwhy">${v.why}</span>` : '');
  vbh(main, box);
}
// the dock, sky pop-up and 3D legend sit below the block, unless it was dragged away
const vbh = (main, box) => main.style.setProperty('--vbh', moved('verdict') ? '0px' : box.offsetHeight + 8 + 'px');
