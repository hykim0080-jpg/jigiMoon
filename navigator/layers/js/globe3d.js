// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Find a site in 3D: the ±200 km south-pole terrain (LOLA 500 m grid, heights x2.5) bent to the Moon's curvature
// and set into the whole Moon globe (NASA SVS CGI Moon Kit), stars behind, a low oblique camera looking Earthward
// (top of the screen = Earth side). Ground that is GO for the chosen landing day and stay glows gold (brighter =
// more sunlight); permanently shadowed ground (possible ice) is soft blue; everything else is grey relief.
// The glow is the same GO / NO-GO mask as the 2D map (compose.js failCount), not a weighted score.
// Hover shows a small card; click drops the pin (the spot panel opens as in 2D).
import { N } from './config.js';
import { state, setState } from './state.js';
import { failCount, sample } from './compose.js';
import { tripRanked } from './trip.js';
import { lmName } from './orient.js';
import { lang } from './strings.js';

const EXAG = 2.5, R_KM = 1737.4, EN = 400;         // mesh: 400 x 400 vertices over 400 km
const TX = {
  en: { go: 'GO', nogo: 'NO-GO', sun: 'Sun', earth: 'Earth', dark: 'Longest dark', slope: 'Slope', ice: 'To ice (PSR)', inPsr: 'inside shadow', earthDir: 'Earth', stay: d => `over the ${d}-day stay`, year: 'yearly', click: 'Click to check this spot', psr: 'Permanent shadow · ice may be here', d2: '2D', d3: '3D', nodata: 'no data', psrLeg: 'Blue = permanent shadow, ice may be here', terrain: 'Terrain', ridge: 'ridge / high ground', floor: 'low ground / crater floor', level: 'level ground' },
  ko: { go: 'GO', nogo: 'NO-GO', sun: '햇빛', earth: '지구', dark: '최장 어둠', slope: '경사', ice: '얼음(영구 그림자)까지', inPsr: '그림자 안', earthDir: '지구', stay: d => `${d}일 체류 동안`, year: '연평균', click: '클릭하면 이 지점을 확인해요', psr: '영구 그림자 · 얼음이 있을 수 있음', d2: '2D', d3: '3D', nodata: '자료 없음', psrLeg: '파랑 = 영구 그림자, 얼음이 있을 수 있음', terrain: '지형', ridge: '능선·높은 곳', floor: '낮은 곳·분화구 바닥', level: '평지' },
};
const tx = (k, ...a) => { const v = (TX[lang] || TX.en)[k]; return typeof v === 'function' ? v(...a) : v; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// gold ramp for GO ground, dim amber -> warm white (by sunlight over the stay)
const GOLD = [[0, [150, 82, 28]], [.45, [222, 136, 48]], [.75, [250, 198, 96]], [1, [255, 244, 204]]];
const GLUT = new Uint8Array(256 * 3);
for (let i = 0; i < 256; i++) {
  const t = i / 255; let k = 0; while (k < GOLD.length - 2 && t > GOLD[k + 1][0]) k++;
  const [t0, a] = GOLD[k], [t1, b] = GOLD[k + 1], u = (t - t0) / (t1 - t0);
  for (let j = 0; j < 3; j++) GLUT[i * 3 + j] = a[j] + (b[j] - a[j]) * u;
}

let THREE = null, OrbitControls = null;
let D = null, root = null, cv = null, renderer = null, scene = null, cam = null, controls = null, built = false, loading = null;
let elev = null, ref = 0, tex = null, tctx = null, timg = null, pinsEl = null, tip = null, raf = 0, on = false, dirty = true;
let gcv = null, gctx = null, gtex = null, legEl = null;
let pinList = [], stalks = null, stalkMat = null, lastKey = '', lastView = '', flyT = null, fly = null, earthEl = null;

const xzOfCell = (col, row) => ({ X: -199.75 + col * 0.5, Z: -199.75 + row * 0.5 });
const cellOf = (X, Z) => { const c = Math.round((X + 199.75) / 0.5), r = Math.round((Z + 199.75) / 0.5); return c < 0 || r < 0 || c >= N || r >= N ? null : { col: c, row: r }; };
function zAt(X, Z) {   // metres, bilinear on the 800 x 800 grid
  const fc = clamp((X + 199.75) / 0.5, 0, N - 1.001), fr = clamp((Z + 199.75) / 0.5, 0, N - 1.001);
  const c = Math.floor(fc), r = Math.floor(fr), u = fc - c, v = fr - r, i = r * N + c, e = elev;
  return (e[i] * (1 - u) + e[i + 1] * u) * (1 - v) + (e[i + N] * (1 - u) + e[i + N + 1] * u) * v;
}
// height of the ground (km, scene units): exaggerated relief on the curved surface; towards the edge the relief
// eases onto the globe so the patch runs into the Moon sphere without a step
const edgeF = (X, Z) => 1 - sstep(176, 198, Math.hypot(X, Z));
const hAt = (X, Z) => (zAt(X, Z) - ref) / 1000 * EXAG * edgeF(X, Z) - (X * X + Z * Z) / (2 * R_KM);

export function init(panel, data) {
  D = data;
  root = Object.assign(document.createElement('div'), { className: 'g3d', hidden: true });
  root.innerHTML = `<canvas></canvas><div class="g3d-pins"></div><div class="g3d-earth"><i></i><span>${tx('earthDir')}</span></div><div class="g3d-tip" hidden></div><div class="g3d-leg"><span class="l1"></span><span class="l2">${tx('psrLeg')}</span></div>`;
  cv = root.querySelector('canvas'); pinsEl = root.querySelector('.g3d-pins'); tip = root.querySelector('.g3d-tip'); earthEl = root.querySelector('.g3d-earth'); legEl = root.querySelector('.g3d-leg');
  panel.append(root);
  // the 2D map listens on the whole panel: keep 3D gestures to the 3D view
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'dblclick', 'click', 'pointerleave']) root.addEventListener(ev, e => e.stopPropagation());
  const seg = Object.assign(document.createElement('div'), { className: 'seg lyr-dim' });
  seg.innerHTML = `<button data-d="0">${tx('d2')}</button><button data-d="1">${tx('d3')}</button>`;
  seg.onclick = e => { e.stopPropagation(); const b = e.target.closest('[data-d]'); if (b) setState({ d3: b.dataset.d === '1' }, 'view'); };
  seg.onpointerdown = seg.ondblclick = e => e.stopPropagation();
  panel.append(seg);
  addEventListener('resize', () => { if (on) size(); });
}

