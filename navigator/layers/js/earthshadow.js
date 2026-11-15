// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Earth shadow overlay of mode B: like the Sun shadow, but with the Earth as the light source.
// Pixels where the Earth is below the local horizon mask at the chosen day/hour have no line of sight to Earth (no direct radio contact).
// Earth direction: hourly moon-fixed vector B.E from time.js bodies() (built from the sky series' earth_az/earth_el).
import { paintEarth } from '../../js/shadow.js';

let cv = null, painted = '';
export const earthCanvas = () => painted !== '' ? cv : null;
// B = { S, E, n } from time.js; returns true when the canvas shows st.tDay/st.tHour
export function syncEarth(st, B) {
  const key = Math.min(B.n - 1, st.tDay * 24 + st.tHour); if (painted === key) return true;
  cv = cv || document.createElement('canvas');
  const o = key * 3;
  if (paintEarth(cv, B.E.subarray(o, o + 3))) { painted = key; return true; }
  return false;
}
