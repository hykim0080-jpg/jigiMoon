// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// What the clicked spot sees: Sun and Earth direction arrows, the ridge that hides them during the stay (red),
// a plain bubble with how long it hides them, and (switchable) the arrow to the nearest landing site that works.
// Uses the same 64-azimuth horizon masks as the Sun shadow (../../js/shadow.js).
import { N, PX } from './config.js';
import * as shadow from '../../js/shadow.js';
import { lang } from './strings.js';
import { setState } from './state.js';
import { skyAt } from './time.js';

export const SHOW_MOVE_ARROW = true;   // the "landing site 0.6 km this way" arrow; set false to switch it off

const D2R = Math.PI / 180, STEP = 500, MAX_KM = 80;
const TX = {
  en: { sun: 'Sun', earth: 'Earth', hidSun: p => `Sun is hidden behind this ridge ${p} % of the stay`, hidEarth: p => `Earth is hidden behind this ridge ${p} % of the stay`, move: km => `landing site ${km} km this way` },
  ko: { sun: '태양', earth: '지구', hidSun: p => `체류 기간의 ${p} % 동안 이 능선이 해를 가려요`, hidEarth: p => `체류 기간의 ${p} % 동안 이 능선이 지구를 가려요`, move: km => `이쪽으로 ${km} km 가면 착륙 가능` },
};
const tx = (k, ...a) => { const v = (TX[lang] || TX.en)[k]; return typeof v === 'function' ? v(...a) : v; };

const xyOf = (col, row) => shadow.pixelXY(col, row);
const lonOf = (x, y) => Math.atan2(x, y) / D2R;   // local azimuth + lon = map azimuth (clockwise from map up)
// 500 m elevation grid (data/elev500.png, LOLA LDEM 40 m averaged): the crest that sets the horizon toward A is the
// terrain point with the highest elevation angle seen from the spot (lander height 2 m, Moon curvature included)
let elev = null, elevLoading = null;
export function loadElev(onReady) {
  if (elev || elevLoading) return elevLoading;
  return elevLoading = (async () => {
    const img = new Image(); img.src = new URL('../data/elev500.png', import.meta.url).href; await img.decode();
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, N, N).data, z = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) z[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 4 - 8000;
    elev = z; onReady && onReady();
  })();
}
function zAt(x, y) {
  const fc = (x + 199750) / 500, fr = (199750 - y) / 500, c = Math.floor(fc), r = Math.floor(fr);
  if (c < 0 || r < 0 || c >= N - 1 || r >= N - 1) return null;
  const u = fc - c, v = fr - r, i = r * N + c;
  return elev[i] * (1 - u) * (1 - v) + elev[i + 1] * u * (1 - v) + elev[i + N] * (1 - u) * v + elev[i + N + 1] * u * v;
}
function crestAt(x, y, A) {
  if (!elev) return null;
  const sx = Math.sin(A * D2R), sy = Math.cos(A * D2R), z0 = zAt(x, y); if (z0 == null) return null;
  let best = null, bt = -Infinity;
  for (let r = STEP * 3; r <= MAX_KM * 1000; r += STEP / 2) {
    const z = zAt(x + sx * r, y + sy * r); if (z == null) break;
    const tn = (z - z0 - 2 - r * r / 3474800) / r;
    if (tn > bt) { bt = tn; best = r; }
  }
  return best;
}
// hours of the stay when a body is hidden, grouped by map azimuth; the biggest group and its share
function hiddenGroup(sky, a, b, lon, body) {
  const bins = new Float32Array(24);   // 15 deg bins
  let n = 0;
  for (let i = a; i < b; i++) {
    const hid = body === 'sun' ? sky.sunFrac[i] < 0.5 : !sky.earthVis[i];
    if (!hid) continue;
    const A = (((body === 'sun' ? sky.sunAz[i] : sky.earthAz[i]) + lon) % 360 + 360) % 360;
    bins[Math.floor(A / 15) % 24]++; n++;
  }
  if (!n) return null;
  let k = 0; for (let j = 1; j < 24; j++) if (bins[j] > bins[k]) k = j;
  let lo = k, hi = k;   // grow over neighbouring bins that are also hidden
  while (bins[(lo + 23) % 24] > 0 && (lo - 1 + 24) % 24 !== hi && hi - lo < 8) lo--;
  while (bins[(hi + 1) % 24] > 0 && (hi + 1) % 24 !== (lo + 24) % 24 && hi - lo < 8) hi++;
  let cnt = 0; for (let j = lo; j <= hi; j++) cnt += bins[(j + 24) % 24];
  // the azimuth range actually covered inside the group
  let amin = Infinity, amax = -Infinity;
  for (let i = a; i < b; i++) {
    const hid = body === 'sun' ? sky.sunFrac[i] < 0.5 : !sky.earthVis[i];
    if (!hid) continue;
    let A = (((body === 'sun' ? sky.sunAz[i] : sky.earthAz[i]) + lon) % 360 + 360) % 360;
    if (A < lo * 15 - 1e-6) A += 360; if (A > (hi + 1) * 15 + 1e-6) A -= 360;
    if (A < lo * 15 || A > (hi + 1) * 15) continue;
    amin = Math.min(amin, A); amax = Math.max(amax, A);
  }
  return { share: cnt / (b - a), a0: amin, a1: Math.max(amax, amin + 2) };
}

