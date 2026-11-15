// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Right panel: the pin card — verdict first, then fixes, checks, sky, GO calendar, link.
import { state, setState } from './state.js';
import { pinInfo, isoOfDay } from './pin.js';
import { layerColor } from './ramps.js';
import { fmt } from './data.js';
import { BUDGET } from './config.js';
import { t, lang, unitOf, layerName } from './strings.js';
import { skyAt, skyCached, drawPinSky } from './time.js';
import { critName, critValue } from './criteria.js';
import { statsCached, statsFor, whyNoFix, tt } from './trip.js';
import { WIN_IDS, useWin } from './window.js';
import { inCart, toggleCart, ct, MAX, compareWith } from './cart.js';
import { zoomSvg } from './zoom.js';
import { hue, N } from './config.js';
import { failCount } from './compose.js';
// the checks use the Criteria panel's own short words, so nothing is cut off in the card
const SHORT = { en: { sun: 'Sun', earth: 'Earth', dark: 'Dark', slope: 'Slope', ice: 'Ice' }, ko: { sun: '햇빛', earth: '지구', dark: '어둠', slope: '경사', ice: '얼음' } }[lang === 'ko' ? 'ko' : 'en'];
const DARK_TIP = lang === 'ko' ? '햇빛이 한 번에 가장 오래 끊긴 시간' : 'Longest stretch without sunlight';
const shortName = m => SHORT[hue(m.id)] || critName(m);

