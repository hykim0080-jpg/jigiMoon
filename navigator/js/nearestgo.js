// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Nearest GO ground for a NO-GO spot: one breadth-first pass from every GO cell of the current mask (800 x 800, 500 m)
// gives each cell its nearest GO cell; the card then says "Nearest GO: #2 on Mons Malapert, 1.8 km ↗" and the 3D map
// draws a thin line to it. Used by Find a site (layers/js/find3d.js) and Detail (js/hover3d.js).
const N = 800;
const ARROW = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];   // up = Earth side (row 0)

// isGo(i) -> true for GO cells; returns, per cell, the index of a nearest GO cell (-1 when there is none)
export function nearestField(isGo) {
  const src = new Int32Array(N * N).fill(-1), q = new Int32Array(N * N);
  let h = 0, t = 0;
  for (let i = 0; i < N * N; i++) if (isGo(i)) { src[i] = i; q[t++] = i; }
  if (!t) return null;
  while (h < t) {
    const i = q[h++], c = i % N, r = (i - c) / N, s = src[i];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      const j = rr * N + cc;
      if (src[j] < 0) { src[j] = s; q[t++] = j; }
      else if (src[j] !== s) {   // keep the closer of two fronts
        const sc = src[j] % N, sr = (src[j] - sc) / N, nc = s % N, nr = (s - nc) / N;
        if ((nc - cc) ** 2 + (nr - rr) ** 2 < (sc - cc) ** 2 + (sr - rr) ** 2) src[j] = s;
      }
    }
  }
  return src;
}

const cellXY = (col, row) => ({ x: (col + .5) * 500 - 200000, y: 200000 - (row + .5) * 500 });

// the nearest GO of cell (col,row): distance, arrow, and the ranked spot it belongs to (within 3 km), if any
export function nearestOf(src, col, row, ranked) {
  if (!src) return null;
  const j = src[row * N + col]; if (j < 0) return null;
  const c2 = j % N, r2 = (j - c2) / N, dx = c2 - col, dy = row - r2, km = Math.hypot(dx, dy) * 0.5;
  if (km === 0) return null;
  const a = (Math.atan2(dx, dy) * 180 / Math.PI + 360 + 22.5) % 360, arrow = ARROW[Math.floor(a / 45)];
  let best = null, bd = 36;   // 6 cells = 3 km
  for (const s of ranked || []) { const d = (s.col - c2) ** 2 + (s.row - r2) ** 2; if (d <= bd) { bd = d; best = s; } }
  return { km, arrow, to: cellXY(c2, r2), from: cellXY(col, row), spot: best };
}

export function nearestHtml(n, lang) {
  if (!n) return '';
  const s = n.spot, name = s && (s.id || s.title) ? `${s.id ? '#' + s.id : ''}${s.id && s.title ? ' ' : ''}${s.title || ''}, ` : '';
  const km = n.km < 10 ? n.km.toFixed(1) : Math.round(n.km);
  return `<div class="near">${lang === 'ko' ? '가장 가까운 GO' : 'Nearest GO'} <b>${name}${km} km ${n.arrow}</b></div>`;
}

// one line for the map: "Nearest GO #2 on Mons Malapert, 1.8 km ↗"
export function nearestLabel(n, lang) {
  if (!n) return '';
  const s = n.spot, name = s && (s.id || s.title) ? `${s.id ? '#' + s.id : ''}${s.id && s.title ? ' ' : ''}${s.title || ''}, ` : '';
  return `${lang === 'ko' ? '가장 가까운 GO' : 'Nearest GO'} ${name}${n.km < 10 ? n.km.toFixed(1) : Math.round(n.km)} km ${n.arrow}`;
}
export const linkOf = (n, lang) => n ? { x1: n.from.x, y1: n.from.y, x2: n.to.x, y2: n.to.y, label: nearestLabel(n, lang) } : null;
