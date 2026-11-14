// The only file that knows the JSON field names.
import { MAST_HEIGHTS } from './config.js';

const toBits = str => Array.from(str, c => c === '1');
const cache = {};

function cached(key, make) {
  return cache[key] || (cache[key] = make());
}

const getJson = async url => (await fetch(url)).json();

export async function loadIndex() {
  const raw = await getJson('data/index.json');
  const modes = {};
  const first = Object.values(raw.modes)[0].sites[raw.sites[0].id];
  MAST_HEIGHTS.length = 0;
  MAST_HEIGHTS.push(...Object.keys(first.mast_ok).map(Number).sort((a, b) => a - b));
  const optimal = {}, sens = {};
  let landmarks = [], landers = [];
  try { landmarks = await getJson('data/orientation/landmarks.json'); } catch (e) { /* optional */ }
  try { landers = await getJson('data/orientation/landers.json'); } catch (e) { /* optional */ }
  try {
    for (const s of (await getJson('data/masts.json')).sites) optimal[s.id] = s.optimal_mast_practical_m;
  } catch (e) { /* optional */ }
  try {
    for (const s of (await getJson('data/move_sensitivity.json')).sites) {
      sens[s.id] = {};
      for (const p of s.points) sens[s.id][`${p.dx_km},${p.dy_km}`] = p.keep_30m_offsets / p.offset_trials;
    }
  } catch (e) { /* optional */ }
  for (const [m, mode] of Object.entries(raw.modes)) {
    const sites = {};
    for (const [id, s] of Object.entries(mode.sites)) {
      const mastOk = {};
      for (const [h, str] of Object.entries(s.mast_ok)) mastOk[h] = toBits(str);
      sites[id] = { ok: toBits(s.ok), wait: s.wait, mast: s.mast, move: s.move, mastOk, summary: s.summary };
    }
    modes[m] = { criteria: mode.criteria, days: mode.mission_days, sites };
  }
  return { landmarks, landers, optimal, sens, sites: raw.sites, byId: Object.fromEntries(raw.sites.map(s => [s.id, s])), modes };
}

// Per-day numbers and the relocation grid for (site, mission length)
// the custom point is computed in the browser (js/pin.js) and registered here
export function setCustom(mission, obj) {
  full[`pin:${mission}`] = obj;
  calDone[`pin:${mission}`] = obj.cal;
}

export function loadCal(id, mission) {
  if (id === 'pin') return Promise.resolve(full[`pin:${mission}`]);
  return cached(`cal:${id}:${mission}`, async () => {
    const raw = await getJson(`data/${mission}/${id}.json`);
    const c = raw.calendar;
    return {
      cal: { sun: c.sun_pct, earth: c.earth_pct, both: c.both_pct, dark: c.longest_dark_h, noComm: c.longest_no_comm_h },
      mast: raw.mast_metrics && { sun: raw.mast_metrics.mast_sun_pct, earth: raw.mast_metrics.mast_earth_pct, dark: raw.mast_metrics.mast_longest_dark_h },
      grid: raw.move.grid.map(g => ({ dx: g.dx, dy: g.dy, landable: g.landable, slope: g.slope, ok: g.ok_days, sun: g.sun, earth: g.earth, dark: g.dark })),
      stepKm: raw.move.step_km
    };
  });
}

export function loadSky(id) {
  if (id === 'pin') return Promise.resolve(full['pin:14'].sky);
  return cached(`sky:${id}`, async () => {
    const r = await getJson(`data/sky/${id}.json`);
    let sx = 0, sy = 0;
    for (let i = 0; i < r.earth_az.length; i += 6) {
      const a = r.earth_az[i] * Math.PI / 180;
      sx += Math.sin(a); sy += Math.cos(a);
    }
    const center = (Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360;
    return {
      horizon: r.horizon_el, azStep: r.az_step, hours: r.hours, center,
      sunAz: r.sun_az, sunEl: r.sun_el, sunFrac: r.sun_frac, sunVis: r.sun_frac.map(f => f > 0),
      earthAz: r.earth_az, earthEl: r.earth_el, earthVis: r.earth_vis
    };
  });
}

// everything for a site, or null while loading
const full = {};
export function getSite(id, mission) {
  return full[`${id}:${mission}`] || null;
}
export async function loadSite(id, mission) {
  if (id === 'pin') return full[`pin:${mission}`];
  const [a, sky] = await Promise.all([loadCal(id, mission), loadSky(id)]);
  const s = { id, mission, ...a, sky };
  full[`${id}:${mission}`] = s;
  return s;
}

// per-day numbers of every site, loaded in the background (tooltips, compare)
const calDone = {};
export async function preloadCals(ids, mission) {
  await Promise.all(ids.map(async id => { const r = await loadCal(id, mission); calRaw[`${id}:${mission}`] = r; calDone[`${id}:${mission}`] = r.cal; }));
}
const calRaw = {};
export const calOf = (id, mission) => calDone[`${id}:${mission}`] || null;

// metrics a site's entry is rebuilt from when the criteria change (null until its file is loaded)
export function metricsOf(id, mission) {
  const raw = id === 'pin' ? full[`pin:${mission}`] : calRaw[`${id}:${mission}`];
  if (!raw) return null;
  if (raw.metrics) return raw.metrics;
  const mast = {};
  if (raw.mast) for (const h of Object.keys(raw.mast.sun)) mast[h] = { sun: raw.mast.sun[h], earth: raw.mast.earth[h], dark: raw.mast.dark[h] };
  return { base: { sun: raw.cal.sun, earth: raw.cal.earth, dark: raw.cal.dark }, mast,
    grid: raw.grid.map(g => ({ dx: g.dx, dy: g.dy, landable: g.landable, okStr: g.ok, sun: g.sun, earth: g.earth, dark: g.dark })) };
}
