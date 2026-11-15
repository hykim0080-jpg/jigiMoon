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
import { winToken } from './window.js';
import { inCart, toggleCart, ct } from './cart.js';

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
    nextGo: n => `next GO in ${n} d`, best: 'Best spots', loading: 'Computing…', go: 'GO', nogo: 'NO-GO',
    wait: n => `GO in ${n} d`, noFix: 'NO FIX',
    whySun: (v, c) => `Sun ${v} % of the stay (need ${c})`, whyEarth: (v, c) => `Earth in view ${v} % (need ${c})`, whyDark: (v, c) => `Longest dark ${v} h (max ${c})`,
    stayD: n => `${n} d`, wd: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    ans: (day, n, km2, where) => `If you land on <b>${day}</b> and stay <b>${n} days</b>, <b>${km2} km²</b>${where ? ` of ${where}` : ''} keeps power and Earth contact.`,
    ansNone: (day, n, where) => `If you land on <b>${day}</b> and stay <b>${n} days</b>, no ground${where ? ` in ${where}` : ''} keeps power and Earth contact.`,
    ansBest: s => ` Best spot: <a data-rank="1">${s}</a>.`, ansNext: (n, s) => ` Soonest: <a data-rank="1">${s}</a>, in ${n} d.`,
    r: { shackleton: 'Shackleton area', mouton: 'Mons Mouton', malapert: 'Malapert · Haworth', nobile: 'Nobile', cabeus: 'Cabeus', all: 'Whole south pole' },
  },
  ko: { lSun: '햇빛', lEarth: '지구', lDark: '어둠',
    when: '언제', where: '어디로?', stay: '체류', pickDay: '착륙일', pickRegion: '지역 고르기',
    calNote: '착륙일별 가능한 지점 수', spots: n => `가능 지점 ${n}곳`, noneDay: '가능 지점 없음',
    nextGo: n => `${n}일 뒤 가능`, best: '추천 지점', loading: '계산 중…', go: '가능', nogo: '불가',
    wait: n => `${n}일 후`, noFix: '해법 없음',
    whySun: (v, c) => `햇빛 ${v} % (기준 ${c})`, whyEarth: (v, c) => `지구 보임 ${v} % (기준 ${c})`, whyDark: (v, c) => `가장 긴 어둠 ${v}시간 (최대 ${c})`,
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
    if (reg.r) { const { x, y } = cellToXY(c, r); if (Math.hypot(x / 1000 - reg.x, y / 1000 - reg.y) > reg.r) continue; }
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
  const k = `${rid}|${mission}|${maskKey()}`; if (pools.has(k)) return pools.get(k);
  if (pools.size > 40) pools.clear();
  const p = { cells: poolCells(rid, mission), ready: false };
  p.promise = (async () => { await ensure(); let n = 0; for (const c of p.cells) { c.w = await statsAsync(c.col, c.row, mission); if (++n % 12 === 0) await new Promise(r => setTimeout(r, 0)); } p.ready = true; })();
  pools.set(k, p); return p;
}
const maskKey = () => JSON.stringify([state.crit, state.threshold, state.on.mask, state.mode, winToken(state)]);
export function goCount(p, d, crit) { let n = 0; for (const c of p.cells) if (c.w && isGo(c.w, d, crit)) n++; return n; }

// ranked spots of a pool for a landing day: GO first (largest margin), then the soonest to become GO
export function rank(p, d, crit) {
  const rows = p.cells.filter(c => c.w).map(c => {
    const w = c.w, go = isGo(w, d, crit);
    let wait = null; if (!go) for (let k = d + 1; k < DAYS; k++) if (isGo(w, k, crit)) { wait = k - d; break; }
    const margin = (w.sun[d] - crit.sun) / crit.sun + (w.earth[d] - crit.earth) / crit.earth + (crit.dark - w.dark[d]) / crit.dark;
    return { col: c.col, row: c.row, go, wait, margin, sun: w.sun[d], earth: w.earth[d], dark: w.dark[d] };
  });
  rows.sort((a, b) => (b.go - a.go) || (a.go ? b.margin - a.margin : (a.wait ?? 999) - (b.wait ?? 999) || b.margin - a.margin));
  const nGo = rows.filter(r => r.go).length;
  return rows.slice(0, Math.min(30, Math.max(10, nGo))).map((r, i) => { const { x, y } = cellToXY(r.col, r.row); return { ...r, id: i + 1, best: { col: r.col, row: r.row }, bbox: [r.col - 6, r.row - 6, r.col + 6, r.row + 6], title: describe(x, y, D.landmarks) || '' }; });
}

