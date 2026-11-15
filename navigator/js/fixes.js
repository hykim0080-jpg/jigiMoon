// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { state, setState, limitsOf } from './state.js';
import { t, siteName } from './strings.js';
import { el, text, clear, bar, showTip, hideTip } from './svg.js';
import { fixes, bestFix, shortDate, nearestOk } from './logic.js';
import { movePhrase, sector, bearing } from './orient.js';
const ARROW = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];   // up = toward Earth, as on the map
import { failStats, failReason } from './failreason.js';

const KINDS = ['move', 'mast', 'wait'];
let root, cards = {}, why, mrow, fxbar, mapOpen = true;   // the panel is the map now: always open

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
  // MOVE as a line too, so the values read in one row while the map is folded
  mrow = document.createElement('div'); mrow.className = 'fixrow'; mrow.dataset.k = 'move'; mrow.style.setProperty('--fc', 'var(--move)');
  mrow.innerHTML = `<h2>${t('move')}</h2><div class="val"><b></b><span></span><i class="mdir"></i></div>`;
  rows.appendChild(mrow);
  for (const k of ['mast', 'wait']) {
    const r = document.createElement('div');
    r.className = 'fixrow'; r.dataset.k = k; r.style.setProperty('--fc', `var(--${k})`);
    r.innerHTML = `<h2>${t(k)}</h2><div class="val"><b></b><span></span></div><div class="effort"></div>`;
    rows.appendChild(r);
    cards[k] = { c: r, val: r.querySelector('b'), unit: r.querySelector('.val span'), effort: r.querySelector('.effort') };
  }
  // MAST line: click to raise the antenna to the lowest height that works (click again to lower it)
  // MAST: the height only, no switch (the verdict stays on the ground); over 10 m in orange
  rows.hidden = true;   // the MOVE / MAST / WAIT line lives under the verdict; kept here only for the values below
  root.appendChild(rows);
  // the map below is folded by default. Esc on the 2D centre map (⤢ 2D in the view buttons): back to 3D
  fxbar = document.createElement('div'); fxbar.className = 'fxbar';
  fxbar.innerHTML = `<button type="button" class="fxmap" aria-expanded="false">${t('fxMap')}</button>`;
  fxbar.querySelector('.fxmap').addEventListener('click', () => { mapOpen = !mapOpen; render(state, lastData); dispatchEvent(new Event('resize')); });
  addEventListener('keydown', ev => {
    if (ev.key !== 'Escape' || state.view !== 'focus' || state.d3 || innerWidth <= 700) return;
    if (document.querySelector('#mast-pop:not([hidden]),#when-pop:not([hidden]),#cal-panel.big')) return;
    ev.stopImmediatePropagation(); setState({ d3: 1 });
  }, true);
  fxbar.hidden = true;
  root.appendChild(fxbar);
  const l = document.createElement('div'); l.className = 'card local';
  l.innerHTML = `<svg viewBox="0 0 ${VB} ${VB}" preserveAspectRatio="xMidYMin meet"></svg><div class="seg lmsw"><button data-lm="line">${t('baseLine')}</button><button data-lm="relief">${t('baseShade')}</button></div><div class="seg lzsw"><button data-lz="region">${t('zoomRegion')}</button><button data-lz="site">${t('zoomSite')}</button><button data-lz="spot">${t('zoomSpot')}</button></div>`;
  l.querySelector('.lmsw').addEventListener('click', ev => { const b = ev.target.closest('[data-lm]'); if (b) setState({ lmap: b.dataset.lm }); });
  l.querySelector('.lzsw').addEventListener('click', ev => { const b = ev.target.closest('[data-lz]'); if (b) setState({ lzoom: b.dataset.lz }); });
  root.appendChild(l);
  c.classList.add('inset'); l.appendChild(c);   // MOVE sits in a corner of the line map, like the globe on the left map
  loc = l.querySelector('svg');
}

const UNIT = { move: 'unitKm', mast: 'unitM', wait: 'unitD' };

