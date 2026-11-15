// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Time axis of mode B: day/hour scrubber, shadow overlay on the map, sky panorama data for the pin.
// Imported from mode A (read-only, no import side effects): ../../js/shadow.js (load, paint, pixelOf, pixelXY, horizonValues), ../../js/sky.js (drawSky).
// Copied (navigator/js/pin.js): bodyDir, latLon, bodies, series — only the hourly Sun/Earth vectors and per-point az/el/visibility.
import * as shadow from '../../js/shadow.js';
import { drawSky } from '../../js/sky.js';
import { syncEarth, earthCanvas } from './earthshadow.js';
import { state, setState } from './state.js';
import { MONTH_NAMES, lang, t } from './strings.js';

const D2R = Math.PI / 180, R_MOON = 1737400, T0 = Date.UTC(2027, 0, 1), SKY_URL = new URL('../../data/sky/malapert-massif.json', import.meta.url);
let B = null, loading = null, cv = null, painted = '', bar = {}, skies = new Map();

const bodyDir = (lat, lon, az, el) => {   // copy of navigator/js/pin.js
  const p = lat * D2R, l = lon * D2R, a = az * D2R, e = el * D2R;
  const up = [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)], east = [-Math.sin(l), Math.cos(l), 0];
  const north = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)];
  return [0, 1, 2].map(k => Math.cos(e) * (Math.cos(a) * north[k] + Math.sin(a) * east[k]) + Math.sin(e) * up[k]);
};
const latLon = (x, y) => ({ lat: (-Math.PI / 2 + 2 * Math.atan(Math.hypot(x, y) / (2 * R_MOON))) / D2R, lon: Math.atan2(x, y) / D2R });
async function bodies() {   // copy of navigator/js/pin.js bodies(): moon-fixed hourly Sun/Earth vectors from one site's series
  const r = await (await fetch(SKY_URL)).json(), s = latLon(-7290, 122530), n = r.hours;
  const S = new Float32Array(n * 3), E = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { S.set(bodyDir(s.lat, s.lon, r.sun_az[i], r.sun_el[i]), i * 3); E.set(bodyDir(s.lat, s.lon, r.earth_az[i], r.earth_el[i]), i * 3); }
  return { S, E, n };
}
function series(x, y, h720, Bd) {   // copy of navigator/js/pin.js series()
  const { lat, lon } = latLon(x, y), p = lat * D2R, l = lon * D2R;
  const up = [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)], east = [-Math.sin(l), Math.cos(l), 0];
  const north = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)];
  const frac = new Float32Array(Bd.n), vis = new Uint8Array(Bd.n), az = new Float32Array(Bd.n * 2), el = new Float32Array(Bd.n * 2);
  const dot = (V, i, u) => V[i * 3] * u[0] + V[i * 3 + 1] * u[1] + V[i * 3 + 2] * u[2];
  for (let i = 0; i < Bd.n; i++) for (let b = 0; b < 2; b++) {
    const V = b ? Bd.E : Bd.S, e = Math.asin(Math.max(-1, Math.min(1, dot(V, i, up)))) / D2R, a = (Math.atan2(dot(V, i, east), dot(V, i, north)) / D2R + 360) % 360;
    az[i * 2 + b] = a; el[i * 2 + b] = e;
    const h = h720[Math.round(a / 0.5) % 720];
    if (b === 0) frac[i] = Math.max(0, Math.min(1, (e - h) / 0.53 + 0.5)); else vis[i] = e > h ? 1 : 0;
  }
  return { frac, vis, az, el };
}
export const bodiesData = () => B;
export const prefetchMasts = () => shadow.loadExtra();
// the 64 horizon values (deg) of a cell for a mast height, for the stats worker (null if that set is missing)
export async function horizonOf(col, row, mast) {
  await ensure();
  const buf = mast === 2 ? undefined : (await shadow.loadExtra()).sets[mast]; if (mast !== 2 && !buf) return null;
  const [x, y] = shadow.pixelXY(col, row); return { x, y, vals: Float64Array.from(shadow.horizonValues(x, y, buf)) };
}   // hourly Sun/Earth vectors (S, E, n) for the window worker
export const ensure = () => loading || (loading = Promise.all([shadow.load(), bodies()]).then(([, b]) => { B = b; }));

