// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// A custom point ("pin") as a temporary 13th site, computed in the browser from the terrain horizon masks.
import * as shadow from './shadow.js';
import { loadSky, setCustom } from './data.js';
import { MAST_HEIGHTS, THRESHOLDS } from './config.js';
import { where } from './orient.js';

const D2R = Math.PI / 180, R_MOON = 1737400, KM_RING = 3, MAX_SLOPE = 8;

// moon-fixed unit vector of a body seen at az/el from lat/lon
function bodyDir(lat, lon, az, el) {
  const p = lat * D2R, l = lon * D2R, a = az * D2R, e = el * D2R;
  const up = [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  const east = [-Math.sin(l), Math.cos(l), 0];
  const north = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)];
  return [0, 1, 2].map(k => Math.cos(e) * (Math.cos(a) * north[k] + Math.sin(a) * east[k]) + Math.sin(e) * up[k]);
}

export function latLon(x, y) {
  const rho = Math.hypot(x, y);
  return { lat: (-Math.PI / 2 + 2 * Math.atan(rho / (2 * R_MOON))) / D2R, lon: Math.atan2(x, y) / D2R };
}

// hourly Sun and Earth vectors (taken from an existing site's series: they are the same everywhere)
async function bodies() {
  const sky = await loadSky('malapert-massif'), s = latLon(-7290, 122530), n = sky.hours;
  const S = new Float32Array(n * 3), E = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    S.set(bodyDir(s.lat, s.lon, sky.sunAz[i], sky.sunEl[i]), i * 3);
    E.set(bodyDir(s.lat, s.lon, sky.earthAz[i], sky.earthEl[i]), i * 3);
  }
  return { S, E, n };
}

// Sun visible share and Earth visibility per hour at a map point, for one horizon profile (720 values)
function series(x, y, h720, B) {
  const { lat, lon } = latLon(x, y), p = lat * D2R, l = lon * D2R;
  const up = [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  const east = [-Math.sin(l), Math.cos(l), 0];
  const north = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)];
  const frac = new Float32Array(B.n), vis = new Uint8Array(B.n), az = new Float32Array(B.n * 2), el = new Float32Array(B.n * 2);
  const dot = (V, i, u) => V[i * 3] * u[0] + V[i * 3 + 1] * u[1] + V[i * 3 + 2] * u[2];
  for (let i = 0; i < B.n; i++) {
    for (let b = 0; b < 2; b++) {
      const V = b ? B.E : B.S;
      const e = Math.asin(Math.max(-1, Math.min(1, dot(V, i, up)))) / D2R;
      const a = (Math.atan2(dot(V, i, east), dot(V, i, north)) / D2R + 360) % 360;
      az[i * 2 + b] = a; el[i * 2 + b] = e;
      const h = h720[Math.round(a / 0.5) % 720];
      if (b === 0) frac[i] = Math.max(0, Math.min(1, (e - h) / 0.53 + 0.5));
      else vis[i] = e > h ? 1 : 0;
    }
  }
  return { frac, vis, az, el };
}

// per landing day numbers for one mission length
function windows(ser, mission) {
  const n = mission * 24, out = { sun: [], earth: [], both: [], dark: [], noComm: [], ok: [] };
  const P = (arr, f) => { const c = new Float64Array(arr.length + 1); for (let i = 0; i < arr.length; i++) c[i + 1] = c[i] + f(i); return c; };
  const cs = P(ser.frac, i => ser.frac[i]), ce = P(ser.vis, i => ser.vis[i]), cb = P(ser.vis, i => (ser.frac[i] > 0 && ser.vis[i] ? 1 : 0));
  for (let d = 0; d < 365; d++) {
    const a = d * 24, b = a + n;
    const sun = (cs[b] - cs[a]) / n * 100, earth = (ce[b] - ce[a]) / n * 100;
    let dark = 0, nc = 0, rd = 0, rn = 0;
    for (let i = a; i < b; i++) {
      rd = ser.frac[i] < 0.1 ? rd + 1 : 0; if (rd > dark) dark = rd;
      rn = ser.vis[i] ? 0 : rn + 1; if (rn > nc) nc = rn;
    }
    out.sun.push(sun); out.earth.push(earth); out.both.push((cb[b] - cb[a]) / n * 100); out.dark.push(dark); out.noComm.push(nc);
    out.ok.push(sun >= THRESHOLDS.sun && dark <= THRESHOLDS.dark && earth >= THRESHOLDS.earth);
  }
  return out;
}

const circMean = (arr) => {
  let sx = 0, sy = 0;
  for (let i = 0; i < arr.length; i += 6) { const a = arr[i] * D2R; sx += Math.sin(a); sy += Math.cos(a); }
  return (Math.atan2(sx, sy) / D2R + 360) % 360;
};

