// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { state, ui, onHover, limitsOf } from './state.js';
import { GLOBE } from './config.js';
import { el, clear } from './svg.js';
import { getSite } from './data.js';
import { t } from './strings.js';
import { status } from './logic.js';

const D2R = Math.PI / 180, R_MOON = 1737.4, CAP_KM = 200;
let root, canvas, svg, data, tex = null, hill = null;
let cur = { fade: 1 };
// view: 'earth' = as seen from Earth now, 'site' = selected site centred, 'free' = dragged by hand
let view = { mode: 'earth', lat: 0, lon: 0 }, anim = null, zoom = 1;
const ZOOM = { max: 12, site: 6 };

export function init(node, d) {
  root = node; data = d;
  canvas = root.querySelector('canvas'); svg = root.querySelector('svg');
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    tex = g.getImageData(0, 0, img.width, img.height);
    render(state, data);
  };
  img.src = 'data/moon.jpg';
  const hs = new Image();
  hs.onload = () => {
    const c = document.createElement('canvas');
    c.width = hs.width; c.height = hs.height;
    c.getContext('2d').drawImage(hs, 0, 0);
    hill = c.getContext('2d').getImageData(0, 0, hs.width, hs.height);
    render(state, data);
  };
  hs.src = 'data/hillshade.jpg';
  onHover(() => render(state, data));

  // drag to rotate
  let drag = null;
  root.addEventListener('pointerdown', ev => {
    if (ev.target.closest('button')) return;
    const c = centre(state, data);
    drag = { x: ev.clientX, y: ev.clientY, lat: c.lat, lon: c.lon, roll: c.roll || 0 };
    anim = null; root.setPointerCapture(ev.pointerId); root.classList.add('grabbing');
  });
  root.addEventListener('pointermove', ev => {
    if (!drag) return;
    const k = 90 / geom().r;   // degrees per px: dragging one radius turns 90 deg
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y, cr = Math.cos(drag.roll), sr = Math.sin(drag.roll);
    const ux = dx * cr - dy * sr, uy = dx * sr + dy * cr;   // drag in the un-turned picture
    view = { mode: 'free', lat: Math.max(-90, Math.min(90, drag.lat + uy * k)), lon: drag.lon - ux * k, roll: drag.roll };
    render(state, data);
  });
  // wheel / trackpad pinch to zoom
  root.addEventListener('wheel', ev => {
    ev.preventDefault();
    zoom = Math.max(1, Math.min(ZOOM.max, zoom * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015))));
    render(state, data);
  }, { passive: false });
  const end = () => { drag = null; root.classList.remove('grabbing'); };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);

  // two view buttons: Earth view, site centred
  for (const [mode, icon] of [['earth', '<circle cx="8" cy="8" r="5.5" fill="var(--earth)"/>'], ['site', '<circle cx="8" cy="8" r="5.5" fill="none" stroke="#fff" stroke-width="1.2"/><circle cx="8" cy="8" r="1.8" fill="#fff"/>']]) {
    const b = document.createElement('button');
    b.className = 'gbtn'; b.dataset.mode = mode; b.setAttribute('aria-label', t(mode === 'earth' ? 'viewEarth' : 'viewSite')); b.title = b.getAttribute('aria-label');
    b.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16">${icon}</svg>`;
    b.onclick = () => goTo(mode);
    root.appendChild(b);
  }
}

// centre of the view for a mode
function target(mode, st, d) {
  const m = moment(st, d);
  if (mode === 'site') {
    // site in the middle, turned so Earth is up, like the map
    const s = d.index.sites.find(x => x.id === st.site);
    const e = m ? project(m.lat0, m.lon0, s.lat, s.lon) : { x: 0, y: 1 };
    return { lat: s.lat, lon: s.lon, roll: Math.atan2(e.x, e.y) };
  }
  return m ? { lat: m.lat0, lon: m.lon0, roll: 0 } : { lat: 0, lon: 0, roll: 0 };
}
function centre(st, d) {
  if (anim) return anim.now;
  return view.mode === 'free' ? { lat: view.lat, lon: view.lon, roll: view.roll || 0 } : target(view.mode, st, d);
}

