// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Stay statistics of one spot (Sun %, Earth %, longest dark h for a stay starting on each day of 2027) off the page's
// thread, for the 10 m / 20 m mast horizons of the ranked list. The maths is a copy of layers/js/time.js skyAt() +
// series() and layers/js/trip.js windowStats(), so the numbers are the same as on the page.
const D2R = Math.PI / 180, R_MOON = 1737400, DAYS = 365;
let B = null;
const latLon = (x, y) => ({ lat: (-Math.PI / 2 + 2 * Math.atan(Math.hypot(x, y) / (2 * R_MOON))) / D2R, lon: Math.atan2(x, y) / D2R });
function series(x, y, h720, Bd) {
  const { lat, lon } = latLon(x, y), p = lat * D2R, l = lon * D2R;
  const up = [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)], east = [-Math.sin(l), Math.cos(l), 0];
  const north = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)];
  const frac = new Float32Array(Bd.n), vis = new Uint8Array(Bd.n);
  const dot = (V, i, u) => V[i * 3] * u[0] + V[i * 3 + 1] * u[1] + V[i * 3 + 2] * u[2];
  for (let i = 0; i < Bd.n; i++) for (let b = 0; b < 2; b++) {
    const V = b ? Bd.E : Bd.S, e = Math.asin(Math.max(-1, Math.min(1, dot(V, i, up)))) / D2R, a = (Math.atan2(dot(V, i, east), dot(V, i, north)) / D2R + 360) % 360;
    const h = h720[Math.round(a / 0.5) % 720];
    if (b === 0) frac[i] = Math.max(0, Math.min(1, (e - h) / 0.53 + 0.5)); else vis[i] = e > h ? 1 : 0;
  }
  return { frac, vis };
}
function windowStats(sunFrac, earthVis, H, mission) {
  const n0 = mission * 24, cs = new Float64Array(H + 1), ce = new Float64Array(H + 1);
  for (let i = 0; i < H; i++) { cs[i + 1] = cs[i] + sunFrac[i]; ce[i + 1] = ce[i] + earthVis[i]; }
  const sun = new Float32Array(DAYS), earth = new Float32Array(DAYS), dark = new Float32Array(DAYS);
  for (let d = 0; d < DAYS; d++) {
    const a = d * 24, b = Math.min(H, a + n0), n = b - a;
    sun[d] = (cs[b] - cs[a]) / n * 100; earth[d] = (ce[b] - ce[a]) / n * 100;
    let run = 0, mx = 0; for (let i = a; i < b; i++) { run = sunFrac[i] < 0.1 ? run + 1 : 0; if (run > mx) mx = run; }
    dark[d] = mx;
  }
  return { sun, earth, dark };
}
onmessage = e => {
  const m = e.data;
  if (m.type === 'init') { B = { S: m.S, E: m.E, n: m.n }; return; }
  const lon = Math.atan2(m.x, m.y) / D2R, vals = m.vals, h720 = new Float32Array(720);
  for (let a = 0; a < 720; a++) {
    const q = ((a * 0.5 + lon) % 360 + 360) % 360 / 5.625, k = Math.floor(q), f = q - k;
    h720[a] = vals[k % 64] + (vals[(k + 1) % 64] - vals[k % 64]) * f;
  }
  const o = series(m.x, m.y, h720, B), w = windowStats(o.frac, o.vis, B.n, m.mission);
  postMessage({ id: m.id, ...w }, [w.sun.buffer, w.earth.buffer, w.dark.buffer]);
};
