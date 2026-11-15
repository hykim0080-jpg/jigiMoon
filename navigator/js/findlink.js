// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// One screen for Detail and Find a site: in the Find a site tab the page keeps its own 3D map (js/view3d.js) and lays
// Find a site's panels over it (layers/index.html?panels=1 in a see-through frame, layers/js/panels.js). The frame takes
// the pointer only over its panels; everywhere else the map gets it. The frame sends the GO ground of its day / stay /
// criteria, its ranked best spots and its picked spot; map clicks go back to it.
import { nearestField } from './nearestgo.js';
import { state, setState } from './state.js';

const N = 800;
let pushTime = true, frame = null, rects = [], go = null, rank = [], pin = null, photos = [], listeners = [], onPE = '', flyFn = null;
export function onFly(fn) { flyFn = fn; }
let hlFn = null; export function onHl(fn) { hlFn = fn; }
export const data = () => ({ go, rank, pin, photos });
export function onChange(fn) { listeners.push(fn); }
const changed = what => listeners.forEach(f => f(what));

function setPE(v) { if (frame && onPE !== v) { onPE = v; frame.style.pointerEvents = v; } }
const inPanel = (x, y) => { if (!frame) return false; const b = frame.getBoundingClientRect(), px = x - b.left, py = y - b.top; return rects.some(r => px >= r[0] && px <= r[2] && py >= r[1] && py <= r[3]); };

export function attach(iframe, o = {}) {
  pushTime = o.pushTime !== false;
  if (frame === iframe) return;
  frame = iframe; onPE = ''; setPE('none');
  iframe.addEventListener('load', () => { send({ type: 'hello' }); if (pushTime) send({ type: 'settime', day: state.day, mission: state.mission, hour: state.hour }); });   // the tab keeps this page's time, unless the link brought its own
}
export function send(m) { try { frame && frame.contentWindow && frame.contentWindow.postMessage({ mj: 1, ...m }, location.origin); } catch (e) { /* gone */ } }
export const active = () => !!frame && document.getElementById('main').dataset.view === 'find';

let maskCv = null, nearF = null;
export function mask() {
  if (!go) return null;
  if (!maskCv) { maskCv = document.createElement('canvas'); maskCv.width = maskCv.height = N; }
  const g = maskCv.getContext('2d'), im = g.createImageData(N, N), d = im.data;
  for (let i = 0; i < N * N; i++) if (go[i]) { d[i * 4] = 255; d[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  return maskCv;
}
export const near = () => nearF;
// one factor on the map (layers/js/factor.js): rgb = colour step, a = 255 meets the limit, 128 misses it, 0 no data
let fx = null, fxCv = null;
export function fxCanvas() {
  if (!fx) return null;
  if (!fxCv) { fxCv = document.createElement('canvas'); fxCv.width = fxCv.height = N; }
  const g = fxCv.getContext('2d'), im = g.createImageData(N, N); im.data.set(fx); g.putImageData(im, 0, 0);
  return fxCv;
}

addEventListener('message', e => {
  if (!frame || e.source !== frame.contentWindow || !e.data || !e.data.mj) return;
  const m = e.data;
  if (m.type === 'rects') { rects = m.rects || []; }
  else if (m.type === 'out') setPE('none');
  else if (m.type === 'mask') { go = m.go || null; nearF = go ? nearestField(i => go[i] === 1) : null; changed('mask'); }
  else if (m.type === 'fx') { fx = m.rgba || null; changed('fx'); }
  else if (m.type === 'photos') { photos = m.list || []; changed('photos'); }
  else if (m.type === 'rank') { rank = m.list || []; changed('rank'); }
  else if (m.type === 'pin') { pin = m.pin; changed('pin'); }
  else if (m.type === 'time') { if (active() && (m.day !== state.day || m.mission !== state.mission || m.hour !== state.hour)) setState({ day: m.day, mission: m.mission === 6 ? 6 : 14, hour: m.hour }); }   // the map shows Find a site's hour
  else if (m.type === 'fly') { if (active() && flyFn) flyFn(m.x, m.y, m.half); }
  else if (m.type === 'hl') { if (hlFn) hlFn(m.col, m.row); }
  else if (m.type === 'ready') { send({ type: 'hello' }); if (pushTime) send({ type: 'settime', day: state.day, mission: state.mission, hour: state.hour }); }
});
// over a panel the frame takes the pointer; elsewhere the map does
addEventListener('pointermove', e => { if (active()) setPE(inPanel(e.clientX, e.clientY) ? 'auto' : 'none'); }, true);
addEventListener('pointerdown', e => { if (active() && inPanel(e.clientX, e.clientY)) setPE('auto'); }, true);
