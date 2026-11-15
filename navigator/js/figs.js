// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// MAST side view and size references, drawn in metres: an astronaut (1.8 m tall) and a generic small lander (4 m).
// Pure strings, no DOM, so 2D, 3D and the side card share them.

// astronaut facing right, feet at (0,0), y up is negative; 1.8 m tall, ~0.9 m wide
const ASTRO = `<g class="fig-astro">
<rect x="-0.44" y="-1.42" width="0.26" height="0.58" fill="#aeb6c4"/>
<path d="M-0.2 -1.36h0.42l0.07 0.5h-0.1v0.06h-0.39z" fill="#e6e9ef"/>
<path d="M-0.17 -0.8h0.16l-0.02 0.74h-0.13zM0.03 -0.8h0.16l0.02 0.74h-0.13z" fill="#e6e9ef"/>
<path d="M-0.2 -0.07h0.17v0.07h-0.2zM0.05 -0.07h0.2v0.07h-0.19z" fill="#8c95a6"/>
<path d="M0.16 -1.3l0.17 0.34-0.05 0.22h-0.09l0.03-0.2-0.12-0.22z" fill="#e6e9ef"/>
<circle cx="0.04" cy="-1.56" r="0.21" fill="#e6e9ef"/>
<path d="M0.08 -1.68a0.15 0.15 0 0 1 0.15 0.14 0.15 0.15 0 0 1-0.15 0.11z" fill="#d9a441"/>
<rect x="-0.12" y="-1.2" width="0.16" height="0.1" fill="#4fc0c9"/>
</g>`;

// startled (MAST fix 15 m and up): turned to the mast, leaning back, head tipped up to its top, one arm thrown up
const ASTRO_UP = ASTRO.replace(`<circle cx="0.04" cy="-1.56" r="0.21" fill="#e6e9ef"/>
<path d="M0.08 -1.68a0.15 0.15 0 0 1 0.15 0.14 0.15 0.15 0 0 1-0.15 0.11z" fill="#d9a441"/>`, `<g transform="rotate(-32 0.02 -1.38)"><circle cx="0.04" cy="-1.56" r="0.21" fill="#e6e9ef"/>
<path d="M0.08 -1.68a0.15 0.15 0 0 1 0.15 0.14 0.15 0.15 0 0 1-0.15 0.11z" fill="#d9a441"/></g>`).replace(`<path d="M0.16 -1.3l0.17 0.34-0.05 0.22h-0.09l0.03-0.2-0.12-0.22z" fill="#e6e9ef"/>`, `<g transform="rotate(-125 0.17 -1.28)"><path d="M0.16 -1.3l0.17 0.34-0.05 0.22h-0.09l0.03-0.2-0.12-0.22z" fill="#e6e9ef"/></g>`);

// lander, 4 m tall, ~4 m wide footprint, feet at y=0, centred on x=0
const LANDER = `<g class="fig-lander">
<path d="M-1.1 -2.3-1.7 0M1.1 -2.3 1.7 0" stroke="#8c95a6" stroke-width="0.09"/>
<path d="M-0.6 -2.2-0.9 0M0.6 -2.2 0.9 0" stroke="#5f6878" stroke-width="0.07"/>
<path d="M-1.95 -0.05h0.5v0.05h-0.5zM1.45 -0.05h0.5v0.05h-0.5z" fill="#8c95a6"/>
<path d="M-0.28 -1.9h0.56l0.18 0.5h-0.92z" fill="#5f6878"/>
<rect x="-1.25" y="-3.15" width="2.5" height="1.25" fill="#c9a24a"/>
<path d="M-1.25 -2.75h2.5M-1.25 -2.35h2.5" stroke="#9c7b30" stroke-width="0.04"/>
<rect x="-0.9" y="-3.55" width="1.8" height="0.4" fill="#aeb6c4"/>
<path d="M0.55 -3.55v-0.3" stroke="#aeb6c4" stroke-width="0.05"/>
<path d="M0.35 -3.95a0.25 0.25 0 0 0 0.45 0.12z" fill="#e6e9ef"/>
<rect x="-1.9" y="-3.3" width="0.65" height="0.9" fill="#3a5a8c" stroke="#8c95a6" stroke-width="0.03"/>
</g>`;

