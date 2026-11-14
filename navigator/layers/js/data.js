import { unitOf } from './strings.js';
import { N, FAIL_AT_255, DISCRETE, hue } from './config.js';
export const decode = (meta, v) => meta.min + v * (meta.max - meta.min) / 250;
export function fmt(meta, val) {
  if (val === Infinity) { const st = DISCRETE[hue(meta.id)]?.steps; return '>' + (st ? st[st.length - 1][0] : meta.max); }
  if (val == null) return '–';
  const s = (meta.max - meta.min <= 30) ? val.toFixed(1) : String(Math.round(val));
  return s;
}
export const withUnit = (meta, val) => val == null ? '–' : fmt(meta, val) + (meta.unit ? ' ' + meta.unit : '');
export const valueOf = (meta, v) => v === 255 ? (FAIL_AT_255.includes(meta.id) ? Infinity : null) : v > 250 ? null : decode(meta, v);

async function bytes(url, id) {
  const r = await fetch(url);
  if (!r.ok) return null;
  const b = new Uint8Array(await r.arrayBuffer());
  return b.length === N * N ? b : null;
}
export async function loadAll(dataUrl = './data/') {
  const meta = await (await fetch(dataUrl + 'layers.json')).json();
  const res = await Promise.all(meta.layers.map(m => bytes(dataUrl + m.id + '.wasm', m.id)));
  const layers = [], bs = {}, hist = {};
  meta.layers.forEach((m, i) => {
    if (!res[i]) return;
    layers.push(m); bs[m.id] = res[i];
    const h = new Uint32Array(50), a = res[i];
    for (let k = 0; k < a.length; k++) { const v = a[k]; if (v <= 250) h[Math.min(49, (v / 5) | 0)]++; }
    hist[m.id] = h;
  });
  const img = new Image(); img.src = dataUrl + 'hillshade.png'; await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = N;
  const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, N, N);
  const px = cx.getImageData(0, 0, N, N).data, hill = new Uint8Array(N * N);
  for (let i = 0; i < hill.length; i++) hill[i] = px[i * 4];
  const sites = await (await fetch(dataUrl + 'sites.json')).json();
  const [landmarks, landers] = await Promise.all(['landmarks', 'landers'].map(f => fetch(dataUrl + f + '.json').then(r => r.ok ? r.json() : []).catch(() => [])));
  let month = null;
  try { const r = await fetch(dataUrl + 'days14_month.wasm'); if (r.ok) { const b = new Uint8Array(await r.arrayBuffer()); if (b.length === 12 * N * N) month = b; } } catch (e) { /* optional */ }
  const get = async f => { try { const r = await fetch(dataUrl + f); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; } catch (e) { return null; } };
  const [ib, bits, m20] = await Promise.all([get('ok14_idx.wasm'), get('ok14_bits.wasm'), get('days6_m20.wasm')]);
  const ok14 = ib && bits && bits.length === (ib.length / 4) * 46 ? { idx: new Uint32Array(ib.buffer, ib.byteOffset, ib.length / 4), bits } : null;
  return { meta, layers, bytes: bs, hill, sites, hist, landmarks, landers, month, ok14, m20: m20 && m20.length === N * N ? m20 : null };
}