const cache = new Map();
let waitSky = '';
function ridgeOf(col, row, sky, day, mission, body) {
  const k = `${col},${row},${day},${mission},${body}`; if (cache.has(k)) return cache.get(k);
  if (cache.size > 60) cache.clear();
  const [x, y] = xyOf(col, row), lon = lonOf(x, y), a = day * 24, b = Math.min(sky.hours, a + mission * 24);
  const g = hiddenGroup(sky, a, b, lon, body); let out = null;
  if (g && g.share >= 0.05) {
    const raw = [];
    const n = Math.max(2, Math.min(24, Math.round((g.a1 - g.a0) / 2)));
    for (let j = 0; j <= n; j++) { const A = g.a0 + (g.a1 - g.a0) * j / n, r = crestAt(x, y, A); if (r) raw.push({ A, r }); }
    // one ridge: keep the crest points near the median distance
    const med = raw.map(p => p.r).sort((u, v) => u - v)[raw.length >> 1];
    const pts = raw.filter(p => Math.abs(p.r - med) <= 0.45 * med).map(p => ({ A: p.A, r: p.r, x: x + Math.sin(p.A * D2R) * p.r, y: y + Math.cos(p.A * D2R) * p.r }));
    if (pts.length) out = { share: g.share, pts, mid: pts[pts.length >> 1] };
  }
  cache.set(k, out); return out;
}

