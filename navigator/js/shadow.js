// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Time-varying shadows on the pole map.
// For every 500 m pixel we have the terrain horizon height at 64 map azimuths (data/horizon/).
// Given the Sun direction (moon-fixed unit vector) we compare the Sun's local elevation with the horizon.

const N = 800, NAZ = 64, AZ_STEP = 360 / NAZ, R_MOON = 1737400, D2R = Math.PI / 180;
let hor = null, geo = null, loading = null, psr = null, sunYear = null;

export function ready() { return !!hor; }

// read the RGB tiles (3 azimuths each) of one horizon folder; null if the folder is missing
async function readSet(dir) {
  const ok = await fetch(new URL(`../${dir}/meta.json`, import.meta.url)).then(r => r.ok, () => false);
  if (!ok) return null;
  const buf = new Uint8Array(NAZ * N * N);
  const files = Math.ceil(NAZ / 3);
  await Promise.all(Array.from({ length: files }, async (_, k) => {
    const img = new Image();
    img.src = new URL(`../${dir}/h_${String(k).padStart(2, '0')}.png`, import.meta.url).href;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = N; c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, N, N).data;
    for (let b = 0; b < 3; b++) {
      const az = 3 * k + b;
      if (az >= NAZ) break;
      const off = az * N * N;
      for (let i = 0; i < N * N; i++) buf[off + i] = px[i * 4 + b];
    }
  }));
  return buf;
}

// slope map (uint8, slope_deg = v * 40 / 250, 255 = no data) and the 10 m / 20 m mast horizons
let extra = null;
export function loadExtra() {
  return extra || (extra = (async () => {
    await load();
    const img = new Image();
    img.src = new URL('../data/horizon/slope.png', import.meta.url).href;
    await img.decode();
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, N, N).data, slope = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) slope[i] = d[i * 4];
    return { slope, sets: { 2: hor, 10: await readSet('data/horizon_m10'), 20: await readSet('data/horizon_m20') } };
  })());
}

// pixel index, column and row of a map point (m)
export function pixelOf(x, y) {
  const q = Math.max(0, Math.min(N - 1, Math.round((x + 199750) / 500))), r = Math.max(0, Math.min(N - 1, Math.round((199750 - y) / 500)));
  return { q, r, i: r * N + q };
}
export const pixelXY = (q, r) => [-199750 + q * 500, 199750 - r * 500];

// horizon profile at a pixel in local azimuth (0.5 deg steps, from north), for one observer-height set
export function profile(i, buf) {
  const out = new Float32Array(720), lon = geo.lon[i];
  for (let a = 0; a < 720; a++) out[a] = horizonIn(buf, i, a * 0.5 + lon);
  return out;
}

function horizonIn(buf, i, mapAz) {
  const a = ((mapAz % 360) + 360) % 360 / AZ_STEP, k = Math.floor(a), f = a - k;
  const v0 = buf[(k % NAZ) * N * N + i], v1 = buf[((k + 1) % NAZ) * N * N + i];
  return (v0 + (v1 - v0) * f) / 10 - 5;
}

// the 64 horizon values (map azimuths, deg) at a point, for any height set
export function horizonValues(x, y, buf = hor) {
  const { i } = pixelOf(x, y);
  return Array.from({ length: NAZ }, (_, k) => buf[k * N * N + i] / 10 - 5);
}

// load the base horizon set and the per-pixel geometry
export function load() {
  if (loading) return loading;
  loading = (async () => {
    const meta = await (await fetch(new URL('../data/horizon/meta.json', import.meta.url))).json();
    const buf = await readSet('data/horizon');
    // per-pixel geometry, pixel centres, row 0 = max y
    const x0 = meta.grid.x_min, y1 = meta.grid.y_max, res = meta.grid.res_m;
    const cl = new Float32Array(N * N), sl = new Float32Array(N * N), cp = new Float32Array(N * N), sp = new Float32Array(N * N), lon = new Float32Array(N * N);
    for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
      const x = x0 + q * res, y = y1 - r * res, i = r * N + q;
      const rho = Math.hypot(x, y), L = Math.atan2(x, y), phi = -Math.PI / 2 + 2 * Math.atan(rho / (2 * R_MOON));
      cl[i] = Math.cos(L); sl[i] = Math.sin(L); cp[i] = Math.cos(phi); sp[i] = Math.sin(phi); lon[i] = L / D2R;
    }
    geo = { cl, sl, cp, sp, lon };
    // never lit in 2027 (value 0 in sunlit_2027.png = share of the year with Sun, 0 = never)
    const pi = new Image();
    pi.src = new URL('../data/horizon/sunlit_2027.png', import.meta.url).href;
    await pi.decode();
    const pc = document.createElement('canvas'); pc.width = N; pc.height = N;
    const pg = pc.getContext('2d', { willReadFrequently: true }); pg.drawImage(pi, 0, 0);
    const pd = pg.getImageData(0, 0, N, N).data;
    psr = new Uint8Array(N * N); sunYear = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) { psr[i] = pd[i * 4] === 0 ? 1 : 0; sunYear[i] = pd[i * 4]; }
    hor = buf;
  })();
  return loading;
}

