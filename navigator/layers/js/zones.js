// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// ZONES: 8-connected components of the current result (mask pass / score >= cutoff), with a user include/exclude override.
import { N, PX, ZONE, MONTHS, SIMPLE } from './config.js';
import { state, setState } from './state.js';
import { failBase, score100, critIds, scoreIds, scoreColor } from './compose.js';
import { decode, fmt } from './data.js';
import { layerColor } from './ramps.js';
import { cellToXY, cellToLatLon } from './geo.js';
import { describe } from './orient.js';
import { t, unitOf, layerName } from './strings.js';
import { doyOfMonth } from './pin.js';

const NPX = N * N, KM2 = PX * PX / 1e6, LS_KEY = 'lyr.zones.override.v1';
const pass = new Uint8Array(NPX), pass0 = new Uint8Array(NPX), lab = new Int32Array(NPX), stack = new Int32Array(NPX);
let D, el, ui = {}, Z = { zones: [], total: 0, bars: new Float32Array(12), map: null }, timer = 0, cb = null, pick = null;
const grow = new Uint8Array(NPX);

export const getZones = () => Z.zones;
export const zoneAt = (col, row) => { const l = lab[row * N + col]; return l && Z.map ? Z.zones[Z.map[l]] || null : null; };
export const hotZoneId = st => st.hoverZone ?? (st.hover && st.mode !== 'layers' ? zoneAt(st.hover.col, st.hover.row)?.id ?? null : null);
const fmtArea = v => String(+v.toFixed(v < 10 ? 2 : 1));
const sliderToArea = v => Math.round(0.25 * Math.pow(100, v / 100) / 0.25) * 0.25;
const areaToSlider = a => Math.round(100 * Math.log(a / 0.25) / Math.log(100));

// ---- override persistence (run-length encoded Int8) ----
export function loadOverride() {
  const ov = new Int8Array(NPX);
  try { const r = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (r) { let p = 0; for (let k = 0; k < r.length; k += 2) { ov.fill(r[k], p, p + r[k + 1]); p += r[k + 1]; } } } catch (e) { /* ignore */ }
  return ov;
}
export function saveOverride(ov) {
  const r = []; let i = 0;
  while (i < NPX) { let j = i + 1; while (j < NPX && ov[j] === ov[i]) j++; r.push(ov[i], j - i); i = j; }
  try { if (r.length <= 2 && r[0] === 0) localStorage.removeItem(LS_KEY); else localStorage.setItem(LS_KEY, JSON.stringify(r)); } catch (e) { /* quota */ }
}
export function paint(col, row, rc, val) {
  const ov = state.ov, c0 = Math.max(0, Math.floor(col - rc)), c1 = Math.min(N - 1, Math.ceil(col + rc)), r0 = Math.max(0, Math.floor(row - rc)), r1 = Math.min(N - 1, Math.ceil(row + rc));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if ((c - col) ** 2 + (r - row) ** 2 <= rc * rc + 1e-6) ov[r * N + c] = val;
}
export const brushCells = scale => Math.max(1, Math.min(12, 10 / scale));

