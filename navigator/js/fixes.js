import { state, setState, limitsOf } from './state.js';
import { t, siteName } from './strings.js';
import { el, text, clear, bar, showTip, hideTip } from './svg.js';
import { fixes, bestFix, shortDate, nearestOk } from './logic.js';
import { movePhrase } from './orient.js';
import { failStats, failReason } from './failreason.js';

const KINDS = ['move', 'mast', 'wait'];
let root, cards = {}, why;

// MAST and WAIT: one thin strip; below it the local line map of the spot (+-3.5 km), as big as the main map:
// the spot, the arrow to the nearest GO cell and the 3 km circle. MOVE (3 km grid) is an inset in its corner.
const R_LOC = 3.5, VB = 360;
let loc;
export function init(node) {
  root = node;
  why = document.createElement('div'); why.id = 'why'; why.hidden = true; root.appendChild(why);
  const c = document.createElement('div');
  c.className = 'card'; c.style.setProperty('--fc', 'var(--move)');
  c.innerHTML = `<div class="left"><h2>${t('move')}</h2><div class="val"><b></b><span></span></div><div class="dir"></div><div class="effort"></div></div><div class="vis"><svg viewBox="0 0 176 168"></svg></div>`;
  cards.move = { c, val: c.querySelector('b'), dir: c.querySelector('.dir'), unit: c.querySelector('.val span'), effort: c.querySelector('.effort'), svg: c.querySelector('svg') };
  const rows = document.createElement('div'); rows.className = 'fixrows';
  for (const k of ['mast', 'wait']) {
    const r = document.createElement('div');
    r.className = 'fixrow'; r.dataset.k = k; r.style.setProperty('--fc', `var(--${k})`);
    r.innerHTML = `<h2>${t(k)}</h2><div class="val"><b></b><span></span></div><div class="effort"></div>`;
    rows.appendChild(r);
    cards[k] = { c: r, val: r.querySelector('b'), unit: r.querySelector('.val span'), effort: r.querySelector('.effort') };
  }
  // MAST line: click to raise the antenna to the lowest height that works (click again to lower it)
  cards.mast.c.addEventListener('click', () => { const h = cards.mast.c.dataset.h; if (h) setState({ mast: state.mast === +h ? 0 : +h }); });
  root.appendChild(rows);
  const l = document.createElement('div'); l.className = 'card local';
  l.innerHTML = `<svg viewBox="0 0 ${VB} ${VB}"></svg><div class="seg lmsw"><button data-lm="line">${t('baseLine')}</button><button data-lm="relief">${t('baseShade')}</button></div>`;
  l.querySelector('.lmsw').addEventListener('click', ev => { const b = ev.target.closest('[data-lm]'); if (b) setState({ lmap: b.dataset.lm }); });
  root.appendChild(l);
  c.classList.add('inset'); l.appendChild(c);   // MOVE sits in a corner of the line map, like the globe on the left map
  loc = l.querySelector('svg');
}

const UNIT = { move: 'unitKm', mast: 'unitM', wait: 'unitD' };

