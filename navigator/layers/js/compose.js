// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { N, SIMPLE, ZONE, RAMPS, MASK_COLORS, SCORE_RAMP, FAIL_AT_255, PX, HALF } from './config.js';
import { buildRampLUT, layerColor, colorAt, hex } from './ramps.js';
import { decode, valueOf } from './data.js';
import { winPass, winAt } from './window.js';
import { initFactor, fxImage } from './factor.js';

const NPX = N * N;
let D, comp, ctx, maskCv, maskCtx, maskImg, maskU32, halo, haloCtx, tmpCv, tmpCtx, D2, img, u32, light, ramp = {}, scoreLut, sitesCells = {}, last = { st: null, nCrit: 0, passPx: 0 };
export let failCount, failBase, failYear, score100;
// stacked map layers: one fail mask per criterion (alpha 255 where that criterion fails); mapview hatches each
// in the criterion's colour and direction, so overlapping failures read as crossing hatches
const hatchCv = {}, hatchBuf = {};
export let hatchList = [];
function hatchMask(id) {
  if (!hatchCv[id]) { const c = document.createElement('canvas'); c.width = N; c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N); hatchCv[id] = c; hatchBuf[id] = { g, im, u32: new Uint32Array(im.data.buffer) }; }
  return hatchBuf[id];
}
const ID3 = Uint8Array.from({ length: 256 }, (_, v) => v);   // pass bytes of the window arrays are already 0 / 1

// continuous base of the default view: one factor as intensity (ramp colour, alpha rising with the value)
const BASE = {
  sun:   { ids: ['sun', 'sun_days'], ramp: 'sun', hi: { sun: 50, sun_days: 130 }, gamma: 1.3 },
  earth: { ids: ['earth', 'earth_days'], ramp: 'earth', hi: { earth: 80, earth_days: 290 }, gamma: 1.15 },
  dark:  { ids: ['dark_days'], ramp: 'dark', hi: { dark_days: 60 }, gamma: 1.2 },
  slope: { ids: ['slope'], ramp: 'slope', hi: { slope: 16 }, invert: true, gamma: 1.8 },
};
export const BASES = Object.keys(BASE);
const baseT = (sp, u) => { const x = Math.max(0, Math.min(1, u)); return Math.pow(sp.invert ? 1 - x : x, sp.gamma); };
const baseColor = (sp, t) => colorAt(RAMPS[sp.ramp], .22 + .75 * t);
function baseOf(st) {
  const key = BASE[st.base] ? st.base : 'sun', sp = BASE[key], id = sp.ids.find(i => D.bytes[i]);
  return id ? { key, sp, id, meta: metaOf(id), hi: sp.hi[id] } : null;
}
export function baseInfo(st) {
  const b = baseOf(st); if (!b) return null;
  const stops = []; for (let k = 0; k <= 5; k++) { const t = baseT(b.sp, k / 5), a = .08 + .87 * t, C = baseColor(b.sp, t); stops.push(`rgb(${C.map((c, j) => Math.round(70 * (1 - a) + c * a))}) ${k * 20}%`); }
  return { css: `linear-gradient(to right,${stops.join(',')})`, hi: `${b.hi}${b.meta.unit === '일' ? '' : b.meta.unit}` + (b.meta.unit === '일' ? ' d' : '') };
}
function baseLUT(b) {
  const r = new Uint8Array(256), g = new Uint8Array(256), bl = new Uint8Array(256), a = new Float32Array(256);
  for (let v = 0; v <= 250; v++) {
    const t = baseT(b.sp, decode(b.meta, v) / b.hi), C = baseColor(b.sp, t);
    r[v] = C[0]; g[v] = C[1]; bl[v] = C[2]; a[v] = .04 + .88 * t;
  }
  return { r, g, b: bl, a };
}
export function passLUT(meta, thr) {
  const l = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    if (v > 250) { l[v] = (v === 255 && FAIL_AT_255.includes(meta.id)) ? 0 : 2; continue; }
    const val = decode(meta, v);
    l[v] = (meta.direction === '<=' ? val <= thr + 1e-9 : val >= thr - 1e-9) ? 1 : 0;
  }
  return l;
}
export function scoreLUT(meta, thr) {
  const l = new Float32Array(256).fill(-1), le = meta.direction === '<=';
  const worst = le ? meta.max : meta.min, best = le ? meta.min : meta.max;
  const cl = x => Math.max(0, Math.min(1, x));
  for (let v = 0; v <= 250; v++) {
    const val = decode(meta, v);
    if (thr == null) { l[v] = cl((val - meta.min) / ((meta.max - meta.min) || 1)); continue; }
    const pass = le ? val <= thr + 1e-9 : val >= thr - 1e-9;
    l[v] = cl(pass ? .5 + .5 * (val - thr) / ((best - thr) || 1) : .5 * (val - worst) / ((thr - worst) || 1));
  }
  if (FAIL_AT_255.includes(meta.id)) l[255] = 0;
  return l;
}

