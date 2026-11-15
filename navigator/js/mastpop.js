// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// MAST side view as a pop-up: opened by clicking the pole on the 2D or 3D map. Esc, the ×, or a click outside closes it.
import { state, limitsOf } from './state.js';
import { mastShown, blockage } from './logic.js';
import { mastSide } from './figs.js';

let pop = null;
export function openMastPop(data) {
  const st = state, e = data.index.modes[st.mission]?.sites[st.site];
  const h = e ? mastShown(e, st.day, st.mast, limitsOf(st)) : 0;
  if (!h) return;
  const b = data.site ? blockage(data.site.sky, st.day * 24 + st.hour) : {}, tg = !b.earth && b.sun ? 'sun' : 'earth';
  if (!pop) {
    pop = document.createElement('div'); pop.id = 'mast-pop'; pop.hidden = true;
    pop.innerHTML = '<button type="button" aria-label="Close">×</button><div></div>';
    document.body.appendChild(pop);
    pop.firstChild.onclick = close;
    addEventListener('keydown', ev => { if (ev.key === 'Escape' && !pop.hidden) { ev.stopImmediatePropagation(); close(); } }, true);
    addEventListener('pointerdown', ev => { if (!pop.hidden && !pop.contains(ev.target) && !ev.target.closest('.mastpole,.lmap-mast')) close(); }, true);
  }
  pop.lastChild.innerHTML = mastSide(h, tg);
  pop.hidden = false;
}
export function close() { if (pop) pop.hidden = true; }
