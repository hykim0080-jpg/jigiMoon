// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { state, setState, limitsOf } from './state.js';
import { t, siteName } from './strings.js';
import { THRESHOLDS } from './config.js';
import { bar, el } from './svg.js';
import { loadSite, getSite, calOf } from './data.js';
import { fixes, bestFix, status, fixText } from './logic.js';
import { where } from './orient.js';
import { drawSky } from './sky.js';
import { drawStrips } from './timeline.js';

let root, data;
const SKY_H = 150, STRIP_H = 34;

export function init(node) {
  root = node;
  root.addEventListener('click', e => {
    const x = e.target.closest('[data-unpin]');
    if (x) { setState({ pinned: state.pinned.filter(id => id !== x.dataset.unpin) }); return; }
    const h = e.target.closest('[data-pick]');
    if (h) setState({ site: h.dataset.pick });
  });
}

// selected site + pinned; when nothing is pinned, the two best other sites that day
function columns(st) {
  const ids = [st.site, ...st.pinned.filter(id => id !== st.site)];
  if (!st.pinned.length) {
    const others = data.index.sites.map(s => s.id).filter(id => id !== st.site)
      .map(id => ({ id, v: calOf(id, st.mission) ? calOf(id, st.mission).both[st.day] : -1 }))
      .sort((a, b) => b.v - a.v);
    ids.push(...others.slice(0, 2).map(o => o.id));
  }
  return ids.slice(0, 4);   // up to four: the Find a site shortlist
}

const valBar = (text, o, fail) => `<div class="vl"><span class="n${fail ? ' fail' : ''}">${text}</span>${bar(o)}</div>`;
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
  const cells = (label, fn) => `<div class="lab">${label}</div>` + sites.map(s => `<div class="cell">${fn(s)}</div>`).join('');

  const verdict = id => {
    const s = status(mode[id], st.day, st.mast, lim);
    if (s.kind === 'ok') return `${dot('ok')}${t('go')}`;
    return `${dot('block')}${t('nogo')}${s.kind === 'none' ? '' : ` → <span style="color:var(--${s.kind})">${fixText(s)}</span>`}`;
  };

  const fixCell = kind => s => {
    const e = mode[s.id], v = fixes(e, st.day)[kind], ok = v != null && v <= lim[kind];
    const best = !e.ok[st.day] && bestFix(e, st.day, lim)?.kind === kind;
    const txt = ok ? (kind === 'move' ? t('km', v) : kind === 'mast' ? t('m', v) : t('d', v)) : '—';
    return `<div class="vl" style="color:var(--${best ? 'ink' : 'muted'})"><span class="n" style="width:72px">${txt}</span>${bar({ frac: ok ? v / lim[kind] : 0, color: `var(--${kind})`, dashed: !ok })}</div>`;
  };
  const pct = (v, tick, color, fail) => valBar(t('pct', Math.round(v)), { frac: v / 100, tick, color }, fail);
  const head = s => `<div class="cell head" data-pick="${s.id}" style="position:relative"><b>${siteName(data.index.byId[s.id])}</b><span class="where">${where(data.index.byId[s.id])}</span><span>${verdict(s.id)}</span>${st.pinned.includes(s.id) ? `<button class="x" data-unpin="${s.id}" aria-label="${t('unpin')}">×</button>` : ''}</div>`;
  const sky = () => `<div class="cell"><div class="skyc" data-theme="dark"><svg class="csky" style="height:${SKY_H}px"></svg><svg class="cstrip" style="height:${STRIP_H}px"></svg></div></div>`;
  const nums = [
    [t('sun'), s => pct(mv(s, 'sun'), THRESHOLDS.sun / 100, 'var(--sun)', mv(s, 'sun') < THRESHOLDS.sun)],
    [t('earth'), s => pct(mv(s, 'earth'), THRESHOLDS.earth / 100, 'var(--earth)', mv(s, 'earth') < THRESHOLDS.earth)],
    [t('dark'), s => valBar(t('h', Math.round(mv(s, 'dark'))), { frac: mv(s, 'dark') / 100, tick: THRESHOLDS.dark / 100 }, mv(s, 'dark') > THRESHOLDS.dark)],
  ], fixRows = ['move', 'mast', 'wait'].map(k => [t(k), fixCell(k)]), year = [t('year'), s => `<div class="yearc"><canvas data-site="${s.id}"></canvas><span class="n">${yearPct(mode[s.id], st, lim)}</span></div>`];
  if (innerWidth <= 700) {   // phones: one site after another, each with its own rows
    const row = ([l, fn], s) => `<div class="lab">${l}</div><div class="cell">${fn(s)}</div>`;
    root.innerHTML = `<div class="cmp-list">${sites.map(s => `<div class="cmp cmp-m">${head(s)}${sky()}${nums.map(r => row(r, s)).join('')}<div class="rule"></div>${fixRows.map(r => row(r, s)).join('')}${row(year, s)}</div>`).join('')}</div>`;
  } else root.innerHTML = `<div class="cmp" style="grid-template-columns:88px repeat(${sites.length},minmax(0,1fr))">
    <div></div>${sites.map(head).join('')}
    <div class="lab">${t('sky')}</div>${sites.map(sky).join('')}
    ${nums.map(([l, fn]) => cells(l, fn)).join('')}
    <div class="rule"></div>
    ${fixRows.map(([l, fn]) => cells(l, fn)).join('')}
    ${cells(...year)}
  </div>`;

  const skies = root.querySelectorAll('.csky'), strips = root.querySelectorAll('.cstrip');
  sites.forEach((s, i) => {
    drawSky(skies[i], s, st, { compact: true, h: SKY_H, w: skies[i].clientWidth });
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