async function load() {
  if (loading) return loading;
  return loading = (async () => {
    const [m, o] = await Promise.all([import('../../map3d/vendor/three.module.js'), import('../../map3d/vendor/OrbitControls.js')]);
    THREE = m; OrbitControls = o.OrbitControls;
    const img = new Image(); img.src = new URL('../data/elev500.png', import.meta.url).href; await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, N, N).data; elev = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) elev[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 4 - 8000;
    // reference level = median height on the ring where the patch meets the globe
    const ring = [];
    for (let a = 0; a < 720; a++) { const t = a / 720 * Math.PI * 2; ring.push(zAt(Math.sin(t) * 190, Math.cos(t) * 190)); }
    ring.sort((a, b) => a - b); ref = ring[ring.length >> 1];
    build();
  })().catch(e => { console.error('[3d]', e); loading = null; });
}

function build() {
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 1);
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(42, 1, 0.5, 9000);

  // stars (fixed seed, so the sky is the same on every visit)
  let sd = 7; const rand = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const NS = 5000, p = new Float32Array(NS * 3), s = new Float32Array(NS), col = new Float32Array(NS * 3);
  for (let i = 0; i < NS; i++) {
    const u = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    p.set([Math.cos(a) * r * 6000, u * 6000, Math.sin(a) * r * 6000], i * 3);
    s[i] = 0.6 + Math.pow(rand(), 6) * 2.6;
    const t = rand(); col.set(t < .15 ? [1, .85, .7] : t < .3 ? [.75, .85, 1] : [1, 1, 1], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(p, 3)); sg.setAttribute('size', new THREE.BufferAttribute(s, 1)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { pr: { value: renderer.getPixelRatio() } },
    vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vC; varying float vA; uniform float pr; void main(){ vC = color; vA = clamp(size / 3.2, .18, 1.); gl_PointSize = size * pr; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vC, smoothstep(.5, .0, d) * vA * .8); }',
  }));
  stars.renderOrder = -3; stars.frustumCulled = false; scene.add(stars);

  // the whole Moon under the patch: south pole up, lon 0 (Earth side) toward -z like the map
  const moonMat = new THREE.MeshBasicMaterial({ color: 0x2a2c30, depthWrite: false });
  new THREE.TextureLoader().load(new URL('../../data/moon.jpg', import.meta.url).href, t => { t.colorSpace = THREE.SRGBColorSpace; moonMat.map = t; moonMat.color.set(0x8a8c90); moonMat.needsUpdate = true; dirty = true; });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R_KM, 256, 128), moonMat);
  moon.rotation.x = Math.PI;
  const mg = new THREE.Group(); mg.rotation.y = Math.PI / 2; mg.position.y = -R_KM; mg.add(moon);
  moon.renderOrder = -2; scene.add(mg);

  // the terrain patch
  const geo = new THREE.PlaneGeometry(400, 400, EN - 1, EN - 1); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let k = 0; k < pos.count; k++) pos.setY(k, hAt(pos.getX(k), pos.getZ(k)));
  geo.computeBoundingSphere();
  const tc = document.createElement('canvas'); tc.width = tc.height = N; tctx = tc.getContext('2d'); timg = tctx.createImageData(N, N);
  tex = new THREE.CanvasTexture(tc);
  gcv = document.createElement('canvas'); gcv.width = gcv.height = 400; gctx = gcv.getContext('2d');
  gtex = new THREE.CanvasTexture(gcv);
  const shade = new THREE.TextureLoader().load(new URL('../../data/hillshade_4000.jpg', import.meta.url).href, () => { dirty = true; });
  shade.anisotropy = renderer.capabilities.getMaxAnisotropy(); shade.generateMipmaps = true; shade.minFilter = THREE.LinearMipmapLinearFilter;
  const terr = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uShade: { value: shade }, uCol: { value: tex }, uGlow: { value: gtex } },
    vertexShader: 'varying vec2 vUv; varying vec2 vXZ; void main(){ vUv = uv; vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `precision highp float;
      uniform sampler2D uShade, uCol, uGlow; varying vec2 vUv; varying vec2 vXZ;
      vec3 gold(float t){ vec3 a = vec3(.59,.32,.11), b = vec3(.87,.53,.19), c = vec3(.98,.78,.38), d = vec3(1.,.96,.80);
        return t < .45 ? mix(a, b, t / .45) : t < .75 ? mix(b, c, (t - .45) / .3) : mix(c, d, (t - .75) / .25); }
      void main(){
        float sh = texture2D(uShade, vUv).r;
        vec4 c = texture2D(uCol, vUv);          // r = GO, g = sunlight level, b = permanent shadow, a = has data
        float base = .035 + .5 * sh * sh + .1 * sh;
        vec3 col = vec3(base) * mix(.45, .9, c.a);
        vec3 gl = gold(c.g) * (.62 + .62 * sh);
        col = mix(col, gl, c.r);
        float halo = texture2D(uGlow, vUv).r;
        col += vec3(.98, .60, .20) * halo * .8 * (1. - c.r * .7);
        col = mix(col, col * .55 + vec3(.035, .075, .17), c.b * .8);
        float a = 1. - smoothstep(178., 198., length(vXZ));
        gl_FragColor = vec4(col, a);
      }`,
  }));
  scene.add(terr);

  stalks = new THREE.Group(); scene.add(stalks);
  stalkMat = {
    site: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75 }),
    top: new THREE.LineBasicMaterial({ color: 0xf2c46d, transparent: true, opacity: .95 }),
    pin: new THREE.LineBasicMaterial({ color: 0xffffff }),
  };

  controls = new OrbitControls(cam, cv);
  Object.assign(controls, { enableDamping: true, dampingFactor: .07, minDistance: 6, maxDistance: 1400, maxPolarAngle: 1.36, zoomToCursor: true, screenSpacePanning: false, rotateSpeed: .6 });
  controls.addEventListener('change', () => { dirty = true; });
  home(true);
  wire();
  built = true; lastKey = '';
  size(); sync(state);
}

// default shot: low and oblique from the anti-Earth side, looking Earthward over the pole
function home(instant) {
  const tg = new THREE.Vector3(0, hAt(0, -15), -15), p = new THREE.Vector3(0, 95, 215).add(tg);
  if (instant) { cam.position.copy(p); controls.target.copy(tg); cam.lookAt(tg); controls.update(); }
  else fly = { t0: performance.now(), dur: 1300, p0: cam.position.clone(), p1: p, g0: controls.target.clone(), g1: tg };
}
// fly to a cell, keeping the viewing direction; dist in km from the target
function flyToCell(col, row, dist) {
  const { X, Z } = xzOfCell(col, row), tg = new THREE.Vector3(X, hAt(X, Z), Z);
  const off = cam.position.clone().sub(controls.target);
  if (off.y < off.length() * .35) off.y = off.length() * .35;   // never skim the ground on arrival
  off.setLength(dist);
  fly = { t0: performance.now(), dur: 1300, p0: cam.position.clone(), p1: tg.clone().add(off), g0: controls.target.clone(), g1: tg };
}
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// floating panels over the map (desktop full-screen layout): left criteria panel, right spot panel
let insets = [0, 0];
function insetsNow() {
  const rr = root.getBoundingClientRect(), w = rr.width, out = [0, 0];
  for (const [sel, k] of [['.lyr-left', 0], ['.lyr-pinp', 1]]) {
    const e = document.querySelector(sel); if (!e || getComputedStyle(e).position !== 'absolute' || getComputedStyle(e).display === 'none') continue;
    const b = e.getBoundingClientRect(); if (!b.width || b.bottom < rr.top + rr.height * .5) continue;
    if (k === 0 && b.right > rr.left && b.right < rr.left + w * .5) out[0] = b.right - rr.left;
    if (k === 1 && b.left < rr.right && b.left > rr.left + w * .5) out[1] = rr.right - b.left;
  }
  return out;
}
function size() {
  const w = root.clientWidth, h = root.clientHeight; if (!w || !h || !renderer) return;
  renderer.setSize(w, h, false); cam.aspect = w / h;
  const lp = document.querySelector('.lyr-left'), rr = root.getBoundingClientRect(), lb = lp && lp.getBoundingClientRect();
  insets = insetsNow(); const off = (insets[0] - insets[1]) / 2;
  if (off) cam.setViewOffset(w, h, -off, 0, w, h); else cam.clearViewOffset();
  cam.updateProjectionMatrix(); dirty = true;
}

// ---- texture: GO mask, sunlight level, permanent shadow (the relief comes from the 100 m hillshade) ----
function compose() {
  const d = timg.data, psr = D.bytes.psr, sun = D.bytes.sun;
  for (let i = 0; i < N * N; i++) {
    const f = failCount ? failCount[i] : 255, o = i * 4, sv = sun ? sun[i] : 255, sp = sv <= 250 ? sv / 2.5 : 80;
    d[o] = f === 0 ? 255 : 0;
    d[o + 1] = clamp((sp - 40) / 55, 0, 1) * 255;
    d[o + 2] = psr && psr[i] >= 125 && psr[i] <= 250 ? 255 : 0;
    d[o + 3] = f === 255 ? 0 : 255;
  }
  tctx.putImageData(timg, 0, 0);
  // soft bloom around GO ground
  const m = document.createElement('canvas'); m.width = m.height = N; const mg = m.getContext('2d'), md = mg.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { const v = d[i * 4]; md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = v; md.data[i * 4 + 3] = 255; }
  mg.putImageData(md, 0, 0);
  gctx.fillStyle = '#000'; gctx.fillRect(0, 0, 400, 400); gctx.filter = 'blur(5px)'; gctx.drawImage(m, 0, 0, 400, 400); gctx.filter = 'none';
  tex.needsUpdate = true; gtex.needsUpdate = true; dirty = true;
  if (legEl) { const L2 = document.querySelector('.lyr-legend'); if (L2) { legEl.style.left = L2.offsetLeft + 'px'; legEl.style.top = L2.offsetTop + 'px'; } const lt = document.querySelector('.lyr-legend .lt'); legEl.querySelector('.l1').textContent = lt ? lt.textContent.replace(/^Green/, 'Gold').replace(/^초록/, '금색') : ''; }
}

// ---- pins: candidate sites (white), best GO spots (gold diamonds), the clicked spot ----
function stalk(X, Z, kind, len = 4) {
  const h = hAt(X, Z), g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(X, h, Z), new THREE.Vector3(X, h + len, Z)]);
  stalks.add(new THREE.Line(g, stalkMat[kind])); return new THREE.Vector3(X, h + len, Z);
}
const goOf = (col, row) => { const f = failCount ? failCount[row * N + col] : 255; return f === 0 ? 1 : f === 255 ? -1 : 0; };
function buildPins() {
  pinsEl.innerHTML = ''; pinList = [];
  for (const c of [...stalks.children]) { c.geometry.dispose(); stalks.remove(c); }
  // landmarks: names on the ground, no stem
  for (const L of D.landmarks || []) {
    if (!(L.always_show || L.tier === 1) || L.x_m == null) continue;
    const X = L.x_m / 1000, Z = -L.y_m / 1000; if (Math.hypot(X, Z) > 195) continue;
    const el = Object.assign(document.createElement('div'), { className: 'g3p lm' }); el.innerHTML = `<span>${lmName(L)}</span>`;
    pinsEl.append(el); pinList.push({ el, v: new THREE.Vector3(X, hAt(X, Z) + .3, Z) });
  }
  for (const s of D.sites) {
    const X = s.x_m / 1000, Z = -s.y_m / 1000, c = cellOf(X, Z); if (!c) continue;
    const go = goOf(c.col, c.row), el = Object.assign(document.createElement('div'), { className: 'g3p site' + (state.site === s.id ? ' sel' : '') });
    el.innerHTML = `<i></i><span>${s.name}<b class="${go > 0 ? 'go' : 'no'}">${go > 0 ? tx('go') : go < 0 ? '' : tx('nogo')}</b></span>`;
    el.onclick = e => { e.stopPropagation(); setState({ site: s.id, pin: c, autoPin: false }, 'panel'); flyToCell(c.col, c.row, 60); };
    el.onpointerenter = () => showTip(c, el); el.onpointerleave = hideTip;
    pinsEl.append(el); pinList.push({ el, v: stalk(X, Z, 'site') });
  }
  const top = (tripRanked() || []).filter(r => r.go).slice(0, 5);
  top.forEach((r, k) => {
    const { X, Z } = xzOfCell(r.col, r.row), el = Object.assign(document.createElement('div'), { className: 'g3p top' + (state.pin && state.pin.col === r.col && state.pin.row === r.row ? ' sel' : '') });
    el.innerHTML = `<i></i><span>#${k + 1}</span>`;
    el.onclick = e => { e.stopPropagation(); setState({ pin: { col: r.col, row: r.row }, autoPin: false }, 'panel'); flyToCell(r.col, r.row, 45); };
    el.onpointerenter = () => showTip({ col: r.col, row: r.row }, el); el.onpointerleave = hideTip;
    pinsEl.append(el); pinList.push({ el, v: stalk(X, Z, 'top', 5) });
  });
  if (state.pin && !state.autoPin && !top.some(r => r.col === state.pin.col && r.row === state.pin.row)) {
    const { X, Z } = xzOfCell(state.pin.col, state.pin.row), el = Object.assign(document.createElement('div'), { className: 'g3p pin sel' });
    el.innerHTML = '<i></i>'; pinsEl.append(el); pinList.push({ el, v: stalk(X, Z, 'pin', 5) });
  }
  const pri = e => e.classList.contains('sel') ? 0 : e.classList.contains('top') ? 1 : e.classList.contains('site') ? 2 : 3;
  pinList.sort((a, b) => pri(a.el) - pri(b.el));
  dirty = true;
}
function placePins() {
  const w = root.clientWidth, h = root.clientHeight, v = new THREE.Vector3();
  const near = cam.position.distanceTo(controls.target) < 260;
  pinsEl.classList.toggle('near', near);
  const boxes = [];
  for (const p of pinList) {
    v.copy(p.v).project(cam);
    const show = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
    p.el.style.display = show ? '' : 'none';
    if (!show) continue;
    const x = (v.x * .5 + .5) * w, y = (-v.y * .5 + .5) * h;
    p.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    // labels that would overlap one already placed are hidden (pins are listed most important first)
    const sp = p.el.querySelector('span'); if (!sp) continue;
    const lw = p.lw || (p.lw = sp.offsetWidth || 60), b = p.el.classList.contains('lm') ? [x - lw / 2, y - 7, x + lw / 2, y + 7] : [x - 6, y - 8, x + 12 + lw, y + 8];
    const hit = boxes.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
    sp.style.visibility = hit ? 'hidden' : '';
    if (!hit) boxes.push(b);
  }
  // Earth direction marker: on the horizon toward lon 0 (map up)
  v.set(cam.position.x, 0, cam.position.z - 3000).project(cam);
  const ex = clamp((v.x * .5 + .5) * w, 40, w - 40), ey = clamp((-v.y * .5 + .5) * h - 34, 70, h - 120);
  earthEl.style.transform = `translate(${ex.toFixed(0)}px,${ey.toFixed(0)}px)`;
}