let el, data, key = '', drag = false, fixOf = {};
// a fix row applies itself: MOVE moves the spot, WAIT moves the landing day, MAST opens the spot in Compare (the pole height is chosen there)
function applyFix(k) {
  if (k === 'move' && fixOf.move) setState({ pin: { col: fixOf.move.col, row: fixOf.move.row }, autoPin: false }, 'panel');
  else if (k === 'wait' && fixOf.wait != null) setState({ tDay: Math.min(364, state.tDay + fixOf.wait), tTouched: true }, 'time');
  else if (k === 'mast' && fixOf.mast) (window.top || window).location.href = new URL(fixOf.mast, location.href).href;
}
const KIND = { go: 'ok', wait: 'wait', move: 'move', mast: 'mast', none: 'block' };
const doy = m => (Date.UTC(2027, m, 1) - Date.UTC(2027, 0, 1)) / 864e5;
const setDay = d => { d = Math.max(0, Math.min(364, Math.round(d))); if (d !== state.tDay) setState({ tDay: d, tTouched: true }, 'time'); };
export function initPinCard(root, d) {
  el = root; data = d;
  const dayFrom = e => { const cv = el.querySelector('.lyr-pcal'); if (!cv) return; const b = cv.getBoundingClientRect(); setDay((e.clientX - b.left) / b.width * 365 - .5); };
  el.addEventListener('pointerdown', e => { if (e.target.closest('.lyr-pcal')) { drag = true; el.setPointerCapture(e.pointerId); dayFrom(e); } });
  el.addEventListener('pointermove', e => { if (drag) dayFrom(e); });
  el.addEventListener('pointerup', () => { drag = false; });
  el.addEventListener('keydown', e => { const fx = e.target.closest('[data-fix]'); if (fx && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); applyFix(fx.dataset.fix); } });
  el.addEventListener('click', e => { const fx = e.target.closest('[data-fix]'); if (fx) { applyFix(fx.dataset.fix); return; } const b = e.target.closest('[data-step]'); if (b) setDay(state.tDay + +b.dataset.step); if (e.target.closest('[data-cart]') && state.pin) toggleCart(state.pin.col, state.pin.row); });
}
const ARROW = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
const arrowOf = (dc, dr) => ARROW[((Math.round(Math.atan2(dc, -dr) / (Math.PI / 4)) % 8) + 8) % 8];   // up = Earth side
const W2 = { en: { near: 'Nearest GO', here: 'GO here', earth: 'Earth', mast: 'MAST', wait: 'WAIT', sun: 'Sun', earthV: 'Earth', dark: 'Dark' }, ko: { near: '가장 가까운 GO', here: '여기서 GO', earth: '지구', mast: '마스트', wait: '대기', sun: '햇빛', earthV: '지구', dark: '어둠' } }[lang === 'ko' ? 'ko' : 'en'];
// the first criterion this stay misses, as on Detail's verdict: "Sun 55 % < 70 %"
function missOf(inf, st) {
  const w = statsCached(inf.col, inf.row, st.mission), d = st.tDay, c = st.crit; if (!w) return '';
  const s = Math.floor(w.sun[d]), e = Math.floor(w.earth[d]), k = Math.ceil(w.dark[d]);
  return s < c.sun ? `${W2.sun} ${s} % < ${c.sun} %` : e < c.earth ? `${W2.earthV} ${e} % < ${c.earth} %` : k > c.dark ? `${W2.dark} ${k} h > ${c.dark} h` : '';
}
// the fixes in one line under the verdict, as on Detail: Nearest GO · MAST · WAIT (a fix that does not work is left out)
function fixLine(v, inf) {
  if (v.pending || v.goNow) return '';
  const b = [];
  if (fixOf.move) b.push(`<button type="button" class="lyr-vb" data-fix="move" style="--c:var(--move)"><i>${W2.near}</i> <b>${v.move.km.toFixed(1)}</b> km ${arrowOf(v.move.col - inf.col, v.move.row - inf.row)}</button>`);
  if (fixOf.mast) b.push(`<button type="button" class="lyr-vb" data-fix="mast" style="--c:var(--mast)"><i>${W2.mast}</i> <b>20</b> m</button>`);
  if (fixOf.wait != null) b.push(`<button type="button" class="lyr-vb" data-fix="wait" style="--c:var(--wait)"><i>${W2.wait}</i> <b>${fixOf.wait}</b> d</button>`);
  return b.length ? `<div class="lyr-vfx">${b.join('')}</div>` : '';
}
// the ground around the spot, 3 km each way on the 500 m map: GO cells in blue, the spot in the middle, Earth up
// the checks (and the GO-days count) sit left of the grid, so the sky above gets the height
function moveGrid(inf, v, side = '') {
  const R = 6, S = 10, n = 2 * R + 1, cells = [];
  for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) {
    if (dc * dc + dr * dr > R * R + R) continue;
    const c = inf.col + dc, r = inf.row + dr; if (c < 0 || r < 0 || c >= N || r >= N) continue;
    const go = failCount && failCount[r * N + c] === 0;
    cells.push(`<rect x="${(dc + R) * S}" y="${(dr + R) * S}" width="${S - .6}" height="${S - .6}" fill="${go ? 'rgba(116,162,242,.8)' : 'rgba(255,255,255,.06)'}"/>`);
  }
  const mv = v.move && !v.move.here && v.move.col != null && Math.abs(v.move.col - inf.col) <= R && Math.abs(v.move.row - inf.row) <= R ? v.move : null;
  const ring = mv ? `<rect x="${(mv.col - inf.col + R) * S - 1}" y="${(mv.row - inf.row + R) * S - 1}" width="${S + 1.4}" height="${S + 1.4}" fill="none" stroke="#fff" stroke-width="1.2"/>` : '';
  const head = v.goNow ? `<b style="color:var(--ok)">${W2.here}</b>` : v.move && !v.move.here && v.move.km != null ? `<i>${W2.near}</i> <b>${v.move.km.toFixed(1)}</b> km ${arrowOf(v.move.col - inf.col, v.move.row - inf.row)}` : `<i>${W2.near}</i> —`;
  const C = R * S + S / 2;
  return `<div class="lyr-mv"><div class="lyr-mvl"><div class="lyr-mvh">${head}</div>${side}</div><svg viewBox="-4 -4 ${n * S + 8} ${n * S + 8}" class="lyr-mvg">${cells.join('')}<circle cx="${C}" cy="${C}" r="${R * S + 3}" fill="none" stroke="rgba(255,255,255,.25)" stroke-dasharray="2 3"/>${ring}<circle cx="${C}" cy="${C}" r="4.2" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="${C}" cy="${C}" r="1.4" fill="#fff"/><text x="0" y="7" class="lyr-mvt">↑ ${W2.earth}</text><text x="${n * S}" y="${n * S}" text-anchor="end" class="lyr-mvt">3 km</text></svg></div>`;
}
function verdictHtml(v, inf, st) {
  if (v.pending) return `<i class="lyr-dot" style="background:var(--muted)"></i><span style="color:var(--muted)">…</span>`;
  const dot = `<i class="lyr-dot" style="background:var(--${v.kind === 'go' ? 'ok' : 'block'})"></i>`;
  if (v.kind === 'go') return `${dot}<span style="color:var(--ok)">${t('go_run', v.run)}</span>`;
  // short, as on Detail: NO-GO, then the one criterion it misses
  const why = v.steep ? t('slope_fail', v.slopeV.toFixed(0)) : missOf(inf, st);
  return `${dot}<span><span style="color:var(--block)">${t('nogo')}</span>${why ? `<small class="lyr-vwhy">${why}</small>` : ''}</span>`;
}
export function renderPinCard(st) {
  const inf = pinInfo(st);
  const k = inf ? `${JSON.stringify(st.cart)},${inf.col},${inf.row},${st.tDay},${st.mission},${!!statsCached(inf.col, inf.row, st.mission)},${st.adv},${inf.pending},${inf.go ? inf.go.count : ''},${JSON.stringify(st.crit)},${JSON.stringify(st.threshold)},${JSON.stringify(st.on.mask)}` : '';
  if (k === key) return; key = k;
  if (!inf) { el.innerHTML = ''; return; }
  const v = inf.v, f = (kind, label, val, title = '', can = false) => `<div class="lyr-fx${v.kind === kind ? ' pick' : ''}${val == null ? ' na' : ''}${can ? ' can' : ''}" style="--c:var(--${kind})" title="${can ? t('fix_apply') + (title ? ' · ' + title : '') : title}"${can ? ` data-fix="${kind}" role="button" tabindex="0"` : ''}><span>${label}</span><span class="n">${val ?? '—'}${can ? ' →' : ''}</span></div>`;
  fixOf = { move: v.move && !v.move.here && v.move.col != null ? v.move : null, wait: !v.goNow && v.wait != null && v.wait <= BUDGET.wait ? v.wait : null, mast: !v.goNow && v.mast ? inf.link : null };
  const mv = v.move ? (v.move.here ? t('here') : t('move_txt', v.move.dir, v.move.km.toFixed(1))) : null;
  const wb = useWin(st), ws = statsCached(inf.col, inf.row, st.mission), dd = st.tDay;
  const checks = data.layers.filter(m => m.threshold != null).map(m => {
    const wk = wb && WIN_IDS[m.id];
    if (wk) {   // judged over this stay: the stay's own value against the criterion (bar 0-100 %, dark 0-stay h)
      const c = st.crit[wk], raw = ws ? ws[wk][dd] : null, val = raw == null ? null : wk === 'dark' ? Math.ceil(raw) : Math.floor(raw), mx = wk === 'dark' ? st.mission * 24 : 100;
      const fail = val != null && (wk === 'dark' ? val > c : val < c), pc = x => Math.max(0, Math.min(100, 100 * x / mx));
      return `<div class="lyr-ck${st.on.mask[m.id] ? '' : ' off'}"><i class="lyr-tg" style="--c:${layerColor(m.id, false)}"></i><span class="lyr-nm" title="${critName(m)}">${shortName(m)}</span><span class="lyr-ckb"><b style="width:${val == null ? 0 : pc(val)}%;background:${fail ? 'var(--block)' : layerColor(m.id, false)}"></b><u style="left:${pc(c)}%"></u></span><span class="n lyr-ckv${fail ? ' fail' : ''}"${wk === 'dark' ? ` title="${DARK_TIP}"` : ''}>${val == null ? '–' : (wk === 'dark' ? '⟷ ' + val + ' h' : val + ' %')}</span></div>`;
    }
    const val = inf.values[m.id], fail = (!m.optional || st.on.mask[m.id]) && state.threshold[m.id] != null && val != null && (m.direction === '<=' ? val > st.threshold[m.id] : val < st.threshold[m.id]);
    const pc = x => Math.max(0, Math.min(100, 100 * (x - m.min) / (m.max - m.min)));
    return `<div class="lyr-ck${st.on.mask[m.id] ? '' : ' off'}"><i class="lyr-tg" style="--c:${layerColor(m.id, false)}"></i><span class="lyr-nm" title="${critName(m)}">${shortName(m)}</span><span class="lyr-ckb"><b style="width:${val == null ? 0 : pc(val)}%;background:${fail ? 'var(--block)' : layerColor(m.id, false)}"></b><u style="left:${pc(st.threshold[m.id])}%"></u></span><span class="n lyr-ckv${fail ? ' fail' : ''}">${val == null ? '–' : fmt(m, val) + unitOf(m)}</span></div>`;
  }).join('');
  const adv = st.adv ? `<div class="lyr-tbl">${data.layers.map(m => { const val = inf.values[m.id]; return `<span>${layerName(m)}</span><span class="n">${val == null ? '–' : (val === Infinity ? '>' : '') + fmt(m, val) + unitOf(m)}</span>`; }).join('')}<span>${t('lat')}</span><span class="n">${Math.abs(inf.ll.lat).toFixed(2)}°${inf.ll.lat < 0 ? 'S' : 'N'} ${Math.abs(inf.ll.lon).toFixed(1)}°${inf.ll.lon < 0 ? 'W' : 'E'}</span></div>` : '';
  el.innerHTML = `<div class="lyr-pt">${inf.title}</div>
<div class="lyr-dt"><button data-step="-1">◀</button><span class="n">${isoOfDay(st.tDay)}</span><button data-step="1">▶</button></div>
<div class="lyr-vd">${verdictHtml(v, inf, st)}</div>${fixLine(v, inf)}${winRow(inf, st)}
<svg class="lyr-sky"></svg><svg class="lyr-dstrip"></svg>
${moveGrid(inf, v, `<div class="lyr-cks">${checks}</div>${inf.go ? `<span class="n lyr-go-n">${t('go')} ${t('days', inf.go.count)}</span>` : ''}`)}${adv}
${inf.go ? `<div class="lyr-cal"><canvas class="lyr-pcal"></canvas></div>` : ''}
${cartBtn(inf, st)}<a class="lyr-link" target="_top" href="${compareWith(st, inf.col, inf.row)}">${t('open_cmp')}</a>`;
  drawCal(inf, st);
  renderPinSky(st);
}
const cartBtn = (inf, st) => { const i = inCart(inf.col, inf.row), full = i < 0 && st.cart.length >= MAX; return `<button class="lyr-addc${i >= 0 ? ' in' : ''}" data-cart${full ? ' disabled' : ''}>${i >= 0 ? ct('added') : full ? ct('full') : ct('add')}</button>`; };
// the stay's own numbers for this landing day (same as the ranked list)
function winRow(inf, st) {
  const w = statsCached(inf.col, inf.row, st.mission), c = st.crit;
  if (!w) { statsFor(inf.col, inf.row, st.mission).then(() => { key = ''; renderPinCard(state); }); return '<div class="lyr-win n">…</div>'; }
  if (useWin(st)) return '';
  const d = st.tDay, s = Math.floor(w.sun[d]), e = Math.floor(w.earth[d]), k = Math.ceil(w.dark[d]);
  return `<div class="lyr-win n"><span>${tt('stayD', st.mission)}</span><span class="${s < c.sun ? 'bad' : ''}">${tt('lSun')} ${s} %</span><span class="${e < c.earth ? 'bad' : ''}">${tt('lEarth')} ${e} %</span><span class="${k > c.dark ? 'bad' : ''}">${tt('lDark')} ${k} h</span></div>`;
}
function drawCal(inf, st) {
  const cv = el.querySelector('.lyr-pcal'); if (!cv) return;
  const w = cv.clientWidth || 200, h = 10, g = (cv.width = w, cv.height = h, cv.getContext('2d')), cw = w / 365, cs = getComputedStyle(el);
  g.fillStyle = cs.getPropertyValue('--line').trim() || '#ccc'; g.fillRect(0, 0, w, h);
  g.fillStyle = cs.getPropertyValue('--ok').trim() || '#1f8a5b'; for (let d = 0; d < 365; d++) if (inf.go.go[d]) g.fillRect(d * cw, 0, Math.max(.7, cw), h);
  g.fillStyle = cs.getPropertyValue('--surface').trim() || '#fff'; for (let m = 1; m < 12; m++) g.fillRect(Math.round(doy(m) * cw), 0, 1, h);
  g.fillStyle = cs.getPropertyValue('--ink').trim() || '#000'; g.fillRect(Math.round((st.tDay + .5) * cw) - 1, 0, 2, h);
}
export function renderPinSky(st) {
  const svg = el && el.querySelector('.lyr-sky'); if (!svg || !st.pin) return;
  if (skyCached(st.pin.col, st.pin.row)) drawPinSky(svg, st);
  else skyAt(st.pin.col, st.pin.row).then(() => { if (el.querySelector('.lyr-sky') === svg) drawPinSky(svg, state); });
}
// redraw the calendar cursor without rebuilding the card (time changes rebuild it anyway through the key)
