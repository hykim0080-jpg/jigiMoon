// Time-varying shadows on the pole map.
// For every 500 m pixel we have the terrain horizon height at 64 map azimuths (data/horizon/).
// Given the Sun direction (moon-fixed unit vector) we compare the Sun's local elevation with the horizon.

const N = 800, NAZ = 64, AZ_STEP = 360 / NAZ, R_MOON = 1737400, D2R = Math.PI / 180;
let hor = null, geo = null, loading = null, psr = null;

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
    psr = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) psr[i] = pd[i * 4] === 0 ? 1 : 0;
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

// visible Sun-disc share at map point (x, y in m) — used to cross-check against the site series
export function sunAt(x, y, S) {
  const q = Math.round((x + 199750) / 500), r = Math.round((199750 - y) / 500), i = r * N + q;
  const { cl, sl, cp, sp, lon } = geo;
  const h = cl[i] * S[0] + sl[i] * S[1], up = cp[i] * h + sp[i] * S[2];
  const north = -sp[i] * h + cp[i] * S[2], east = -sl[i] * S[0] + cl[i] * S[1];
  const el = Math.asin(up) / D2R, az = Math.atan2(east, north) / D2R;
  return Math.max(0, Math.min(1, (el - horizonAt(i, az + lon[i])) / 0.53 + 0.5));
}
