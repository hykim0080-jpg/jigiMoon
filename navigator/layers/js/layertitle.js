// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// The picked layer, named large at the map's top left, beside the left panel (none over the GO map).
import { lang } from './strings.js';

const ko = lang === 'ko';
const NAME = ko ? { sun: '햇빛', earth: '지구 보임', dark: '가장 긴 어둠', slope: '경사', ice: '얼음(추정)' }
  : { sun: 'Sunlight', earth: 'Earth in view', dark: 'Longest dark', slope: 'Slope', ice: 'Ice (possibly)' };
let el = null, main = null, last = '';
export function initLayerTitle(host) { main = host; el = document.createElement('div'); el.className = 'lyr-ltitle'; el.setAttribute('aria-live', 'polite'); host.append(el); }
export function renderLayerTitle(st) {
  if (!el) return;
  const txt = st.factor ? NAME[st.factor] : '';   // nothing over the GO map; the factor's name when one is picked
  if (txt !== last) { last = txt; el.textContent = txt; }
  // just right of the left panel, level with its top (or the map's corner when the panel is not beside the map)
  const lp = main.querySelector('.lyr-left'), mb = main.getBoundingClientRect(), b = lp && lp.offsetParent ? lp.getBoundingClientRect() : null;
  const beside = b && b.width && getComputedStyle(lp).position === 'absolute';
  el.hidden = innerWidth <= 700 || !txt;
  el.style.left = (beside ? b.right - mb.left + 18 : 16) + 'px';
  el.style.top = (beside ? b.top - mb.top + 2 : 16) + 'px';
}
