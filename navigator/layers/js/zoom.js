// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Close-up of the chosen spot for the right panel: 20 m relief tiles (../data/t20, 5 km each) with the 500 m slope cells
// that exceed the slope limit tinted red, the spot, the MOVE target and a 1 km scale bar. Up = Earth side (map north).
import { PX, N } from './config.js';
import { cellToXY } from './geo.js';
import { decode } from './data.js';
import { lang } from './strings.js';

const HW = 4, HH = 8 / 3, W = 300, H = 200, K = W / (2 * HW);   // ±3 km × ±2 km, px per km
export function zoomSvg(inf, v, data, thr) {
  const p = cellToXY(inf.col, inf.row), x0 = p.x / 1000, y0 = p.y / 1000;
  const X = x => ((x - x0 + HW) * K).toFixed(1), Y = y => ((y0 + HH - y) * K).toFixed(1);
  let s = `<svg class="lyr-zoom" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${lang === 'ko' ? '지점 확대 지도' : 'Close-up of the spot'}"><rect width="${W}" height="${H}" fill="#222"/>`;
  const T = 5, c0 = Math.floor((x0 - HW + 200) / T), c1 = Math.floor((x0 + HW + 200) / T), r0 = Math.floor((200 - (y0 + HH)) / T), r1 = Math.floor((200 - (y0 - HH)) / T);
  for (let r = Math.max(0, r0); r <= Math.min(79, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(79, c1); c++)
    s += `<image href="../data/t20/${c}_${r}.jpg" x="${X(-200 + c * T)}" y="${Y(200 - r * T)}" width="${(T * K + .6).toFixed(1)}" height="${(T * K + .6).toFixed(1)}" preserveAspectRatio="none"/>`;
  const sb = data.bytes.slope, meta = data.layers.find(m => m.id === 'slope'), cs = PX / 1000, n = Math.ceil(HW / cs) + 1;
  if (sb && meta && thr != null) for (let dr = -n; dr <= n; dr++) for (let dc = -n; dc <= n; dc++) {
    const c = inf.col + dc, r = inf.row + dr; if (c < 0 || r < 0 || c >= N || r >= N) continue;
    const b = sb[r * N + c]; if (b > 250) continue; const val = decode(meta, b); if (val <= thr) continue;
    const q = cellToXY(c, r); s += `<rect x="${X(q.x / 1000 - cs / 2)}" y="${Y(q.y / 1000 + cs / 2)}" width="${(cs * K).toFixed(1)}" height="${(cs * K).toFixed(1)}" fill="rgba(240,101,90,${Math.min(.45, .2 + (val - thr) / 30).toFixed(2)})"/>`;
  }
  const cx = X(x0), cy = Y(y0);
  if (v && v.move && !v.move.here && v.move.col != null) { const m = cellToXY(v.move.col, v.move.row), mx = X(m.x / 1000), my = Y(m.y / 1000); s += `<line x1="${cx}" y1="${cy}" x2="${mx}" y2="${my}" stroke="#74a2f2" stroke-width="2" stroke-dasharray="5 3"/><circle cx="${mx}" cy="${my}" r="6" fill="none" stroke="#74a2f2" stroke-width="2"/>`; }
  s += `<circle cx="${cx}" cy="${cy}" r="${(cs / 2 * K).toFixed(1)}" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="3" fill="#fff"/>`;
  s += `<line x1="${W - 12 - K}" y1="${H - 10}" x2="${W - 12}" y2="${H - 10}" stroke="#fff" stroke-width="2"/><text x="${W - 12 - K / 2}" y="${H - 15}" fill="#fff" font-size="10" text-anchor="middle">1 km</text>`;
  s += `<text x="8" y="14" fill="#fff" font-size="10">↑ ${lang === 'ko' ? '지구 쪽' : 'Earth side'}</text>`;
  return s + '</svg>' + `<p class="lyr-zkey"><i></i>${lang === 'ko' ? `경사 ${thr}° 넘는 곳 (500 m 칸) · 바탕 20 m 지형` : `Steeper than ${thr}° (500 m cells) · 20 m relief`}</p>`;
}