// everything for a point: per mission length {cal, grid, sky, entry}; no side effects
export async function compute(x, y) {
  await shadow.load();
  const ex = await shadow.loadExtra(), B = await bodies();
  const p0 = shadow.pixelOf(x, y), res = {};
  const h2 = shadow.profile(p0.i, ex.sets[2]);
  const mastSets = [10, 20].filter(h => ex.sets[h]);
  const mastH = Object.fromEntries(mastSets.map(h => [h, shadow.profile(p0.i, ex.sets[h])]));

  // the point itself
  const own = series(x, y, h2, B);
  const mastSer = Object.fromEntries(mastSets.map(h => [h, series(x, y, mastH[h], B)]));

  // relocation cells: 500 m pixels within 3 km of the pin's pixel, slope <= 8 deg
  const cells = [];
  for (let dr = -6; dr <= 6; dr++) for (let dq = -6; dq <= 6; dq++) {
    const dx = dq * 0.5, dy = -dr * 0.5;
    if (Math.hypot(dx, dy) > KM_RING) continue;
    const q = p0.q + dq, r = p0.r + dr;
    if (q < 0 || r < 0 || q >= 800 || r >= 800) continue;
    const i = r * 800 + q, slopeV = ex.slope[i], slope = slopeV === 255 ? null : slopeV * 40 / 250;
    const landable = slope !== null && slope <= MAX_SLOPE;
    cells.push({ dx, dy, i, landable, slope: slope === null ? 0 : Math.round(slope * 10) / 10, x: pixelXYx(q, r)[0], y: pixelXYx(q, r)[1] });
  }
  const cellSer = cells.map(c => (c.landable ? series(c.x, c.y, shadow.profile(c.i, ex.sets[2]), B) : null));

  for (const mission of [14, 6]) {
    const w = windows(own, mission), okBase = w.ok;
    const mwAll = Object.fromEntries(mastSets.map(h => [h, windows(mastSer[h], mission)]));
    const mw = Object.fromEntries(mastSets.map(h => [h, mwAll[h].ok]));
    const cw = cells.map((c, k) => (c.landable ? windows(cellSer[k], mission) : null));
    const grid = cells.map((c, k) => ({ dx: c.dx, dy: c.dy, landable: c.landable, slope: c.slope, ok: c.landable ? cw[k].ok.map(v => (v ? '1' : '0')).join('') : '0'.repeat(365) }));
    // per-day metrics, so the entry can be rebuilt for other criteria (criteria.js)
    const metrics = {
      base: { sun: w.sun, earth: w.earth, dark: w.dark },
      mast: Object.fromEntries(mastSets.map(h => [h, { sun: mwAll[h].sun, earth: mwAll[h].earth, dark: mwAll[h].dark }])),
      grid: cells.map((c, k) => ({ dx: c.dx, dy: c.dy, landable: c.landable, okStr: grid[k].ok, ...(cw[k] ? { sun: cw[k].sun, earth: cw[k].earth, dark: cw[k].dark } : {}) }))
    };
    // mast_ok per height: the nearest computed set at or below the height
    const mastOk = {};
    for (const h of MAST_HEIGHTS) {
      const use = mastSets.filter(s => s <= h).pop();
      mastOk[h] = use ? okBase.map((v, d) => v || mw[use][d]) : okBase.slice();
    }
    const move = [], wait = [], mast = [];
    for (let d = 0; d < 365; d++) {
      if (okBase[d]) { move.push(0); wait.push(0); mast.push(0); continue; }
      let best = null;
      for (const g of grid) if (g.ok[d] === '1') { const dist = Math.hypot(g.dx, g.dy); if (best === null || dist < best) best = dist; }
      move.push(best === null ? null : Math.round(best * 100) / 100);
      let k = null;
      for (let j = 1; j <= 60 && d + j < 365; j++) if (okBase[d + j]) { k = j; break; }
      wait.push(k);
      mast.push(MAST_HEIGHTS.find(h => mastOk[h][d]) ?? null);
    }
    const days = okBase.filter(Boolean).length;
    res[mission] = {
      okDays: days,
      entry: { ok: okBase, wait, mast, move, mastOk, summary: { ok_days: days, not_ok_days: 365 - days } },
      detail: {
        cal: { sun: w.sun, earth: w.earth, both: w.both, dark: w.dark, noComm: w.noComm },
        mast: null, grid, stepKm: 0.5, metrics
      }
    };
  }

  const sky = {
    horizon: Array.from(h2), azStep: 0.5, hours: B.n, center: circMean(Array.from({ length: B.n }, (_, i) => own.az[i * 2 + 1])),
    sunAz: Array.from({ length: B.n }, (_, i) => own.az[i * 2]), sunEl: Array.from({ length: B.n }, (_, i) => own.el[i * 2]),
    sunFrac: own.frac, sunVis: Array.from(own.frac, f => f > 0),
    earthAz: Array.from({ length: B.n }, (_, i) => own.az[i * 2 + 1]), earthEl: Array.from({ length: B.n }, (_, i) => own.el[i * 2 + 1]),
    earthVis: own.vis
  };
  return { res, sky, slope: ex.slope[p0.i] * 40 / 250, mastSets };
}

const pixelXYx = (q, r) => shadow.pixelXY(q, r);

// compute and register the pin as the 13th site of the index
export async function setup(index, x, y) {
  const r = await compute(x, y), { lat, lon } = latLon(x, y);
  const site = { id: 'pin', name: '', x_m: x, y_m: y, lat, lon, slope_deg: Math.round(r.slope * 10) / 10, group: 'custom', isPin: true };
  index.sites.unshift(site);
  index.byId.pin = site;
  site.name = where(site);
  for (const m of [14, 6]) {
    index.modes[m].sites.pin = r.res[m].entry;
    setCustom(m, { id: 'pin', mission: m, ...r.res[m].detail, sky: r.sky });
  }
  return r;
}