export function initCompose(data) {
  D = data; initFactor(data);
  comp = document.createElement('canvas'); comp.width = comp.height = N;
  ctx = comp.getContext('2d'); img = ctx.createImageData(N, N); u32 = new Uint32Array(img.data.buffer);
  light = new Float32Array(256); for (let h = 0; h < 256; h++) light[h] = .45 + .55 * h / 255;
  maskCv = Object.assign(document.createElement('canvas'), { width: N, height: N }); maskCtx = maskCv.getContext('2d');
  maskImg = maskCtx.createImageData(N, N); maskU32 = new Uint32Array(maskImg.data.buffer);
  tmpCv = Object.assign(document.createElement('canvas'), { width: 200, height: 200 }); tmpCtx = tmpCv.getContext('2d');
  halo = Object.assign(document.createElement('canvas'), { width: N, height: N }); haloCtx = halo.getContext('2d');
  failCount = new Uint8Array(NPX); failBase = new Uint8Array(NPX); failYear = new Uint8Array(NPX); score100 = new Uint8Array(NPX);
  for (const m of data.layers) ramp[m.id] = buildRampLUT(m);
  scoreLut = new Array(256).fill(0).map((_, i) => hex2(colorAt(SCORE_RAMP, i / 255)));
  for (const s of data.sites) {
    let c0, c1, r0, r1;
    if (s.box_m) { c0 = Math.floor((s.box_m[0] + HALF) / PX); c1 = Math.floor((s.box_m[2] + HALF) / PX); r0 = Math.floor((HALF - s.box_m[3]) / PX); r1 = Math.floor((HALF - s.box_m[1]) / PX); }
    else { const c = Math.floor((s.x_m + HALF) / PX), r = Math.floor((HALF - s.y_m) / PX); c0 = c - 10; c1 = c + 10; r0 = r - 10; r1 = r + 10; }
    s.cell = { col: Math.floor((s.x_m + HALF) / PX), row: Math.floor((HALF - s.y_m) / PX) };
    sitesCells[s.id] = { c0: Math.max(0, c0), c1: Math.min(N - 1, c1), r0: Math.max(0, r0), r1: Math.min(N - 1, r1) };
  }
  return { comp, failCount, score100 };
}
const hex2 = c => c;
const pack = (r, g, b) => (0xFF000000 | b << 16 | g << 8 | r) >>> 0;
const metaOf = id => D.layers.find(m => m.id === id);
export const critIds = st => st.order.filter(id => D.bytes[id] && st.on.mask[id] && metaOf(id).threshold != null);
export const scoreIds = st => st.order.filter(id => D.bytes[id] && st.weight[id] > 0);

