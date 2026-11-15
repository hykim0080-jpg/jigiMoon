import { MAST_HEIGHTS } from './config.js';
import { state, setState, limitsOf } from './state.js';
import { t } from './strings.js';
import { el, text, clear, bar, showTip, hideTip } from './svg.js';
import { fixes, bestFix, shortDate, nearestOk } from './logic.js';
import { movePhrase } from './orient.js';
import { failStats, failReason } from './failreason.js';

const KINDS = ['move', 'mast', 'wait'];
let root, cards = {}, why;

export function init(node) {
  root = node;
  why = document.createElement('div'); why.id = 'why'; why.hidden = true; root.appendChild(why);
  for (const k of KINDS) {
    const c = document.createElement('div');
    c.className = 'card';
    c.style.setProperty('--fc', `var(--${k})`);
    c.innerHTML = `<div class="left"><h2>${t(k)}</h2><div class="val"><b></b><span></span></div><div class="dir"></div><div class="effort"></div></div><div class="vis"><svg viewBox="0 0 176 168"></svg></div>`;
    root.appendChild(c);
    cards[k] = { c, val: c.querySelector('b'), dir: c.querySelector('.dir'), unit: c.querySelector('.val span'), effort: c.querySelector('.effort'), svg: c.querySelector('svg') };
  }
}

const UNIT = { move: 'unitKm', mast: 'unitM', wait: 'unitD' };

// centre and 3 km radius of the MOVE grid in page px (for the connector)
export function gridCenter() {
  const r = cards.move.svg.getBoundingClientRect(), k = r.width / 176;
  return { x: r.left + 88 * k, y: r.top + 84 * k, r: 3 / 3.125 * 84 * k };
}

export function render(st, data) {
  const e = data.index.modes[st.mission].sites[st.site], lim = limitsOf(st);
  const f = fixes(e, st.day), best = e.ok[st.day] ? null : bestFix(e, st.day, lim);
  for (const k of KINDS) {
    const v = e.ok[st.day] ? 0 : f[k], avail = v != null && v <= lim[k], card = cards[k];
    card.c.classList.toggle('best', !!best && best.kind === k);
    card.c.classList.toggle('na', !avail);
    card.val.textContent = avail ? v : '—';
    card.unit.textContent = avail ? t(UNIT[k]) : '';
    card.effort.innerHTML = bar({ frac: avail && lim[k] ? v / lim[k] : 0, color: `var(--${k})`, dashed: !avail });
  }
  const near = data.site && f.move != null && !e.ok[st.day] ? nearestOk(data.site, st.day) : null;
  cards.move.dir.textContent = near && near.d > 0 && f.move <= lim.move ? movePhrase(near.c.dx, near.c.dy) : '';
  if (!data.site) return;
  // no fix within the limits: say why in one sentence, above the three empty cards
  const none = !e.ok[st.day] && !best;
  why.hidden = !none;
  if (none) {
    const key = [st.site, st.day, st.mission, lim.move, lim.mast, lim.wait, st.crit && `${st.crit.sun}/${st.crit.earth}/${st.crit.dark}`, document.documentElement.lang].join('|');
    if (why.dataset.key !== key) {
      why.dataset.key = key;
      try { why.textContent = failReason(failStats(data.site, st.day, st.crit, lim, st.mission), (document.documentElement.lang || 'en').startsWith('ko') ? 'ko' : 'en').text; }
      catch (err) { console.error(err); why.hidden = true; }
    }
  }
  drawMove(cards.move.svg, st, data);
  drawMast(cards.mast.svg, st, e, lim, data);
  drawWait(cards.wait.svg, st, e);
}

function drawMove(svg, st, data) {
  clear(svg);
  const { grid, stepKm } = data.site, r = 3 + stepKm / 2, sc = 168 / (2 * r), cell = stepKm * sc;
  const g = el('g', { transform: 'translate(88,84)' }, svg);
  let nearest = null;
  const sens = data.index.sens[st.site] || {};
  for (const c of grid) {
    const ok = c.ok[st.day] === '1', x = c.dx * sc - cell / 2, y = -c.dy * sc - cell / 2;
    const rect = el('rect', { x, y, width: cell, height: cell, fill: ok ? 'var(--move)' : 'var(--none)', 'fill-opacity': c.landable ? 1 : .4, 'data-i': grid.indexOf(c) }, g);
    if (ok) {
      const d = Math.hypot(c.dx, c.dy);
      if (!nearest || d < nearest.d) nearest = { d, c };
    }
  }
  el('path', { d: 'M-5,0H5M0,-5V5', stroke: 'var(--ink)', 'stroke-width': 1 }, g);
  if (nearest && nearest.d > 0) {
    const x = nearest.c.dx * sc, y = -nearest.c.dy * sc;
    el('line', { x1: 0, y1: 0, x2: x, y2: y, stroke: 'var(--ink)' }, g);
    el('circle', { cx: x, cy: y, r: cell, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.5 }, g);
    // share of 30 m landing offsets that stay GO: arc from N, clockwise
    const kept = sens[`${nearest.c.dx},${nearest.c.dy}`];
    if (kept != null) {
      const r = cell * 1.5 + 4, a = kept * 2 * Math.PI;
      el('circle', { cx: x, cy: y, r, fill: 'none', stroke: 'var(--block)', 'stroke-width': 2.5 }, g);
      if (kept >= 0.999) el('circle', { cx: x, cy: y, r, fill: 'none', stroke: 'var(--move)', 'stroke-width': 2.5 }, g);
      else if (kept > 0) el('path', { d: `M${x},${y - r}A${r},${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x + r * Math.sin(a)},${y - r * Math.cos(a)}`, fill: 'none', stroke: 'var(--move)', 'stroke-width': 2.5 }, g);
    }
  }
  text(g, `${3} ${t('unitKm')}`, { x: 84, y: 80, 'text-anchor': 'end', class: 'tick' });
  svg.onpointermove = ev => {
    const i = ev.target.dataset.i;
    if (i == null) return hideTip();
    const c = grid[i];
    const ew = c.dx >= 0 ? t('rightKm', Math.abs(c.dx)) : t('leftKm', Math.abs(c.dx));
    const ns = c.dy >= 0 ? t('towardKm', Math.abs(c.dy)) : t('awayKm', Math.abs(c.dy));
    const kept = nearest && c === nearest.c ? sens[`${c.dx},${c.dy}`] : null;
    showTip(t('cellTip', ns, ew, c.slope) + (kept != null ? ' · ' + t('offsets', kept) : ''), ev);
  };
  svg.onpointerleave = hideTip;
}

