// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { state, setState, limitsOf, setHover } from './state.js';
import { t, siteName, lang } from './strings.js';
import { status, fixText, shortDate } from './logic.js';
import { calOf } from './data.js';
import { showTip, hideTip } from './svg.js';

let GUT_L = 150, GUT_R = 80, narrow = false;   // gutters shrink when the calendar sits in the narrow left column
const AXIS = 18;
let ROW = 16, CELL_H = 14;
let canvas, ctx, overlay, data, order = [], dragging = false;
let sel, bracket, hoverLine, baseMark;
// cut a name with an ellipsis instead of squeezing it
const fitText = (s, w) => { if (ctx.measureText(s).width <= w) return s; while (s.length > 2 && ctx.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; };
const geom = () => ({ w: canvas.clientWidth, cw: (canvas.clientWidth - GUT_L - GUT_R) / 365 });

export function init(panel, d) {
  data = d;
  canvas = panel.querySelector('canvas');
  overlay = panel.querySelector('#cal-overlay');
  ctx = canvas.getContext('2d');
  const mk = cls => { const n = document.createElement('div'); n.className = cls; overlay.appendChild(n); return n; };
  sel = mk('sel'); bracket = mk('bracket'); hoverLine = mk('hover'); baseMark = mk('base');
  Object.assign(sel.style, { width: '1px', background: 'var(--ink)', top: AXIS + 'px', height: 12 * ROW + 'px' });
  Object.assign(hoverLine.style, { width: '1px', background: 'var(--muted)', top: AXIS + 'px', height: 12 * ROW + 'px', display: 'none' });
  Object.assign(bracket.style, { height: '2px', background: 'var(--ink)' });
  Object.assign(baseMark.style, { fontSize: '10px', fontWeight: '600', color: 'var(--ink)', top: '0px', lineHeight: '18px', transform: 'translateX(-5px)', whiteSpace: 'nowrap' });

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', () => { hoverLine.style.display = 'none'; hideTip(); setHover(null); });
  addEventListener('pointerup', () => { dragging = false; });
  new ResizeObserver(() => render(state, data)).observe(canvas);
  // the year calendar can open large, as a pop-up over the page (button, Esc or a click outside closes it)
  const big = panel.querySelector('#cal-big'), back = document.getElementById('cal-back');
  const setBig = on => { panel.classList.toggle('big', on); if (back) back.hidden = !on; big.textContent = on ? '×' : '⤢'; big.title = big.ariaLabel = on ? t('calClose') : t('calOpen'); };
  setBig(false);
  big.onclick = e => { e.stopPropagation(); setBig(!panel.classList.contains('big')); };
  if (back) back.onclick = () => setBig(false);
  addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('big')) { setBig(false); e.stopImmediatePropagation(); } });
}

function hit(e) {
  const r = canvas.getBoundingClientRect(), { cw } = geom();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const day = Math.max(0, Math.min(364, Math.floor((x - GUT_L) / cw)));
  const row = Math.floor((y - AXIS) / ROW);
  return { x, y, day, row: row >= 0 && row < order.length ? row : -1 };
}

function onDown(e) {
  const h = hit(e);
  if (h.row < 0 && h.y < AXIS && h.x >= GUT_L) { setState({ baseline: h.day }); return; }
  if (h.row < 0) return;
  const id = order[h.row];
  if (e.shiftKey || h.x < 14) { togglePin(id); return; }
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  setState({ site: id, day: h.x < GUT_L ? state.day : h.day });
}

function onMove(e) {
  const h = hit(e);
  if (dragging) setState({ day: h.day });
  const { cw } = geom();
  setHover(h.row < 0 ? null : order[h.row]);
  const onAxis = h.row < 0 && h.y < AXIS && h.x >= GUT_L;
  canvas.style.cursor = onAxis ? 'pointer' : '';
  if (onAxis) { hoverLine.style.display = 'none'; showTip(`${t('planAxisTip')} · ${shortDate(h.day)}`, e); return; }
  if (h.row < 0 || h.x < GUT_L) { hoverLine.style.display = 'none'; hideTip(); return; }
  hoverLine.style.display = 'block';
  hoverLine.style.left = (GUT_L + (h.day + 0.5) * cw) + 'px';
  showTip(tooltip(order[h.row], h.day), e);
}