export function compose(st) {
  last = { st, nCrit: 0, passPx: 0 };
  const hill = D.hill, out = u32;
  if (st.mode === 'layers') {
    hatchList = [];
    const ids = st.order.filter(id => D.bytes[id] && st.on.layers[id]).reverse(), n = ids.length;
    const bs = ids.map(id => D.bytes[id]), rl = ids.map(id => ramp[id]);
    const al = ids.map((id, k) => { const f = new Float32Array(256); for (let v = 0; v < 256; v++) f[v] = rl[k].a[v] / 255 * (st.opacity[id] ?? .85); return f; });
    for (let i = 0; i < NPX; i++) {
      let pr = 0, pg = 0, pb = 0, A = 0;
      for (let k = 0; k < n; k++) {
        const v = bs[k][i], a = al[k][v]; if (a === 0) continue;
        const q = rl[k]; pr = q.r[v] * a + pr * (1 - a); pg = q.g[v] * a + pg * (1 - a); pb = q.b[v] * a + pb * (1 - a); A = a + A * (1 - a);
      }
      const h = hill[i], L = light[h];
      out[i] = pack((h * (1 - A) + pr * L) | 0, (h * (1 - A) + pg * L) | 0, (h * (1 - A) + pb * L) | 0);
    }
  } else if (st.mode === 'mask') {
    const ids = critIds(st), nb = ids.length;
    const simple = !st.adv, mon = st.adv && st.month != null && D.month ? D.month.subarray(st.month * NPX, (st.month + 1) * NPX) : null, mthr = st.monthThr, ov = st.adv ? st.ov : null;
    const n = nb + (mon ? 1 : 0); last.nCrit = n;
    const wp = winPass(st), win = ids.map(id => !!(wp && wp[id]));   // trip basis: Sun / Earth / dark judged over the stay
    const bs = ids.map((id, k) => win[k] ? wp[id] : D.bytes[id]), pl = ids.map((id, k) => win[k] ? ID3 : passLUT(metaOf(id), st.threshold[id]));
    const yk = win.map((w, k) => w ? k : -1).filter(k => k >= 0), ybs = yk.map(k => D.bytes[ids[k]]), ypl = yk.map(k => passLUT(metaOf(ids[k]), st.threshold[ids[k]]));
    const hc = ids.map(id => hex2(hexOf(layerColor(id, true)))); if (mon) hc.push(hexOf(layerColor('days', true)));
    const [pc, pa] = MASK_COLORS.pass, [mc, ma] = MASK_COLORS.many, [nc, na] = MASK_COLORS.nodata, oa = MASK_COLORS.one;
    const P = hexOf(pc), M = hexOf(mc), ND = hexOf(nc), SP = hexOf(SIMPLE.pass), spk = pack(SP[0], SP[1], SP[2]), fi = ids.indexOf(st.focusCrit);
    let passPx = 0, BL = null;
    maskU32.fill(0);
    const hb = ids.map(id => { const b = hatchMask(id); b.u32.fill(0); return b.u32; }), HK = 0xff000000;
    if (simple) { const bo = baseOf(st); if (bo) { BL = baseLUT(bo); BL.arr = D.bytes[bo.id]; } }
    const FX = simple ? fxImage(st) : null, fa = FX && FX.rgba;   // one factor on the map (factor.js) instead of the GO ground
    if (!n) { for (let i = 0; i < NPX; i++) { const h = hill[i]; out[i] = pack(h, h, h); failCount[i] = 0; failBase[i] = 0; failYear[i] = 0; } }
    else for (let i = 0; i < NPX; i++) {
      let f = 0, nd = 0, lk = -1;
      for (let k = 0; k < nb; k++) { const p = pl[k][bs[k][i]]; if (p === 2) nd = 1; else if (p === 0) { f++; lk = k; hb[k][i] = HK; } }
      if (nd) for (let k = 0; k < nb; k++) hb[k][i] = 0;
      failBase[i] = nd ? 255 : f;
      if (yk.length) { let fy = f; for (let j = 0; j < yk.length; j++) { const p = ypl[j][ybs[j][i]], q = pl[yk[j]][bs[yk[j]][i]]; fy += (p === 0) - (q === 0); } failYear[i] = nd ? 255 : fy; } else failYear[i] = failBase[i];
      if (mon && mon[i] < mthr) { f++; lk = nb; }
      const o = ov ? ov[i] : 0;
      if (o === 1) { f = 0; nd = 0; } else if (o === -1) { f = f > 1 ? f : 2; nd = 0; }
      failCount[i] = nd ? 255 : f;
      const h = hill[i];
      if (fa) {   // the factor's colour steps; ground that misses its limit dimmed
        const o = i * 4, a = fa[o + 3], L = light[h];
        if (!nd && f === 0) passPx++;
        let br, bg, bb;
        if (a === 255) { br = h * .18 + fa[o] * L * .82; bg = h * .18 + fa[o + 1] * L * .82; bb = h * .18 + fa[o + 2] * L * .82; }
        else if (a) { br = (h * .6 + fa[o] * L * .4) * .38; bg = (h * .6 + fa[o + 1] * L * .4) * .38; bb = (h * .6 + fa[o + 2] * L * .4) * .38; }
        else { br = bg = bb = h * .4; }
        out[i] = pack(br | 0, bg | 0, bb | 0);
        continue;
      }
      if (simple) {
        let br = h, bg = h, bb = h;
        if (BL) { const v = BL.arr[i]; if (v <= 250) { const A = BL.a[v], L = light[h]; br = h * (1 - A) + BL.r[v] * L * A; bg = h * (1 - A) + BL.g[v] * L * A; bb = h * (1 - A) + BL.b[v] * L * A; } }
        if (!nd && f === 0) { passPx++; maskU32[i] = spk; }
        else if (SIMPLE.outDim) { const q = 1 - SIMPLE.outDim; br *= q; bg *= q; bb *= q; }   // only the ground where every chosen criterion passes stays bright
        out[i] = pack(br | 0, bg | 0, bb | 0);
        continue;
      }
      let C, a;
      if (nd) { C = ND; a = na; }
      else if (f === 0) { C = P; a = pa; passPx++; } else { C = P; a = 0; }   // failures: hatched per criterion (mapview), not filled
      const L = light[h] * a, b = h * (1 - a);
      out[i] = pack((b + C[0] * L) | 0, (b + C[1] * L) | 0, (b + C[2] * L) | 0);
    }
    if (fa) {   // the limit as a line: met ground next to missed ground
      const W = pack(245, 247, 252);
      for (let i = 0; i < NPX; i++) {
        if (fa[i * 4 + 3] !== 255) continue;
        const c = i % N, q = j => fa[j * 4 + 3] === 128;
        if ((c > 0 && q(i - 1)) || (c < N - 1 && q(i + 1)) || (i >= N && q(i - N)) || (i < NPX - N && q(i + N))) out[i] = W;
      }
      buildHalo();
    } else if (simple) {   // suitable ground over the base: thin solid outline, low-alpha fill inside
      const SPc = SP, fill = .3, edge = SIMPLE.passA;
      for (let i = 0; i < NPX; i++) {
        if (!maskU32[i]) continue;
        const c = i % N, rr = (i - c) / N, isEdge = c === 0 || rr === 0 || c === N - 1 || rr === N - 1 || !maskU32[i - 1] || !maskU32[i + 1] || !maskU32[i - N] || !maskU32[i + N], A = isEdge ? edge : fill, o = out[i];
        out[i] = pack(((o & 255) * (1 - A) + SPc[0] * A) | 0, (((o >> 8) & 255) * (1 - A) + SPc[1] * A) | 0, (((o >> 16) & 255) * (1 - A) + SPc[2] * A) | 0);
      }
      buildHalo();
    }
    last.passPx = passPx;
    hatchList = ids.map(id => { const b = hatchBuf[id]; b.g.putImageData(b.im, 0, 0); return { id, canvas: hatchCv[id] }; });
  } else {
    hatchList = [];
    const ids = scoreIds(st), n = ids.length, a = MASK_COLORS.score;
    const bs = ids.map(id => D.bytes[id]), sl = ids.map(id => scoreLUT(metaOf(id), metaOf(id).threshold == null ? null : st.threshold[id]));
    const w = ids.map(id => st.weight[id]); let W = 0; for (const x of w) W += x;
    const ND = hexOf(MASK_COLORS.nodata[0]), na = MASK_COLORS.nodata[1];
    if (!n) for (let i = 0; i < NPX; i++) { const h = hill[i]; out[i] = pack(h, h, h); score100[i] = 255; }
    else for (let i = 0; i < NPX; i++) {
      let S = 0, nd = 0;
      for (let k = 0; k < n; k++) { const s = sl[k][bs[k][i]]; if (s < 0) { nd = 1; break; } S += s * w[k]; }
      const h = hill[i];
      let C, al;
      if (nd) { C = ND; al = na; score100[i] = 255; } else { S /= W; score100[i] = Math.round(100 * S); C = scoreLut[Math.round(S * 255)]; al = a; }
      const L = light[h] * al, b = h * (1 - al);
      out[i] = pack((b + C[0] * L) | 0, (b + C[1] * L) | 0, (b + C[2] * L) | 0);
    }
  }
  ctx.putImageData(img, 0, 0);
  return { passPx: last.passPx };
}
const hexOf = h => hex(h);
// glow around clusters of suitable ground: the mask shrunk to 200x200 and drawn back three times
export function buildHalo() {
  maskCtx.putImageData(maskImg, 0, 0);
  tmpCtx.clearRect(0, 0, 200, 200); tmpCtx.imageSmoothingEnabled = true; tmpCtx.drawImage(maskCv, 0, 0, 200, 200);
  haloCtx.clearRect(0, 0, N, N); haloCtx.imageSmoothingEnabled = true;
  for (let k = 0; k < 3; k++) haloCtx.drawImage(tmpCv, 0, 0, N, N);
  tmpCtx.clearRect(0, 0, 200, 200); tmpCtx.drawImage(maskCv, 0, 0, 50, 50);   // wider, softer bloom (deviation: extra 50x50 pass x2)
  for (let k = 0; k < 2; k++) haloCtx.drawImage(tmpCv, 0, 0, 50, 50, 0, 0, N, N);
}
export const haloCanvas = () => halo;
export const scoreColor = s => scoreLut[Math.max(0, Math.min(255, Math.round(s * 255)))];