// horizon elevation (deg) at pixel i for a map azimuth (deg), linear between bins
function horizonAt(i, mapAz) {
  const a = ((mapAz % 360) + 360) % 360 / AZ_STEP, k = Math.floor(a), f = a - k;
  const v0 = hor[(k % NAZ) * N * N + i], v1 = hor[((k + 1) % NAZ) * N * N + i];
  return (v0 + (v1 - v0) * f) / 10 - 5;
}

// paint an 800x800 shadow mask for Sun vector S into canvas (black, alpha = how dark)
export function paint(canvas, S) {
  if (!hor || !S) return false;
  if (canvas.width !== N) { canvas.width = N; canvas.height = N; }
  const g = canvas.getContext('2d'), out = g.createImageData(N, N), d = out.data;
  const { cl, sl, cp, sp, lon } = geo;
  for (let i = 0; i < N * N; i++) {
    const h = cl[i] * S[0] + sl[i] * S[1];                 // component along local "out from axis"
    const up = cp[i] * h + sp[i] * S[2];
    const north = -sp[i] * h + cp[i] * S[2];
    const east = -sl[i] * S[0] + cl[i] * S[1];
    const el = Math.asin(Math.max(-1, Math.min(1, up))) / D2R;
    const az = Math.atan2(east, north) / D2R;               // local, from north
    const f = Math.max(0, Math.min(1, (el - horizonAt(i, az + lon[i])) / 0.53 + 0.5));  // visible Sun-disc share
    if (psr && psr[i]) { d[i * 4] = 18; d[i * 4 + 1] = 32; d[i * 4 + 2] = 110; d[i * 4 + 3] = 200; continue; }  // permanent shadow
    d[i * 4 + 3] = Math.round(170 * (1 - f));
  }
  g.putImageData(out, 0, 0);
  return true;
}

// paint an 800x800 Earth-shadow mask for Earth vector E (moon-fixed unit vector): blue where the Earth (a point)
// is below the local horizon, clear where it is in line of sight. Same per-pixel test as paint(), no disc.
export function paintEarth(canvas, E, rgba = [36, 89, 184, 150]) {
  if (!hor || !E) return false;
  if (canvas.width !== N) { canvas.width = N; canvas.height = N; }
  const g = canvas.getContext('2d'), out = g.createImageData(N, N), d = out.data;
  const { cl, sl, cp, sp, lon } = geo;
  for (let i = 0; i < N * N; i++) {
    const h = cl[i] * E[0] + sl[i] * E[1], up = cp[i] * h + sp[i] * E[2];
    const el = Math.asin(Math.max(-1, Math.min(1, up))) / D2R;
    const az = Math.atan2(-sl[i] * E[0] + cl[i] * E[1], -sp[i] * h + cp[i] * E[2]) / D2R;
    if (el > horizonAt(i, az + lon[i])) continue;              // Earth in view: clear
    d[i * 4] = rgba[0]; d[i * 4 + 1] = rgba[1]; d[i * 4 + 2] = rgba[2]; d[i * 4 + 3] = rgba[3];
  }
  g.putImageData(out, 0, 0);
  return true;
}

// visible Sun-disc share at map point (x, y in m) — used to cross-check against the site series
export function sunAt(x, y, S) {
  const q = Math.round((x + 199750) / 500), r = Math.round((199750 - y) / 500), i = r * N + q;
  const { cl, sl, cp, sp, lon } = geo;
  const h = cl[i] * S[0] + sl[i] * S[1], up = cp[i] * h + sp[i] * S[2];
  const north = -sp[i] * h + cp[i] * S[2], east = -sl[i] * S[0] + cl[i] * S[1];
  const el = Math.asin(up) / D2R, az = Math.atan2(east, north) / D2R;
  return Math.max(0, Math.min(1, (el - horizonAt(i, az + lon[i])) / 0.53 + 0.5));
}

