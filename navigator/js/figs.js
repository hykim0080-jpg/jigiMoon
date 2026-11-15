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
export function mastSide(h, target = 'earth') {
  const W = 300, G = 150, TOP = 16, hm = Math.max(h, 5) + 1, k = (G - TOP) / hm;
  const step = hm > 14 ? 5 : 2, X0 = 34, XP = 62, XA = 84, XL = 128;
  let s = `<svg class="mastside-svg" viewBox="0 0 ${W} 168" role="img">`;
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
  s += `<path d="M184 ${G}Q${XR - 18} ${(peak + 20).toFixed(1)} ${XR} ${peak.toFixed(1)}Q${XR + 26} ${(peak + 10).toFixed(1)} ${W} ${(peak + 40).toFixed(1)}V${G}z" fill="#2a303c"/>`;
  s += `<path d="M${XP} ${yTop.toFixed(1)}L${EX} ${EY}" stroke="${col}" stroke-width="1.4"/>`;
  s += target === 'sun'
    ? `<circle cx="${EX}" cy="${EY}" r="7" fill="#f0a531"/>`
    : `<circle cx="${EX}" cy="${EY}" r="7" fill="#2f5fa8"/><path d="M${EX - 4} ${EY - 3}q3-2 5 0t3 4q-3 1-4-1t-4-3z" fill="#5fae6a"/>`;
  // ground
  s += `<path d="M0 ${G}H${W}" stroke="#8c95a6" stroke-width="1.2"/>`;
  // pole, dish, label
  s += `<path d="M${XP} ${G}V${yTop.toFixed(1)}" stroke="var(--mast)" stroke-width="${Math.max(2, 0.2 * k).toFixed(1)}"/>`;
  s += `<path d="M${XP - 6} ${(yTop - 3).toFixed(1)}a7 7 0 0 0 11 6z" fill="var(--mast)" transform="rotate(-25 ${XP} ${yTop.toFixed(1)})"/>`;
  s += `<text x="${XP + 8}" y="${(yTop + 16).toFixed(1)}" class="ms-lab">${h} m</text>`;
  // figures at k px per metre
  s += `<g transform="translate(${XA} ${G}) scale(${k.toFixed(3)})">${ASTRO}</g>`;
  s += `<g transform="translate(${XL + 2 * k} ${G}) scale(${k.toFixed(3)})">${LANDER}</g>`;
  s += `<text x="${XA}" y="${G + 15}" text-anchor="middle" class="ms-tick">1.8</text><text x="${(XL + 2 * k).toFixed(1)}" y="${G + 15}" text-anchor="middle" class="ms-tick">4</text>`;
  return s + '</svg>';
}
