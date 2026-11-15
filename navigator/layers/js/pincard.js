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
import { inCart, toggleCart, ct, MAX } from './cart.js';
import { zoomSvg } from './zoom.js';
import { hue } from './config.js';
// the checks use the Criteria panel's own short words, so nothing is cut off in the card
const SHORT = { en: { sun: 'Sun', earth: 'Earth', dark: 'Dark', slope: 'Slope', ice: 'Ice' }, ko: { sun: '햇빛', earth: '지구', dark: '어둠', slope: '경사', ice: '얼음' } }[lang === 'ko' ? 'ko' : 'en'];
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
function verdictHtml(v, inf, st) {
  if (v.pending) return `<i class="lyr-dot" style="background:var(--muted)"></i><span style="color:var(--muted)">…</span>`;
  const dot = `<i class="lyr-dot" style="background:var(--${v.kind === 'go' ? 'ok' : 'block'})"></i>`;
  if (v.kind === 'go') return `${dot}<span style="color:var(--ok)">${t('go_run', v.run)}</span>`;
  const head = t('nogo') + (v.steep ? ' · ' + t('slope_fail', v.slopeV.toFixed(0)) : '');
  const tail = v.kind === 'wait' ? t('avail_wait', v.wait) : v.kind === 'move' ? t('avail_move_dir', v.move.km.toFixed(1), lang === 'en' ? v.move.dir.toUpperCase() : v.move.dir) : v.kind === 'mast' ? t('avail_mast', 20) : (whyNoFix(inf.col, inf.row, v.d, st.crit, st.mission) || t('noFix', 3, 20, 60));
  return `${dot}<span>${head} → <span style="color:var(--${KIND[v.kind]})">${tail}</span></span>`;
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
      return `<div class="lyr-ck${st.on.mask[m.id] ? '' : ' off'}"><i class="lyr-tg" style="--c:${layerColor(m.id, false)}"></i><span class="lyr-nm" title="${critName(m)}">${shortName(m)}</span><span class="lyr-ckb"><b style="width:${val == null ? 0 : pc(val)}%;background:${fail ? 'var(--block)' : layerColor(m.id, false)}"></b><u style="left:${pc(c)}%"></u></span><span class="n lyr-ckv${fail ? ' fail' : ''}">${val == null ? '–' : val + (wk === 'dark' ? ' h' : ' %')}</span></div>`;
    }
    const val = inf.values[m.id], fail = (!m.optional || st.on.mask[m.id]) && state.threshold[m.id] != null && val != null && (m.direction === '<=' ? val > st.threshold[m.id] : val < st.threshold[m.id]);
    const pc = x => Math.max(0, Math.min(100, 100 * (x - m.min) / (m.max - m.min)));
    return `<div class="lyr-ck${st.on.mask[m.id] ? '' : ' off'}"><i class="lyr-tg" style="--c:${layerColor(m.id, false)}"></i><span class="lyr-nm" title="${critName(m)}">${shortName(m)}</span><span class="lyr-ckb"><b style="width:${val == null ? 0 : pc(val)}%;background:${fail ? 'var(--block)' : layerColor(m.id, false)}"></b><u style="left:${pc(st.threshold[m.id])}%"></u></span><span class="n lyr-ckv${fail ? ' fail' : ''}">${val == null ? '–' : fmt(m, val) + unitOf(m)}</span></div>`;
  }).join('');
  const adv = st.adv ? `<div class="lyr-tbl">${data.layers.map(m => { const val = inf.values[m.id]; return `<span>${layerName(m)}</span><span class="n">${val == null ? '–' : (val === Infinity ? '>' : '') + fmt(m, val) + unitOf(m)}</span>`; }).join('')}<span>${t('lat')}</span><span class="n">${Math.abs(inf.ll.lat).toFixed(2)}°${inf.ll.lat < 0 ? 'S' : 'N'} ${Math.abs(inf.ll.lon).toFixed(1)}°${inf.ll.lon < 0 ? 'W' : 'E'}</span></div>` : '';
  el.innerHTML = `<div class="lyr-pt">${inf.title}</div>
<div class="lyr-dt"><button data-step="-1">◀</button><span class="n">${isoOfDay(st.tDay)}</span><button data-step="1">▶</button></div>
<div class="lyr-vd">${verdictHtml(v, inf, st)}</div>${winRow(inf, st)}
<div class="lyr-fxs">${f('move', t('move'), mv, '', !!fixOf.move)}${f('mast', t('mast'), v.goNow ? t('not_needed') : v.mast ? t('mast_gain', v.mast.gain) : null, v.mast && !v.goNow ? t('mast_title', v.mast.from, v.mast.to) : '', !!fixOf.mast)}${f('wait', t('wait'), v.goNow ? t('days', 0) : v.wait != null && v.wait <= BUDGET.wait ? t('days', v.wait) : null, v.wait != null && v.wait > BUDGET.wait ? t('days', v.wait) : '', fixOf.wait != null)}</div>
<div class="lyr-cks">${checks}</div>${adv}
${zoomSvg(inf, v, data, st.threshold.slope)}
<svg class="lyr-sky"></svg>
${inf.go ? `<div class="lyr-cal"><canvas class="lyr-pcal"></canvas><span class="n lyr-go-n">${t('go')} ${t('days', inf.go.count)}</span></div>` : ''}
${cartBtn(inf, st)}<a class="lyr-link" href="${inf.link}">${t('open_cmp')}</a>`;
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