// both figures at k px per metre, side by side on the same ground (for the maps, when zoomed in far enough)
export function SCALE_FIGS(k) {
  const w = 5.2 * k, h = 4 * k;
  return `<svg width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="-0.6 -4 5.2 4"><g>${ASTRO}</g><g transform="translate(2.6 0)">${LANDER}</g></svg>`;
}

// side view of the MAST fix: pole of h metres with an antenna dish, an astronaut and a lander at the same scale,
// a metre scale, and (target 'earth' | 'sun') the line of sight from the top clearing a ridge the ground cannot see past
// slope: the place's ground slope in degrees, drawn at its true angle rising toward the ridge (the pole stays plumb)
export function mastSide(h, target = 'earth', slope = 0) {
  const W = 300, G = 150, TOP = 16, hm = Math.max(h, 5) + 1, k = (G - TOP) / hm;
  const step = hm > 14 ? 5 : 2, X0 = 34, XP = 62, XA = 84, XL = 128;
  const ga = -Math.min(Math.max(slope || 0, 0), 30), tg = Math.tan(ga * Math.PI / 180), gy = x => G + (x - XP) * tg;
  let s = `<svg class="mastside-svg" viewBox="0 0 ${W} ${Math.max(168, Math.ceil(gy(0) + 18))}" role="img">`;
  // scale
  s += `<path d="M${X0} ${G}V${(G - Math.floor(hm / step) * step * k).toFixed(1)}" stroke="#5a6377" stroke-width="1"/>`;
  const last = Math.floor(hm / step) * step;
  for (let m = 0; m <= hm; m += step) {
    const y = (G - m * k).toFixed(1);
    s += `<path d="M${X0 - 4} ${y}h4" stroke="#5a6377"/><text x="${X0 - 7}" y="${(+y + 4).toFixed(1)}" text-anchor="end" class="ms-tick">${m}${m === last ? ' m' : ''}</text>`;
  }
  // ridge and sight lines
  const yTop = G - h * k, yLow = G - 1.5 * k, EX = 288, EY = 18, XR = 226, f = (XR - XP) / (EX - XP);
  const at = y0 => y0 + (EY - y0) * f, peak = (at(yTop) + at(yLow)) / 2;
  const col = target === 'sun' ? '#f0a531' : '#74a2f2';
  const XD = XR + 8;
  s += `<path d="M${XP} ${yLow.toFixed(1)}L${XD} ${(yLow + (EY - yLow) * (XD - XP) / (EX - XP)).toFixed(1)}" stroke="#f0655a" stroke-width="1.2" stroke-dasharray="4 3"/>`;
  s += `<path d="M184 ${gy(184).toFixed(1)}Q${XR - 18} ${(peak + 20).toFixed(1)} ${XR} ${peak.toFixed(1)}Q${XR + 26} ${(peak + 10).toFixed(1)} ${W} ${Math.min(peak + 40, gy(W)).toFixed(1)}L${W} ${gy(W).toFixed(1)}z" fill="#2a303c"/>`;
  s += `<path d="M${XP} ${yTop.toFixed(1)}L${EX} ${EY}" stroke="${col}" stroke-width="1.4"/>`;
  s += target === 'sun'
    ? `<circle cx="${EX}" cy="${EY}" r="7" fill="#f0a531"/>`
    : `<circle cx="${EX}" cy="${EY}" r="7" fill="#2f5fa8"/><path d="M${EX - 4} ${EY - 3}q3-2 5 0t3 4q-3 1-4-1t-4-3z" fill="#5fae6a"/>`;
  // ground
  s += `<path d="M0 ${gy(0).toFixed(1)}L${W} ${gy(W).toFixed(1)}" stroke="#8c95a6" stroke-width="1.2"/>`;
  // pole, dish, label
  s += `<path d="M${XP} ${G}V${yTop.toFixed(1)}" stroke="var(--mast)" stroke-width="${Math.max(2, 0.2 * k).toFixed(1)}"/>`;
  s += `<path d="M${XP - 6} ${(yTop - 3).toFixed(1)}a7 7 0 0 0 11 6z" fill="var(--mast)" transform="rotate(-25 ${XP} ${yTop.toFixed(1)})"/>`;
  s += `<text x="${XP + 8}" y="${(yTop + 16).toFixed(1)}" class="ms-lab">${h} m</text>`;
  // figures at k px per metre
  const xl = XL + 2 * k, fig = (x, f) => `<g transform="translate(${x.toFixed(1)} ${gy(x).toFixed(1)}) rotate(${ga}) scale(${k.toFixed(3)})">${f}</g>`;
  s += fig(XA, ASTRO) + fig(xl, LANDER);
  s += `<text x="${XA}" y="${(gy(XA) + 15).toFixed(1)}" text-anchor="middle" class="ms-tick">1.8</text><text x="${xl.toFixed(1)}" y="${(gy(xl) + 15).toFixed(1)}" text-anchor="middle" class="ms-tick">4</text>`;
  return s + '</svg>';
}

