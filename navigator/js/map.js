import { state, setState, limitsOf, ui, setHover, onHover } from './state.js';
import { ZOOM } from './config.js';
import { siteName, t } from './strings.js';
import { el, text, clear, showTip, hideTip } from './svg.js';
import { status, fixText, shortDate, blockage, azToMapDir, nearestOk } from './logic.js';
import { togglePin, rowOrder } from './calendar.js';
import { landmarks, where, fmtLatLon } from './orient.js';
import * as shadow from './shadow.js';
import { moment, bodyDir } from './globe.js';
import { getSite } from './data.js';
import { isoDate } from './logic.js';
import { critQuery } from './criteria.js';

// shadow picture for the selected hour (Sun direction is the same over the whole map)
const shadowCanvas = document.createElement('canvas');
let shadowKey = null, shadowUrl = null;
function shadowFor(st, d) {
  if (!shadow.ready()) return null;
  const key = st.day * 24 + st.hour;
  if (key !== shadowKey) {
    const m = moment(st, d);
    if (!m) return null;
    shadow.paint(shadowCanvas, m.sun);
    shadowUrl = shadowCanvas.toDataURL('image/png');
    shadowKey = key;
  }
  return shadowUrl;
}

// "long exposure": Sun-disc share averaged over the mission window (3 h steps), and its brightest landable spots
const expoCanvas = document.createElement('canvas');
let expoKey = null, expoUrl = null, expoTop = [], expoData = null, slopeMap = null, slopeLoading = false;
function expoFor(st, d) {
  if (!shadow.ready()) return null;
  if (!slopeMap && !slopeLoading) { slopeLoading = true; shadow.loadExtra().then(x => { slopeMap = x.slope; if (expoData) expoTop = shadow.brightest(expoData, slopeMap); render(state, data); }); }
  const key = `${st.day}:${st.mission}`;
  if (key !== expoKey) {
    const site = getSite(st.site, st.mission), s = d.index.byId[st.site];
    if (!site || !s) return null;
    const list = [], last = site.sky.sunAz.length - 1;
    for (let h = 0; h < st.mission * 24; h += 3) {
      const i = Math.min(last, st.day * 24 + h);
      list.push(bodyDir(s.lat, s.lon, site.sky.sunAz[i], site.sky.sunEl[i]));
    }
    const ex = expoData = shadow.exposure(list);
    shadow.paintExposure(expoCanvas, ex);
    expoUrl = expoCanvas.toDataURL('image/png');
    expoTop = slopeMap ? shadow.brightest(ex, slopeMap) : [];
    expoKey = key;
  }
  return expoUrl;
}

