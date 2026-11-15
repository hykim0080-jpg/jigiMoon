// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// The pin: a chosen pixel, its GO calendar and the verdict for the selected day (GO / wait / move / mast / none).
import { N, PX, BUDGET } from './config.js';
import { cellToXY, cellToLatLon } from './geo.js';
import { describe, sectorOf } from './orient.js';
import { sample, failBase, critIds } from './compose.js';
import { skyAt, calendarFrom } from './time.js';
import { isBase, critHash } from './crit.js';
import { decode } from './data.js';
import { lang } from './strings.js';
import { goNear } from './trip.js';

const NPX = N * N, DAYS = 365, T0 = Date.UTC(2027, 0, 1);
let D, key = '', info = null, onCal = null; const cal = new Map(), asked = new Set();
export const setOnCal = f => { onCal = f; };
export const initPin = d => { D = d; };
export const doyOfMonth = m => (Date.UTC(2027, m, 1) - T0) / 864e5;
export const isoOfDay = d => new Date(T0 + d * 864e5).toISOString().slice(0, 10);

function slot(i) {
  const o = D.ok14; if (!o) return -1;
  let lo = 0, hi = o.idx.length - 1;
  while (lo <= hi) { const mid = (lo + hi) >> 1, v = o.idx[mid]; if (v === i) return mid; if (v < i) lo = mid + 1; else hi = mid - 1; }
  return -1;
}
export function goBit(i, d) { const k = slot(i); return k >= 0 && ((D.ok14.bits[k * 46 + (d >> 3)] >> (7 - (d & 7))) & 1) === 1; }
function goDays(i) {
  if (!D.ok14) return null;
  const k = slot(i), go = new Uint8Array(DAYS); let count = 0;
  if (k >= 0) for (let d = 0; d < DAYS; d++) if ((D.ok14.bits[k * 46 + (d >> 3)] >> (7 - (d & 7))) & 1) { go[d] = 1; count++; }
  return { go, count };
}
const slopeMeta = () => D.layers.find(m => m.id === 'slope');
const slopeVal = i => { const m = slopeMeta(), b = m && D.bytes.slope; return b && b[i] <= 250 ? decode(m, b[i]) : null; };
const dayVal = (arr, m, i) => arr && arr[i] <= 250 ? Math.round(arr[i] * 365 / 250) : 0;

function verdict(st, p, go, slopeV, nd) {
  const d = st.tDay, i = p.row * N + p.col, thr = st.threshold.slope, slopeOn = st.on.mask.slope && slopeMeta() && thr != null;
  const steep = !!(slopeOn && slopeV != null && slopeV > thr);
  const goNow = !steep && !!go && go.go[d] === 1;
  let run = 0; if (goNow) while (d + run < DAYS && go.go[d + run]) run++;
  let wait = null; if (!steep && go && !goNow) for (let d2 = d + 1; d2 < DAYS; d2++) if (go.go[d2]) { wait = d2 - d; break; }
  let move = null;
  if (goNow) move = { here: true };
  else if (st.mission !== 14) {
    const g = goNear(p.col, p.row, d, st.crit, st.mission, BUDGET.moveCells);
    if (g) { move = { col: g.col, row: g.row }; const dx = (g.col - p.col) * PX, dy = -(g.row - p.row) * PX; move.km = Math.sqrt(g.d2) * PX / 1000; move.dir = sectorOf(dx, dy); }
  }
  else if (nd ? st.mode === 'mask' && critIds(st).length : D.ok14) {
    let bd = BUDGET.moveCells ** 2 + 1;
    for (let r = Math.max(0, p.row - BUDGET.moveCells); r <= Math.min(N - 1, p.row + BUDGET.moveCells); r++) for (let c = Math.max(0, p.col - BUDGET.moveCells); c <= Math.min(N - 1, p.col + BUDGET.moveCells); c++) {
      const dd = (c - p.col) ** 2 + (r - p.row) ** 2; if (dd >= bd || (nd && dd === 0)) continue;
      const j = r * N + c; if (nd ? failBase[j] !== 0 : !goBit(j, d)) continue;
      if (slopeOn) { const s = slopeVal(j); if (s == null || s > thr) continue; }
      bd = dd; move = { col: c, row: r };
    }
    if (move) { const dx = (move.col - p.col) * PX, dy = -(move.row - p.row) * PX; move.km = Math.sqrt(bd) * PX / 1000; move.dir = sectorOf(dx, dy); }
  }
  const a6 = dayVal(D.bytes.days6, null, i), a20 = D.m20 ? dayVal(D.m20, null, i) : 0, gain = a20 - a6;
  const mast = !steep && D.m20 && gain >= BUDGET.mastMinGain ? { gain, from: a6, to: a20 } : null;
  let kind;
  if (goNow) kind = 'go';
  else {
    const cw = wait != null && wait <= BUDGET.wait ? wait / BUDGET.wait : Infinity, cm = move && !move.here ? move.km / BUDGET.move : Infinity;
    if (cw === Infinity && cm === Infinity) kind = mast && (go ? go.count === 0 : true) ? 'mast' : 'none';
    else kind = cw <= cm ? 'wait' : 'move';
  }
  return { pending: nd && !go, kind, d, steep, slopeV, run, wait, move, mast, goNow, slopeThr: thr };
}

export function pinInfo(st) {
  const p = st.pin; if (!p) { key = ''; return info = null; }
  const nd = !isBase(st.crit) || st.mission !== 14, ck = `${p.row * N + p.col}|${JSON.stringify(st.crit)}|${st.mission}`;
  const k = `${p.col},${p.row},${st.tDay},${JSON.stringify(st.threshold)},${JSON.stringify(st.on.mask)},${ck},${cal.has(ck)},${st.mode}`;
  if (k === key) return info; key = k;
  const i = p.row * N + p.col, { x, y } = cellToXY(p.col, p.row), ll = cellToLatLon(p.col, p.row);
  let go = nd ? cal.get(ck) || null : goDays(i); const sv = slopeVal(i);
  if (nd && !go && !asked.has(ck)) { asked.add(ck); skyAt(p.col, p.row).then(sky => { cal.set(ck, calendarFrom(sky, st.crit, st.mission)); asked.delete(ck); onCal && onCal(); }); }
  const site = D.sites.find(s => s.box_m && x >= s.box_m[0] && x <= s.box_m[2] && y >= s.box_m[1] && y <= s.box_m[3]);
  const lq = new URLSearchParams(location.search).get('lang') || new URLSearchParams(location.hash.slice(1)).get('lang');
  const ch = critHash(D.meta, st.crit), q = lq ? '?lang=' + lq : '', l2 = (lq ? '&lang=' + lq : '') + (ch ? '&' + ch : '');
  const link = site ? `../index.html${q}#s=${site.id}&day=${st.tDay}&m=${st.mission}&fv=${go && go.go[st.tDay] ? 1 : 0}${l2}` : `../index.html${q}#pin=${Math.round(x)},${Math.round(y)}&d=${isoOfDay(st.tDay)}${l2}`;
  return info = {
    col: p.col, row: p.row, x, y, ll, go, siteId: site ? site.id : null, site,
    title: describe(x, y, D.landmarks) || `${Math.abs(ll.lat).toFixed(2)}°S`,
    values: sample(p.col, p.row)?.values || {}, v: verdict(st, p, go, sv, nd), pending: nd && !go, link,
  };
}
