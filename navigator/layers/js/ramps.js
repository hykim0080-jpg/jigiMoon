// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { RAMPS, DISCRETE, ZERO_TRANSPARENT, hue } from './config.js';
export const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export function colorAt(stops, t) {
  const f = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), u = f - i;
  const a = hex(stops[i]), b = hex(stops[i + 1]);
  return a.map((c, k) => Math.round(c + (b[k] - c) * u));
}
export function layerColor(id, onDark) {
  const d = DISCRETE[hue(id)];
  if (d) return onDark ? d.dark : d.light;
  return (RAMPS[hue(id)] || RAMPS.other)[onDark ? 3 : 2];
}
// colour at a decoded value for discrete layers: [r,g,b]|null
export function discreteAt(id, val) {
  const d = DISCRETE[hue(id)];
  for (const [ub, c] of d.steps) if (val <= ub + 1e-9) return c ? hex(c) : null;
  return null;
}
export function buildRampLUT(meta) {
  const r = new Uint8Array(256), g = new Uint8Array(256), b = new Uint8Array(256), a = new Uint8Array(256);
  const h = hue(meta.id), stops = RAMPS[h] || RAMPS.other, disc = DISCRETE[h];
  for (let v = 0; v <= 250; v++) {
    const val = meta.min + v * (meta.max - meta.min) / 250;
    let c;
    if (disc) c = discreteAt(meta.id, val);
    else if (ZERO_TRANSPARENT.includes(h) && v === 0) c = null;
    else c = colorAt(stops, v / 250);
    if (c) { r[v] = c[0]; g[v] = c[1]; b[v] = c[2]; a[v] = 255; }
  }
  return { r, g, b, a };
}
export function rampCss(meta) {
  const h = hue(meta.id), disc = DISCRETE[h];
  if (!disc) return 'linear-gradient(to right,' + (RAMPS[h] || RAMPS.other).map((c, i, s) => `${c} ${i * 100 / (s.length - 1)}%`).join(',') + ')';
  const parts = []; let prev = null;
  for (let v = 0; v <= 250; v++) {
    const val = meta.min + v * (meta.max - meta.min) / 250, c = discreteAt(meta.id, val);
    const css = c ? `rgb(${c})` : 'var(--none)';
    if (css !== prev) { parts.push(`${css} ${v * 100 / 250}%`); if (prev) parts.splice(parts.length - 1, 0, `${prev} ${v * 100 / 250}%`); prev = css; }
  }
  parts.push(`${prev} 100%`);
  return 'linear-gradient(to right,' + parts.join(',') + ')';
}
