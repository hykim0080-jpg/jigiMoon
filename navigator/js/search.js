// Search view, like a flight search: when (a date, a month, or any time) · where (a region) · how long -> list of sites.
// The first screen of a fresh visit. A result opens Compare on that site and day.
import { state, setState, limitsOf } from './state.js';
import { t, siteName } from './strings.js';
import { calOf } from './data.js';
import { status, fixText, isoDate, shortDate, dateOf } from './logic.js';
import { FIRST_DAY } from './config.js';

const REGIONS = {
  shackleton: ['shackleton-rim', 'connecting-ridge', 'de-gerlache-rim-2'],
  mouton: ['mons-mouton', 'mons-mouton-plateau', 'im-2-athena'],
  nobile: ['nobile-rim-1', 'nobile-rim-2'],
  malapert: ['malapert-massif', 'haworth'],
  cabeus: ['peak-near-cabeus-b', 'slater-plain'],
};
const regionOf = id => Object.keys(REGIONS).find(r => REGIONS[r].includes(id)) || '';
const dayOfMonth = (m, d) => Math.round((Date.UTC(2027, m, d) - FIRST_DAY) / 864e5);
const daysIn = m => new Date(Date.UTC(2027, m + 1, 0)).getUTCDate();

let root, data, q = null, sort = 'best', searched = false;

export function init(node, d) {
  root = node; data = d;
  q = { when: 'date', day: state.day, month: dateOf(state.day).getUTCMonth(), region: 'all' };
  if (!location.hash) { searched = false; setState({ view: 'search' }); }
}

function rows(st, day) {
  const mode = data.index.modes[st.mission].sites, lim = limitsOf(st), c = st.crit;
  const ids = q.region === 'all' ? data.index.sites.filter(s => !s.isPin).map(s => s.id) : REGIONS[q.region];
  return ids.filter(id => mode[id]).map(id => {
    const e = mode[id], s = data.index.byId[id], cal = calOf(id, st.mission);
    const v = status(e, day, 0, lim);
    const sun = cal ? cal.sun[day] : null, earth = cal ? cal.earth[day] : null, dark = cal ? cal.dark[day] : null;
    const margin = cal ? (sun - c.sun) / c.sun + (earth - c.earth) / c.earth + (c.dark - dark) / c.dark : 0;
    let first = null;
    for (let k = day; k < 365; k++) if (e.ok[k]) { first = k; break; }
    const rank = v.kind === 'ok' ? 3 + margin : v.kind === 'none' ? -3 : 2 - v.value / lim[v.kind];
    return { id, s, v, sun, earth, dark, first, rank };
  });
}
const okCount = (st, day, ids) => { const mode = data.index.modes[st.mission].sites; return ids.filter(id => mode[id] && mode[id].ok[day]).length; };

