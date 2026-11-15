// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { state, setState } from './state.js';
import { t } from './strings.js';
import { el, text, clear } from './svg.js';
import { longestRun } from './logic.js';
import { THRESHOLDS } from './config.js';

const ROW_H = 12;

// sun and Earth strips (+ optional longest-gap brackets) into group g
export function drawStrips(g, sk, st, { x0, x1, y, brackets }) {
  const n = st.mission * 24, i0 = st.day * 24, cw = (x1 - x0) / n;
  const X = j => x0 + j * cw;
  const sunY = y, earthY = y + ROW_H + (brackets ? 14 : 3);
  for (let j = 0; j < n; j++) {
    const f = sk.sunFrac[i0 + j];
    if (f > 0) el('rect', { x: X(j), y: sunY, width: cw + .3, height: ROW_H, fill: 'var(--sun)', 'fill-opacity': f }, g);
    if (sk.earthVis[i0 + j]) el('rect', { x: X(j), y: earthY, width: cw + .3, height: ROW_H, fill: 'var(--earth)' }, g);
  }
  el('rect', { x: x0, y: sunY, width: x1 - x0, height: ROW_H, fill: 'none', stroke: 'var(--line)' }, g);
  el('rect', { x: x0, y: earthY, width: x1 - x0, height: ROW_H, fill: 'none', stroke: 'var(--line)' }, g);
  if (brackets) {
    const gap = (pred, rowY, limit, tip) => {
      const r = longestRun(pred, i0, n - 1);
      if (!r.len) return;
      const bx0 = X(r.start), bx1 = X(r.start + r.len), by = rowY + ROW_H + 4, c = limit && r.len > limit ? 'var(--block)' : 'var(--muted)';
      el('path', { d: `M${bx0},${by - 3}V${by}H${bx1}V${by - 3}`, fill: 'none', stroke: c }, g);
      const lab = text(g, (tip ? '⟷ ' : '') + t('h', r.len), { x: (bx0 + bx1) / 2, y: by + 10, 'text-anchor': 'middle', class: 'tick', style: `fill:${c}` });
      if (tip) { const ti = document.createElementNS('http://www.w3.org/2000/svg', 'title'); ti.textContent = tip; lab.appendChild(ti); el('path', { d: `M${bx0},${by - 3}V${by}H${bx1}V${by - 3}`, fill: 'none', stroke: 'transparent', 'stroke-width': 10 }, g).appendChild(ti.cloneNode(true)); }
    };
    gap(i => sk.sunFrac[i] === 0, sunY, (st.crit && st.crit.dark) || THRESHOLDS.dark, t('darkTip'));
    gap(i => !sk.earthVis[i], earthY, 0);
  }
  return { sunY, earthY };
}

let svg, staticKey = '', scrub, handle, playBtn, dragging = false, timer = null, W = 0;

export function init(node) {
  svg = node;
  svg.addEventListener('pointerdown', e => {
    const r = svg.getBoundingClientRect(), x = e.clientX - r.left;
    if (x < 30) { setState({ playing: !state.playing }); return; }
    dragging = true; svg.setPointerCapture(e.pointerId); seek(e);
  });
  svg.addEventListener('pointermove', e => { if (dragging) seek(e); });
  addEventListener('pointerup', () => { dragging = false; });
}

function seek(e) {
  const r = svg.getBoundingClientRect(), x0 = 40, x1 = r.width - 10;
  const hour = (e.clientX - r.left - x0) / (x1 - x0) * state.mission * 24;
  setState({ hour, playing: false });
}

function playLoop() {
  clearInterval(timer); timer = null;
  if (!state.playing) return;
  timer = setInterval(() => {
    const total = state.mission * 24;
    setState({ hour: state.hour + Math.max(1, Math.round(total / 120)) > total ? 0 : state.hour + Math.max(1, Math.round(total / 120)) });
  }, 50);
}

export function render(st, data) {
  const S = data.site;
  if (!S) return;
  const w = svg.clientWidth, h = 90, n = st.mission * 24, x0 = 40, x1 = w - 10;
  const key = [st.site, st.day, st.mission, w].join();
  if (key !== staticKey || !scrub) {
    staticKey = key;
    clear(svg);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const g = el('g', {}, svg);
    drawStrips(g, S.sky, st, { x0, x1, y: 6, brackets: true });
    // day axis
    const step = st.mission > 7 ? 2 : 1;
    for (let d = 0; d <= st.mission; d += step) {
      const x = x0 + d / st.mission * (x1 - x0);
      el('line', { x1: x, x2: x, y1: 62, y2: 66, stroke: 'var(--muted)' }, g);
      text(g, d, { x, y: 77, 'text-anchor': 'middle', class: 'tick' });
    }
    playBtn = el('g', { style: 'cursor:pointer' }, svg);
    scrub = el('line', { y1: 2, y2: 66, stroke: 'var(--ink)' }, svg);
    handle = el('rect', { y: 62, width: 10, height: 10, rx: 2, fill: 'var(--ink)' }, svg);
  }
  const x = x0 + st.hour / n * (x1 - x0);
  scrub.setAttribute('x1', x); scrub.setAttribute('x2', x);
  handle.setAttribute('x', x - 5);
  playBtn.innerHTML = '';
  el('rect', { x: 0, y: 0, width: 30, height: 40, fill: 'transparent' }, playBtn);
  el('path', { d: st.playing ? 'M8,10h4v14h-4zM16,10h4v14h-4z' : 'M8,9L20,17L8,25Z', fill: 'var(--ink)' }, playBtn);
  if (playBtn.dataset.p !== String(st.playing)) { playBtn.dataset.p = String(st.playing); playLoop(); }
}
