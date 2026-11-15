// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { N, PX, HALF, GRATICULE_LATS, SCORE_RAMP } from './config.js';
import { state, setState } from './state.js';
import { latRadius, cellToLatLon, cellToXY } from './geo.js';
import { sample, scoreColor, failCount, score100, critIds, hatchList } from './compose.js';
import { layerColor } from './ramps.js';
import { hue } from './config.js';
import { t, layerName, unitOf, lang } from './strings.js';
import { fmt } from './data.js';
import { rampCss } from './ramps.js';
import { SIMPLE, ZONE } from './config.js';
import { shadowCanvas, initTime, expoTop, skyGet } from './time.js';
import { pinInfo } from './pin.js';
import { useWin } from './window.js';
import { sightSvg } from './sightlines.js';
import { getZones, hotZoneId, paint, brushCells, saveOverride } from './zones.js';
import { haloCanvas, baseInfo } from './compose.js';
import { describe, lmName, drawableLanders, landerPath, landerLabel } from './orient.js';

let pickFn = null, legend, bd, panel, canvas, ctx, svg, comp, data, badge, homeBtn, tip, W = 800, H = 800, dpr = 1, anim = 0;
// the map fills a W x H box: k = 1 fits the whole pole in the shorter side; the longer side shows more around it
const M = () => Math.min(W, H);
const clampAx = (c, half) => half * 2 >= N ? N / 2 : Math.max(half, Math.min(N - half, c));
const clampView = v => { const s = M() * v.k / N; return { k: v.k, cx: clampAx(v.cx, W / s / 2), cy: clampAx(v.cy, H / s / 2) }; };
const scale = () => M() * state.view.k / N;
const vis = () => { const s = scale(); return { vw: W / s, vh: H / s }; };   // visible cells across and down
const toScr = (cf, rf) => { const { cx, cy } = state.view, s = scale(), { vw, vh } = vis(); return [(cf - (cx - vw / 2)) * s, (rf - (cy - vh / 2)) * s]; };
// draw the visible part of an N-cell image (any resolution) onto a W x H canvas, clipped to the map
function blitImg(g, img, dw, dh) {
  const { cx, cy } = state.view, { vw, vh } = vis(), f = (img.naturalWidth || img.width) / N, x0 = cx - vw / 2, y0 = cy - vh / 2;
  const sx = Math.max(0, x0), sy = Math.max(0, y0), ex = Math.min(N, x0 + vw), ey = Math.min(N, y0 + vh); if (ex <= sx || ey <= sy) return;
  const kx = dw / vw, ky = dh / vh;
  g.drawImage(img, sx * f, sy * f, (ex - sx) * f, (ey - sy) * f, (sx - x0) * kx, (sy - y0) * ky, (ex - sx) * kx, (ey - sy) * ky);
}
const mToCf = (x, y) => [(x + HALF) / PX, (HALF - y) / PX];
let holdTimer = 0, ring = null;
function holdRing(pt) {
  if (!pt) { if (ring) { ring.remove(); ring = null; } return; }
  if (ring) ring.remove();
  ring = Object.assign(document.createElement('div'), { className: 'lyr-hold' });
  ring.style.left = pt[0] + 'px'; ring.style.top = pt[1] + 'px'; panel.append(ring);
}
export function cellFromEvent(e) {
  const r = canvas.getBoundingClientRect(), { cx, cy } = state.view, s = scale(), { vw, vh } = vis();
  const col = Math.floor(cx - vw / 2 + (e.clientX - r.left) / s), row = Math.floor(cy - vh / 2 + (e.clientY - r.top) / s);
  return col >= 0 && row >= 0 && col < N && row < N ? { col, row } : null;
}
export const setPick = fn => { pickFn = fn; };
let badgeSrc = null; export const setBadges = fn => { badgeSrc = fn; };
const tripBadges = () => !!badgeSrc && !state.adv;
export function initMap(el, d, compCanvas) {
  panel = el; data = d; comp = compCanvas;
  canvas = Object.assign(document.createElement('canvas'), { className: 'lyr-raster' });
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'lyr-vec');
  badge = Object.assign(document.createElement('div'), { className: 'lyr-badge n' });
  badge.innerHTML = `<span class="bt"></span><span class="bs" hidden><span class="co"></span><span>0</span><span class="lyr-sr" style="background:${rampCss({ id: 'score' })}"><u></u><i></i><b></b></span><span>100</span></span>`;
  bd = { t: badge.querySelector('.bt'), s: badge.querySelector('.bs'), co: badge.querySelector('.co'), sr: badge.querySelector('.lyr-sr') };
  bd.rd = bd.sr.querySelector('i'); bd.hd = bd.sr.querySelector('b'); bd.cv = bd.sr.querySelector('u');
  const setCut = e => { const b = bd.sr.getBoundingClientRect(), v = Math.max(0, Math.min(100, Math.round(100 * (e.clientX - b.left) / b.width))); if (v !== state.cutoff) setState({ cutoff: v }, 'zones'); };
  bd.sr.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); bd.sr.setPointerCapture(e.pointerId); setCut(e); bd.sr.onpointermove = setCut; };
  bd.sr.onpointerup = () => { bd.sr.onpointermove = null; };
  bd.sr.ondblclick = e => { e.stopPropagation(); setState({ cutoff: 70 }, 'zones'); };
  legend = Object.assign(document.createElement('div'), { className: 'lyr-legend n' }); legend.innerHTML = '<span class="l1"><i></i><span class="lt"></span></span><em class="lbr"><span class="bt"></span><b>0</b><u></u><b class="hi"></b></em><em class="lhl"></em>';
  homeBtn = Object.assign(document.createElement('button'), { className: 'lyr-home', textContent: t('home'), hidden: true });
  homeBtn.onclick = e => { e.stopPropagation(); reset(); };
  homeBtn.onpointerdown = homeBtn.ondblclick = e => e.stopPropagation();
  const bm = Object.assign(document.createElement('div'), { className: 'seg lyr-basem' });
  bm.innerHTML = `<button data-b="line">${t('b_line')}</button><button data-b="shade">${t('b_shade')}</button>`;
  bm.onclick = e => { e.stopPropagation(); const b = e.target.closest('[data-b]'); if (b) setState({ basemap: b.dataset.b }, 'pixels'); };
  bm.onpointerdown = bm.ondblclick = e => e.stopPropagation();
  panel.append(canvas, svg, legend, badge, homeBtn, bm); initTime(panel, data);
  ctx = canvas.getContext('2d');
  tip = document.getElementById('tip') || Object.assign(document.createElement('div'), { id: 'tip', hidden: true });
  if (!tip.parentNode) document.body.append(tip);
  wire(); resize();
}
export function resize() {
  W = panel.clientWidth; H = panel.clientHeight || W; dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  setState({ view: clampView(state.view) }, 'view');
}
// sharper terrain: 100 m/px LOLA hillshade (shared with Compare). Once it loads, the composite is built on a flat
// white base and this shade multiplies it (base pixels come out as the hillshade itself; colours keep the terrain).
// base map, multiplied over the composite (built on a flat white base): the contour line map (default in Find a site)
// or the 100 m/px LOLA hillshade (shared with Compare). Each loads on first use.
let shade = null;
const BASES = { line: '../data/linemap_4000.webp', shade: '../data/hillshade_4000.jpg' }, baseImg = {};
function baseFor(id) {
  if (baseImg[id]) return baseImg[id].complete && baseImg[id].naturalWidth ? baseImg[id] : null;
  const im = baseImg[id] = new Image();
  im.onload = () => { if (data && data.hill) data.hill.fill(255); setState({}, 'pixels'); };
  im.src = BASES[id]; return null;
}
export function blit() {
  const { k, cx, cy } = state.view, w = N / k, cw = canvas.width, ch = canvas.height;
  ctx.imageSmoothingEnabled = (M() * dpr * k / N) < 1.5;
  ctx.fillStyle = getComputedStyle(panel).backgroundColor || '#111'; ctx.fillRect(0, 0, cw, ch);
  blitImg(ctx, comp, cw, ch);
  shade = baseFor(state.basemap === 'shade' ? 'shade' : 'line');
  if (shade) {
    const f = shade.naturalWidth / N;
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'multiply';
    blitImg(ctx, shade, cw, ch); ctx.restore();
  }
  if (state.mode === 'mask') drawHatch(k, cx, cy, w);
  if (!state.adv && state.mode === 'mask') {
    const ga = SIMPLE.haloA * Math.max(0, Math.min(1, (6 - k) / 4));
    if (ga > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = ga; blitImg(ctx, haloCanvas(), cw, ch); ctx.restore(); }
  }
  const sc = shadowCanvas(); if (sc) blitImg(ctx, sc, cw, ch);
  homeBtn.hidden = k <= 1.0001;
  panel.querySelectorAll('.lyr-basem button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.b === (state.basemap === 'shade' ? 'shade' : 'line'))));
}
// stacked layers: each criterion hatches where it fails, in its colour and its own direction
export const HATCH_DIR = { sun: '/', earth: '\\', dark: '-', slope: '|' };
const pats = {};
function hatchPattern(g, id) {
  const d = HATCH_DIR[hue(id)] || '/', col = layerColor(id, false), key = id + d + col + dpr;
  if (pats[key]) return pats[key];
  const s = Math.round(14 * dpr), c = document.createElement('canvas'); c.width = s; c.height = s;
  const q = c.getContext('2d'); q.strokeStyle = col; q.lineWidth = 1.3 * dpr; q.lineCap = 'square'; q.beginPath();
  if (d === '/') { q.moveTo(-1, s + 1); q.lineTo(s + 1, -1); q.moveTo(-1, 1); q.lineTo(1, -1); q.moveTo(s - 1, s + 1); q.lineTo(s + 1, s - 1); }
  else if (d === '\\') { q.moveTo(-1, -1); q.lineTo(s + 1, s + 1); q.moveTo(s - 1, -1); q.lineTo(s + 1, 1); q.moveTo(-1, s - 1); q.lineTo(1, s + 1); }
  else if (d === '-') { q.moveTo(0, s / 2); q.lineTo(s, s / 2); }
  else { q.moveTo(s / 2, 0); q.lineTo(s / 2, s); }
  q.stroke();
  return pats[key] = g.createPattern(c, 'repeat');
}
let hatchTmp = null;
function drawHatch(k, cx, cy, w) {
  const L = hatchList; if (!L.length) return;
  if (!hatchTmp) hatchTmp = document.createElement('canvas');
  if (hatchTmp.width !== canvas.width || hatchTmp.height !== canvas.height) { hatchTmp.width = canvas.width; hatchTmp.height = canvas.height; }
  const g = hatchTmp.getContext('2d'), fc = state.focusCrit, lineBase = state.basemap !== 'shade';
  for (const { id, canvas: m } of L) {
    if (!state.on.mask[id]) continue;
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, hatchTmp.width, hatchTmp.height);
    g.imageSmoothingEnabled = k < 3; blitImg(g, m, hatchTmp.width, hatchTmp.height);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = hatchPattern(g, id); g.fillRect(0, 0, hatchTmp.width, hatchTmp.height);
    ctx.save(); ctx.globalAlpha = fc ? (fc === id ? .95 : .1) : lineBase ? .5 : .65; ctx.drawImage(hatchTmp, 0, 0); ctx.restore();
  }
}
function reset() { fly({ k: 1, cx: N / 2, cy: N / 2 }); }
function fly(target) {
  cancelAnimationFrame(anim);
  const from = { ...state.view }, to = clampView(target), t0 = performance.now();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setState({ view: to }, 'view');
  const step = now => {
    const u = Math.min(1, (now - t0) / 250), e = u * (2 - u), k = from.k * Math.pow(to.k / from.k, e);
    setState({ view: clampView({ k, cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e }) }, 'view');
    if (u < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
export function flyTo(site, instant) {
  if (!site) return;
  let tg;
  if (site.box_m) {
    const [a, b] = mToCf(site.box_m[0], site.box_m[3]), [c, d] = mToCf(site.box_m[2], site.box_m[1]);
    tg = { k: Math.max(1, Math.min(16, N / (Math.max(c - a, d - b) * 1.4))), cx: (a + c) / 2, cy: (b + d) / 2 };
  } else { const [x, y] = mToCf(site.x_m, site.y_m); tg = { k: 8, cx: x, cy: y }; }
  if (instant) setState({ view: clampView(tg) }, 'view'); else fly(tg);
}
export function flyToCell(col, row, k, instant) {
  const tg = { k, cx: col + .5, cy: row + .5 };
  if (instant) setState({ view: clampView(tg) }, 'view'); else fly(tg);
}
export function flyToCells([c0, r0, c1, r1], maxK = 16) {
  const w = c1 - c0 + 1, h = r1 - r0 + 1;
  fly({ k: Math.max(1, Math.min(maxK, N / (Math.max(w, h) * 1.8 + 6))), cx: (c0 + c1 + 1) / 2, cy: (r0 + r1 + 1) / 2 });
}
function zoomAt(mx, my, f) {
  const { k, cx, cy } = state.view, s = scale(), { vw, vh } = vis();
  const cf = cx - vw / 2 + mx / s, rf = cy - vh / 2 + my / s, nk = Math.max(1, Math.min(16, k * f)), ns = M() * nk / N;
  setState({ view: clampView({ k: nk, cx: cf - mx / ns + W / ns / 2, cy: rf - my / ns + H / ns / 2 }) }, 'view');
}
function hitSite(mx, my) {
  let best = null, bd = 1e9;
  for (const s of data.sites) {
    const [sx, sy] = toScr(...mToCf(s.x_m, s.y_m)), d = Math.hypot(sx - mx, sy - my);
    if (d < 9 && d < bd) { best = s; bd = d; }
  }
  if (best) return best;
  let ba = 1e18;
  for (const s of data.sites) {
    if (!s.box_m) continue;
    const [x0, y0] = toScr(...mToCf(s.box_m[0], s.box_m[3])), [x1, y1] = toScr(...mToCf(s.box_m[2], s.box_m[1]));
    const inX = mx > x0 - 5 && mx < x1 + 5, inY = my > y0 - 5 && my < y1 + 5;
    const edge = inX && inY && (Math.abs(mx - x0) < 5 || Math.abs(mx - x1) < 5 || Math.abs(my - y0) < 5 || Math.abs(my - y1) < 5);
    if (edge && (x1 - x0) * (y1 - y0) < ba) { best = s; ba = (x1 - x0) * (y1 - y0); }
  }
  return best;
}
// numbered badges of zones 1..simpleTop: stem from the best pixel, flipped below when two would touch
function badges(s) {
  const out = [];
  for (const z of tripBadges() ? badgeSrc() : getZones().slice(0, ZONE.simpleTop)) {
    const [x, y] = toScr(z.col + .5, z.row + .5);
    if (x < -20 || y < -40 || x > W + 20 || y > H + 40) continue;
    const flip = out.some(b => Math.hypot(b.x - x, b.cy - (y - 21)) < 24) || (state.pin && state.pin.col === z.col && state.pin.row === z.row);
    out.push({ z, id: z.id, x, y, cy: flip ? y + 21 : y - 21, flip });
  }
  return out;
}
function hitBadge(mx, my) {
  let best = null, bd = 13;
  for (const b of badges()) { const d = Math.hypot(b.x - mx, b.cy - my); if (d < bd) { best = b; bd = d; } }
  return best ? best.z : null;
}
function hitRing(mx, my) {
  if (!state.expo) return null;
  let best = null, bd = 11;
  expoTop.forEach(p => { const [x, y] = toScr(p.q + .5, p.r + .5), d = Math.hypot(x - mx, y - my); if (d < bd) { best = p; bd = d; } });
  return best;
}
function hitLander(mx, my) {
  let best = null, bd = 9;
  for (const l of drawableLanders(data.landers)) { const [x, y] = toScr(...mToCf(l.x_m, l.y_m)), d = Math.hypot(x - mx, y - my); if (d < bd) { best = l; bd = d; } }
  return best;
}
const where = (x, y) => describe(x, y, data.landmarks);
function wire() {
  let drag = null, painting = null, badgeHot = null;
  const stroke = c => {
    const rc = brushCells(scale()), l = painting.last || c, n = Math.max(Math.abs(c.col - l.col), Math.abs(c.row - l.row), 1);
    for (let i = 1; i <= n; i++) paint(l.col + (c.col - l.col) * i / n, l.row + (c.row - l.row) * i / n, rc, painting.val);
    painting.last = c; setState({}, 'pixels');
  };
  panel.addEventListener('wheel', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.pow(1.2, e.deltaY < 0 ? 1 : -1)); }, { passive: false });
  panel.addEventListener('dblclick', e => { const r = canvas.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, 2); });
  panel.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (state.edit && !e.shiftKey) { const c = cellFromEvent(e); painting = { last: null, val: state.edit === 'add' ? 1 : -1 }; panel.setPointerCapture(e.pointerId); if (c) stroke(c); return; }
    drag = { x: e.clientX, y: e.clientY, v: { ...state.view }, moved: false, held: false }; cancelAnimationFrame(anim);
    panel.setPointerCapture(e.pointerId);
    // press and hold (as in Compare): zoom out x2 about the point after 500 ms, then every 400 ms down to the whole map
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, dg = drag;
    const out = () => {
      if (drag !== dg || state.view.k <= 1.001) { holdRing(null); return; }
      dg.held = true; zoomAt(mx, my, 0.5); dg.v = { ...state.view };
      if (state.view.k > 1.001) holdTimer = setTimeout(out, 400); else holdRing(null);
    };
    clearTimeout(holdTimer); holdRing(state.view.k > 1.001 ? [mx, my] : null); holdTimer = setTimeout(out, 500);
  });
  panel.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (painting) { const c = cellFromEvent(e); if (c) stroke(c); }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 3) { clearTimeout(holdTimer); holdRing(null); if (drag.held) return; drag.moved = true; panel.classList.add('grab'); }
      if (drag.held) return;
      if (drag.moved) { const s = M() * drag.v.k / N; setState({ view: clampView({ k: drag.v.k, cx: drag.v.cx - dx / s, cy: drag.v.cy - dy / s }) }, 'view'); }
    }
    const cell = cellFromEvent(e), hs = state.adv ? hitSite(mx, my) : null, hl = hitLander(mx, my), hb = hitBadge(mx, my);
    if ((hb ? hb.id : null) !== (badgeHot ?? null)) { badgeHot = hb ? hb.id : null; setState(tripBadges() ? { hoverTrip: badgeHot } : { hoverZone: badgeHot }, 'hover'); }
    const same = state.hover && cell && state.hover.col === cell.col && state.hover.row === cell.row;
    if (!same || (hs?.id ?? null) !== state.hoverSite || (hl?.id ?? null) !== state.hoverLander) setState({ hover: cell, hoverSite: hs ? hs.id : null, hoverLander: hl ? hl.id : null }, 'hover');
    showTip(e, cell);
  });
  panel.addEventListener('pointerup', e => {
    if (painting) { painting = null; saveOverride(state.ov); return; }
    clearTimeout(holdTimer); holdRing(null);
    if (!drag) return; const moved = drag.moved || drag.held; drag = null; panel.classList.remove('grab');
    if (moved) return;
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, hb = hitBadge(mx, my), hs = state.adv ? hitSite(mx, my) : null, cell = cellFromEvent(e);
    const hr = hitRing(mx, my);
    const hl = hitLander(mx, my);
    landerCard(hl, e);
    if (hl) { tip.hidden = true; return; }
    if (hb) { if (pickFn) pickFn(hb); }
    else if (hr) setState({ pin: { col: hr.q, row: hr.r }, autoPin: false }, 'panel');
    else if (hs) { setState({ site: hs.id }, 'site'); flyTo(hs); }
    else if (cell) setState({ pin: cell, autoPin: false }, 'panel');
  });
  // two fingers (phones): pinch zooms about the fingers, moving them pans
  let pinch = null;
  const mid = t => { const r = canvas.getBoundingClientRect(); return { x: (t[0].clientX + t[1].clientX) / 2 - r.left, y: (t[0].clientY + t[1].clientY) / 2 - r.top, d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1 }; };
  panel.addEventListener('touchstart', e => {
    if (e.touches.length !== 2) return;
    e.preventDefault(); drag = null; painting = null; panel.classList.remove('grab'); cancelAnimationFrame(anim); clearTimeout(holdTimer); holdRing(null);
    pinch = mid(e.touches);
  }, { passive: false });
  panel.addEventListener('touchmove', e => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const m = mid(e.touches), s = scale(), v = state.view;
    setState({ view: clampView({ k: v.k, cx: v.cx - (m.x - pinch.x) / s, cy: v.cy - (m.y - pinch.y) / s }) }, 'view');
    zoomAt(m.x, m.y, m.d / pinch.d); pinch = m;
  }, { passive: false });
  panel.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });
  panel.addEventListener('contextmenu', e => { if (drag) e.preventDefault(); });
  panel.addEventListener('pointerleave', () => { tip.hidden = true; if (!drag) setState({ hover: null, hoverSite: null, hoverLander: null }, 'hover'); });
}
function showTip(e, cell) {
  if (!cell) { tip.hidden = true; return; }
  const { lat, lon } = cellToLatLon(cell.col, cell.row), sm = sample(cell.col, cell.row), { x, y } = cellToXY(cell.col, cell.row), rel = where(x, y);
  tip.innerHTML = '';
  const add = (cls, txt, css) => tip.append(Object.assign(document.createElement('div'), { className: cls, textContent: txt, style: css || '' }));
  if (rel) add('tip-rel', rel);
  if (sm && state.mode === 'mask' && sm.nCrit && sm.fails != null) {
    if (sm.fails === 0) add('tip-sub', t('suitable'), `color:${SIMPLE.pass};font-weight:600`);
    else if (sm.failIds.length) add('tip-sub n', sm.failIds.map(id => { const m = data.layers.find(q => q.id === id); return `${layerName(m).split(' ')[0]} ${fmt(m, sm.values[id])}${unitOf(m)}`; }).join(' · '), 'color:var(--block)');
  }
  if (state.adv) {
    let txt = `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(1)}°${lon < 0 ? 'W' : 'E'}`;
    if (sm) { if (sm.fails != null) txt += ` · ${sm.nCrit - sm.fails}/${sm.nCrit}`; else if (sm.score != null) txt += ` · ${sm.score}`; }
    add('tip-sub n', txt);
  }
  tip.hidden = !tip.childNodes.length;
  tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 6) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
}
const thin = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export function renderBadge(passPx, readoutScore) {
  const sc = state.mode === 'score', km2 = thin(passPx * PX * PX / 1e6);
  legend.hidden = state.adv || state.mode !== 'mask';
  legend.querySelector('.lt').textContent = useWin(state) ? t('legStay', state.mission || 14, km2) : t('legYear', km2);   // the legend in words
  legend.querySelector('.bt').textContent = (t('legBase') || {})[state.base] || '';
  const ang = { sun: 135, earth: 45, dark: 0, slope: 90 }, hl = hatchList.filter(h => state.on.mask[h.id]);
  legend.querySelector('.lhl').innerHTML = hl.length ? `<span>${t('legHatch')}</span>` + hl.map(h => { const c = layerColor(h.id, true); return `<i style="background:repeating-linear-gradient(${ang[hue(h.id)] ?? 135}deg,${c} 0 1.6px,transparent 1.6px 4.5px);border-color:${c}"></i>${(t('legName') || {})[hue(h.id)] || ''}`; }).join('') : '';
  const bi = baseInfo(state); if (bi) { legend.querySelector('u').style.background = bi.css; legend.querySelector('.hi').textContent = bi.hi; }
  bd.s.hidden = !sc; bd.t.textContent = state.adv && state.mode === 'mask' && critIds(state).length + (state.month != null ? 1 : 0) ? km2 + ' km²' : '';
  if (sc) {
    const c = state.cutoff;
    bd.co.textContent = '≥' + c; bd.hd.style.left = c + '%'; bd.cv.style.width = c + '%';
    bd.rd.style.display = readoutScore == null ? 'none' : 'block'; bd.rd.style.left = readoutScore + '%';
  }
}
const SVGNS = 'http://www.w3.org/2000/svg';
const tw = (str, px) => [...str].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? px : px * .55), 0);
const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const lmBoxes = [];   // landmark label boxes of the last frame; spacecraft labels give way to them
function landmarkSvg(k, s) {
  const shown = data.landmarks.filter(L => L.always_show || L.tier === 1 || (L.tier === 2 && k >= 2) || (L.tier === 3 && k >= 4));
  shown.sort((a, b) => a.tier - b.tier);
  let g = '', t = '';
  const boxes = lmBoxes; boxes.length = 0;
  for (const L of shown) {
    const [x, y] = toScr(...mToCf(L.x_m, L.y_m)), r = (L.radius_km || 0) * 1000 / PX * s;
    if (x < -r - 80 || y < -r - 20 || x > W + r + 80 || y > H + r + 20) continue;
    const crater = L.kind === 'crater' && r > 0 && L.tier <= 2;
    if (crater) g += `<circle cx="${x}" cy="${y}" r="${r}" class="cr"/>`;
    const name = lmName(L), w = tw(name, 12), fs = L.tier === 1 ? 13 : 12;
    // crater: label centred inside if it fits, otherwise to the right of the rim; others: dot + label to the right
    const inside = crater && r * 2 > w + 8, lx = inside ? x - w / 2 : crater ? x + r + 4 : L.id === 'south-pole' ? x - 6 - w : x + 6, ly = inside ? y + 4 : crater ? y + 4 : y + 4;
    const bb = [lx - 2, ly - 12, lx + w + 2, ly + 4];
    if (L.tier > 1 && (boxes.some(b => overlaps(b, bb)) || bb[0] < 0 || bb[2] > W || bb[1] < 0 || bb[3] > H)) continue;
    boxes.push(bb);
    if (!crater) g += `<circle cx="${x}" cy="${y}" r="2" class="ld"/>`;
    t += `<text x="${lx}" y="${ly}" class="lm t${L.tier}">${name}</text>`;
  }
  return g + t;
}
function landerSvg(st) {
  let g = '', lab = '';
  const taken = [...lmBoxes];
  for (const l of drawableLanders(data.landers)) {
    const [x, y] = toScr(...mToCf(l.x_m, l.y_m));
    if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
    const cls = `ls ${l.kind === 'landed' || l.kind === 'planned' ? 'f' : 'x'}${l.verify || l.kind === 'planned' ? ' v' : ''}`;
    g += `<path transform="translate(${x} ${y})" d="${landerPath(l.kind)}" class="${cls}"/>`;
    const hov = st.hoverLander === l.id, txt = hov ? landerLabel(l) : l.short;
    if (!txt) continue;
    const bb = [x + 6, y - 7, x + 8 + tw(txt, 10) + 2, y + 6];
    if (!hov && taken.some(b => overlaps(b, bb))) continue;   // a colliding short label waits for hover
    taken.push(bb);
    lab += `<text x="${x + 8}" y="${y + 4}" class="lbl lbl-sc">${txt}</text>`;
  }
  return g + lab;
}
// right edge kept clear for the spot panel (px)
let insetR = 0;
export const setInsets = r => { insetR = r; };
function compassSvg() {
  // Earth direction = map up; the map never rotates, so the icon is fixed
  return `<g transform="translate(${W - 26 - insetR} 58)" class="cp"><path d="M0 18V-2M-3.5 3L0 -2L3.5 3"/><circle cx="0" cy="-9" r="5" class="ce"/></g>`;
}
export function drawOverlay(st, siteFill) {
  const { k } = st.view, s = scale(); let h = '';
  panel.classList.toggle('edit', !!st.edit);
  const [px, py] = toScr(N / 2, N / 2);
  for (const lat of GRATICULE_LATS) {
    const r = latRadius(lat) / PX * s;
    h += `<circle cx="${px}" cy="${py}" r="${r}" class="g"/><text x="${px + 3}" y="${py - r - 3}" class="gt">${lat}°</text>`;
  }
  h += `<line x1="0" x2="${W}" y1="${py}" y2="${py}" class="g"/><line y1="0" y2="${H}" x1="${px}" x2="${px}" class="g"/>`;
  const hot = id => id === st.site || id === st.hoverSite;
  const pi = st.pin ? pinInfo(st) : null, Zs = st.mode === 'layers' || tripBadges() ? [] : getZones(), hotZ = tripBadges() ? st.hoverTrip : hotZoneId(st);
  const boxOf = si => { const [x0, y0] = toScr(...mToCf(si.box_m[0], si.box_m[3])), [x1, y1] = toScr(...mToCf(si.box_m[2], si.box_m[1])); return [x0, y0, x1, y1]; };
  for (const si of data.sites) {
    if (!si.box_m) continue;
    const pinBox = pi && pi.siteId === si.id;
    if (!st.adv && !pinBox) continue;
    const [x0, y0, x1, y1] = boxOf(si);
    h += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" class="${hot(si.id) || pinBox ? 'box hot' : 'box'}"/>`;
    if (pinBox && !st.adv) h += `<text x="${x0 + 4}" y="${y0 - 5}" class="lbl">${si.name}</text>`;
  }
  if (Zs.length) {
    const [ox, oy] = toScr(0, 0); let hp = '';
    h += `<g transform="translate(${ox} ${oy}) scale(${s})">`;
    for (const z of Zs) { if (z.id === hotZ) hp = z.path; else if (st.adv) h += `<path d="${z.path}" class="zc"/><path d="${z.path}" class="zo"/>`; }
    if (hp) h += `<path d="${hp}" class="zh1"/><path d="${hp}" class="zh2"/>`;
    h += '</g>';
  }
  h += landmarkSvg(k, s);
  if (st.adv) for (const z of Zs.slice(ZONE.simpleTop)) {
    const [x, y] = toScr(z.col + .5, z.row + .5); if (x < 0 || y < 0 || x > W || y > H) continue;
    h += `<text x="${x}" y="${y + 4}" text-anchor="middle" class="zr${z.id === hotZ ? ' hot' : ''}">${z.id}</text>`;
  }
  let lab = '';
  if (st.adv) for (const si of data.sites) {
    const [x, y] = toScr(...mToCf(si.x_m, si.y_m)), f = siteFill(si);
    h += `<circle cx="${x}" cy="${y}" r="3.5" class="mk" style="fill:${f}"/>`;
    if (hot(si.id)) lab += `<text x="${x + 8}" y="${y + 4}" class="lbl">${si.name}</text>`;
  }
  h += lab;
  if (st.edit && st.hover) { const [x, y] = toScr(st.hover.col + .5, st.hover.row + .5); h += `<circle cx="${x}" cy="${y}" r="${brushCells(s) * s}" class="brush ${st.edit}"/>`; }
  else if (st.hover && k >= 4) { const [x, y] = toScr(st.hover.col, st.hover.row); h += `<rect x="${x}" y="${y}" width="${s}" height="${s}" class="hv"/>`; }
  h += landerSvg(st);
  if (st.expo) expoTop.forEach((p, k) => { const [x, y] = toScr(p.q + .5, p.r + .5); if (x > -10 && y > -10 && x < W + 10 && y < H + 10) h += `<circle cx="${x}" cy="${y}" r="7" class="xr"/><text x="${x}" y="${y + 3.5}" text-anchor="middle" class="xt">${k + 1}</text>`; });
  if (st.mode !== 'layers') for (const b of badges()) {
    const sg = b.flip ? 1 : -1, hotB = b.id === hotZ;
    h += `<path d="M${b.x} ${b.y}V${b.y + sg * 10}" class="zbs0"/><path d="M${b.x} ${b.y}V${b.y + sg * 10}" class="zbs"/><circle cx="${b.x}" cy="${b.cy}" r="11" class="zb${hotB ? ' hot' : ''}"/><text x="${b.x}" y="${b.cy + 4.5}" text-anchor="middle" class="zbt">${b.id}</text>`;
  }
  if (pi) {
    const [x, y] = toScr(pi.col + .5, pi.row + .5), mv = pi.v.kind === 'move' && pi.v.move && !pi.v.move.here ? pi.v.move : null;
    h += sightSvg(st, pi, skyGet(pi.col, pi.row), toScr, s, mv, W, H);   // Sun/Earth arrows, hiding ridge, landing-site arrow
    h += `<path d="M${x} ${y}l-5 -12a5.5 5.5 0 1 1 10 0z" class="pinm"/><circle cx="${x}" cy="${y - 14}" r="1.8" class="pind"/>`;
  }
  h += compassSvg();
  let km = [100, 50, 20, 10, 5].find(v => v * 1000 / PX * s <= 120) ?? 5, bw = km * 1000 / PX * s;
  h += `<g transform="translate(${W - 12 - insetR - bw} ${H - 62})" class="sb"><path d="M0 -4v4h${bw}v-4"/><text x="${bw / 2}" y="-8" text-anchor="middle" class="lbl">${km} ${t('km')}</text></g>`;
  svg.innerHTML = h;
}
export const mapHome = reset;