// smooth turn to a mode
function goTo(mode) {
  const from = centre(state, data), to = target(mode, state, data);
  const dlon = ((to.lon - from.lon + 540) % 360) - 180, t0 = performance.now(), ms = 600;
  const z0 = zoom, z1 = mode === 'site' ? ZOOM.site : 1;
  anim = { now: from };
  const step = now => {
    if (!anim) return;
    const p = Math.min(1, (now - t0) / ms), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const dr = (((to.roll - (from.roll || 0)) / D2R + 540) % 360 - 180) * D2R;
    anim.now = { lat: from.lat + (to.lat - from.lat) * e, lon: from.lon + dlon * e, roll: (from.roll || 0) + dr * e };
    zoom = z0 * Math.pow(z1 / z0, e);
    render(state, data);
    if (p < 1) requestAnimationFrame(step); else { anim = null; view = { mode, ...to }; render(state, data); }
  };
  requestAnimationFrame(step);
}

// unit vector (moon-fixed: x = lon 0, y = lon 90E, z = north) of a body seen at az/el from a site
export function bodyDir(lat, lon, az, el) {
  const p = lat * D2R, l = lon * D2R, a = az * D2R, e = el * D2R;
  const up = [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  const east = [-Math.sin(l), Math.cos(l), 0];
  const north = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)];
  return [0, 1, 2].map(k => Math.cos(e) * (Math.cos(a) * north[k] + Math.sin(a) * east[k]) + Math.sin(e) * up[k]);
}

// where Earth and Sun are at the selected moment (from the site's hourly series)
export function moment(st, d) {
  const site = getSite(st.site, st.mission), s = d.index.sites.find(x => x.id === st.site);
  if (!site || !s) return null;
  const i = Math.min(site.sky.sunAz.length - 1, st.day * 24 + st.hour);
  const E = bodyDir(s.lat, s.lon, site.sky.earthAz[i], site.sky.earthEl[i]);
  const S = bodyDir(s.lat, s.lon, site.sky.sunAz[i], site.sky.sunEl[i]);
  return { lat0: Math.asin(E[2]) / D2R, lon0: Math.atan2(E[1], E[0]) / D2R, sun: S };
}

// disc geometry in css px
function geom() {
  const W = root.clientWidth, H = root.clientHeight;
  if (state.view === 'compare') { const r = H * 0.41 * zoom; return { W, H, cx: W / 2, cy: H / 2, r, ex: W / 2, ey: Math.max(7, H / 2 - r - 8) }; }
  const k = W / 232;
  return { W, H, cx: 116 * k, cy: 116 * k, r: GLOBE.r * k * zoom };
}

// orthographic forward projection: -> {x, y (up positive, unit disc), vis}
// project then turn the picture by roll (rad, counter-clockwise)
function projectR(lat, lon, c) {
  const p = project(lat, lon, c.lat, c.lon), cr = Math.cos(c.roll || 0), sr = Math.sin(c.roll || 0);
  return { x: p.x * cr - p.y * sr, y: p.x * sr + p.y * cr, vis: p.vis };
}

function project(lat, lon, lat0, lon0) {
  const p = lat * D2R, p0 = lat0 * D2R, dl = (lon - lon0) * D2R;
  return {
    x: Math.cos(p) * Math.sin(dl),
    y: Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(dl),
    vis: Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(dl) >= 0
  };
}