// sky object of mode A (see navigator/js/data.js loadSky) for a pixel
export async function skyAt(col, row, mast = 2) {
  await ensure();
  const i = mast === 2 ? row * 800 + col : `${row * 800 + col}|${mast}`; if (skies.has(i)) return skies.get(i);
  const buf = mast === 2 ? undefined : (await shadow.loadExtra()).sets[mast]; if (mast !== 2 && !buf) return null;   // 10 m / 20 m mast horizons
  const [x, y] = shadow.pixelXY(col, row), vals = shadow.horizonValues(x, y, buf), lon = Math.atan2(x, y) / D2R;
  const h720 = new Float32Array(720);
  for (let a = 0; a < 720; a++) {   // = shadow.profile(): map azimuth = local + lon, linear between the 64 bins
    const m = ((a * 0.5 + lon) % 360 + 360) % 360 / 5.625, k = Math.floor(m), f = m - k;
    h720[a] = vals[k % 64] + (vals[(k + 1) % 64] - vals[k % 64]) * f;
  }
  const o = series(x, y, h720, B), n = B.n, pick = (arr, b) => Array.from({ length: n }, (_, j) => arr[j * 2 + b]);
  let sx = 0, sy = 0; for (let j = 0; j < n; j += 6) { const a = o.az[j * 2 + 1] * D2R; sx += Math.sin(a); sy += Math.cos(a); }
  const sky = { horizon: Array.from(h720), azStep: 0.5, hours: n, center: (Math.atan2(sx, sy) / D2R + 360) % 360, sunAz: pick(o.az, 0), sunEl: pick(o.el, 0), sunFrac: o.frac, sunVis: Array.from(o.frac, f => f > 0), earthAz: pick(o.az, 1), earthEl: pick(o.el, 1), earthVis: o.vis };
  skies.set(i, sky); return sky;
}
// per landing day GO of a 14-day mission from a point's hourly series: sun% >= cs, Earth% >= ce, longest dark (frac < 0.1) <= cd h
export function calendarFrom(sky, crit, mission = 14) {
  const n = mission * 24, go = new Uint8Array(365), cs = new Float64Array(sky.hours + 1), ce = new Float64Array(sky.hours + 1); let count = 0;
  for (let i = 0; i < sky.hours; i++) { cs[i + 1] = cs[i] + sky.sunFrac[i]; ce[i + 1] = ce[i] + sky.earthVis[i]; }
  for (let d = 0; d < 365; d++) {
    const a = d * 24, b = Math.min(sky.hours, a + n), w = b - a;
    if ((cs[b] - cs[a]) / w * 100 < crit.sun - 1e-9 || (ce[b] - ce[a]) / w * 100 < crit.earth - 1e-9) continue;
    let run = 0, dark = 0;
    for (let i = a; i < b; i++) { run = sky.sunFrac[i] < 0.1 ? run + 1 : 0; if (run > dark) dark = run; }
    if (dark <= crit.dark) { go[d] = 1; count++; }
  }
  return { go, count };
}
export const skyCached = (col, row) => skies.has(row * 800 + col);
export const skyGet = (col, row) => skies.get(row * 800 + col) || null;
export function drawPinSky(svg, st) {
  if (!state.pin || !svg) return;
  const sky = skies.get(state.pin.row * 800 + state.pin.col);
  if (sky) drawSky(svg, { sky }, { day: st.tDay, hour: st.tHour, mission: st.mission || 14 }, { compact: true, w: svg.clientWidth, h: svg.clientHeight });
  const strip = svg.parentNode && svg.parentNode.querySelector('.lyr-dstrip');
  if (sky && strip) darkStrip(strip, sky, st);
}
// under the sky: sunlight over the stay, and the longest stretch without it bracketed with its hours ("⟷ 74 h", red
// over the Dark limit), so Dark reads as one unbroken stretch, not the total
function darkStrip(svg, sky, st) {
  const NS = 'http://www.w3.org/2000/svg', mk = (tag, a, p = svg) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
  const w = svg.clientWidth || 280, n = (st.mission || 14) * 24, a = st.tDay * 24, x0 = 4, x1 = w - 4, cw = (x1 - x0) / n, H = 30;
  svg.setAttribute('viewBox', `0 0 ${w} ${H}`); svg.textContent = '';
  let best = { s: 0, len: 0 }, run = 0;
  for (let j = 0; j < n; j++) {
    const f = sky.sunFrac[a + j] || 0;
    if (f > 0) mk('rect', { x: x0 + j * cw, y: 2, width: cw + .3, height: 8, fill: '#f0a531', 'fill-opacity': f });
    run = f < 0.1 ? run + 1 : 0; if (run > best.len) best = { s: j - run + 1, len: run };
  }
  mk('rect', { x: x0, y: 2, width: x1 - x0, height: 8, fill: 'none', stroke: '#2b3242' });
  if (!best.len) return;
  const bx0 = x0 + best.s * cw, bx1 = x0 + (best.s + best.len) * cw, c = best.len > ((st.crit && st.crit.dark) || 50) ? '#ff6b5e' : '#a3abbb';
  const tip = lang === 'ko' ? '햇빛이 한 번에 가장 오래 끊긴 시간' : 'Longest stretch without sunlight';
  const g = mk('g', {}); mk('title', {}, g).textContent = tip;
  mk('path', { d: `M${bx0},${11}V${14}H${bx1}V${11}`, fill: 'none', stroke: c }, g);
  const tx = mk('text', { x: Math.min(Math.max((bx0 + bx1) / 2, 24), w - 24), y: 26, 'text-anchor': 'middle', style: `fill:${c};font:600 11px Roboto,system-ui,sans-serif` }, g); tx.textContent = `⟷ ${best.len} h`;
}

