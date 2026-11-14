export const state = {
  mode: 'mask', order: [],
  on: { layers: {}, mask: {}, score: {} },
  opacity: {}, threshold: {}, weight: {}, lastWeight: {},
  view: { k: 1, cx: 400, cy: 400 },
  hover: null, pin: null, site: null, hoverSite: null,
  month: null, monthThr: 1, cutoff: 70, minArea: 1, edit: null, sortBy: 'auto', hoverZone: null, ov: null, tDay: 45, adv: false, autoPin: true, focusCrit: null, tHour: 12, shadow: false, tTouched: false,
};
const subs = [];
export const subscribe = fn => subs.push(fn);
// what: 'pixels' | 'view' | 'site' | 'hover' | 'panel' | 'zones'
export function setState(patch, what = 'pixels') {
  Object.assign(state, patch);
  for (const fn of subs) fn(state, what);
}
