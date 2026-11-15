// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Detail "full map": the centre map (2D/3D) fills the screen; sky, numbers, fixes and the year calendar
// open as pop-ups from a dock on the left. state.full = 0 brings back the grid of panels.
import { state, setState } from './state.js';
import { t } from './strings.js';

const PANELS = [['sky', 'sky-panel'], ['metrics', 'metrics-panel'], ['fixes', 'fixes'], ['cal', 'cal-panel']];
const open = new Set();   // the fixes read under the verdict; the Fixes panel (its map) opens from the dock
let main, dock, btns = {}, layoutBtn;

export const isFull = st => st.view === 'focus' && !!st.full && innerWidth > 700;

export function init(m) {
  main = m;
  dock = document.createElement('nav');
  dock.id = 'dock';
  for (const [k] of PANELS) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t('dock')[k]; b.dataset.dk = k;
    b.onclick = () => { open.has(k) ? open.delete(k) : open.add(k); sync(); dispatchEvent(new Event('resize')); };
    btns[k] = b; dock.appendChild(b);
  }
  main.appendChild(dock);
  addEventListener('resize', () => { if (isFull(state)) fitDock(); });
  setInterval(() => { if (isFull(state)) fitDock(); }, 1000);   // the 3D legend and the verdict height arrive later
  layoutBtn = document.createElement('button');
  layoutBtn.id = 'layout-btn'; layoutBtn.type = 'button';
  layoutBtn.onclick = () => setState({ full: state.full ? 0 : 1 });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !isFull(state) || document.getElementById('cal-panel').classList.contains('big')) return;
    if (open.size) { open.clear(); sync(); }
  });
}

function sync() {
  const on = isFull(state);
  for (const [k, id] of PANELS) {
    const shown = on && open.has(k);
    document.getElementById(id).classList.toggle('pop-open', shown);
    btns[k].setAttribute('aria-pressed', String(shown));
  }
}

export function render(st) {
  if (!main) return;
  const on = isFull(st);
  main.classList.toggle('full', on);
  dock.hidden = !on;
  const home = on ? dock : document.getElementById('map-panel');
  if (layoutBtn.parentNode !== home) home.appendChild(layoutBtn);
  layoutBtn.hidden = st.view !== 'focus' || innerWidth <= 700;
  layoutBtn.textContent = st.full ? t('layoutGrid') : t('layoutFull');
  // grid layout: sit left of the 2D/3D switch at the top of the map
  if (!on) requestAnimationFrame(() => { const d = document.getElementById('dim'); if (d) layoutBtn.style.right = (parseFloat(d.style.right || getComputedStyle(d).right) + d.offsetWidth + 6) + 'px'; });
  else layoutBtn.style.right = '';
  sync();
  if (on) requestAnimationFrame(fitDock);
}
// keep the dock clear of the 3D Sun / Earth / Both legend at the lower left: if the stack would reach it,
// the page controls go beside the panel buttons instead of under them
function fitDock() {
  dock.classList.remove('tight');
  const leg = main.querySelector('.lmap-seg'); if (!leg || !leg.offsetParent) return;
  const lr = leg.getBoundingClientRect(), dr = dock.getBoundingClientRect();
  if (lr.height && dr.bottom > lr.top - 8 && dr.left < lr.right) dock.classList.add('tight');
}
