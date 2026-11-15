// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// The best spots for a landing day and stay, for Detail's 3D map: the same pool and score as Find a site's ranked list
// (layers/js/trip.js poolCells + rank): up to 120 spots, 6 km apart, on ground under 8° with the most landing days in
// the year; each judged over the stay from its own hourly Sun / Earth series; ordered by how far it clears the criteria,
// with a small lift for ice-likely shade within 10 km.
import { load, stayOf } from './hover3d.js';

const N = 800, cache = new Map();
let pool = null, LM = null;
const get = f => fetch('layers/data/' + f).then(r => r.ok ? r.arrayBuffer() : null).then(b => b && b.byteLength === N * N ? new Uint8Array(b) : null).catch(() => null);
async function poolOf(mission) {
  if (!pool) pool = {};
  if (pool[mission]) return pool[mission];
  return pool[mission] = (async () => {
    const [days, slope] = await Promise.all([get(mission === 6 ? 'days6.wasm' : 'days14.wasm'), get('slope.wasm')]);
    if (!days || !slope) return [];
    const cand = [];
    for (let i = 0; i < N * N; i++) { const v = days[i]; if (v > 0 && v <= 250 && slope[i] <= 50) cand.push(i); }
    cand.sort((a, b) => days[b] - days[a]);
    const out = [];
    for (const i of cand) {
      const c = i % N, r = (i - c) / N;
      if (out.some(o => (o.col - c) ** 2 + (o.row - r) ** 2 < 144)) continue;
      out.push({ col: c, row: r }); if (out.length >= 120) break;
    }
    return out;
  })();
}
async function landmarks() {
  if (!LM) LM = Promise.all([fetch('layers/data/landmarks.json').then(r => r.json()), import('../layers/js/orient.js')]).then(([j, o]) => ({ list: j.landmarks || j, describe: o.describe })).catch(() => null);
  return LM;
}
// -> [{ id, col, row, x, y, title, sun, earth, dark, go }] best first (GO spots only); cached per day, stay and criteria
export function ranked(day, mission, crit) {
  const key = `${day}|${mission}|${crit.sun}|${crit.earth}|${crit.dark}`;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const [cells, L, lm] = await Promise.all([poolOf(mission), load(), landmarks()]);
    const rows = [];
    for (let k = 0; k < cells.length; k++) {
      const c = cells[k], w = await stayOf(c.col, c.row, mission);
      const sun = w.sun[day], earth = w.earth[day], dark = w.dark[day];
      if (!(sun >= crit.sun - 1e-9 && earth >= crit.earth - 1e-9 && dark <= crit.dark)) continue;
      const iceKm = L && L.ice ? L.ice[c.row * N + c.col] : null;
      const margin = (sun - crit.sun) / crit.sun + (earth - crit.earth) / crit.earth + (crit.dark - dark) / crit.dark + (iceKm == null || iceKm > 10 ? 0 : 0.25 * (1 - iceKm / 10));
      rows.push({ col: c.col, row: c.row, sun, earth, dark, margin });
      if (k % 8 === 7) await new Promise(r => setTimeout(r, 0));
    }
    rows.sort((a, b) => b.margin - a.margin);
    return rows.map((r, i) => {
      const x = (r.col + .5) * 500 - 200000, y = 200000 - (r.row + .5) * 500;
      let title = ''; try { title = lm ? lm.describe(x, y, lm.list) || '' : ''; } catch (e) { /* no title */ }
      return { ...r, id: i + 1, x, y, title, go: true };
    });
  })();
  cache.set(key, p); if (cache.size > 12) cache.delete(cache.keys().next().value);
  return p;
}