export function togglePin(id) {
  const p = state.pinned.includes(id) ? state.pinned.filter(x => x !== id) : [...state.pinned, id].slice(-2);
  setState({ pinned: p });
}

function tooltip(id, day) {
  const s = data.index.byId[id], e = data.index.modes[state.mission].sites[id];
  const st = status(e, day, state.mast, limitsOf(state)), c = calOf(id, state.mission);
  const parts = [siteName(s), shortDate(day)];
  if (c) parts.push(`${t('sun')} ${t('pct', Math.round(c.sun[day]))}`, `${t('earth')} ${t('pct', Math.round(c.earth[day]))}`);
  parts.push(st.kind === 'ok' ? t('go') : st.kind === 'none' ? t('nogo') : fixText(st));
  return parts.join(' · ');
}

// 6 px tile with a 2 px diagonal stripe, drawn in the page surface colour over the fix colour
function stripes(c) {
  const dpr = devicePixelRatio || 1, n = Math.round(6 * dpr), tile = document.createElement('canvas');
  tile.width = tile.height = n;
  const g = tile.getContext('2d');
  g.strokeStyle = c; g.globalAlpha = 0.6; g.lineWidth = 2 * dpr;
  g.beginPath();
  for (const o of [-n, 0, n]) { g.moveTo(o, n); g.lineTo(o + n, 0); }
  g.stroke();
  const p = ctx.createPattern(tile, 'repeat');
  p.setTransform(new DOMMatrix([1 / dpr, 0, 0, 1 / dpr, 0, 0]));
  return p;
}

const css = (n) => getComputedStyle(canvas).getPropertyValue(n).trim();

