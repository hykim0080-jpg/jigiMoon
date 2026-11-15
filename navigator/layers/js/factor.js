// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// One factor on the map: clicking Sun / Earth / Dark / Slope / Ice in the criteria colours the ground by that factor's
// value as a gradient (brighter = better), dims the ground that misses its limit a little, and draws the limit as a line. The
// slider track of that row carries the same gradient, so the track is the legend. Sun / Earth / dark are the values over
// the stay from the chosen day (the trip window, js/window.js); slope and ice are fixed layers.
import { N } from './config.js';
import { colorAt } from './ramps.js';
import { valueOf } from './data.js';
import { winVals } from './window.js';

// lo..hi = the slider's value range (the track maps value linearly, the colour runs along it)
export const FX = {
  sun:   { lo: 0, hi: 100, dir: '>=', ramp: ['#2b1a04', '#6e4200', '#b96f00', '#f0a531', '#ffe7a6'] },
  earth: { lo: 0, hi: 100, dir: '>=', ramp: ['#0b1833', '#173873', '#2459b8', '#74a2f2', '#dce8ff'] },
  dark:  { lo: 0, hi: 150, dir: '<=', ramp: ['#1b1430', '#3b2a6b', '#6a4fb0', '#a58ce6', '#e6dcff'] },
  slope: { lo: 0, hi: 20, dir: '<=', ramp: ['#1a2206', '#44580f', '#7c9a1e', '#b7d353', '#eef7c4'] },
  ice:   { lo: 0, hi: 25, dir: '<=', ramp: ['#0b2a3a', '#0f4f6b', '#2386ad', '#5cc6ec', '#d6f3ff'] },
};
const NPX = N * N;
let D = null;
export const initFactor = data => { D = data; };
const metaOf = id => D.layers.find(m => m.id === id);

// continuous colour along the slider's value range (t = 0 at lo .. 1 at hi), brighter = better
const colorT = (k, t) => { const f = FX[k], g = f.dir === '<=' ? 1 - t : t; return colorAt(f.ramp, .12 + .88 * g); };
const tOf = (k, v) => { const f = FX[k]; return Math.max(0, Math.min(1, (v - f.lo) / (f.hi - f.lo))); };

// the limit of factor k now (null = no limit, e.g. ice switched off)
export function limitOf(st, k) {
  if (k === 'sun' || k === 'earth' || k === 'dark') return st.crit[k];
  const id = k === 'ice' ? 'ice' : 'slope';
  if (k === 'ice' && !st.on.mask.ice) return null;
  return st.threshold[id] ?? null;
}
// same test as the judged map (window.js winPass: sun / Earth above, dark below the limit; slope / ice at or below)
const passes = (k, v, thr) => k === 'sun' || k === 'earth' ? v > thr : k === 'dark' ? v < thr : v <= thr + 1e-9;

// per-pixel values of factor k (NaN = no data), or null while the stay is still being worked out
let vCache = { key: '', v: null };
function valuesOf(st, k) {
  if (k === 'sun' || k === 'earth' || k === 'dark') {
    const w = winVals(st); if (!w) return null;
    const key = `${k}|${st.tDay}|${st.mission}|${w.id}`; if (vCache.key === key) return vCache.v;
    const a = w[k], v = new Float32Array(NPX), s = k === 'dark' ? 1 : .5;
    for (let i = 0; i < NPX; i++) v[i] = a[i] * s;
    vCache = { key, v }; return v;
  }
  const id = k === 'ice' ? 'ice' : 'slope', b = D.bytes[id]; if (!b) return null;
  const key = `${k}|${b.length}|${id}`; if (vCache.key === key) return vCache.v;
  const m = metaOf(id), v = new Float32Array(NPX);
  for (let i = 0; i < NPX; i++) { const x = valueOf(m, b[i]); v[i] = x == null || !isFinite(x) ? NaN : x; }
  vCache = { key, v }; return v;
}

// 800 x 800 RGBA: rgb = band colour, a = 255 meets the limit (or no limit), 128 misses it, 0 no data
let cv = null, out = { key: '', cv: null, rgba: null };
export function fxImage(st) {
  const k = st.factor; if (!k || !FX[k] || !D) return null;
  const v = valuesOf(st, k); if (!v) return null;
  const thr = limitOf(st, k), key = `${k}|${thr}|${vCache.key}`;
  if (out.key === key) return out;
  if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = N; }
  const g = cv.getContext('2d'), im = g.createImageData(N, N), d = im.data, f = FX[k];
  const lut = Array.from({ length: 256 }, (_, j) => colorT(k, j / 255));
  for (let i = 0; i < NPX; i++) {
    const x = v[i]; if (x !== x) continue;
    const c = lut[Math.round(tOf(k, x) * 255)], o = i * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = thr == null || passes(k, x, thr) ? 255 : 128;
  }
  g.putImageData(im, 0, 0);
  out = { key, cv, rgba: d };
  return out;
}

// the slider track of factor k: the same gradient, the side that misses the limit dimmed
export function trackCss(st, k) {
  const f = FX[k], parts = [];
  for (let j = 0; j <= 20; j++) parts.push(`rgb(${colorT(k, j / 20)}) ${j * 5}%`);
  const thr = limitOf(st, k), bands = `linear-gradient(to right,${parts.join(',')})`;
  if (thr == null) return bands;
  const p = Math.max(0, Math.min(100, (thr - f.lo) / (f.hi - f.lo) * 100)).toFixed(1), dim = 'rgba(12,15,22,.5)';
  return (f.dir === '>=' ? `linear-gradient(to right,${dim} ${p}%,transparent ${p}%),` : `linear-gradient(to right,transparent ${p}%,${dim} ${p}%),`) + bands;
}
