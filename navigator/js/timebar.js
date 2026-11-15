// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// One time bar for the shared 3D map, the same in Detail and Find a site: landing day, stay (14 / 6 days), play, the
// shown time within the stay, and that time in UTC. The lighting month follows the date by itself (js/view3d.js
// frameFor). Day, stay and hour live in the page state, so switching tabs keeps them; Find a site's panels follow.
import { state, setState } from './state.js';
import { FIRST_DAY } from './config.js';

const lang = (new URLSearchParams(location.search).get('lang') || 'en').startsWith('ko') ? 'ko' : 'en';
const TX = { en: { land: 'Landing', stay: 'Stay time', play: 'Play', prev: 'Day before', next: 'Day after', pole: 'Pole' }, ko: { land: '착륙일', stay: '체류 시각', play: '재생', prev: '전날', next: '다음 날', pole: '남극 전체' } }[lang];
const MON = lang === 'ko' ? null : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDay = ms => { const d = new Date(ms); return MON ? `${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}` : `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}.`; };
const fmtTime = ms => { const d = new Date(ms); return `${MON ? MON[d.getUTCMonth()] + ' ' + d.getUTCDate() : (d.getUTCMonth() + 1) + '/' + d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:00 UTC`; };

let el = null, r = null, timer = 0;
let poleFn = null;
export function init(host, o = {}) {
  poleFn = o.pole || null;
  el = document.createElement('div'); el.className = 'tbar'; el.hidden = true;
  el.innerHTML = `<button class="tb-pole">${TX.pole}</button><span class="tb-l">${TX.land}</span><button class="tb-p" aria-label="${TX.prev}">◀</button><b class="tb-d"></b><button class="tb-n" aria-label="${TX.next}">▶</button>
    <div class="seg tb-m"><button data-m="14">14 d</button><button data-m="6">6 d</button></div>
    <button class="tb-play" aria-label="${TX.play}" aria-pressed="false">▶</button><span class="tb-l">${TX.stay}</span><input class="tb-h" type="range" min="0" step="1" aria-label="${TX.stay}"><b class="tb-t"></b>`;
  host.append(el);
  r = { d: el.querySelector('.tb-d'), h: el.querySelector('.tb-h'), t: el.querySelector('.tb-t'), play: el.querySelector('.tb-play') };
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'dblclick', 'click']) el.addEventListener(ev, e => e.stopPropagation(), { passive: ev !== 'wheel' && ev !== 'click' ? true : undefined });
  el.querySelector('.tb-p').onclick = () => { stop(); setState({ day: Math.max(0, state.day - 1) }); };
  el.querySelector('.tb-n').onclick = () => { stop(); setState({ day: Math.min(364, state.day + 1) }); };
  el.querySelector('.tb-m').onclick = e => { const b = e.target.closest('[data-m]'); if (b) setState({ mission: +b.dataset.m }); };
  el.querySelector('.tb-pole').onclick = () => poleFn && poleFn();
  r.h.oninput = () => { stop(); setState({ hour: +r.h.value }); };
  r.play.onclick = () => { if (timer) stop(); else start(); render(state); };
}
function start() {
  stop();
  timer = setInterval(() => { const n = state.mission * 24, h = Math.floor(state.hour / 4) * 4 + 4; setState({ hour: h > n ? 0 : h }); }, 80);   // one lighting frame (4 h) a step: 14 d in about 7 s
}
function stop() { if (timer) { clearInterval(timer); timer = 0; } }
export function show(on) { if (!el) return; el.hidden = !on; if (!on) stop(); }
export function render(st) {
  if (!el || el.hidden) return;
  const t0 = FIRST_DAY + st.day * 864e5;
  r.d.textContent = fmtDay(t0);
  el.querySelectorAll('.tb-m button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.m === st.mission)));
  r.h.max = String(st.mission * 24); if (+r.h.value !== st.hour) r.h.value = String(st.hour);
  r.h.style.setProperty('--p', (st.hour / (st.mission * 24) * 100).toFixed(1) + '%');
  r.t.textContent = fmtTime(t0 + st.hour * 3600e3);
  r.play.textContent = timer ? '❚❚' : '▶'; r.play.setAttribute('aria-pressed', String(!!timer));
}