const R_KM = 200, EDGE = 14;
const rho = deg => 2 * 1737.4 * Math.tan((deg * Math.PI / 180) / 2); // km at colatitude deg
let svg, data, S = 588, ppk = 1.47;
const vp = { cx: 0, cy: 0, h: R_KM };
// sites with a PGDA 5 m tile (data/spot5); the rest use the 20 m patch (data/spot)
const SPOT5 = new Set(['haworth', 'malapert-massif', 'mons-mouton', 'nobile-rim-1', 'nobile-rim-2', 'de-gerlache-rim-2', 'shackleton-rim', 'connecting-ridge']);
let anim = null, hill = 'data/hillshade.jpg', instant = false;
const px = x => (x - vp.cx + vp.h) / (2 * vp.h) * S;
const py = y => (vp.cy + vp.h - y) / (2 * vp.h) * S;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const noMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function init(node, d) {
  svg = node; data = d;
  // sharp hillshade when present, the 700 px one otherwise
  const im = new Image();
  im.onload = () => { hill = 'data/hillshade_4000.jpg'; render(state, data); };
  im.src = 'data/hillshade_4000.jpg';
  shadow.load().then(() => render(state, data));
  const eb = document.getElementById('expo');
  eb.addEventListener('click', () => setState({ expo: state.expo ? 0 : 1 }));
  svg.addEventListener('pointerdown', e => {
    const xy = e.target.dataset && e.target.dataset.expo;
    if (!xy) return;
    const l = new URLSearchParams(location.hash.slice(1)).get('lang');
    location.hash = `pin=${xy}&d=${isoDate(state.day)}&ex=1${l ? '&lang=' + l : ''}${critQuery(state.crit)}`;
    location.reload();
  });

  svg.addEventListener('pointermove', e => {
    const id = e.target.dataset.id || null;
    setHover(id);
    if (id) showTip(tip(id), e);
    else if (e.target.dataset.tip) showTip(e.target.dataset.tip, e);
    else hideTip();
  });
  svg.addEventListener('pointerleave', () => { setHover(null); hideTip(); });
  // pick on pointerdown: during playback the map is redrawn every tick, so a click's target is gone by pointerup
  svg.addEventListener('pointerdown', e => {
    if (e.target.dataset.lander) { landerCard(e.target.dataset.lander, e); return; }
    landerCard(null);
    const id = e.target.dataset.id;
    if (!id || e.button !== 0) return;
    if (e.shiftKey) togglePin(id); else setState({ site: id });
  });
  // free view: drag to pan, wheel zooms about the cursor, double-click examines that point as a pin
  const world = e => { const r = svg.getBoundingClientRect(), u = (e.clientX - r.left) / r.width * 2 - 1, v = (e.clientY - r.top) / r.height * 2 - 1; return { u, v, x: vp.cx + u * vp.h, y: vp.cy - v * vp.h }; };
  let drag = null;
  svg.addEventListener('pointerdown', e => {
    const d = e.target.dataset || {};
    if (e.button !== 0 || d.id || d.lander || d.expo || state.view === 'compare' || state.zoom <= 1.001) return;
    drag = { x: e.clientX, y: e.clientY, cx: vp.cx, cy: vp.cy, moved: false, id: e.pointerId };
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    const r = svg.getBoundingClientRect(), k = 2 * vp.h / r.width, dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) { drag.moved = true; svg.setPointerCapture(drag.id); svg.classList.add('grabbing'); }
    instant = true; setState({ pan: `${(drag.cx - dx * k).toFixed(2)},${(drag.cy + dy * k).toFixed(2)}` });
  });
  const endDrag = () => { if (drag) { svg.classList.remove('grabbing'); drag = null; } };
  svg.addEventListener('pointerup', endDrag); svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('dblclick', e => {
    if (e.target.dataset.id || e.target.dataset.lander || state.view === 'compare') return;
    const w = world(e), l = new URLSearchParams(location.hash.slice(1)).get('lang');
    if (Math.abs(w.x) > R_KM || Math.abs(w.y) > R_KM) return;
    location.hash = `pin=${Math.round(w.x * 1000)},${Math.round(w.y * 1000)}&d=${isoDate(state.day)}&z=${state.zoom}${l ? '&lang=' + l : ''}${critQuery(state.crit)}`;
    location.reload();
  });
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const w = world(e), z = clamp(state.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), 1, ZOOM.spot), h = R_KM / z;
    instant = true;
    setState(z <= 1.001 ? { zoom: 1, pan: '' } : { zoom: z, pan: `${(w.x - w.u * h).toFixed(2)},${(w.y + w.v * h).toFixed(2)}` });
  }, { passive: false });
  document.querySelectorAll('#zoom button').forEach(b => b.addEventListener('click', () => setState(b.dataset.z === '1' ? { zoom: 1, pan: '' } : { zoom: b.dataset.z === 'spot' ? ZOOM.spot : Number(b.dataset.z) })));
  onHover(() => render(state, data));
}

function tip(id) {
  const st = state, s = data.index.byId[id], e = data.index.modes[st.mission].sites[id], v = status(e, st.day, st.mast, limitsOf(st));
  const l1 = [siteName(s), shortDate(st.day), v.kind === 'ok' ? t('go') : v.kind === 'none' ? t('nogo') : fixText(v)].join(' · ');
  return `${l1}\n${where(s)} · ${fmtLatLon(s.lat, s.lon)}`;
}

// ring around the selected site; true 3 km radius at Site level
const ringR = () => (state.view === 'focus' ? Math.max(12, 3 * ppk) : 12);

export function sitePos(id) {
  const s = data.index.byId[id], r = svg.getBoundingClientRect(), k = r.width / S;
  return { x: r.left + px(s.x_m / 1000) * k, y: r.top + py(s.y_m / 1000) * k, right: r.right, r: ringR() * k };
}

