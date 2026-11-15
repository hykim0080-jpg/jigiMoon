// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { state, setState, limitsOf } from './state.js';
import { t, siteName, PIN_IC } from './strings.js';
import { THRESHOLDS } from './config.js';
import { bar, el } from './svg.js';
import { loadSite, getSite, calOf } from './data.js';
import { fixes, bestFix, status, fixText } from './logic.js';
import { where } from './orient.js';
import { drawSky } from './sky.js';
import { drawStrips } from './timeline.js';

let root, data, noSel = false;   // noSel: the selected column clicked again, all columns alike (WHERE keeps the site)
const STRIP_H = 30, SKY_LW = 3.5;
let SKY_H = 225;

export function init(node) {
  root = node;
  root.addEventListener('click', e => {
    if (e.target.closest('select')) return;
    const x = e.target.closest('[data-unpin]');
    if (x) { setState({ pinned: state.pinned.filter(id => id !== x.dataset.unpin), ...(x.dataset.unpin === state.site && data.compared ? { site: data.compared.find(id => id !== state.site) || state.site } : {}) }); return; }
    // a click anywhere in a column selects that site (WHERE, the map and the fixes follow); the columns keep their order
    const h = e.target.closest('[data-pick]');
    if (!h) return;
    if (h.dataset.pick === state.site) { noSel = !noSel; data.cmpNoSel = noSel; setState({}); return; }
    noSel = false; data.cmpNoSel = false; setState({ site: h.dataset.pick, pinned: [...(data.compared || [])] });
  });
  // ▾ next to a column's name: change that column's site only
  root.addEventListener('change', e => {
    const sel = e.target.closest('select[data-col]'); if (!sel || !data.compared) return;
    const i = +sel.dataset.col, old = data.compared[i], nu = sel.value; if (!nu || nu === old) return;
    const ids = data.compared.map(id => id === old ? nu : id).filter((id, k, a) => a.indexOf(id) === k);
    setState({ pinned: ids, ...(old === state.site ? { site: nu } : {}) });
  });
}

// selected site + pinned; when nothing is pinned, the two best other sites that day
function columns(st) {
  if (st.pinned.includes(st.site)) return st.pinned.slice(0, 4);   // chosen in Side by side: the order stays
  const ids = [st.site, ...st.pinned.filter(id => id !== st.site)];
  if (!st.pinned.length) {
    const others = data.index.sites.map(s => s.id).filter(id => id !== st.site)
      .map(id => ({ id, v: calOf(id, st.mission) ? calOf(id, st.mission).both[st.day] : -1 }))
      .sort((a, b) => b.v - a.v);
    ids.push(...others.slice(0, 2).map(o => o.id));
  }
  return ids.slice(0, 4);   // up to four: the Find a site shortlist
}

const dot = c => `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--${c});margin-right:6px"></i>`;

