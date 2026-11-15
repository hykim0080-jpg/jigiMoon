// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Trip bar: pick a landing date (fare-calendar popup, with the stay) and a region (destination popup),
// then rank the best spots of that region for that date and stay. Numbers come from each spot's hourly sky
// (time.js skyAt), the same series the pin card and the GO calendar use.
import { N, PX } from './config.js';
import { state, setState } from './state.js';
import { skyAt, skyCached, ensure } from './time.js';
import { cellToXY, xyToCell } from './geo.js';
import { describe, anchorOf } from './orient.js';
import { decode } from './data.js';
import { lang, MONTH_NAMES } from './strings.js';
import { failStats, failReason } from '../../js/failreason.js';
import { failBase, failYear, critIds } from './compose.js';
import { winToken, pending, winProgress } from './window.js';
import { inCart, toggleCart, ct } from './cart.js';
import { bestMast, marginOf } from './score.js';

const T0 = Date.UTC(2027, 0, 1), DAYS = 365, LIM = { move: 3, mast: 20, wait: 60 };
export const REGIONS = [
  { id: 'shackleton', x: -10, y: -5, r: 40, lm: /Shackleton|Gerlache|Connecting/ },
  { id: 'mouton', x: 85, y: 125, r: 30, lm: /Mouton/ },
  { id: 'malapert', x: -5, y: 100, r: 32, lm: /Malapert|Haworth/ },
  { id: 'nobile', x: 155, y: 92, r: 25, lm: /Nobile/ },
  { id: 'cabeus', x: -140, y: 90, r: 60, lm: /Cabeus/ },
  { id: 'all' },
];
const TX = {
  en: { lSun: 'Sun', lEarth: 'Earth', lDark: 'Dark',
    when: 'When', where: 'Where to?', stay: 'Stay', pickDay: 'Landing day', pickRegion: 'Choose a region',
    calNote: 'GO spots per landing day', spots: n => `${n} GO ${n === 1 ? 'spot' : 'spots'}`, noneDay: 'no GO spot',
    nextGo: n => `next GO in ${n} d`, best: 'Best spots', findBest: 'Find best spots', hideBest: 'Hide best spots', loading: 'Computing…', go: 'GO', nogo: 'NO-GO',
    wait: n => `GO in ${n} d`, noFix: 'NO FIX',
    whySun: (v, c) => `Sun ${v} % of the stay (need ${c})`, whyEarth: (v, c) => `Earth in view ${v} % (need ${c})`, whyDark: (v, c) => `Longest dark ${v} h (max ${c})`, whyIce: v => `Ice-likely shade ${v} km away (may hold ice, not proven)`, lIce: 'Ice', lSlope: 'Slope', mastM: m => `${m} m mast`, iceNote: '(may hold ice, not proven)',
    stayD: n => `${n} d`, wd: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    ans: (day, n, km2, where) => `If you land on <b>${day}</b> and stay <b>${n} days</b>, <b>${km2} km²</b>${where ? ` of ${where}` : ''} keeps power and Earth contact.`,
    ansNone: (day, n, where) => `If you land on <b>${day}</b> and stay <b>${n} days</b>, no ground${where ? ` in ${where}` : ''} keeps power and Earth contact.`,
    ansBest: s => ` Best spot: <a data-rank="1">${s}</a>.`, ansNext: (n, s) => ` Soonest: <a data-rank="1">${s}</a>, in ${n} d.`,
    r: { shackleton: 'Shackleton area', mouton: 'Mons Mouton', malapert: 'Malapert · Haworth', nobile: 'Nobile', cabeus: 'Cabeus', all: 'Whole south pole' },
  },
  ko: { lSun: '햇빛', lEarth: '지구', lDark: '어둠',
    when: '언제', where: '어디로?', stay: '체류', pickDay: '착륙일', pickRegion: '지역 고르기',
    calNote: '착륙일별 가능한 지점 수', spots: n => `가능 지점 ${n}곳`, noneDay: '가능 지점 없음',
    nextGo: n => `${n}일 뒤 가능`, best: '추천 지점', findBest: '최적 지점 찾기', hideBest: '추천 숨기기', loading: '계산 중…', go: '가능', nogo: '불가',
    wait: n => `${n}일 후`, noFix: '해법 없음',
    whySun: (v, c) => `햇빛 ${v} % (기준 ${c})`, whyEarth: (v, c) => `지구 보임 ${v} % (기준 ${c})`, whyDark: (v, c) => `가장 긴 어둠 ${v}시간 (최대 ${c})`, whyIce: v => `얼음이 있을 수 있는 영구 그늘까지 ${v} km (확정 아님)`, lIce: '얼음', lSlope: '경사', mastM: m => `마스트 ${m} m`, iceNote: '(얼음 가능성, 확정 아님)',
    stayD: n => `${n}일`, wd: ['일', '월', '화', '수', '목', '금', '토'],
    ans: (day, n, km2, where) => `<b>${day}</b>에 착륙해 <b>${n}일</b> 머물면 ${where ? `${where}에서 ` : ''}<b>${km2} km²</b>가 전력과 지구 교신을 유지해요.`,
    ansNone: (day, n, where) => `<b>${day}</b>에 착륙해 <b>${n}일</b> 머물면 ${where ? `${where}에는 ` : ''}전력과 지구 교신을 유지하는 땅이 없어요.`,
    ansBest: s => ` 최적 지점: <a data-rank="1">${s}</a>.`, ansNext: (n, s) => ` 가장 빨리 되는 곳: <a data-rank="1">${s}</a>, ${n}일 뒤.`,
    r: { shackleton: '섀클턴 일대', mouton: '몽스 무통', malapert: '말라퍼트 · 하워스', nobile: '노빌레', cabeus: '카베우스', all: '남극 전체' },
  },
};
export const tt = (k, ...a) => { const v = TX[lang][k] ?? TX.en[k]; return typeof v === 'function' ? v(...a) : v; };
export const regionName = id => tt('r')[id] || '';
const dateOf = d => new Date(T0 + d * 864e5);
const dayText = d => { const t = dateOf(d); return lang === 'ko' ? `2027년 ${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일` : `${MONTH_NAMES[t.getUTCMonth()]} ${t.getUTCDate()}, 2027`; };
const dayOf = (m, dd) => Math.round((Date.UTC(2027, m, dd) - T0) / 864e5);
const daysIn = m => new Date(Date.UTC(2027, m + 1, 0)).getUTCDate();

