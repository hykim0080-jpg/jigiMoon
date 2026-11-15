// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { state, setState } from './state.js';
import { t } from './strings.js';
import { el, text, clear, showTip, hideTip } from './svg.js';
import { nextEvent, blockage, horizonAt } from './logic.js';

let uid = 0;
let geom = null;

// Unwrapped horizon panorama for one site and landing day. Used by Focus and Compare.
export function drawSky(svg, S, st, opts = {}) {
  const w = opts.w || svg.clientWidth, h = opts.h || svg.clientHeight;
  if (!w || !h) return null;
  const compact = !!opts.compact, sk = S.sky, lw = opts.lw || 2;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  clear(svg);
  const i0 = st.day * 24, n = st.mission * 24;
  const x0 = compact ? 24 : 30, x1 = w - 6, y0 = compact ? 4 : 16, y1 = h - (compact ? 14 : 18), pw = x1 - x0;

  // elevation range follows the data in the window
  let lo = -2.5, hi = 8;
  for (let j = 0; j <= n; j += 2) {
    const i = i0 + j;
    hi = Math.max(hi, sk.sunEl[i] + 0.5, sk.earthEl[i] + 0.5);
    lo = Math.min(lo, horizonAt(sk, sk.sunAz[i]) - 0.5, horizonAt(sk, sk.earthAz[i]) - 0.5);
  }
  for (const v of sk.horizon) lo = Math.min(lo, v - 0.5);  // whole silhouette stays in view
  lo = Math.max(-8, Math.floor(lo)); hi = Math.min(14, Math.ceil(hi));
  const X = az => x0 + ((((az - sk.center + 540) % 360) + 360) % 360 - 180 + 180) / 360 * pw;
  const Y = el_ => y1 - (el_ - lo) / (hi - lo) * (y1 - y0);

  const clipId = 'clip' + (uid++);
  const defs = el('defs', {}, svg);
  el('rect', { x: x0, y: y0, width: pw, height: y1 - y0 }, el('clipPath', { id: clipId }, defs));
  const blur = el('filter', { id: 'blur' + clipId, x: '-100%', y: '-100%', width: '300%', height: '300%' }, defs);
  el('feGaussianBlur', { stdDeviation: 3 }, blur);
  const root = el('g', { 'clip-path': `url(#${clipId})` }, svg);

  // grid
  const grid = el('g', { stroke: 'var(--line)', 'stroke-width': 1 }, svg);
  for (let a = 0; a < 360; a += 30) {
    const az = sk.center - 180 + a, xx = X(az);
    el('line', { x1: xx, x2: xx, y1: y0, y2: y1 }, grid);
  }
  for (let v = Math.ceil(lo / 2) * 2; v <= hi; v += 2) {
    el('line', { x1: x0, x2: x1, y1: Y(v), y2: Y(v), stroke: v === 0 ? 'var(--muted)' : 'var(--line)', 'stroke-opacity': v === 0 ? .7 : 1 }, svg);
    if (v % 4 === 0) text(svg, `${v}°`, { x: x0 - 4, y: Y(v) + 3, 'text-anchor': 'end', class: 'tick' });
  }
  for (const [name, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
    const xx = X(az);
    if (xx > x0 + 6 && xx < x1 - 6) text(svg, name, { x: xx, y: h - 4, 'text-anchor': 'middle', class: 'tick' });
  }
  // the map's directions on the same axis: Earth (map up), right, away, left
  const lon = opts.lon;
  if (lon != null && !compact) {
    t('sides').forEach((word, k) => {
      const xx = X(((k * 90 - lon) % 360 + 360) % 360);
      if (xx < x0 + 20 || xx > x1 - 20) return;
      el('line', { x1: xx, x2: xx, y1: y0, y2: y1, stroke: k === 0 ? 'var(--earth)' : 'var(--muted)', 'stroke-opacity': .35, 'stroke-dasharray': '2 4' }, svg);
      const a = { x: xx + 3, y: y0 + 10, 'text-anchor': 'start', class: 'tick' };
      if (k === 0) a.fill = 'var(--earth)';
      text(svg, word, a);
    });
  }

  // bodies at the scrubbed hour sit under the terrain so the ridge bites into them
  const ih = i0 + st.hour;
  el('circle', { cx: X(sk.sunAz[ih]), cy: Y(sk.sunEl[ih]), r: compact ? 6 : 7, fill: 'var(--sun)', filter: `url(#blur${clipId})` }, root);
  el('circle', { cx: X(sk.sunAz[ih]), cy: Y(sk.sunEl[ih]), r: compact ? 5 : 6, fill: 'var(--sun)' }, root);
  el('circle', { cx: X(sk.earthAz[ih]), cy: Y(sk.earthEl[ih]), r: compact ? 6 : 7, fill: 'var(--earth)' }, root);

  // terrain, starting at the left edge of the panorama
  const s0 = ((Math.ceil((sk.center - 180) / sk.azStep) % 720) + 720) % 720;
  const hp = [];
  for (let k = 0; k < sk.horizon.length; k++) {
    const idx = (s0 + k) % sk.horizon.length;
    hp.push([x0 + k / sk.horizon.length * pw, Y(sk.horizon[idx])]);
  }
  const line = hp.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
  el('path', { d: `M${x0},${y1}L${line}L${x1},${y1}Z`, fill: 'var(--terrain)' }, root);
  el('path', { d: `M${line}`, fill: 'none', stroke: 'var(--terrain-edge)', 'stroke-width': 1.5 }, root);

  const series = [
    { key: 'sun', az: sk.sunAz, el: sk.sunEl, vis: i => sk.sunFrac[i] > 0, color: 'var(--sun)', hidden: i => sk.sunFrac[i] < 0.5 },
    { key: 'earth', az: sk.earthAz, el: sk.earthEl, vis: i => sk.earthVis[i] === 1, color: 'var(--earth)', hidden: i => !sk.earthVis[i] }
  ];
  const points = s => {
    const out = [];
    for (let j = 0; j <= n; j++) {
      const i = i0 + j;
      out.push({ j, i, x: X(s.az[i]), y: Y(s.el[i]), v: s.vis(i) });
    }
    return out;
  };

  // why layer: ridge between the track and the horizon wherever the body is blocked
  for (const s of series) {
    const pts = points(s);
    let run = [];
    const flush = () => {
      if (run.length) {
        const up = run.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
        const dn = run.slice().reverse().map(p => `${p.x.toFixed(1)},${Y(horizonAt(sk, s.az[p.i])).toFixed(1)}`);
        const d = `M${up.join('L')}L${dn.join('L')}Z`;
        el('path', { d, fill: 'var(--block)', 'fill-opacity': .55, stroke: 'var(--block)', 'stroke-opacity': .55, 'data-hour': run[0].j, style: 'cursor:pointer' }, root);
      }
      run = [];
    };
    for (const p of pts) {
      const blocked = s.hidden(p.i) && s.el[p.i] < horizonAt(sk, s.az[p.i]);
      const prev = run[run.length - 1];
      if (blocked && (!prev || Math.abs(p.x - prev.x) < pw / 2)) run.push(p);
      else { flush(); if (blocked) run.push(p); }
    }
    flush();
  }

  // tracks: solid while visible, dashed while hidden
  for (const s of series) {
    const pts = points(s), runs = [];
    let cur = null;
    for (const p of pts) {
      const prev = cur && cur.pts[cur.pts.length - 1];
      if (!cur || Math.abs(p.x - prev.x) > pw / 2) { cur = { v: p.v, pts: [p] }; runs.push(cur); }
      else if (p.v !== cur.v) { cur = { v: p.v, pts: [prev, p] }; runs.push(cur); }
      else cur.pts.push(p);
    }
    for (const r of runs) {
      el('path', {
        d: 'M' + r.pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join('L'), fill: 'none', stroke: s.color, 'stroke-width': lw,
        ...(r.v ? {} : { 'stroke-dasharray': '4 3', 'stroke-opacity': .4 })
      }, root);
    }
    if (!compact && s.key === 'sun') {
      for (const p of pts) {
        if (p.j % 24) continue;
        el('circle', { cx: p.x, cy: p.y, r: 2, fill: s.color }, root);
        if (p.j / 24 % 2 === 0) text(root, p.j / 24, { x: p.x, y: p.y - 7, 'text-anchor': 'middle', class: 'tick' });
      }
    }
  }

  // scrubbed hour: show what blocks each hidden body
  const b = blockage(sk, ih);
  for (const k of ['sun', 'earth']) {
    const bb = b[k];
    if (!bb) continue;
    const bx = X(bb.az), top = Y(bb.h), by = Y(bb.el);
    const edge = hp.filter(p => Math.abs(p[0] - bx) < 3 / 360 * pw).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1));
    if (edge.length > 1) el('path', { d: 'M' + edge.join('L'), fill: 'none', stroke: 'var(--block)', 'stroke-width': lw + 1 }, root);
    el('line', { x1: bx, x2: bx, y1: by, y2: top, stroke: 'var(--block)', 'stroke-width': 1 }, root);
  }

  geom = { x0, x1, y0, y1, X, Y, hi, lo, sk, pw };
  if (!compact) {
    const hv = el('g', { 'pointer-events': 'none', visibility: 'hidden', id: 'sky-hover' }, svg);
    el('line', { y1: y0, y2: y1, stroke: 'var(--ink)', 'stroke-opacity': .5 }, hv);
    text(hv, '', { y: y0 + 10, class: 'lbl' });
  }
  return geom;
}

