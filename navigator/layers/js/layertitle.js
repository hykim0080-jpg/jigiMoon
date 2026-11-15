// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// The layer on the map, named large at the map's top left, beside the left panel: "Sun · Feb 15 – Mar 1".
import { lang } from './strings.js';

const ko = lang === 'ko';
const NAME = ko ? { all: '전체 기준', sun: '햇빛', earth: '지구 보임', dark: '가장 긴 어둠', slope: '경사', ice: '얼음까지 거리' }
  : { all: 'All criteria', sun: 'Sunlight', earth: 'Earth in view', dark: 'Longest dark', slope: 'Slope', ice: 'Distance to ice' };
const day = d => { const t = new Date(Date.UTC(2027, 0, 1 + d)); return ko ? `${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일` : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
let el = null, main = null, last = '';
export function initLayerTitle(host) { main = host; el = document.createElement('div'); el.className = 'lyr-ltitle'; el.setAttribute('aria-live', 'polite'); host.append(el); }
export function renderLayerTitle(st) {
  if (!el) return;
  const k = st.factor || 'all', timed = k !== 'slope' && k !== 'ice';
  const txt = NAME[k] + (timed ? ` · ${day(st.tDay)} – ${day(st.tDay + (st.mission || 14))}` : '');
  if (txt !== last) { last = txt; el.textContent = txt; }
  // just right of the left panel, level with its top (or the map's corner when the panel is not beside the map)
  const lp = main.querySelector('.lyr-left'), mb = main.getBoundingClientRect(), b = lp && lp.offsetParent ? lp.getBoundingClientRect() : null;
  const beside = b && b.width && getComputedStyle(lp).position === 'absolute';
  el.hidden = innerWidth <= 700;
  el.style.left = (beside ? b.right - mb.left + 18 : 16) + 'px';
  el.style.top = (beside ? b.top - mb.top + 2 : 16) + 'px';
}
