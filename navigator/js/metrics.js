// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { t } from './strings.js';
import { bar } from './svg.js';
import { THRESHOLDS } from './config.js';
import { loadIce, iceKm } from './ice.js';

let root;
export function init(node) { root = node; }

export function row(label, value, valueText, barOpts, fail, note = '', tip = '') {
  return `<div class="metric"${tip ? ` title="${tip}"` : ''}><span class="name">${label}</span><span class="v n${fail ? ' fail' : ''}">${valueText}</span>${bar(barOpts)}${note ? `<span class="why">${note}</span>` : ''}</div>`;
}

// the four bullet bars for one day; used by Focus and Compare. The right column says what each limit is for.
export function metricRows(site, day, mission, mast, crit = THRESHOLDS, notes = false) {
  const { cal } = site, m = mast && site.mast, c = crit;
  const sun = m ? m.sun[mast][day] : cal.sun[day], earth = m ? m.earth[mast][day] : cal.earth[day];
  const dark = m ? m.dark[mast][day] : cal.dark[day], nc = cal.noComm[day];
  const w = t('why'), L = t('whyLong'), n = (k, lim) => notes ? `${lim ? lim + ' · ' : ''}${w[k]}` : '';
  return row(t('sun'), sun, t('pct', Math.round(sun)), { frac: sun / 100, tick: c.sun / 100, color: 'var(--sun)' }, sun < c.sun, n('sun', `≥ ${c.sun} %`), L.sun)
    + row(t('earth'), earth, t('pct', Math.round(earth)), { frac: earth / 100, tick: c.earth / 100, color: 'var(--earth)' }, earth < c.earth, n('earth', `≥ ${c.earth} %`), L.earth)
    + row(t('dark'), dark, '⟷ ' + t('h', Math.round(dark)), { frac: dark / 100, tick: c.dark / 100 }, dark > c.dark, n('dark', `≤ ${c.dark} h`), t('darkTip') + '. ' + L.dark)
    + row(t('noComm'), nc, t('h', Math.round(nc)), { frac: nc / (mission * 24) }, false, n('noComm', ''), L.noComm);
}

// one compact line: ☀ Sun · ⊕ Earth · ☾ Dark · ∠ Slope, a value past its limit in red; limits and reasons in the tooltip
const item = (ic, color, txt, fail, tip) => `<span class="mi${fail ? ' fail' : ''}" title="${tip.replace(/"/g, '&quot;')}"><i style="color:${color}">${ic}</i>${txt}</span>`;
export function render(st, data) {
  const s = data.site;
  if (!s) return;
  const { cal } = s, m = st.mast && s.mast, c = st.crit || THRESHOLDS, d = st.day, w = t('why'), L = t('whyLong');
  const sun = m ? m.sun[st.mast][d] : cal.sun[d], earth = m ? m.earth[st.mast][d] : cal.earth[d], dark = m ? m.dark[st.mast][d] : cal.dark[d], nc = cal.noComm[d];
  const sl = data.index.byId[st.site]?.slope_deg, lim = 8;
  const si = data.index.byId[st.site], ik = si ? iceKm(si.x_m, si.y_m) : null;
  if (ik == null && si) loadIce().then(() => { if (iceKm(si.x_m, si.y_m) != null) render(st, data); });
  root.innerHTML = `<div class="mline">`
    + item('☀', 'var(--sun)', t('pct', Math.round(sun)), sun < c.sun, `${t('sun')} ≥ ${c.sun} % · ${w.sun}\n${L.sun}`)
    + item('⊕', 'var(--earth)', t('pct', Math.round(earth)), earth < c.earth, `${t('earth')} ≥ ${c.earth} % · ${w.earth}\n${t('noComm')}: ${t('h', Math.round(nc))}\n${L.earth}`)
    + item('⟷', 'var(--muted)', t('h', Math.round(dark)), dark > c.dark, `${t('darkTip')} ≤ ${c.dark} h · ${w.dark}\n${L.dark}`)
    + (sl == null ? '' : item('∠', 'var(--muted)', `${sl.toFixed(1)}°`, sl > lim, `${t('slopeL')} ≤ ${lim}° · ${w.slope}\n${L.slope}`))
    + (ik == null ? '' : item('❄', '#9fe3ff', t('km', ik < 10 ? +ik.toFixed(1) : Math.round(ik)), false, t('iceTip')))
    + `</div>`;
}
