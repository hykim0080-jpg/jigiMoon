// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Lunar south pole viewer: 3D / 2D terrain with time-varying sunlight and Earth visibility.
//
// Usage (the host page must map the bare specifier "three" to vendor/three.module.js):
//
//   <script type="importmap">{"imports":{"three":"./vendor/three.module.js"}}</script>
//   <script type="module">
//     import { mountLunarMap } from './map3d.js';
//     const map = mountLunarMap(el, { dataUrl: './data/' });
//     // or several periods:
//     // mountLunarMap(el, { datasets: [{ label: '2027-06', url: './frames/' },
//     //                                { label: '2027-12', url: './frames_dec/' }],
//     //                     sitesUrl: './sites.json' });
//   </script>
//
// navigator copy: imports point at ./vendor directly (no importmap) and focus(x_m, y_m, halfKm) was added.
// A dataset folder holds meta.json, height.bin and the frames f_000.png ... either next to
// meta.json or in a frames/ subfolder (detected automatically). Frames may be missing
// (a run still in progress): the nearest loaded frame is shown instead, and while
// meta.status is present and not "complete" the folder is polled for new frames.
//
// Returns { destroy, setFrame, getFrame, play, pause, setMode, setView, setDataset, ready }.

import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { SCALE_FIGS } from '../js/figs.js';

const R_MOON = 1737400; // m
const DEG = Math.PI / 180;
const STYLE_ID = 'lmap-style';
let instances = 0;

const CLASS_COLOR = { none: '#2b3242', sun: '#f0a531', earth: '#74a2f2', both: '#4cbf82' };

// Terrain colours per display mode (display sRGB). none / sun only / Earth only / both.
const PALETTE = {
  both:  { none: [0.080, 0.095, 0.135], sun: [0.74, 0.50, 0.16], earth: [0.17, 0.28, 0.56], both: [0.44, 0.95, 0.62], sunW: 1, earthW: 1 },
  sun:   { none: [0.080, 0.095, 0.135], sun: [0.96, 0.74, 0.34], earth: [0.080, 0.095, 0.135], both: [0.96, 0.74, 0.34], sunW: 1, earthW: 0 },
  earth: { none: [0.080, 0.095, 0.135], sun: [0.080, 0.095, 0.135], earth: [0.38, 0.57, 0.95], both: [0.38, 0.57, 0.95], sunW: 0, earthW: 1 },
};

// style 'glow' (LLSN-like look): grey relief, gold where Sun and Earth are both in view, dim amber for Sun only
const PALETTE_GLOW = {   // shadow is dark, so the moving terminator reads at a glance
  both:  { none: [0.13, 0.135, 0.15], sun: [0.62, 0.42, 0.20], earth: [0.15, 0.17, 0.23], both: [0.92, 0.64, 0.27], sunW: 1, earthW: 1 },
  sun:   { none: [0.13, 0.135, 0.15], sun: [0.90, 0.62, 0.26], earth: [0.13, 0.135, 0.15], both: [0.90, 0.62, 0.26], sunW: 1, earthW: 0 },
  earth: { none: [0.10, 0.10, 0.11], sun: [0.10, 0.10, 0.11], earth: [0.55, 0.66, 0.92], both: [0.62, 0.74, 1.00], sunW: 0, earthW: 1 },
};
const CLASS_COLOR_GLOW = { none: '#16181c', sun: '#b8742a', earth: '#7b8fb3', both: '#f6c35c' };

const CSS = `
.lmap{position:relative;width:100%;height:100%;min-height:240px;overflow:hidden;background:#0f131b;color:#e8eaf0;
  --bg:#0f131b;--surface:#181d28;--ink:#e8eaf0;--muted:#98a1b4;--line:#2b3242;--sun:#f0a531;--earth:#74a2f2;--ok:#4cbf82;
  font:12px/1.3 Inter,"Apple SD Gothic Neo",system-ui,sans-serif;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums;user-select:none;-webkit-user-select:none;outline:none;
  --lmap-mono:Inter,system-ui,sans-serif}
.lmap-mast{position:absolute;left:0;top:0;pointer-events:none;cursor:pointer;z-index:3;display:flex;flex-direction:column;align-items:center;transform-origin:50% 100%}
.lmap-mast i{display:block;width:3px;background:var(--mast,#4fc0c9);box-shadow:0 0 0 1px #0f131b}
.lmap-mast .cmp{position:absolute;bottom:0;left:calc(50% + 4px);display:none;align-items:flex-end}
.lmap-mast .cmp svg{display:block;stroke:none;overflow:visible}
.lmap-mast b{display:block;width:12px;height:12px;border:2px solid var(--mast,#4fc0c9);border-radius:50%;border-bottom-color:transparent;transform:rotate(45deg);margin-bottom:-2px}
.lmap-mast span,.lmap-mast i{pointer-events:auto}.lmap-mast span{font:600 11px/1 Inter,system-ui,sans-serif;color:#fff;background:rgba(15,19,27,.85);border:1px solid var(--mast,#4fc0c9);padding:2px 5px;margin-bottom:3px;white-space:nowrap}
.lmap *,.lmap *::before,.lmap *::after{box-sizing:border-box;font-variant-numeric:tabular-nums!important}
.lmap canvas.lmap-gl{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:crosshair}
.lmap-ov{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.lmap-ov>*{position:absolute;left:0;top:0;will-change:transform;white-space:nowrap}
.lmap-ov>svg.lmap-marks{width:100%;height:100%;overflow:visible}
.lmap-scale{font:11px/1 Inter,system-ui,sans-serif;color:#e8eaf0;text-shadow:0 0 3px #0f131b;display:flex;flex-direction:column;align-items:flex-start;gap:3px}
.lmap-scale i{display:block;height:5px;border:1.5px solid #e8eaf0;border-top:0}
.lmap-site{width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:50%;border:1.5px solid var(--ink);background:var(--line);
  pointer-events:auto;cursor:pointer;box-shadow:0 0 0 1px rgba(15,19,27,.85)}
.lmap-site::after{content:"";position:absolute;inset:-7px;border-radius:50%}
.lmap.glow .lmap-site{border-color:#fff}
.lmap.glow .lmap-site::before{content:"";position:absolute;left:50%;top:100%;width:1px;height:22px;margin-left:-.5px;background:rgba(255,255,255,.72);pointer-events:none}
.lmap.glow .lmap-name{font-size:11.5px;font-weight:500}
.lmap-pin{pointer-events:auto;cursor:pointer;white-space:nowrap}
.lmap-pin i{position:absolute;left:-6px;top:-6px;width:12px;height:12px;transform:rotate(45deg);background:#74a2f2;box-shadow:0 0 0 1.5px #0f131b,0 0 10px rgba(116,162,242,.9)}
.lmap-pin::before{content:"";position:absolute;left:-.5px;top:6px;width:1px;height:24px;background:rgba(116,162,242,.95)}
.lmap-pin span{position:absolute;left:11px;top:-7px;font:700 11.5px/1 Inter,system-ui,sans-serif;color:#9cc0ff;text-shadow:0 0 3px #000,0 0 6px #000}
.lmap-pin.is-pin i{background:#fff;box-shadow:0 0 0 1.5px #0f131b}
.lmap-pin.is-pin::before{background:rgba(255,255,255,.9)}
.lmap-site.is-sel{box-shadow:0 0 0 1px rgba(15,19,27,.85),0 0 0 4px rgba(232,234,240,.28)}
.lmap-name{font-size:11px;color:var(--ink);text-shadow:0 0 3px #0f131b,0 0 3px #0f131b,0 1px 6px #0f131b;letter-spacing:.01em}
.lmap-name.is-sel{font-weight:600}
.lmap-lon{font:10px/1 var(--lmap-mono);color:var(--muted);opacity:.75}
.lmap-lm{font-size:11px;font-weight:500;letter-spacing:.14em;color:rgba(214,220,232,.82);text-shadow:0 0 3px #0f131b,0 0 3px #0f131b,0 1px 6px #0f131b}
.lmap-lm.t1{font-size:12.5px;font-weight:600;color:rgba(232,234,240,.95)}
.lmap-lm.t3{font-size:10.5px;color:rgba(190,198,214,.72)}
.lmap-pt{width:9px;height:9px;margin:-4.5px 0 0 -4.5px;background:linear-gradient(var(--ink),var(--ink)) center/100% 1.5px no-repeat,linear-gradient(var(--ink),var(--ink)) center/1.5px 100% no-repeat;filter:drop-shadow(0 0 2px #0f131b)}
.lmap-ld{width:13px;height:13px;margin:-6.5px 0 0 -6.5px;pointer-events:auto;cursor:default;color:var(--ink);filter:drop-shadow(0 0 1.5px #0f131b) drop-shadow(0 0 1.5px #0f131b)}
.lmap-ld svg{display:block;width:13px;height:13px;overflow:visible}
.lmap-ld::after{content:"";position:absolute;inset:-6px}
.lmap-ldn{font-size:10.5px;color:rgba(232,234,240,.86);text-shadow:0 0 3px #0f131b,0 0 3px #0f131b,0 1px 6px #0f131b}
.lmap-ldn small{font:10px/1 var(--lmap-mono);color:var(--muted);margin-left:5px}
.lmap-site.is-landed{border:0;border-radius:0;background:none!important;box-shadow:none;width:15px;height:15px;margin:-8.5px 0 0 -7.5px;filter:drop-shadow(0 0 1.5px #0f131b)}
.lmap-site.is-landed svg{display:block;width:15px;height:15px;overflow:visible}
.lmap-card{z-index:4;display:grid;gap:5px;min-width:150px;max-width:280px;padding:9px 11px 10px;background:rgba(24,29,40,.95);border:1px solid var(--line);border-radius:0;white-space:normal;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.lmap-card b{font-size:12.5px;font-weight:600}

.lmap-card span{color:var(--muted);font-size:11.5px}
.lmap-card .lmap-rel{color:var(--ink)}
.lmap-card .lmap-mono{font:10.5px/1.3 var(--lmap-mono)}
.lmap-card .lmap-sts{display:flex;gap:12px;margin-top:1px}
.lmap-card .lmap-st{color:var(--ink)}.lmap-card .lmap-st.is-off{color:var(--muted)}
.lmap-read .lmap-rel{font:12px/1 Inter,"Apple SD Gothic Neo",system-ui,sans-serif;color:var(--ink);overflow:hidden;text-overflow:ellipsis}
.lmap[data-lang=en] .lmap-lm{letter-spacing:.06em}
.lmap[data-lang=en] .lmap-compass{font-size:9.5px}
.lmap-compass{all:unset;position:absolute;right:12px;top:62px;z-index:2;width:50px;height:50px;border-radius:50%;background:rgba(24,29,40,.86);border:1px solid var(--line);cursor:pointer;backdrop-filter:blur(6px);display:grid;place-items:center;font-size:10px;font-weight:500;color:var(--earth)}
.lmap-compass:focus-visible{outline:1px solid var(--muted);outline-offset:1px}
.lmap-compass i{position:absolute;inset:0;border-radius:50%}
.lmap-compass i::before{content:"";position:absolute;left:50%;top:9px;width:1.5px;height:8px;margin-left:-.75px;background:var(--earth);opacity:.7}
.lmap-compass i::after{content:"";position:absolute;left:50%;top:-5px;width:11px;height:11px;margin-left:-5.5px;border-radius:50%;background:var(--earth);box-shadow:0 0 0 2px #0f131b}
.lmap-body{display:flex;align-items:center;gap:6px;font:11px/1 var(--lmap-mono);color:var(--ink);text-shadow:0 0 3px #0f131b,0 0 3px #0f131b}
.lmap-body i{width:12px;height:12px;border-radius:50%;flex:none;margin:-6px 0 -6px -6px}
.lmap-body.is-sun i{background:var(--sun);box-shadow:0 0 0 3px rgba(240,165,49,.22)}
.lmap-body.is-earth i{background:var(--earth);box-shadow:0 0 0 3px rgba(116,162,242,.22)}
.lmap-body.is-down i{background:transparent;box-shadow:none;border:1.5px solid currentColor;opacity:.8}
.lmap-body.is-sun{color:var(--sun)}.lmap-body.is-earth{color:var(--earth)}
.lmap-panel{position:absolute;display:flex;align-items:center;gap:10px;z-index:2}
.lmap-tl{left:12px;top:12px}.lmap-tr{right:12px;top:12px}
.lmap-seg{display:flex;background:rgba(24,29,40,.86);border:1px solid var(--line);border-radius:0;padding:2px;backdrop-filter:blur(6px)}
.lmap-seg button{all:unset;display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:0;color:var(--muted);cursor:pointer;font:inherit;font-weight:500;white-space:nowrap}
.lmap-seg button:hover{color:var(--ink)}
.lmap-seg button[aria-pressed="true"]{background:var(--line);color:var(--ink)}
.lmap-seg button:focus-visible,.lmap-btn:focus-visible{outline:1px solid var(--muted);outline-offset:1px}
.lmap-seg button i{width:8px;height:8px;border-radius:50%;flex:none}
.lmap-exag{display:flex;align-items:center;gap:8px;background:rgba(24,29,40,.86);border:1px solid var(--line);border-radius:0;padding:0 10px;height:30px;color:var(--muted);backdrop-filter:blur(6px)}
.lmap-exag output{font:11px/1 var(--lmap-mono);color:var(--ink);min-width:2.4em}
.lmap-exag input{width:72px}
.lmap-bar{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:10px 14px 12px;background:linear-gradient(to top,rgba(15,19,27,.96) 60%,rgba(15,19,27,0));display:grid;gap:8px}
.lmap-row{display:flex;align-items:center;gap:12px;min-width:0}
.lmap-time{font:500 15px/1 var(--lmap-mono);letter-spacing:.01em;white-space:nowrap}
.lmap-time small{font-size:10px;color:var(--muted);margin-left:6px;font-weight:400}
.lmap-read{margin-left:auto;display:flex;align-items:center;gap:12px;min-width:0;font:11px/1 var(--lmap-mono);color:var(--muted);white-space:nowrap;overflow:hidden}
.lmap-read b{font:600 12px/1 Inter,"Apple SD Gothic Neo",system-ui,sans-serif;color:var(--ink);overflow:hidden;text-overflow:ellipsis}
.lmap-st{display:flex;align-items:center;gap:5px;font:11px/1 Inter,"Apple SD Gothic Neo",system-ui,sans-serif;color:var(--ink)}
.lmap-st i{width:9px;height:9px;border-radius:50%;border:1.5px solid currentColor;flex:none}
.lmap-st.is-off{color:var(--muted);opacity:.55}
.lmap-st.is-sun i{color:var(--sun)}.lmap-st.is-earth i{color:var(--earth)}
.lmap-btn{all:unset;width:28px;height:28px;display:grid;place-items:center;border-radius:0;color:var(--ink);cursor:pointer;flex:none}
.lmap-btn:hover{background:var(--line)}
.lmap-btn svg{width:14px;height:14px;fill:currentColor}
.lmap-btn.is-main{background:var(--ink);color:var(--bg);border-radius:50%}
.lmap-btn.is-main:hover{background:#fff}
.lmap-track{position:relative;flex:1;height:28px;min-width:60px}
.lmap-track canvas{position:absolute;left:0;right:0;top:10px;width:100%;height:8px;border-radius:0;image-rendering:pixelated}
.lmap input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;margin:0;cursor:pointer;height:28px}
.lmap-track input{position:absolute;inset:0;width:100%}
.lmap input[type=range]:focus{outline:none}
.lmap input[type=range]::-webkit-slider-runnable-track{height:28px;background:transparent}
.lmap input[type=range]::-moz-range-track{height:28px;background:transparent}
.lmap input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:3px;height:22px;margin-top:3px;border-radius:0;background:var(--ink);box-shadow:0 0 0 2px rgba(15,19,27,.9)}
.lmap input[type=range]::-moz-range-thumb{width:3px;height:22px;border:0;border-radius:0;background:var(--ink);box-shadow:0 0 0 2px rgba(15,19,27,.9)}
.lmap-exag input[type=range]{height:28px;background:linear-gradient(var(--line),var(--line)) center/100% 2px no-repeat}
.lmap-exag input[type=range]::-webkit-slider-thumb{width:10px;height:10px;margin-top:9px;border-radius:50%;box-shadow:none}
.lmap-exag input[type=range]::-moz-range-thumb{width:10px;height:10px;border-radius:50%;box-shadow:none}
.lmap-idx{font:11px/1 var(--lmap-mono);color:var(--muted);white-space:nowrap;min-width:5.2em;text-align:right}
.lmap-msg{position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);pointer-events:none;z-index:3}
.lmap[data-view="2d"] .lmap-exag{display:none}
@media (max-width:640px){.lmap-read .lmap-geo{display:none}.lmap-exag{display:none}}
`;