// "Long exposure": share of the Sun disc visible, averaged over a list of Sun vectors (one per sample hour).
// Returns Float32Array(N*N) in 0..1 (PSR pixels stay 0).
export function exposure(Slist) {
  const out = new Float32Array(N * N);
  if (!hor || !Slist.length) return out;
  const { cl, sl, cp, sp, lon } = geo, n = Slist.length, R2D = 1 / D2R;
  // fast atan2 (max error ~0.3 deg, far below the 5.6 deg azimuth bins)
  const atan2 = (y, x) => {
    const ax = Math.abs(x), ay = Math.abs(y), a = Math.min(ax, ay) / (Math.max(ax, ay) || 1), s2 = a * a;
    let r = ((-0.0464964749 * s2 + 0.15931422) * s2 - 0.327622764) * s2 * a + a;
    if (ay > ax) r = 1.57079637 - r;
    if (x < 0) r = 3.14159274 - r;
    return y < 0 ? -r : r;
  };
  for (let i = 0; i < N * N; i++) {
    if (psr[i]) continue;
    let acc = 0;
    const c1 = cl[i], s1 = sl[i], c2 = cp[i], s2 = sp[i], L = lon[i];
    for (let k = 0; k < n; k++) {
      const S = Slist[k], h = c1 * S[0] + s1 * S[1], up = c2 * h + s2 * S[2];
      if (up < -0.03) continue;                                   // Sun well below the flat horizon
      const el = up * R2D;                                        // asin(x) ~ x for the low polar Sun
      let a = (atan2(-s1 * S[0] + c1 * S[1], -s2 * h + c2 * S[2]) * R2D + L) / AZ_STEP;
      a = ((a % NAZ) + NAZ) % NAZ;
      const kk = a | 0, f0 = a - kk, base = i;
      const v0 = hor[kk * N * N + base], v1 = hor[((kk + 1) % NAZ) * N * N + base];
      const f = (el - ((v0 + (v1 - v0) * f0) / 10 - 5)) / 0.53 + 0.5;
      acc += f <= 0 ? 0 : f >= 1 ? 1 : f;
    }
    out[i] = acc / n;
  }
  return out;
}

// paint an exposure map: dark where the Sun was mostly hidden, clear where it was mostly up
export function paintExposure(canvas, ex) {
  if (canvas.width !== N) { canvas.width = N; canvas.height = N; }
  const g = canvas.getContext('2d'), out = g.createImageData(N, N), d = out.data;
  for (let i = 0; i < N * N; i++) {
    if (psr[i]) { d[i * 4] = 18; d[i * 4 + 1] = 32; d[i * 4 + 2] = 110; d[i * 4 + 3] = 200; continue; }
    d[i * 4 + 3] = Math.round(200 * (1 - ex[i]));
  }
  g.putImageData(out, 0, 0);
}

// the k best-lit landable pixels (slope <= maxSlope), at least sepKm apart; ties -> more sun over 2027
export function brightest(ex, slope, k = 5, sepKm = 10, maxSlope = 8) {
  const idx = [];
  for (let i = 0; i < N * N; i++) {
    if (psr[i] || ex[i] < 0.5) continue;
    const s = slope ? slope[i] : 0;
    if (slope && (s === 255 || s * 40 / 250 > maxSlope)) continue;
    idx.push(i);
  }
  idx.sort((a, b) => (ex[b] - ex[a]) || (sunYear[b] - sunYear[a]));
  const out = [], sep = (sepKm * 2) ** 2;     // in pixels (500 m)
  for (const i of idx) {
    const q = i % N, r = (i / N) | 0;
    if (out.some(o => (o.q - q) ** 2 + (o.r - r) ** 2 < sep)) continue;
    const [x, y] = pixelXY(q, r);
    out.push({ i, q, r, x, y, frac: ex[i] });
    if (out.length >= k) break;
  }
  return out;
}

// the raw base horizon set (64 x 800 x 800, value/10 - 5 = deg), for the Find a site window worker
export const horizonBuf = () => hor;
