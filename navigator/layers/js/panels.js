// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Find a site as panels only (?panels=1): inside the main page, over Detail's 3D map. This page draws no map of its
// own; it tells the main page where its panels are (so the cursor reaches the map everywhere else), which ground is GO
// for the chosen day / stay / criteria, the ranked best spots and the picked spot. The main page sends map clicks back.
// The parent side is navigator/js/findlink.js.
import { N } from './config.js';
import { state, setState } from './state.js';
import { failCount } from './compose.js';
import { tripRanked, showRanks } from './trip.js';
import { pending } from './window.js';
import { fxImage } from './factor.js';
import { xyToCell, cellToXY } from './geo.js';

export const on = new URLSearchParams(location.search).get('panels') === '1' && parent !== window;
const post = m => { try { parent.postMessage({ mj: 1, ...m }, location.origin); } catch (e) { /* not embedded */ } };
const PANELS = 'header,.lyr-left,.lyr-pinp,.lyr-time,.lyr-pop,.lyr-hint,.lyr-cart,.lyr-home';
const SEE_THROUGH = new Set(['HTML', 'BODY']), isMapArea = t => !t || SEE_THROUGH.has(t.tagName) || (t.classList && (t.classList.contains('lyr-app') || t.classList.contains('lyr-main') || t.classList.contains('lyr-map') || t.id === 'layers-root'));

let lastFx = '', lastRects = '', lastRank = '', lastPin = '', lastTime = '', lastView = '', maskDirty = true, synced = false;
function rects() {
  const out = [];
  for (const e of document.querySelectorAll(PANELS)) {
    if (e.hidden || e.closest('[hidden]')) continue;
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const b = e.getBoundingClientRect(); if (b.width < 2 || b.height < 2) continue;
    out.push([Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]);
  }
  const k = JSON.stringify(out); if (k !== lastRects) { lastRects = k; post({ type: 'rects', rects: out }); }
}

export function init() {
  if (!on) return;
  document.documentElement.classList.add('panels');
  state.d3 = false;   // no map of its own
  synced = !!state.tTouched;   // a link with its own date leads; otherwise the main page's time does
  setInterval(rects, 200); addEventListener('resize', rects);
  // the pointer left the panels: hand it back to the map underneath
  const out = e => { if (isMapArea(e.target)) post({ type: 'out', x: e.clientX, y: e.clientY }); };
  addEventListener('pointermove', out, true); addEventListener('wheel', out, { capture: true, passive: true });
  addEventListener('message', e => {
    if (e.source !== parent || !e.data || !e.data.mj) return;
    const m = e.data;
    if (m.type === 'click' || m.type === 'pick') { showRanks(); const c = m.col != null ? { col: m.col, row: m.row } : xyToCell(m.x, m.y); if (c.col >= 0 && c.row >= 0 && c.col < N && c.row < N) setState({ pin: c, autoPin: false }, 'panel'); }
    if (m.type === 'settime') { synced = true; const mi = m.mission === 6 ? 6 : 14, d = Math.max(0, Math.min(364, m.day)), h = Math.max(0, Math.min(mi * 24 - 1, m.hour)); lastTime = `${d}|${mi}|${h}`; if (d !== state.tDay || mi !== state.mission || h !== state.tHour) setState({ tDay: d, plan: d, tHour: h, mission: mi, tTouched: true }, 'time'); }
    if (m.type === 'hello') { lastFx = '-'; lastRects = ''; lastRank = ''; lastPin = ''; lastTime = ''; maskDirty = true; render(state); }
  });
  // a ranked spot under the pointer in the list: its marker on the map stands out
  let hl = '';
  addEventListener('pointerover', e => {
    const tr = e.target.closest && e.target.closest('.lyr-tr[data-rank]'), r = tr ? (tripRanked() || [])[+tr.dataset.rank - 1] : null, k = r ? `${r.col},${r.row}` : '';
    if (k !== hl) { hl = k; post({ type: 'hl', col: r ? r.col : null, row: r ? r.row : null }); }
  });
  post({ type: 'ready' });
}
// after the composite changes (pixels)
export function repaint() { if (on) { maskDirty = true; render(state); } }
export function render(st) {
  if (!on) return;
  rects();
  const tk = `${st.tDay}|${st.mission}|${st.tHour}`; if (synced && tk !== lastTime) { lastTime = tk; post({ type: 'time', day: st.tDay, mission: st.mission, hour: st.tHour }); }
  if (maskDirty && failCount && !pending(st)) {
    maskDirty = false;
    const go = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) go[i] = failCount[i] === 0 ? 1 : 0;
    post({ type: 'mask', go, key: `${st.tDay}|${st.mission}` });
  } else if (pending(st)) { maskDirty = true; post({ type: 'mask', go: null }); }
  // one factor on the map (factor.js): its colour steps, dimmed where it misses the limit
  { const fx = st.factor ? fxImage(st) : null, k = fx ? fx.key : ''; if (k !== lastFx) { lastFx = k; post({ type: 'fx', rgba: fx ? fx.rgba.slice() : null }); } }
  // the 2D view this page would show (region, picked spot): the main page's 3D camera flies there
  const v = st.view, vk = v ? `${v.k.toFixed(2)},${v.cx.toFixed(1)},${v.cy.toFixed(1)}` : '';
  if (vk && vk !== lastView) {
    const first = !lastView; lastView = vk;
    if (!(first && v.k <= 1.01)) {
      const pn = st.pin, nearP = pn && Math.abs(pn.col + .5 - v.cx) < 400 / v.k && Math.abs(pn.row + .5 - v.cy) < 400 / v.k;
      const { x, y } = nearP ? cellToXY(pn.col, pn.row) : cellToXY(Math.round(v.cx - .5), Math.round(v.cy - .5));
      post({ type: 'fly', x: v.k <= 1.01 ? 0 : x, y: v.k <= 1.01 ? 0 : y, half: v.k <= 1.01 ? 200 : Math.max(4, Math.min(200, 200 / v.k)) });
    }
  }
  const rk = (tripRanked() || []).filter(r => r.go).map((r, k) => ({ col: r.col, row: r.row, id: k + 1, title: r.title || '' }));
  const rkk = JSON.stringify(rk); if (rkk !== lastRank) { lastRank = rkk; post({ type: 'rank', list: rk }); }
  const pin = st.pin && !st.autoPin ? `${st.pin.col},${st.pin.row}` : '';
  if (pin !== lastPin) { lastPin = pin; post({ type: 'pin', pin: pin ? { col: st.pin.col, row: st.pin.row } : null }); }
}
