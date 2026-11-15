// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { unitOf } from './strings.js';
import { N, FAIL_AT_255, DISCRETE, hue } from './config.js';
export const decode = (meta, v) => meta.min + v * (meta.max - meta.min) / 250;
export function fmt(meta, val) {
  if (val === Infinity) { const st = DISCRETE[hue(meta.id)]?.steps; return '>' + (st ? st[st.length - 1][0] : meta.max); }
  if (val == null) return '–';
  const s = (meta.max - meta.min <= 30) ? val.toFixed(1) : String(Math.round(val));
  return s;
}
export const withUnit = (meta, val) => val == null ? '–' : fmt(meta, val) + (meta.unit ? ' ' + unitOf(meta) : '');
export const valueOf = (meta, v) => v === 255 ? (FAIL_AT_255.includes(meta.id) ? Infinity : null) : v > 250 ? null : decode(meta, v);

async function bytes(url, id) {
  const r = await fetch(url);
  if (!r.ok) return null;
  const b = new Uint8Array(await r.arrayBuffer());
  return b.length === N * N ? b : null;
}
// onProg(0..1): share of the files loaded, each weighted by its size in 800 x 800 grids (the month and
// 14-day bit files are about 12 grids each, the JSON files next to nothing)
export async function loadAll(dataUrl = './data/', onProg = null) {
  const meta = await (await fetch(dataUrl + 'layers.json')).json();
  let done = 0; const total = meta.layers.length + 1 + 0.2 + 12 + 12 + 1;
  const tr = (p, w) => p.then(v => { done += w; if (onProg) onProg(Math.min(1, done / total)); return v; });
  const res = await Promise.all(meta.layers.map(m => tr(bytes(dataUrl + m.id + '.wasm', m.id), 1)));
  const layers = [], bs = {}, hist = {};
  meta.layers.forEach((m, i) => {
    if (!res[i]) return;
    layers.push(m); bs[m.id] = res[i];
    const h = new Uint32Array(50), a = res[i];
    for (let k = 0; k < a.length; k++) { const v = a[k]; if (v <= 250) h[Math.min(49, (v / 5) | 0)]++; }
    hist[m.id] = h;
  });
  // water ice (a preference, not a must): distance to the nearest permanently shadowed cell (PSR = where ice may be,
  // not proven). Built here from the psr layer as a layer of its own, so it can also be switched on as a criterion.
  if (bs.psr && !bs.ice) {
    const m = { id: 'ice', name: '얼음 근처 (선택)', unit: 'km', min: 0, max: 25, threshold: 5, direction: '<=', weight: 0, nodata: 255, optional: true };
    bs.ice = iceDistance(bs.psr); layers.push(m); meta.layers.push(m);
    const h = new Uint32Array(50); for (let k = 0; k < bs.ice.length; k++) { const v = bs.ice[k]; if (v <= 250) h[Math.min(49, (v / 5) | 0)]++; } hist.ice = h;
    meta.definitions = { ...(meta.definitions || {}), ice: 'Distance to the nearest permanently shadowed cell (never sunlit in 2027 in our 500 m illumination run, from LOLA). Water ice may be there; it is not proven. A preference: it changes the order of GO spots, and becomes a must only when switched on.' };
  }
  const img = new Image(); img.src = dataUrl + 'hillshade.png'; await tr(img.decode(), 1);
  const c = document.createElement('canvas'); c.width = c.height = N;
  const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, N, N);
  const px = cx.getImageData(0, 0, N, N).data, hill = new Uint8Array(N * N);
  for (let i = 0; i < hill.length; i++) hill[i] = px[i * 4];
  const sites = await tr(fetch(dataUrl + 'sites.json').then(r => r.json()), 0.1);
  const [landmarks, landers] = await tr(Promise.all(['landmarks', 'landers'].map(f => fetch(dataUrl + f + '.json').then(r => r.ok ? r.json() : []).catch(() => []))), 0.1);
  let month = null;
  try { const r = await fetch(dataUrl + 'days14_month.wasm'); if (r.ok) { const b = new Uint8Array(await r.arrayBuffer()); if (b.length === 12 * N * N) month = b; } } catch (e) { /* optional */ }
  done += 12; if (onProg) onProg(Math.min(1, done / total));
  const get = async f => { try { const r = await fetch(dataUrl + f); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; } catch (e) { return null; } };
  const [ib, bits, m20] = await Promise.all([tr(get('ok14_idx.wasm'), 0), tr(get('ok14_bits.wasm'), 12), tr(get('days6_m20.wasm'), 1)]);
  const ok14 = ib && bits && bits.length === (ib.length / 4) * 46 ? { idx: new Uint32Array(ib.buffer, ib.byteOffset, ib.length / 4), bits } : null;
  return { dataUrl, meta, layers, bytes: bs, hill, sites, hist, landmarks, landers, month, ok14, m20: m20 && m20.length === N * N ? m20 : null };
}

// distance (km, 0.1 km steps as bytes 0..250, 255 = farther than 25 km) to the nearest PSR cell; two-pass chamfer on the 500 m grid
export function iceDistance(psr) {
  const n = N, INF = 1e9, d = new Float32Array(n * n), a = 0.5, b = 0.5 * Math.SQRT2;
  for (let i = 0; i < d.length; i++) d[i] = psr[i] >= 125 && psr[i] <= 250 ? 0 : INF;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c; let v = d[i];
    if (c > 0) v = Math.min(v, d[i - 1] + a);
    if (r > 0) { v = Math.min(v, d[i - n] + a); if (c > 0) v = Math.min(v, d[i - n - 1] + b); if (c < n - 1) v = Math.min(v, d[i - n + 1] + b); }
    d[i] = v;
  }
  for (let r = n - 1; r >= 0; r--) for (let c = n - 1; c >= 0; c--) {
    const i = r * n + c; let v = d[i];
    if (c < n - 1) v = Math.min(v, d[i + 1] + a);
    if (r < n - 1) { v = Math.min(v, d[i + n] + a); if (c < n - 1) v = Math.min(v, d[i + n + 1] + b); if (c > 0) v = Math.min(v, d[i + n - 1] + b); }
    d[i] = v;
  }
  const out = new Uint8Array(n * n);
  for (let i = 0; i < out.length; i++) out[i] = d[i] > 25 ? 255 : Math.round(d[i] * 10);
  return out;
}
