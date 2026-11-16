// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Moon-jigi verdict API: the same GO / NO-GO verdict and fixes the Navigator shows, as JSON.
// Shared by the Cloudflare Pages Functions in /functions/api and the tests in /api/test.mjs.
// Reads the Navigator's own precomputed data (navigator/data); `load(path)` returns parsed JSON for a path
// under the site root, e.g. load('/data/index.json').
// Written with the help of Anthropic's Claude (AI coding assistant), directed and reviewed by team Moon-jigi.
import { buildEntry, DEF as DEFAULT_CRITERIA, defFor } from '../navigator/js/criteria.js';
import { MAST_HEIGHTS, BUDGET, FIRST_DAY } from '../navigator/js/config.js';

const DAY_MS = 864e5;
const YEAR = 2027;
const bits = s => Array.from(s, c => c === '1');

export class ApiError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

export const isoDate = day => new Date(FIRST_DAY + day * DAY_MS).toISOString().slice(0, 10);

function dayOf(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!m) throw new ApiError(400, 'date must be YYYY-MM-DD, e.g. 2027-02-15');
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const day = Math.round((t - FIRST_DAY) / DAY_MS);
  if (isNaN(t) || isoDate(day) !== date || day < 0 || day > 364)
    throw new ApiError(400, `date must be a real day of ${YEAR} (landing days are computed for ${YEAR} only)`);
  return day;
}

function num(params, key, def, lo, hi) {
  if (!params.has(key) || params.get(key) === '') return def;
  const v = Number(params.get(key));
  if (!Number.isFinite(v) || v < lo || v > hi) throw new ApiError(400, `${key} must be a number from ${lo} to ${hi}`);
  return v;
}

// ---- data (cached per isolate) ------------------------------------------------------------------
let indexPromise = null;
export async function getIndex(load) {
  if (!indexPromise) indexPromise = (async () => {
    const raw = await load('/data/index.json');
    const first = Object.values(raw.modes)[0].sites[raw.sites[0].id];
    if (!MAST_HEIGHTS.length) MAST_HEIGHTS.push(...Object.keys(first.mast_ok).map(Number).sort((a, b) => a - b));
    return raw;
  })().catch(e => { indexPromise = null; throw e; });
  return indexPromise;
}

// precomputed entry for the default criteria, in the shape buildEntry() returns
function entryFromIndex(s) {
  const mastOk = {};
  for (const [h, str] of Object.entries(s.mast_ok)) mastOk[h] = bits(str);
  return { ok: bits(s.ok), wait: s.wait, mast: s.mast, move: s.move, mastOk };
}

function metricsFromSiteFile(raw) {
  const c = raw.calendar, mm = raw.mast_metrics, mast = {};
  if (mm) for (const h of Object.keys(mm.mast_sun_pct)) mast[h] = { sun: mm.mast_sun_pct[h], earth: mm.mast_earth_pct[h], dark: mm.mast_longest_dark_h[h] };
  return {
    base: { sun: c.sun_pct, earth: c.earth_pct, dark: c.longest_dark_h },
    mast,
    grid: raw.move.grid.map(g => ({ dx: g.dx, dy: g.dy, landable: g.landable, okStr: g.ok_days, sun: g.sun, earth: g.earth, dark: g.dark }))
  };
}

// ---- the same rules as navigator/js/logic.js (kept in step by api/test.mjs) -----------------------
function fixesOn(e, d) { return { wait: e.ok[d] ? 0 : e.wait[d], move: e.move[d], mast: e.mast[d] }; }
function bestFix(e, d, lim) {
  const f = fixesOn(e, d);
  let best = null;
  for (const kind of ['wait', 'move', 'mast']) {               // ties: wait < move < mast
    if (f[kind] == null || f[kind] > lim[kind]) continue;
    const frac = f[kind] / lim[kind];
    if (!best || frac < best.frac) best = { kind, value: f[kind], frac };
  }
  return best;
}
const FIX_TEXT = {
  wait: v => `AVAILABLE IN ${v} ${v === 1 ? 'DAY' : 'DAYS'}`,
  move: v => `AVAILABLE ${v} KM AWAY`,
  mast: v => `AVAILABLE WITH ${v} M MAST`
};

// ---- endpoints ---------------------------------------------------------------------------------------
export async function listSites(load) {
  const index = await getIndex(load);
  return {
    year: YEAR,
    mission_days_options: Object.values(index.modes).map(m => m.mission_days),
    sites: index.sites.map(s => ({
      id: s.id, name: s.name, group: s.group, lat: s.lat, lon: s.lon, slope_deg: s.slope_deg,
      go_days: Object.fromEntries(Object.entries(index.modes).map(([k, m]) => [`${k}d`, m.sites[s.id].summary.ok_days]))
    }))
  };
}

