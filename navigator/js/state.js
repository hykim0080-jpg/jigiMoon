import { DEFAULT, MAST_HEIGHTS, ZOOM, FIRST_DAY } from './config.js';
import { readCrit, saveCrit, critParams } from './criteria.js';

const KEYS = { site: 's', day: 'day', mission: 'm', mast: 'mast', mastMax: 'mx', moveMax: 'vx', waitMax: 'wx', baseline: 'base', view: 'v', hour: 'h', zoom: 'z', mode: 'pm', expo: 'ex', pan: 'c' };
const subs = [];

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const out = {};
  for (const [k, h] of Object.entries(KEYS)) {
    if (!p.has(h)) continue;
    out[k] = typeof DEFAULT[k] === 'number' ? Number(p.get(h)) : p.get(h);
  }
  if (p.has('cmp')) out.pinned = p.get('cmp').split(',').filter(Boolean);
  // #pin=<x_m>,<y_m>[&d=YYYY-MM-DD]: a custom point from the layer viewer
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(p.get('pin') || '');
  if (m) {
    out.pinXY = `${m[1]},${m[2]}`;
    out.site = 'pin';
    const t = Date.parse((p.get('d') || '') + 'T00:00:00Z');
    if (!isNaN(t)) out.day = Math.round((t - FIRST_DAY) / 864e5);
    else if (p.has('mon')) out.day = Math.round((Date.UTC(2027, Number(p.get('mon')) - 1, 15) - FIRST_DAY) / 864e5);
  }
  return out;
}

export const state = { pinXY: '', ...DEFAULT, ...readHash(), crit: readCrit() };

function writeHash() {
  const p = new URLSearchParams();
  for (const [k, h] of Object.entries(KEYS)) p.set(h, state[k]);
  if (state.pinned.length) p.set('cmp', state.pinned.join(','));
  if (state.pinXY) p.set('pin', state.pinXY);
  for (const [h, v] of critParams(state.crit)) p.set(h, v);
  const old = new URLSearchParams(location.hash.slice(1));
  if (old.has('lang')) p.set('lang', old.get('lang'));
  history.replaceState(null, '', '#' + p.toString());
}

export function setState(patch) {
  Object.assign(state, patch);
  if ('site' in patch && !('pan' in patch)) state.pan = '';   // picking a site recentres on it
  if (patch.crit) saveCrit(state.crit);
  state.zoom = Math.max(1, Math.min(ZOOM.spot, Number(state.zoom) || 1));
  state.day = Math.max(0, Math.min(364, Math.round(state.day)));
  state.hour = Math.max(0, Math.min(state.mission * 24, Math.round(state.hour)));
  if (state.mast > mastLimit(state)) state.mast = 0;
  writeHash();
  subs.forEach(fn => fn(state));
}

export const subscribe = fn => subs.push(fn);

// highest computed mast height not above the typed limit (0 = none)
export function mastLimit(st) {
  return MAST_HEIGHTS.filter(h => h <= st.mastMax).pop() || 0;
}
// limits the search is allowed to use; mast is snapped to a computed height
export const limitsOf = st => ({ move: st.moveMax, mast: mastLimit(st), wait: st.waitMax });

// hovered site id (map / calendar), shared without a full re-render
export const ui = { hover: null };
const hoverSubs = [];
export const onHover = fn => hoverSubs.push(fn);
export function setHover(id) {
  if (ui.hover === id) return;
  ui.hover = id;
  hoverSubs.forEach(fn => fn());
}
