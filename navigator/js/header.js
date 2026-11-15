// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { state, setState, limitsOf } from './state.js';
import { MAST_SLIDER, BUDGET, THRESHOLDS } from './config.js';
import { ranked } from './rank3d.js';
import { bestFix } from './logic.js';
import { t, siteName } from './strings.js';
import { status, fixText, isoDate, nearestOk, goRuns, shortDate, dateOf } from './logic.js';
import { moveShort } from './orient.js';
import { LEVELS, critQuery, isDefault } from './criteria.js';
import { verdictFor } from './verdict.js';
import { isFull } from './full.js';

let root, refs;

const seg = (items, key) => `<div class="seg" data-key="${key}">${items.map(([v, label]) => `<button data-v="${v}">${label}</button>`).join('')}</div>`;

let opts = {}, dataRef = null, calMonth = 0;
export function init(el, data, o = {}) {
  root = el; opts = o; dataRef = data;
  root.innerHTML = `
    <span class="app-name">${t('app')}</span>
    <div class="hb-trip">
      <button type="button" class="hb-tb" id="when-btn" aria-expanded="false"><span>${t('hbWhen')}</span><b class="hb-when"></b></button>
      <button type="button" class="hb-tb hb-where" id="where-btn" aria-haspopup="listbox" aria-expanded="false"><span>${t('hbWhere')}</span><b class="hb-wn"></b></button>
      <div id="where-pop" role="listbox" tabindex="-1" aria-label="${t('hbWhere')}" hidden></div>
      <div id="when-pop" hidden>
        <div class="stepper wp-cal">
          <div class="wp-mh"><button type="button" id="mprev" aria-label="${t('prevMonth')}">◀</button><b class="wp-mn"></b><button type="button" id="mnext" aria-label="${t('nextMonth')}">▶</button><span class="slip n"></span></div>
          <div class="wp-grid" role="grid"></div>
        </div>
        ${seg([[14, t('d', 14)], [6, t('d', 6)]], 'mission')}
        <button type="button" class="hb-any" id="anytime">${t('anytime')}</button>
        <div class="chips" hidden></div>
      </div>
    </div>
    <p class="hb-ans" aria-live="polite"></p>
    <div class="verdict"></div>
    <a id="api-link" class="api-link" target="_blank" rel="noopener" title="${t('apiTip')}">${t('apiLabel')}</a>
    <div class="adv"><button id="adv-btn" aria-label="${t('advanced')}" aria-expanded="false">⋯</button>
      <div id="adv-panel" hidden>${[['sun', '≥', '%'], ['earth', '≥', '%'], ['dark', '≤', 'h']].map(([k, op, u]) => `<div class="crit" data-c="${k}"><span>${t(k)} ${op}</span><span class="cseg">${LEVELS[k].map(v => `<button data-v="${v}">${v}</button>`).join('')}</span><span>${u}</span></div>`).join('')}<hr>${[['moveMax','maxMove',0.25,6,0.25],['mastMax','maxMast',MAST_SLIDER.min,MAST_SLIDER.max,1],['waitMax','maxWait',0,120,1]].map(([k,l,mn,mx,sp])=>`<label>${t(l)}<span class="rw"><input type="range" min="${mn}" max="${mx}" step="${sp}" data-k="${k}"></span><input class="n" type="number" min="${mn}" max="${mx}" step="${sp}" data-k="${k}"></label>`).join('')}</div></div>
    <button id="side-btn" type="button" aria-pressed="false">${t('compare')}</button>
    ${seg([['focus', t('focus')], ['find', t('modeFind')]], 'view')}`;
  refs = {
    wpop: root.querySelector('#where-pop'), wbtn: root.querySelector('#where-btn'),
    mn: root.querySelector('.wp-mn'), grid: root.querySelector('.wp-grid'), mseg: root.querySelector('#when-pop .seg[data-key="mission"]'),
    slip: root.querySelector('.slip'),
    verdict: root.querySelector('.verdict'),
    stepper: root.querySelector('.stepper'),
    chips: root.querySelector('.chips'),
    side: root.querySelector('#side-btn'), advWrap: root.querySelector('.adv'), advBtn: root.querySelector('#adv-btn'),
    when: root.querySelector('.hb-when'), wn: root.querySelector('.hb-wn'), ans: root.querySelector('.hb-ans')
  };
  // WHEN: the date, stay and GO windows in one pop-up under the box, like Find a site
  const wpop = root.querySelector('#when-pop'), wbtn = root.querySelector('#when-btn');
  // WHEN is for picking: a month of days (green = GO at this place) and Anytime. Stepping a day at a time and the
  // stay length live in the time bar under the 3D map; with the flat map (no bar) the stay stays here.
  const wopen = on => { wpop.hidden = !on; wbtn.setAttribute('aria-expanded', String(on)); if (on) { calMonth = dateOf(state.day).getUTCMonth(); render(state, dataRef); } };
  wbtn.addEventListener('click', () => wopen(wpop.hidden));
  document.addEventListener('pointerdown', e => { if (!wpop.hidden && !wpop.contains(e.target) && !wbtn.contains(e.target)) wopen(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !wpop.hidden) { e.stopImmediatePropagation(); wopen(false); } }, true);
  const adv = root.querySelector('#adv-panel'), btn = root.querySelector('#adv-btn');
  btn.addEventListener('click', () => { adv.hidden = !adv.hidden; btn.setAttribute('aria-expanded', String(!adv.hidden)); });
  adv.addEventListener('click', e => {
    const b = e.target.closest('.crit button');
    if (b) setState({ crit: { ...state.crit, [b.closest('.crit').dataset.c]: Number(b.dataset.v) } });
  });
  adv.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) setState({ [e.target.dataset.k]: v });
  });
  refs.adv = adv;
  refs.chips.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setState({ day: Number(b.dataset.day) }); });
  // Side by side lives inside Detail: a toggle beside the tabs, Detail stays the pressed tab
  root.querySelector('#side-btn').addEventListener('click', () => setState({ view: state.view === 'compare' ? 'focus' : 'compare' }));
  // WHERE: our own list under the box (same look as the WHEN pop-up): Anywhere, then saved pins, then the example sites,
  // each with a GO / NO-GO dot for the chosen date and stay. Arrow keys move, Enter picks, Esc or a click outside closes.
  const pick = v => {
    ropen(false);
    if (v !== ANY) { setState({ site: v }); return; }
    // Anywhere: the best spot for the date and stay (the same ranking as Find a site), opened as the pin
    refs.wn.textContent = t('anywhereBusy');
    ranked(state.day, state.mission, state.crit).then(l => { if (l[0] && opts.openPin) opts.openPin(Math.round(l[0].x), Math.round(l[0].y)); else render(state, dataRef); }).catch(err => { console.error(err); render(state, dataRef); });
  };
  const items = () => [...refs.wpop.querySelectorAll('[role="option"]')];
  const focusItem = i => { const l = items(); if (!l.length) return; const k = (i + l.length) % l.length; l.forEach((b, j) => b.tabIndex = j === k ? 0 : -1); l[k].focus(); };
  const ropen = on => {
    refs.wpop.hidden = !on; refs.wbtn.setAttribute('aria-expanded', String(on));
    if (on) { wopen(false); refs.wpop.style.left = refs.wbtn.offsetLeft + "px"; refs.wpop.innerHTML = whereList(state, dataRef); const l = items(); focusItem(Math.max(0, l.findIndex(b => b.getAttribute('aria-selected') === 'true'))); }
  };
  refs.wbtn.addEventListener('click', () => ropen(refs.wpop.hidden));
  wbtn.addEventListener('click', () => { if (!refs.wpop.hidden) ropen(false); });
  refs.wpop.addEventListener('click', e => { const b = e.target.closest('[role="option"]'); if (b) pick(b.dataset.v); });
  refs.wpop.addEventListener('keydown', e => {
    const l = items(), i = l.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); focusItem(-1); }
    else if (e.key === 'Enter' && i >= 0) { e.preventDefault(); pick(l[i].dataset.v); }
    else if (e.key === 'Tab') ropen(false);
  });
  document.addEventListener('pointerdown', e => { if (!refs.wpop.hidden && !refs.wpop.contains(e.target) && !refs.wbtn.contains(e.target)) ropen(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !refs.wpop.hidden) { e.stopImmediatePropagation(); ropen(false); refs.wbtn.focus(); } }, true);
  // Anytime: the best landing day of the year for this place
  root.querySelector('#anytime').addEventListener('click', () => { const d = bestDay(state, dataRef); if (d != null) { setState({ day: d }); wopen(false); } });
  root.querySelector('#mprev').addEventListener('click', () => { calMonth = Math.max(0, calMonth - 1); render(state, dataRef); });
  root.querySelector('#mnext').addEventListener('click', () => { calMonth = Math.min(11, calMonth + 1); render(state, dataRef); });
  refs.grid.addEventListener('click', e => { const b = e.target.closest('button[data-day]'); if (b) { setState({ day: Number(b.dataset.day) }); wopen(false); } });
  root.querySelectorAll('.seg').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const key = g.dataset.key;
    setState({ [key]: key === 'mission' ? Number(b.dataset.v) : b.dataset.v });
  }));
}