export async function check(load, params, origin = '') {
  const index = await getIndex(load);
  const siteId = params.get('site') || '';
  const site = index.sites.find(s => s.id === siteId);
  if (!site) throw new ApiError(400, 'unknown site; use one of the ids from /api/sites', { sites: index.sites.map(s => s.id) });
  const day = dayOf(params.get('date'));
  const mission = String(num(params, 'mission', 14, 1, 365));
  if (!index.modes[mission]) throw new ApiError(400, `mission must be one of ${Object.keys(index.modes).join(', ')} (days)`);

  const crit = {
    sun: num(params, 'sun', defFor(+mission).sun, 0, 100),   // the stay's default (js/criteria.js SUN_DEF)
    earth: num(params, 'earth', DEFAULT_CRITERIA.earth, 0, 100),
    dark: num(params, 'dark', DEFAULT_CRITERIA.dark, 0, mission * 24)
  };
  const lim = {
    move: num(params, 'max_move', BUDGET.move, 0.25, 6),
    mast: num(params, 'max_mast', BUDGET.mast, 0, 100),
    wait: num(params, 'max_wait', BUDGET.wait, 0, 120)
  };
  lim.mast = MAST_HEIGHTS.filter(h => h <= lim.mast).pop() || 0;   // snapped to a computed height, as on the page
  const askMast = num(params, 'mast', 0, 0, 100);
  const mast = askMast ? (MAST_HEIGHTS.filter(h => h <= askMast).pop() || 0) : 0;

  const raw = await load(`/data/${mission}/${site.id}.json`);
  const isDefault = Object.keys(DEFAULT_CRITERIA).every(k => crit[k] === DEFAULT_CRITERIA[k]);
  const metrics = metricsFromSiteFile(raw);
  const e = isDefault ? entryFromIndex(index.modes[mission].sites[site.id]) : buildEntry(metrics, crit);

  const c = raw.calendar;
  const m = { sun_pct: c.sun_pct[day], earth_pct: c.earth_pct[day], longest_dark_h: c.longest_dark_h[day], longest_no_comm_h: c.longest_no_comm_h[day] };
  const failing = [];
  if (m.sun_pct < crit.sun) failing.push('sun');
  if (m.earth_pct < crit.earth) failing.push('earth');
  if (m.longest_dark_h > crit.dark) failing.push('dark');

  const okBase = e.ok[day];
  // a mast within max_mast counts as GO (as on the page, js/logic.js status): the asked one, else the lowest that works
  const autoMast = !okBase && e.mast[day] != null && e.mast[day] > 0 && e.mast[day] <= lim.mast ? e.mast[day] : 0;
  const goMast = !okBase ? (mast > 0 && e.mastOk[mast] && e.mastOk[mast][day] ? mast : autoMast) : 0;
  const okMast = goMast > 0;
  const go = okBase || okMast;

  // nearest landable GO cell on the 3 km relocation grid (direction in the polar-stereographic map frame);
  // default criteria use the precomputed per-cell days, like the MOVE grid on the page
  let move = null;
  if (e.move[day] != null) {
    const pass = g => !isDefault && g.sun ? (g.sun[day] >= crit.sun && g.earth[day] >= crit.earth && g.dark[day] <= crit.dark) : g.okStr[day] === '1';
    const cell = metrics.grid.filter(g => g.landable && pass(g)).sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy))[0];
    move = { km: e.move[day], ...(cell && { dx_km: cell.dx, dy_km: cell.dy }) };
  }
  const waitDays = okBase ? 0 : e.wait[day];
  const best = go ? null : bestFix(e, day, lim);

  const hash = new URLSearchParams({ s: site.id, day: String(day), m: mission, mast: String(mast), base: String(day) });
  return {
    site: { id: site.id, name: site.name, group: site.group, lat: site.lat, lon: site.lon },
    date: isoDate(day),
    mission_days: Number(mission),
    criteria: { sun_min_pct: crit.sun, earth_min_pct: crit.earth, dark_max_h: crit.dark },
    verdict: go ? 'GO' : 'NO-GO',
    ...(okMast && { go_with_mast_m: goMast }),
    metrics: m,
    failing,
    fixes: {
      wait: waitDays == null ? null : { days: waitDays, date: isoDate(day + waitDays) },
      move,
      mast: e.mast[day] == null ? null : { m: e.mast[day] }
    },
    recommended: best && { kind: best.kind, value: best.value, text: FIX_TEXT[best.kind](best.value) },
    limits: { max_move_km: lim.move, max_mast_m: lim.mast, max_wait_days: lim.wait },
    ...(!isDefault && !metrics.grid.every(g => !g.landable || g.sun) && {
      note: 'MOVE uses the default criteria at this site (the relocation grid has no per-cell metrics), as on the page.'
    }),
    navigator_url: `${origin}/#${hash.toString()}`,
    data: 'NASA LOLA terrain (PGDA products 78, 90), JPL DE421 ephemeris; validated against PGDA product 69. Team Moon-jigi.'
  };
}

export const USAGE = {
  name: 'Moon-jigi Lunar Landing Site Navigator API',
  about: 'GO / NO-GO verdicts and fixes (move, mast, wait) for 12 lunar south-pole landing sites, every landing day of 2027.',
  endpoints: {
    '/api/sites': 'list the 12 sites with ids, coordinates and GO days per year',
    '/api/check?site=nobile-rim-1&date=2027-02-15': 'verdict, metrics and fixes for one site and landing day',
  },
  check_parameters: {
    site: 'site id from /api/sites (required)',
    date: 'landing day, YYYY-MM-DD in 2027 (required)',
    mission: 'mission length in days: 14 (default) or 6',
    mast: 'antenna mast height in m to apply (snapped down to 2, 3, 5, 7, 10, 15, 20, 30, 50, 75 or 100)',
    sun: 'minimum share of the mission in sunlight, % (default 90)',
    earth: 'minimum share of the mission with Earth in view, % (default 50)',
    dark: 'longest allowed dark spell, hours (default 50)',
    max_move: 'largest move to recommend, km (default 3)',
    max_mast: 'largest mast, m (default 20); a mast up to it counts as GO (go_with_mast_m)',
    max_wait: 'longest wait to recommend, days (default 60)'
  },
  example: '/api/check?site=nobile-rim-1&date=2027-02-15&mission=14'
};
