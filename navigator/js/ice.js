// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Water ice as a preference: distance from a point to the nearest permanently shadowed cell (PSR layer of Find a site,
// 500 m grid). A PSR may hold ice; it is not proven. Loaded once, on first use.
const N = 800, RES = 500, X0 = -199750, Y1 = 199750;
let cells = null, loading = null;
export function loadIce() {
  if (loading) return loading;
  loading = fetch('layers/data/psr.wasm').then(r => r.ok ? r.arrayBuffer() : null).then(b => {
    if (!b) return;
    const a = new Uint8Array(b), xs = [], ys = [];
    for (let i = 0; i < a.length; i++) if (a[i] >= 125 && a[i] <= 250) { xs.push(X0 + (i % N) * RES); ys.push(Y1 - Math.floor(i / N) * RES); }
    cells = { xs: Float64Array.from(xs), ys: Float64Array.from(ys) };
  }).catch(() => {});
  return loading;
}
const memo = new Map();
// km to the nearest PSR cell, or null while loading / no data
export function iceKm(x, y) {
  if (!cells) return null;
  const k = `${Math.round(x)},${Math.round(y)}`;
  if (memo.has(k)) return memo.get(k);
  let best = Infinity;
  const { xs, ys } = cells;
  for (let i = 0; i < xs.length; i++) { const dx = xs[i] - x, dy = ys[i] - y, d = dx * dx + dy * dy; if (d < best) best = d; }
  const v = Math.sqrt(best) / 1000; memo.set(k, v); return v;
}