// where the zoom connector from the main map lands: the spot on the whole map, or the 3 km circle up close
let conn = { cx: VB / 2, cy: VB / 2, r: 3 / R_LOC * VB / 2 };
export function gridCenter() {
  const r = loc.getBoundingClientRect(), k = Math.min(r.width, r.height) / VB, ox = r.left + (r.width - VB * k) / 2, oy = r.top + (r.height - VB * k) / 2;
  return { x: ox + conn.cx * k, y: oy + conn.cy * k, r: conn.r * k };
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
  cards.mast.c.dataset.h = !e.ok[st.day] && f.mast != null && f.mast <= lim.mast ? f.mast : '';
  cards.mast.c.classList.toggle('on', !!st.mast);
  const near = data.site && f.move != null && !e.ok[st.day] ? nearestOk(data.site, st.day) : null;
  cards.move.dir.textContent = near && near.d > 0 && f.move <= lim.move ? movePhrase(near.c.dx, near.c.dy) : '';
  if (!data.site) return;
  // no fix within the limits: say why in one sentence, above the fixes
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
  drawLocal(loc, st, data, e, near && near.d > 0 && f.move <= lim.move ? near : null);
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

function drawLocal(svg, st, data, e, near) {
  clear(svg);
  loc.parentNode.querySelectorAll('[data-lm]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lm === (st.lmap || 'line'))));
  const s = data.index.byId[st.site], x0 = s.x_m / 1000, y0 = s.y_m / 1000;
  if (st.lmap !== 'relief') {   // the whole pole as contour lines (+-200 km), Earth up; the spot and the other sites on it
    const k = VB / 400, X = x => (x + 200) * k, Y = y => (200 - y) * k;
    el('rect', { x: 0, y: 0, width: VB, height: VB, fill: '#fff' }, svg);
    // darken the thin lines (gamma 2.5 keeps the white paper white) so the whole map reads at this size
    const f = el('filter', { id: 'lmdark' }, el('defs', {}, svg)), ct = el('feComponentTransfer', {}, f);
    for (const ch of ['R', 'G', 'B']) el('feFunc' + ch, { type: 'gamma', amplitude: 1, exponent: 2.5, offset: 0 }, ct);
    el('image', { href: 'data/linemap_4000.webp', x: 0, y: 0, width: VB, height: VB, preserveAspectRatio: 'none', filter: 'url(#lmdark)' }, svg);
    for (const o of data.index.sites) if (o.id !== st.site && o.x_m != null) el('circle', { cx: X(o.x_m / 1000), cy: Y(o.y_m / 1000), r: 2.5, fill: '#fff', stroke: 'var(--ink)', 'stroke-width': 1 }, svg);
    const cx = X(x0), cy = Y(y0);
    el('circle', { cx, cy, r: 9, fill: 'none', stroke: 'var(--move)', 'stroke-width': 1.5 }, svg);
    el('circle', { cx, cy, r: 4.5, fill: e.ok[st.day] ? 'var(--ok)' : 'var(--block)', stroke: '#fff', 'stroke-width': 1.5 }, svg);
    const right = cx < VB - 120;
    text(svg, siteName(s), { x: cx + (right ? 13 : -13), y: cy + 4, 'text-anchor': right ? 'start' : 'end', class: 'locl lname' });
    text(svg, '↑ ' + t('earthUp'), { x: 8, y: 18, class: 'locl', fill: 'var(--earth)' });
    const km = 50 * k;
    el('path', { d: `M${VB - 10 - km},${VB - 34}v4h${km}v-4`, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.5 }, svg);
    text(svg, t('km', 50), { x: VB - 10 - km / 2, y: VB - 38, 'text-anchor': 'middle', class: 'tick' });
    conn = { cx, cy, r: 9 };
    return;
  }
  // the spot up close (+-3.5 km) on 20 m relief tiles (data/t20, 5 km each), over the 100 m relief
  const k = VB / (2 * R_LOC), C = VB / 2;
  el('rect', { x: 0, y: 0, width: VB, height: VB, fill: '#222' }, svg);
  el('image', { href: 'data/hillshade_4000.jpg', x: (-200 - (x0 - R_LOC)) * k, y: ((y0 + R_LOC) - 200) * k, width: 400 * k, height: 400 * k, preserveAspectRatio: 'none' }, svg);
  const T = 5, c0 = Math.floor((x0 - R_LOC + 200) / T), c1 = Math.floor((x0 + R_LOC + 200) / T), r0 = Math.floor((200 - (y0 + R_LOC)) / T), r1 = Math.floor((200 - (y0 - R_LOC)) / T);
  for (let r = Math.max(0, r0); r <= Math.min(79, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(79, c1); c++) {
    const im = el('image', { href: `data/t20/${c}_${r}.jpg`, x: (-200 + c * T - (x0 - R_LOC)) * k - .5, y: ((y0 + R_LOC) - (200 - r * T)) * k - .5, width: T * k + 1, height: T * k + 1, preserveAspectRatio: 'none' }, svg);
    im.addEventListener('error', () => im.remove());
  }
  const g = el('g', { transform: `translate(${C},${C})` }, svg);
  el('circle', { cx: 0, cy: 0, r: 3 * k, fill: 'none', stroke: '#fff', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, g);
  text(g, t('km', 3), { x: 3 * k * .72 + 4, y: 3 * k * .72 + 4, class: 'locl dk' });
  if (near) {   // arrow to the nearest GO cell of the MOVE grid
    const x = near.c.dx * k, y = -near.c.dy * k, L = Math.hypot(x, y), ux = x / L, uy = y / L, tx = x - ux * 8, ty = y - uy * 8;
    el('line', { x1: ux * 9, y1: uy * 9, x2: tx, y2: ty, stroke: 'var(--move)', 'stroke-width': 3 }, g);
    el('path', { d: `M${x},${y}L${tx - uy * 6},${ty + ux * 6}L${tx + uy * 6},${ty - ux * 6}Z`, fill: 'var(--move)' }, g);
    text(g, t('km', Math.round(near.d * 10) / 10), { x: x / 2 + (uy <= 0 ? 8 : -8) * (ux >= 0 ? 1 : -1), y: y / 2 - 6, 'text-anchor': ux >= 0 ? 'start' : 'end', class: 'locl dk' });
  }
  el('circle', { cx: 0, cy: 0, r: 6, fill: e.ok[st.day] ? 'var(--ok)' : 'var(--block)', stroke: '#fff', 'stroke-width': 2 }, g);
  text(svg, '↑ ' + t('earthUp'), { x: 8, y: 18, class: 'locl dk' });
  el('path', { d: `M${VB - 10 - k},${VB - 34}v4h${k}v-4`, fill: 'none', stroke: '#fff', 'stroke-width': 1.5 }, svg);
  text(svg, t('km', 1), { x: VB - 10 - k / 2, y: VB - 38, 'text-anchor': 'middle', class: 'tick dk' });
  conn = { cx: C, cy: C, r: 3 * k };
}
