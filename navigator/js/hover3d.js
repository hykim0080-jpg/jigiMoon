// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Detail 3D: a card that follows the cursor over the ground. It gives the GO / NO-GO verdict of the 500 m spot under
// the cursor for the chosen landing day and stay (computed here from the terrain horizon, like a dropped pin), the
// values against the criteria (misses in red) and the reason in one sentence (failreason.js), then slope, terrain,
// distance to permanent shadow, and whether the Sun and Earth are in view at the shown hour.
import { state, limitsOf } from './state.js';
import * as shadow from './shadow.js';
import { pinBodies, pinSeries } from './pin.js';
import { failStats, failReason } from './failreason.js';

const N = 800;
const lang = (new URLSearchParams(location.search).get('lang') || 'en').startsWith('ko') ? 'ko' : 'en';
const TX = {
  en: { go: 'GO', nogo: 'NO-GO', stay: n => `${n}-day stay from this day`, sunS: 'Sun', earthS: 'Earth', darkS: 'Longest dark', now: 'At', nowBoth: 'Sun and Earth in view', nowSun: 'Sun in view, Earth hidden', nowEarth: 'Earth in view, in shadow', nowNone: 'In shadow, Earth hidden', calc: 'computing…', both: 'SUN + EARTH', sun: 'SUN ONLY', earth: 'EARTH ONLY', none: 'DARK, NO EARTH', at: 'at', sunY: 'Sun, yearly', earthY: 'Earth, yearly', slope: 'Slope', height: 'Height', terrain: 'Terrain', ridge: 'ridge / high ground', floor: 'low ground / crater floor', level: 'level ground', ice: 'To ice (PSR)', psr: 'Permanent shadow · ice may be here' },
  ko: { go: 'GO', nogo: 'NO-GO', stay: n => `이날부터 ${n}일 체류`, sunS: '햇빛', earthS: '지구', darkS: '최장 어둠', now: '', nowBoth: '햇빛과 지구 모두 보임', nowSun: '햇빛 보임, 지구 가려짐', nowEarth: '지구 보임, 그늘', nowNone: '그늘, 지구 가려짐', calc: '계산 중…', both: '햇빛 + 지구', sun: '햇빛만', earth: '지구만', none: '어둠, 지구 안 보임', at: '', sunY: '햇빛 연평균', earthY: '지구 연평균', slope: '경사', height: '높이', terrain: '지형', ridge: '능선·높은 곳', floor: '낮은 곳·분화구 바닥', level: '평지', ice: '얼음(영구 그림자)까지', psr: '영구 그림자 · 얼음이 있을 수 있음' },
}[lang];

