// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// 3D view of the Compare map: the lunar/map3d module (Three.js) mounted over the 2D map.
// Loaded on first use only (module ~2 MB, one month of frames ~18 MB). Lighting frames exist for
// February, June and December 2027 (4 h steps); other dates show the same day-of-month and hour of the nearer
// computed month, and say so.
import { state, setState, limitsOf } from './state.js';
import { mastShown, nearestOk } from './logic.js';
import { ZOOM } from './config.js';
import { FIRST_DAY } from './config.js';
import { SPOT5 } from './map.js';
import * as intro from './intro.js';
import { openMastPop } from './mastpop.js';
import { t } from './strings.js';
import { initHover, hover } from './hover3d.js';
import { ranked } from './rank3d.js';
import { nearestField, nearestOf, linkOf } from './nearestgo.js';
import * as findlink from './findlink.js';
import * as timebar from './timebar.js';
import * as gomask from './gomask3d.js';
import { loadCam, saveCam, share, onShare } from './cam3d.js';
import { isDefault } from './criteria.js';

const SETS = [{ label: '2027-02', url: 'data/3d/frames_feb/', y: 2027, m: 1 }, { label: '2027-06', url: 'data/3d/frames/', y: 2027, m: 5 }, { label: '2027-12', url: 'data/3d/frames_dec/', y: 2027, m: 11 }];
const STEP_H = 4;
let lastCells = '', mapReady = false, lastZoom = null, onPin = null, hint, box, note, btns, map = null, loading = null, order = null, lastKey = '', lastSite = '', data = null;
let landerOn = false, landerBtn = null, poleBtn = null;
export function poleView() { landerOn = false; if (map && mapReady) map.focus(0, 0, 200, { dur: 1300, polar: 0.0005 }); render(state); }   // Lander view

export function init(panel, d, pinAt) {
  data = d; onPin = pinAt;
  const seg = document.createElement('div');
  seg.className = 'seg'; seg.id = 'dim';
  seg.innerHTML = '<button data-d="0">2D</button><button data-d="1">3D</button>';
  panel.appendChild(seg);
  btns = [...seg.children];
  btns.forEach(b => b.addEventListener('click', () => setState({ d3: Number(b.dataset.d) })));
  // Lander view (3D only): down beside the lander, looking toward Earth, close enough to see it and the mast whole
  const zoom = document.getElementById('zoom');
  if (zoom) {
    // Pole: the whole south pole (±200 km) from straight above, Earth up; the selected place stays selected
    poleBtn = document.createElement('button'); poleBtn.type = 'button'; poleBtn.className = 'z-pole'; poleBtn.textContent = t('zoomPole');
    poleBtn.addEventListener('click', e => { e.stopPropagation(); poleView(); });
    zoom.prepend(poleBtn);
    landerBtn = document.createElement('button'); landerBtn.type = 'button'; landerBtn.dataset.z = 'lander'; landerBtn.textContent = t('zoomLander');
    landerBtn.addEventListener('click', () => { landerOn = true; landerView(); render(state); });
    // Region / Site / Spot leave it: first (capture) so their own move is the usual one; same zoom as before: move back here
    let was = null;
    zoom.addEventListener('click', e => { const b = e.target.closest('button'); was = landerOn && b && b !== landerBtn ? state.zoom : null; if (was !== null) landerOn = false; }, true);
    zoom.addEventListener('click', () => { if (was !== null && state.zoom === was && map && !entering) recenter(); if (was !== null) render(state); was = null; });
    zoom.appendChild(landerBtn);
  }
  box = document.createElement('div'); box.id = 'map3d'; box.hidden = true;
  hint = document.createElement('div'); hint.id = 'space-hint'; hint.hidden = true; hint.textContent = t('spaceHint'); panel.appendChild(hint);
  note = document.createElement('div'); note.id = 'note3d'; note.hidden = true;
  panel.append(box, note);
  timebar.init(box, { pole: () => poleView() });   // one time bar for both tabs
  addEventListener('resize', place);
}

