// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Detail 3D: where on the whole map a stay starting on the chosen day is GO (Earth >= 50 %, dark <= 50 h, slope <= 8 deg;
// Sun >= 70 % for the precomputed basis, or 90 %, the default), from per-cell GO calendars: layers/data/ok14_* (14 d, 70 %,
// the one Find a site uses), ok14s90_* and ok6s90_* (build_ok.py, hourly, same test as layers/js/winworker.js).
// Returned as an 800 x 800 canvas (row 0 = Earth side), red = GO, for map3d setMask().
const N = 800, SETS = {}, slopeP = fetch('layers/data/slope.wasm').then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
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
  return SETS[set] || (SETS[set] = Promise.all([...['_idx.wasm', '_bits.wasm'].map(f => fetch('layers/data/' + set + f).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)), slopeP])
    .then(([ib, bb, sb]) => {
      if (!ib || !bb || !sb) return null;
      const idx = new Uint32Array(ib), bits = new Uint8Array(bb), slope = new Uint8Array(sb);
      if (bits.length !== idx.length * 46 || slope.length !== N * N) return null;
      return (DATA[set] = { idx, bits, slope });
    }));
}
export function maskFor(day, set = 'ok14') {
  const D = DATA[set]; if (!D) return null;
  const key = set + day;
  if (cv && key === lastKey) return cv;
  if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = N; }
  const g = cv.getContext('2d'), im = g.createImageData(N, N), px = im.data, byte = day >> 3, bit = 7 - (day & 7);
  arr = new Uint8Array(N * N);
  for (let k = 0; k < D.idx.length; k++) {
    const i = D.idx[k];
    if (((D.bits[k * 46 + byte] >> bit) & 1) && D.slope[i] <= 50) { px[i * 4] = 255; px[i * 4 + 3] = 255; arr[i] = 1; }   // slope byte 50 = 8 deg
  }
  g.putImageData(im, 0, 0); lastKey = key;
  return cv;
}