function targetVp(st) {
  if (st.view === 'compare' || st.zoom <= 1.001) return { cx: 0, cy: 0, h: R_KM };
  const s = data.index.byId[st.site], h = R_KM / st.zoom, lim = R_KM - h;
  const pan = /^(-?[\d.]+),(-?[\d.]+)$/.exec(st.pan || '');
  if (pan) return { cx: clamp(+pan[1], -lim, lim), cy: clamp(+pan[2], -lim, lim), h };
  return { cx: clamp(s.x_m / 1000, -lim, lim), cy: clamp(s.y_m / 1000, -lim, lim), h };
}

export function render(st, d) {
  data = d;
  S = svg.clientWidth;
  if (!S) return;
  svg.setAttribute('viewBox', `0 0 ${S} ${S}`);
  const tg = targetVp(st);
  if (anim) { anim.to = tg; return; }
  const same = ['cx', 'cy', 'h'].every(k => Math.abs(vp[k] - tg[k]) < 1e-6);
  if (same) return draw(st);
  if (noMotion() || instant) { instant = false; Object.assign(vp, tg); return draw(st); }
  const from = { ...vp }, t0 = performance.now();
  anim = { to: tg };
  const step = now => {
    const p = Math.min(1, (now - t0) / ZOOM.slideMs), e = 1 - Math.pow(1 - p, 3);
    for (const k of ['cx', 'cy', 'h']) vp[k] = from[k] + (anim.to[k] - from[k]) * e;
    draw(state);
    if (p < 1) requestAnimationFrame(step); else { Object.assign(vp, anim.to); anim = null; draw(state); }
  };
  requestAnimationFrame(step);
}

const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