let L = null, loading = null, tip = null, host = null, raf = 0, last = null;
export async function load() {
  if (loading) return loading;
  return loading = (async () => {
    const get = f => fetch('layers/data/' + f).then(r => r.ok ? r.arrayBuffer() : null).then(b => b && b.byteLength === N * N ? new Uint8Array(b) : null).catch(() => null);
    const [sun, earth, slope, psr] = await Promise.all(['sun.wasm', 'earth.wasm', 'slope.wasm', 'psr.wasm'].map(get));
    let elev = null;
    try {
      const img = new Image(); img.src = 'layers/data/elev500.png'; await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, N, N).data; elev = new Float32Array(N * N);
      for (let i = 0; i < N * N; i++) elev[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 4 - 8000;
    } catch (e) { /* optional */ }
    const ice = psr ? iceKm(psr) : null;
    L = { sun, earth, slope, psr, elev, ice };
    return L;
  })();
}
// km to the nearest permanently shadowed 500 m cell (two-pass chamfer)
function iceKm(psr) {
  const d = new Float32Array(N * N), a = .5, b = .5 * Math.SQRT2;
  for (let i = 0; i < d.length; i++) d[i] = psr[i] >= 125 && psr[i] <= 250 ? 0 : 1e9;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const i = r * N + c; let v = d[i];
    if (c > 0) v = Math.min(v, d[i - 1] + a);
    if (r > 0) { v = Math.min(v, d[i - N] + a); if (c > 0) v = Math.min(v, d[i - N - 1] + b); if (c < N - 1) v = Math.min(v, d[i - N + 1] + b); }
    d[i] = v; }
  for (let r = N - 1; r >= 0; r--) for (let c = N - 1; c >= 0; c--) { const i = r * N + c; let v = d[i];
    if (c < N - 1) v = Math.min(v, d[i + 1] + a);
    if (r < N - 1) { v = Math.min(v, d[i + N] + a); if (c < N - 1) v = Math.min(v, d[i + N + 1] + b); if (c > 0) v = Math.min(v, d[i + N - 1] + b); }
    d[i] = v; }
  return d;
}
// per landing day Sun %, Earth %, longest dark (h) of a stay, for one spot (cached by cell and stay length)
let B = null, Bl = null, ex = null;
const stays = new Map();
export async function stayOf(col, row, mission, mast = 2) {   // mast 10 / 20: seen from a mast of that height (null if missing)
  const key = `${row * N + col}|${mission}${mast === 2 ? '' : '|' + mast}`; if (stays.has(key)) return stays.get(key);
  if (!Bl) Bl = Promise.all([shadow.load(), shadow.loadExtra(), pinBodies()]).then(([, e, b]) => { ex = e; B = b; });
  await Bl;
  if (!ex.sets[mast]) return null;
  const [x, y] = shadow.pixelXY(col, row), p = shadow.pixelOf(x, y), h = shadow.profile(p.i, ex.sets[mast]), ser = pinSeries(x, y, h, B);
  const n = mission * 24, H = B.n, cs = new Float64Array(H + 1), ce = new Float64Array(H + 1);
  for (let i = 0; i < H; i++) { cs[i + 1] = cs[i] + ser.frac[i]; ce[i + 1] = ce[i] + ser.vis[i]; }
  const sun = new Float32Array(365), earth = new Float32Array(365), dark = new Float32Array(365);
  for (let d = 0; d < 365; d++) {
    const a = d * 24, b = Math.min(H, a + n), w = b - a;
    sun[d] = (cs[b] - cs[a]) / w * 100; earth[d] = (ce[b] - ce[a]) / w * 100;
    let run = 0, mx = 0; for (let i = a; i < b; i++) { run = ser.frac[i] < 0.1 ? run + 1 : 0; if (run > mx) mx = run; } dark[d] = mx;
  }
  const sky = { horizon: Array.from(h), azStep: 0.5, sunAz: [], sunEl: [], earthAz: [], earthEl: [] };
  for (let i = 0; i < H; i++) { sky.sunAz.push(ser.az[i * 2]); sky.sunEl.push(ser.el[i * 2]); sky.earthAz.push(ser.az[i * 2 + 1]); sky.earthEl.push(ser.el[i * 2 + 1]); }
  const r = { sun, earth, dark, sky, slope: ex.slope[p.i] === 255 ? null : ex.slope[p.i] * 40 / 250 };
  stays.set(key, r); if (stays.size > 400) stays.delete(stays.keys().next().value);
  return r;
}
const val = (arr, i, max) => arr && arr[i] <= 250 ? arr[i] * max / 250 : null;

export function initHover(el) {
  host = el;
  tip = document.createElement('div'); tip.className = 'h3d-tip'; tip.hidden = true;
  el.append(tip);
  load();
}

