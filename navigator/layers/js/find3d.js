// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Find a site in 3D: the same 3D map as Detail (navigator/map3d, style 'glow'): terrain bent to the Moon's curvature
// and set into the whole Moon globe, stars, the real Sun/Earth lighting for the shown hour (gold = Sun in view), and
// on top of it the GO ground for the chosen landing day, stay and criteria (blue fill with a thin outline, the same
// mask as the 2D map). The camera is shared with Detail (js/cam3d.js). Hover shows the verdict card; click drops the pin.
import { N } from './config.js';
import { state, setState } from './state.js';
import { failCount, sample } from './compose.js';
import { tripRanked, statsFor, whyNoFix } from './trip.js';
import { pending } from './window.js';
import { lang } from './strings.js';
import { cellToXY, xyToCell } from './geo.js';
import { SETS, frameFor } from '../../js/frames3d.js';
import { loadCam, saveCam, share, onShare } from '../../js/cam3d.js';

const TX = {
  en: { go: 'GO', nogo: 'NO-GO', sun: 'Sun', earth: 'Earth', dark: 'Longest dark', slope: 'Slope', ice: 'To ice (PSR)', stay: d => `${d}-day stay from this day`, year: 'yearly', psr: 'Permanent shadow · ice may be here', d2: '2D', d3: '3D', nodata: 'no data', terrain: 'Terrain', ridge: 'ridge / high ground', floor: 'low ground / crater floor', level: 'level ground', legGo: n => `Blue outline = GO for the whole ${n}-day stay`, legSun: 'Gold = in sunlight at the shown hour', legPsr: 'Dark blue = permanent shadow, ice may be here', only: (m, d, h) => `3D lighting: ${m}/${d} ${h}:00 UTC (nearest computed month)` },
  ko: { go: 'GO', nogo: 'NO-GO', sun: '햇빛', earth: '지구', dark: '최장 어둠', slope: '경사', ice: '얼음(영구 그림자)까지', stay: d => `이날부터 ${d}일 체류`, year: '연평균', psr: '영구 그림자 · 얼음이 있을 수 있음', d2: '2D', d3: '3D', nodata: '자료 없음', terrain: '지형', ridge: '능선·높은 곳', floor: '낮은 곳·분화구 바닥', level: '평지', legGo: n => `파란 테두리 = ${n}일 체류 내내 GO`, legSun: '금색 = 그 시각 햇빛이 드는 곳', legPsr: '짙은 파랑 = 영구 그림자, 얼음이 있을 수 있음', only: (m, d, h) => `3D 조명: ${m}/${d} ${h}:00 UTC (가장 가까운 계산 달)` },
};
const tx = (k, ...a) => { const v = (TX[lang] || TX.en)[k]; return typeof v === 'function' ? v(...a) : v; };
const HASH0 = location.hash, CAM0 = loadCam('find');   // as opened, before this page saves its own view
let quietUntil = 0, pendingCam = null;
const shareKey = { day: '', spot: '' };
// Detail moved the view, changed the day or picked a site: follow it
onShare('find', (k, v) => {
  if (k === 'cam3d') { if (map && ready) { quietUntil = performance.now() + 900; map.setCam(v); lastView = viewKey(state.view); } else pendingCam = v; }
  else if (k === 'day' && Number.isFinite(v.day)) {
    shareKey.day = `${v.day}|${v.mission}`;
    if (v.day !== state.tDay || v.mission !== state.mission) setState({ tDay: Math.max(0, Math.min(364, v.day)), plan: Math.max(0, Math.min(364, v.day)), tTouched: true, mission: v.mission === 6 ? 6 : 14 }, 'time');
  } else if (k === 'spot' && Number.isFinite(v.x_m)) {
    const c = xyToCell(v.x_m, v.y_m); shareKey.spot = `${c.col},${c.row}`;
    if (c.col >= 0 && c.row >= 0 && c.col < N && c.row < N && !(state.pin && state.pin.col === c.col && state.pin.row === c.row)) setState({ pin: c, autoPin: false }, 'panel');
  }
});
function shareOut(st) {
  const dk = `${st.tDay}|${st.mission}`;
  if (dk !== shareKey.day) { shareKey.day = dk; share('day', { day: st.tDay, mission: st.mission }, 'find'); }
  if (st.pin && !st.autoPin) { const sk = `${st.pin.col},${st.pin.row}`; if (sk !== shareKey.spot) { shareKey.spot = sk; const { x, y } = cellToXY(st.pin.col, st.pin.row); share('spot', { x_m: x, y_m: y }, 'find'); } }
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let D = null, root = null, box = null, tip = null, leg = null, note = null, map = null, loading = null, ready = false, on = false;
let order = null, lastFrame = '', lastPins = '', lastView = '', flyT = 0, maskCv = null, maskDirty = true, elev = null;

export function init(panel, data) {
  D = data;
  root = Object.assign(document.createElement('div'), { className: 'f3d', hidden: true });
  root.innerHTML = `<div class="f3d-map"></div><div class="f3d-leg"><span class="go"></span><span class="sun">${tx('legSun')}</span><span class="psr">${tx('legPsr')}</span></div><div class="f3d-note" hidden></div><div class="g3d-tip" hidden></div>`;
  box = root.querySelector('.f3d-map'); tip = root.querySelector('.g3d-tip'); leg = root.querySelector('.f3d-leg'); note = root.querySelector('.f3d-note');
  panel.append(root);
  // the 2D map listens on the whole panel: keep 3D gestures to the 3D view
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'dblclick', 'click', 'pointerleave']) root.addEventListener(ev, e => e.stopPropagation());
  const seg = Object.assign(document.createElement('div'), { className: 'seg lyr-dim' });
  seg.innerHTML = `<button data-d="0">${tx('d2')}</button><button data-d="1">${tx('d3')}</button>`;
  seg.onclick = e => { e.stopPropagation(); const b = e.target.closest('[data-d]'); if (b) setState({ d3: b.dataset.d === '1' }, 'view'); };
  seg.onpointerdown = seg.ondblclick = e => e.stopPropagation();
  panel.append(seg);
  addEventListener('pagehide', () => { if (map && ready) saveCam(map.getCam(), 'find'); });
}

