// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { state } from './state.js';
import { el, clear } from './svg.js';
import { sitePos } from './map.js';
import { gridCenter } from './fixes.js';

// two lines from the selected site on the map into the MOVE grid
export function render() {
  const svg = document.getElementById('chain');
  clear(svg);
  if (state.view !== 'focus') return;
  const host = svg.getBoundingClientRect(), p = sitePos(state.site), g = gridCenter();
  if (!g.r) return;
  const sx = p.x - host.left, sy = p.y - host.top, gx = g.x - host.left, gy = g.y - host.top, right = p.right - host.left;
  for (const dir of [-1, 1]) {
    const a = [sx, sy + dir * p.r], b = [gx, gy + dir * g.r];
    const f = Math.max(0, Math.min(1, (right - a[0]) / (b[0] - a[0]))), m = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    el('line', { x1: a[0], y1: a[1], x2: m[0], y2: m[1], stroke: '#fff', 'stroke-opacity': .7 }, svg);
    el('line', { x1: m[0], y1: m[1], x2: b[0], y2: b[1], stroke: 'var(--ink)', 'stroke-opacity': .45 }, svg);
  }
}
