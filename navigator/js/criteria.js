// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Landing criteria the user can change (sun %, Earth %, longest dark h), shared with the layer viewer.
// Hash keys cs / ce / cd (left out at the defaults), remembered in localStorage 'moonjigi.crit'.
// The sun default (SUN_DEF) can depend on the stay; now 90 % for both 6 and 14 days. Until the user picks a sun level (sunSet),
// switching the stay moves sun to that stay's default. Precomputed data (index, layers, 3D) is at DEF (70/50/50).
import { THRESHOLDS, MAST_HEIGHTS } from './config.js';

export const LEVELS = { sun: [50, 60, 70, 80, 90], earth: [30, 50, 70], dark: [24, 50, 100] };
export const DEF = { sun: 70, earth: 50, dark: 50 };   // the precomputed basis
export const SUN_DEF = { 6: 90, 14: 90 };
export const defFor = m => ({ ...DEF, sun: SUN_DEF[m] ?? DEF.sun });
// the criteria for stay m: the user's sun level if they picked one, else the stay's default
export const forMission = (c, m) => c.sunSet || c.sun === defFor(m).sun ? c : { ...c, sun: defFor(m).sun };
const HASH = { sun: 'cs', earth: 'ce', dark: 'cd' }, STORE = 'moonjigi.crit';

const snap = (k, v) => LEVELS[k].includes(v) ? v : DEF[k];

export function readCrit(m = 14) {
  const c = { ...defFor(m), sunSet: false };
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (s) for (const k in DEF) if (s[k] != null && (k !== 'sun' || s.sunSet)) c[k] = snap(k, +s[k]);
    if (s && s.sunSet) c.sunSet = true;
  } catch (e) { /* no storage */ }
  const p = new URLSearchParams(typeof location === 'undefined' ? '' : location.hash.slice(1));
  for (const k in DEF) if (p.has(HASH[k])) c[k] = snap(k, +p.get(HASH[k]));
  if (p.has(HASH.sun)) c.sunSet = true;
  return c;
}
export function saveCrit(c) { try { localStorage.setItem(STORE, JSON.stringify(c)); } catch (e) { /* no storage */ } }
// at the precomputed basis DEF (70/50/50): precomputed entries, 3D data and layer files apply as they are
export const isBase = c => Object.keys(DEF).every(k => c[k] === DEF[k]);
// at the defaults of stay m (what the UI shows as unchanged)
export const isDefault = (c, m = 14) => { const d = defFor(m); return Object.keys(DEF).every(k => c[k] === d[k]); };
export const critKey = c => `${c.sun}/${c.earth}/${c.dark}`;
// [[key, value]] of the criteria that differ from the defaults, for hashes and links
// sun goes in only when the user picked it, so a link keeps following the stay's default otherwise
export const critParams = c => Object.keys(DEF).filter(k => k === 'sun' ? c.sunSet : c[k] !== DEF[k]).map(k => [HASH[k], c[k]]);
export const critQuery = c => critParams(c).map(([h, v]) => `&${h}=${v}`).join('');

const pass = (c, sun, earth, dark) => sun >= c.sun && earth >= c.earth && dark <= c.dark;

// One site's per-day entry {ok, mastOk, mast, wait, move, summary} from its metrics.
// m.base = {sun, earth, dark} arrays (365); m.mast = {height: {sun, earth, dark}} (any subset of heights);
// m.grid = [{dx, dy, landable, sun?, earth?, dark?, okStr}] (okStr = default-criteria days, used when a cell has no metrics)
export function buildEntry(m, c) {
  const N = 365, ok = [], b = m.base;
  for (let d = 0; d < N; d++) ok.push(pass(c, b.sun[d], b.earth[d], b.dark[d]));
  const have = Object.keys(m.mast || {}).map(Number).sort((a, b2) => a - b2), mastOk = {};
  for (const h of MAST_HEIGHTS) {
    const use = have.filter(s => s <= h).pop(), mm = use != null && m.mast[use];
    mastOk[h] = mm ? ok.map((v, d) => v || pass(c, mm.sun[d], mm.earth[d], mm.dark[d])) : ok.slice();
  }
  const cells = (m.grid || []).filter(g => g.landable).map(g => ({
    dist: Math.hypot(g.dx, g.dy),
    ok: g.sun ? d => pass(c, g.sun[d], g.earth[d], g.dark[d]) : d => g.okStr[d] === '1'
  })).sort((a, b2) => a.dist - b2.dist);
  const wait = [], mast = [], move = [];
  for (let d = 0; d < N; d++) {
    let k = null;
    for (let j = 0; j <= 60 && d + j < N; j++) if (ok[d + j]) { k = j; break; }
    wait.push(k);
    mast.push(MAST_HEIGHTS.find(h => mastOk[h][d]) ?? null);
    const cell = cells.find(x => x.ok(d));
    move.push(cell ? Math.round(cell.dist * 10) / 10 : null);
  }
  const days = ok.filter(Boolean).length;
  return { ok, mastOk, mast, wait, move, summary: { ok_days: days, not_ok_days: N - days } };
}

// does every site of a mission carry per-cell metrics (MOVE follows the criteria)?
export const moveFollows = metricsList => metricsList.every(m => (m.grid || []).every(g => !g.landable || g.sun));

// Rebuild every site's entry of one mission in place. metricsOf(id) -> metrics or null (not loaded).
// Defaults restore the precomputed entries exactly.
const orig = {};
export function applyCriteria(index, mission, c, metricsOf) {
  Object.assign(THRESHOLDS, { sun: c.sun, earth: c.earth, dark: c.dark });
  const sites = index.modes[mission].sites;
  orig[mission] = orig[mission] || { ...sites };
  for (const id of Object.keys(sites)) {
    if (isBase(c) && orig[mission][id] && !/^pin\d*$/.test(id)) { sites[id] = orig[mission][id]; continue; }
    const m = metricsOf(id);
    if (!m) return false;
    sites[id] = buildEntry(m, c);
  }
  return true;
}