// which frame shows the Compare date: same month -> nearest 4 h frame; other months -> same day/hour of the nearer one
export function frameFor(day, hour) {
  const ms = FIRST_DAY + (day * 24 + hour) * 3600e3, d = new Date(ms);
  const mon = d.getUTCMonth(), dist = m => Math.min(Math.abs(mon - m), 12 - Math.abs(mon - m));
  let k = 0;
  SETS.forEach((S, j) => { if (dist(S.m) < dist(SETS[k].m)) k = j; });
  const S = SETS[k];
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
  if (document.getElementById('main').classList.contains('full') || state.view === 'find') { Object.assign(box.style, { left: '0px', top: '0px', width: '100%', height: '100%' }); return; }
  const r = svg.getBoundingClientRect(), b = box.parentNode.getBoundingClientRect();   // an <svg> has no offsetLeft
  // down to the bottom of the panel: in Detail the map column is taller than the square 2D map
  Object.assign(box.style, { left: r.left - b.left + 'px', top: r.top - b.top + 'px', width: r.width + 'px', height: Math.max(r.height, b.bottom - r.top - 1) + 'px' });
}

async function mount() {
  if (loading) return loading;
  const f = frameFor(state.day, state.hour);
  order = [f.k, ...SETS.map((_, j) => j).filter(j => j !== f.k)];      // the month in use loads first; the others on first switch
  const lang = (new URLSearchParams(location.search).get('lang') || 'en').startsWith('ko') ? 'ko' : 'en';
  box.classList.add('loading');
  initHover(box);
  loading = import('../map3d/map3d.js').then(({ mountLunarMap }) => {
    map = mountLunarMap(box, {
      datasets: order.map(j => ({ label: SETS[j].label, url: SETS[j].url })),
      sitesUrl: 'data/3d/sites.json', landmarksUrl: 'data/orientation/landmarks.json', landersUrl: 'data/orientation/landers.json',
      lang, frame: f.i,
      onSpace: () => recenter(),
      onMastClick: () => openMastPop(data),   // Space: back to the selected site, Earth side up
      // clicks pick like the 2D map: a marker selects that site, the ground drops a pin there
      onSiteClick: id => { const s = data.index.byId[id]; if (!s) return; if (state.view === 'find') findlink.send({ type: 'click', x: s.x_m, y: s.y_m }); else setState({ site: id }); },
      onMapClick: (x, y) => { if (state.view === 'find') findlink.send({ type: 'click', x, y }); else if (onPin) onPin(Math.round(x), Math.round(y)); },
      onPinClick: p => { if (state.view === 'find') { findlink.send({ type: 'pick', col: p.col, row: p.row }); map.focus(p.x, p.y, 14); } else if (onPin) onPin(Math.round(p.x), Math.round(p.y)); },
      style: 'glow', psrUrl: 'layers/data/psr.wasm', onHover: hover, onCamera: c => { if (!entering && performance.now() > quietUntil) saveCam(c, 'detail'); },   // LLSN-like look: stars, gold where Sun and Earth are in view, soft blue permanent shadow; a card follows the cursor
      moonUrl: 'data/moon.jpg', sunUrl: 'data/sun_sdo_512.png', earthUrl: 'data/earth_bluemarble_1024.jpg', bodyMarkers: false,   // NASA SVS CGI Moon Kit, the globe under the terrain patch
    });
    return map.ready;
  }).then(() => { if (map.setBottom) map.setBottom(64); box.classList.remove('loading'); lastKey = ''; lastSite = ''; lastCells = ''; mapReady = true; return arrive(); })
    .catch(e => { console.error('[3d]', e); box.classList.remove('loading'); });
  return loading;
}

