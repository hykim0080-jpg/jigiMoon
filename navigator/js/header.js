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

let opts = {}, dataRef = null;
export function init(el, data, o = {}) {
  root = el; opts = o; dataRef = data;
  root.innerHTML = `
    <span class="app-name">${t('app')}</span>
    <div class="hb-trip">
      <button type="button" class="hb-tb" id="when-btn" aria-expanded="false"><span>${t('hbWhen')}</span><b class="hb-when"></b></button>
      <label class="hb-tb hb-where"><span>${t('hbWhere')}</span><b class="hb-wn"></b><select id="site-select">${siteOptions(data)}</select></label>
      <div id="when-pop" hidden>
        <div class="stepper">
          <button id="prev" aria-label="${t('prev')}">◀</button><span class="date n"></span><button id="next" aria-label="${t('next')}">▶</button>
          <span class="slip n"></span>
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
    select: root.querySelector('#site-select'),
    date: root.querySelector('.date'),
    slip: root.querySelector('.slip'),
    verdict: root.querySelector('.verdict'),
    stepper: root.querySelector('.stepper'),
    chips: root.querySelector('.chips'),
    side: root.querySelector('#side-btn'), advWrap: root.querySelector('.adv'), advBtn: root.querySelector('#adv-btn'),
    when: root.querySelector('.hb-when'), wn: root.querySelector('.hb-wn'), ans: root.querySelector('.hb-ans')
  };
  // WHEN: the date, stay and GO windows in one pop-up under the box, like Find a site
  const wpop = root.querySelector('#when-pop'), wbtn = root.querySelector('#when-btn');
  const wopen = on => { wpop.hidden = !on; wbtn.setAttribute('aria-expanded', String(on)); };
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
  refs.select.addEventListener('change', e => {
    if (e.target.value !== ANY) { setState({ site: e.target.value }); return; }
    // Anywhere: the best spot for the date and stay (the same ranking as Find a site), opened as the pin
    e.target.value = state.site; refs.wn.textContent = t('anywhereBusy');
    ranked(state.day, state.mission, state.crit).then(l => { if (l[0] && opts.openPin) opts.openPin(Math.round(l[0].x), Math.round(l[0].y)); else render(state, dataRef); }).catch(err => { console.error(err); render(state, dataRef); });
  });
  // Anytime: the best landing day of the year for this place
  root.querySelector('#anytime').addEventListener('click', () => { const d = bestDay(state, dataRef); if (d != null) { setState({ day: d }); wopen(false); } });
  root.querySelector('#prev').addEventListener('click', () => setState({ day: state.day - 1 }));
  root.querySelector('#next').addEventListener('click', () => setState({ day: state.day + 1 }));
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
  { // the pin can be (re)created from the map: keep the options in step with the index
    const html = siteOptions(data);
    if (refs.select.dataset.html !== html) { refs.select.innerHTML = html; refs.select.dataset.html = html; }
  }
  refs.select.value = st.site;
  refs.adv.querySelectorAll('.crit').forEach(r => r.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(st.crit[r.dataset.c] === Number(b.dataset.v)))));
  refs.advBtn.classList.toggle('changed', !isDefault(st.crit));
  refs.date.textContent = isoDate(st.day);
  refs.when.textContent = `${longDate(st.day)} · ${t('d', st.mission)}`;
  refs.wn.textContent = refs.select.selectedOptions[0]?.textContent || '';
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

const ANY = '__any';
const siteOptions = data => `<option value="${ANY}">${t('anywhere')}</option>` + data.index.sites.map(s => `<option value="${s.id}">${siteName(s)}</option>`).join('');
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