export function render(st) {
  if (!root || st.view !== 'search') return;
  const g = t('search'), ids = q.region === 'all' ? data.index.sites.filter(s => !s.isPin).map(s => s.id) : REGIONS[q.region];
  const opt = (v, label, cur) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${label}</option>`;
  const months = t('months');
  // search bar
  let html = `<form class="s-bar" onsubmit="return false">
    <label><span>${g.when}</span><div class="s-when">
      <select id="s-when">${opt('date', g.onDate, q.when)}${opt('month', g.inMonth, q.when)}${opt('any', g.anytime, q.when)}</select>
      ${q.when === 'date' ? `<input type="date" id="s-day" min="2027-01-01" max="2027-12-31" value="${isoDate(q.day)}">`
        : q.when === 'month' ? `<select id="s-month">${months.map((m, i) => opt(i, m + ' 2027', q.month)).join('')}</select>` : ''}</div></label>
    <label><span>${g.where}</span><select id="s-region">${opt('all', g.all, q.region)}${Object.keys(REGIONS).map(r => opt(r, g.regions[r], q.region)).join('')}</select></label>
    <label><span>${g.stay}</span><div class="seg s-stay">${[14, 6].map(m => `<button type="button" data-m="${m}" aria-pressed="${st.mission === m}">${t('d', m)}</button>`).join('')}</div></label>
    <button class="s-go" id="s-go">${g.go}</button>
  </form>`;
  if (!searched) { html += `<p class="s-hint">${g.hint}</p>`; root.innerHTML = html; wire(st); return; }
  if (!data.index.sites.filter(s => !s.isPin).every(s => calOf(s.id, st.mission))) { root.innerHTML = html + `<p class="s-hint">${g.loading}</p>`; wire(st); return; }

  // flexible dates: a month strip (any time) and the month's calendar with the number of GO sites per day
  if (q.when !== 'date') {
    if (q.when === 'any') {
      const per = months.map((m, i) => { let n = 0; for (let d = 1; d <= daysIn(i); d++) n += okCount(st, dayOfMonth(i, d), ids); return n / daysIn(i); });
      const mx = Math.max(...per, 1e-9);
      html += `<div class="s-months">${months.map((m, i) => `<button data-month="${i}" aria-pressed="${q.month === i}"><b>${m}</b><i style="--f:${per[i] / mx}"></i><span>${g.perDay(per[i].toFixed(1))}</span></button>`).join('')}</div>`;
    }
    const m = q.month, first = new Date(Date.UTC(2027, m, 1)).getUTCDay(), counts = [];
    for (let d = 1; d <= daysIn(m); d++) counts.push(okCount(st, dayOfMonth(m, d), ids));
    const mx = Math.max(...counts, 1);
    if (dateOf(q.day).getUTCMonth() !== m) { const bi = counts.indexOf(Math.max(...counts)); q.day = dayOfMonth(m, bi + 1); }
    html += `<div class="s-cal"><div class="s-cal-h">${months[m]} 2027 · ${g.calNote}</div><div class="s-grid">${g.wd.map(w => `<em>${w}</em>`).join('')}${'<span></span>'.repeat(first)}${counts.map((n, i) => {
      const day = dayOfMonth(m, i + 1);
      return `<button data-day="${day}" aria-pressed="${day === q.day}" style="--f:${n / mx}"><b>${i + 1}</b><span>${n}</span></button>`;
    }).join('')}</div></div>`;
  }

  // results for the chosen day
  const day = q.day;
  let list = rows(st, day);
  if (sort === 'nofix') list = list.filter(r => r.v.kind === 'ok');
  list.sort(sort === 'soon' ? (a, b) => (a.first ?? 999) - (b.first ?? 999) || b.rank - a.rank : (a, b) => b.rank - a.rank);
  const c = st.crit;
  html += `<div class="s-res"><div class="s-res-h"><span>${g.resultsFor(shortDate(day), t('d', st.mission))}</span>
    <div class="seg s-sort">${[['best', g.sortBest], ['soon', g.sortSoon], ['nofix', g.sortNoFix]].map(([k, l]) => `<button data-sort="${k}" aria-pressed="${sort === k}">${l}</button>`).join('')}</div></div>`;
  if (!list.length) html += `<p class="s-hint">${g.none}</p>`;
  html += list.map((r, i) => {
    const ok = r.v.kind === 'ok', soon = sort === 'soon';
    const verdict = soon ? (r.first == null ? g.noGoYear : r.first === day ? t('go') : g.goOn(shortDate(r.first), r.first - day))
      : ok ? t('go') : r.v.kind === 'none' ? g.noFix : fixText(r.v);
    const kind = soon ? (r.first === day ? 'ok' : r.first == null ? 'none' : 'wait') : r.v.kind;
    const why = i === 0 && sort === 'best' && r.sun != null ? `<ul class="s-why">
      <li><i style="background:var(--sun)"></i>${g.whySun(Math.round(r.sun), c.sun)}</li>
      <li><i style="background:var(--earth)"></i>${g.whyEarth(Math.round(r.earth), c.earth)}</li>
      <li><i style="background:var(--muted)"></i>${g.whyDark(Math.round(r.dark), c.dark)}</li></ul>` : '';
    return `<button class="s-card${i === 0 ? ' top' : ''}" data-open="${r.id}" data-at="${soon && r.first != null ? r.first : day}">
      <div class="s-name"><b>${siteName(r.s)}</b><span>${g.regions[regionOf(r.id)] || ''}</span></div>
      <div class="s-nums">${r.sun == null ? '' : `<span class="${r.sun < c.sun ? 'bad' : ''}">${t('sun')} ${Math.round(r.sun)} %</span><span class="${r.earth < c.earth ? 'bad' : ''}">${t('earth')} ${Math.round(r.earth)} %</span><span class="${r.dark > c.dark ? 'bad' : ''}">${t('dark')} ${Math.round(r.dark)} h</span>`}</div>
      <div class="s-v" style="color:var(--${kind === 'none' ? 'muted' : kind})">${verdict}</div>${why}</button>`;
  }).join('') + '</div>';
  root.innerHTML = html;
  wire(st);
}

function wire(st) {
  const $ = s => root.querySelector(s), re = () => render(state);
  $('#s-when').onchange = e => { q.when = e.target.value; if (q.when !== 'date') q.month = dateOf(q.day).getUTCMonth(); re(); };
  if ($('#s-day')) $('#s-day').onchange = e => { const v = Date.parse(e.target.value + 'T00:00:00Z'); if (!isNaN(v)) q.day = Math.max(0, Math.min(364, Math.round((v - FIRST_DAY) / 864e5))); re(); };
  if ($('#s-month')) $('#s-month').onchange = e => { q.month = Number(e.target.value); re(); };
  $('#s-region').onchange = e => { q.region = e.target.value; re(); };
  root.querySelectorAll('.s-stay button').forEach(b => b.onclick = () => setState({ mission: Number(b.dataset.m) }));
  $('#s-go').onclick = () => { searched = true; re(); };
  root.querySelectorAll('[data-month]').forEach(b => b.onclick = () => { q.month = Number(b.dataset.month); re(); });
  root.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { q.day = Number(b.dataset.day); re(); });
  root.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { sort = b.dataset.sort; re(); });
  root.querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
    const day = Number(b.dataset.at);
    setState({ view: 'focus', site: b.dataset.open, day, baseline: day, hour: 0, zoom: 4, d3: 0 });
  });
}
