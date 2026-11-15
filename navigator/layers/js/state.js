// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
export const state = {
  mode: 'mask', order: [],
  on: { layers: {}, mask: {}, score: {} },
  opacity: {}, threshold: {}, weight: {}, lastWeight: {},
  view: { k: 1, cx: 400, cy: 400 },
  hover: null, pin: null, site: null, hoverSite: null,
  month: null, monthThr: 1, cutoff: 70, minArea: 1, edit: null, sortBy: 'auto', hoverZone: null, ov: null, crit: {}, expo: false, base: 'sun', tDay: 45, adv: false, autoPin: true, focusCrit: null, tHour: 12, shadow: false, eshadow: false, tTouched: false, mission: 14, region: null, hoverTrip: null, basis: 'trip', cart: [],
};
state.basemap = 'line';   // base map: 'line' (contour lines, default) or 'shade' (hillshade)
const subs = [];
export const subscribe = fn => subs.push(fn);
// what: 'pixels' | 'view' | 'site' | 'hover' | 'panel' | 'zones'
export function setState(patch, what = 'pixels') {
  Object.assign(state, patch);
  for (const fn of subs) fn(state, what);
}
