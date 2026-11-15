// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Judging by the trip: the Sun / Earth / dark criteria are tested over the stay that starts on the chosen day,
// for every pixel, in a Web Worker (winworker.js). Results are cached per (day, stay).
import * as shadow from '../../js/shadow.js';
import { ensure, bodiesData } from './time.js';
import { state, setState } from './state.js';

const NPX = 800 * 800, STEP = { 14: 3, 6: 2 }, cache = new Map();
let ready = null, busy = null, want = null, timer = 0, passCache = { key: '', p: null };
export const WIN_IDS = { sun_days: 'sun', earth_days: 'earth', dark_days: 'dark' };
export const keyOf = st => `${st.tDay}|${st.mission}|${st.crit.sun}|${st.crit.earth}|${st.crit.dark}`;   // pixels near the criteria are refined hourly
export const useWin = st => st.basis !== 'year' || !st.adv;
export const winOf = st => cache.get(keyOf(st)) || null;
export const pending = st => useWin(st) && !cache.has(keyOf(st));
// a token that changes whenever the judged result changes (used by the ranked spots and the redraw)
export const winToken = st => useWin(st) ? keyOf(st) + (cache.has(keyOf(st)) ? '' : '?') : 'year';

const NW = Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));   // workers, each takes a band of rows (2 of them: about 2.5 s for a 14-day stay on a laptop)
let workers = [], parts = null;
function start() {
  if (ready) return ready;
  return ready = ensure().then(() => {
    const B = bodiesData();
    for (let w = 0; w < NW; w++) {
      const wk = new Worker(new URL('./winworker.js', import.meta.url));
      wk.postMessage({ type: 'init', hor: shadow.horizonBuf(), S: B.S, E: B.E, n: B.n });
      wk.onmessage = e => {
        const m = e.data; if (!busy || m.key !== busy.key) return;
        if (m.type === 'prog') { parts.done[m.i0] = m.done; onProg && onProg(m.key, progressOf()); return; }
        parts.sun.set(m.sun, m.i0); parts.earth.set(m.earth, m.i0); parts.dark.set(m.dark, m.i0); parts.ms = Math.max(parts.ms, m.ms);
        if (--parts.left) return;
        cache.set(m.key, { sun: parts.sun, earth: parts.earth, dark: parts.dark, ms: parts.ms }); busy = null;
        if (cache.size > 10) cache.delete(cache.keys().next().value);
        if (want && !cache.has(want.key)) post(want); else want = null;
        setState({}, 'pixels');
      };
      workers.push(wk);
    }
  });
}
// start the workers early (their per-pixel set-up takes a few seconds), so they are ready when the stay is asked for
export const warmWin = () => start();
// share of the running window done (0..1), from the workers' progress notes
let onProg = null;
const progressOf = () => parts ? Object.values(parts.done).reduce((a, b) => a + b, 0) / NW : 0;
export const setWinProgress = f => { onProg = f; };
export const winProgress = st => busy && busy.key === keyOf(st) ? progressOf() : 0;
function post(j) {
  busy = j; want = null; parts = { sun: new Uint8Array(NPX), earth: new Uint8Array(NPX), dark: new Uint16Array(NPX), left: NW, ms: 0, done: {} };
  const per = Math.ceil(800 / NW) * 800;
  workers.forEach((wk, w) => wk.postMessage({ type: 'run', ...j, i0: w * per, i1: Math.min(NPX, (w + 1) * per) }));
}
// ask for the window of the current state (debounced; only the latest request waits behind a running one)
export function syncWin(st) {
  if (!useWin(st) || cache.has(keyOf(st))) return;
  const j = { key: keyOf(st), day: st.tDay, mission: st.mission, step: STEP[st.mission] || 3, crit: { sun: st.crit.sun, earth: st.crit.earth, dark: st.crit.dark } };
  if (busy && busy.key === j.key) return;
  clearTimeout(timer);
  timer = setTimeout(() => start().then(() => { if (busy) want = j; else post(j); }), busy ? 0 : 60);
}
// per criterion layer: 1 = pass, 0 = fail over the window (null while not computed)
// pass with half a step of margin, so a green pixel is always GO in the pin card
export function winPass(st) {
  const w = winOf(st); if (!w || !useWin(st)) return null;
  const c = st.crit, k = keyOf(st) + JSON.stringify(c);
  if (passCache.key === k) return passCache.p;
  const s = new Uint8Array(NPX), e = new Uint8Array(NPX), d = new Uint8Array(NPX), cs = 2 * c.sun, ce = 2 * c.earth;
  for (let i = 0; i < NPX; i++) { s[i] = w.sun[i] > cs ? 1 : 0; e[i] = w.earth[i] > ce ? 1 : 0; d[i] = w.dark[i] < c.dark ? 1 : 0; }
  passCache = { key: k, p: { sun_days: s, earth_days: e, dark_days: d } };
  return passCache.p;
}
// the window arrays for the chosen day and stay, from any criteria (the values barely depend on them): for the factor map
let wvId = 0; const wvIds = new WeakMap();
export function winVals(st) {
  if (!useWin(st)) return null;
  const pre = `${st.tDay}|${st.mission}|`;
  let w = cache.get(keyOf(st)); if (!w) for (const [k, x] of cache) if (k.startsWith(pre)) { w = x; break; }
  if (!w) return null;
  if (!wvIds.has(w)) wvIds.set(w, ++wvId);
  return { sun: w.sun, earth: w.earth, dark: w.dark, id: wvIds.get(w) };
}
// window values at a pixel: { sun %, earth %, dark h }
export function winAt(st, i) { const w = winOf(st); return w && useWin(st) ? { sun: w.sun[i] / 2, earth: w.earth[i] / 2, dark: w.dark[i] } : null; }