const countdown = (vis, i, rises, sets, color) => {
  const ev = nextEvent(vis, i);
  const v = ev ? (ev.hours > 99 ? t('d', Math.round(ev.hours / 24)) : t('h', ev.hours)) : t('over');
  const label = vis[i] ? sets(v) : rises(v);
  return `<span style="--c:${color}">${label}</span>`;
};

let svg, cd;
export function init(node, countNode) {
  svg = node; cd = countNode;
  svg.addEventListener('pointermove', e => {
    if (!geom) return;
    const r = svg.getBoundingClientRect(), x = e.clientX - r.left;
    const hv = svg.querySelector('#sky-hover');
    if (!hv || x < geom.x0 || x > geom.x1) { if (hv) hv.setAttribute('visibility', 'hidden'); return; }
    const az = ((x - geom.x0) / geom.pw * 360 + geom.sk.center - 180 + 360) % 360;
    const hz = horizonAt(geom.sk, az);
    hv.setAttribute('visibility', 'visible');
    const line = hv.firstChild, label = hv.lastChild;
    line.setAttribute('x1', x); line.setAttribute('x2', x);
    label.textContent = t('readout', Math.round(az), (hz >= 0 ? '+' : '') + hz.toFixed(1));
    const end = x > geom.x1 - 170;
    label.setAttribute('x', end ? x - 6 : x + 6);
    label.setAttribute('text-anchor', end ? 'end' : 'start');
  });
  svg.addEventListener('pointerleave', () => svg.querySelector('#sky-hover')?.setAttribute('visibility', 'hidden'));
  svg.addEventListener('click', e => {
    const hr = e.target.dataset?.hour;
    if (hr != null) setState({ hour: Number(hr), playing: false });
  });
}

export function render(st, data) {
  const S = data.site;
  if (!S) return;
  drawSky(svg, S, st, { lon: data.index?.byId[st.site]?.lon });
  const i = st.day * 24 + st.hour, sk = S.sky;
  cd.innerHTML = countdown(sk.sunVis, i, v => t('sunRises', v), v => t('sunSets', v), 'var(--sun)')
    + countdown(sk.earthVis, i, v => t('earthRises', v), v => t('earthSets', v), 'var(--earth)');
}