// ---- picking: march along the ray over the height field ----
function pick(cx, cy) {
  const r = cv.getBoundingClientRect(), ndc = new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, cam);
  const o = rc.ray.origin, dir = rc.ray.direction, q = new THREE.Vector3(); let t = 0, prev = 0;
  for (let k = 0; k < 900 && t < 5000; k++) {
    q.copy(o).addScaledVector(dir, t);
    const inside = Math.abs(q.x) < 199.7 && Math.abs(q.z) < 199.7 && Math.hypot(q.x, q.z) < 196, h = inside ? hAt(q.x, q.z) : -60;
    if (inside && q.y <= h) {
      let a = prev, b = t;
      for (let j = 0; j < 14; j++) { const m = (a + b) / 2; q.copy(o).addScaledVector(dir, m); if (q.y <= hAt(q.x, q.z)) b = m; else a = m; }
      q.copy(o).addScaledVector(dir, b); return cellOf(q.x, q.z);
    }
    prev = t; t += Math.max(.15, (q.y - h) * .45);
  }
  return null;
}

// ---- hover card ----
function tipHtml(c) {
  const sm = sample(c.col, c.row); if (!sm) return '';
  const v = sm.values, w = sm.win, fails = new Set((sm.failIds || []).map(id => id.replace(/_days.*|14$/, ''))), i = c.row * N + c.col;
  const go = goOf(c.col, c.row), cr = state.crit || {};
  const sunV = w ? w.sun : v.sun, earthV = w ? w.earth : v.earth, darkV = w ? w.dark : null;
  const line = (k, label, val, lim) => `<div${fails.has(k) ? ' class="bad"' : ''}><small>${label}${lim ? ' ' + lim : ''}</small><b>${val}</b></div>`;
  const psr = D.bytes.psr && D.bytes.psr[i] >= 125 && D.bytes.psr[i] <= 250, iv = D.bytes.ice ? D.bytes.ice[i] : 255;
  return `<div class="v ${go > 0 ? 'go' : 'no'}">${go > 0 ? tx('go') : go < 0 ? tx('nodata') : tx('nogo')}<small>${w ? tx('stay', state.mission) : tx('year')}</small></div>
    <div class="m">${line('sun', tx('sun'), sunV == null ? '–' : Math.round(sunV) + ' %', cr.sun ? '≥' + cr.sun : '')}${line('earth', tx('earth'), earthV == null ? '–' : Math.round(earthV) + ' %', cr.earth ? '≥' + cr.earth : '')}${darkV != null ? line('dark', tx('dark'), Math.round(darkV) + ' h', cr.dark ? '≤' + cr.dark : '') : ''}${line('slope', tx('slope'), v.slope == null ? '–' : v.slope.toFixed(1) + '°', '')}</div>
    <div class="s">${terrainOf(c)}</div>
    <div class="s">${psr ? tx('psr') : `${tx('ice')} <b>${iv <= 250 ? (iv / 10).toFixed(1) + ' km' : '>25 km'}</b>`}</div>`;
}
// ground compared with the 5 km around it (500 m grid): ridge, level ground or crater floor
function terrainOf(c) {
  let sum = 0, n = 0;
  for (let r = Math.max(0, c.row - 5); r <= Math.min(N - 1, c.row + 5); r++) for (let q = Math.max(0, c.col - 5); q <= Math.min(N - 1, c.col + 5); q++) { sum += elev[r * N + q]; n++; }
  const z = elev[c.row * N + c.col], rel = z - sum / n, kind = rel > 120 ? tx('ridge') : rel < -120 ? tx('floor') : tx('level');
  return `${tx('terrain')} <b>${kind}, ${rel >= 0 ? '+' : '−'}${Math.abs(Math.round(rel))} m</b>`;
}
let tipFor = '';
function showTip(c, anchor, ev) {
  const k = c.col + ',' + c.row; if (k !== tipFor) { tipFor = k; tip.innerHTML = tipHtml(c); }
  tip.hidden = false;
  const r = root.getBoundingClientRect();
  let x, y;
  if (ev) { x = ev.clientX - r.left + 16; y = ev.clientY - r.top + 16; }
  else { const b = anchor.getBoundingClientRect(); x = b.left - r.left + 14; y = b.top - r.top + 14; }
  tip.style.left = Math.min(r.width - tip.offsetWidth - 8, x) + 'px'; tip.style.top = Math.min(r.height - tip.offsetHeight - 8, y) + 'px';
}
function hideTip() { tip.hidden = true; tipFor = ''; }

