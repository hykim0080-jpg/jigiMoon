// Landmarks, landers and relative-position text (port of lunar/orientation/orientation.py describe()).
export const SECTORS = ['지구 쪽', '지구 쪽 오른편', '오른쪽', '지구 반대쪽 오른편', '지구 반대쪽', '지구 반대쪽 왼편', '왼쪽', '지구 쪽 왼편'];
import { lang } from './strings.js';
export const SECTORS_EN = ['Earthward', 'Earthward-right', 'right', 'anti-Earth right', 'anti-Earth', 'anti-Earth left', 'left', 'Earthward-left'];
export const lmName = L => (lang === 'ko' && L.name_ko) || L.name;
export const sectorOf = (dx, dy) => (lang === 'ko' ? SECTORS : SECTORS_EN)[Math.floor((((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360) + 22.5) % 360 / 45)];
// "지구 쪽 오른편 1.5 km" / "Earthward-right 1.5 km"
export const dirText = (dx_m, dy_m) => { const d = Math.hypot(dx_m, dy_m) / 1000; return `${sectorOf(dx_m, dy_m)} ${d < 10 ? d.toFixed(1) : Math.round(d)} km`; };
const SEC_EN_PY = ['Earth side', 'Earth-right side', 'right side', 'back-right side', 'back side', 'back-left side', 'left side', 'Earth-left side'];
const reach = L => { const r = L.radius_km || 0; return L.kind === 'crater' ? r : (L.kind === 'massif' || L.kind === 'ridge') ? 0.5 * r : 0; };
// port of lunar/orientation/orientation.py describe() (rule revised 11-14: rim / massif core / point reach)
// the landmark describe() names for a point (language independent)
export function anchorOf(x, y, lms, maxTier = 2) {
  let best = null;
  for (const L of lms) {
    if (L.tier > maxTier) continue;
    const d = Math.hypot(x - L.x_m, y - L.y_m) / 1000, r = reach(L), k0 = Math.max(d - r, 0), k1 = r ? d / r : d;
    if (!best || k0 < best.k0 || (k0 === best.k0 && k1 < best.k1)) best = { k0, k1, L };
  }
  return best ? best.L : null;
}
export function describe(x, y, lms, maxTier = 2) {
  let best = null;
  for (const L of lms) {
    if (L.tier > maxTier) continue;
    const d = Math.hypot(x - L.x_m, y - L.y_m) / 1000, r = reach(L);
    const k0 = Math.max(d - r, 0), k1 = r ? d / r : d;
    if (!best || k0 < best.k0 || (k0 === best.k0 && k1 < best.k1)) best = { k0, k1, d, L };
  }
  if (!best) return '';
  const { d, L } = best, gap = best.k0, r = reach(L), crater = L.kind === 'crater';
  const bearing = (Math.atan2(x - L.x_m, y - L.y_m) * 180 / Math.PI + 360) % 360, si = Math.floor(((bearing + 22.5) % 360) / 45);
  const sec = SECTORS[si], sen = SEC_EN_PY[si], ko = L.name_ko || L.name, en = L.name, ke = lang === 'en';
  if (d < 0.5 || (!crater && gap === 0 && d < 0.25 * r)) return ke ? `at ${en}` : ko;
  if (crater && Math.abs(d - r) <= Math.max(1.5, 0.15 * r)) return ke ? `${en} rim, ${sen}` : `${ko} 테두리 (${sec})`;
  if (crater && d < r) return ke ? `inside ${en}, ${sen}, ${d.toFixed(0)} km from centre` : `${ko} 안 (${sec}, 중심에서 ${d.toFixed(0)} km)`;
  if (gap === 0) return ke ? `on ${en}, ${sen}` : `${ko} 위 (${sec})`;
  if (gap < 10) return ke ? `beside ${en}, ${sen}` : `${ko} 옆 (${sec})`;
  return ke ? `${gap.toFixed(0)} km from ${en}, ${sen}` : `${ko}에서 ${sec}으로 ${gap.toFixed(0)} km`;
}
const KINDS = ['landed', 'impact', 'crash', 'planned'];   // candidate_region kinds duplicate the site boxes
export const drawableLanders = ls => ls.filter(l => l.in_view && l.x_m != null && KINDS.includes(l.kind));
// symbol path centred on 0,0 (screen px)
export function landerPath(kind) {
  if (kind === 'landed') return 'M0 -5L4.5 3.5H-4.5Z';
  if (kind === 'planned') return 'M0 -5L5 0L0 5L-5 0Z';
  return 'M-4 -4L4 4M4 -4L-4 4';
}
export const landerLabel = l => `${l.name.replace(/ \(planned site\)| impact$/, '')} ${l.year}`;
