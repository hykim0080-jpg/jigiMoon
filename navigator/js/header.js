import { state, setState, limitsOf } from './state.js';
import { MAST_SLIDER } from './config.js';
import { t, siteName } from './strings.js';
import { status, fixText, isoDate, nearestOk, goRuns, shortDate, dateOf } from './logic.js';
import { moveShort } from './orient.js';
import { LEVELS, critQuery, isDefault } from './criteria.js';

let root, refs;

const seg = (items, key) => `<div class="seg" data-key="${key}">${items.map(([v, label]) => `<button data-v="${v}">${label}</button>`).join('')}</div>`;

export function init(el, data) {
  root = el;
  root.innerHTML = `
    <nav class="seg pages"><a href="#" aria-current="page">${t('modeCompare')}</a><a href="layers/index.html" id="find-link">${t('modeFind')}</a></nav>
    <span class="app-name">${t('app')}</span>
    <select id="site-select">${data.index.sites.map(s => `<option value="${s.id}">${siteName(s)}</option>`).join('')}</select>
    ${seg([['date', t('modeDate')], ['site', t('modeSite')]], 'mode')}
    <div class="stepper">
      <button id="prev" aria-label="${t('prev')}">◀</button><span class="date n"></span><button id="next" aria-label="${t('next')}">▶</button>
      <span class="slip n"></span>
    </div>
    ${seg([[14, t('d', 14)], [6, t('d', 6)]], 'mission')}
    <div class="chips" hidden></div>
    <span class="grow"></span>
    <div class="verdict"></div>
    <div class="adv"><button id="adv-btn" aria-label="${t('advanced')}" aria-expanded="false">⋯</button>
      <div id="adv-panel" hidden>${[['sun', '≥', '%'], ['earth', '≥', '%'], ['dark', '≤', 'h']].map(([k, op, u]) => `<div class="crit" data-c="${k}"><span>${t(k)} ${op}</span><span class="cseg">${LEVELS[k].map(v => `<button data-v="${v}">${v}</button>`).join('')}</span><span>${u}</span></div>`).join('')}<hr>${[['moveMax','maxMove',0.25,6,0.25],['mastMax','maxMast',MAST_SLIDER.min,MAST_SLIDER.max,1],['waitMax','maxWait',0,120,1]].map(([k,l,mn,mx,sp])=>`<label>${t(l)}<span class="rw"><input type="range" min="${mn}" max="${mx}" step="${sp}" data-k="${k}">${k==='mastMax'?`<i style="left:${(MAST_SLIDER.mark-mn)/(mx-mn)*100}%"></i>`:''}</span><input class="n" type="number" min="${mn}" max="${mx}" step="${sp}" data-k="${k}"></label>`).join('')}</div></div>
    ${seg([['search', t('searchTab')], ['focus', t('focus')], ['compare', t('compare')], ['sites', t('sites')]], 'view')}`;
  refs = {
    select: root.querySelector('#site-select'),
    date: root.querySelector('.date'),
    slip: root.querySelector('.slip'),
    verdict: root.querySelector('.verdict'),
    stepper: root.querySelector('.stepper'),
    chips: root.querySelector('.chips')
  };
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
  refs.select.addEventListener('change', e => setState({ site: e.target.value }));
  root.querySelector('#prev').addEventListener('click', () => setState({ day: state.day - 1 }));
  root.querySelector('#next').addEventListener('click', () => setState({ day: state.day + 1 }));
  root.querySelectorAll('.seg').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const key = g.dataset.key;
    setState({ [key]: key === 'mission' ? Number(b.dataset.v) : b.dataset.v });
  }));
}

export function render(st, data) {
  { // the pin can be (re)created from the map: keep the options in step with the index
    const html = data.index.sites.map(s => `<option value="${s.id}">${siteName(s)}</option>`).join('');
    if (refs.select.dataset.html !== html) { refs.select.innerHTML = html; refs.select.dataset.html = html; }
  }
  refs.select.value = st.site;
  { // link to the layer viewer at the selected site and month
    const s = data.index.byId[st.site], mon = dateOf(st.day).getUTCMonth() + 1;
    const l = new URLSearchParams(location.hash.slice(1)).get('lang') || new URLSearchParams(location.search).get('lang') || 'en';
    root.querySelector('#find-link').href = `layers/index.html#pin=${Math.round(s.x_m)},${Math.round(s.y_m)}&mon=${mon}&lang=${l}${critQuery(st.crit)}`;
  }
  refs.adv.querySelectorAll('.crit').forEach(r => r.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(st.crit[r.dataset.c] === Number(b.dataset.v)))));
  root.querySelector('#adv-btn').classList.toggle('changed', !isDefault(st.crit));
  refs.date.textContent = isoDate(st.day);
  const slip = st.day - st.baseline;
  refs.slip.textContent = slip ? t('slip', slip) : '';
  refs.slip.title = t('slipTip', isoDate(st.baseline));
  root.querySelectorAll('.seg').forEach(g => g.querySelectorAll('button').forEach(b => {
    b.setAttribute('aria-pressed', String(String(st[g.dataset.key]) === b.dataset.v));
  }));

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
  refs.verdict.className = 'verdict' + (s.kind === 'ok' ? '' : ' nogo');
  refs.verdict.innerHTML = html;
}
