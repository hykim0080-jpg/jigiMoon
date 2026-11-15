// 3D view of the Compare map: the lunar/map3d module (Three.js) mounted over the 2D map.
// Loaded on first use only (module ~2 MB, one month of frames ~18 MB). Lighting frames exist for
// June and December 2027 (4 h steps); other dates show the same day-of-month and hour of the nearer
// computed month, and say so.
import { state, setState, limitsOf } from './state.js';
import { mastShown, nearestOk, blockage, azToMapDir } from './logic.js';
import { ZOOM } from './config.js';
import { FIRST_DAY } from './config.js';
import { t } from './strings.js';

const SETS = [{ label: '2027-06', url: 'data/3d/frames/', y: 2027, m: 5 }, { label: '2027-12', url: 'data/3d/frames_dec/', y: 2027, m: 11 }];
const STEP_H = 4;
let lastZoom = null, onPin = null, hint, box, note, btns, map = null, loading = null, order = null, lastKey = '', lastSite = '', data = null;

export function init(panel, d, pinAt) {
  data = d; onPin = pinAt;
  const seg = document.createElement('div');
  seg.className = 'seg'; seg.id = 'dim';
  seg.innerHTML = '<button data-d="0">2D</button><button data-d="1">3D</button>';
  panel.appendChild(seg);
  btns = [...seg.children];
  btns.forEach(b => b.addEventListener('click', () => setState({ d3: Number(b.dataset.d) })));
  box = document.createElement('div'); box.id = 'map3d'; box.hidden = true;
  hint = document.createElement('div'); hint.id = 'space-hint'; hint.hidden = true; hint.textContent = t('spaceHint'); panel.appendChild(hint);
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
      // clicks pick like the 2D map: a marker selects that site, the ground drops a pin there
      onSiteClick: id => { if (data.index.byId[id]) setState({ site: id }); },
      onMapClick: (x, y) => { if (onPin) onPin(Math.round(x), Math.round(y)); },
      moonUrl: 'data/moon.jpg', sunUrl: 'data/sun_sdo_512.png', earthUrl: 'data/earth_bluemarble_1024.jpg', bodyMarkers: false,   // NASA SVS CGI Moon Kit, the globe under the terrain patch
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
  if (lastZoom === null) lastZoom = st.zoom;
  else if (st.zoom !== lastZoom) { lastZoom = st.zoom; recenter(); }   // Region / Site / Spot buttons
  const s = data.index.byId[st.site], e = data.index.modes[st.mission]?.sites[st.site];
  // the same marks as the 2D map: MOVE to the nearest GO cell, and toward a Sun/Earth hidden by a ridge
  const marks = [];
  if (s && e && data.site) {
    if (!e.ok[st.day]) {
      const n = nearestOk(data.site, st.day);
      if (n && n.d > 0) marks.push({ x1: s.x_m, y1: s.y_m, x2: s.x_m + n.c.dx * 1000, y2: s.y_m + n.c.dy * 1000, color: '#fff', w: 2, end: 'ring', label: t('moveToGo', +n.d.toFixed(1)) });
    }
    const b = blockage(data.site.sky, st.day * 24 + st.hour), L = 6000;
    for (const k of ['sun', 'earth']) {
      if (!b[k]) continue;
      const [dx, dy] = azToMapDir(s.lon, b[k].az);
      marks.push({ x1: s.x_m, y1: s.y_m, x2: s.x_m + dx * L, y2: s.y_m + dy * L, color: '#f0655a', w: 1.5, end: k === 'sun' ? '#f0a531' : '#74a2f2', label: t('hiddenBy')[k] });
    }
  }
  if (map.setMarks) map.setMarks(marks);
  const h = s && e ? mastShown(e, st.day, st.mast, limitsOf(st)) : 0;
  if (map.setMast) map.setMast(h, s?.x_m, s?.y_m, h ? t('mastPole', h) : '');
  note.hidden = f.exact;
  if (!f.exact) {
    const d = new Date(f.shown);
    note.textContent = t('only3d', d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours());
  }
}

// Space: centre the 3D camera on the selected site again
export function recenter() {
  const s = data && data.index && data.index.byId[state.site];
  const half = state.zoom >= ZOOM.spot - 0.01 ? 3.5 : state.zoom >= ZOOM.site - 0.01 ? 25 : state.zoom > 1.01 ? 200 / state.zoom : 22;
  if (map && s) map.focus(s.x_m, s.y_m, half);
}
export const isOn = () => !!box && !box.hidden;

export function render(st) {
  if (!box) return;
  const on = !!st.d3 && st.view === 'focus';
  btns.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.d) === (on ? 1 : 0))));
  document.getElementById('main').dataset.d3 = on ? '1' : '';
  box.hidden = !on;
  hint.hidden = !on;
  if (!on) { note.hidden = true; place(); return; }
  place();
  if (!map) mount(); else sync(st);
}