function drawTexture(gm, c, sun) {
  const lat0 = c.lat, lon0 = c.lon, cr = Math.cos(c.roll || 0), sr = Math.sin(c.roll || 0);
  const dpr = devicePixelRatio || 1, w = Math.round(gm.W * dpr), h = Math.round(gm.H * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (!tex) return;
  const R = gm.r * dpr, cx = gm.cx * dpr, cy = gm.cy * dpr, out = ctx.createImageData(w, h);
  const s0 = Math.sin(lat0 * D2R), c0 = Math.cos(lat0 * D2R), tw = tex.width, th = tex.height, src = tex.data, dst = out.data;
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(w, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(h, Math.ceil(cy + R));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const X = (px + .5 - cx) / R, Y = (cy - py - .5) / R, r2 = X * X + Y * Y;
      const x = X * cr + Y * sr, y = -X * sr + Y * cr;
      if (r2 > 1) continue;
      const z = Math.sqrt(1 - r2);
      const lat = Math.asin(Math.max(-1, Math.min(1, z * s0 + y * c0))) / D2R;
      let lon = (lon0 + Math.atan2(x, z * c0 - y * s0) / D2R + 540) % 360 - 180;
      const u = Math.min(tw - 1, Math.floor((lon + 180) / 360 * tw)), v = Math.min(th - 1, Math.floor((90 - lat) / 180 * th));
      let img = src, i = (v * tw + u) * 4;
      const o = (py * w + px) * 4;
      if (hill && lat < -83) {
        // inside the map's +-200 km: use the LOLA hillshade so the globe matches the map
        const rho = 2 * R_MOON * Math.tan((90 + lat) / 2 * D2R), xk = rho * Math.sin(lon * D2R), yk = rho * Math.cos(lon * D2R);
        if (Math.abs(xk) < CAP_KM && Math.abs(yk) < CAP_KM) {
          const hu = Math.floor((xk + CAP_KM) / (2 * CAP_KM) * hill.width), hv = Math.floor((CAP_KM - yk) / (2 * CAP_KM) * hill.height);
          img = hill.data; i = (hv * hill.width + hu) * 4;
        }
      }
      let k = 1;
      if (sun) {
        const pl = lat * D2R, ll = lon * D2R;
        const b = Math.cos(pl) * Math.cos(ll) * sun[0] + Math.cos(pl) * Math.sin(ll) * sun[1] + Math.sin(pl) * sun[2];
        k = 0.25 + 0.75 * Math.max(0, Math.min(1, (b + 0.04) / 0.12));
      }
      dst[o] = img[i] * k; dst[o + 1] = img[i + 1] * k; dst[o + 2] = img[i + 2] * k; dst[o + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

export function render(st, d) {
  data = d;
  const gm = geom();
  if (!gm.W || !gm.H) return;
  const m = moment(st, d), c = centre(st, d);
  for (const b of root.querySelectorAll('.gbtn')) b.setAttribute('aria-pressed', !anim && view.mode === b.dataset.mode);
  drawTexture(gm, c, m && m.sun);
  svg.setAttribute('viewBox', `0 0 ${gm.W} ${gm.H}`);
  clear(svg);
  const P = (lat, lon) => { const p = projectR(lat, lon, c); return { x: gm.cx + p.x * gm.r, y: gm.cy - p.y * gm.r, vis: p.vis }; };
  const line = (pts, attrs, parent) => {
    const d = pts.filter(p => p.vis).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
    if (d) el('path', { d, fill: 'none', ...attrs }, parent);
  };
  const g = el('g', { opacity: cur.fade }, svg);
  el('circle', { cx: gm.cx, cy: gm.cy, r: gm.r, fill: 'none', stroke: '#fff', 'stroke-opacity': .4 }, svg);
  const faint = { stroke: '#fff', 'stroke-opacity': .25 };
  line(Array.from({ length: 61 }, (_, i) => P(0, -90 + i * 3)), faint, g);
  line(Array.from({ length: 61 }, (_, i) => P(-90 + i * 3, 0)), faint, g);
  if (m) {
    // the Sun on a thin "monthly orbit" ring: the Moon's equator plane (the Sun stays within 1.5 deg of it),
    // seen tilted so the ring reads as an orbit. Front half = Sun behind the viewer (full Moon, ○),
    // back half hidden by the disc = Sun behind the Moon (new Moon, ●). Moves ~0.5 deg per hour.
    const rr = Math.min(gm.r + 10, Math.min(gm.W, gm.H) / 2 - 6) / gm.r;
    const tc = { lat: Math.max(-90, Math.min(90, c.lat + (c.lat < -45 ? 35 : 25))), lon: c.lon, roll: c.roll };
    const R3 = (lat, lon) => { const p = projectR(lat, lon, tc); return { x: gm.cx + p.x * rr * gm.r, y: gm.cy - p.y * rr * gm.r, vis: p.vis }; };
    const hidden = q => !q.vis && Math.hypot(q.x - gm.cx, q.y - gm.cy) < gm.r + 1;
    const ring = Array.from({ length: 145 }, (_, i) => R3(0, i * 2.5));
    let dpath = '', pen = false;
    for (const q of ring) { if (hidden(q)) { pen = false; continue; } dpath += `${pen ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`; pen = true; }
    el('path', { d: dpath, fill: 'none', stroke: 'var(--sun)', 'stroke-opacity': .35, 'stroke-width': 1 }, g);
    // full (Sun toward Earth) and new (Sun away from Earth) points of the cycle
    for (const [lon, full] of [[m.lon0, true], [m.lon0 + 180, false]]) {
      const q = R3(0, lon);
      if (hidden(q)) continue;
      el('circle', { cx: q.x, cy: q.y, r: 3, fill: full ? '#fff' : '#0f131b', stroke: '#fff', 'stroke-width': 1, 'stroke-opacity': .7, 'fill-opacity': full ? .7 : 1 }, g);
    }
    const sq = R3(Math.asin(m.sun[2]) / D2R, Math.atan2(m.sun[1], m.sun[0]) / D2R);
    if (hidden(sq)) el('circle', { cx: sq.x, cy: sq.y, r: 4, fill: 'none', stroke: 'var(--sun)', 'stroke-opacity': .6, 'stroke-dasharray': '2 2' }, g);
    else el('circle', { cx: sq.x, cy: sq.y, r: 4, fill: 'var(--sun)' }, g);
    // Earth too, once the view has turned away from it
    const ep = projectR(m.lat0, m.lon0, c), en = Math.hypot(ep.x, ep.y);
    if (en > 0.05 || !ep.vis) {
      const er = Math.min(gm.r + 9, Math.min(gm.W, gm.H) / 2 - 8);
      el('circle', { cx: gm.cx + ep.x / (en || 1) * er, cy: gm.cy - ep.y / (en || 1) * er, r: 4, fill: 'var(--earth)', 'fill-opacity': ep.vis ? 1 : .5 }, g);
    }
  }

  // the map's +-200 km square as a cap outline
  const cap = [];
  const inv = (x, y) => { const rho = Math.hypot(x, y); return P(-90 + 2 * Math.atan(rho / (2 * R_MOON)) / D2R, Math.atan2(x, y) / D2R); };
  for (let i = 0; i < 8; i++) cap.push(inv(-CAP_KM + i * CAP_KM / 4, CAP_KM));
  for (let i = 0; i < 8; i++) cap.push(inv(CAP_KM, CAP_KM - i * CAP_KM / 4));
  for (let i = 0; i < 8; i++) cap.push(inv(CAP_KM - i * CAP_KM / 4, -CAP_KM));
  for (let i = 0; i < 8; i++) cap.push(inv(-CAP_KM, -CAP_KM + i * CAP_KM / 4));
  cap.push(cap[0]);
  line(cap, { stroke: '#fff', 'stroke-width': 1.5 }, g);
  line(cap.map(p => ({ ...p, vis: !p.vis })), { stroke: '#fff', 'stroke-width': 1, 'stroke-dasharray': '2 2', 'stroke-opacity': .6 }, g);

  // sites
  const mode = d.index.modes[st.mission].sites, lim = limitsOf(st);
  const marked = new Set(st.view === 'compare' ? (d.compared || [st.site]) : [st.site, ...st.pinned]);
  for (const s of d.index.sites) {
    const p = P(s.lat, s.lon);
    if (!p.vis && s.id !== st.site) continue;
    if (s.id === st.site) {
      if (!p.vis) { el('circle', { cx: p.x, cy: p.y, r: 6, fill: 'none', stroke: '#fff', 'stroke-width': 1, 'stroke-dasharray': '2 2' }, g); continue; }
      const k = status(mode[s.id], st.day, st.mast, lim).kind;
      el('circle', { cx: p.x, cy: p.y, r: 6, fill: 'none', stroke: '#fff', 'stroke-width': 1 }, g);
      el('circle', { cx: p.x, cy: p.y, r: 2.5, fill: k === 'none' ? 'none' : `var(--${k})`, stroke: '#fff', 'stroke-width': 1 }, g);
    } else {
      el('circle', { cx: p.x, cy: p.y, r: 1, fill: '#fff', 'fill-opacity': .6 }, g);
      if (marked.has(s.id)) el('circle', { cx: p.x, cy: p.y, r: 6, fill: 'none', stroke: '#fff', 'stroke-width': 1 }, g);
    }
    if (ui.hover === s.id) el('circle', { cx: p.x, cy: p.y, r: 6, fill: 'none', stroke: 'var(--box)', 'stroke-width': 1.5 }, g);
  }
}