// ---- UI ----
let bar, pop, list, ans, opts = {}, ranked = [], calMonth = null, rkey = '';
export const tripRanked = () => ranked;
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
  list.onclick = e => { const a = e.target.closest('[data-addr]'); if (a) { e.stopPropagation(); const z = ranked[+a.dataset.addr - 1]; if (z) toggleCart(z.col, z.row); return; } const r = e.target.closest('[data-rank]'); if (r) { const z = ranked[+r.dataset.rank - 1]; if (z) opts.pick && opts.pick(z); } };
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
  const rid = currentRegion(), p = poolOf(rid, st.mission), k = `${rid}|${st.mission}|${st.tDay}|${maskKey()}|${p.ready}|${JSON.stringify(st.cart)}`;
  if (!p.ready) p.promise.then(() => setState({}, 'panel'));
  if (k !== rkey) { rkey = k; ranked = p.ready ? rank(p, st.tDay, st.crit) : []; drawList(st, p); if (p.ready) opts.ranked && opts.ranked(ranked); }
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
  const k = `${rid}|${st.mission}|${st.tDay}|${maskKey()}|${p.ready}|${ranked.length && ranked[0].title}`;
  if (k === akey) return; akey = k;
  if (!p.ready) { ans.textContent = tt('loading'); return; }
  const km = regionArea(rid), where = st.region && st.region !== 'all' ? regionName(rid) : '', day = dayText(st.tDay), r0 = ranked[0];
  const km2 = km == null ? '' : km >= 100 ? String(Math.round(km / 10) * 10) : km >= 10 ? String(Math.round(km)) : km.toFixed(1);
  let h = km ? tt('ans', day, st.mission, km2, where) : tt('ansNone', day, st.mission, where);
  if (r0 && r0.go) h += tt('ansBest', r0.title);
  else if (r0 && r0.wait != null) h += tt('ansNext', r0.wait, r0.title);
  ans.innerHTML = h;
}
function drawList(st, p) {
  const c = st.crit;
  if (!p.ready) { list.innerHTML = `<div class="lyr-trh"><h2>${tt('best')}</h2></div><p class="lyr-tri">${tt('loading')}</p>`; return; }
  list.innerHTML = `<div class="lyr-trh"><h2>${tt('best')}</h2><span class="n">${regionName(currentRegion())} · ${tt('spots', ranked.filter(r => r.go).length)}</span></div>` + ranked.map((r, i) => {
    const v = r.go ? `<span style="color:var(--ok)">${tt('go')}</span>` : r.wait != null && r.wait <= LIM.wait ? `<span style="color:var(--wait)">${tt('wait', r.wait)}</span>` : `<span style="color:var(--muted)">${tt('nogo')}</span>`;
    const why = i === 0 ? `<ul class="lyr-why"><li class="${r.sun < c.sun ? 'bad' : ''}"><i style="background:var(--sun)"></i>${tt('whySun', Math.floor(r.sun), c.sun)}</li><li class="${r.earth < c.earth ? 'bad' : ''}"><i style="background:var(--earth)"></i>${tt('whyEarth', Math.floor(r.earth), c.earth)}</li><li class="${r.dark > c.dark ? 'bad' : ''}"><i style="background:var(--muted)"></i>${tt('whyDark', Math.ceil(r.dark), c.dark)}</li></ul>` : '';
    return `<div class="lyr-tr${i === 0 ? ' top' : ''}" data-rank="${r.id}"><span class="lyr-trn n">${r.id}</span><div class="lyr-trt">${r.title}</div><div class="lyr-trv">${v}<button class="lyr-tradd${inCart(r.col, r.row) >= 0 ? ' in' : ''}" data-addr="${r.id}" title="${ct(inCart(r.col, r.row) >= 0 ? 'added' : 'add')}">${inCart(r.col, r.row) >= 0 ? '✓' : '+'}</button></div><div class="lyr-trs n">${tt('lSun')} ${Math.floor(r.sun)} % · ${tt('lEarth')} ${Math.floor(r.earth)} % · ${tt('lDark')} ${Math.ceil(r.dark)} h</div>${why}</div>`;
  }).join('');
}