// the map appears looking straight down on the pole (Earth up). After the opening shot it starts where the shot
// ended (~1,400 km up) and keeps going down; then it flies to the selected place, or, on a fresh visit with nothing
// chosen yet, tilts to the oblique view of the whole region
const TOP_R = 1390, REGION_R = 760;
let entering = false;
const HASH0 = location.hash;   // as opened (the page rewrites the hash with the default site soon after)
const CAM0 = loadCam('detail');   // read before this page saves its own view
let quietUntil = 0, shareKey = { day: '', spot: '' };
// Find a site (in its frame) moved the view, changed the day or picked a spot: follow it
onShare('detail', (k, v) => {
  if (k === 'cam3d' && map && mapReady && map.setCam) { quietUntil = performance.now() + 900; map.setCam(v); }
  else if (k === 'day' && Number.isFinite(v.day)) { shareKey.day = `${v.day}|${v.mission}`; if (v.day !== state.day || v.mission !== state.mission) setState({ day: v.day, mission: v.mission === 6 ? 6 : 14 }); }
  else if (k === 'spot' && Number.isFinite(v.x_m) && onPin) {
    shareKey.spot = `${Math.round(v.x_m / 500)},${Math.round(v.y_m / 500)}`;
    const s = data && data.index && data.index.byId[state.site];
    if (!s || Math.hypot(s.x_m - v.x_m, s.y_m - v.y_m) > 400) onPin(Math.round(v.x_m), Math.round(v.y_m));
  }
});
function shareOut(st) {
  const dk = `${st.day}|${st.mission}`;
  if (dk !== shareKey.day) { shareKey.day = dk; share('day', { day: st.day, mission: st.mission }, 'detail'); }
  const s = data && data.index && data.index.byId[st.site];
  if (s) { const sk = `${Math.round(s.x_m / 500)},${Math.round(s.y_m / 500)}`; if (sk !== shareKey.spot) { shareKey.spot = sk; share('spot', { x_m: s.x_m, y_m: s.y_m }, 'detail'); } }
}
async function arrive() {
  const fromIntro = intro.phase === 'playing';
  entering = true;
  map.setCamera(0, 0, fromIntro ? TOP_R : REGION_R);
  sync(state);   // frame, marks, selected site (the camera stays put while entering)
  if (fromIntro) { await intro.arrived; const skip = intro.phase === 'skipped'; intro.handOver(); await map.focus(0, 0, 0, { r: REGION_R, polar: 0.0005, dur: skip ? 0 : 1600 }); }
  entering = false;
  if (window.__fresh) { await map.focus(0, 0, 0, { r: 700, dur: 1300 }); return; }
  // the same view as the other screen (Find a site) when it was used a moment ago
  const c = !fromIntro && map.setCam && !/[#&]s=/.test(HASH0) ? CAM0 : null;   // a link naming a site wins
  if (c) { map.setCam(c); return; }
  recenter(1300);
}

let maskKey = '';
function syncMask(st) {
  // GO for the chosen day (14-day stay, default criteria: the per-cell calendar exists for those): blue on the map
  const on = st.mission === 14 && isDefault(st.crit), k = on ? 'd' + st.day : 'off';
  if (k === maskKey) return; maskKey = k;
  if (!on) { map.setMask(null); return; }
  gomask.load().then(() => { if (maskKey === k) { map.setMask(gomask.maskFor(st.day)); rankKey = ''; syncRank(state); } });
}
// Find a site tab: its GO ground, ranked spots and picked spot on this map (js/findlink.js)
let findShown = false;
function syncFind() {
  findShown = true;
  const d = findlink.data();
  map.setMask(findlink.mask());
  const pins = d.rank.slice(0, 5).map(r => { const x = (r.col + .5) * 500 - 200000, y = 200000 - (r.row + .5) * 500; return { x, y, col: r.col, row: r.row, label: '#' + r.id, kind: 'rank' }; });
  if (d.pin && !d.rank.slice(0, 5).some(r => r.col === d.pin.col && r.row === d.pin.row)) pins.push({ x: (d.pin.col + .5) * 500 - 200000, y: 200000 - (d.pin.row + .5) * 500, col: d.pin.col, row: d.pin.row, kind: 'pin' });
  map.setPins(pins);
  setNear(findlink.near(), d.rank);
  syncLink(state);
}
// the picked spot (Find a site's pin, or Detail's selected place), when NO-GO: a dashed line to the nearest GO ground
let nearCur = null, rankCur = [], linkKey = '', nearGen = 0;
function setNear(f, list) { nearCur = f; rankCur = list || []; nearGen++; }
function syncLink(st) {
  let c = null;
  if (st.view === 'find') { const p = findlink.data().pin; if (p) c = p; }
  // Detail: its own 'Move N km to GO' mark already does this for the selected place
  const k = c && nearCur ? `${st.view}|${c.col},${c.row}|${nearGen}` : '';
  if (k === linkKey) return; linkKey = k;
  map.setLink(k ? linkOf(nearestOf(nearCur, c.col, c.row, rankCur), (new URLSearchParams(location.search).get('lang') || 'en').startsWith('ko') ? 'ko' : 'en') : null);
}
findlink.onHl((c, r) => { if (map && mapReady && map.highlightPin) map.highlightPin(c, r); });
findlink.onFly((x, y, half) => { if (map && mapReady) map.focus(x, y, half, { dur: 1400 }); });
findlink.onChange(() => { if (map && mapReady && state.view === 'find') syncFind(); });
export const getMap = () => map;
// the best spots for the day and stay: green numbered markers; NO-GO cursor cards point to the nearest GO ground
let rankKey = '';
function syncRank(st) {
  const k = `${st.day}|${st.mission}|${st.crit.sun}|${st.crit.earth}|${st.crit.dark}|${maskKey}`;
  if (k === rankKey) return; rankKey = k;
  ranked(st.day, st.mission, st.crit).then(list => {
    if (rankKey !== k) return;
    const top = list.slice(0, 5);
    map.setPins(top.map(r => ({ x: r.x, y: r.y, col: r.col, row: r.row, label: '#' + r.id, kind: 'rank' })));
    const ga = maskKey !== 'off' ? gomask.goArr() : null;   // the GO mask of the day when it exists, else the ranked GO spots
    const set = ga ? null : new Set(list.map(r => r.row * 800 + r.col));
    setNear(ga ? nearestField(i => ga[i] === 1) : list.length ? nearestField(i => set.has(i)) : null, list.map(r => r.id <= 5 ? r : { ...r, id: 0 }));   // numbers only for the spots marked on the map
    syncLink(state);
  }).catch(e => console.error('[rank]', e));
}
function sync(st) {
  if (!map || !mapReady || !data.index) return;
  if (map.setMask) { if (st.view === 'find') syncFind(); else { if (findShown) { findShown = false; maskKey = ''; rankKey = ''; } syncMask(st); syncRank(st); syncLink(st); } }
  const f = frameFor(st.day, st.hour), key = `${f.k}:${f.i}`;
  if (key !== lastKey) {
    lastKey = key;
    const j = order.indexOf(f.k);
    Promise.resolve(map.setDataset(j)).then(() => { if (lastKey === key) map.setFrame(f.i); });
  }
  const s0 = data.index.byId[st.site], siteKey = s0 ? `${st.site}:${s0.x_m},${s0.y_m}` : st.site;   // a new pin is a new place
  if (siteKey !== lastSite) {
    lastSite = siteKey;
    const s = s0;
    if (s) { map.selectSite(st.site); if (!entering) recenter(); if (map.setDetail) map.setDetail(closeUp(st.site, s)); }
  }
  if (lastZoom === null) lastZoom = st.zoom;
  else if (st.zoom !== lastZoom) { lastZoom = st.zoom; recenter(); }   // Region / Site / Spot buttons
  const s = data.index.byId[st.site], e = data.index.modes[st.mission]?.sites[st.site];
  // the same mark as the 2D map: MOVE to the nearest GO cell
  const marks = [];
  if (s && e && data.site) {
    if (!e.ok[st.day]) {
      const n = nearestOk(data.site, st.day);
      if (n && n.d > 0) marks.push({ x1: s.x_m, y1: s.y_m, x2: s.x_m + n.c.dx * 1000, y2: s.y_m + n.c.dy * 1000, color: '#fff', w: 2, end: 'ring', label: t('moveToGo', +n.d.toFixed(1)) });
    }
  }
  // the 3 km MOVE grid on the ground, as on the MOVE card: GO cells blue, the rest dark; ring and cross as marks
  const det = st.view !== 'find';   // Find a site tab: no Detail grid, ring, mast or MOVE marks on the shared map
  const ck = det && s && data.site ? `${st.site}:${s.x_m},${s.y_m}:${st.day}` : '';
  if (map.setCells && ck !== lastCells) {
    lastCells = ck;
    map.setCells(ck ? data.site.grid.map(c => {
      const ok = c.ok[st.day] === '1';
      return { x: s.x_m + c.dx * 1000, y: s.y_m + c.dy * 1000, half: data.site.stepKm * 500, rgb: ok ? [0.455, 0.635, 0.949] : [0.13, 0.15, 0.2], a: ok ? (c.landable ? 0.85 : 0.45) : (c.landable ? 0.6 : 0.35) };
    }) : []);
  }
  if (s && data.site) {
    const R = 3000 + data.site.stepKm * 500, N = 48;
    for (let i = 0; i < N; i++) {
      const a0 = i / N * 2 * Math.PI, a1 = (i + 1) / N * 2 * Math.PI;
      marks.push({ x1: s.x_m + R * Math.sin(a0), y1: s.y_m + R * Math.cos(a0), x2: s.x_m + R * Math.sin(a1), y2: s.y_m + R * Math.cos(a1), color: '#74a2f2', w: 1.2 });
    }
    marks.push({ x1: s.x_m - 150, y1: s.y_m, x2: s.x_m + 150, y2: s.y_m, color: '#fff', w: 1.5 }, { x1: s.x_m, y1: s.y_m - 150, x2: s.x_m, y2: s.y_m + 150, color: '#fff', w: 1.5 });
  }
  if (map.setMarks) map.setMarks(det ? marks : []);
  const h = det && s && e ? mastShown(e, st.day, st.mast, limitsOf(st)) : 0;
  if (map.setMast) map.setMast(h, s?.x_m, s?.y_m, h ? t('mastPole', h) : '');
  note.hidden = f.exact;
  if (!f.exact) {
    const d = new Date(f.shown);
    note.textContent = t('only3d', d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours());
  }
}

// hillshade laid on the terrain for a close look: the site's 9 km patch (PGDA 5 m where there is one, else 20 m),
// or for a pin the 20 m tiles (5 km each) around it
function closeUp(id, s) {
  if (id !== 'pin') { const h = 4500; return [{ x0: s.x_m - h, x1: s.x_m + h, y0: s.y_m - h, y1: s.y_m + h, url: `data/${SPOT5.has(id) ? 'spot5' : 'spot'}/${id}.jpg` }]; }
  const T = 5, c0 = Math.floor((s.x_m / 1000 + 200) / T), r0 = Math.floor((200 - s.y_m / 1000) / T), out = [];
  for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
    if (c < 0 || r < 0 || c >= 80 || r >= 80) continue;
    const x0 = (-200 + c * T) * 1000, y1 = (200 - r * T) * 1000;
    out.push({ x0, x1: x0 + T * 1000, y0: y1 - T * 1000, y1, url: `data/t20/${c}_${r}.jpg` });
  }
  return out;
}