// ---- per-spot window statistics: Sun %, Earth %, longest dark (h) of a stay starting on each day ----
const stats = new Map();
function windowStats(sky, mission) {
  const n0 = mission * 24, H = sky.hours, cs = new Float64Array(H + 1), ce = new Float64Array(H + 1);
  for (let i = 0; i < H; i++) { cs[i + 1] = cs[i] + sky.sunFrac[i]; ce[i + 1] = ce[i] + sky.earthVis[i]; }
  const sun = new Float32Array(DAYS), earth = new Float32Array(DAYS), dark = new Float32Array(DAYS);
  for (let d = 0; d < DAYS; d++) {
    const a = d * 24, b = Math.min(H, a + n0), n = b - a;
    sun[d] = (cs[b] - cs[a]) / n * 100; earth[d] = (ce[b] - ce[a]) / n * 100;
    let run = 0, mx = 0; for (let i = a; i < b; i++) { run = sky.sunFrac[i] < 0.1 ? run + 1 : 0; if (run > mx) mx = run; }
    dark[d] = mx;
  }
  return { sun, earth, dark };
}
async function statsAsync(col, row, mission) {
  const k = `${row * N + col}|${mission}`; if (stats.has(k)) return stats.get(k);
  const sky = await skyAt(col, row), w = windowStats(sky, mission); w.sky = sky; stats.set(k, w); return w;
}
const mastStats = new Map();
async function mastAsync(col, row, mission, mast) {   // the same with a 10 m / 20 m mast (null if that set is missing)
  const k = `${row * N + col}|${mission}|${mast}`; if (mastStats.has(k)) return mastStats.get(k);
  const sky = await skyAt(col, row, mast), w = sky ? windowStats(sky, mission) : null; mastStats.set(k, w); return w;
}
export const statsFor = statsAsync;
export const statsCached = (col, row, mission) => stats.get(`${row * N + col}|${mission}`) || null;
// nearest spot with known statistics that is GO on day d (used as the MOVE fix where no per-pixel GO data exists)
export function goNear(col, row, d, crit, mission, maxCells) {
  let best = null, bd = maxCells * maxCells + 1;
  for (const [k, w] of stats) {
    const [i, m] = k.split('|'); if (+m !== mission) continue;
    const c = +i % N, r = (+i - c) / N, dd = (c - col) ** 2 + (r - row) ** 2;
    if (dd === 0 || dd >= bd || !isGo(w, d, crit)) continue;
    bd = dd; best = { col: c, row: r, d2: dd };
  }
  return best;
}
const isGo = (w, d, c) => w.sun[d] >= c.sun - 1e-9 && w.earth[d] >= c.earth - 1e-9 && w.dark[d] <= c.dark;