// ---- computation ----
function compute(st) {
  const mask = st.mode === 'mask', score = st.mode === 'score', adv = st.adv, ov = adv ? st.ov : null;
  const mon = adv && st.month != null && D.month ? D.month.subarray(st.month * NPX, (st.month + 1) * NPX) : null, mthr = st.monthThr;
  const ids = mask ? critIds(st) : score ? scoreIds(st) : [];
  const nb = mask ? ids.length : 0, cut = st.cutoff, active = mask || score;
  let any = false;
  for (let i = 0; i < NPX; i++) {
    let b = false;
    if (active) {
      if (mask) b = nb > 0 ? failBase[i] === 0 : !!mon;
      else { const s = score100[i]; b = s !== 255 && s >= cut; }
    }
    const o = ov ? ov[i] : 0;
    const p0 = o === 1 ? 1 : o === -1 ? 0 : b ? 1 : 0;
    pass0[i] = p0;
    pass[i] = o !== 0 ? p0 : (b && !(mon && mon[i] < mthr)) ? 1 : 0;
    if (pass[i]) any = true;
  }
  const bars = new Float32Array(12);
  if (adv && D.month && active) for (let i = 0; i < NPX; i++) if (pass0[i]) for (let m = 0; m < 12; m++) if (D.month[m * NPX + i] >= mthr) bars[m]++;
  for (let m = 0; m < 12; m++) bars[m] *= KM2;
  Z = { zones: [], total: 0, bars, map: null };
  lab.fill(0);
  if (!any) return;
  // join fragments <= ZONE.merge cells apart: label the dilated mask (8-neighbourhood), count real pass pixels only
  const g = ZONE.merge;
  grow.fill(0);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (!pass[r * N + c]) continue;
    for (let dr = -g; dr <= g; dr++) { const rr = r + dr; if (rr < 0 || rr >= N) continue; for (let dc = -g; dc <= g; dc++) { const cc = c + dc; if (cc >= 0 && cc < N) grow[rr * N + cc] = 1; } }
  }
  const comps = []; let nl = 0;
  for (let s = 0; s < NPX; s++) {
    if (!grow[s] || lab[s]) continue;
    nl++; let sp = 0, cnt = 0, sx = 0, sy = 0, ss = 0; stack[sp++] = s; lab[s] = nl;
    while (sp) {
      const p = stack[--sp], c = p % N, r = (p - c) / N;
      if (pass[p]) { cnt++; sx += c; sy += r; if (score) ss += score100[p] === 255 ? 0 : score100[p]; }
      for (let dr = -1; dr <= 1; dr++) {
        const rr = r + dr; if (rr < 0 || rr >= N) continue;
        for (let dc = -1; dc <= 1; dc++) { const cc = c + dc; if (cc < 0 || cc >= N) continue; const q = rr * N + cc; if (grow[q] && !lab[q]) { lab[q] = nl; stack[sp++] = q; } }
      }
    }
    comps.push({ l: nl, px: cnt, sx, sy, ss });
  }
  const minPx = Math.max(1, Math.round((adv ? st.minArea : 1) / KM2));
  const kept = comps.filter(c => c.px >= minPx);
  const byScore = score && st.sortBy !== 'area';
  kept.sort(byScore ? (a, b) => b.ss / b.px - a.ss / a.px || b.px - a.px : (a, b) => b.px - a.px);
  Z.total = kept.length;
  const top = kept.slice(0, adv ? ZONE.top : ZONE.simpleTop), map = new Int16Array(nl + 1).fill(-1);
  top.forEach((c, i) => { map[c.l] = i; c.pix = []; c.pp = []; });
  for (let i = 0; i < NPX; i++) { const l = lab[i]; if (l) { const k = map[l]; if (k >= 0) { top[k].pix.push(i); if (pass[i]) top[k].pp.push(i); } } }
  const hist = new Uint32Array(256), d14 = D.bytes.days14, dm = D.layers.find(m => m.id === 'days14');
  Z.map = map;
  Z.zones = top.map((c, i) => {
    const mx = c.sx / c.px, my = c.sy / c.px; let best = c.pp[0], bv = -1, bd = 1e18, c0 = N, c1 = 0, r0 = N, r1 = 0;
    for (const p of c.pix) { const col = p % N, row = (p - col) / N; if (col < c0) c0 = col; if (col > c1) c1 = col; if (row < r0) r0 = row; if (row > r1) r1 = row; }
    for (const p of c.pp) {
      const col = p % N, row = (p - col) / N, d = (col - mx) ** 2 + (row - my) ** 2, v = d14 && d14[p] <= 250 ? d14[p] : 0;
      if (v > bv || (v === bv && d < bd)) { bv = v; bd = d; best = p; }
    }
    const col = best % N, row = (best - col) / N, { x, y } = cellToXY(col, row);
    const meds = adv ? ids.map(id => ({ id, v: median(c.pp, D.bytes[id], hist, v => decode(D.layers.find(m => m.id === id), v)) })) : [];
    const go = d14 ? median(c.pp, d14, hist, v => Math.round(decode(dm, v))) : 0;
    const ll = cellToLatLon(col, row);
    const title = (describe(x, y, D.landmarks) || '').replace(/ (\d+) km$/, ' $1 km') || `${Math.abs(ll.lat).toFixed(1)}°S ${Math.abs(ll.lon).toFixed(0)}°${ll.lon < 0 ? 'W' : 'E'}`;
    return { id: i + 1, label: c.l, px: c.px, area: c.px * KM2, mean: score ? c.ss / c.px : null, col, row, best: { col, row }, go: go ?? 0, bbox: [c0, r0, c1, r1], title, meds, path: edges(c) };
  });
}
function median(pix, arr, hist, dec, maxV = 250) {
  hist.fill(0); let n = 0;
  for (const p of pix) { const v = arr[p]; if (v <= maxV) { hist[v]++; n++; } }
  if (!n) return null;
  let acc = 0; for (let v = 0; v <= maxV; v++) { acc += hist[v]; if (acc * 2 >= n) return dec(v); }
  return null;
}
// pixel-edge outline (envelope of the joined zone) in grid coordinates; horizontal runs merged
function edges(c) {
  const L = c.l; let d = '', tr = null, br = null;
  const flush = r => { if (r) d += `M${r.c0} ${r.r}h${r.c1 - r.c0}`; };
  for (const p of c.pix) {
    const col = p % N, row = (p - col) / N;
    if (row === 0 || lab[p - N] !== L) { if (tr && tr.r === row && tr.c1 === col) tr.c1 = col + 1; else { flush(tr); tr = { r: row, c0: col, c1: col + 1 }; } }
    if (row === N - 1 || lab[p + N] !== L) { if (br && br.r === row + 1 && br.c1 === col) br.c1 = col + 1; else { flush(br); br = { r: row + 1, c0: col, c1: col + 1 }; } }
    if (col === 0 || lab[p - 1] !== L) d += `M${col} ${row}v1`;
    if (col === N - 1 || lab[p + 1] !== L) d += `M${col + 1} ${row}v1`;
  }
  flush(tr); flush(br);
  return d;
}

