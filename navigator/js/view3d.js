// 3D view of the Compare map: the lunar/map3d module (Three.js) mounted over the 2D map.
// Loaded on first use only (module ~2 MB, one month of frames ~18 MB). Lighting frames exist for
// June and December 2027 (4 h steps); other dates show the same day-of-month and hour of the nearer
// computed month, and say so.
import { state, setState } from './state.js';
import { FIRST_DAY } from './config.js';
import { t } from './strings.js';

const SETS = [{ label: '2027-06', url: 'data/3d/frames/', y: 2027, m: 5 }, { label: '2027-12', url: 'data/3d/frames_dec/', y: 2027, m: 11 }];
const STEP_H = 4;
let box, note, btns, map = null, loading = null, order = null, lastKey = '', lastSite = '', data = null;

export function init(panel, d) {
  data = d;
  const seg = document.createElement('div');
  seg.className = 'seg'; seg.id = 'dim';
  seg.innerHTML = '<button data-d="0">2D</button><button data-d="1">3D</button>';
  panel.appendChild(seg);
  btns = [...seg.children];
  btns.forEach(b => b.addEventListener('click', () => setState({ d3: Number(b.dataset.d) })));
  box = document.createElement('div'); box.id = 'map3d'; box.hidden = true;
  note = document.createElement('div'); note.id = 'note3d'; note.hidden = true;
  panel.append(box, note);
  addEventListener('resize', place);
}

// which frame shows the Compare date: same month -> nearest 4 h frame; other months -> same day/hour of the nearer one
export function frameFor(day, hour) {
  const ms = FIRST_DAY + (day * 24 + hour) * 3600e3, d = new Date(ms);
  const mon = d.getUTCMonth(), dist = m => Math.min(Math.abs(mon - m), 12 - Math.abs(mon - m));
  const k = dist(SETS[0].m) <= dist(SETS[1].m) ? 0 : 1, S = SETS[k];
  const exact = d.getUTCFullYear() === S.y && mon === S.m;
  const t0 = Date.UTC(S.y, S.m, 1), dim = new Date(Date.UTC(S.y, S.m + 1, 0)).getUTCDate();
  const tt = exact ? ms : Date.UTC(S.y, S.m, Math.min(d.getUTCDate(), dim), d.getUTCHours());
  const i = Math.max(0, Math.round((tt - t0) / (STEP_H * 3600e3)));
  return { k, i, exact, shown: t0 + i * STEP_H * 3600e3 };
}

function place() {
  const svg = document.getElementById('map'), zoom = document.getElementById('zoom'), seg = document.getElementById('dim');
  if (seg && zoom) seg.style.right = (8 + zoom.offsetWidth + 6) + 'px';
  if (!box || box.hidden) return;
  if (document.getElementById('main').classList.contains('full')) { Object.assign(box.style, { left: '0px', top: '0px', width: '100%', height: '100%' }); return; }
  const r = svg.getBoundingClientRect(), b = box.parentNode.getBoundingClientRect();   // an <svg> has no offsetLeft
  // down to the bottom of the panel: in Detail the map column is taller than the square 2D map
  Object.assign(box.style, { left: r.left - b.left + 'px', top: r.top - b.top + 'px', width: r.width + 'px', height: Math.max(r.height, b.bottom - r.top - 1) + 'px' });
}

async function mount() {
  if (loading) return loading;
  const f = frameFor(state.day, state.hour);
  order = f.k === 0 ? [0, 1] : [1, 0];      // the month in use loads first; the other one on first switch
  const lang = (new URLSearchParams(location.search).get('lang') || 'en').startsWith('ko') ? 'ko' : 'en';
  box.classList.add('loading');
  loading = import('../map3d/map3d.js').then(({ mountLunarMap }) => {
    map = mountLunarMap(box, {
      datasets: order.map(j => ({ label: SETS[j].label, url: SETS[j].url })),
      sitesUrl: 'data/3d/sites.json', landmarksUrl: 'data/orientation/landmarks.json', landersUrl: 'data/orientation/landers.json',
      lang, frame: f.i,
      onSpace: recenter,   // Space: back to the selected site, Earth side up
    });
    return map.ready;
  }).then(() => { box.classList.remove('loading'); lastKey = ''; lastSite = ''; sync(state); })
    .catch(e => { console.error('[3d]', e); box.classList.remove('loading'); });
  return loading;
}

function sync(st) {
  if (!map || !data.index) return;
  const f = frameFor(st.day, st.hour), key = `${f.k}:${f.i}`;
  if (key !== lastKey) {
    lastKey = key;
    const j = order.indexOf(f.k);
    Promise.resolve(map.setDataset(j)).then(() => { if (lastKey === key) map.setFrame(f.i); });
  }
  if (st.site !== lastSite) {
    lastSite = st.site;
    const s = data.index.byId[st.site];
    if (s) { map.selectSite(st.site); map.focus(s.x_m, s.y_m, 22); }
  }
  note.hidden = f.exact;
  if (!f.exact) {
    const d = new Date(f.shown);
    note.textContent = t('only3d', d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours());
  }
}

// Space: centre the 3D camera on the selected site again
export function recenter() {
  const s = data && data.index && data.index.byId[state.site];
  if (map && s) map.focus(s.x_m, s.y_m, 22);
}
export const isOn = () => !!box && !box.hidden;

export function render(st) {
  if (!box) return;
  const on = !!st.d3 && st.view === 'focus';
  btns.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.d) === (on ? 1 : 0))));
  document.getElementById('main').dataset.d3 = on ? '1' : '';
  box.hidden = !on;
  if (!on) { note.hidden = true; place(); return; }
  place();
  if (!map) mount(); else sync(st);
}