function landerView(dur = 1800) {
  const s = data && data.index && data.index.byId[state.site], e = data && data.index.modes[state.mission]?.sites[state.site];
  if (!map || !s || entering) return;
  const h = e ? mastShown(e, state.day, state.mast, limitsOf(state)) : 0;
  // the rig (lander, mast, panels) about 40 % of the map's height: k px per metre -> camera distance
  const H = box.clientHeight || 700, k = 0.4 * H / (Math.max(h, 4.3) + 1.2), ppm = k / (map.exaggeration ? map.exaggeration() : 3);
  map.focus(s.x_m, s.y_m, 0, { r: Math.max(0.03, H / (2 * Math.tan(15 * Math.PI / 180) * ppm * 1000)), polar: 1.25, dur });
}

// Space: centre the 3D camera on the selected site again
export function recenter(dur) {
  if (landerOn) { landerView(dur); return; }
  const s = data && data.index && data.index.byId[state.site];
  const half = state.zoom >= ZOOM.spot - 0.01 ? 3.5 : state.zoom >= ZOOM.site - 0.01 ? 25 : state.zoom > 1.01 ? 200 / state.zoom : 22;
  const spot = state.zoom >= ZOOM.spot - 0.01;   // Spot: straight down on the place, Earth up, like the MOVE card
  if (map && s && !entering) map.focus(s.x_m, s.y_m, spot ? 4 : half, { dur, polar: spot ? 0.0005 : undefined });
}
export const isOn = () => !!box && !box.hidden;

let sentTime = '';
export function render(st) {
  if (!box) return;
  if (data && data.index) shareOut(st);
  const on = st.view === 'find' || (!!st.d3 && st.view === 'focus');   // Find a site lays its panels over this same map
  btns.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.d) === (on ? 1 : 0))));
  if (poleBtn) poleBtn.hidden = !on;
  if (landerBtn) {
    landerBtn.hidden = !on;
    if (!on) landerOn = false;
    if (landerOn) landerBtn.parentNode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === landerBtn)));
    else landerBtn.setAttribute('aria-pressed', 'false');
  }
  document.getElementById('main').dataset.d3 = on ? '1' : '';
  box.hidden = !on;
  timebar.show(on); timebar.render(st);
  if (st.view === 'find') { const tk = `${st.day}|${st.mission}|${st.hour}`; if (tk !== sentTime) { sentTime = tk; findlink.send({ type: 'settime', day: st.day, mission: st.mission, hour: st.hour }); } } else sentTime = '';
  hint.hidden = !on;
  if (!on) { note.hidden = true; place(); intro.arrived.then(intro.handOver); return; }
  place();
  if (!map) mount(); else sync(st);
}