export function sample(col, row) {
  const st = last.st, i = row * N + col, values = {}, pass = {};
  if (!st) return null;
  for (const m of D.layers) {
    const v = D.bytes[m.id][i]; values[m.id] = valueOf(m, v);
    if (m.threshold == null) pass[m.id] = null;
    else { const p = passLUT(m, st.threshold[m.id])[v]; pass[m.id] = p === 2 ? null : p === 1; }
  }
  const wp = winPass(st), win = winAt(st, i);
  if (wp) for (const id in wp) if (pass[id] != null) pass[id] = wp[id][i] === 1;
  const failIds = st.mode === 'mask' ? critIds(st).filter(id => pass[id] === false) : [];
  const fails = st.mode === 'mask' && failCount[i] !== 255 && last.nCrit ? failCount[i] : null;
  const score = st.mode === 'score' && score100[i] !== 255 ? score100[i] : null;
  return { values, pass, fails, score, failIds, nCrit: last.nCrit, win };
}
export function zonal(site, st) {
  const c = sitesCells[site.id]; let sum = 0, cnt = 0, tot = 0;
  for (let r = c.r0; r <= c.r1; r++) for (let q = c.c0; q <= c.c1; q++) {
    const i = r * N + q; tot++;
    if (st.mode === 'mask') { if (failCount[i] === 0) cnt++; }
    else if (st.mode === 'score') { if (score100[i] !== 255) { sum += score100[i]; cnt++; } }
  }
  if (st.mode === 'mask') return last.nCrit ? 100 * cnt / tot : null;
  if (st.mode === 'score') return cnt ? sum / cnt : null;
  return null;
}
