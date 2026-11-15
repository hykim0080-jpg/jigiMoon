// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Movable pop-up panels on the full map: drag a panel by the bar on its top edge, double-click the bar to put it back.
// Positions are kept per panel in localStorage as an offset from the panel's normal place, and always kept inside the map.
// Off on narrow screens and in the grid of panels, where everything has a fixed place.
const KEY = 'mj-pos';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { /* storage off: start in place */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* ignore */ } };
const items = [];

// el: the panel; key: its name in storage; on(): whether dragging applies now
export function draggable(el, key, on = () => true) {
  if (!el || items.some(i => i.el === el)) return;
  const grip = document.createElement('div');
  grip.className = 'dgrip';
  grip.title = document.documentElement.lang === 'ko' ? '끌어서 옮기기 · 두 번 클릭하면 제자리로' : 'Drag to move · double-click to put back';
  const it = { el, key, on, grip };
  items.push(it);
  grip.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !active(it)) return;
    e.preventDefault(); e.stopPropagation();
    grip.setPointerCapture(e.pointerId);
    const [ox, oy] = saved[key] || [0, 0], sx = e.clientX, sy = e.clientY, r0 = el.getBoundingClientRect(), b = bounds(el);
    el.classList.add('dragging');
    const move = ev => {
      const dx = fit(ev.clientX - sx, b.left - r0.left, b.right - r0.right), dy = fit(ev.clientY - sy, b.top - r0.top, b.bottom - r0.bottom);
      saved[key] = [ox + dx, oy + dy];
      put(it);
    };
    const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); el.classList.remove('dragging'); save(); onMove(); };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  });
  grip.addEventListener('dblclick', e => { e.stopPropagation(); delete saved[key]; save(); put(it); onMove(); });
  for (const t of ['click', 'wheel', 'mousedown', 'touchstart']) grip.addEventListener(t, e => e.stopPropagation(), { passive: true });
}

let onMove = () => {};
export const onChange = (f) => { onMove = f; };
// has this panel been moved away from its normal place (and is moving on now)?
export const moved = (key) => { const it = items.find(i => i.key === key); return !!(it && active(it) && saved[key]); };

const small = () => matchMedia('(max-width:700px)').matches;
const active = (it) => !small() && it.on();
const fit = (v, lo, hi) => lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));
const bounds = (el) => (document.getElementById('main') || el.offsetParent || document.body).getBoundingClientRect();
const put = (it) => {
  const p = active(it) && saved[it.key];
  it.el.style.translate = p ? `${Math.round(p[0])}px ${Math.round(p[1])}px` : '';
};

// after each render: the grip back on top (renders may replace a panel's content), offsets on or off, and a panel
// pushed outside the map by a smaller window brought back in
export function refresh() {
  for (const it of items) {
    const on = active(it);
    if (on && it.grip.parentNode !== it.el) it.el.appendChild(it.grip);
    it.grip.hidden = !on;
    put(it);
    if (!on || !saved[it.key] || it.el.offsetParent === null) continue;
    const r = it.el.getBoundingClientRect(), b = bounds(it.el);
    if (!r.width) continue;
    const dx = fit(0, b.left - r.left, b.right - r.right), dy = fit(0, b.top - r.top, b.bottom - r.bottom);
    if (dx || dy) { saved[it.key] = [saved[it.key][0] + dx, saved[it.key][1] + dy]; put(it); }
  }
}