// One sentence for a spot with no fix (navigator/js/failreason.js), from its own window statistics.
export function whyNoFix(col, row, day, crit, mission) {
  const w = statsCached(col, row, mission); if (!w) return null;
  const site = { cal: { sun: w.sun, earth: w.earth, dark: w.dark }, mast: null, grid: [], sky: w.sky };
  try { return failReason(failStats(site, day, crit, LIM, mission), lang).text; } catch (e) { return null; }
}

// ---- candidate spots of a region: flat cells with the most GO landing days in the year, spaced out ----
let D = null; const pools = new Map();
// the 3D map's terrain is a rounded square (map3d.js: |x|^4 + |y|^4 norm, relief fades out from 190 km): spots stay 15 km inside it
const PATCH = 185, inPatch = (x, y) => ((Math.abs(x / 1000) ** 4) + (Math.abs(y / 1000) ** 4)) ** 0.25;
function poolCells(rid, mission) {
  const reg = REGIONS.find(r => r.id === rid) || REGIONS[5], slopeM = D.layers.find(m => m.id === 'slope'), sb = D.bytes.slope;
  const days = D.bytes['days' + mission] || D.bytes.days14, thr = state.threshold.slope ?? 8;
  let c0 = 0, c1 = N - 1, r0 = 0, r1 = N - 1;
  if (reg.r) { const a = xyToCell((reg.x - reg.r) * 1000, (reg.y + reg.r) * 1000), b = xyToCell((reg.x + reg.r) * 1000, (reg.y - reg.r) * 1000); c0 = Math.max(0, a.col); r0 = Math.max(0, a.row); c1 = Math.min(N - 1, b.col); r1 = Math.min(N - 1, b.row); }
  const cand = [], useMask = !!failBase && state.mode === 'mask' && critIds(state).length > 0;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const i = r * N + c, v = days[i]; if (!(v > 0 && v <= 250)) continue;
    if (useMask) { if (failBase[i] !== 0 && failYear[i] !== 0) continue; }
    else if (sb && slopeM && (sb[i] > 250 || decode(slopeM, sb[i]) > thr)) continue;
    { const { x, y } = cellToXY(c, r);
      if (inPatch(x, y) > PATCH) continue;   // only inside the 3D map's terrain (its rounded-square edge), not on the grey globe
      if (reg.r && Math.hypot(x / 1000 - reg.x, y / 1000 - reg.y) > reg.r) continue; }
    cand.push(i);
  }
  cand.sort((a, b) => useMask && (failBase[a] === 0) !== (failBase[b] === 0) ? (failBase[a] === 0 ? -1 : 1) : days[b] - days[a]);   // judged GO for this trip first
  const K = reg.r ? 60 : 120, sp = reg.r ? 4 : 12, out = [];
  for (const i of cand) {
    const c = i % N, r = (i - c) / N;
    if (out.some(o => (o.col - c) ** 2 + (o.row - r) ** 2 < sp * sp)) continue;
    if (reg.r) { const { x, y } = cellToXY(c, r), L = anchorOf(x, y, D.landmarks), nm = L ? L.name : ''; if (REGIONS.some(o => o.lm && o !== reg && o.lm.test(nm) && !reg.lm.test(nm))) continue; }
    out.push({ col: c, row: r }); if (out.length >= K) break;
  }
  return out;
}
export function poolOf(rid, mission) {
  // the candidates follow the judged stay: wait until it is worked out instead of ranking the yearly fallback first and
  // then all over again (that second run looked like a stall)
  if (pending(state)) return { cells: [], ready: false, done: 0, promise: new Promise(r => setTimeout(r, 400)) };
  const k = `${rid}|${mission}|${maskKey()}`; if (pools.has(k)) return pools.get(k);
  if (pools.size > 40) pools.clear();
  const p = { cells: poolCells(rid, mission), ready: false, done: 0 };
  p.promise = (async () => { await ensure(); let n = 0; for (const c of p.cells) { c.w = await statsAsync(c.col, c.row, mission); if (++n % 12 === 0) { p.done = n / p.cells.length; showPct(); await new Promise(r => setTimeout(r, 0)); } } p.ready = true;
    // then the mast heights, for the ranking (a spot that needs a mast ranks below ground spots); the list redraws when done
    n = 0; for (const c of p.cells) { c.w10 = await mastAsync(c.col, c.row, mission, 10); c.w20 = await mastAsync(c.col, c.row, mission, 20); if (++n % 8 === 0) { p.mdone = n / p.cells.length; showPct(); await new Promise(r => setTimeout(r, 0)); } }
    p.mready = true; setState({}, 'panel'); })();
  pools.set(k, p); return p;
}
// one count for the steps of the ranked list: the stay worked out (to 40 %), the candidate spots from the ground
// (to 60 %), then with a 10 m and 20 m mast (to 100 %, the slowest part)
export function loadPct(st) {
  if (pending(st)) return Math.floor(40 * winProgress(st));
  const p = pools.get(`${currentRegion()}|${st.mission}|${maskKey()}`);
  if (!p) return 40;
  return Math.min(99, Math.floor(p.ready ? 60 + 40 * (p.mdone || 0) : 40 + 20 * p.done));
}
const showPct = () => { const v = loadPct(state) + ' %'; document.querySelectorAll('.ld-pct').forEach(e => { e.textContent = v; }); };
const maskKey = () => JSON.stringify([state.crit, state.threshold, state.on.mask, state.mode, winToken(state)]);
export function goCount(p, d, crit) { let n = 0; for (const c of p.cells) if (c.w && isGo(c.w, d, crit)) n++; return n; }

