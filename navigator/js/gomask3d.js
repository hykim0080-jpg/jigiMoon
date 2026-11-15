// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Detail 3D: where on the whole map a stay starting on the chosen day is GO (Earth >= 50 %, dark <= 50 h, slope <= 8 deg;
// Sun >= 70 % for the precomputed basis, or 90 %, the default), from per-cell GO calendars: layers/data/ok14_* (14 d, 70 %,
// the one Find a site uses), ok14s90_* and ok6s90_* (build_ok.py, hourly, same test as layers/js/winworker.js).
// A cell that fails from the ground but passes with a 10 m / 20 m mast within the Max mast limit is GO too (현기 11-16):
// <set>_m10_* / <set>_m20_* (build_ok.py with horizon_m10 / horizon_m20). Also used by Find a site (layers/js).
// Returned as an 800 x 800 canvas (row 0 = Earth side), red = GO, for map3d setMask().
const N = 800, SETS = {}, URL0 = new URL('../layers/data/', import.meta.url).href, slopeP = fetch(URL0 + 'slope.wasm').then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
const DATA = {};
let cv = null, lastKey = '', arr = null;
export const goArr = () => arr;   // 1 = GO, for the cells of the last mask
// which calendar covers these criteria and stay (null: none, the map shows no GO ground)
export function setOf(mission, c) {
  if (c.earth !== 50 || c.dark !== 50) return null;
  if (c.sun === 70) return mission === 14 ? 'ok14' : null;
  if (c.sun === 90) return mission === 14 ? 'ok14s90' : mission === 6 ? 'ok6s90' : null;
  return null;
}
export function load(set = 'ok14') {
  return SETS[set] || (SETS[set] = Promise.all([...['_idx.wasm', '_bits.wasm'].map(f => fetch(URL0 + set + f).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)), slopeP])
    .then(([ib, bb, sb]) => {
      if (!ib || !bb || !sb) return null;
      const idx = new Uint32Array(ib), bits = new Uint8Array(bb), slope = new Uint8Array(sb);
      if (bits.length !== idx.length * 46 || slope.length !== N * N) return null;
      return (DATA[set] = { idx, bits, slope });
    }));
}
// the mast sets a Max mast limit allows, lowest first
export const MASTS = [10, 20];
export const mastsUpTo = lim => MASTS.filter(h => h <= lim);
export const loadAll = (set, lim = 0) => Promise.all([load(set), ...mastsUpTo(lim).map(h => load(`${set}_m${h}`))]);
const bitOf = (D, i, day) => { let lo = 0, hi = D.idx.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1, v = D.idx[m]; if (v === i) return (D.bits[m * 46 + (day >> 3)] >> (7 - (day & 7))) & 1; if (v < i) lo = m + 1; else hi = m - 1; } return 0; };
// the lowest mast (m) that makes cell i GO on that day, 0 = GO from the ground or not GO with any mast allowed
export function mastAt(i, day, set, lim) {
  if (!set || !DATA[set] || bitOf(DATA[set], i, day)) return 0;
  for (const h of mastsUpTo(lim)) { const D = DATA[`${set}_m${h}`]; if (D && bitOf(D, i, day)) return h; }
  return 0;
}
// per cell for a day: 0 = not GO with any allowed mast, else the lowest mast height (m) that is GO (whatever the ground)
const mastCache = { key: '', a: null };
export function mastArr(day, set, lim) {
  const hs = mastsUpTo(lim).filter(h => DATA[`${set}_m${h}`]); if (!set || !hs.length) return null;
  const key = `${set}|${day}|${hs}`; if (mastCache.key === key) return mastCache.a;
  const a = new Uint8Array(N * N), byte = day >> 3, bit = 7 - (day & 7);
  for (const h of hs.slice().reverse()) {   // 20 m first, then 10 m overwrites: the lowest wins
    const D = DATA[`${set}_m${h}`];
    for (let k = 0; k < D.idx.length; k++) if ((D.bits[k * 46 + byte] >> bit) & 1) a[D.idx[k]] = h;
  }
  mastCache.key = key; mastCache.a = a;
  return a;
}
export function maskFor(day, set = 'ok14', lim = 0) {
  const D = DATA[set]; if (!D) return null;
  const key = set + day + '|' + lim;
  if (cv && key === lastKey) return cv;
  if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = N; }
  const g = cv.getContext('2d'), im = g.createImageData(N, N), px = im.data, byte = day >> 3, bit = 7 - (day & 7);
  arr = new Uint8Array(N * N);
  for (let k = 0; k < D.idx.length; k++) {
    const i = D.idx[k];
    if (((D.bits[k * 46 + byte] >> bit) & 1) && D.slope[i] <= 50) { px[i * 4] = 255; px[i * 4 + 3] = 255; arr[i] = 1; }   // slope byte 50 = 8 deg
  }
  const ma = mastArr(day, set, lim);   // GO with a mast within the limit
  if (ma) for (let i = 0; i < N * N; i++) if (ma[i] && !arr[i] && D.slope[i] <= 50) { px[i * 4] = 255; px[i * 4 + 3] = 255; arr[i] = 1; }
  g.putImageData(im, 0, 0); lastKey = key;
  return cv;
}
