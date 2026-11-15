import { t } from './strings.js';
import { bar } from './svg.js';
import { THRESHOLDS } from './config.js';

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
    + row(t('dark'), dark, t('h', Math.round(dark)), { frac: dark / 100, tick: c.dark / 100 }, dark > c.dark, n('dark', `≤ ${c.dark} h`), L.dark)
    + row(t('noComm'), nc, t('h', Math.round(nc)), { frac: nc / (mission * 24) }, false, n('noComm', ''), L.noComm);
}

export function render(st, data) {
  const s = data.site;
  if (!s) return;
  root.innerHTML = metricRows(s, st.day, st.mission, st.mast, st.crit || THRESHOLDS, true);
}