// where the zoom connector from the main map lands: the spot on the whole map, or the 3 km circle up close
let conn = { cx: VB / 2, cy: VB / 2, r: 3 / R_LOC * VB / 2 };
export function gridCenter() {
  const r = loc.getBoundingClientRect(), k = Math.min(r.width, r.height) / VB, ox = r.left + (r.width - VB * k) / 2, oy = r.top;   // map at the top (xMidYMin)
  return { x: ox + conn.cx * k, y: oy + conn.cy * k, r: conn.r * k };
}

let lastData = null;
export function render(st, data) {
  if (!data) return;
  lastData = data;
  const e = data.index.modes[st.mission].sites[st.site], lim = limitsOf(st);
  loc.parentNode.hidden = !mapOpen;
  const mb = fxbar.querySelector('.fxmap');
  mb.setAttribute('aria-expanded', String(mapOpen)); mb.textContent = (mapOpen ? '▾ ' : '▸ ') + t('fxMap');
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
  cards.mast.c.classList.toggle('tall', !e.ok[st.day] && f.mast != null && f.mast > 10 && f.mast <= lim.mast);
  const near = data.site && f.move != null && !e.ok[st.day] ? nearestOk(data.site, st.day) : null;
  const go = near && near.d > 0 && f.move <= lim.move;
  cards.move.dir.textContent = go ? ARROW[sector(bearing(near.c.dx, near.c.dy))] : '';
  { const v = e.ok[st.day] ? 0 : f.move, avail = v != null && v <= lim.move;
    mrow.classList.toggle('best', !!best && best.kind === 'move'); mrow.classList.toggle('na', !avail);
    mrow.querySelector('b').textContent = avail ? v : '—'; mrow.querySelector('.val span').textContent = avail ? t('unitKm') : '';
    mrow.querySelector('.mdir').textContent = go ? ' ' + ARROW[sector(bearing(near.c.dx, near.c.dy))] : ''; }
  cards.move.dir.title = go ? movePhrase(near.c.dx, near.c.dy) : '';
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

const HALF = { region: 200, site: 50, spot: R_LOC }, SCALE = { region: 50, site: 10, spot: 1 };
function drawLocal(svg, st, data, e, near) {
  clear(svg);
  const relief = st.lmap === 'relief', zk = relief && HALF[st.lzoom] ? st.lzoom : 'region';
  const box = loc.parentNode;
  box.querySelectorAll('[data-lm]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lm === (relief ? 'relief' : 'line'))));
  box.querySelectorAll('[data-lz]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lz === zk)));
  box.querySelector('.lzsw').hidden = !relief;
  const s = data.index.byId[st.site], sx = s.x_m / 1000, sy = s.y_m / 1000, R = HALF[zk];
  // view window (km): the whole pole, or centred on the spot
  const x0 = zk === 'region' ? 0 : sx, y0 = zk === 'region' ? 0 : sy, k = VB / (2 * R);
  const themeDark = document.documentElement.dataset.theme === 'dark';
  const X = x => (x - (x0 - R)) * k, Y = y => ((y0 + R) - y) * k, dark = relief || themeDark;
  el('rect', { x: 0, y: 0, width: VB, height: VB, fill: dark ? '#222' : '#fff' }, svg);
  if (!relief) {   // contour lines; gamma 2.5 darkens the thin lines and keeps the white paper white
    const f = el('filter', { id: 'lmdark' }, el('defs', {}, svg)), ct = el('feComponentTransfer', {}, f);
    for (const ch of ['R', 'G', 'B']) el('feFunc' + ch, { type: 'gamma', amplitude: 1, exponent: 2.5, offset: 0 }, ct);
    if (themeDark) {   // dark theme: dark paper, light lines
      const iv = el('feComponentTransfer', {}, f);
      for (const ch of ['R', 'G', 'B']) el('feFunc' + ch, { type: 'linear', slope: -0.72, intercept: 0.8 }, iv);
    }
    el('image', { href: 'data/linemap_4000.webp', x: X(-200), y: Y(200), width: 400 * k, height: 400 * k, preserveAspectRatio: 'none', filter: 'url(#lmdark)' }, svg);
  } else {
    el('image', { href: zk === 'region' ? 'data/hillshade_2800.jpg' : 'data/hillshade_4000.jpg', x: X(-200), y: Y(200), width: 400 * k, height: 400 * k, preserveAspectRatio: 'none' }, svg);
    if (zk === 'spot') {   // 20 m relief tiles (data/t20, 5 km each)
      const T = 5, c0 = Math.floor((x0 - R + 200) / T), c1 = Math.floor((x0 + R + 200) / T), r0 = Math.floor((200 - (y0 + R)) / T), r1 = Math.floor((200 - (y0 - R)) / T);
      for (let r = Math.max(0, r0); r <= Math.min(79, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(79, c1); c++) {
        const im = el('image', { href: `data/t20/${c}_${r}.jpg`, x: X(-200 + c * T) - .5, y: Y(200 - r * T) - .5, width: T * k + 1, height: T * k + 1, preserveAspectRatio: 'none' }, svg);
        im.addEventListener('error', () => im.remove());
      }
    }
  }
  const cx = X(sx), cy = Y(sy), ok = e.ok[st.day], lc = dark ? 'locl dk' : 'locl';
  if (zk === 'spot') {
    const g = el('g', { transform: `translate(${cx},${cy})` }, svg);
    el('circle', { cx: 0, cy: 0, r: 3 * k, fill: 'none', stroke: '#fff', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, g);
    text(g, t('km', 3), { x: 3 * k * .72 + 4, y: 3 * k * .72 + 4, class: 'locl dk' });
    if (near) {   // arrow to the nearest GO cell of the MOVE grid
      const x = near.c.dx * k, y = -near.c.dy * k, L = Math.hypot(x, y), ux = x / L, uy = y / L, tx = x - ux * 8, ty = y - uy * 8;
      el('line', { x1: ux * 9, y1: uy * 9, x2: tx, y2: ty, stroke: 'var(--move)', 'stroke-width': 3 }, g);
      el('path', { d: `M${x},${y}L${tx - uy * 6},${ty + ux * 6}L${tx + uy * 6},${ty - ux * 6}Z`, fill: 'var(--move)' }, g);
      text(g, t('km', Math.round(near.d * 10) / 10), { x: x / 2 + (uy <= 0 ? 8 : -8) * (ux >= 0 ? 1 : -1), y: y / 2 - 6, 'text-anchor': ux >= 0 ? 'start' : 'end', class: 'locl dk' });
    }
    el('circle', { cx: 0, cy: 0, r: 6, fill: ok ? 'var(--ok)' : 'var(--block)', stroke: '#fff', 'stroke-width': 2 }, g);
    conn = { cx, cy, r: 3 * k };
  } else {
    for (const o of data.index.sites) if (o.id !== st.site && o.x_m != null) {
      const ox = X(o.x_m / 1000), oy = Y(o.y_m / 1000); if (ox < -5 || oy < -5 || ox > VB + 5 || oy > VB + 5) continue;
      el('circle', { cx: ox, cy: oy, r: 2.5, fill: '#fff', stroke: 'var(--ink)', 'stroke-width': 1 }, svg);
    }
    el('circle', { cx, cy, r: 9, fill: 'none', stroke: dark ? '#fff' : 'var(--move)', 'stroke-width': 1.5 }, svg);
    el('circle', { cx, cy, r: 4.5, fill: ok ? 'var(--ok)' : 'var(--block)', stroke: '#fff', 'stroke-width': 1.5 }, svg);
    const right = cx < VB - 120;
    text(svg, siteName(s), { x: cx + (right ? 13 : -13), y: cy + 4, 'text-anchor': right ? 'start' : 'end', class: dark ? 'locl dk' : 'locl lname' });
    conn = { cx, cy, r: 9 };
  }
  text(svg, '↑ ' + t('earthUp'), { x: 8, y: 18, class: lc, ...(dark ? {} : { fill: 'var(--earth)' }) });
  const km = SCALE[zk] * k;
  el('path', { d: `M${VB - 10 - km},${VB - 34}v4h${km}v-4`, fill: 'none', stroke: dark ? '#fff' : 'var(--ink)', 'stroke-width': 1.5 }, svg);
  text(svg, t('km', SCALE[zk]), { x: VB - 10 - km / 2, y: VB - 38, 'text-anchor': 'middle', class: dark ? 'tick dk' : 'tick' });
}