// Find a site (the layer viewer) at the selected site and month
export function findHref(st, data, atSite) {
  const s = data.index.byId[st.site], mon = dateOf(st.day).getUTCMonth() + 1;
  const l = new URLSearchParams(location.hash.slice(1)).get('lang') || new URLSearchParams(location.search).get('lang') || 'en';
  return `layers/index.html?embed=1&lang=${l}#` + (atSite && s ? `pin=${Math.round(s.x_m)},${Math.round(s.y_m)}&mon=${mon}&lang=${l}${critQuery(st.crit)}` : `lang=${l}`);
}

export function render(st, data) {
  if (!refs.wpop.hidden) { const html = whereList(st, data), f = document.activeElement?.dataset?.v; if (refs.wpop.dataset.html !== html) { refs.wpop.innerHTML = html; refs.wpop.dataset.html = html; const b = f && refs.wpop.querySelector(`[data-v="${f}"]`); if (b) b.focus(); } }
  refs.adv.querySelectorAll('.crit').forEach(r => r.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(st.crit[r.dataset.c] === Number(b.dataset.v)))));
  refs.advBtn.classList.toggle('changed', !isDefault(st.crit));
  if (!root.querySelector('#when-pop').hidden) {
    refs.mn.textContent = `${t('months')[calMonth]} 2027`;
    refs.grid.innerHTML = monthGrid(st, data, calMonth);
    const bar = document.querySelector('.tbar'); refs.mseg.hidden = !!(bar && !bar.hidden);
  }
  refs.when.textContent = `${longDate(st.day)} · ${t('d', st.mission)}`;
  { const s = data.index.byId[st.site]; refs.wn.textContent = s ? siteName(s) : ''; }
  { // Limits and Side by side: in the dock beside the map on the full map, else at the right of the bar
    const dock = isFull(st) && document.getElementById('dock'), adv = refs.advWrap, sb = refs.side;
    const home = dock || root, before = dock ? null : root.querySelector('.seg[data-key="view"]');
    if (adv.parentNode !== home) { home.insertBefore(adv, before); home.insertBefore(sb, before); }
    adv.classList.toggle('in-dock', !!dock); adv.firstElementChild.textContent = dock ? t('advanced') : '⋯';
  }
  const slip = st.day - st.baseline;
  refs.slip.textContent = slip ? t('slip', slip) : '';
  refs.slip.title = t('slipTip', isoDate(st.baseline));
  root.querySelectorAll('.seg').forEach(g => g.querySelectorAll('button').forEach(b => {
    const v = g.dataset.key === 'view' && st.view === 'compare' ? 'focus' : String(st[g.dataset.key]);
    b.setAttribute('aria-pressed', String(v === b.dataset.v));
  }));
  const side = refs.side;
  side.hidden = st.view === 'find';
  side.setAttribute('aria-pressed', String(st.view === 'compare'));

  refs.adv.querySelectorAll('input').forEach(i => {
    if (document.activeElement !== i) i.value = st[i.dataset.k];
  });
  const lim = limitsOf(st);
  const e = data.index.modes[st.mission].sites[st.site];
  const s = status(e, st.day, st.mast, lim);
  // site-first: GO windows of the selected site as chips instead of the date stepper
  const siteMode = st.mode === 'site';
  refs.stepper.hidden = siteMode; refs.chips.hidden = !siteMode;
  if (siteMode) {
    const runs = goRuns(e, st.mast, lim);
    refs.chips.innerHTML = runs.map(r => `<button data-day="${r.start}" aria-pressed="${st.day >= r.start && st.day < r.start + r.len}">${t('window', shortDate(r.start), r.len)}</button>`).join('');
    refs.chips.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  let html;
  if (s.kind === 'ok') {
    html = s.capped
      ? `<i class="dot"></i>${t('go')}<span class="fix" style="color:var(--mast)">· ${t('mast')} ${t('m', st.mast)}</span>`
      : `<i class="dot"></i>${t('go')}`;
  } else if (s.kind === 'none') {
    html = `<i class="dot"></i>${t('nogo')}<span class="fix small">→ ${t('noFix', lim.move, st.mastMax, lim.wait)}</span>`;
  } else {
    let extra = '';
    if (s.kind === 'move' && data.site) { const n = nearestOk(data.site, st.day); if (n && n.d > 0) extra = t('avail_move_dir', s.value, moveShort(n.c.dx, n.c.dy)); }
    html = `<i class="dot"></i>${t('nogo')}<span>→</span><span class="fix" style="color:var(--${s.kind})">${extra || fixText(s)}</span>`;
  }
  answer(st, data, lim, s, slip);
  refs.verdict.className = 'verdict' + (s.kind === 'ok' ? '' : ' nogo');
  refs.verdict.innerHTML = html;
  apiLink(st);
}

