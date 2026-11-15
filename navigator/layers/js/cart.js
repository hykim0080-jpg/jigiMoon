// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Shortlist ("Add to compare"): up to four spots in a tray at the bottom; "Compare" opens them side by side in
// Compare sites (#v=compare&pins=x,y;...&s=pin1&cmp=pin2,...), with the chosen date, stay and criteria.
import { state, setState } from './state.js';
import { cellToXY } from './geo.js';
import { describe } from './orient.js';
import { critHash } from './crit.js';

export const MAX = 4;
const TX = {
  en: { add: '+ Add to compare', added: '✓ In compare · remove', full: `Compare holds ${MAX} spots`, cmp: n => `Compare ${n} →`, one: 'Add one more spot to compare', rm: 'Remove' },
  ko: { add: '+ 비교에 담기', added: '✓ 담김 · 빼기', full: `최대 ${MAX}곳까지 담을 수 있어요`, cmp: n => `${n}곳 비교하기 →`, one: '비교하려면 한 곳 더 담으세요', rm: '빼기' },
};
let D, tray, lq = '', tx = TX.en;
export const ct = (k, ...a) => { const v = tx[k]; return typeof v === 'function' ? v(...a) : v; };
export const inCart = (col, row) => state.cart.findIndex(c => c.col === col && c.row === row);
export function toggleCart(col, row) {
  const i = inCart(col, row);
  if (i >= 0) setState({ cart: state.cart.filter((_, k) => k !== i) }, 'panel');
  else if (state.cart.length < MAX) setState({ cart: [...state.cart, { col, row }] }, 'panel');
}
export const cartHash = () => state.cart.map(c => `${c.col},${c.row}`).join(';');
export function readCart(s) {
  return (s || '').split(';').map(p => p.split(',').map(Number)).filter(v => v.length === 2 && v.every(n => Number.isInteger(n) && n >= 0 && n < 800)).slice(0, MAX).map(([col, row]) => ({ col, row }));
}
const titleOf = c => { const { x, y } = cellToXY(c.col, c.row); return describe(x, y, D.landmarks) || `${(x / 1000).toFixed(1)}, ${(y / 1000).toFixed(1)} km`; };
// sel: index of the spot that opens selected (default the first)
export function compareHref(st, cart = st.cart, sel = 0) {
  const pts = cart.map(c => { const { x, y } = cellToXY(c.col, c.row); return `${Math.round(x)},${Math.round(y)}`; });
  const ch = critHash(D.meta, st.crit), ids = pts.map((_, k) => 'pin' + (k + 1)), rest = ids.filter((_, k) => k !== sel);
  return `../index.html${lq ? '?lang=' + lq : ''}#v=compare&s=${ids[sel]}${rest.length ? '&cmp=' + rest.join(',') : ''}&day=${st.tDay}&base=${st.tDay}&m=${st.mission}&pins=${pts.join(';')}${ch ? '&' + ch : ''}`;
}
// "Open in Compare" on a spot card: Side by side with the shortlist plus this spot (selected); a full shortlist gives up its last one
export function compareWith(st, col, row) {
  let i = inCart(col, row), cart = st.cart;
  if (i < 0) { cart = [...cart.slice(0, MAX - 1), { col, row }]; i = cart.length - 1; }
  return compareHref(st, cart, i);
}
export function initCart(app, d, lang, langQ) {
  D = d; tx = TX[lang] || TX.en; lq = langQ || '';
  tray = document.createElement('div'); tray.className = 'lyr-cart'; tray.hidden = true; app.append(tray);
  tray.onclick = e => {
    const x = e.target.closest('[data-rm]'); if (x) { const c = state.cart[+x.dataset.rm]; if (c) toggleCart(c.col, c.row); return; }
    const g = e.target.closest('[data-go]'); if (g) { const c = state.cart[+g.dataset.go]; if (c) setState({ pin: { ...c }, autoPin: false }, 'panel'); }
  };
}
let last = '';
export function renderCart(st) {
  const k = JSON.stringify([st.cart, st.tDay, st.mission, st.crit]); if (k === last) return; last = k;
  tray.hidden = !st.cart.length; tray.parentNode.classList.toggle('has-cart', !!st.cart.length);
  if (!st.cart.length) { tray.innerHTML = ''; return; }
  const n = st.cart.length;
  tray.innerHTML = st.cart.map((c, i) => `<span class="lyr-cit"><button class="lyr-cgo" data-go="${i}" title="${titleOf(c)}"><b class="n">${i + 1}</b><span class="t">${titleOf(c)}</span></button><button class="lyr-crm" data-rm="${i}" aria-label="${ct('rm')}">×</button></span>`).join('')
    + (n < 2 ? `<span class="lyr-cnote">${ct('one')}</span>` : `<a class="lyr-cgo2" href="${compareHref(st)}">${ct('cmp', n)}</a>`);
}