export function render(st, d) {
  data = d;
  const ids = columns(st);
  data.compared = ids;
  const sites = ids.map(id => getSite(id, st.mission));
  ids.forEach((id, i) => { if (!sites[i]) loadSite(id, st.mission).then(() => render(state, data)); });
  if (sites.some(s => !s)) return;

  const mv = (s, k) => (st.mast && s.mast ? s.mast[k][st.mast][st.day] : s.cal[k][st.day]);
  const lim = limitsOf(st), mode = data.index.modes[st.mission].sites;
  const sel = s => !noSel && s.id === st.site ? ' sel' : '';
  const cells = (label, fn) => `<div class="lab">${label}</div>` + sites.map(s => `<div class="cell${sel(s)}" data-pick="${s.id}">${fn(s)}</div>`).join('');
  const opts = cur => data.index.sites.map(o => `<option value="${o.id}"${o.id === cur ? ' selected' : ''}>${siteName(o)}</option>`).join('');

  const verdict = id => {
    const s = status(mode[id], st.day, st.mast, lim);
    if (s.kind === 'ok') return `${dot('ok')}${t('go')}`;
    return `${dot('block')}${t('nogo')}${s.kind === 'none' ? '' : ` → <span style="color:var(--${s.kind})">${fixText(s)}</span>`}`;
  };

  // one compact line of numbers; the failing one in red
  const nums = s => {
    const v = { sun: mv(s, 'sun'), earth: mv(s, 'earth'), dark: mv(s, 'dark') };
    const bad = { sun: v.sun < THRESHOLDS.sun, earth: v.earth < THRESHOLDS.earth, dark: v.dark > THRESHOLDS.dark };
    const it = (k, ic, txt) => `<span class="ci${bad[k] ? ' fail' : ''}" title="${k === 'dark' ? t('darkTip') : t(k)}"><i style="color:var(--${k === 'dark' ? 'muted' : k})">${ic}</i>${txt}</span>`;
    return `<div class="cline">${it('sun', '☀', t('pct', Math.round(v.sun)))}${it('earth', '⊕', t('pct', Math.round(v.earth)))}${it('dark', '⟷', t('h', Math.round(v.dark)))}</div>`;
  };
  // one compact line of fixes; GO needs none
  const fixLine = s => {
    const e = mode[s.id];
    if (status(e, st.day, st.mast, lim).kind === 'ok') return `<div class="cline dim">${t('noFixNeeded')}</div>`;
    const f = fixes(e, st.day), best = bestFix(e, st.day, lim)?.kind;
    const it = k => {
      const v = f[k], ok = v != null && v <= lim[k];
      const txt = ok ? (k === 'move' ? t('km', v) : k === 'mast' ? t('m', v) : t('d', v)) : '—';
      return `<span class="ci${k === best ? ' best' : ''}" style="${k === best ? `color:var(--${k})` : ''}"><small>${t(k)}</small>${txt}</span>`;
    };
    return `<div class="cline">${['move', 'mast', 'wait'].map(it).join('')}</div>`;
  };
  const head = (s, i) => `<div class="cell head${sel(s)}" data-pick="${s.id}" style="position:relative"><b class="cname">${data.index.byId[s.id]?.isPin ? PIN_IC : ''}${siteName(data.index.byId[s.id])}<span class="cdd">▾<select data-col="${i}" aria-label="${t('hbWhere')}">${opts(s.id)}</select></span></b><span class="where">${where(data.index.byId[s.id])}</span><span>${verdict(s.id)}</span>${st.pinned.includes(s.id) ? `<button class="x" data-unpin="${s.id}" aria-label="${t('unpin')}">×</button>` : ''}</div>`;
  const sky = s => `<div class="cell${sel(s)}" data-pick="${s.id}"><div class="skyc" data-theme="dark"><svg class="csky" style="height:${SKY_H}px"></svg><svg class="cstrip" style="height:${STRIP_H}px"></svg></div></div>`;
  const year = s => `<div class="yearc"><canvas data-site="${s.id}"></canvas><span class="n">${yearPct(mode[s.id], st, lim)} %</span></div>`;
  const rows = [['', nums], ['', fixLine], [t('year'), year]];
  if (innerWidth <= 700) {   // phones: one site after another, each with its own rows
    SKY_H = 200;
    const row = ([l, fn], s) => `<div class="cell full">${fn(s)}</div>`;
    root.innerHTML = `<div class="cmp-list">${sites.map(s => `<div class="cmp cmp-m">${head(s, sites.indexOf(s))}${sky(s)}${rows.map(r => row(r, s)).join('')}</div>`).join('')}</div>`;
  } else {
    // the sky chart takes whatever height the compact rows leave
    SKY_H = Math.max(200, Math.min(340, (root.clientHeight || 520) - 210));
    root.innerHTML = `<div class="cmp sbs${noSel ? '' : ' has-sel'}" style="grid-template-columns:44px repeat(${sites.length},minmax(0,1fr))">
    <div></div>${sites.map(head).join('')}
    <div class="lab">${t('sky')}</div>${sites.map(sky).join('')}
    ${rows.map(([l, fn]) => cells(l, fn)).join('')}
  </div>`;
  }

  const skies = root.querySelectorAll('.csky'), strips = root.querySelectorAll('.cstrip');
  sites.forEach((s, i) => {
    drawSky(skies[i], s, st, { compact: true, h: SKY_H, w: skies[i].clientWidth, lw: SKY_LW });
    const w = strips[i].clientWidth;
    strips[i].setAttribute('viewBox', `0 0 ${w} ${STRIP_H}`);
    drawStrips(el('g', {}, strips[i]), s.sky, st, { x0: 24, x1: w - 6, y: 4, brackets: false });
    const x = 24 + st.hour / (st.mission * 24) * (w - 30);
    el('line', { x1: x, x2: x, y1: 0, y2: STRIP_H, stroke: 'var(--ink)' }, strips[i]);
  });
  root.querySelectorAll('canvas').forEach(c => drawYear(c, mode[c.dataset.site], st, lim));
}

function yearPct(e, st, lim) {
  let ok = 0;
  for (let d = 0; d < 365; d++) if (status(e, d, st.mast, lim).kind === 'ok') ok++;
  return Math.round(ok / 365 * 100);
}

function drawYear(c, e, st, lim) {
  const dpr = devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
  c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const cs = getComputedStyle(c), cw = w / 365, col = n => cs.getPropertyValue(n).trim();
  for (let d = 0; d < 365; d++) {
    const s = status(e, d, st.mast, lim);
    g.fillStyle = col('--' + s.kind);
    g.fillRect(d * cw, 0, Math.ceil(cw), h);
    if (s.capped) { g.fillStyle = col('--mast'); g.fillRect(d * cw, 0, Math.ceil(cw), 3); }
  }
  g.fillStyle = col('--ink');
  g.fillRect((st.day + .5) * cw, 0, 1, h);
}