// UI strings. English by default; { lang: 'ko' } switches to Korean (and to name_ko / text_ko).
const STR = {
  en: {
    sun: 'Sun', earth: 'Earth', both: 'Both', sunBody: 'Sun', height: 'Height',
    prev: 'Previous', play: 'Play', pause: 'Pause', next: 'Next', time: 'Time', earthUp: 'Earth direction up',
    approx: 'approx. position', noWebgl: 'WebGL is not available', noData: 'Could not load the data',
    sectors: ['toward Earth', 'toward Earth, right', 'right', 'away from Earth, right', 'away from Earth', 'away from Earth, left', 'left', 'toward Earth, left'],
    relIn: (name, sector, d) => `inside ${name}, ${d} km ${sector} of centre`,
    relOut: (name, sector, d) => `${d} km ${sector} of ${name}`,
  },
  ko: {
    sun: '햇빛', earth: '지구', both: '둘 다', sunBody: '태양', height: '높이',
    prev: '이전', play: '재생', pause: '정지', next: '다음', time: '시간', earthUp: '지구 방향을 위로',
    approx: '위치 근사', noWebgl: 'WebGL을 사용할 수 없습니다', noData: '데이터를 불러올 수 없습니다',
    sectors: ['지구 쪽', '지구 쪽 오른편', '오른쪽', '지구 반대쪽 오른편', '지구 반대쪽', '지구 반대쪽 왼편', '왼쪽', '지구 쪽 왼편'],
    relIn: (name, sector, d) => `${name} 안, 중심에서 ${sector} ${d} km`,
    relOut: (name, sector, d) => `${name}에서 ${sector}으로 ${d} km`,
  },
};

const ICON = {
  play: '<svg viewBox="0 0 14 14"><path d="M3.5 1.6v10.8L12.2 7z"/></svg>',
  pause: '<svg viewBox="0 0 14 14"><path d="M3 2h3v10H3zM8 2h3v10H8z"/></svg>',
  prev: '<svg viewBox="0 0 14 14"><path d="M2 2h2v10H2zM12 2v10L5 7z"/></svg>',
  next: '<svg viewBox="0 0 14 14"><path d="M10 2h2v10h-2zM2 2v10l7-5z"/></svg>',
};

const VERT = /* glsl */`
attribute float aH;
uniform float uExag, uCurv, uRef;
varying vec2 vMap;
void main() {
  vMap = vec2(position.x, -position.z);
  // style 'glow': relief around the edge level uRef, eased flat near the rim, on the Moon's curvature
  // the patch edge is a rounded square (p = 4), so spots near the ±200 km corners keep their ground
  float r = length(position.xz), e = pow(pow(abs(position.x), 4.0) + pow(abs(position.z), 4.0), 0.25);
  float y = mix(aH * uExag, (aH - uRef) * uExag * (1.0 - smoothstep(190.0, 200.0, e)) - r * r / 3474.8 + 0.3 * smoothstep(184.0, 192.0, e), uCurv);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, y, position.z, 1.0);
}`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D uA, uB, uGrad;
uniform float uMix, uHasFrame, uSunW, uEarthW;
uniform vec2 uUvS, uUvO;
uniform vec3 cNone, cSun, cEarth, cBoth;
uniform vec3 uSunDir;      // map x, map y, up (unit); z < 0 when unknown
uniform sampler2D uPsr;    // permanent shadow, 800 x 800 over +-200 km (style 'glow')
uniform float uPsrOn, uGlowOn, uCurv, uMaskOn;
uniform sampler2D uMask, uHalo;   // GO mask from the host (Find a site): r = GO, g = sunlight level, a = has data
uniform vec4 uRims[32];    // named craters: centre x, y, radius (km), strength
uniform int uRimN;
varying vec2 vMap;         // km

float edge(float g) {
  float w = clamp(fwidth(g) * 0.75, 0.01, 0.5);
  return smoothstep(0.5 - w, 0.5 + w, g);
}