function drawMast(svg, st, e, lim, data) {
  clear(svg);
  // basic mode: the practical rungs only (up to 20 m)
  const HS = MAST_HEIGHTS.filter(h => st.pro || h <= 20);
  const base = 150, top = 12, lx = 40, n = HS.length;
  const Y = i => base - (i + 1) / n * (base - top);   // rungs evenly spaced
  el('line', { x1: lx, x2: lx, y1: base, y2: Y(n - 1), stroke: 'var(--muted)', 'stroke-width': 1.5 }, svg);
  el('rect', { x: lx - 10, y: base, width: 20, height: 10, fill: 'var(--muted)' }, svg);
  const lowest = HS.find(h => e.mastOk[h][st.day] && h <= lim.mast);
  const rec = data.index.optimal[st.site];
  const best = rec == null ? null : HS.reduce((a, h) => Math.abs(h - rec) < Math.abs(a - rec) ? h : a);
  HS.forEach((h, i) => {
    const y = Y(i), ok = e.mastOk[h][st.day], off = h > lim.mast;
    const g = el('g', { opacity: off ? .3 : 1, style: off ? '' : 'cursor:pointer' }, svg);
    el('circle', { cx: lx, cy: y, r: 4, fill: ok ? 'var(--mast)' : 'var(--surface)', stroke: 'var(--mast)', 'stroke-width': 1.5 }, g);
    if (h === lowest) el('circle', { cx: lx, cy: y, r: 7, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1 }, g);
    if (h === st.mast) el('circle', { cx: lx, cy: y, r: 9.5, fill: 'none', stroke: 'var(--mast)', 'stroke-width': 2 }, g);
    if (h === best) el('path', { d: `M${lx - 24},${y - 4}L${lx - 16},${y}L${lx - 24},${y + 4}Z`, fill: 'var(--ink)' }, g);
    text(g, h, { x: lx + 16, y: y + 3.5, class: 'tick' });
    const hit = el('rect', { x: 0, y: y - 7, width: 100, height: 14, fill: 'transparent' }, g);
    if (!off) hit.addEventListener('click', () => setState({ mast: st.mast === h ? 0 : h }));
  });
}

function drawWait(svg, st, e) {
  // 60 days as a spiral that turns once per lunar day (29.5 d): the Sun circles the pole once per turn,
  // so good and bad stretches line up between turns
  clear(svg);
  svg.removeAttribute('style');
  svg.setAttribute('viewBox', '0 0 176 168');
  const cx = 88, cy = 84, SYN = 29.53, N = 60;
  const R = n => 36 + n * 0.75, A = n => (n / SYN) * 2 * Math.PI;
  const pt = (n, r = R(n)) => [cx + r * Math.sin(A(n)), cy - r * Math.cos(A(n))];
  let first = -1;
  for (let n = 0; n < N; n++) {
    const d = st.day + n, ok = d < 365 && e.ok[d];
    if (ok && first < 0) first = n;
    const [x0, y0] = pt(n + 0.06, R(n + 0.5)), [x1, y1] = pt(n + 0.94, R(n + 0.5));
    const seg = el('path', { d: `M${x0},${y0}A${R(n + 0.5)},${R(n + 0.5)} 0 0 1 ${x1},${y1}`, fill: 'none', stroke: ok ? 'var(--wait)' : 'var(--none)', 'stroke-width': 9, style: 'cursor:pointer' }, svg);
    seg.addEventListener('pointermove', ev => showTip(t('dayN', n, shortDate(Math.min(d, 364))), ev));
    seg.addEventListener('pointerleave', hideTip);
    seg.addEventListener('click', () => { if (d <= 364) setState({ day: d }); });
  }
  // today: a tick at the start of the spiral
  const [tx0, ty0] = pt(0, R(0) - 7), [tx1, ty1] = pt(0, R(0) + 7);
  el('line', { x1: tx0, y1: ty0, x2: tx1, y2: ty1, stroke: 'var(--ink)', 'stroke-width': 2 }, svg);
  // first good day: the same ring as on the MOVE grid and the MAST ladder
  if (first > 0) {
    const [fx, fy] = pt(first + 0.5, R(first + 0.5));
    el('circle', { cx: fx, cy: fy, r: 7, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.5, 'pointer-events': 'none' }, svg);
  }
}