function wire() {
  let down = null, tr = 0;
  cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; fly = null; hideTip(); });
  cv.addEventListener('pointerup', e => {
    if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved < 5) { const c = pick(e.clientX, e.clientY); if (c) { setState({ pin: c, autoPin: false }, 'panel'); flyToCell(c.col, c.row, clamp(cam.position.distanceTo(controls.target), 40, 140)); } }
  });
  cv.addEventListener('pointermove', e => {
    if (e.buttons) { hideTip(); return; }
    cancelAnimationFrame(tr); tr = requestAnimationFrame(() => {
      const c = pick(e.clientX, e.clientY);
      if (!c) { hideTip(); return; }
      showTip(c, null, e);
    });
  });
  cv.addEventListener('pointerleave', hideTip);
  cv.addEventListener('dblclick', e => e.stopPropagation());
  cv.addEventListener('wheel', () => { fly = null; }, { passive: true });
}

function loop(now) {
  raf = 0; if (!on) return;
  if (fly) {
    const u = clamp((now - fly.t0) / fly.dur, 0, 1), k = ease(u);
    cam.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.g0, fly.g1, k); cam.lookAt(controls.target);
    if (u >= 1) fly = null; dirty = true;
  }
  if (controls.update()) dirty = true;
  if (dirty) { dirty = false; renderer.render(scene, cam); placePins(); }
  raf = requestAnimationFrame(loop);
}