// ---- shadow overlay ----
export const shadowCanvas = () => state.expo ? (expoOk ? expoCv : null) : state.eshadow ? (B ? earthCanvas() : null) : state.shadow && painted ? cv : null;
// ---- long exposure (as mode A): Sun-disc share over the 14-day window from the selected day, 3 h steps ----
let expoCv = null, expoOk = false, expoKey = null, expoTimer = 0, expoData = null, slopeBytes = null; export let expoTop = [];
export function syncExpo(st) {
  if (!st.expo) { clearTimeout(expoTimer); bar.expo && bar.expo.classList.remove('busy'); return; }
  if (st.tDay + '|' + st.mission === expoKey) return;
  clearTimeout(expoTimer); bar.expo.classList.add('busy');
  expoTimer = setTimeout(async () => {
    await ensure(); const day = state.tDay;
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 20)));   // let the busy state paint before the 2.5 s job
    const list = []; for (let h = 0; h < (state.mission || 14) * 24; h += 3) { const o = Math.min(B.n - 1, day * 24 + h) * 3; list.push(B.S.subarray(o, o + 3)); }
    const ex = shadow.exposure(list); expoCv = expoCv || document.createElement('canvas'); shadow.paintExposure(expoCv, ex);
    expoTop = slopeBytes ? shadow.brightest(ex, slopeBytes, 5, 10, state.threshold.slope ?? 8) : [];
    expoOk = true; expoKey = day + '|' + state.mission; bar.expo.classList.remove('busy');
    setState({}, state.tDay === day ? 'view' : 'time');
  }, 150);
}
export function syncShadow() {
  if (!state.shadow && !state.eshadow) return;
  if (!B) { ensure().then(() => setState({}, 'time')); return; }
  if (state.eshadow) { syncEarth(state, B); return; }
  const key = state.tDay * 24 + state.tHour; if (painted === key) return;
  cv = cv || document.createElement('canvas');
  const o = key * 3;
  if (shadow.paint(cv, B.S.subarray(o, o + 3))) painted = key;
}
export const forcePaint = () => { painted = ''; };

