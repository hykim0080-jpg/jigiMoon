// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Window statistics for every 500 m pixel: over the stay that starts on the chosen day, the share of the Sun disc
// that is visible (%), the share of samples with Earth above the horizon (%) and the longest dark spell (h, Sun disc < 10 %).
// Same horizon test as navigator/js/shadow.js exposure(); samples every `step` hours.
const N = 800, NAZ = 64, AZ_STEP = 360 / NAZ, NPX = N * N, R_MOON = 1737400, R2D = 180 / Math.PI;
let hor, S, E, nH, cl, sl, cp, sp, lon;
const atan2 = (y, x) => {   // fast atan2 (max error ~0.3 deg, far below the 5.6 deg azimuth bins)
  const ax = Math.abs(x), ay = Math.abs(y), a = Math.min(ax, ay) / (Math.max(ax, ay) || 1), s2 = a * a;
  let r = ((-0.0464964749 * s2 + 0.15931422) * s2 - 0.327622764) * s2 * a + a;
  if (ay > ax) r = 1.57079637 - r;
  if (x < 0) r = 3.14159274 - r;
  return y < 0 ? -r : r;
};
function init(m) {
  hor = m.hor; S = m.S; E = m.E; nH = m.n;
  cl = new Float32Array(NPX); sl = new Float32Array(NPX); cp = new Float32Array(NPX); sp = new Float32Array(NPX); lon = new Float32Array(NPX);
  for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
    const x = -199750 + q * 500, y = 199750 - r * 500, i = r * N + q;
    const L = Math.atan2(x, y), phi = -Math.PI / 2 + 2 * Math.atan(Math.hypot(x, y) / (2 * R_MOON));
    cl[i] = Math.cos(L); sl[i] = Math.sin(L); cp[i] = Math.cos(phi); sp[i] = Math.sin(phi); lon[i] = L * R2D;
  }
}
// one pixel over a list of sample vectors: [visible Sun share, Earth-up share, longest dark run in samples]
function pixel(i, Sv, Ev, n, exact) {   // exact: true elevation (asin), as the pin card's hourly series
  const c1 = cl[i], s1 = sl[i], c2 = cp[i], s2 = sp[i], L = lon[i];
  let acc = 0, ev = 0, rn = 0, mx = 0;
  for (let k = 0; k < n; k++) {
    const o = k * 3;
    let h = c1 * Sv[o] + s1 * Sv[o + 1], up = c2 * h + s2 * Sv[o + 2], f = 0;
    if (up > -0.0875) {   // horizon data go down to -5 deg
      const el = (exact ? Math.asin(up) : up) * R2D, az = atan2(-s1 * Sv[o] + c1 * Sv[o + 1], -s2 * h + c2 * Sv[o + 2]) * R2D + L;
      f = (el - horAt(i, az)) / 0.53 + 0.5; f = f <= 0 ? 0 : f >= 1 ? 1 : f;
    }
    acc += f;
    if (f < 0.1) { if (++rn > mx) mx = rn; } else rn = 0;
    h = c1 * Ev[o] + s1 * Ev[o + 1]; up = c2 * h + s2 * Ev[o + 2];   // Earth: visible when its centre is above the horizon
    if (up > -0.0875) {
      const el = (exact ? Math.asin(up) : up) * R2D, az = atan2(-s1 * Ev[o] + c1 * Ev[o + 1], -s2 * h + c2 * Ev[o + 2]) * R2D + L;
      if (el > horAt(i, az)) ev++;
    }
  }
  return [acc / n, ev / n, mx];
}
function horAt(i, mapAz) {
  let a = mapAz / AZ_STEP; a = ((a % NAZ) + NAZ) % NAZ;
  const k = a | 0, f = a - k, v0 = hor[k * NPX + i], v1 = hor[((k + 1) % NAZ) * NPX + i];
  return (v0 + (v1 - v0) * f) / 10 - 5;
}
function samples(day, mission, step) {
  const hs = []; for (let h = 0; h < mission * 24; h += step) hs.push(Math.min(nH - 1, day * 24 + h));
  const n = hs.length, Sv = new Float32Array(n * 3), Ev = new Float32Array(n * 3);
  hs.forEach((h, k) => { Sv.set(S.subarray(h * 3, h * 3 + 3), k * 3); Ev.set(E.subarray(h * 3, h * 3 + 3), k * 3); });
  return { n, Sv, Ev };
}
// coarse samples everywhere; pixels close to a criterion are redone hour by hour, so that the map agrees with
// the hourly verdict of the pin card
function run(day, mission, step, i0, i1, crit) {
  const A = samples(day, mission, step), H = samples(day, mission, 1);
  const M = i1 - i0, sun = new Uint8Array(M), earth = new Uint8Array(M), dark = new Uint16Array(M);   // sun, earth: % x 2
  for (let i = i0; i < i1; i++) {
    let [su, ea, mx] = pixel(i, A.Sv, A.Ev, A.n), dh = mx * step;
    if (Math.abs(100 * su - crit.sun) < 4 || Math.abs(100 * ea - crit.earth) < 4 || Math.abs(dh - crit.dark) <= 2 * step) { [su, ea, mx] = pixel(i, H.Sv, H.Ev, H.n, true); dh = mx; }
    const j = i - i0; sun[j] = Math.floor(200 * su + 1e-6); earth[j] = Math.floor(200 * ea + 1e-6); dark[j] = dh;
  }
  return { sun, earth, dark };
}
onmessage = e => {
  const m = e.data;
  if (m.type === 'init') { init(m); return; }
  const t0 = performance.now(), r = run(m.day, m.mission, m.step, m.i0, m.i1, m.crit);
  postMessage({ key: m.key, i0: m.i0, ...r, ms: performance.now() - t0 }, [r.sun.buffer, r.earth.buffer, r.dark.buffer]);
};
