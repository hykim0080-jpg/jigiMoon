import { state, setState } from './state.js';
import { rampCss, layerColor } from './ramps.js';
import { fmt, withUnit } from './data.js';
import { t, layerName, unitOf } from './strings.js';
import { critIds } from './compose.js';

let el, data, rows = {}, segEl, scoreBar, rowsEl, noneCol = '#888';
const MODES = ['layers', 'mask', 'score'];
const byId = id => data.layers.find(m => m.id === id);
const stepOf = m => (m.max - m.min) / 250;
const isCrit = m => m.threshold != null;

export function initPanel(root, d) {
  el = root; data = d;
  el.innerHTML = `<div class="lyr-head"><h2>${t('layers')}</h2><div class="seg">${MODES.map(m => `<button data-m="${m}" aria-pressed="false">${t('m_' + m)}</button>`).join('')}</div></div><div class="lyr-score"></div><div class="lyr-rows"></div>`;
  segEl = el.querySelector('.seg'); scoreBar = el.querySelector('.lyr-score'); rowsEl = el.querySelector('.lyr-rows');
  noneCol = getComputedStyle(el).getPropertyValue('--none').trim() || noneCol;
  segEl.onclick = e => { const b = e.target.closest('button'); if (b) setState({ mode: b.dataset.m }, 'pixels'); };
  for (const m of data.layers) rowsEl.append(buildRow(m));
  rowsEl.addEventListener('dragover', e => { if (drag) e.preventDefault(); });
  rowsEl.addEventListener('drop', e => {
    if (!drag) return; e.preventDefault();
    const tr = e.target.closest('.lyr-row'); if (!tr || tr.dataset.id === drag) return;
    const o = state.order.filter(i => i !== drag), idx = o.indexOf(tr.dataset.id), before = state.order.indexOf(drag) > state.order.indexOf(tr.dataset.id);
    o.splice(before ? idx : idx + 1, 0, drag); setState({ order: o }, 'pixels');
  });
}
let drag = null;
function buildRow(m) {
  const r = document.createElement('div'); r.className = 'lyr-row'; r.dataset.id = m.id; r.tabIndex = 0;
  const c = layerColor(m.id, false);
  r.innerHTML = `<div class="lyr-l1"><span class="lyr-grip">⋮</span><button class="lyr-tg" aria-pressed="false" style="--c:${c}"></button><span class="lyr-nm">${layerName(m)}</span><span class="lyr-rd n"></span></div>
<div class="lyr-viz"><canvas class="lyr-hist"></canvas><div class="lyr-ramp" style="background:${rampCss(m)}"><div class="lyr-cover"></div></div>${isCrit(m) ? '<div class="lyr-hd" role="slider" tabindex="0"></div>' : ''}<i class="lyr-tick"></i></div>
<div class="lyr-l4 n"><span>${fmt(m, m.min)}</span><span class="lyr-th"></span><span>${fmt(m, m.max)}</span></div>
<div class="lyr-l5"><input type="range" style="accent-color:${c}"><span class="n"></span></div>`;
  const q = s => r.querySelector(s);
  const o = rows[m.id] = { r, tg: q('.lyr-tg'), rd: q('.lyr-rd'), hist: q('.lyr-hist'), ramp: q('.lyr-ramp'), cover: q('.lyr-cover'), hd: q('.lyr-hd'), tick: q('.lyr-tick'), th: q('.lyr-th'), inp: q('input'), num: q('.lyr-l5 .n') };
  o.tg.onclick = () => {
    if (state.mode === 'score') {
      const w = state.weight[m.id] > 0 ? 0 : (state.lastWeight[m.id] || 1);
      setState({ weight: { ...state.weight, [m.id]: w }, lastWeight: { ...state.lastWeight, [m.id]: state.weight[m.id] || state.lastWeight[m.id] } });
    } else if (state.mode === 'mask' ? isCrit(m) : true) setState({ on: { ...state.on, [state.mode]: { ...state.on[state.mode], [m.id]: !state.on[state.mode][m.id] } } });
  };
  o.inp.oninput = () => {
    const v = +o.inp.value;
    if (state.mode === 'layers') setState({ opacity: { ...state.opacity, [m.id]: v / 100 } });
    else if (state.mode === 'score') setState({ weight: { ...state.weight, [m.id]: v }, lastWeight: { ...state.lastWeight, [m.id]: v || state.lastWeight[m.id] } });
  };
  if (o.hd) {
    const setT = x => {
      const f = Math.max(0, Math.min(1, x)), v = Math.round(f * 250), val = m.min + v * stepOf(m);
      if (val !== state.threshold[m.id]) setState({ threshold: { ...state.threshold, [m.id]: val } });
    };
    const fromEv = e => { const b = o.ramp.getBoundingClientRect(); return (e.clientX - b.left) / b.width; };
    const down = e => { e.preventDefault(); o.ramp.setPointerCapture(e.pointerId); setT(fromEv(e)); o.ramp.onpointermove = ev => setT(fromEv(ev)); };
    o.ramp.onpointerdown = o.hd.onpointerdown = down;
    o.ramp.onpointerup = () => { o.ramp.onpointermove = null; };
    o.r.querySelector('.lyr-viz').ondblclick = () => setState({ threshold: { ...state.threshold, [m.id]: m.threshold } });
    o.hd.onkeydown = e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault();
      const v = Math.max(0, Math.min(250, Math.round((state.threshold[m.id] - m.min) / stepOf(m)) + d));
      setState({ threshold: { ...state.threshold, [m.id]: m.min + v * stepOf(m) } });
    };
  }
  const grip = q('.lyr-grip');
  grip.onpointerdown = () => { r.draggable = true; };
  r.ondragstart = e => { drag = m.id; e.dataTransfer.setData('text/plain', m.id); e.dataTransfer.effectAllowed = 'move'; };
  r.ondragend = () => { drag = null; r.draggable = false; };
  r.onkeydown = e => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return; e.preventDefault();
    const o2 = [...state.order], i = o2.indexOf(m.id), j = i + (e.key === 'ArrowUp' ? -1 : 1);
    if (j < 0 || j >= o2.length) return; [o2[i], o2[j]] = [o2[j], o2[i]]; setState({ order: o2 });
    requestAnimationFrame(() => rows[m.id].r.focus());
  };
  return r;
}
const pct = (m, v) => 100 * (v - m.min) / (m.max - m.min);
function drawHist(m, o) {
  const cv = o.hist, w = cv.clientWidth || 296, h = cv.clientHeight || 14, g = cv.getContext('2d');
  if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h;
  g.clearRect(0, 0, w, h);
  const H = data.hist[m.id]; let mx = 1; for (const c of H) mx = Math.max(mx, c);
  const col = layerColor(m.id, false), thr = state.threshold[m.id], bw = w / 50;
  for (let b = 0; b < 50; b++) {
    const bh = Math.round(h * Math.sqrt(H[b] / mx)); if (!bh) continue;
    const val = m.min + (b * 5 + 2.5) * stepOf(m);
    const pass = !isCrit(m) || (m.direction === '<=' ? val <= thr : val >= thr);
    g.fillStyle = pass ? col : noneCol; g.fillRect(b * bw, h - bh, Math.max(1, bw - 1), bh);
  }
}
export function renderPanel(st) {
  const mode = st.mode;
  segEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === mode));
  el.dataset.mode = mode;
  const ordered = st.order.map(id => rows[id]).filter(Boolean);
  ordered.forEach((o, i) => { if (rowsEl.children[i] !== o.r) rowsEl.insertBefore(o.r, rowsEl.children[i] || null); });
  rowsEl.classList.toggle('compact', data.layers.length > 8);
  let W = 0; for (const m of data.layers) W += st.weight[m.id] > 0 ? st.weight[m.id] : 0;
  scoreBar.hidden = mode !== 'score';
  if (mode === 'score') scoreBar.innerHTML = st.order.filter(id => st.weight[id] > 0).map(id => `<i style="flex:${st.weight[id]};background:${layerColor(id, false)}"></i>`).join('');
  for (const m of data.layers) {
    const o = rows[m.id], active = mode === 'mask' ? isCrit(m) : true;
    const on = mode === 'score' ? st.weight[m.id] > 0 : !!st.on[mode][m.id];
    o.r.classList.toggle('off', !on || !active); o.r.classList.toggle('disabled', !active);
    o.tg.setAttribute('aria-pressed', on && active); o.tg.disabled = !active;
    o.r.classList.toggle('nol5', mode === 'mask');
    const thr = st.threshold[m.id];
    if (o.hd) {
      const p = pct(m, thr), ge = m.direction !== '<=';
      o.hd.style.left = p + '%'; o.hd.setAttribute('aria-valuenow', thr);
      o.cover.style.cssText = ge ? `left:0;width:${p}%` : `left:${p}%;right:0`;
      o.th.textContent = (ge ? '≥' : '≤') + fmt(m, thr); o.th.style.left = Math.max(12, Math.min(88, p)) + '%';
    } else { o.cover.style.cssText = 'display:none'; o.th.textContent = ''; }
    if (mode === 'layers') { o.inp.min = 0; o.inp.max = 100; o.inp.step = 1; o.inp.value = Math.round((st.opacity[m.id] ?? .85) * 100); o.num.textContent = o.inp.value + ' %'; }
    else if (mode === 'score') { o.inp.min = 0; o.inp.max = 10; o.inp.step = 1; o.inp.value = st.weight[m.id]; o.num.textContent = (W ? Math.round(100 * st.weight[m.id] / W) : 0) + ' %'; }
    drawHist(m, o);
  }
}
export function renderReadout(sm, st) {
  for (const m of data.layers) {
    const o = rows[m.id];
    if (!sm) { o.rd.textContent = ''; o.tick.style.display = 'none'; o.rd.classList.remove('fail'); continue; }
    const v = sm.values[m.id];
    o.rd.textContent = v === Infinity ? fmt(m, Infinity) + '\u2009' + unitOf(m) : withUnit(m, v);
    o.rd.classList.toggle('fail', sm.pass[m.id] === false);
    if (v == null) o.tick.style.display = 'none';
    else { o.tick.style.display = 'block'; o.tick.style.left = Math.max(0, Math.min(100, pct(m, v === Infinity ? m.max : v))) + '%'; }
  }
}