// ---- scrubber ----
export const dateText = d => { const dt = new Date(T0 + d * 864e5); return lang === 'ko' ? `${dt.getUTCMonth() + 1}월 ${dt.getUTCDate()}일` : `${MONTH_NAMES[dt.getUTCMonth()]} ${dt.getUTCDate()}`; };
export const doyOfMonth = m => (Date.UTC(2027, m, 1) - T0) / 864e5;
export function initTime(panel, d) {
  slopeBytes = d && d.bytes.slope;
  const el = document.createElement('div'); el.className = 'lyr-time';
  el.innerHTML = `<button class="lyr-sunb" aria-pressed="false" title="${t('shadow')}">☀</button><button class="lyr-sunb lyr-earthb" aria-pressed="false" title="${t('eshadow')}" aria-label="${t('eshadow')}">⊕</button><button class="lyr-expob" aria-pressed="false">${t('expo', 14)}</button><span class="lyr-sl">${t('landDay')}</span><span class="n lyr-td"></span><button class="lyr-plan n" hidden></button><input class="lyr-dsl" type="range" min="0" max="364" step="1" aria-label="${t('landDay')}"><button class="lyr-play" aria-pressed="false" aria-label="${t('play')}">▶</button><span class="lyr-sl">${t('stayHour')}</span><input class="lyr-hsl" type="range" min="0" max="335" step="1" aria-label="${t('stayHour')}"><span class="n lyr-th2"></span>`;
  panel.append(el);
  bar = { el, play: el.querySelector('.lyr-play'), sun: el.querySelector('.lyr-sunb'), earth: el.querySelector('.lyr-earthb'), expo: el.querySelector('.lyr-expob'), td: el.querySelector('.lyr-td'), d: el.querySelector('.lyr-dsl'), h: el.querySelector('.lyr-hsl'), th: el.querySelector('.lyr-th2'), plan: el.querySelector('.lyr-plan') };
  bar.plan.onclick = () => { if (state.plan != null) setState({ tDay: state.plan, tTouched: true }, 'time'); };
  for (const ev of ['pointerdown', 'dblclick', 'wheel', 'pointermove', 'pointerup']) el.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  bar.sun.onclick = () => { setState({ shadow: !state.shadow, expo: false, eshadow: false }, 'time'); };
  bar.expo.onclick = () => { setState({ expo: !state.expo, shadow: false, eshadow: false }, 'time'); };
  bar.earth.onclick = () => { setState({ eshadow: !state.eshadow, shadow: false, expo: false }, 'time'); };
  bar.d.oninput = () => setState({ tDay: +bar.d.value, tTouched: true }, 'time');
  bar.h.oninput = () => { stopPlay(); setState({ tHour: +bar.h.value, tTouched: true }, 'time'); };
  bar.play.onclick = () => playTimer ? stopPlay() : startPlay();
}
// play: the hours of the stay go by with the Sun shadow on (the landing day stays where it is)
let playTimer = 0;
function startPlay() {
  bar.play.setAttribute('aria-pressed', 'true'); bar.play.textContent = '❚❚';
  if (!state.shadow && !state.eshadow) setState({ shadow: true, expo: false }, 'time');
  playTimer = setInterval(() => { const n = (state.mission || 14) * 24; setState({ tHour: (state.tHour + 2) % n, tTouched: true }, 'time'); }, 120);
}
export function stopPlay() { clearInterval(playTimer); playTimer = 0; if (bar.play) { bar.play.setAttribute('aria-pressed', 'false'); bar.play.textContent = '▶'; } }
export function renderTime(st) {
  const open = !!(st.shadow || st.eshadow); bar.el.classList.toggle('open', open); bar.el.parentNode.classList.toggle('topen', open); bar.earth.setAttribute('aria-pressed', !!st.eshadow);
  bar.expo.setAttribute('aria-pressed', !!st.expo); bar.sun.setAttribute('aria-pressed', st.shadow); bar.d.value = st.tDay; bar.h.value = st.tHour;
  const n = (st.mission || 14) * 24; if (st.tHour >= n) { state.tHour = st.tHour % n; } bar.h.max = n - 1; bar.h.value = state.tHour;
  bar.td.textContent = dateText(st.tDay);
  { const dp = st.plan == null ? 0 : st.tDay - st.plan; bar.plan.hidden = !dp; bar.plan.classList.toggle('late', dp > 0); bar.plan.textContent = `${t('plan')} ${dp > 0 ? '+' : '−'}${Math.abs(dp)} d`; bar.plan.title = t('planBack'); } bar.expo.textContent = t('expo', st.mission || 14);
  bar.th.textContent = `${dateText(st.tDay + Math.floor(state.tHour / 24))} ${String(state.tHour % 24).padStart(2, '0')}:00`;   // where the scrubber is inside the stay
}