const textW = s => [...s].reduce((a, c) => a + (c.charCodeAt(0) > 0x2000 ? 11.5 : 6.3), 0);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// SVG for the overlay; toScr(colF, rowF) gives screen px; s = screen px per cell
export function sightSvg(st, pin, sky, toScr, s, move, W = 800) {
  if (!pin) return '';
  if (!elev) loadElev(() => { cache.clear(); setState({}, 'site'); });
  if (!sky) { const k = pin.col + ',' + pin.row; if (waitSky !== k) { waitSky = k; skyAt(pin.col, pin.row).then(() => setState({}, 'site')); } return ''; }
  if (!shadow.ready()) return '';
  const day = st.tDay, mission = st.mission || 14, [x, y] = xyOf(pin.col, pin.row), lon = lonOf(x, y);
  const ih = Math.max(0, Math.min(sky.hours - 1, day * 24 + Math.round(st.tHour || 0)));
  const [px, py] = toScr(pin.col + .5, pin.row + .5), cf = (mx, my) => toScr((mx + 200000) / PX, (200000 - my) / PX);
  let h = '<g class="sight">';
  const used = [];
  for (const body of ['sun', 'earth']) {
    const rg = ridgeOf(pin.col, pin.row, sky, day, mission, body); if (!rg) continue;
    const P = rg.pts.map(p => ({ ...p, s: cf(p.x, p.y) }));
    const segs = [];
    P.forEach((p, j) => { const q = P[j - 1]; if (q && Math.abs(p.A - q.A) < 4.5 && Math.max(p.r, q.r) / Math.min(p.r, q.r) < 1.35) segs[segs.length - 1].push(p); else segs.push([p]); });
    const d = segs.map(sg => sg.length > 1 ? 'M' + sg.map(p => p.s[0].toFixed(1) + ' ' + p.s[1].toFixed(1)).join('L')
      : (p => { const ux = Math.cos(p.A * D2R) * 4, uy = Math.sin(p.A * D2R) * 4; return `M${(p.s[0] - ux).toFixed(1)} ${(p.s[1] - uy).toFixed(1)}L${(p.s[0] + ux).toFixed(1)} ${(p.s[1] + uy).toFixed(1)}`; })(sg[0])).join('');
    h += `<path d="${d}" class="ridge0"/><path d="${d}" class="ridge"/>`;
    // bubble just beyond the ridge, away from the spot
    const m = cf(rg.mid.x, rg.mid.y), ux = Math.sin(rg.mid.A * D2R), uy = -Math.cos(rg.mid.A * D2R);
    const txt = tx(body === 'sun' ? 'hidSun' : 'hidEarth', Math.round(rg.share * 100)), w = textW(txt) + 14;
    const off = Math.max(14, 46 - Math.hypot(m[0] - px, m[1] - py));   // keep the bubble clear of the spot and its arrows
    let bx = m[0] + ux * off - (ux < -0.3 ? w : ux > 0.3 ? 0 : w / 2), by = m[1] + uy * off - (uy < -0.3 ? 18 : uy > 0.3 ? 0 : 9);
    bx = Math.max(4, Math.min(W - w - 4, bx)); by = Math.max(40, Math.min(W - 40, by));
    while (used.some(u => Math.abs(u[1] - by) < 20 && Math.abs(u[0] - bx) < Math.max(u[2], w))) by += uy < 0 ? -20 : 20;
    used.push([bx, by, w]);
    const line = `<line x1="${m[0].toFixed(1)}" y1="${m[1].toFixed(1)}" x2="${(bx + w / 2).toFixed(1)}" y2="${(by + 9).toFixed(1)}" class="lead"/>`;
    h += `${line}<g class="bub ${body}" transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})"><rect width="${w.toFixed(0)}" height="18"/><text x="7" y="12.5">${esc(txt)}</text></g>`;
  }
  // direction arrows at the scrubbed hour; dashed when the body is behind the terrain
  for (const body of ['sun', 'earth']) {
    const A = ((body === 'sun' ? sky.sunAz[ih] : sky.earthAz[ih]) + lon) * D2R, vis = body === 'sun' ? sky.sunFrac[ih] >= 0.5 : !!sky.earthVis[ih];
    const L = 58, ex = px + Math.sin(A) * L, ey = py - Math.cos(A) * L, hx = Math.sin(A), hy = -Math.cos(A);
    const head = `M${(ex + hx * 8).toFixed(1)} ${(ey + hy * 8).toFixed(1)}L${(ex - hy * 5).toFixed(1)} ${(ey + hx * 5).toFixed(1)}L${(ex + hy * 5).toFixed(1)} ${(ey - hx * 5).toFixed(1)}Z`;
    h += `<g class="dir ${body}${vis ? '' : ' hid'}"><line x1="${px}" y1="${py}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" class="sh"/><line x1="${px}" y1="${py}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"/><path d="${head}"/><text x="${(ex + hx * 18).toFixed(1)}" y="${(ey + hy * 18 + 4).toFixed(1)}" text-anchor="middle">${body === 'sun' ? '☀' : '⊕'}</text></g>`;
  }
  h += '</g>';
  if (SHOW_MOVE_ARROW && move) h += moveSvg(px, py, toScr(move.col + .5, move.row + .5), move.km);
  return h;
}
// switchable: arrow from the clicked spot to the nearest spot that works for the whole stay
function moveSvg(px, py, [nx, ny], km) {
  const dx = nx - px, dy = ny - py, d = Math.hypot(dx, dy); if (d < 4) return '';
  const ux = dx / d, uy = dy / d, ex = nx - ux * 4, ey = ny - uy * 4;
  const head = `M${nx.toFixed(1)} ${ny.toFixed(1)}L${(ex - ux * 7 - uy * 5).toFixed(1)} ${(ey - uy * 7 + ux * 5).toFixed(1)}L${(ex - ux * 7 + uy * 5).toFixed(1)} ${(ey - uy * 7 - ux * 5).toFixed(1)}Z`;
  const txt = tx('move', km < 10 ? km.toFixed(1) : Math.round(km)), lx = nx + (ux >= 0 ? 8 : -8), ly = ny + (uy >= 0 ? 16 : -8);
  return `<g class="movearr"><line x1="${px}" y1="${py}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" class="sh"/><line x1="${px}" y1="${py}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"/><path d="${head}"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${ux >= 0 ? 'start' : 'end'}">${esc(txt)}</text></g>`;
}