// the lander as it would stand, at k px per metre: the mast (h > 0) rising from its deck with a pair of solar panels
// at the top (their centre h m above the ground, the height the calculation uses; a mast lower than the deck shows as
// panels just above it), and the astronaut beside it. Ground centre of the lander = middle of the bottom edge.
// fx stages why a NO-GO place fails, on the model itself: cold (too little Sun or too long dark: frost, pale blue,
// dark panels, astronaut hunched), comm (Earth too little in view: the signal from the dish breaks off before a greyed
// Earth), slope (degrees; the lander tips at that angle about its downhill foot, the other leg off the ground)
export function MAST_RIG(h, k, fx = {}) {
  // ground: the slope as seen from the camera (degrees, + = downhill to the right): the ground line, lander and astronaut
  // tilt with it; the mast stands plumb from the deck. slope (NO-GO, steeper than the limit): the lander also tips
  // about its downhill foot, the uphill leg off the ground
  const g = Math.max(-40, Math.min(40, fx.ground || 0)), sg = g < 0 ? -1 : 1, tip = Math.min(fx.slope || 0, 35) * sg;
  const top = Math.max(h, 4.3), W = 3.8, rad = Math.PI / 180;
  const pw = Math.max(0.14, 2 / k), deck = 3.55, lw = (px) => Math.max(px / k, 0.02);
  const rot = (x, y, a, cx = 0, cy = 0) => { const c = Math.cos(a * rad), sn = Math.sin(a * rad); return [cx + (x - cx) * c - (y - cy) * sn, cy + (x - cx) * sn + (y - cy) * c]; };
  const [dx, dy] = rot(...rot(0, -deck, tip, 1.7 * sg, 0), g);   // the deck's centre, after tipping and the ground's tilt
  const gy = dx * Math.tan(g * rad), py = gy - top;               // panels' centre: h m above the ground under the mast
  const lift = W * Math.abs(Math.sin(g * rad)) + (tip ? 2 * Math.abs(Math.sin(tip * rad)) : 0);
  const H = Math.max(h > 0 ? -py + 0.85 : 4.1, fx.comm ? 5.6 : 0) + lift;
  const pfill = fx.cold ? '#2a2f3a' : '#1f3f72', pline = fx.cold ? '#5a6377' : '#9fc1ef';
  const panel = (sd) => {   // one wing, outer edge lifted a little: tilted up toward the low Sun
    const x0 = dx + sd * (pw / 2 + 0.06), x1 = dx + sd * 1.45, y = py;
    const mid = (x0 + x1) / 2;
    return `<polygon points="${x0},${y - 0.6} ${x1},${y - 0.72} ${x1},${y + 0.48} ${x0},${y + 0.6}" fill="${pfill}" stroke="${pline}" stroke-width="${lw(1)}"/>`
      + `<path d="M${mid} ${y - 0.66}V${y + 0.54}M${x0} ${y}L${x1} ${y - 0.12}" stroke="${pline}" stroke-width="${lw(0.7)}" opacity=".7"/>`;
  };
  const mast = h > 0 ? (py < dy ? `<rect x="${dx - pw / 2}" y="${py}" width="${pw}" height="${dy - py}" fill="#4fc0c9"/>` : '')
    + panel(-1) + panel(1) + `<rect x="${dx - pw}" y="${py - 0.08}" width="${2 * pw}" height="0.16" fill="#4fc0c9"/>` : '';
  let lander = LANDER;
  if (fx.cold) {   // frost: a pale blue film over the body, icicles under the deck, crystals on the top
    lander += `<rect x="-1.3" y="-3.6" width="2.6" height="1.75" fill="#bfe3ff" opacity=".42"/>`
      + `<rect x="-1.95" y="-3.35" width="0.75" height="1" fill="#2a2f3a" opacity=".85"/>`
      + [-1.1, -0.7, -0.3, 0.1, 0.5, 0.9].map((x, i) => `<path d="M${x} -1.9l0.07 ${0.22 + (i % 3) * 0.08}l0.07 -${0.22 + (i % 3) * 0.08}z" fill="#e6f4ff"/>`).join('')
      + [[-0.7, -3.75], [0.15, -3.8], [0.95, -3.7]].map(([x, y]) => `<path d="M${x - 0.13} ${y}h0.26M${x} ${y - 0.13}v0.26M${x - 0.09} ${y - 0.09}l0.18 0.18M${x + 0.09} ${y - 0.09}l-0.18 0.18" stroke="#e6f4ff" stroke-width="${lw(1)}"/>`).join('');
  }
  let earth = '';
  if (fx.comm) {   // from the dish (0.57, -3.95): arcs toward Earth, up and to the right, breaking off; Earth greyed out
    const ox = 0.57, oy = -3.95, arc = (r, o, dash) => {
      const a0 = -80 * rad, a1 = -20 * rad;
      return `<path d="M${(ox + r * Math.cos(a0)).toFixed(2)} ${(oy + r * Math.sin(a0)).toFixed(2)}A${r} ${r} 0 0 1 ${(ox + r * Math.cos(a1)).toFixed(2)} ${(oy + r * Math.sin(a1)).toFixed(2)}" fill="none" stroke="#74a2f2" stroke-width="${lw(2)}" opacity="${o}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
    };
    lander += arc(0.45, 1) + arc(0.8, 0.7, '0.25 0.15') + arc(1.15, 0.35, '0.12 0.3');
    earth = `<circle cx="${ox + 1.9}" cy="${oy - 1.1 - lift}" r="0.32" fill="#3a3f4a" stroke="#6b7385" stroke-width="${lw(1)}"/>`
      + `<path d="M${ox + 1.67} ${oy - 0.87 - lift}l0.46 -0.46" stroke="#f0655a" stroke-width="${lw(2)}"/>`;
  }
  if (tip) lander = `<g transform="rotate(${tip.toFixed(1)} ${1.7 * sg} 0)">${lander}</g>`;
  const astro = fx.cold ? `<g transform="translate(2.65 0) rotate(7 0 0) scale(1 0.88)">${ASTRO}</g>`
    : h >= 15 ? `<g transform="translate(2.65 0) scale(-1 1)"><g class="fig-startle"><g transform="rotate(-9)">${ASTRO_UP}</g></g></g>`
    : `<g transform="translate(2.65 0)">${ASTRO}</g>`;
  const ground = g ? `<path d="M${-W} 0H${W}" stroke="#c9cfdb" stroke-width="${lw(1.5)}" opacity=".7"/>` : '';
  const tint = fx.cold ? '<rect x="-3.6" y="-0.02" width="7.2" height="0.02" fill="#bfe3ff"/>' : '';
  const svg = `<svg width="${(2 * W * k).toFixed(1)}" height="${(H * k).toFixed(1)}" viewBox="${-W} ${-H} ${2 * W} ${H}" style="overflow:visible"><g transform="rotate(${g.toFixed(1)})">${ground}${astro}${lander}${tint}</g>${mast}${earth}</svg>`;
  return { svg, w: 2 * W * k, h: H * k };
}
