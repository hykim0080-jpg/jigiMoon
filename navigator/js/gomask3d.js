// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Detail 3D: where on the whole map a 14-day stay starting on the chosen day is GO (default criteria Sun >= 70 %,
// Earth >= 50 %, dark <= 50 h, slope <= 8 deg), from the per-cell GO calendar Find a site uses (layers/data/ok14_*).
// Returned as an 800 x 800 canvas (row 0 = Earth side), red = GO, for map3d setMask().
const N = 800;
let D = null, loading = null, cv = null, lastDay = -1;
export function load() {
  return loading || (loading = Promise.all(['ok14_idx.wasm', 'ok14_bits.wasm', 'slope.wasm'].map(f => fetch('layers/data/' + f).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)))
    .then(([ib, bb, sb]) => {
      if (!ib || !bb || !sb) return null;
      const idx = new Uint32Array(ib), bits = new Uint8Array(bb), slope = new Uint8Array(sb);
      if (bits.length !== idx.length * 46 || slope.length !== N * N) return null;
      D = { idx, bits, slope }; return D;
    }));
}
export function maskFor(day) {
  if (!D) return null;
  if (cv && day === lastDay) return cv;
  if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = N; }
  const g = cv.getContext('2d'), im = g.createImageData(N, N), px = im.data, byte = day >> 3, bit = 7 - (day & 7);
  for (let k = 0; k < D.idx.length; k++) {
    const i = D.idx[k];
    if (((D.bits[k * 46 + byte] >> bit) & 1) && D.slope[i] <= 50) { px[i * 4] = 255; px[i * 4 + 3] = 255; }   // slope byte 50 = 8 deg
  }
  g.putImageData(im, 0, 0); lastDay = day;
  return cv;
}