// one month of 2027 for the WHEN pop-up: Monday first; a GO day (for this place, date and stay) is green,
// the chosen day is filled, the planned day underlined
function monthGrid(st, data, m) {
  const e = data.index.modes[st.mission]?.sites[st.site], lim = limitsOf(st);
  const d0 = Math.round((Date.UTC(2027, m, 1) - Date.UTC(2027, 0, 1)) / 864e5), n = new Date(Date.UTC(2027, m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(2027, m, 1)).getUTCDay() + 6) % 7;
  let h = t('weekdays').map(w => `<em>${w}</em>`).join('') + '<span></span>'.repeat(lead);
  for (let i = 0; i < n; i++) {
    const d = d0 + i, go = e && status(e, d, st.mast, lim).kind === 'ok';
    h += `<button type="button" data-day="${d}" class="${go ? 'go' : ''}${d === st.baseline ? ' plan' : ''}" aria-pressed="${d === st.day}" aria-label="${shortDate(d)}${go ? ' · GO' : ''}">${i + 1}</button>`;
  }
  return h;
}
const ANY = '__any';
// the WHERE list: Anywhere, saved pins (newest map picks), then the example sites; the dot is GO / NO-GO on the chosen date
function whereList(st, data) {
  const mode = data.index.modes[st.mission]?.sites || {}, lim = limitsOf(st);
  const row = s => {
    const e = mode[s.id], k = e ? status(e, st.day, st.mast, lim).kind : null;
    const dot = k == null ? '' : k === 'ok' ? 'go' : 'nogo', sel = s.id === st.site;
    return `<button type="button" role="option" tabindex="-1" data-v="${s.id}" aria-selected="${sel}"><i class="wd ${dot}" aria-label="${k == null ? '' : k === 'ok' ? t('go') : t('nogo')}"></i><span>${esc(siteName(s))}</span></button>`;
  };
  const pins = data.index.sites.filter(s => /^pin/.test(s.id)), ex = data.index.sites.filter(s => !/^pin/.test(s.id));
  return `<button type="button" role="option" tabindex="-1" data-v="${ANY}" aria-selected="false" class="wp-any"><i class="wd any"></i><span>${t('anywhere')}</span></button>`
    + (pins.length ? `<hr>${pins.map(row).join('')}` : '') + `<hr>${ex.map(row).join('')}`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// best day of the year for the selected place: a GO day with the most room over the Sun and Earth limits (earliest on
// a tie); with no GO day, the one whose cheapest fix uses the least of its limit
function bestDay(st, data) {
  const e = data.index.modes[st.mission]?.sites[st.site], cal = data.site && data.site.cal, c = st.crit || THRESHOLDS;
  if (!e) return null;
  let best = null, bs = -Infinity;
  for (let d = 0; d < e.ok.length; d++) {
    if (!e.ok[d]) continue;
    const s = cal ? Math.min(cal.sun[d] - c.sun, cal.earth[d] - c.earth, c.dark - cal.dark[d]) : 0;
    if (s > bs) { bs = s; best = d; }
  }
  if (best != null) return best;
  const lim = limitsOf(st); let bf = Infinity;
  for (let d = 0; d < e.ok.length; d++) { const f = bestFix(e, d, lim); if (f && f.frac < bf) { bf = f.frac; best = d; } }
  return best;
}
const longDate = d => dateOf(d).toLocaleDateString(document.documentElement.lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
// one sentence, like Find a site's: where, when, how long, the verdict, what misses, and the fix
function answer(st, data, lim, s, slip) {
  const v = data.site ? verdictFor(st, data, lim) : null, name = refs.wn.textContent;
  let tail = '';
  if (v && !v.go) {
    const miss = v.fails.map(f => f.text.split(' · ')[0]).join(', ');
    tail = `${miss ? ` — ${miss}` : ''}.${v.fix ? ` <span style="color:var(--${v.fixKind})">${v.fix}.</span>` : ''}`;
  } else if (v && v.capped) tail = ` <span style="color:var(--mast)">${t('mast')} ${t('m', st.mast)}</span>.`;
  else tail = '.';
  const word = `<b class="${s.kind === 'ok' ? 'hb-go' : 'hb-nogo'}">${s.kind === 'ok' ? t('go') : t('nogo')}</b>`;
  refs.ans.innerHTML = t('hbAns', `<b>${name}</b>`, `<b>${longDate(st.day)}</b>`, `<b>${t('hbDays', st.mission)}</b>`, slip ? t('hbSlip', slip) : '', word) + tail;
}

// the same verdict as JSON from the Cloudflare Pages Functions API (/api/check); custom pins are not served
function apiLink(st) {
  const a = root.querySelector('#api-link');
  a.hidden = st.site === 'pin';
  if (a.hidden) return;
  const q = new URLSearchParams({ site: st.site, date: isoDate(st.day), mission: String(st.mission) });
  if (st.mast) q.set('mast', st.mast);
  if (!isDefault(st.crit)) { q.set('sun', st.crit.sun); q.set('earth', st.crit.earth); q.set('dark', st.crit.dark); }
  if (st.moveMax !== BUDGET.move) q.set('max_move', st.moveMax);
  if (st.mastMax !== BUDGET.mast) q.set('max_mast', st.mastMax);
  if (st.waitMax !== BUDGET.wait) q.set('max_wait', st.waitMax);
  a.href = `api/check?${q}`;
}