// follow the 2D view when something else moves it (region chosen, spot list, ranked spot): fly to its centre
function followView(st) {
  const v = st.view, key = `${v.k.toFixed(2)},${v.cx.toFixed(1)},${v.cy.toFixed(1)}`;
  if (key === lastView) return; const first = !lastView; lastView = key;
  clearTimeout(flyT);
  if (first && v.k <= 1.01) return;
  flyT = setTimeout(() => {
    if (v.k <= 1.01) { home(false); return; }
    flyToCell(Math.round(v.cx - .5), Math.round(v.cy - .5), clamp(400 / v.k, 22, 420));
  }, 140);
}

function sync(st) {
  if (!built) return;
  const ins = insetsNow(); if (ins[0] !== insets[0] || ins[1] !== insets[1]) size();
  const tops = (tripRanked() || []).filter(r => r.go).slice(0, 5).map(r => r.col + ',' + r.row).join(';');
  const key = `${tops}|${st.pin ? st.pin.col + ',' + st.pin.row : ''}|${st.autoPin}|${st.site}`;
  if (key !== lastKey) { lastKey = key; buildPins(); }
  followView(st);
}

export const isOn = () => on;
// called after the 2D composite changes (date, stay, criteria): rebuild the glow texture
let pendingPaint = true;
export function repaint() { if (built && on) { compose(); lastKey = ''; sync(state); } else pendingPaint = true; }
export function render(st) {
  if (!root) return;
  const want = st.d3 !== false;
  const panel = root.parentNode;
  panel.classList.toggle('d3', want);
  panel.querySelectorAll('.lyr-dim button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.d === '1') === want)));
  if (want !== on) {
    on = want; root.hidden = !on;
    if (on) { load().then(() => { if (!built) return; size(); if (pendingPaint) { pendingPaint = false; compose(); } buildPins(); dirty = true; if (!raf) raf = requestAnimationFrame(loop); }); }
    else { cancelAnimationFrame(raf); raf = 0; hideTip(); }
  }
  if (on && built) { if (pendingPaint) { pendingPaint = false; compose(); } sync(st); dirty = true; if (!raf) raf = requestAnimationFrame(loop); }
}