export function scheduleZones(st, done) {
  cb = done; clearTimeout(timer);
  timer = setTimeout(() => { compute(st); if (state.hoverZone && !Z.zones.some(z => z.id === state.hoverZone)) state.hoverZone = null; rebuild(st); cb && cb(); }, ZONE.debounce);
}

// ---- UI ----
export function initZones(root, d, opts = {}) {
  D = d; el = root; pick = opts.pick;
  el.innerHTML = `<div class="lyr-zadv"><div class="lyr-zh"><span class="seg lyr-zsort" hidden><button data-s="area">${t('z_area')}</button><button data-s="score">${t('z_score')}</button></span><span class="lyr-zgrow"></span><button class="lyr-pen" aria-pressed="false" title="✎">✎</button></div>
<div class="lyr-ze" hidden><span class="seg"><button data-tool="add">${t('z_add')}</button><button data-tool="erase">${t('z_erase')}</button></span><button class="lyr-zclr">${t('z_clear')}</button></div>
<div class="lyr-za"><input type="range" min="0" max="100" step="1"><span class="n lyr-zav"></span></div>
<div class="lyr-zmo"${d.month ? '' : ' hidden'} title="${t('month')}">${MONTHS.map((m, i) => `<button data-m="${i}"><i></i><span>${m}</span></button>`).join('')}</div>
<div class="lyr-zmt" hidden><input type="range" min="1" max="31" step="1"><span class="n"></span></div></div>
<div class="lyr-zhd"><h2>${t('zones')}</h2><span class="n lyr-zn"></span><span class="lyr-c3">${t('col_area')}</span><span class="lyr-c4">${t('col_go')}</span></div>
<div class="lyr-zl"></div>`;
  const q = s => el.querySelector(s);
  ui = { n: q('.lyr-zn'), sort: q('.lyr-zsort'), pen: q('.lyr-pen'), ed: q('.lyr-ze'), area: q('.lyr-za input'), av: q('.lyr-zav'), mo: q('.lyr-zmo'), mt: q('.lyr-zmt'), mti: q('.lyr-zmt input'), mtv: q('.lyr-zmt .n'), list: q('.lyr-zl') };
  ui.pen.onclick = () => setState({ edit: state.edit ? null : 'add' }, 'panel');
  ui.ed.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tool) setState({ edit: b.dataset.tool }, 'panel');
    else { state.ov.fill(0); saveOverride(state.ov); setState({}, 'pixels'); }
  };
  ui.sort.onclick = e => { const b = e.target.closest('button'); if (b) setState({ sortBy: b.dataset.s }, 'zones'); };
  ui.area.oninput = () => setState({ minArea: sliderToArea(+ui.area.value) }, 'zones');
  ui.mo.onclick = e => { const b = e.target.closest('button'); if (!b) return; const m = +b.dataset.m; setState({ month: state.month === m ? null : m, tDay: state.month === m ? state.tDay : doyOfMonth(m), tTouched: true }, 'pixels'); };
  ui.mti.oninput = () => setState({ monthThr: +ui.mti.value }, 'pixels');
  ui.list.onclick = e => { const r = e.target.closest('.lyr-zone'); if (r) { const z = Z.zones.find(z => z.id === +r.dataset.id); if (z && pick) pick(z); } };
  ui.list.onmouseover = e => { const r = e.target.closest('.lyr-zone'), id = r ? +r.dataset.id : null; if (id !== state.hoverZone) setState({ hoverZone: id }, 'hover'); };
  ui.list.onmouseleave = () => { if (state.hoverZone != null) setState({ hoverZone: null }, 'hover'); };
}
const short = id => layerName(D.layers.find(m => m.id === id)).split(' ')[0];
function medLine(z) {
  return z.meds.filter(m => m.v != null).map(m => { const mt = D.layers.find(x => x.id === m.id); return `${short(m.id)} ${fmt(mt, m.v)}${unitOf(mt)}`; }).join(' · ');
}
function rebuild(st) {
  ui.n.textContent = Z.total || '';
  const mx = Math.max(1e-9, ...Z.zones.map(z => z.area));
  ui.list.innerHTML = Z.zones.map(z => `<div class="lyr-zone" data-id="${z.id}"><span class="lyr-zbd n">${z.id}</span><div class="lyr-zt">${z.title}</div><span class="lyr-zbar"><b style="width:${(z.area / mx * 100).toFixed(1)}%"></b></span><span class="n lyr-c3">${z.area.toFixed(1)}</span><span class="n lyr-c4">${z.go}</span>${st.adv && z.mean != null ? `<span class="lyr-zmed n">${Math.round(z.mean)}</span>` : ''}${st.adv ? `<div class="lyr-zmed2">${medLine(z)}</div>` : ''}</div>`).join('');
  renderZones(st);
  drawBars();
}
function drawBars() {
  const mx = Math.max(1e-9, ...Z.bars), cells = ui.mo.children;
  for (let m = 0; m < 12; m++) { cells[m].firstChild.style.height = (Z.bars[m] / mx * 100) + '%'; cells[m].title = Math.round(Z.bars[m]) + ' km²'; }
}
export function renderZones(st) {
  if (!ui.list) return;
  const hot = hotZoneId(st);
  for (const r of ui.list.children) r.classList.toggle('hot', +r.dataset.id === hot);
  ui.pen.setAttribute('aria-pressed', !!st.edit); ui.ed.hidden = !st.edit;
  ui.ed.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === st.edit));
  ui.sort.hidden = st.mode !== 'score';
  const sb = st.sortBy === 'area' ? 'area' : 'score';
  ui.sort.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === sb));
  ui.area.value = areaToSlider(st.minArea); ui.av.textContent = fmtArea(st.minArea) + ' km²';
  ui.mo.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', st.month === +b.dataset.m));
  ui.mt.hidden = st.month == null; ui.mti.value = st.monthThr; ui.mtv.textContent = '≥' + st.monthThr + t('d');
}