// spacecraft card (same content as the Compare map)
function landerCard(l, e) {
  let card = document.getElementById('lander-card');
  if (!l) { if (card) card.hidden = true; return; }
  const l0 = l, group = data.landers.filter(q => q.mission === l0.mission && q.x_m != null && Math.hypot(q.x_m - l0.x_m, q.y_m - l0.y_m) < 3000);
  if (!card) {
    card = Object.assign(document.createElement('div'), { id: 'lander-card' }); panel.appendChild(card);
    addEventListener('keydown', ev => { if (ev.key === 'Escape') card.hidden = true; });
  }
  const ko = lang === 'ko', kinds = ko ? { landed: '착륙', planned: '계획', impact: '충돌', crash: '추락' } : {};
  card.innerHTML = '<button aria-label="close">×</button>' + group.map(l => { const rel = l.relative ? (ko ? l.relative.text_ko : l.relative.text_en) : ''; return `<b>${l.name.replace(/ \(planned site\)| impact$/, '')}</b>`
    + `<div class="k">${kinds[l.kind] || l.kind} · ${l.date || l.year || ''}${!ko && l.status && l.status !== 'deliberate impact' ? ' · ' + l.status : ''}</div>`
    + `<p>${(ko ? l.purpose_ko : l.purpose_en) || l.mission || ''}</p>`
    + (rel ? `<div class="k">${rel}${l.verify ? (ko ? ' · 위치 대략' : ' · approx. position') : ''}</div>` : '')
    + (l.source ? `<a href="${l.source}" target="_blank" rel="noopener">${ko ? '출처' : 'source'}</a>` : ''); }).join('<hr>');
  card.querySelector('button').onclick = ev => { ev.stopPropagation(); card.hidden = true; };
  card.onpointerdown = ev => ev.stopPropagation(); card.onpointerup = ev => ev.stopPropagation();
  const r = panel.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  card.hidden = false;
  card.style.left = Math.min(x + 12, r.width - 250) + 'px';
  card.style.top = Math.max(8, Math.min(y + 12, r.height - card.offsetHeight - 8)) + 'px';
}