export function render(st, d) {
  data = d;
  const dpr = devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W) return;
  narrow = W < 640; GUT_L = narrow ? 104 : 150; GUT_R = narrow ? 30 : 80;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { cw } = geom();
  const mode = data.index.modes[st.mission].sites, lim = limitsOf(st);
  ROW = Math.min(canvas.parentNode.classList.contains('big') ? 44 : 16, Math.floor((H - AXIS - 2) / data.index.sites.length)); CELL_H = ROW - 2;
  sel.style.height = hoverLine.style.height = data.index.sites.length * ROW + 'px';
  const col = { ok: css('--ok'), move: css('--move'), mast: css('--mast'), wait: css('--wait'), none: css('--none') };
  const ink = css('--ink'), muted = css('--muted'), line = css('--line');
  // colour-blind safe: only GO is a solid fill; NO-GO days that a fix rescues get diagonal stripes
  // (one canvas pattern, so the stripes run on across neighbouring days), days with no fix stay flat grey
  const hatch = stripes(css('--surface'));

  // rows: sites sorted by baseline OK days, best on top
  order = data.index.sites.map(s => s.id).sort((a, b) => /^pin/.test(b) - /^pin/.test(a) || mode[b].summary.ok_days - mode[a].summary.ok_days);

  ctx.clearRect(0, 0, W, H);
  ctx.font = '12px Roboto, "Apple SD Gothic Neo", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  order.forEach((id, r) => {
    const y = AXIS + r * ROW, e = mode[id];
    ctx.globalAlpha = st.mode === 'site' && id !== st.site ? 0.3 : 1;
    let ok = 0;
    for (let d = 0; d < 365; d++) {
      const s = status(e, d, st.mast, lim);
      ctx.fillStyle = col[s.kind];
      ctx.fillRect(GUT_L + d * cw, y, Math.ceil(cw), CELL_H);
      if (s.kind !== 'ok' && s.kind !== 'none') { ctx.fillStyle = hatch; ctx.fillRect(GUT_L + d * cw, y, Math.ceil(cw), CELL_H); }
      if (s.kind === 'ok') { ok++; if (s.capped) { ctx.fillStyle = col.mast; ctx.fillRect(GUT_L + d * cw, y, Math.ceil(cw), 3); } }
    }
    const selected = id === st.site;
    ctx.fillStyle = selected ? ink : muted;
    ctx.font = `${selected ? 600 : 400} ${narrow ? 11 : 12}px Roboto, "Apple SD Gothic Neo", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    const pinned = st.pinned.includes(id);
    if (data.index.byId[id]?.isPin) { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(5, y + CELL_H / 2 - 2, 3, Math.PI, 0); ctx.lineTo(5, y + CELL_H / 2 + 4); ctx.closePath(); ctx.fill(); ctx.fillStyle = selected ? ink : muted; }   // a saved spot: the pin glyph
    else if (pinned) { ctx.fillStyle = ink; ctx.fillRect(2, y + 5, 4, 4); ctx.fillStyle = selected ? ink : muted; }
    ctx.fillText(fitText(siteName(data.index.byId[id]), GUT_L - 16), 12, y + CELL_H / 2);
    // right gutter: bar + number
    const pct = Math.round(ok / 365 * 100), bx = W - GUT_R + 8;
    if (!narrow) { ctx.fillStyle = line; ctx.fillRect(bx, y + 5, 44, 4); ctx.fillStyle = col.ok; ctx.fillRect(bx, y + 5, 44 * ok / 365, 4); }
    ctx.fillStyle = selected ? ink : muted; ctx.textAlign = 'right';
    ctx.font = '11px Roboto, system-ui, sans-serif';
    ctx.fillText(String(pct), W - 6, y + CELL_H / 2);
  });

  ctx.globalAlpha = 1;
  // month axis
  ctx.font = '10px Roboto, system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.fillStyle = muted;
  const months = t('months');
  for (let m = 0; m < 12; m++) {
    const day = Math.round((Date.UTC(2027, m, 1) - Date.UTC(2027, 0, 1)) / 864e5);
    const x = GUT_L + day * cw;
    ctx.fillStyle = line; ctx.fillRect(Math.floor(x), AXIS - 4, 1, 4 + order.length * ROW);
    ctx.fillStyle = muted;
    ctx.fillText(lang === 'ko' ? String(m + 1) : months[m].slice(0, 1), x + 3, 8);
  }
  ctx.textAlign = 'right';
  ctx.fillText(t('okPct'), W - 6, 8);
  // colour key in the empty corner above the site names: GO and no-fix; the fix colours match the fix card titles
  let key = document.getElementById('cal-key');
  if (!key) { key = document.createElement('div'); key.id = 'cal-key'; canvas.parentNode.appendChild(key); }
  const keyHtml = `<span><i style="background:var(--ok)"></i>${t('legendGo')}</span><span><i class="hatch" style="background-color:var(--wait)"></i>${lang === 'ko' ? '해결 가능' : 'fixable'}</span><span><i style="background:var(--none)"></i>${t('legendNone')}</span>`;
  if (key.innerHTML !== keyHtml) key.innerHTML = keyHtml;

  // overlay: selection line, bracket on selected row, baseline marker
  const x = GUT_L + (st.day + 0.5) * cw, r = order.indexOf(st.site);
  sel.style.left = Math.round(x) + 'px';
  const span = st.mission * cw;
  bracket.style.left = (GUT_L + st.day * cw) + 'px';
  bracket.style.width = Math.min(span, 365 * cw - st.day * cw) + 'px';
  bracket.style.top = (AXIS + r * ROW - 3) + 'px';
  baseMark.style.left = (GUT_L + (st.baseline + 0.5) * cw) + 'px';
  baseMark.textContent = '▼ ' + t('planMark');
}

export const rowOrder = () => order;
