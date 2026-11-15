// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

export function text(parent, str, attrs) {
  const n = el('text', attrs, parent);
  n.textContent = str;
  return n;
}

export const clear = node => node.replaceChildren();
export const linear = (d0, d1, r0, r1) => v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);

let tip;
export function showTip(str, ev) {
  tip = tip || document.getElementById('tip');
  tip.textContent = str;
  tip.hidden = false;
  const w = tip.offsetWidth;
  tip.style.left = Math.min(ev.clientX + 12, innerWidth - w - 8) + 'px';
  tip.style.top = (ev.clientY + 16) + 'px';
}
export function hideTip() {
  tip = tip || document.getElementById('tip');
  tip.hidden = true;
}

// horizontal bar as an HTML string; frac and tick are 0..1
export function bar({ frac, tick, color = 'var(--muted)', dashed = false }) {
  const f = Math.max(0, Math.min(1, frac)) * 100;
  const tk = tick == null ? '' : `<b style="left:${tick * 100}%"></b>`;
  return `<div class="bar${dashed ? ' dashed' : ''}"><i style="width:${f}%;background:${color}"></i>${tk}</div>`;
}
