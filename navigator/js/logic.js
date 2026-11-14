import { FIRST_DAY } from './config.js';
import { t } from './strings.js';

// fixes available on a day: null = unavailable
export function fixes(e, d) {
  return { wait: e.ok[d] ? 0 : e.wait[d], move: e.move[d], mast: e.mast[d] };
}

// smallest fraction of its budget wins; ties: wait < move < mast
export function bestFix(e, d, lim) {
  const f = fixes(e, d);
  let best = null;
  for (const kind of ['wait', 'move', 'mast']) {
    if (f[kind] == null || f[kind] > lim[kind]) continue;
    const frac = f[kind] / lim[kind];
    if (!best || frac < best.frac) best = { kind, value: f[kind], frac };
  }
  return best;
}

// 'ok' | 'move' | 'mast' | 'wait' | 'none' (+ capped when OK only through the applied mast)
export function status(e, d, mast, lim) {
  if (e.ok[d]) return { kind: 'ok' };
  if (mast && e.mastOk[mast][d]) return { kind: 'ok', capped: true };
  const b = bestFix(e, d, lim);
  return b ? { kind: b.kind, value: b.value } : { kind: 'none' };
}

export function fixText(s) {
  return t('avail_' + s.kind, s.value);
}

export function dateOf(day) { return new Date(FIRST_DAY + day * 864e5); }
export const isoDate = day => dateOf(day).toISOString().slice(0, 10);
export function shortDate(day) {
  const d = dateOf(day);
  return t('dayMonth', d.getUTCDate(), d.getUTCMonth());
}

// when does visibility change, scanning forward from index i; null if it does not in range
export function nextEvent(vis, i) {
  const v = vis[i];
  for (let k = i + 1; k < vis.length; k++) if (vis[k] !== v) return { rises: !v, hours: k - i };
  return null;
}

export function horizonAt(sky, az) {
  const n = sky.horizon.length;
  return sky.horizon[Math.round((((az % 360) + 360) % 360) / sky.azStep) % n];
}

// what blocks the Sun / Earth at hourly index i: {az, short, h} or null when visible
export function blockage(sky, i) {
  const out = { sun: null, earth: null };
  if (sky.sunFrac[i] < 0.98) {
    const h = horizonAt(sky, sky.sunAz[i]);
    out.sun = { az: sky.sunAz[i], el: sky.sunEl[i], h, short: Math.max(0, h - (sky.sunEl[i] - 0.27)) };
  }
  if (!sky.earthVis[i]) {
    const h = horizonAt(sky, sky.earthAz[i]);
    out.earth = { az: sky.earthAz[i], el: sky.earthEl[i], h, short: Math.max(0, h - sky.earthEl[i]) };
  }
  return out;
}

// longest run of hours where pred(i) is true inside [i0, i0+n]: {start, len}
export function longestRun(pred, i0, n) {
  let best = { start: 0, len: 0 }, start = -1;
  for (let j = 0; j <= n + 1; j++) {
    const on = j <= n && pred(i0 + j);
    if (on && start < 0) start = j;
    if (!on && start >= 0) {
      if (j - start > best.len) best = { start, len: j - start };
      start = -1;
    }
  }
  return best;
}

// map direction (unit vector in km axes x, y) for azimuth az at longitude lon (degrees)
export function azToMapDir(lon, az) {
  const l = lon * Math.PI / 180, a = az * Math.PI / 180;
  const north = [Math.sin(l), Math.cos(l)], east = [Math.cos(l), -Math.sin(l)];
  return [Math.cos(a) * north[0] + Math.sin(a) * east[0], Math.cos(a) * north[1] + Math.sin(a) * east[1]];
}

// nearest GO cell of the relocation grid on a day: {c, d} or null
export function nearestOk(site, day) {
  let best = null;
  for (const c of site.grid) {
    if (c.ok[day] !== '1') continue;
    const d = Math.hypot(c.dx, c.dy);
    if (!best || d < best.d) best = { c, d };
  }
  return best;
}

// runs of consecutive GO days for a site: [{start, len}]
export function goRuns(e, mast, lim) {
  const runs = [];
  for (let d = 0; d < 365; d++) {
    if (status(e, d, mast, lim).kind !== 'ok') continue;
    const last = runs[runs.length - 1];
    if (last && last.start + last.len === d) last.len++; else runs.push({ start: d, len: 1 });
  }
  return runs;
}