function html(p, st) {
  const col = Math.floor((p.x + 200000) / 500), row = Math.floor((200000 - p.y) / 500);
  if (col < 0 || row < 0 || col >= N || row >= N) return '';
  const i = row * N + col, c = state.crit || {}, day = state.day, mission = state.mission || 14;
  let out = '';
  if (!st) out += `<div class="v wait">…<small>${TX.calc}</small></div>`;
  else {
    const sun = st.sun[day], earth = st.earth[day], dark = st.dark[day], slope = st.slope;
    const bad = { sun: sun < c.sun - 1e-9, earth: earth < c.earth - 1e-9, dark: dark > c.dark, slope: slope == null || slope > 8 };
    const go = !bad.sun && !bad.earth && !bad.dark && !bad.slope;
    out += `<div class="v ${go ? 'go' : 'no'}">${go ? TX.go : TX.nogo}<small>${TX.stay(mission)}</small></div>`;
    const cell = (k, label, v, lim) => `<div${bad[k] ? ' class="bad"' : ''}><small>${label} ${lim}</small><b>${v}</b></div>`;
    out += `<div class="m">${cell('sun', TX.sunS, (Math.floor(sun * 10) / 10).toFixed(1) + ' %', '≥' + c.sun)}${cell('earth', TX.earthS, (Math.floor(earth * 10) / 10).toFixed(1) + ' %', '≥' + c.earth)}${cell('dark', TX.darkS, Math.ceil(dark) + ' h', '≤' + c.dark)}${cell('slope', TX.slope, slope == null ? '–' : slope.toFixed(1) + '°', '≤8')}</div>`;
    if (!go) {
      let why = '';
      if (bad.sun || bad.earth || bad.dark) {
        try { why = failReason(failStats({ cal: { sun: st.sun, earth: st.earth, dark: st.dark }, mast: null, grid: [], sky: st.sky }, day, c, limitsOf(state), mission), lang).text; } catch (e) { why = ''; }
      } else why = lang === 'ko' ? `경사 ${slope == null ? '–' : slope.toFixed(1)}°: 착륙 한계 8°보다 가팔라요` : `Slope ${slope == null ? '–' : slope.toFixed(1)}°: steeper than the 8° landing limit`;
      if (why) out += `<div class="why">${why}</div>`;
    }
  }
  if (L && L.elev) {
    let s = 0, n = 0;
    for (let r = Math.max(0, row - 5); r <= Math.min(N - 1, row + 5); r++) for (let q = Math.max(0, col - 5); q <= Math.min(N - 1, col + 5); q++) { s += L.elev[r * N + q]; n++; }
    const rel = L.elev[i] - s / n;
    out += `<div class="s">${TX.terrain} <b>${rel > 120 ? TX.ridge : rel < -120 ? TX.floor : TX.level}, ${rel >= 0 ? '+' : '−'}${Math.abs(Math.round(rel))} m</b></div>`;
  }
  if (L && L.ice) out += `<div class="s">${L.ice[i] === 0 ? TX.psr : `${TX.ice} <b>${L.ice[i] > 60 ? '>60' : L.ice[i].toFixed(1)} km</b>`}</div>`;
  if (p.sun != null) {
    const k = p.sun >= .5 && p.earth >= .5 ? 'nowBoth' : p.sun >= .5 ? 'nowSun' : p.earth >= .5 ? 'nowEarth' : 'nowNone';
    const when = p.ms ? new Date(p.ms).toISOString().slice(5, 16).replace('T', ' ').replace('-', '/') + ' UTC' : '';
    out += `<div class="s now">${TX.now ? TX.now + ' ' : ''}${when}${lang === 'ko' ? '에' : ':'} <b>${TX[k]}</b></div>`;
  }
  return out;
}

let req = 0;
export function hover(p) {
  last = p;
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0; const q = last;
    if (!q || !tip) { if (tip) tip.hidden = true; return; }
    const col = Math.floor((q.x + 200000) / 500), row = Math.floor((200000 - q.y) / 500), m = state.mission || 14;
    const show = st => {
      tip.innerHTML = html(q, st); tip.hidden = !tip.innerHTML;
      const r = host.getBoundingClientRect();
      const x = Math.min(r.width - tip.offsetWidth - 8, q.cx - r.left + 18), y = Math.min(r.height - tip.offsetHeight - 8, q.cy - r.top + 18);
      tip.style.transform = `translate(${Math.max(4, x)}px,${Math.max(4, y)}px)`;
    };
    const k = `${row * N + col}|${m}`;
    if (stays.has(k)) { show(stays.get(k)); return; }
    show(null);
    const my = ++req;
    stayOf(col, row, m).then(st => { if (my === req && last === q) show(st); }).catch(() => {});
  });
}