function mount() {
  if (loading) return loading;
  const f = frameFor(state.tDay, state.tHour);
  order = [f.k, ...SETS.map((_, j) => j).filter(j => j !== f.k)];
  root.classList.add('loading');
  loading = import('../../map3d/map3d.js').then(({ mountLunarMap }) => {
    map = mountLunarMap(box, {
      style: 'glow', lang,
      datasets: order.map(j => ({ label: SETS[j].label, url: '../' + SETS[j].url })),
      sitesUrl: '../data/3d/sites.json', landmarksUrl: '../data/orientation/landmarks.json', landersUrl: '../data/orientation/landers.json',
      moonUrl: '../data/moon.jpg', sunUrl: '../data/sun_sdo_512.png', earthUrl: '../data/earth_bluemarble_1024.jpg', bodyMarkers: false,
      psrUrl: 'data/psr.wasm', frame: f.i,
      onHover: hover, onPinHover: (p, el) => { if (!p) { tip.hidden = true; return; } const b = el.getBoundingClientRect(); hover({ x: p.x, y: p.y, cx: b.right, cy: b.top }); },
      onCamera: c => { if (performance.now() > quietUntil) saveCam(c, 'find'); },
      onSpace: () => {},
      onSiteClick: id => { const s = D.sites.find(q => q.id === id); if (s) { const c = xyToCell(s.x_m, s.y_m); setState({ site: s.id, pin: c, autoPin: false }, 'panel'); map.focus(s.x_m, s.y_m, 18); } },
      onMapClick: (x, y) => { const c = xyToCell(x, y); if (c.col >= 0 && c.row >= 0 && c.col < N && c.row < N) setState({ pin: c, autoPin: false }, 'panel'); },
      onPinClick: p => { setState({ pin: { col: p.col, row: p.row }, autoPin: false }, 'panel'); map.focus(p.x, p.y, 14); },
    });
    return map.ready;
  }).then(() => {
    ready = true; root.classList.remove('loading');
    // the view Detail was showing, unless this link names a region, a site or a pin
    const c = pendingCam || (/[#&](r|pin|s)=/.test(HASH0) && !/embed=1/.test(location.search) ? null : CAM0);   // inside Detail: keep Detail's view
    if (c) { map.setCam(c); lastView = viewKey(state.view); }
    else { lastView = ''; }
    maskDirty = true; lastFrame = ''; lastPins = '';
    sync(state);
  }).catch(e => { console.error('[3d]', e); root.classList.remove('loading'); loading = null; });
  return loading;
}

// ---- GO mask (red = GO) from the 2D composite ----
function paintMask() {
  if (!failCount) return null;
  if (!maskCv) { maskCv = document.createElement('canvas'); maskCv.width = maskCv.height = N; }
  const g = maskCv.getContext('2d'), im = g.createImageData(N, N), d = im.data;
  for (let i = 0; i < N * N; i++) if (failCount[i] === 0) { d[i * 4] = 255; d[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  return maskCv;
}

// ---- hover card ----
const goOf = (col, row) => { const f = failCount ? failCount[row * N + col] : 255; return f === 0 ? 1 : f === 255 ? -1 : 0; };
function terrainOf(col, row) {
  if (!elev) return '';
  let sum = 0, n = 0;
  for (let r = Math.max(0, row - 5); r <= Math.min(N - 1, row + 5); r++) for (let q = Math.max(0, col - 5); q <= Math.min(N - 1, col + 5); q++) { sum += elev[r * N + q]; n++; }
  const rel = elev[row * N + col] - sum / n, kind = rel > 120 ? tx('ridge') : rel < -120 ? tx('floor') : tx('level');
  return `<div class="s">${tx('terrain')} <b>${kind}, ${rel >= 0 ? '+' : '−'}${Math.abs(Math.round(rel))} m</b></div>`;
}
function loadElev() {
  if (elev) return;
  elev = new Float32Array(0);
  const img = new Image(); img.src = new URL('../data/elev500.png', import.meta.url).href;
  img.decode().then(() => {
    const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, N, N).data, z = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) z[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 4 - 8000;
    elev = z;
  }).catch(() => {});
}
function tipHtml(col, row, why) {
  const sm = sample(col, row); if (!sm) return '';
  const v = sm.values, w = sm.win, fails = new Set((sm.failIds || []).map(id => id.replace(/_days.*|14$/, ''))), i = row * N + col;
  const go = goOf(col, row), cr = state.crit || {};
  const sunV = w ? w.sun : v.sun, earthV = w ? w.earth : v.earth, darkV = w ? w.dark : null;
  const line = (k, label, val, lim) => `<div${fails.has(k) ? ' class="bad"' : ''}><small>${label}${lim ? ' ' + lim : ''}</small><b>${val}</b></div>`;
  const psr = D.bytes.psr && D.bytes.psr[i] >= 125 && D.bytes.psr[i] <= 250, iv = D.bytes.ice ? D.bytes.ice[i] : 255;
  return `<div class="v ${go > 0 ? 'go' : 'no'}">${go > 0 ? tx('go') : go < 0 ? tx('nodata') : tx('nogo')}<small>${w ? tx('stay', state.mission) : tx('year')}</small></div>
    <div class="m">${line('sun', tx('sun'), sunV == null ? '–' : Math.round(sunV) + ' %', cr.sun ? '≥' + cr.sun : '')}${line('earth', tx('earth'), earthV == null ? '–' : Math.round(earthV) + ' %', cr.earth ? '≥' + cr.earth : '')}${darkV != null ? line('dark', tx('dark'), Math.round(darkV) + ' h', cr.dark ? '≤' + cr.dark : '') : ''}${line('slope', tx('slope'), v.slope == null ? '–' : v.slope.toFixed(1) + '°', '≤8')}</div>
    ${go === 0 && why ? `<div class="why">${why}</div>` : ''}
    ${terrainOf(col, row)}
    <div class="s">${psr ? tx('psr') : `${tx('ice')} <b>${iv <= 250 ? (iv / 10).toFixed(1) + ' km' : '>25 km'}</b>`}</div>`;
}
let last = null, raf = 0, req = 0;
function hover(p) {
  last = p; if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0; const q = last;
    if (!q) { tip.hidden = true; return; }
    const c = xyToCell(q.x, q.y); if (c.col < 0 || c.row < 0 || c.col >= N || c.row >= N) { tip.hidden = true; return; }
    const show = why => {
      const h = tipHtml(c.col, c.row, why); tip.innerHTML = h; tip.hidden = !h;
      const r = root.getBoundingClientRect();
      const ins = insetsNow(), right = r.width - ins[1] - 8, tw = tip.offsetWidth;
      let lx = q.cx - r.left + 18; if (lx + tw > right) lx = q.cx - r.left - 18 - tw;
      tip.style.left = clamp(lx, ins[0] + 4, Math.max(ins[0] + 4, right - tw)) + 'px'; tip.style.top = clamp(q.cy - r.top + 18, 4, r.height - tip.offsetHeight - 8) + 'px';
    };
    show(null);
    // the reason sentence (failreason.js) needs the spot's own hourly series: computed once per spot, then cached
    if (goOf(c.col, c.row) === 0) {
      const my = ++req, d = state.tDay, m = state.mission, cr = state.crit;
      statsFor(c.col, c.row, m).then(() => { if (my === req && last === q) show(whyNoFix(c.col, c.row, d, cr, m)); }).catch(() => {});
    }
  });
}

// ---- keep the 3D map in step with the page ----
const viewKey = v => `${v.k.toFixed(2)},${v.cx.toFixed(1)},${v.cy.toFixed(1)}`;
function followView(st) {
  const key = viewKey(st.view);
  if (key === lastView) return;
  const first = !lastView; lastView = key;
  clearTimeout(flyT);
  if (first && st.view.k <= 1.01) return;
  const v = st.view;
  flyT = setTimeout(() => {
    // the 2D view keeps a picked spot clear of the side panels; in 3D the spot itself goes to the centre of the open part
    const pn = state.pin, near = pn && Math.abs(pn.col + .5 - v.cx) < 400 / v.k && Math.abs(pn.row + .5 - v.cy) < 400 / v.k;
    const { x, y } = near ? cellToXY(pn.col, pn.row) : cellToXY(Math.round(v.cx - .5), Math.round(v.cy - .5));
    if (v.k <= 1.01) map.focus(0, 0, 200, { dur: 1400 }); else map.focus(x, y, clamp(200 / v.k, 4, 200), { dur: 1400 });
  }, 140);
}
// floating panels over the map (desktop): left criteria panel, right spot panel
function insetsNow() {
  const rr = root.getBoundingClientRect(), w = rr.width, out = [0, 0];
  for (const [sel, k] of [['.lyr-left', 0], ['.lyr-pinp', 1]]) {
    const e = document.querySelector(sel); if (!e) continue;
    const cs = getComputedStyle(e); if (cs.position !== 'absolute' || cs.display === 'none') continue;
    const b = e.getBoundingClientRect(); if (!b.width || b.bottom < rr.top + rr.height * .5) continue;
    if (k === 0 && b.right > rr.left && b.right < rr.left + w * .5) out[0] = b.right - rr.left;
    if (k === 1 && b.left < rr.right && b.left > rr.left + w * .5) out[1] = rr.right - b.left;
  }
  return out;
}
let lastIns = '';
function sync(st) {
  if (!ready) return;
  { const ins = insetsNow(), k = ins.join(','); if (k !== lastIns) { lastIns = k; map.setInsets(ins[0], ins[1]); } }
  const f = frameFor(st.tDay, st.tHour), fk = `${f.k}:${f.i}`;
  if (fk !== lastFrame) {
    lastFrame = fk; const j = order.indexOf(f.k);
    Promise.resolve(map.setDataset(j)).then(() => { if (lastFrame === fk) map.setFrame(f.i); });
    note.hidden = f.exact;
    if (!f.exact) { const d = new Date(f.shown); note.textContent = tx('only', d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours()); }
  }
  if (maskDirty) { maskDirty = false; map.setMask(pending(st) ? null : paintMask()); }   // no GO outline from the yearly fallback while the stay is computed
  const tops = (tripRanked() || []).filter(r => r.go).slice(0, 5), pin = st.pin && !st.autoPin ? st.pin : null;
  const pk = tops.map(r => r.col + ',' + r.row).join(';') + '|' + (pin ? pin.col + ',' + pin.row : '');
  if (pk !== lastPins) {
    lastPins = pk;
    const list = tops.map((r, k) => { const { x, y } = cellToXY(r.col, r.row); return { x, y, col: r.col, row: r.row, label: '#' + (k + 1), kind: 'go' }; });
    if (pin && !tops.some(r => r.col === pin.col && r.row === pin.row)) { const { x, y } = cellToXY(pin.col, pin.row); list.push({ x, y, col: pin.col, row: pin.row, kind: 'pin' }); }
    map.setPins(list);
  }
  leg.querySelector('.go').textContent = tx('legGo', st.mission || 14);
  const L2 = document.querySelector('.lyr-legend'); if (L2 && L2.offsetLeft) { leg.style.left = L2.offsetLeft + 'px'; note.style.left = L2.offsetLeft + 'px'; }
  followView(st);
}

export const isOn = () => on;
// after the 2D composite changes (date, stay, criteria): the GO mask follows
export function repaint() { maskDirty = true; if (ready && on) sync(state); }
export function render(st) {
  if (!root) return;
  if (shareKey.day || st.tTouched) shareOut(st); else { shareKey.day = `${st.tDay}|${st.mission}`; }
  const want = st.d3 !== false, panel = root.parentNode;
  panel.classList.toggle('d3', want);
  panel.querySelectorAll('.lyr-dim button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.d === '1') === want)));
  if (want !== on) { on = want; root.hidden = !on; if (on) { loadElev(); mount(); } else tip.hidden = true; }
  if (on && ready) sync(st);
}
