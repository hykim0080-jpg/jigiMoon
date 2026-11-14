import { t } from './strings.js';
import { bar } from './svg.js';
import { THRESHOLDS } from './config.js';

let root;
export function init(node) { root = node; }

export function row(label, value, valueText, barOpts, fail) {
  return `<div class="metric"><span class="name">${label}</span><span class="v n${fail ? ' fail' : ''}">${valueText}</span>${bar(barOpts)}</div>`;
}

// the four bullet bars for one day; used by Focus and Compare
export function metricRows(site, day, mission, mast) {
  const { cal } = site, m = mast && site.mast;
  const sun = m ? m.sun[mast][day] : cal.sun[day], earth = m ? m.earth[mast][day] : cal.earth[day];
  const dark = m ? m.dark[mast][day] : cal.dark[day], nc = cal.noComm[day];
  return row(t('sun'), sun, t('pct', Math.round(sun)), { frac: sun / 100, tick: THRESHOLDS.sun / 100, color: 'var(--sun)' }, sun < THRESHOLDS.sun)
    + row(t('earth'), earth, t('pct', Math.round(earth)), { frac: earth / 100, tick: THRESHOLDS.earth / 100, color: 'var(--earth)' }, earth < THRESHOLDS.earth)
    + row(t('dark'), dark, t('h', Math.round(dark)), { frac: dark / 100, tick: THRESHOLDS.dark / 100 }, dark > THRESHOLDS.dark)
    + row(t('noComm'), nc, t('h', Math.round(nc)), { frac: nc / (mission * 24) }, false);
}

export function render(st, data) {
  const s = data.site;
  if (!s) return;
  root.innerHTML = metricRows(s, st.day, st.mission, st.mast);
}