// ranked spots of a pool for a landing day: GO first (largest margin), then the soonest to become GO
export function rank(p, d, crit) {
  const rows = p.cells.filter(c => c.w).map(c => {
    const go0 = isGo(c.w, d, crit);
    // ice nearby is a preference: among spots that pass, a permanently shadowed region within ~10 km lifts a spot a little
    const iv = D.bytes.ice ? D.bytes.ice[c.row * N + c.col] : 255, iceKm = iv <= 250 ? iv / 10 : null;
    // judged from the ground, then with a 10 m and a 20 m mast (layers/js/score.js): the lowest that passes counts
    const bm = bestMast({ 2: c.w, 10: c.w10, 20: c.w20 }, d, crit, iceKm), go = !!bm, w = bm ? bm.w : c.w, mast = bm ? bm.mast : 2;
    let wait = null; if (!go) for (let k = d + 1; k < DAYS; k++) if (isGo(c.w, k, crit)) { wait = k - d; break; }
    const margin = bm ? bm.score : marginOf(w, d, crit, iceKm);
    const sm = D.layers.find(m => m.id === 'slope'), sv = sm && D.bytes.slope ? D.bytes.slope[c.row * N + c.col] : 255, slope = sv <= 250 ? decode(sm, sv) : null;   // the 500 m slope layer
    return { col: c.col, row: c.row, go, go0, mast, wait, margin, iceKm, slope, sun: w.sun[d], earth: w.earth[d], dark: w.dark[d] };
  });
  rows.sort((a, b) => (b.go - a.go) || (a.go ? b.margin - a.margin : (a.wait ?? 999) - (b.wait ?? 999) || b.margin - a.margin));
  const nGo = rows.filter(r => r.go).length;
  return rows.slice(0, Math.min(30, Math.max(10, nGo))).map((r, i) => { const { x, y } = cellToXY(r.col, r.row); return { ...r, id: i + 1, best: { col: r.col, row: r.row }, bbox: [r.col - 6, r.row - 6, r.col + 6, r.row + 6], title: describe(x, y, D.landmarks) || '' }; });
}