function draw(st) {
  ppk = S / (2 * vp.h);
  const compare = st.view === 'compare', siteLevel = vp.h < R_KM - 1;
  clear(svg);
  document.getElementById('where').textContent = st.pan && !compare && vp.h < R_KM - 1 ? where({ x_m: vp.cx * 1000, y_m: vp.cy * 1000 }) : where(data.index.byId[st.site]);
  { const eb = document.getElementById('expo'); eb.textContent = t('expo', st.mission); eb.setAttribute('aria-pressed', String(!!st.expo)); }
  document.getElementById('zoom').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Math.abs((b.dataset.z === 'spot' ? ZOOM.spot : Number(b.dataset.z)) / st.zoom - 1) < 0.02)));

  // hillshade, then (later) a shadow layer, then the overlays
  const iw = 2 * R_KM * ppk;
    el('image', { href: 'data/hillshade.jpg', x: px(-R_KM), y: py(R_KM), width: iw, height: iw }, svg);
  if (hill !== 'data/hillshade.jpg') el('image', { href: hill, x: px(-R_KM), y: py(R_KM), width: iw, height: iw }, svg);
  // LOLA hillshade tiles wherever the view is close enough to need them: 40 m (10 km tiles), 20 m (5 km) when closer
  for (const [res, T, n, hmax] of [[40, 10, 40, 30], [20, 5, 80, 8]]) {
    if (vp.h >= hmax) continue;
    const c0 = Math.max(0, Math.floor((vp.cx - vp.h + R_KM) / T)), c1 = Math.min(n - 1, Math.floor((vp.cx + vp.h + R_KM) / T));
    const r0 = Math.max(0, Math.floor((R_KM - (vp.cy + vp.h)) / T)), r1 = Math.min(n - 1, Math.floor((R_KM - (vp.cy - vp.h)) / T));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++)
      el('image', { href: `data/t${res}/${c}_${r}.jpg`, x: px(-R_KM + c * T) - .5, y: py(R_KM - r * T) - .5, width: T * ppk + 1, height: T * ppk + 1, preserveAspectRatio: 'none' }, svg);
  }
  // 20 m LOLA hillshade patches (+-4.5 km) around each site, faded in as you zoom past Site
  const sharp = Math.max(0, Math.min(1, (14 - vp.h) / 8));
  if (sharp > 0.01) for (const s of data.index.sites) {
    if (s.isPin) continue;
    const x = s.x_m / 1000, y = s.y_m / 1000;
    if (Math.abs(x - vp.cx) > vp.h + 5 || Math.abs(y - vp.cy) > vp.h + 5) continue;
    el('image', { href: `data/${SPOT5.has(s.id) ? 'spot5' : 'spot'}/${s.id}.jpg`, x: px(x - 4.5), y: py(y + 4.5), width: 9 * ppk, height: 9 * ppk, opacity: sharp, preserveAspectRatio: 'none' }, svg);
  }
  const sg = el('g', { id: 'shadow-layer' }, svg), sh = st.expo ? expoFor(st, data) : shadowFor(st, data);
  // the mask grid is 800 px of 500 m, pixel centres from -199.75 km: it spans exactly +-200 km
  const fade = Math.max(0, Math.min(1, (vp.h - 3.5) / 11.5));   // 500 m mask: gone at Spot
  if (sh && fade > 0.01) el('image', { opacity: fade, href: sh, x: px(-R_KM), y: py(R_KM), width: iw, height: iw, preserveAspectRatio: 'none' }, sg);

  // graticule and the Earth line (0 deg spoke)
  const g = el('g', { stroke: '#fff', 'stroke-opacity': .5, fill: 'none', 'stroke-width': 1 }, svg);
  for (const [colat, label] of [[2, '88°'], [5, '85°']]) {
    const r = rho(colat) * ppk;
    el('circle', { cx: px(0), cy: py(0), r }, g);
    text(svg, label, { x: px(0) + 4, y: py(0) - r - 3, class: 'tick', style: 'fill:#fff;fill-opacity:.7' });
  }
  for (const a of [90, 180, 270]) {
    const r = a * Math.PI / 180;
    el('line', { x1: px(0), y1: py(0), x2: px(0) + Math.sin(r) * S * 2, y2: py(0) - Math.cos(r) * S * 2 }, g);
  }
  el('line', { x1: px(0), y1: py(0), x2: px(0), y2: -S, stroke: 'var(--earth)', 'stroke-opacity': .6 }, svg);
  el('path', { d: `M${px(0) - 5},${py(0)}h10M${px(0)},${py(0) - 5}v10`, stroke: '#fff', 'stroke-width': 1 }, svg);

  // brightest spots of the long exposure (click = examine as a pin)
  if (st.expo && !compare) expoTop.forEach((p, k) => {
    const x = px(p.x / 1000), y = py(p.y / 1000), tip = t('expoTip', Math.round(p.frac * 100));
    el('circle', { cx: x, cy: y, r: 7, fill: 'rgba(15,19,27,.55)', stroke: 'var(--sun)', 'stroke-width': 2, 'data-tip': tip, 'data-expo': `${p.x},${p.y}`, style: 'cursor:pointer' }, svg);
    text(svg, String(k + 1), { x, y: y + 3.5, 'text-anchor': 'middle', style: 'fill:var(--sun);font-size:10px;font-weight:600;pointer-events:none' });
  });

  const mode = data.index.modes[st.mission].sites, lim = limitsOf(st);
  const marked = new Set(compare ? (data.compared || [st.site]) : [st.site, ...st.pinned]);
  const site = data.index.byId[st.site];
  const lms = landmarks();

  // MOVE grid on the map when zoomed in: where you could land today
  if (vp.h < 10 && data.site && !compare) {
    const site0 = data.index.byId[st.site], cell = data.site.stepKm * ppk;
    // landable today: green outline; too steep: thin hatch; the terrain stays visible underneath
    const defs = el('defs', {}, svg), pat = el('pattern', { id: 'steep', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#fff', 'stroke-opacity': .35, 'stroke-width': 1 }, pat);
    const g = el('g', { 'pointer-events': 'none' }, svg);
    for (const c of data.site.grid) {
      const ok = c.ok[st.day] === '1';
      if (c.landable && !ok) continue;
      const x = px(site0.x_m / 1000 + c.dx) - cell / 2, y = py(site0.y_m / 1000 + c.dy) - cell / 2;
      if (ok) el('rect', { x: x + 1, y: y + 1, width: cell - 2, height: cell - 2, fill: 'var(--move)', 'fill-opacity': .12, stroke: 'var(--move)', 'stroke-width': 1.5 }, g);
      else el('rect', { x, y, width: cell, height: cell, fill: 'url(#steep)' }, g);
    }
  }

  // crater rings
  for (const l of lms) {
    if (l.kind !== 'crater' || (l.tier > 2 && !siteLevel)) continue;
    el('circle', { cx: px(l.x), cy: py(l.y), r: l.R * ppk, fill: 'none', stroke: '#fff', 'stroke-opacity': .35, 'stroke-dasharray': '2 3' }, svg);
  }

  // why-ray
  if (data.site && !compare) {
    const b = blockage(data.site.sky, st.day * 24 + st.hour), len = Math.min(60 * ppk, 176);
    const x0 = px(site.x_m / 1000), y0 = py(site.y_m / 1000);
    for (const k of ['sun', 'earth']) {
      if (!b[k]) continue;
      const [dx, dy] = azToMapDir(site.lon, b[k].az);
      el('line', { x1: x0, y1: y0, x2: x0 + dx * len, y2: y0 - dy * len, stroke: 'var(--block)', 'stroke-width': 1.5 }, svg);
      // what is hidden that way: the Sun or Earth, struck through by the ridge
      const ex = x0 + dx * (len + 8), ey = y0 - dy * (len + 8);
      el('circle', { cx: ex, cy: ey, r: 6, fill: `var(--${k})`, stroke: 'var(--block)', 'stroke-width': 1.5 }, svg);
      el('line', { x1: ex - 6, y1: ey + 4, x2: ex + 6, y2: ey - 4, stroke: 'var(--block)', 'stroke-width': 1.5 }, svg);
    }
  }

  // MOVE prescription point at Site level
  if (siteLevel && data.site && !compare) {
    const n = nearestOk(data.site, st.day);
    if (n && n.d > 0) {
      const x0 = px(site.x_m / 1000), y0 = py(site.y_m / 1000), x1 = px(site.x_m / 1000 + n.c.dx), y1 = py(site.y_m / 1000 + n.c.dy);
      el('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: '#000', 'stroke-width': 3.5, 'stroke-opacity': .5 }, svg);
      el('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: '#fff', 'stroke-width': 1.5 }, svg);
      const rr = Math.max(7, 0.2 * ppk);
      el('circle', { cx: x1, cy: y1, r: rr, fill: 'none', stroke: '#000', 'stroke-width': 4, 'stroke-opacity': .5 }, svg);
      el('circle', { cx: x1, cy: y1, r: rr, fill: 'none', stroke: '#fff', 'stroke-width': 2 }, svg);
    }
  }

  // dots (positions first: spacecraft badge and label collisions use them)
  const dots = data.index.sites.map(s => ({ s, x: px(s.x_m / 1000), y: py(s.y_m / 1000) }));

  // spacecraft: white diamonds and crosses, never status-coloured
  const kindWord = k => t('kinds')[k] || k;
  const scs = [];
  lastLanders = data.index.landers;
  for (const l of data.index.landers) {
    if (!['landed', 'planned', 'impact', 'crash'].includes(l.kind)) continue;
    if (l.x_m == null || Math.abs(l.x_m) > R_KM * 1000 || Math.abs(l.y_m) > R_KM * 1000) continue;
    let x = px(l.x_m / 1000), y = py(l.y_m / 1000), a = 5;
    if (x < -10 || y < -10 || x > S + 10 || y > S + 10) continue;
    const near = dots.find(q => Math.hypot(q.x - x, q.y - y) < 8);
    if (near) { x = near.x + 8; y = near.y - 8; a = 3.5; }
    const gl = el('g', { opacity: l.verify ? .5 : 1 }, svg);
    const sh = { stroke: '#000', 'stroke-width': 4, 'stroke-opacity': .6, fill: 'none' };
    const mk = (attrs, parent) => { el('path', { ...attrs, ...sh }, parent); el('path', attrs, parent); };
    const dia = `M${x},${y - a}L${x + a},${y}L${x},${y + a}L${x - a},${y}Z`;
    if (l.kind === 'landed') { el('path', { d: dia, ...sh, 'stroke-width': 2.5 }, gl); el('path', { d: dia, fill: '#fff' }, gl); }
    else if (l.kind === 'planned') mk({ d: dia, stroke: '#fff', 'stroke-width': 1.5, fill: 'none' }, gl);
    else mk({ d: `M${x - a},${y - a}L${x + a},${y + a}M${x + a},${y - a}L${x - a},${y + a}`, stroke: '#fff', 'stroke-width': 1.5, fill: 'none' }, gl);
    const tp = `${l.verify ? '≈ ' : ''}${siteName(l)} · ${(l.mission || '').split('(')[0].trim()} · ${l.year} · ${kindWord(l.kind)}`;
    el('circle', { cx: x, cy: y, r: 9, fill: 'transparent', 'data-tip': tp, 'data-lander': l.id, style: 'cursor:pointer' }, svg);
    scs.push({ l, x, y });
  }

  // site dots
  for (const { s, x, y } of dots) {
    const k = status(mode[s.id], st.day, st.mast, lim).kind, selected = s.id === st.site;
    const pinned = marked.has(s.id) && !selected;
    if (selected) el('circle', { cx: x, cy: y, r: ringR(), fill: 'none', stroke: '#fff', 'stroke-width': 1.5 }, svg);
    else if (pinned) el('circle', { cx: x, cy: y, r: 12, fill: 'none', stroke: '#fff', 'stroke-width': 1, 'stroke-dasharray': compare ? '' : '3 2' }, svg);
    const fillC = k === 'none' ? 'none' : `var(--${k})`;
    if (s.isPin) {   // custom point: teardrop pin, tip at the position (grey when there is no fix)
      el('path', { d: `M${x},${y}C${x - 3},${y - 6} ${x - 9},${y - 9} ${x - 9},${y - 15}A9,9 0 1 1 ${x + 9},${y - 15}C${x + 9},${y - 9} ${x + 3},${y - 6} ${x},${y}Z`, fill: k === 'none' ? 'var(--none)' : fillC, stroke: '#fff', 'stroke-width': 1.5 }, svg);
      el('circle', { cx: x, cy: y - 15, r: 3, fill: '#fff' }, svg);
    } else el('circle', { cx: x, cy: y, r: selected ? 7 : 6, fill: fillC, stroke: '#fff', 'stroke-width': 1.5 }, svg);
    el('circle', { cx: x, cy: y, r: 12, fill: 'transparent', 'data-id': s.id, style: 'cursor:pointer' }, svg);
  }

  // landmark glyphs and hit areas
  for (const l of lms) {
    if (l.tier > 2 && !siteLevel) continue;
    const x = px(l.x), y = py(l.y);
    if (l.kind === 'massif') el('path', { d: `M${x - 4},${y + 3.5}L${x},${y - 3.5}L${x + 4},${y + 3.5}Z`, fill: 'none', stroke: '#fff', 'stroke-opacity': .8, 'stroke-width': 1.5 }, svg);
    const size = l.kind === 'point' ? '' : (l.diameter_km || '');
    el('circle', { cx: x, cy: y, r: 6, fill: 'transparent', 'data-tip': t('lmTip', siteName(l), kindWord(l.kind), size, fmtLatLon(l.lat, l.lon)) }, svg);
  }

  // labels: greedy, highest priority first; text boxes are measured
  const plate = compare ? null : [8, S - 8 - 176 * (S / 588), 8 + 176 * (S / 588), S - 8];
  const placed = dots.map(d => [d.x - 9, d.y - 9, d.x + 9, d.y + 9]);
  scs.forEach(q => placed.push([q.x - 6, q.y - 6, q.x + 6, q.y + 6]));
  placed.push([S / 2 - 12, 2, S / 2 + 70, 30]);
  placed.push([0, 0, Math.min(S / 2 - 70, 280), 44]);
  placed.push([S - 150, 0, S, 38]);
  if (plate) placed.push(plate);
  const place = (str, style, cands, force) => {
    const tx = text(svg, str, { style, 'pointer-events': 'none' });
    for (const [x, y, anchor] of cands) {
      tx.setAttribute('x', x); tx.setAttribute('y', y); tx.setAttribute('text-anchor', anchor);
      const b = tx.getBBox(), box = [b.x - 1, b.y, b.x + b.width + 1, b.y + b.height];
      if (box[0] < 2 || box[2] > S - 2 || box[1] < 2 || box[3] > S - 2) continue;
      if (placed.some(p => overlap(p, box))) continue;
      placed.push(box); return tx;
    }
    if (force) { const [x, y, anchor] = cands[0]; tx.setAttribute('x', x); tx.setAttribute('y', y); tx.setAttribute('text-anchor', anchor); return tx; }
    tx.remove(); return null;
  };
  const halo = 'stroke:#000;stroke-width:2.5px;paint-order:stroke;';
  const siteLabel = (d, size, weight, op, force) => place(siteName(d.s), `${halo}font-size:${size}px;font-weight:${weight};fill:#fff;fill-opacity:${op}`,
    [[d.x + 12, d.y + 4, 'start'], [d.x - 12, d.y + 4, 'end'], [d.x + 9, d.y - 7, 'start'], [d.x + 9, d.y + 18, 'start'], [d.x - 9, d.y - 7, 'end'], [d.x - 9, d.y + 18, 'end']], force);
  const lmLabel = (l, tier1) => {
    const x = px(l.x), y = py(l.y), name = siteName(l).toUpperCase();
    const style = `${halo}font-size:${tier1 ? (compare ? 10 : 11) : 10}px;font-weight:${tier1 ? 600 : 400};letter-spacing:.08em;fill:#fff;fill-opacity:${tier1 ? .9 : .6}`;
    const cands = l.kind === 'crater' || l.kind === 'ridge'
      ? [[x, y + 4, 'middle'], [x, y + 18, 'middle'], [x, y - 10, 'middle'], [x, y + l.R * ppk + 14, 'middle']]
      : [[x + 8, y + 4, 'start'], [x - 8, y + 4, 'end'], [x, y - 9, 'middle'], [x, y + 17, 'middle']];
    return place(name, style, cands, tier1);
  };
  const dotOf = id => dots.find(d => d.s.id === id);
  const onScreen = (x, y) => x > 0 && y > 0 && x < S && y < S;
  // edge arrows to tier-1 landmarks that are off screen (Site level)
  if (siteLevel && !compare) {
    const ax = px(site.x_m / 1000), ay = py(site.y_m / 1000), used = [];
    for (const l of lms) {
      if (l.tier !== 1 || l.kind === 'point') continue;
      const x = px(l.x), y = py(l.y);
      if (x > 20 && x < S - 20 && y > 20 && y < S - 20) continue;
      const dx = x - S / 2, dy = y - S / 2, k = Math.min((S / 2 - EDGE) / Math.abs(dx || 1e-9), (S / 2 - EDGE) / Math.abs(dy || 1e-9));
      let bx = S / 2 + dx * k, by = S / 2 + dy * k;
      if (plate && bx < plate[2] + 4 && by > plate[1] - 4) { if (Math.abs(dx) > Math.abs(dy)) by = plate[1] - EDGE; else bx = plate[2] + EDGE; }
      if (Math.abs(bx - S / 2) < 44 && by < 40) bx = S / 2 + (bx < S / 2 ? -44 : 44);
      if (used.some(u => Math.hypot(u[0] - bx, u[1] - by) < 18)) continue;
      used.push([bx, by]);
      const ang = Math.atan2(y - ay, x - ax), ux = Math.cos(ang), uy = Math.sin(ang);
      el('path', { d: `M${bx + ux * 5},${by + uy * 5}L${bx - ux * 5 - uy * 4},${by - uy * 5 + ux * 4}L${bx - ux * 5 + uy * 4},${by - uy * 5 - ux * 4}Z`, fill: '#fff', 'fill-opacity': .9, stroke: '#000', 'stroke-width': 1 }, svg);
      const km = Math.round(st.pan ? Math.hypot(l.x - vp.cx, l.y - vp.cy) : Math.hypot(l.x - site.x_m / 1000, l.y - site.y_m / 1000));
      const nearPlate = plate && by > plate[1] - 20 && bx < plate[2] + 150;
      const left = bx < S / 2, vert = Math.abs(bx - S / 2) < S / 2 - 70 && (by < 30 || by > S - 30);
      const tx = text(svg, `${siteName(l).toUpperCase()} ${km} km`, {
        x: vert ? (nearPlate ? Math.max(bx - 10, plate[2] + 8) : clamp(bx, 60, S - 60)) : left ? bx + 12 : bx - 12, y: vert ? (by < 30 ? by + 20 : by - 12) : by + 4,
        'text-anchor': vert ? (nearPlate ? 'start' : 'middle') : left ? 'start' : 'end', 'pointer-events': 'none', style: `${halo}font-size:10px;font-weight:600;letter-spacing:.06em;fill:#fff`
      });
      const bb = tx.getBBox();
      placed.push([bb.x, bb.y, bb.x + bb.width, bb.y + bb.height], [bx - 6, by - 6, bx + 6, by + 6]);
    }
  }

  siteLabel(dotOf(st.site), 13, 600, 1, true);
  for (const l of lms) if (l.tier === 1 && onScreen(px(l.x), py(l.y))) lmLabel(l, true);
  for (const id of marked) if (id !== st.site) siteLabel(dotOf(id), 13, 600, 1, true);
  if (ui.hover && !marked.has(ui.hover)) siteLabel(dotOf(ui.hover), 12, 600, 1, true);
  for (const q of scs) if (q.l.short && onScreen(q.x, q.y)) place(q.l.short, `${halo}font-size:10px;fill:#fff;fill-opacity:.75`, [[q.x + 9, q.y + 3, 'start'], [q.x - 9, q.y + 3, 'end']]);
  if (siteLevel) {
    for (const l of lms) if (l.tier === 2 && onScreen(px(l.x), py(l.y))) lmLabel(l, false);
    for (const id of rowOrder()) if (!marked.has(id) && id !== ui.hover && dotOf(id) && onScreen(dotOf(id).x, dotOf(id).y)) siteLabel(dotOf(id), 11, 400, .85, false);
  }

  // scale bar, frame, Earth mark
  const km = [0.5, 1, 2, 5, 10, 20, 50].find(k => k * ppk >= 55) || 50, len = km * ppk, sx = S - 12 - len, sy = S - 14;
  el('path', { d: `M${sx},${sy - 4}v4h${len}v-4`, fill: 'none', stroke: '#000', 'stroke-width': 3, 'stroke-opacity': .5 }, svg);
  el('path', { d: `M${sx},${sy - 4}v4h${len}v-4`, fill: 'none', stroke: '#fff' }, svg);
  text(svg, t('km', km), { x: sx + len, y: sy - 8, 'text-anchor': 'end', class: 'tick', style: `fill:#fff;${halo}` });
  el('rect', { x: 1, y: 1, width: S - 2, height: S - 2, fill: 'none', stroke: '#fff', 'stroke-width': 1.5, 'pointer-events': 'none' }, svg);
  const em = el('g', { 'pointer-events': 'none' }, svg);
  el('circle', { cx: S / 2, cy: 16, r: compare ? 5 : 6, fill: 'var(--earth)', stroke: '#fff', 'stroke-width': 1.5 }, em);
  el('path', { d: `M${S / 2 - 4},${9} L${S / 2},${5} L${S / 2 + 4},${9}`, fill: 'none', stroke: '#fff', 'stroke-width': 1.5 }, em);
  if (!compare) text(em, t('earthWord'), { x: S / 2 + 12, y: 20, class: 'tick', style: `fill:#fff;${halo}letter-spacing:.08em` });
  document.dispatchEvent(new Event('mapframe'));
}

let lastLanders = [];

// spacecraft card: name, what happened, when, what it was for
function landerCard(id, e) {
  const panel = document.getElementById('map-panel');
  let card = document.getElementById('lander-card');
  if (!id) { if (card) card.hidden = true; return; }
  const l0 = lastLanders.find(q => q.id === id); if (!l0) return;
  const group = lastLanders.filter(q => q.mission === l0.mission && q.x_m != null && Math.hypot(q.x_m - l0.x_m, q.y_m - l0.y_m) < 3000);
  hideTip();
  if (!card) {
    card = document.createElement('div'); card.id = 'lander-card'; panel.appendChild(card);
    addEventListener('keydown', ev => { if (ev.key === 'Escape') card.hidden = true; });
  }
  const ko = (document.documentElement.lang || '').startsWith('ko');
  card.innerHTML = '<button aria-label="close">×</button>' + group.map(l => { const kind = t('kinds')[l.kind] || l.kind, when = l.date || String(l.year || ''), rel = l.relative ? (ko ? l.relative.text_ko : l.relative.text_en) : ''; return `<b>${l.name.replace(/ \(planned site\)| impact$/, '')}</b>`
    + `<div class="k">${kind} · ${when}${!ko && l.status && l.status !== 'deliberate impact' ? ' · ' + l.status : ''}</div>`
    + `<p>${(ko ? l.purpose_ko : l.purpose_en) || l.mission || ''}</p>`
    + (rel ? `<div class="k">${rel}${l.verify ? (ko ? ' · 위치 대략' : ' · approx. position') : ''}</div>` : '')
    + (l.source ? `<a href="${l.source}" target="_blank" rel="noopener">${ko ? '출처' : 'source'}</a>` : ''); }).join('<hr>');
  card.querySelector('button').onclick = () => { card.hidden = true; };
  const r = panel.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  card.hidden = false;
  card.style.left = Math.min(x + 12, r.width - 250) + 'px';
  card.style.top = Math.max(8, Math.min(y + 12, r.height - card.offsetHeight - 8)) + 'px';
}