void main() {
  vec2 uv = vMap * uUvS + uUvO;
  vec2 g = texture2D(uGrad, uv).rg * 2.2;             // exaggerated for shading only
  vec3 n = normalize(vec3(-g.x, -g.y, 1.0));

  vec3 La = normalize(vec3(-0.55, 0.55, 0.62));       // cartographic upper-left light
  float amb = 0.5 + 1.15 * (dot(n, La) - La.z);
  vec3 Ls = uSunDir.z < 0.0 ? La : uSunDir;
  float lit = clamp(0.66 + 1.0 * (dot(n, Ls) - Ls.z), 0.22, 1.25);
  float dim = 0.55 + 0.9 * clamp(amb, 0.0, 1.2);

  vec4 a = texture2D(uA, uv), b = texture2D(uB, uv);
  float s = mix(a.r, b.r, uMix) * uSunW * uHasFrame;
  float e = mix(edge(a.g), edge(b.g), uMix) * uEarthW * uHasFrame;

  vec3 col = mix(mix(cNone, cEarth, e) * dim, mix(cSun, cBoth, e) * mix(dim, lit, uSunW), s);

  col *= mix(1.0, 0.42 + 0.78 * clamp(amb, 0.0, 1.3), uGlowOn);   // glow style: stronger relief, LLSN-like
  if (uMaskOn > 0.5) {   // GO for the chosen day and stay (host mask): blue fill, thin bright outline
    vec2 mu = vec2((vMap.x + 200.0) / 400.0, (200.0 - vMap.y) / 400.0);
    float go = texture2D(uMask, mu).r;
    float w = max(fwidth(go), 1e-4);
    float outline = 1.0 - smoothstep(0.0, 1.6 * w, abs(go - 0.5));
    col = mix(col, vec3(0.455, 0.635, 0.949), smoothstep(0.35, 0.65, go) * 0.42);
    col = mix(col, vec3(0.70, 0.82, 1.0), outline * 0.95);
  }
  if (uPsrOn > 0.5) {
    float ps = texture2D(uPsr, vec2((vMap.x + 200.0) / 400.0, (200.0 - vMap.y) / 400.0)).r;
    col = mix(col, col * 0.55 + vec3(0.035, 0.075, 0.17), ps * 0.8);
  }

  // graticule: latitude every 2 deg, longitude every 30 deg
  float px = length(fwidth(vMap)) * 0.75 + 1e-5;      // km per pixel
  float rho = length(vMap);
  float lat = 2.0 * atan(rho / (2.0 * 1737.4)) * 57.29578;       // deg from pole
  float dLat = abs(fract(lat / 2.0 + 0.5) - 0.5) * 2.0 * 30.323; // km to nearest circle
  float lon = atan(vMap.x, vMap.y) * 57.29578;
  float dLon = abs(fract(lon / 30.0 + 0.5) - 0.5) * 30.0 * 0.0174533 * rho;
  float line = max(1.0 - smoothstep(0.0, 1.4, dLat / px), (1.0 - smoothstep(0.0, 1.4, dLon / px)) * smoothstep(6.0, 14.0, rho));
  col = mix(col, vec3(0.80, 0.84, 0.92), 0.11 * line);

  // rims of named craters
  float rim = 0.0;
  for (int i = 0; i < 32; i++) {
    if (i >= uRimN) break;
    vec4 c = uRims[i];
    rim = max(rim, (1.0 - smoothstep(0.5, 1.7, abs(length(vMap - c.xy) - c.z) / px)) * c.w);
  }
  col = mix(col, vec3(0.97, 0.95, 0.90), rim);

  gl_FragColor = vec4(col, mix(1.0, 1.0 - smoothstep(192.0, 200.0, pow(pow(abs(vMap.x), 4.0) + pow(abs(vMap.y), 4.0), 0.25)), uCurv));
}`;

const SKIRT_VERT = /* glsl */`
attribute float aH;
attribute float aB;
uniform float uExag, uBase;
varying float vB;
void main() {
  vB = aB;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, mix(aH, uBase, aB) * uExag, position.z, 1.0);
}`;
const SKIRT_FRAG = /* glsl */`
precision highp float;
varying float vB;
void main() { gl_FragColor = vec4(mix(vec3(0.105, 0.125, 0.17), vec3(0.06, 0.075, 0.105), vB), 1.0); }`;

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
const pad = (n, w = 2) => String(n).padStart(w, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dirUrl = (u) => (u.endsWith('/') ? u : u + '/');

function fmtTime(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function lerpAngle(a, b, f) {
  const d = ((b - a + 540) % 360) - 180;
  return a + d * f;
}


// Fallback when .bin cannot be served: height.png RGB, v = R*256 + G, height_m = v/2 - 20000 (0.5 m steps).
async function loadHeightPng(fetchOk, url, nx, ny) {
  const blob = await fetchOk(url).then((r) => r.blob());
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas'); c.width = nx; c.height = ny;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  const px = g.getImageData(0, 0, nx, ny).data;
  const out = new Float32Array(nx * ny);
  for (let i = 0; i < out.length; i++) out[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 2 - 20000;
  return out.buffer;
}

export function mountLunarMap(container, options = {}) {
  if (!container) throw new Error('mountLunarMap: container is required');
  const opt = { mode: 'both', view: '3d', exaggeration: 3, frame: 0, lang: 'en', ...options };
  const ko = opt.lang === 'ko';
  const T = STR[ko ? 'ko' : 'en'];
  const dsDefs = (opt.datasets && opt.datasets.length)
    ? opt.datasets.map((d) => ({ label: d.label ?? '', url: dirUrl(d.url), frames: d.frames }))
    : [{ label: '', url: dirUrl(opt.dataUrl ?? './data/'), probe: ['frames/', ''] }];
  const sitesUrl = opt.sitesUrl ?? dsDefs[0].url + 'sites.json';
  const landmarksUrl = opt.landmarksUrl ?? './orientation/landmarks.json';
  const landersUrl = opt.landersUrl ?? './orientation/landers.json';

  if (!document.getElementById(STYLE_ID)) {
    const st = el('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  instances++;

  // ---------------------------------------------------------------- DOM
  const root = el('div', 'lmap');
  root.tabIndex = 0;
  root.dataset.view = opt.view;
  root.dataset.lang = ko ? 'ko' : 'en';
  const canvas = el('canvas', 'lmap-gl');
  const ov = el('div', 'lmap-ov');
  let pins = [];   // host pins (navigator: best GO spots, the clicked spot): [{ x, y, label, kind, id }]
  const marksSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  marksSvg.setAttribute('class', 'lmap-marks');
  const msg = el('div', 'lmap-msg');

  const segMode = el('div', 'lmap-seg');
  const modeBtns = {};
  const CC = opt.style === 'glow' ? CLASS_COLOR_GLOW : CLASS_COLOR;
  for (const [k, label, c] of [['sun', T.sun, CC.sun], ['earth', T.earth, CC.earth], ['both', T.both, CC.both]]) {
    const b = el('button', '', `<i style="background:${c}"></i>${label}`);
    b.type = 'button';
    b.onclick = () => setMode(k);
    modeBtns[k] = b;
    segMode.appendChild(b);
  }
  const tl = el('div', 'lmap-panel lmap-tl');
  tl.appendChild(segMode);

  const segView = el('div', 'lmap-seg');
  const viewBtns = {};
  for (const k of ['3d', '2d']) {
    const b = el('button', '', k.toUpperCase());
    b.type = 'button';
    b.onclick = () => setView(k);
    viewBtns[k] = b;
    segView.appendChild(b);
  }
  const exag = el('label', 'lmap-exag', `${T.height}<input type="range" min="1" max="8" step="0.5"><output></output>`);
  const exagIn = exag.querySelector('input');
  const exagOut = exag.querySelector('output');
  const tr = el('div', 'lmap-panel lmap-tr');
  tr.append(exag, segView);

  const bar = el('div', 'lmap-bar');
  const row1 = el('div', 'lmap-row');
  const timeEl = el('div', 'lmap-time');
  const segDs = el('div', 'lmap-seg');
  const readEl = el('div', 'lmap-read');
  row1.append(timeEl);
  if (dsDefs.length > 1) row1.append(segDs);
  row1.append(readEl);
  const row2 = el('div', 'lmap-row');
  const mkBtn = (icon, title, cls = '') => {
    const b = el('button', 'lmap-btn ' + cls, ICON[icon]);
    b.type = 'button';
    b.setAttribute('aria-label', title);
    return b;
  };
  const bPrev = mkBtn('prev', T.prev);
  const bPlay = mkBtn('play', T.play, 'is-main');
  const bNext = mkBtn('next', T.next);
  const track = el('div', 'lmap-track');
  const strip = el('canvas');
  strip.height = 1;
  const slider = el('input');
  slider.type = 'range';
  slider.min = 0; slider.max = 1; slider.step = 0.01; slider.value = 0;
  slider.setAttribute('aria-label', T.time);
  track.append(strip, slider);
  const idxEl = el('div', 'lmap-idx');
  row2.append(bPrev, bPlay, bNext, track, idxEl);
  bar.append(row1, row2);

  // which way Earth (map +y, lon 0) lies on screen; click = Earth up again
  const compass = el('button', 'lmap-compass', `<i></i>${T.earth}`);
  compass.type = 'button';
  compass.setAttribute('aria-label', T.earthUp);
  const compassNeedle = compass.firstChild;
  const card = el('div', 'lmap-card');
  card.style.display = 'none';
  ov.appendChild(card);

  root.append(canvas, ov, tl, tr, compass, bar, msg);
  container.appendChild(root);

  // ---------------------------------------------------------------- state
  const abort = new AbortController();
  let destroyed = false;
  let raf = 0;
  let dirty = true;
  let mode = PALETTE[opt.mode] ? opt.mode : 'both';
  let view = opt.view === '2d' ? '2d' : '3d';
  let exagV = clamp(+opt.exaggeration || 3, 1, 8);
  let t = +opt.frame || 0;            // fractional frame index
  let playing = false;
  let lastTs = 0;
  let grid = null;                    // {nx, ny, res, x0, y1, half (km), flipY}
  let heights = null;                 // Float32Array, metres
  let hMin = 0, hMax = 0;
  let sites = [];
  let landmarks = [], landers = [];
  let scaleEl = null, mastPt = null, mastEl = null, marks = [];   // marks: lines on the ground from the host (MOVE, blocked Sun/Earth)   // MAST fix: a pole of h metres at a map point, drawn on the overlay
  let hoverSite = null, selSite = null, hoverPt = null, hoverLander = null, hoverLm = null;
  let pointer = null;                 // last pointer position over the canvas (client px)
  let tween = null;
  let stripDirty = true;
  let W = 1, H = 1;

  const datasets = dsDefs.map((d) => ({ ...d, meta: null, n: 0, times: [], frames: [], loaded: 0, layout: d.frames ?? null, started: false, poll: 0 }));
  let ds = datasets[0];

  // ---------------------------------------------------------------- three
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    msg.textContent = T.noWebgl;
    return { destroy() { root.remove(); }, setFrame() {}, ready: Promise.reject(e) };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const glow = opt.style === 'glow';
  renderer.setClearColor(glow ? 0x000000 : 0x0f131b, 1);
  const scene = new THREE.Scene();
  if (glow) {
    root.classList.add('glow');
    // stars (fixed seed), drawn first, far behind everything
    let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const NS = 5000, sp = new Float32Array(NS * 3), ss = new Float32Array(NS), sc = new Float32Array(NS * 3);
    for (let i = 0; i < NS; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      sp.set([Math.cos(a) * r * 5000, u * 5000, Math.sin(a) * r * 5000], i * 3);
      ss[i] = 0.6 + Math.pow(rnd(), 6) * 2.6;
      const q = rnd(); sc.set(q < .15 ? [1, .85, .7] : q < .3 ? [.75, .85, 1] : [1, 1, 1], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('size', new THREE.BufferAttribute(ss, 1)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    const stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { pr: { value: renderer.getPixelRatio() } },
      vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vC; varying float vA; uniform float pr; void main(){ vC = color; vA = clamp(size / 3.2, .18, 1.); gl_PointSize = size * pr; vec4 p = modelViewMatrix * vec4(position, 0.); p.w = 1.; gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * .9999; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vC, smoothstep(.5, .0, d) * vA * .8); }',
    }));
    stars.renderOrder = -10; stars.frustumCulled = false; scene.add(stars);
  }

  // ---------------------------------------------------------------- the whole Moon and the sky
  // The terrain patch (±200 km around the south pole) sits on a Moon globe (R = 1737.4 km), south pole up,
  // lon 0 (Earth side) toward -z like the map. Sun and Earth are drawn in the background in their real
  // directions from the pole (azimuth, elevation from the frame metadata); sizes are enlarged to be seen.
  const R_MOON = 1737.4;
  const moonGroup = new THREE.Group();
  const moonMat = new THREE.MeshBasicMaterial({ color: 0x3a3e46 });   // dark, so the lit south-pole patch stands out
  if (opt.moonUrl) new THREE.TextureLoader().load(opt.moonUrl, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; moonMat.map = tx; moonMat.color.set(0x474b54); moonMat.needsUpdate = true; dirty = true; });
  // glow: the globe has an opening under the curved patch (6 deg = 182 km around the pole), so the patch's craters show
  const moonGeo = opt.style === 'glow' ? new THREE.SphereGeometry(R_MOON, 256, 160) : new THREE.SphereGeometry(R_MOON, 160, 80);
  if (opt.style === 'glow') moonMat.onBeforeCompile = (sh) => {   // a rounded-square hole under the terrain patch (same shape as its edge)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <project_vertex>', '#include <project_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('void main() {', 'void main() {\nif (vW.y > -2000.0 && pow(pow(abs(vW.x), 4.0) + pow(abs(vW.z), 4.0), 0.25) < 196.0) discard;');
  };
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.rotation.x = Math.PI;          // south pole to +y
  moonGroup.rotation.y = Math.PI / 2;     // lon 0 to -z, lon 90E to +x
  moonGroup.add(moonMesh);
  moonGroup.visible = false;
  scene.add(moonGroup);
  const glowTex = (inner, outer, disc) => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(disc, inner); gr.addColorStop(disc + 0.04, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  };
  const earthTex = () => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const halo = g.createRadialGradient(64, 64, 34, 64, 64, 64); halo.addColorStop(0, 'rgba(116,162,242,.55)'); halo.addColorStop(1, 'rgba(116,162,242,0)');
    g.fillStyle = halo; g.fillRect(0, 0, 128, 128);
    const d = g.createRadialGradient(52, 50, 4, 64, 64, 36); d.addColorStop(0, '#9cc3ff'); d.addColorStop(.6, '#2f6fd6'); d.addColorStop(1, '#173d82');
    g.fillStyle = d; g.beginPath(); g.arc(64, 64, 36, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)';   // a few cloud bands
    for (const [x, y, w, h] of [[44, 50, 30, 5], [60, 68, 34, 6], [40, 80, 22, 4]]) { g.beginPath(); g.ellipse(x + w / 2, y, w / 2, h / 2, -.3, 0, 7); g.fill(); }
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  };
  // Sun: NASA/SDO HMI continuum disc with a glow (sprite, constant screen size).
  // Earth: a globe with the NASA Blue Marble texture, lit from the Sun's direction so its phase is right.
  const sunMat = new THREE.SpriteMaterial({ map: glowTex('#fff8e0', 'rgba(255,190,80,.35)', 0.22), sizeAttenuation: false, depthWrite: false, transparent: true });
  if (opt.sunUrl) new THREE.TextureLoader().load(opt.sunUrl, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; sunMat.map = tx; sunMat.needsUpdate = true; dirty = true; });
  const earthMat = new THREE.MeshLambertMaterial({ map: earthTex(), color: 0xffffff });
  if (opt.earthUrl) new THREE.TextureLoader().load(opt.earthUrl, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; earthMat.map = tx; earthMat.needsUpdate = true; dirty = true; });
  const SKY_D0 = 3400, EARTH_R = SKY_D0 * Math.tan(3.5 * DEG);   // drawn about 7 times its real size
  const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 48, 24), earthMat);
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
  scene.add(sunLight, sunLight.target, new THREE.AmbientLight(0x223044, 0.35));
  const sky = {
    sun: new THREE.Sprite(sunMat),
    earth: earthMesh,
  };
  sky.sun.scale.set(0.2, 0.2, 1);
  for (const k in sky) { sky[k].visible = false; sky[k].renderOrder = -1; scene.add(sky[k]); }
  const SKY_D = 3400;
  function placeSky(tt) {
    for (const k of ['sun', 'earth']) {
      const b = bodyAt(`${k}_az_el_at_pole`, tt), sp = sky[k];
      if (!b) { sp.visible = false; continue; }
      const a = b.az * DEG, e = b.el * DEG;
      sp.position.set(Math.sin(a) * Math.cos(e) * SKY_D, Math.sin(e) * SKY_D, -Math.cos(a) * Math.cos(e) * SKY_D);
      sp.visible = true;
      if (k === 'sun') { sunLight.position.copy(sp.position); sunLight.target.position.copy(earthMesh.position); }
    }
    earthMesh.lookAt(0, 0, 0);
  }
  function placeMoon() {
    if (!Number.isFinite(hMin)) return;
    // globe top just under the lowest terrain, so the patch sits on it and nothing pokes through
    const top = glow ? 0 : (hMin / 1000 - 1.5) * exagV + 4;
    moonGroup.position.set(0, top - R_MOON, 0);
    moonGroup.visible = true;
  }

  const FOV = 30;
  const cam3 = new THREE.PerspectiveCamera(FOV, 1, 5, 6000);
  const cam2 = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
  cam2.up.set(0, 0, -1); // map +y (lon 0) up on screen
  let camera = cam3;

  const ctl3 = new OrbitControls(cam3, canvas);
  ctl3.enableDamping = true;
  ctl3.dampingFactor = 0.12;
  ctl3.maxPolarAngle = 88 * DEG;
  ctl3.minDistance = 0.15;   // down to a few hundred metres across: the hillshade patches carry the detail there
  ctl3.maxDistance = 2500;
  ctl3.zoomToCursor = true;
  const ctl2 = new OrbitControls(cam2, canvas);
  ctl2.enableRotate = false;
  ctl2.enableDamping = true;
  ctl2.dampingFactor = 0.2;
  ctl2.zoomToCursor = true;
  ctl2.minZoom = 0.6;
  ctl2.maxZoom = 40;
  ctl2.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  ctl2.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  ctl2.enabled = false;
  let camT = 0;
  ctl3.addEventListener('change', () => {
    dirty = true;
    if (opt.onCamera && !tween) { clearTimeout(camT); camT = setTimeout(() => opt.onCamera(getCam()), 250); }
  });
  function getCam() {
    const s = new THREE.Spherical().setFromVector3(cam3.position.clone().sub(ctl3.target));
    return { x_m: Math.round(ctl3.target.x * 1000), y_m: Math.round(-ctl3.target.z * 1000), r: +s.radius.toFixed(3), polar: +s.phi.toFixed(4), az: +s.theta.toFixed(4) };
  }
  function setCam(c) {
    if (!c || !Number.isFinite(c.r)) return;
    if (tween) { const d = tween.done; tween = null; d(true); }
    let y = 0; try { y = yAt(c.x_m, c.y_m); if (!Number.isFinite(y)) y = 0; } catch (e) { y = 0; }
    ctl3.target.set(c.x_m / 1000, y, -c.y_m / 1000);
    sph(ctl3.target, clamp(c.r, ctl3.minDistance, ctl3.maxDistance), clamp(c.polar, 0.0005, ctl3.maxPolarAngle), c.az || 0, cam3.position);
    cam3.up.set(0, 1, 0); cam3.lookAt(ctl3.target); ctl3.update(); dirty = true;
  }
  ctl2.addEventListener('change', () => { dirty = true; });

  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const uniforms = {
    uA: { value: blank }, uB: { value: blank }, uGrad: { value: blank },
    uMix: { value: 0 }, uHasFrame: { value: 0 }, uSunW: { value: 1 }, uEarthW: { value: 1 },
    uUvS: { value: new THREE.Vector2(1, 1) }, uUvO: { value: new THREE.Vector2(0, 0) },
    cNone: { value: new THREE.Vector3() }, cSun: { value: new THREE.Vector3() },
    cEarth: { value: new THREE.Vector3() }, cBoth: { value: new THREE.Vector3() },
    uSunDir: { value: new THREE.Vector3(0, 0, -1) },
    uExag: { value: exagV }, uBase: { value: -8 },
    uRims: { value: Array.from({ length: 32 }, () => new THREE.Vector4()) }, uRimN: { value: 0 },
    uPsr: { value: blank }, uPsrOn: { value: 0 }, uGlowOn: { value: opt.style === 'glow' ? 1 : 0 },
    uCurv: { value: opt.style === 'glow' ? 1 : 0 }, uRef: { value: 0 }, uMaskOn: { value: 0 }, uMask: { value: blank }, uHalo: { value: blank },
  };
  const terrainMat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: glow });
  if (glow && opt.psrUrl) fetch(opt.psrUrl).then(r => r.ok ? r.arrayBuffer() : null).then(b => {
    if (!b || b.byteLength !== 640000) return;
    const a = new Uint8Array(b), m = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) m[i] = a[i] >= 125 && a[i] <= 250 ? 255 : 0;
    const tx = new THREE.DataTexture(m, 800, 800, THREE.RedFormat); tx.magFilter = tx.minFilter = THREE.LinearFilter; tx.needsUpdate = true;
    uniforms.uPsr.value = tx; uniforms.uPsrOn.value = 1; dirty = true;
  }).catch(() => {});
  const skirtMat = new THREE.ShaderMaterial({ uniforms, vertexShader: SKIRT_VERT, fragmentShader: SKIRT_FRAG, side: THREE.DoubleSide });
  const slots = [{ tex: null, ds: null, frame: -1 }, { tex: null, ds: null, frame: -1 }];
  const disposables = [blank, terrainMat, skirtMat];

  // ---------------------------------------------------------------- geometry helpers
  const heightAt = (xm, ym) => {
    const { nx, ny, res, x0, y1, y0, flipY } = grid;
    const fc = clamp((xm - x0) / res - 0.5, 0, nx - 1);
    const fr = clamp((flipY ? (y1 - ym) : (ym - y0)) / res - 0.5, 0, ny - 1);
    const c0 = Math.floor(fc), r0 = Math.floor(fr);
    const c1 = Math.min(c0 + 1, nx - 1), r1 = Math.min(r0 + 1, ny - 1);
    const u = fc - c0, v = fr - r0;
    return (heights[r0 * nx + c0] * (1 - u) + heights[r0 * nx + c1] * u) * (1 - v)
         + (heights[r1 * nx + c0] * (1 - u) + heights[r1 * nx + c1] * u) * v;
  };
  const pixelIndex = (xm, ym) => {
    const { nx, ny, res, x0, y1, y0, flipY } = grid;
    const c = Math.floor((xm - x0) / res), r = Math.floor((flipY ? (y1 - ym) : (ym - y0)) / res);
    if (c < 0 || r < 0 || c >= nx || r >= ny) return -1;
    return r * nx + c;
  };

  // ---------------------------------------------------------------- close-up patches
  // Hillshade images (PGDA 5 m / 20 m) laid on the terrain around the selected spot; they fade in when the
  // camera comes within ~12 km, where the 500 m lighting grid is only blocks. Heights follow the same grid.
  let detail = [];
  const texLoader = new THREE.TextureLoader();
  function clearDetail() { for (const d of detail) { scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.map?.dispose(); d.mesh.material.dispose(); } detail = []; }
  function addDetail({ x0, y0, x1, y1, url }) {
    const n = 96, pos = new Float32Array((n + 1) * (n + 1) * 3), uv = new Float32Array((n + 1) * (n + 1) * 2), idx = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i, xm = x0 + (x1 - x0) * i / n, ym = y0 + (y1 - y0) * j / n;
      pos[k * 3] = xm / 1000; pos[k * 3 + 1] = yAt(xm, ym) / exagV; pos[k * 3 + 2] = -ym / 1000;
      uv[k * 2] = i / n; uv[k * 2 + 1] = j / n;
      if (i < n && j < n) idx.push(k, k + 1, k + n + 1, k + 1, k + n + 2, k + n + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false; mesh.renderOrder = 2; mesh.frustumCulled = false;
    scene.add(mesh);
    const d = { mesh, ready: false };
    detail.push(d);
    texLoader.load(url, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; mat.map = tx; mat.needsUpdate = true; d.ready = true; dirty = true; }, undefined, () => {});
  }

  // cells painted on the ground (navigator: the 3 km MOVE grid, GO cells blue): [{ x, y, half (m), rgb: [r,g,b], a }]
  let cellMesh = null;
  const tmpC = new THREE.Color();
  function setCells(list) {
    if (cellMesh) { scene.remove(cellMesh); cellMesh.geometry.dispose(); cellMesh.material.dispose(); cellMesh = null; }
    if (!list || !list.length || !grid) { dirty = true; return; }
    const pos = new Float32Array(list.length * 12), col = new Float32Array(list.length * 16), idx = [];
    list.forEach((c, q) => {
      const g = c.half * 0.92, corners = [[-g, -g], [g, -g], [g, g], [-g, g]];
      corners.forEach(([ox, oy], k) => {
        const xm = c.x + ox, ym = c.y + oy, o = q * 4 + k;
        pos[o * 3] = xm / 1000; pos[o * 3 + 1] = yAt(xm, ym) / exagV; pos[o * 3 + 2] = -ym / 1000;
        tmpC.setRGB(c.rgb[0], c.rgb[1], c.rgb[2], THREE.SRGBColorSpace);   // given as sRGB, like CSS
        col.set([tmpC.r, tmpC.g, tmpC.b, c.a], o * 4);
      });
      const b = q * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geo.setIndex(idx);
    cellMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }));
    cellMesh.renderOrder = 3; cellMesh.frustumCulled = false; cellMesh.scale.y = exagV;
    scene.add(cellMesh); dirty = true;
  }
  function syncDetail() {
    const dist = camera === cam3 ? cam3.position.distanceTo(ctl3.target) : 1e9;
    const a = clamp((14 - dist) / 8, 0, 1) * 0.92;
    if (cellMesh) cellMesh.scale.y = exagV;
    for (const d of detail) { d.mesh.scale.y = exagV; d.mesh.visible = d.ready && a > 0; d.mesh.material.opacity = a; }
    // near plane follows the camera in, so a close look does not clip the ground
    const near = clamp(dist * 0.02, 0.0005, 5);
    if (camera === cam3 && Math.abs(cam3.near - near) > near * 0.2) { cam3.near = near; cam3.updateProjectionMatrix(); }
  }

  // scene height of a map point (km); style 'glow' bends the terrain onto the Moon's curvature (same as VERT)
  const yAt = (xm, ym) => {
    const h = heightAt(xm, ym) / 1000;
    if (!glow) return h * exagV;
    const r = Math.hypot(xm, ym) / 1000, e = ((Math.abs(xm / 1000) ** 4 + Math.abs(ym / 1000) ** 4) ** 0.25), ss = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
    return (h - uniforms.uRef.value) * exagV * (1 - ss(190, 200, e)) - r * r / 3474.8 + 0.3 * ss(184, 192, e);
  };
  const worldOf = (xm, ym, out) => out.set(xm / 1000, yAt(xm, ym), -ym / 1000);

  function buildTerrain() {
    const { nx, ny, res, x0, y1, y0, flipY, half } = grid;
    const step = Math.max(1, Math.ceil(Math.max(nx, ny) / 400));
    const mx = Math.floor(nx / step), my = Math.floor(ny / step);
    const vx = mx + 1, vy = my + 1;
    const pos = new Float32Array(vx * vy * 3);
    const hh = new Float32Array(vx * vy);
    const hPix = (r, c) => heights[clamp(r, 0, ny - 1) * nx + clamp(c, 0, nx - 1)];
    for (let j = 0; j < vy; j++) {
      for (let i = 0; i < vx; i++) {
        const c = i * step, r = j * step; // pixel-corner indices
        const xm = x0 + c * res;
        const ym = flipY ? y1 - r * res : y0 + r * res;
        const k = j * vx + i;
        pos[k * 3] = xm / 1000;
        pos[k * 3 + 2] = -ym / 1000;
        hh[k] = (hPix(r - 1, c - 1) + hPix(r - 1, c) + hPix(r, c - 1) + hPix(r, c)) / 4000;
      }
    }
    const idx = new Uint32Array(mx * my * 6);
    let p = 0;
    for (let j = 0; j < my; j++) {
      for (let i = 0; i < mx; i++) {
        const a = j * vx + i, b = a + 1, c = a + vx, d = c + 1;
        if (flipY) { idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d; }
        else { idx[p++] = a; idx[p++] = b; idx[p++] = c; idx[p++] = b; idx[p++] = d; idx[p++] = c; }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aH', new THREE.BufferAttribute(hh, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mesh = new THREE.Mesh(geo, terrainMat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    disposables.push(geo);

    // side walls down to a common base, so the terrain reads as a solid block
    const ring = [];
    for (let i = 0; i < vx; i++) ring.push(i);
    for (let j = 1; j < vy; j++) ring.push(j * vx + vx - 1);
    for (let i = vx - 2; i >= 0; i--) ring.push((vy - 1) * vx + i);
    for (let j = vy - 2; j >= 0; j--) ring.push(j * vx);
    const m = ring.length;
    const sp = new Float32Array(m * 6), sh = new Float32Array(m * 2), sb = new Float32Array(m * 2);
    ring.forEach((k, q) => {
      for (let w = 0; w < 2; w++) {
        const o = q * 2 + w;
        sp[o * 3] = pos[k * 3]; sp[o * 3 + 2] = pos[k * 3 + 2];
        sh[o] = hh[k]; sb[o] = w;
      }
    });
    const si = new Uint32Array((m - 1) * 6);
    for (let q = 0, o = 0; q < m - 1; q++) {
      const a = q * 2, b = a + 1, c = a + 2, d = a + 3;
      si[o++] = a; si[o++] = b; si[o++] = c; si[o++] = c; si[o++] = b; si[o++] = d;
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sgeo.setAttribute('aH', new THREE.BufferAttribute(sh, 1));
    sgeo.setAttribute('aB', new THREE.BufferAttribute(sb, 1));
    sgeo.setIndex(new THREE.BufferAttribute(si, 1));
    const skirt = new THREE.Mesh(sgeo, skirtMat);
    skirt.frustumCulled = false;
    if (glow) {
      skirt.visible = false;
      // the level where the patch meets the globe: median height on the 190 km ring
      const ringH = []; for (let a = 0; a < 720; a++) { const q = a / 720 * Math.PI * 2, v = heightAt(Math.sin(q) * 190000, Math.cos(q) * 190000); if (Number.isFinite(v)) ringH.push(v); }
      ringH.sort((a, b) => a - b); uniforms.uRef.value = ringH.length ? ringH[ringH.length >> 1] / 1000 : 0;
    }
    scene.add(skirt);
    disposables.push(sgeo);
    uniforms.uBase.value = hMin / 1000 - 1.5;
    placeMoon();

    // slope texture (dh/dx, dh/dy in map axes) for per-pixel relief shading at full resolution
    const gr = new Uint16Array(nx * ny * 2);
    const sy = flipY ? -1 : 1;
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        const gx = (hPix(r, c + 1) - hPix(r, c - 1)) / (2 * res);
        const gy = sy * (hPix(r + 1, c) - hPix(r - 1, c)) / (2 * res);
        const o = (r * nx + c) * 2;
        gr[o] = THREE.DataUtils.toHalfFloat(clamp(gx, -8, 8));
        gr[o + 1] = THREE.DataUtils.toHalfFloat(clamp(gy, -8, 8));
      }
    }
    const gtex = new THREE.DataTexture(gr, nx, ny, THREE.RGFormat, THREE.HalfFloatType);
    gtex.minFilter = gtex.magFilter = THREE.LinearFilter;
    gtex.unpackAlignment = 1;
    gtex.needsUpdate = true;
    uniforms.uGrad.value = gtex;
    disposables.push(gtex);

    const wKm = nx * res / 1000, hKm = ny * res / 1000;
    uniforms.uUvS.value.set(1 / wKm, (flipY ? -1 : 1) / hKm);
    uniforms.uUvO.value.set(-x0 / 1000 / wKm, flipY ? y1 / 1000 / hKm : -y0 / 1000 / hKm);

    for (const s of slots) {
      s.tex = new THREE.DataTexture(new Uint8Array(nx * ny * 2), nx, ny, THREE.RGFormat, THREE.UnsignedByteType);
      s.tex.minFilter = s.tex.magFilter = THREE.LinearFilter;
      s.tex.unpackAlignment = 1;
      disposables.push(s.tex);
    }
    void half;
  }

  // ---------------------------------------------------------------- cameras
  const barH = () => bar.offsetHeight * 0.8;
  const home = { r: 700, polar: 50 * DEG, az: 0 };
  const sph = (target, r, polar, az, out) => out.set(
    target.x + r * Math.sin(polar) * Math.sin(az),
    target.y + r * Math.cos(polar),
    target.z + r * Math.sin(polar) * Math.cos(az));

  function fitDistance() {
    const half = grid ? grid.half : 200;
    const vh = Math.max(60, H - barH());
    const aspect = W / vh;
    const tanH = Math.tan(FOV * DEG / 2) * (vh / H);
    return (half * 1.22) / tanH / Math.min(1, aspect * 0.8) * 0.78;
  }
  function ortHalf() {
    const half = grid ? grid.half : 200;
    const vh = Math.max(60, H - barH());
    const k = Math.max(1, vh / W);
    return half * 1.2 * k * (H / vh);
  }
  // host panels floating over the map (left, right px): the scene centres in the open part between them
  let insetX = 0, insetTo = 0;
  function setInsets(l, r) { insetTo = ((l || 0) - (r || 0)) / 2; dirty = true; }
  function stepInsets() {
    if (Math.abs(insetTo - insetX) < 0.5) return;
    insetX += (insetTo - insetX) * 0.14; if (Math.abs(insetTo - insetX) < 0.5) insetX = insetTo;
    cam3.setViewOffset(W, H, -insetX, barH() / 2, W, H); cam3.updateProjectionMatrix(); dirty = true;
  }
  function applySize() {
    W = Math.max(1, root.clientWidth);
    H = Math.max(1, root.clientHeight);
    renderer.setSize(W, H, false);
    const off = barH() / 2;
    cam3.aspect = W / H;
    cam3.setViewOffset(W, H, -insetX, off, W, H);
    const hh = ortHalf();
    cam2.left = -hh * W / H; cam2.right = hh * W / H; cam2.top = hh; cam2.bottom = -hh;
    cam2.setViewOffset(W, H, 0, off, W, H);
    cam3.updateProjectionMatrix();
    cam2.updateProjectionMatrix();
    stripDirty = true;
    dirty = true;
  }
  function resetCam3() {
    home.r = fitDistance();
    ctl3.target.set(0, 0, 0);
    sph(ctl3.target, home.r, home.polar, home.az, cam3.position);
    ctl3.update();
  }
  function resetCam2(target) {
    ctl2.target.copy(target ?? new THREE.Vector3());
    ctl2.target.y = 0;
    cam2.position.set(ctl2.target.x, 1500, ctl2.target.z);
    cam2.updateProjectionMatrix();
    ctl2.update();
  }

  function setView(v, { animate = true } = {}) {
    v = v === '2d' ? '2d' : '3d';
    for (const k in viewBtns) viewBtns[k].setAttribute('aria-pressed', String(k === v));
    if (v === view && !tween) { root.dataset.view = view; return; }
    tween = null;
    view = v;
    root.dataset.view = v;
    const tgt = new THREE.Vector3();
    const s = new THREE.Spherical();
    if (v === '2d') {
      // swing the perspective camera overhead, then hand over to the orthographic one
      tgt.copy(ctl3.target);
      s.setFromVector3(cam3.position.clone().sub(tgt));
      home.r = s.radius; home.polar = Math.max(s.phi, 20 * DEG); home.az = s.theta;
      const rEnd = ortHalf() / Math.tan(FOV * DEG / 2);
      const from = { r: s.radius, polar: s.phi, az: s.theta, tx: tgt.x, tz: tgt.z };
      const to = { r: rEnd, polar: 0.0005, az: Math.abs(s.theta) > Math.PI / 2 ? Math.sign(s.theta) * 0 : 0, tx: 0, tz: 0 };
      ctl3.enabled = false; ctl2.enabled = false; camera = cam3;
      const done = () => {
        cam2.zoom = 1;
        resetCam2();
        camera = cam2; ctl2.enabled = true; dirty = true;
      };
      if (animate) tween = { t0: performance.now(), dur: 520, from, to, ty: tgt.y, done };
      else done();
    } else {
      // start overhead at the matching scale, then swing back to the last 3D pose
      tgt.copy(ctl2.target); tgt.y = 0;
      const r0 = ortHalf() / cam2.zoom / Math.tan(FOV * DEG / 2);
      ctl2.enabled = false; camera = cam3;
      const from = { r: r0, polar: 0.0005, az: 0, tx: tgt.x, tz: tgt.z };
      const to = { r: clamp(Math.min(home.r, r0 * 1.15), ctl3.minDistance, ctl3.maxDistance), polar: home.polar, az: home.az, tx: tgt.x, tz: tgt.z };
      const done = () => { ctl3.enabled = true; ctl3.update(); dirty = true; };
      if (animate) tween = { t0: performance.now(), dur: 520, from, to, ty: 0, done };
      else { ctl3.target.set(to.tx, 0, to.tz); sph(ctl3.target, to.r, to.polar, to.az, cam3.position); done(); }
    }
    dirty = true;
  }
  function stepTween(now) {
    const k = clamp((now - tween.t0) / tween.dur, 0, 1);
    const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;   // easeInOutCubic
    const { from: a, to: b } = tween;
    const L = (p) => p === 'r' ? a.r * (b.r / a.r) ** e : a[p] + (b[p] - a[p]) * e;
    ctl3.target.set(L('tx'), tween.toY != null ? tween.ty + (tween.toY - tween.ty) * e : tween.keepY ? tween.ty : tween.ty * (1 - e), L('tz'));
    // long moves rise and come down (a hop) instead of skimming the ground in a straight line
    const far = Math.hypot(b.tx - a.tx, b.tz - a.tz), hop = Math.min(1.2, far / Math.max(a.r, b.r, 1) * 0.6);
    sph(ctl3.target, L('r') * (1 + hop * Math.sin(Math.PI * e)), L('polar') * (1 - 0.35 * (hop / 1.2) * Math.sin(Math.PI * e)), a.az + (((b.az - a.az + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * e, cam3.position);
    cam3.up.set(0, 1, 0);
    cam3.lookAt(ctl3.target);
    if (k >= 1) { const d = tween.done; tween = null; d(); }
    dirty = true;
  }

  // ---------------------------------------------------------------- data
  const fetchOk = async (url, init) => {
    const r = await fetch(url, { signal: abort.signal, ...init });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r;
  };

  const decodeCanvas = document.createElement('canvas');
  let decodeCtx = null;
  const UNPACK = new Uint8Array(256);
  for (let i = 0; i < 256; i++) UNPACK[i] = Math.round((i >> 1) * 255 / 127);

  async function loadFrame(d, i) {
    const name = `f_${pad(i, 3)}.png`;
    const layouts = d.layout != null ? [d.layout] : (d.probe ?? ['', 'frames/']);
    for (const lay of layouts) {
      let bmp;
      try {
        const r = await fetch(d.url + lay + name, { signal: abort.signal, cache: d.poll ? 'no-cache' : 'default' });
        if (!r.ok) continue;
        bmp = await createImageBitmap(await r.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      } catch (e) { continue; }
      if (destroyed) return false;
      const { nx, ny } = grid;
      if (decodeCanvas.width !== nx || decodeCanvas.height !== ny || !decodeCtx) {
        decodeCanvas.width = nx; decodeCanvas.height = ny;
        decodeCtx = decodeCanvas.getContext('2d', { willReadFrequently: true });
      }
      decodeCtx.globalCompositeOperation = 'copy';
      decodeCtx.drawImage(bmp, 0, 0, nx, ny);
      bmp.close?.();
      const px = decodeCtx.getImageData(0, 0, nx, ny).data;
      // one byte per pixel: 7 bits of sun fraction, 1 bit of Earth visibility
      const out = new Uint8Array(nx * ny);
      for (let k = 0, q = 0; k < out.length; k++, q += 4) out[k] = (px[q] & 254) | (px[q + 1] >> 7);
      d.frames[i] = out;
      d.loaded++;
      d.layout = lay;
      return true;
    }
    return false;
  }

  async function loadFrames(d) {
    const todo = [];
    for (let i = 0; i < d.n; i++) if (!d.frames[i]) todo.push(i);
    // current frame first, then outwards in time order
    const cur = clamp(Math.round(t), 0, d.n - 1);
    todo.sort((a, b) => (a === cur ? -1 : b === cur ? 1 : a - b));
    let p = 0;
    while (d.layout == null && p < todo.length && !destroyed) {
      if (await loadFrame(d, todo[p++])) { stripDirty = true; frameShown = -1; dirty = true; }
    }
    const worker = async () => {
      while (p < todo.length && !destroyed) {
        const i = todo[p++];
        if (await loadFrame(d, i)) {
          stripDirty = true;
          if (d === ds) { frameShown = -1; dirty = true; }
        }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  async function openDataset(d) {
    if (!d.meta) {
      d.meta = await (await fetchOk(d.url + 'meta.json')).json();
      d.times = (d.meta.times_utc ?? []).map((s) => Date.parse(s));
      d.n = d.times.length;
      d.frames = new Array(d.n).fill(null);
    }
    return d;
  }
  function startDataset(d) {
    if (d.started) return;
    d.started = true;
    const run = async () => {
      await loadFrames(d);
      if (destroyed) return;
      // a run still writing frames: look again later
      if (d.meta.status != null && d.meta.status !== 'complete' || (d.meta.status === 'complete' && d.loaded < d.n && d.poll < 2)) {
        d.poll++;
        d.timer = setTimeout(async () => {
          try {
            const m = await (await fetchOk(d.url + 'meta.json', { cache: 'no-store' })).json();
            if ((m.times_utc ?? []).length === d.n) d.meta = m;
          } catch (e) { /* keep the old meta */ }
          if (!destroyed) run();
        }, 30000);
      }
    };
    run();
  }

  const nearestLoaded = (d, i) => {
    if (d.frames[i]) return i;
    for (let k = 1; k < d.n; k++) {
      if (i - k >= 0 && d.frames[i - k]) return i - k;
      if (i + k < d.n && d.frames[i + k]) return i + k;
    }
    return -1;
  };
  // the two frames (and blend) that represent fractional time tt
  function framePair(d, tt) {
    if (!d.n) return null;
    const i0 = clamp(Math.floor(tt), 0, d.n - 1), i1 = Math.min(i0 + 1, d.n - 1);
    const a = nearestLoaded(d, i0);
    if (a < 0) return null;
    const b = nearestLoaded(d, i1);
    return { a, b, f: a === b ? 0 : clamp(tt - i0, 0, 1) };
  }
  // sun fraction / Earth visibility at a map point, from the frame data
  function sample(d, tt, xm, ym) {
    const k = pixelIndex(xm, ym), p = framePair(d, tt);
    if (k < 0 || !p) return null;
    const va = d.frames[p.a][k], vb = d.frames[p.b][k];
    return {
      sun: ((va >> 1) * (1 - p.f) + (vb >> 1) * p.f) / 127,
      earth: (va & 1) * (1 - p.f) + (vb & 1) * p.f,
    };
  }
  const classOf = (s) => {
    if (!s) return 'none';
    const sun = mode !== 'earth' && s.sun >= 0.5, earth = mode !== 'sun' && s.earth >= 0.5;
    return sun && earth ? 'both' : sun ? 'sun' : earth ? 'earth' : 'none';
  };

  // azimuth convention (confirmed by meta.az_convention of the real data): degrees clockwise
  // from map +y (lon 0) towards map +x (lon 90E) => direction (sin az, cos az) in map x, y.
  function bodyAt(key, tt) {
    const arr = ds.meta?.[key];
    if (!Array.isArray(arr) || !arr.length) return null;
    const i0 = clamp(Math.floor(tt), 0, arr.length - 1), i1 = Math.min(i0 + 1, arr.length - 1), f = clamp(tt - i0, 0, 1);
    const a = arr[i0], b = arr[i1];
    if (!a || !b) return null;
    return { az: lerpAngle(a[0], b[0], f), el: a[1] + (b[1] - a[1]) * f };
  }

  let frameShown = -1;
  function uploadSlot(slot, d, i) {
    if (slot.ds === d && slot.frame === i) return;
    const src = d.frames[i], dst = slot.tex.image.data;
    for (let k = 0, q = 0; k < src.length; k++, q += 2) { dst[q] = UNPACK[src[k]]; dst[q + 1] = (src[k] & 1) * 255; }
    slot.tex.needsUpdate = true;
    slot.ds = d; slot.frame = i;
  }
  function syncFrame() {
    if (!grid || !slots[0].tex) return;
    const p = framePair(ds, t);
    if (!p) { uniforms.uHasFrame.value = 0; return; }
    const has = (i) => slots.find((s) => s.ds === ds && s.frame === i);
    let sa = has(p.a), sb = has(p.b);
    if (!sa) { sa = slots.find((s) => s !== sb); uploadSlot(sa, ds, p.a); }
    if (!sb) { sb = slots.find((s) => s !== sa) ?? sa; if (p.b !== p.a) uploadSlot(sb, ds, p.b); else sb = sa; }
    uniforms.uA.value = sa.tex;
    uniforms.uB.value = sb.tex;
    uniforms.uMix.value = p.f;
    uniforms.uHasFrame.value = 1;
    placeSky(t);
    const sun = bodyAt('sun_az_el_at_pole', t);
    if (sun) {
      // direction only: relief is lit from the Sun's azimuth at a fixed, readable elevation
      const v = uniforms.uSunDir.value.set(Math.sin(sun.az * DEG), Math.cos(sun.az * DEG), 0.55);
      v.normalize();
    } else uniforms.uSunDir.value.set(0, 0, -1);
  }

  // ---------------------------------------------------------------- orientation
  const passWheel = (e) => { e.preventDefault(); canvas.dispatchEvent(new WheelEvent('wheel', e)); };
  // Same rule as orientation.py describe(): nearest landmark with tier <= 2 (distance to the rim
  // for craters, to the centre otherwise), bearing clockwise from the Earth direction (map +y).
  const lmName = (m) => (ko && m.name_ko) || m.name;
  function describe(xm, ym) {
    let best = null, bk = Infinity, bd = 0;
    for (const m of landmarks) {
      if (m.tier > 2) continue;
      const d = Math.hypot(xm - m.x_m, ym - m.y_m) / 1000;
      const key = m.kind === 'crater' ? Math.max(d - (m.radius_km || 0), 0) : d;
      if (key < bk) { bk = key; best = m; bd = d; }
    }
    if (!best) return '';
    const inside = best.kind === 'crater' && best.radius_km && bd <= best.radius_km;
    const bearing = (Math.atan2(xm - best.x_m, ym - best.y_m) / DEG + 360) % 360;
    const sector = T.sectors[Math.floor(((bearing + 22.5) % 360) / 45)];
    const name = lmName(best);
    if (bd < 0.5) return name;
    return (inside ? T.relIn : T.relOut)(name, sector, bd.toFixed(0));
  }
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // screen pixels per km at the point the camera looks at
  const pxPerKm = () => (camera === cam2
    ? H / (cam2.top - cam2.bottom) * cam2.zoom
    : H / (2 * cam3.position.distanceTo(ctl3.target) * Math.tan(FOV * DEG / 2)));
  const TIER2_PX = 2.3, TIER3_PX = 5.5; // label thresholds, px per km
  const LD_ICON = {
    landed: '<svg viewBox="0 0 13 13"><path d="M6.5 1.5 12 11.5H1z" fill="currentColor"/></svg>',
    planned: '<svg viewBox="0 0 13 13"><path d="M6.5 2 11.6 11.2H1.4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    impact: '<svg viewBox="0 0 13 13"><path d="M2.5 2.5l8 8M10.5 2.5l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };
  LD_ICON.crash = LD_ICON.impact;
  const ldLabel = (l) => String(l.name).replace(/\s*\(planned[^)]*\)|\s+impact$/gi, '');

  function buildOrientation() {
    // crater rims draped on the terrain
    const rims = uniforms.uRims.value;
    let n = 0;
    for (const m of landmarks) {
      if (m.kind !== 'crater' || !(m.radius_km > 0) || n >= rims.length) continue;
      rims[n++].set(m.x_m / 1000, m.y_m / 1000, m.radius_km, m.tier <= 2 ? 0.26 : 0.12);
    }
    uniforms.uRimN.value = n;
    for (const m of landmarks) {
      m.lab = el('div', `lmap-lm t${m.tier}`);
      m.lab.textContent = lmName(m);
      if (m.kind === 'point') { m.pt = el('div', 'lmap-pt'); ov.appendChild(m.pt); }
      ov.appendChild(m.lab);
    }
    for (const l of landers) {
      // a lander that is also one of the sites: the site marker takes the lander symbol
      const site = l.kind === 'landed' && sites.find((s) => Math.hypot(s.x_m - l.x_m, s.y_m - l.y_m) < 2000 && !s.lander);
      if (site) {
        site.lander = l; l.site = site;
        site.dot.classList.add('is-landed');
        site.dot.innerHTML = '<svg viewBox="0 0 15 15"><path d="M7.5 1.6 13.8 13H1.2z" fill="currentColor" stroke="#e8eaf0" stroke-width="1.5" stroke-linejoin="round"/></svg>';
        site.lab.innerHTML = `${esc(ldLabel(l))}<small style="font:10px/1 var(--lmap-mono);color:var(--muted);margin-left:5px">${esc(l.year ?? '')}</small>`;
        site.w = 0;
        continue;
      }
      l.dot = el('div', 'lmap-ld', LD_ICON[l.kind]);
      l.lab = el('div', 'lmap-ldn', `${esc(ldLabel(l))}<small>${esc(l.year ?? '')}</small>`);
      ov.append(l.lab, l.dot);
      l.dot.addEventListener('pointerenter', () => { hoverLander = l; dirty = true; });
      l.dot.addEventListener('pointerleave', () => { if (hoverLander === l) hoverLander = null; dirty = true; });
      l.dot.addEventListener('wheel', passWheel, { passive: false });
    }
    ov.appendChild(card);
    dirty = true;
  }

  let cardKey = '';
  function updateCard() {
    const s = hoverSite, l = hoverLander ?? s?.lander;
    const m = s ?? hoverLander;
    if (!m || !m.on) { if (cardKey) { card.style.display = 'none'; cardKey = ''; } return; }
    let html = '';
    if (l) {
      html += `<b>${esc(ldLabel(l))}</b>`
        + (l.mission ? `<span>${esc(l.mission)}</span>` : '')
        + `<span>${esc([l.date ?? l.year, l.status].filter(Boolean).join(' · '))}</span>`;
    } else html += `<b>${esc(s.name)}</b>`;
    const rel = (ko && !s && l.relative?.text_ko) || describe(m.x_m, m.y_m);
    if (rel) html += `<span class="lmap-rel">${esc(rel)}</span>`;
    html += `<span class="lmap-mono">${fmtLatLon(m.x_m, m.y_m)}${l?.verify ? ` · <span style="font-family:inherit">${T.approx}</span>` : ''}</span>`;
    const st = sample(ds, t, m.x_m, m.y_m);
    if (st) html += `<span class="lmap-sts">${stHtml('sun', T.sun, st.sun)}${stHtml('earth', T.earth, st.earth)}</span>`;
    if (html !== cardKey) { cardKey = html; card.innerHTML = html; card.style.display = ''; }
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let x = m.sx + 14, y = m.sy + 14;
    if (x + cw > W - 8) x = m.sx - 14 - cw;
    if (y + ch > H - bar.offsetHeight) y = m.sy - 14 - ch;
    card.style.transform = `translate3d(${Math.round(Math.max(8, x))}px,${Math.round(Math.max(8, y))}px,0)`;
  }

  function updateCompass() {
    // screen direction of map +y around the point being looked at
    const a = v3.copy(camera === cam2 ? ctl2.target : ctl3.target).project(camera);
    const ax = a.x * W, ay = a.y * H;
    const b = v3.copy(camera === cam2 ? ctl2.target : ctl3.target); b.z -= 5; b.project(camera);
    const ang = Math.atan2(b.x * W - ax, b.y * H - ay) / DEG;
    const r = Math.round(ang * 2) / 2;
    if (compass._a !== r) { compass._a = r; compassNeedle.style.transform = `rotate(${r}deg)`; }
  }

  // ---------------------------------------------------------------- overlay
  const v3 = new THREE.Vector3();
  const lonLabels = [];
  const bodies = {};
  function buildOverlay() {
    for (const [txt, ang] of [['0°', 0], ['90°E', 90], ['180°', 180], ['90°W', 270]]) {
      const e = el('div', 'lmap-lon', txt);
      ov.appendChild(e);
      lonLabels.push({ e, ang, w: 0, h: 0 });
    }
    for (const [k, name] of [['sun', T.sunBody], ['earth', T.earth]]) {
      const e = el('div', `lmap-body is-${k}`, `<i></i><span></span>`);
      ov.appendChild(e);
      bodies[k] = { e, name, span: e.lastChild, key: `${k}_az_el_at_pole` };
    }
    for (const s of sites) {
      s.dot = el('div', 'lmap-site');
      s.lab = el('div', 'lmap-name', '');
      s.lab.textContent = s.name;
      ov.append(s.lab, s.dot);
      s.dot.addEventListener('pointerenter', () => { hoverSite = s; dirty = true; });
      s.dot.addEventListener('pointerleave', () => { if (hoverSite === s) hoverSite = null; dirty = true; });
      s.dot.addEventListener('wheel', passWheel, { passive: false });
      s.dot.addEventListener('click', () => { if (opt.onSiteClick) { selSite = s; opt.onSiteClick(s.id); } else selSite = selSite === s ? null : s; stripDirty = true; dirty = true; });
    }
  }
  const project = (out) => {
    out.project(camera);
    const ok = out.z > -1 && out.z < 1;
    out.x = (out.x * 0.5 + 0.5) * W;
    out.y = (-out.y * 0.5 + 0.5) * H;
    return ok;
  };
  const place = (e, x, y, show) => {
    if (!show) { if (e._on !== false) { e.style.display = 'none'; e._on = false; } return; }
    if (e._on !== true) { e.style.display = ''; e._on = true; }
    e.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
  };
  const edgePoint = (ang, margin, out) => {
    const dx = Math.sin(ang * DEG), dy = Math.cos(ang * DEG);
    const k = (grid.half + margin) / Math.max(Math.abs(dx), Math.abs(dy));
    return out.set(dx * k, 0, -dy * k);
  };

  function placePins() {
    for (const p of pins) {
      if (!p.el) {
        p.el = el('div', `lmap-pin is-${p.kind || 'go'}`, `<i></i>${p.label ? `<span>${esc(p.label)}</span>` : ''}`);
        p.el.addEventListener('click', (e) => { e.stopPropagation(); opt.onPinClick?.(p); });
        p.el.addEventListener('pointerenter', () => opt.onPinHover?.(p, p.el));
        p.el.addEventListener('pointerleave', () => opt.onPinHover?.(null));
        p.el.addEventListener('wheel', passWheel, { passive: false });
        ov.appendChild(p.el);
      }
      const ok = project(worldOf(p.x, p.y, v3));
      place(p.el, v3.x, v3.y - 30, ok && v3.x > -6 && v3.x < W + 6 && v3.y > -6 && v3.y < H + 6);
    }
  }
  function updateOverlay() {
    placePins();
    if (!grid || !bodies.sun) return;   // grid is set before the overlay is built (await in between)
    const boxes = [];
    const hit = (b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    const limitB = H - bar.offsetHeight + 14;

    // Sun / Earth direction as seen from the pole, placed on the map margin
    for (const k of ['sun', 'earth']) {
      const b = bodies[k], st = opt.bodyMarkers === false ? null : bodyAt(b.key, t);   // the host can draw the real Sun/Earth instead
      if (!st) { place(b.e, 0, 0, false); continue; }
      const ok = project(edgePoint(st.az, 20, v3));
      const txt = `${b.name} ${st.el >= 0 ? '+' : '−'}${Math.abs(st.el).toFixed(1)}°`;
      if (b.txt !== txt) { b.span.textContent = txt; b.txt = txt; b.w = 0; }
      b.e.classList.toggle('is-down', st.el < 0);
      if (!b.w) b.w = b.e.offsetWidth || 70;
      let flip = v3.x + b.w > W - 6;
      if (!flip && hit([v3.x - 10, v3.y - 10, v3.x + b.w + 4, v3.y + 10])) flip = true;
      const x = flip ? v3.x - b.w + 6 : v3.x, y = v3.y;
      b.e.style.flexDirection = flip ? 'row-reverse' : '';
      b.e.firstChild.style.margin = flip ? '-6px -6px -6px 0' : '';
      const show = ok && v3.x > -10 && v3.x < W + 10 && y > 8 && y < limitB;
      place(b.e, x, y - 5, show);
      if (show) boxes.push([x - 14, y - 10, x + b.w + 14, y + 10]);
    }
    for (const l of lonLabels) {
      const ok = project(edgePoint(l.ang, 20, v3));
      if (!l.w) { l.w = l.e.offsetWidth || 24; l.h = l.e.offsetHeight || 10; }
      const x = v3.x - l.w / 2, y = v3.y - l.h / 2;
      const box = [x - 4, y - 4, x + l.w + 4, y + l.h + 4];
      const show = ok && x > 4 && x + l.w < W - 4 && y > 4 && y < limitB && !hit(box);
      place(l.e, x, y, show);
      if (show) boxes.push(box);
    }

    const inView = (x, y) => x > -6 && x < W + 6 && y > -6 && y < limitB;
    // first free position wins; forced labels take their first position that fits the view
    const tryPlace = (e, w, h, opts, force) => {
      let fallback = null;
      for (const [x, y] of opts) {
        if (x < 2 || x + w > W - 2 || y < 2 || y + h > limitB) continue;
        const box = [x - 3, y - 1, x + w + 3, y + h + 1];
        if (hit(box)) { fallback ??= [x, y, box]; continue; }
        place(e, x, y, true); boxes.push(box);
        return true;
      }
      if (force && fallback) { place(e, fallback[0], fallback[1], true); boxes.push(fallback[2]); return true; }
      place(e, 0, 0, false);
      return false;
    };
    const around = (x, y, w, h, g) => [[x + g, y - h / 2], [x - g - w, y - h / 2], [x - w / 2, y - h - g + 1], [x - w / 2, y + g - 1]];
    const size = (o) => { if (!o.w) { o.w = o.lab.offsetWidth || 60; o.h = o.lab.offsetHeight || 14; } };
    const zoom = pxPerKm();

    // project everything, reserve the symbols
    for (const m of landmarks) {
      const ok = project(worldOf(m.x_m, m.y_m, v3));
      m.sx = v3.x; m.sy = v3.y; m.on = ok && inView(v3.x, v3.y);
      if (m.pt) { place(m.pt, m.sx, m.sy, m.on); if (m.on) boxes.push([m.sx - 6, m.sy - 6, m.sx + 6, m.sy + 6]); }
    }
    if (marksSvg.parentNode !== ov) ov.prepend(marksSvg);
    { // scale bar for the ground at the view centre (perspective: true there only)
      if (!scaleEl) { scaleEl = el('div', 'lmap-scale', '<span></span><i></i>'); ov.appendChild(scaleEl); }
      const c = camera === cam3 ? ctl3.target : ctl2.target, a = v3.copy(c); project(a); const ax = a.x, ay = a.y;
      const b2 = v3.set(c.x + 1, c.y, c.z); project(b2);
      const ppk = Math.hypot(b2.x - ax, b2.y - ay);
      if (ppk > 0 && Number.isFinite(ppk)) {
        const want = 110 / ppk, p10 = Math.pow(10, Math.floor(Math.log10(want))), km = [1, 2, 5, 10].map(m => m * p10).filter(v => v <= want).pop() || p10;
        const w = Math.round(km * ppk), txt = km >= 1 ? `${km} km` : `${Math.round(km * 1000)} m`;
        if (scaleEl._t !== txt + w) { scaleEl.firstChild.textContent = txt; scaleEl.lastChild.style.width = w + 'px'; scaleEl._t = txt + w; }
        place(scaleEl, 14, limitB - 44, true);
      } else place(scaleEl, 0, 0, false);
    }
    {
      let html = '';
      for (const m of marks) {
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const f = i / 24, ok = project(worldOf(m.x1 + (m.x2 - m.x1) * f, m.y1 + (m.y2 - m.y1) * f, v3));
          if (ok) pts.push(`${v3.x.toFixed(1)},${v3.y.toFixed(1)}`);
        }
        if (pts.length < 2) continue;
        const d = 'M' + pts.join('L'), [ex, ey] = pts[pts.length - 1].split(',').map(Number);
        html += `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="${(m.w || 2) + 2}"/><path d="${d}" fill="none" stroke="${m.color}" stroke-width="${m.w || 2}"${m.dash ? ` stroke-dasharray="${m.dash}"` : ''}/>`;
        if (m.end === 'ring') html += `<circle cx="${ex}" cy="${ey}" r="8" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="4"/><circle cx="${ex}" cy="${ey}" r="8" fill="none" stroke="#fff" stroke-width="2"/>`;
        else if (m.end) html += `<circle cx="${ex}" cy="${ey}" r="7" fill="${m.end}" stroke="${m.color}" stroke-width="1.5"/><line x1="${ex - 7}" y1="${ey + 4}" x2="${ex + 7}" y2="${ey - 4}" stroke="${m.color}" stroke-width="1.5"/>`;
        const [sx] = pts[0].split(',').map(Number), lt = ex < sx;   // label on the far side of the end, away from the line
        if (m.label) html += `<text x="${lt ? ex - 11 : ex + 11}" y="${ey + 4}"${lt ? ' text-anchor="end"' : ''} font-size="12" font-weight="600" fill="#fff" paint-order="stroke" stroke="#0f131b" stroke-width="3">${m.label}</text>`;
      }
      if (marksSvg._h !== html) { marksSvg.innerHTML = html; marksSvg._h = html; }
    }
    if (mastPt) {
      if (!mastEl) {
        mastEl = el('div', 'lmap-mast', `<span></span><b></b><i></i><div class="cmp">${SCALE_FIGS(6)}</div>`); ov.appendChild(mastEl);
        mastEl.addEventListener('pointerdown', (ev) => ev.stopPropagation());
        mastEl.addEventListener('click', (ev) => { ev.stopPropagation(); opt.onMastClick?.(); });
      }
      worldOf(mastPt.x, mastPt.y, v3);
      // the pole never draws smaller than 6 px per metre; close up it is at true size, with the astronaut and lander beside it
      const ppm = camera === cam3 ? canvas.clientHeight / (2 * camera.position.distanceTo(v3) * Math.tan(FOV * DEG / 2)) / 1000 : 0;
      const real = ppm >= 6, k = Math.max(ppm, 6), key = mastPt.h + ':' + (real ? k.toFixed(1) : '6');
      const ok = project(v3);
      const px = Math.round(Math.min(mastPt.h, 20) * k);
      if (mastEl._h !== key) {
        mastEl.firstChild.textContent = mastPt.label; mastEl.querySelector('i').style.height = px + 'px'; mastEl._h = key;
        const c = mastEl.querySelector('.cmp'); c.style.display = real ? 'flex' : 'none'; if (real) c.innerHTML = SCALE_FIGS(k);
      }
      const hh = mastEl.offsetHeight || px + 30;
      place(mastEl, v3.x - (mastEl.offsetWidth || 40) / 2, v3.y - hh, ok && inView(v3.x, v3.y));
    } else if (mastEl) place(mastEl, 0, 0, false);
    const vis = [];
    for (const s of sites) {
      const ok = project(worldOf(s.x_m, s.y_m, v3));
      s.sx = v3.x; s.sy = v3.y - (glow && !s.lander ? 27 : 0);   // glow: the dot stands on a stem above the spot
      s.on = ok && inView(v3.x, v3.y);
      place(s.dot, s.sx, s.sy, s.on);
      const c = (glow ? CLASS_COLOR_GLOW : CLASS_COLOR)[classOf(sample(ds, t, s.x_m, s.y_m))];
      if (s.c !== c) { if (s.lander) s.dot.style.color = c; else s.dot.style.background = c; s.c = c; }
      const sel = s === selSite;
      if (s.sel !== sel) { s.dot.classList.toggle('is-sel', sel); s.lab.classList.toggle('is-sel', sel); s.sel = sel; s.w = 0; }
      if (s.on) { vis.push(s); boxes.push([s.sx - 8, s.sy - 8, s.sx + 8, s.sy + 8]); }
      else place(s.lab, 0, 0, false);
    }
    for (const l of landers) {
      if (!l.dot) continue;
      const ok = project(worldOf(l.x_m, l.y_m, v3));
      l.sx = v3.x; l.sy = v3.y; l.on = ok && inView(v3.x, v3.y);
      place(l.dot, l.sx, l.sy, l.on);
      if (l.on) boxes.push([l.sx - 7, l.sy - 7, l.sx + 7, l.sy + 7]);
    }

    // labels by priority: tier-1 landmarks, hovered things, sites, tier 2, landers, tier 3
    const lmLabel = (m, force) => {
      size(m);
      // craters: centre, else just outside the rim; points: beside the mark
      const rp = m.kind === 'crater' ? Math.min((m.radius_km || 0) * zoom, 90) + 3 : 8;
      const opts = m.pt ? around(m.sx, m.sy, m.w, m.h, 9)
        : [[m.sx - m.w / 2, m.sy - m.h / 2], [m.sx - m.w / 2, m.sy - m.h - rp], [m.sx - m.w / 2, m.sy + rp], [m.sx + rp + 2, m.sy - m.h / 2], [m.sx - rp - 2 - m.w, m.sy - m.h / 2]];
      m.done = tryPlace(m.lab, m.w, m.h, opts, force);
    };
    for (const m of landmarks) { m.done = false; if (!m.on) place(m.lab, 0, 0, false); }
    for (const pass of [true, false]) for (const m of landmarks) if (m.on && !!m.pt === pass && (m.tier === 1 || m.always_show)) lmLabel(m, true);
    if (hoverLm && hoverLm.on && !hoverLm.done) lmLabel(hoverLm, true);
    const rank = (s) => (s === hoverSite ? 0 : s === selSite ? 1 : 2);
    vis.sort((a, b) => rank(a) - rank(b));
    for (const s of vis) { size(s); tryPlace(s.lab, s.w, s.h, around(s.sx, s.sy, s.w, s.h, 10), rank(s) < 2); }
    for (const m of landmarks) if (m.on && !m.done && m.tier === 2) { if (zoom >= TIER2_PX) lmLabel(m, false); else place(m.lab, 0, 0, false); }
    for (const l of landers) {
      if (!l.dot) continue;
      if (!l.on) { place(l.lab, 0, 0, false); continue; }
      size(l);
      tryPlace(l.lab, l.w, l.h, around(l.sx, l.sy, l.w, l.h, 10), l === hoverLander);
    }
    for (const m of landmarks) if (m.on && !m.done && m.tier > 2) { if (zoom >= TIER3_PX) lmLabel(m, false); else place(m.lab, 0, 0, false); }

    updateCard();
    updateCompass();
  }

  // ---------------------------------------------------------------- readout, timeline
  const stHtml = (k, label, v) => {
    const c = k === 'sun' ? 'var(--sun)' : 'var(--earth)';
    const fill = v >= 0.99 ? c : v > 0.01 ? `linear-gradient(90deg,${c} 50%,transparent 50%)` : 'transparent';
    return `<span class="lmap-st is-${k}${v > 0.01 ? '' : ' is-off'}"><i style="background:${fill}"></i>${label}</span>`;
  };
  const fmtLatLon = (xm, ym) => {
    const rho = Math.hypot(xm, ym);
    const lat = 2 * Math.atan(rho / (2 * R_MOON)) / DEG - 90;
    const lon = Math.atan2(xm, ym) / DEG;
    return `${Math.abs(lat).toFixed(2)}°S ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`;
  };
  let readKey = '';
  function updateReadout() {
    const s = hoverPt ? null : selSite;
    const pt = s ? { x: s.x_m, y: s.y_m } : hoverPt;
    let html = '';
    if (pt && grid) {
      const st = sample(ds, t, pt.x, pt.y);
      const h = Math.round(heightAt(pt.x, pt.y));
      const rel = describe(pt.x, pt.y);
      html = (s ? `<b></b>` : '')
        + (rel ? `<span class="lmap-rel">${esc(rel)}</span>` : '')
        + `<span class="lmap-geo">${fmtLatLon(pt.x, pt.y)}</span>`
        + `<span class="lmap-geo">${h < 0 ? '−' : '+'}${Math.abs(h).toLocaleString('en-US')} m</span>`
        + (st ? stHtml('sun', T.sun, st.sun) + stHtml('earth', T.earth, st.earth) : '');
    }
    const key = html + (s ? s.name : '');
    if (key === readKey) return;
    readKey = key;
    readEl.innerHTML = html;
    if (s) readEl.querySelector('b').textContent = s.name;
  }

  let timeKey = '';
  function updateTime() {
    if (!ds.n) return;
    const i0 = clamp(Math.floor(t), 0, ds.n - 1), i1 = Math.min(i0 + 1, ds.n - 1);
    const ms = ds.times[i0] + (ds.times[i1] - ds.times[i0]) * (t - i0);
    const txt = fmtTime(Math.round(ms / 60000) * 60000);
    const idx = `${pad(Math.round(t) + 1, 3)}/${pad(ds.n, 3)}${ds.frames[Math.round(t)] ? '' : ' ·'}`;
    if (txt + idx !== timeKey) {
      timeKey = txt + idx;
      timeEl.innerHTML = `${txt}<small>UTC</small>`;
      // muted while the frame for this time has not arrived (a neighbouring one is shown)
      timeEl.style.color = ds.frames[Math.round(t)] ? '' : 'var(--muted)';
      idxEl.textContent = idx;
    }
    if (document.activeElement !== slider || playing) slider.value = t;
  }

  // track: loaded frames light up as they arrive; with a site selected it shows
  // that site's state over the whole period
  function drawStrip() {
    stripDirty = false;
    const n = Math.max(1, ds.n);
    if (strip.width !== n) strip.width = n;
    const c = strip.getContext('2d');
    c.clearRect(0, 0, n, 1);
    for (let i = 0; i < ds.n; i++) {
      const fr = ds.frames[i];
      if (!fr) { c.fillStyle = '#1b2130'; c.fillRect(i, 0, 1, 1); continue; }
      let col = '#3a4358';
      if (selSite && grid) {
        const k = pixelIndex(selSite.x_m, selSite.y_m);
        if (k >= 0) col = CC[classOf({ sun: (fr[k] >> 1) / 127, earth: fr[k] & 1 })];
        if (col === CC.none) col = '#262d3c';
      }
      c.fillStyle = col;
      c.fillRect(i, 0, 1, 1);
    }
  }

  // ---------------------------------------------------------------- picking
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(cx, cy) {
    if (!grid) return null;
    const rc = canvas.getBoundingClientRect();
    ndc.set(((cx - rc.left) / rc.width) * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc, camera);
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    const half = grid.half;
    const lo = [-half, hMin / 1000 * exagV - 0.5, -half], hi = [half, hMax / 1000 * exagV + 0.5, half];
    const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
    let t0 = 0, t1 = 1e9;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(dd[a]) < 1e-9) { if (oo[a] < lo[a] || oo[a] > hi[a]) return null; continue; }
      let ta = (lo[a] - oo[a]) / dd[a], tb = (hi[a] - oo[a]) / dd[a];
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    }
    if (t0 > t1) return null;
    const above = (tt) => (oo[1] + dd[1] * tt) - yAt((oo[0] + dd[0] * tt) * 1000, -(oo[2] + dd[2] * tt) * 1000);
    const dt = Math.max(0.25, (t1 - t0) / 4000);
    let prev = t0;
    if (above(prev) < 0) return null; // entering through a side wall
    for (let tt = t0 + dt; tt <= t1 + dt; tt += dt) {
      if (above(tt) <= 0) {
        let a = prev, b = tt;
        for (let k = 0; k < 10; k++) { const m = (a + b) / 2; if (above(m) > 0) a = m; else b = m; }
        return { x: (oo[0] + dd[0] * b) * 1000, y: -(oo[2] + dd[2] * b) * 1000 };
      }
      prev = tt;
    }
    return null;
  }

  // ---------------------------------------------------------------- controls wiring
  function setMode(m) {
    if (!PALETTE[m]) return;
    mode = m;
    const p = (glow ? PALETTE_GLOW : PALETTE)[m];
    uniforms.cNone.value.fromArray(p.none);
    uniforms.cSun.value.fromArray(p.sun);
    uniforms.cEarth.value.fromArray(p.earth);
    uniforms.cBoth.value.fromArray(p.both);
    uniforms.uSunW.value = p.sunW;
    uniforms.uEarthW.value = p.earthW;
    for (const k in modeBtns) modeBtns[k].setAttribute('aria-pressed', String(k === m));
    for (const s of sites) s.c = null;
    stripDirty = true;
    readKey = '';
    dirty = true;
  }
  function setExag(v) {
    exagV = clamp(+v || 1, 1, 8);
    uniforms.uExag.value = exagV;
    placeMoon();
    exagIn.value = exagV;
    exagOut.textContent = `×${exagV % 1 ? exagV.toFixed(1) : exagV}`;
    dirty = true;
  }
  function setT(v, { snap = false } = {}) {
    if (!ds.n) { t = +v || 0; return; }
    t = clamp(+v || 0, 0, ds.n - 1);
    if (snap) t = Math.round(t);
    frameShown = -1;
    dirty = true;
    opt.onFrame?.(Math.round(t), ds.meta?.times_utc?.[Math.round(t)]);
  }
  function setPlaying(p) {
    playing = !!p && ds.n > 1;
    bPlay.innerHTML = playing ? ICON.pause : ICON.play;
    bPlay.setAttribute('aria-label', playing ? T.pause : T.play);
    lastTs = 0;
    if (!playing) setT(t, { snap: true });
    dirty = true;
  }
  const step = (d) => { setPlaying(false); setT(Math.round(t) + d, { snap: true }); };

  async function setDataset(i) {
    const d = datasets[i];
    if (!d) return;
    [...segDs.children].forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    try { await openDataset(d); } catch (e) { if (!destroyed) console.warn('[lunar-map] dataset unavailable:', d.url); return; }
    if (destroyed) return;
    const frac = ds.n > 1 ? t / (ds.n - 1) : 0;
    const same = d === ds;
    ds = d;
    slider.max = Math.max(1, d.n - 1);
    if (!same) setT(Math.round(frac * (d.n - 1)), { snap: true }); else setT(t);
    timeKey = ''; readKey = '';
    stripDirty = true;
    if (grid) startDataset(d);
  }
  datasets.forEach((d, i) => {
    const b = el('button', '');
    b.type = 'button';
    b.textContent = d.label || String(i + 1);
    b.onclick = () => setDataset(i);
    segDs.appendChild(b);
  });

  const on = (target, type, fn, o) => target.addEventListener(type, fn, { signal: abort.signal, ...o });
  on(bPlay, 'click', () => setPlaying(!playing));
  on(bPrev, 'click', () => step(-1));
  on(bNext, 'click', () => step(1));
  on(slider, 'input', () => { if (playing) setPlaying(false); setT(slider.value); });
  on(slider, 'change', () => { setT(slider.value, { snap: true }); slider.value = t; });
  on(exagIn, 'input', () => setExag(exagIn.value));
  on(root, 'keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'Space') { if (options.onSpace) options.onSpace(); else setPlaying(!playing); }
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'Home') step(-1e9);
    else if (e.key === 'End') step(1e9);
    else return;
    e.preventDefault();
  });
  on(root, 'pointerdown', (e) => { if (!e.target.closest('input')) root.focus({ preventScroll: true }); });
  let down = null;
  on(canvas, 'pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  on(canvas, 'pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) {
      // a click (not a drag): the host picks that ground point (navigator: a pin there); otherwise clear the selection
      const pt = opt.onMapClick ? pick(e.clientX, e.clientY) : null;
      if (pt) opt.onMapClick(pt.x, pt.y);
      else if (selSite) { selSite = null; stripDirty = true; dirty = true; }
    }
    down = null;
  });
  on(canvas, 'pointermove', (e) => { pointer = e.buttons ? null : { x: e.clientX, y: e.clientY }; pickDirty = true; dirty = true; });
  on(canvas, 'pointerleave', () => { pointer = null; hoverPt = null; dirty = true; if (opt.onHover) opt.onHover(null); });
  on(compass, 'click', () => {
    if (view !== '3d' || tween) return;
    const s = new THREE.Spherical().setFromVector3(cam3.position.clone().sub(ctl3.target));
    const p = { r: s.radius, polar: s.phi, tx: ctl3.target.x, tz: ctl3.target.z };
    ctl3.enabled = false;
    tween = { t0: performance.now(), dur: 420, from: { ...p, az: s.theta }, to: { ...p, az: 0 }, ty: ctl3.target.y, keepY: true, done: () => { ctl3.enabled = true; ctl3.update(); dirty = true; } };
  });
  on(canvas, 'dblclick', () => { if (view === '3d') resetCam3(); else { cam2.zoom = 1; resetCam2(); } dirty = true; });
  let pickDirty = false;

  const ro = new ResizeObserver(() => { if (!destroyed) applySize(); });
  ro.observe(root);

  // ---------------------------------------------------------------- loop
  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (tween) stepTween(now);
    else if (camera === cam3) ctl3.update(); else ctl2.update();
    if (playing && ds.n > 1) {
      const dtS = lastTs ? Math.min(0.1, (now - lastTs) / 1000) : 0;
      lastTs = now;
      const fps = clamp(ds.n / 36, 1.2, 8);
      let nt = t + dtS * fps;
      if (nt >= ds.n - 1) nt = 0;
      t = nt;
      frameShown = -1;
      dirty = true;
      const r = Math.round(t);
      if (r !== lastEmit) { lastEmit = r; opt.onFrame?.(r, ds.meta?.times_utc?.[r]); }
    }
    stepInsets();
    if (!dirty) return;
    dirty = false;
    if (frameShown !== t) { syncFrame(); frameShown = t; }
    if (pickDirty || (pointer && !tween)) {   // no ground picking while a flight runs
      hoverPt = pointer ? pick(pointer.x, pointer.y) : null;
      pickDirty = false;
      if (opt.onHover) {
        const sm = hoverPt && pointer ? sample(ds, t, hoverPt.x, hoverPt.y) : null, i0 = clamp(Math.round(t), 0, Math.max(0, ds.n - 1));
        opt.onHover(hoverPt && pointer ? { x: hoverPt.x, y: hoverPt.y, cx: pointer.x, cy: pointer.y, sun: sm ? sm.sun : null, earth: sm ? sm.earth : null, h: heightAt(hoverPt.x, hoverPt.y), ms: ds.times ? ds.times[i0] : null } : null);
      }
      hoverLm = null;
      if (hoverPt) {
        let br = Infinity;
        for (const m of landmarks) {
          const r = Math.max(m.radius_km || 0, 4), d = Math.hypot(hoverPt.x - m.x_m, hoverPt.y - m.y_m) / 1000;
          if (d <= r && r < br) { br = r; hoverLm = m; }
        }
      }
    }
    syncDetail();
    renderer.render(scene, camera);
    updateOverlay();
    updateTime();
    updateReadout();
    if (stripDirty) drawStrip();
  }
  let lastEmit = -1;

  // ---------------------------------------------------------------- boot
  setMode(mode);
  setExag(exagV);
  for (const k in viewBtns) viewBtns[k].setAttribute('aria-pressed', String(k === view));
  [...segDs.children].forEach((b, k) => b.setAttribute('aria-pressed', String(k === 0)));
  applySize();

  const ready = (async () => {
    await openDataset(ds);
    const g = ds.meta.grid;
    const res = +g.res_m;
    const nx = g.nx | 0, ny = g.ny | 0;
    // x_min/x_max may be outer edges or pixel centres; accept both
    const centres = Math.abs((g.x_max - g.x_min) - (nx - 1) * res) < Math.abs((g.x_max - g.x_min) - nx * res);
    const off = centres ? res / 2 : 0;
    grid = {
      nx, ny, res,
      x0: g.x_min - off, x1: g.x_max + off, y0: g.y_min - off, y1: g.y_max + off,
      flipY: g.row0 !== 'min_y',
    };
    grid.half = Math.max(Math.abs(grid.x0), Math.abs(grid.x1), Math.abs(grid.y0), Math.abs(grid.y1)) / 1000;
    const okJson = (u) => fetch(u, { signal: abort.signal }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    const hasXY = (o) => o && Number.isFinite(o.x_m) && Number.isFinite(o.y_m);
    const [hb, sj, lmj, ldj] = await Promise.all([
      loadHeightPng(fetchOk, ds.url + 'height.png', nx, ny).catch(() => fetchOk(ds.url + 'height.bin').then((r) => r.arrayBuffer())),
      fetchOk(sitesUrl).then((r) => r.json()).catch(() => []),
      okJson(landmarksUrl), okJson(landersUrl),
    ]);
    if (destroyed) return;
    heights = new Float32Array(hb, 0, nx * ny);
    if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) { // big-endian host
      const dv = new DataView(hb);
      heights = Float32Array.from({ length: nx * ny }, (_, i) => dv.getFloat32(i * 4, true));
    }
    hMin = Infinity; hMax = -Infinity;
    for (let i = 0; i < heights.length; i++) { const v = heights[i]; if (v < hMin) hMin = v; if (v > hMax) hMax = v; }
    sites = (Array.isArray(sj) ? sj : []).filter((s) => Number.isFinite(s.x_m) && Number.isFinite(s.y_m)).map((s) => ({ ...s }));
    buildTerrain();
    const inMap = (o) => Math.abs(o.x_m) <= grid.half * 1000 && Math.abs(o.y_m) <= grid.half * 1000;
    landmarks = (Array.isArray(lmj) ? lmj : []).filter((m) => hasXY(m) && inMap(m)).map((m) => ({ ...m, tier: m.tier ?? 3 }));
    landers = (Array.isArray(ldj) ? ldj : []).filter((l) => hasXY(l) && l.in_view === true && LD_ICON[l.kind] && inMap(l)).map((l) => ({ ...l }));
    buildOverlay();
    buildOrientation();
    applySize();
    resetCam3();
    if (view === '2d') { view = '3d'; setView('2d', { animate: false }); }
    slider.max = Math.max(1, ds.n - 1);
    setT(t, { snap: true });
    startDataset(ds);
    // other periods: fetch meta now so the switch is instant, frames on first use
    for (const d of datasets) if (d !== ds) openDataset(d).catch(() => {});
    dirty = true;
  })();
  ready.catch((e) => {
    if (destroyed || e?.name === 'AbortError') return;
    msg.textContent = T.noData;
    console.error('[lunar-map]', e);
  });

  // centre the view on a map point (navigator: the selected site or pin), Earth side up
  // fly to a map point (navigator: the selected site or pin), Earth side up. o.dur ms (default 1300), o.polar
  // (default the oblique home view; ~0 = straight down). Distance changes geometrically, so a long way down reads
  // as one smooth glide. Resolves when the camera arrives.
  function focusOn(x_m, y_m, halfKm = 25, o = {}) {
    const tx = x_m / 1000, tz = -y_m / 1000;
    if (view === '2d') {
      ctl2.target.set(tx, 0, tz); cam2.position.set(tx, 1500, tz);
      cam2.zoom = clamp(ortHalf() / halfKm, ctl2.minZoom, ctl2.maxZoom); cam2.updateProjectionMatrix(); ctl2.update();
      dirty = true; return Promise.resolve();
    }
    const s = new THREE.Spherical().setFromVector3(cam3.position.clone().sub(ctl3.target));
    const r = clamp(o.r ?? halfKm / Math.tan(FOV * DEG / 2) * 1.4, ctl3.minDistance, ctl3.maxDistance);
    const instant = o.dur === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches;
    ctl3.enabled = false;
    if (tween) { const d = tween.done; tween = null; d(true); }
    return new Promise((res) => {
      tween = { t0: performance.now(), dur: instant ? 1 : (o.dur ?? 1300), from: { r: s.radius, polar: s.phi, az: s.theta, tx: ctl3.target.x, tz: ctl3.target.z }, to: { r, polar: o.polar ?? home.polar, az: 0, tx, tz }, ty: ctl3.target.y, toY: (() => { try { const y = yAt(x_m, y_m); return Number.isFinite(y) ? y : null; } catch { return null; } })(),   // the site itself at the screen centre
        done: () => { ctl3.enabled = true; ctl3.update(); dirty = true; res(); } };
      dirty = true;
    });
  }
  // put the 3D camera somewhere at once (no tween): above map point (x_m, y_m) at r km, polar angle from straight down
  function setCamera(x_m, y_m, r, polar = 0.0005) {
    if (tween) { const d = tween.done; tween = null; d(true); }
    ctl3.target.set(x_m / 1000, 0, -y_m / 1000);
    sph(ctl3.target, clamp(r, ctl3.minDistance, ctl3.maxDistance), polar, 0, cam3.position);
    cam3.up.set(0, 1, 0); cam3.lookAt(ctl3.target); ctl3.update(); dirty = true;
  }

  raf = requestAnimationFrame(frame);

  return {
    ready,
    setFrame(i) { setPlaying(false); setT(i, { snap: true }); },
    getFrame: () => Math.round(t),
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    setMode,
    setView,
    setDataset,
    setExaggeration: setExag,
    focus: focusOn,
    setCamera,
    setMarks(list) { marks = list || []; dirty = true; },
    setPins(list) { for (const p of pins) p.el?.remove(); pins = (list || []).map((p) => ({ ...p })); dirty = true; },
    // GO mask from the host: a canvas over +-200 km (row 0 = Earth side), red = GO; null turns it off
    setMask(cv) {
      if (!cv) { uniforms.uMaskOn.value = 0; dirty = true; return; }
      let tx = uniforms.uMask.value;
      if (!tx || tx === blank || tx.image !== cv) { tx = new THREE.CanvasTexture(cv); tx.flipY = false; tx.magFilter = tx.minFilter = THREE.LinearFilter; tx.generateMipmaps = false; uniforms.uMask.value = tx; }
      tx.needsUpdate = true; uniforms.uMaskOn.value = 1; dirty = true;
    },
    getCam,
    setCam,
    setInsets,
    setCells,
    setDetail(list) { clearDetail(); for (const d of list || []) addDetail(d); dirty = true; },
    setMast(h, x_m, y_m, label) { mastPt = h > 0 ? { h, x: x_m, y: y_m, label: label || `${h} m` } : null; if (mastEl) mastEl._h = null; dirty = true; },
    selectSite(id) { selSite = sites.find((s) => s.id === id) ?? null; stripDirty = true; dirty = true; },
    loaded: () => ({ loaded: ds.loaded, total: ds.n }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      abort.abort();
      ro.disconnect();
      for (const d of datasets) clearTimeout(d.timer);
      ctl3.dispose(); ctl2.dispose();
      clearDetail();
      for (const d of disposables) d.dispose();
      renderer.dispose();
      root.remove();
      if (--instances === 0) document.getElementById(STYLE_ID)?.remove();
    },
  };
}