// ---- UI ----
let bar, pop, list, ans, opts = {}, ranked = [], calMonth = null, rkey = '';
// Find a site over the main page (?panels=1) opens on the GO ground and the criteria only; the ranked spots come with
// "Find best spots" or the first spot picked on the map (panels.js). A link that brings its own place or date shows them at once.
const PANELS = new URLSearchParams(location.search).get('panels') === '1';
let shown = !PANELS || (() => { try { return !!parent.__findLink; } catch (e) { return true; } })();   // index.html: a link straight into Find a site
let findBtn = null;
export const ranksShown = () => shown;
export function showRanks() { if (shown) return; shown = true; rkey = ''; akey = ''; if (findBtn) findBtn.hidden = true; setState({}, 'panel'); }
// back to the first look: the GO area and the criteria, no ranks, no picked spot, the Find button again
export function hideRanks() { if (!shown) return; shown = false; rkey = ''; akey = ''; if (findBtn) findBtn.hidden = false; setState({ pin: null, hoverTrip: null }, 'panel'); }
export const tripRanked = () => shown ? ranked : [];
export const currentRegion = () => state.region || 'all';
export function initTrip(header, listEl, d, o = {}) {
  D = d; opts = o; list = listEl;
  bar = document.createElement('div'); bar.className = 'lyr-trip';
  bar.innerHTML = `<button class="lyr-tb" data-pop="date"><span>${tt('when')}</span><b class="lyr-tbd"></b></button><button class="lyr-tb" data-pop="region"><span>${tt('where')}</span><b class="lyr-tbr"></b></button>`;
  header.append(bar);
  ans = document.createElement('p'); ans.className = 'lyr-ans'; ans.setAttribute('aria-live', 'polite'); header.append(ans);
  ans.onclick = e => { if (e.target.closest('[data-rank]') && ranked[0]) opts.pick && opts.pick(ranked[0]); };
  pop = document.createElement('div'); pop.className = 'lyr-pop'; pop.hidden = true; document.body.append(pop);
  bar.onclick = e => { const b = e.target.closest('[data-pop]'); if (b) open(pop.dataset.kind === b.dataset.pop && !pop.hidden ? null : b.dataset.pop); };
  document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && !bar.contains(e.target)) open(null); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); open(null); } }, true);
  pop.onclick = e => {
    const s = e.target.closest('[data-stay]'), m = e.target.closest('[data-mon]'), dd = e.target.closest('[data-day]'), rg = e.target.closest('[data-reg]');
    if (s) { setState({ mission: +s.dataset.stay, autoPin: true }, 'pixels'); drawPop(); }
    else if (m) { calMonth = Math.max(0, Math.min(11, calMonth + +m.dataset.mon)); drawPop(); }
    else if (dd) { setState({ tDay: +dd.dataset.day, plan: +dd.dataset.day, tTouched: true, autoPin: true }, 'time'); open(state.region ? null : 'region'); }
    else if (rg) { open(null); pickRegion(rg.dataset.reg); }
  };
  findBtn = document.createElement('button'); findBtn.type = 'button'; findBtn.className = 'lyr-findbest'; findBtn.textContent = tt('findBest'); findBtn.hidden = shown;
  findBtn.onclick = () => showRanks();
  list.parentNode && list.parentNode.append(findBtn);
  list.onclick = e => { if (e.target.closest('.lyr-hidebest')) { e.stopPropagation(); hideRanks(); return; } const a = e.target.closest('[data-addr]'); if (a) { e.stopPropagation(); const z = ranked[+a.dataset.addr - 1]; if (z) toggleCart(z.col, z.row); return; } const r = e.target.closest('[data-rank]'); if (r) { const z = ranked[+r.dataset.rank - 1]; if (z) opts.pick && opts.pick(z); } };
  list.onmouseover = e => { const r = e.target.closest('[data-rank]'), id = r ? +r.dataset.rank : null; if (id !== state.hoverTrip) setState({ hoverTrip: id }, 'hover'); };
  list.onmouseleave = () => { if (state.hoverTrip != null) setState({ hoverTrip: null }, 'hover'); };
}
export function regionBBox(id) {
  const reg = REGIONS.find(r => r.id === id); if (!reg || !reg.r) return null;
  const a = xyToCell((reg.x - reg.r) * 1000, (reg.y + reg.r) * 1000), b = xyToCell((reg.x + reg.r) * 1000, (reg.y - reg.r) * 1000);
  return [a.col, a.row, b.col, b.row];
}
function pickRegion(id) {
  setState({ region: id, autoPin: true }, 'panel');
  const bb = regionBBox(id);
  if (bb) opts.fly && opts.fly(bb); else opts.home && opts.home();
}
function open(kind) {
  if (!kind) { pop.hidden = true; pop.dataset.kind = ''; bar.querySelectorAll('[data-pop]').forEach(b => b.setAttribute('aria-expanded', 'false')); return; }
  pop.dataset.kind = kind; pop.hidden = false; if (kind === 'date') calMonth = dateOf(state.tDay).getUTCMonth();
  bar.querySelectorAll('[data-pop]').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.pop === kind)));
  const r = bar.querySelector(`[data-pop="${kind}"]`).getBoundingClientRect();
  if (innerWidth <= 700) { pop.style.left = ''; pop.style.top = ''; } else { pop.style.left = Math.max(8, Math.min(r.left, innerWidth - (kind === 'date' ? 430 : 640) - 8)) + 'px'; pop.style.top = (r.bottom + 6) + 'px'; }
  drawPop();
}
function drawPop() {
  if (pop.hidden) return;
  const crit = state.crit, mission = state.mission;
  if (pop.dataset.kind === 'date') {
    const p = poolOf(currentRegion(), mission), m = calMonth, first = new Date(Date.UTC(2027, m, 1)).getUTCDay();
    if (!p.ready) p.promise.then(drawPop);
    const counts = []; for (let dd = 1; dd <= daysIn(m); dd++) counts.push(p.ready ? goCount(p, dayOf(m, dd), crit) : null);
    const mx = Math.max(1, ...counts.filter(v => v != null));
    pop.innerHTML = `<div class="lyr-ph"><span class="seg">${[14, 6].map(v => `<button data-stay="${v}" aria-pressed="${mission === v}">${tt('stayD', v)}</button>`).join('')}</span><span class="lyr-pgrow"></span><button data-mon="-1"${m === 0 ? ' disabled' : ''}>◀</button><b>${MONTH_NAMES[m]} 2027</b><button data-mon="1"${m === 11 ? ' disabled' : ''}>▶</button></div>
<div class="lyr-pnote">${regionName(currentRegion())} · ${tt('calNote')}</div>
<div class="lyr-pcalg">${tt('wd').map(w => `<em>${w}</em>`).join('')}${'<span></span>'.repeat(first)}${counts.map((n, i) => { const day = dayOf(m, i + 1); return `<button data-day="${day}" aria-pressed="${day === state.tDay}" class="${n === 0 ? 'z' : ''}" style="--f:${n == null ? 0 : n / mx}"><b>${i + 1}</b><span class="n">${n == null ? '·' : n || '–'}</span></button>`; }).join('')}</div>`;
  } else {
    const d = state.tDay;
    pop.innerHTML = `<div class="lyr-ph"><b>${tt('pickRegion')}</b><span class="lyr-pgrow"></span><span class="n lyr-pnote">${dayText(d)} · ${tt('stayD', mission)}</span></div><div class="lyr-regs">${REGIONS.map(r => {
      const p = poolOf(r.id, mission); if (!p.ready) p.promise.then(drawPop);
      let sub = tt('loading');
      if (p.ready) { const n = goCount(p, d, crit); if (n) sub = tt('spots', n); else { let k = d + 1; for (; k < DAYS; k++) if (goCount(p, k, crit)) break; sub = k < DAYS ? tt('nextGo', k - d) : tt('noneDay'); } }
      const ok = p.ready && goCount(p, d, crit) > 0;
      return `<button data-reg="${r.id}" aria-pressed="${state.region === r.id}"><canvas data-thumb="${r.id}" width="150" height="96"></canvas><b>${regionName(r.id)}</b><span class="${ok ? 'ok' : ''}">${sub}</span></button>`;
    }).join('')}</div>`;
    pop.querySelectorAll('[data-thumb]').forEach(cv => thumb(cv, cv.dataset.thumb, d));
  }
}
let hillImg = null;
function thumb(cv, id, d) {
  const reg = REGIONS.find(r => r.id === id), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  let c0, r0, sz;
  if (reg.r) { const a = xyToCell((reg.x - reg.r) * 1000, (reg.y + reg.r) * 1000); c0 = a.col; r0 = a.row; sz = Math.round(2 * reg.r * 1000 / PX); } else { c0 = 0; r0 = 0; sz = N; }
  if (!hillImg) { hillImg = new Image(); hillImg.onload = () => drawPop(); hillImg.src = D.dataUrl + 'hillshade.png'; }
  g.fillStyle = '#111'; g.fillRect(0, 0, W, H);
  if (hillImg.complete && hillImg.naturalWidth) { const f = hillImg.naturalWidth / N, s = sz / W; g.drawImage(hillImg, c0 * f, (r0 + (W - H) / 2 * s) * f, sz * f, H * s * f, 0, 0, W, H); }
  const p = poolOf(id, state.mission); if (!p.ready) return;
  for (const c of p.cells) {
    if (!c.w) continue; const s = sz / W, x = (c.col - c0) / s, y = (c.row - r0) / s - (W - H) / 2;
    g.fillStyle = isGo(c.w, d, state.crit) ? '#46e58c' : 'rgba(255,255,255,.35)'; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
  }
}

export function renderTrip(st) {
  bar.querySelector('.lyr-tbd').textContent = `${dayText(st.tDay)} · ${tt('stayD', st.mission)}`;
  bar.querySelector('.lyr-tbr').textContent = st.region ? regionName(st.region) : regionName('all');
  bar.querySelector('[data-pop="region"]').classList.toggle('unset', !st.region);
  const rid = currentRegion(), p = poolOf(rid, st.mission), k = `${rid}|${st.mission}|${st.tDay}|${maskKey()}|${p.ready}|${!!p.mready}|${JSON.stringify(st.cart)}`;
  if (!p.ready) p.promise.then(() => setState({}, 'panel'));
  if (findBtn && !findBtn.isConnected && list.parentNode) list.parentNode.append(findBtn);
  list.classList.toggle('lyr-hide', !shown);
  if (k + shown !== rkey) { rkey = k + shown; ranked = p.ready ? rank(p, st.tDay, st.crit) : []; drawList(st, p); if (p.ready && shown) opts.ranked && opts.ranked(ranked); }
  else for (const r of list.querySelectorAll('[data-rank]')) r.classList.toggle('hot', +r.dataset.rank === st.hoverTrip || (st.pin && ranked[+r.dataset.rank - 1] && ranked[+r.dataset.rank - 1].col === st.pin.col && ranked[+r.dataset.rank - 1].row === st.pin.row));
  drawAnswer(st, rid, p);
  if (!pop.hidden) { const pk = `${pop.dataset.kind}|${st.tDay}|${st.mission}|${maskKey()}`; if (pop.dataset.k !== pk) { pop.dataset.k = pk; drawPop(); } }
}
// one sentence at the top: the answer for the chosen day, stay, region and criteria
let akey = '';
function regionArea(rid) {
  if (!failBase) return null;
  const reg = REGIONS.find(r => r.id === rid), bb = reg && reg.r ? regionBBox(rid) : [0, 0, N - 1, N - 1];
  let n = 0;
  for (let row = Math.max(0, bb[1]); row <= Math.min(N - 1, bb[3]); row++) for (let col = Math.max(0, bb[0]); col <= Math.min(N - 1, bb[2]); col++) {
    if (failBase[row * N + col] !== 0) continue;
    if (reg && reg.r) { const { x, y } = cellToXY(col, row), dx = x / 1000 - reg.x, dy = y / 1000 - reg.y; if (dx * dx + dy * dy > reg.r * reg.r) continue; }
    n++;
  }
  return n * PX * PX / 1e6;
}
function drawAnswer(st, rid, p) {
  if (!ans) return;
  const k = `${rid}|${st.mission}|${st.tDay}|${maskKey()}|${p.ready}|${ranked.length && ranked[0].title}|${shown}`;
  if (k === akey) return; akey = k;
  if (!p.ready || pending(st)) { ans.innerHTML = tt('loading') + ` <span class="ld-pct">${loadPct(st)} %</span>`; return; }   // the stay window is still being computed: no area from the yearly fallback
  const km = regionArea(rid), where = st.region && st.region !== 'all' ? regionName(rid) : '', day = dayText(st.tDay), r0 = ranked[0];
  const km2 = km == null ? '' : km >= 100 ? String(Math.round(km / 10) * 10) : km >= 10 ? String(Math.round(km)) : km.toFixed(1);
  let h = km ? tt('ans', day, st.mission, km2, where) : tt('ansNone', day, st.mission, where);
  if (shown && r0 && r0.go) h += tt('ansBest', r0.title);
  else if (shown && r0 && r0.wait != null) h += tt('ansNext', r0.wait, r0.title);
  ans.innerHTML = h;
}
function drawList(st, p) {
  const c = st.crit, sm = D.layers.find(m => m.id === 'slope'), slim = sm ? Math.round(st.threshold[sm.id] ?? sm.threshold) : 8;
  const iceOn = !!st.on.mask.ice, ilim = st.threshold.ice;
  const head = `<div class="lyr-trh"><div><b>${regionName(currentRegion())}</b><span class="n">${dayText(st.tDay)} · ${tt('stayD', st.mission)}</span></div><span class="lyr-trgo n">${ranked.filter(r => r.go0).length} GO${shown && p.ready ? `<button type="button" class="lyr-hidebest">${tt('hideBest')}</button>` : ''}</span></div>`;
  if (!p.ready) { list.innerHTML = head + `<p class="lyr-tri">${tt('loading')} <span class="ld-pct">${loadPct(st)} %</span></p>`; return; }
  if (!shown) { list.innerHTML = head; return; }
  const top5 = ranked.slice(0, 5);
  // one row of numbers per spot, the same columns for all; a value that misses its limit in red
  const cells = r => [
    [Math.floor(r.sun), r.sun < c.sun], [Math.floor(r.earth), r.earth < c.earth], [Math.ceil(r.dark), r.dark > c.dark],
    [r.slope == null ? '–' : Math.round(r.slope), r.slope != null && r.slope > slim], [r.iceKm == null ? '–' : r.iceKm.toFixed(1), iceOn && r.iceKm != null && r.iceKm > ilim, 'ice'],
  ].map(([v, bad, k]) => `<b class="${bad ? 'bad' : ''}${k ? ' ' + k : ''}">${v}</b>`).join('');
  const labels = `<div class="lyr-trc lab">${[tt('lSun') + ' %', tt('lEarth') + ' %', tt('lDark') + ' h', tt('lSlope') + ' °', tt('lIce') + ' km'].map(x => `<span>${x}</span>`).join('')}</div>`;
  list.innerHTML = head + top5.map((r, i) => {
    const added = inCart(r.col, r.row) >= 0, st8 = r.go ? (r.mast > 2 ? ` <small class="lyr-trm">${tt('mastM', r.mast)}</small>` : '') : ` <em>${r.wait != null && r.wait <= LIM.wait ? tt('wait', r.wait) : tt('nogo')}</em>`;
    return `<div class="lyr-tr${i === 0 ? ' top' : ''}${r.go ? '' : ' no'}" data-rank="${r.id}" tabindex="0"><span class="lyr-trn n">${r.id}</span><div class="lyr-trt">${r.title}${st8}</div><button class="lyr-tradd${added ? ' in' : ''}" data-addr="${r.id}" title="${ct(added ? 'added' : 'add')}">${added ? '✓' : '+'}</button>${i === 0 ? labels : ''}<div class="lyr-trc n">${cells(r)}</div></div>`;
  }).join('');
}
