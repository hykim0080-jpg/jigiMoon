// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Location in words. Pure functions, no DOM.
import { t, siteName } from './strings.js';

let LM = [];
export function setLandmarks(list) {
  LM = list.map(l => ({ ...l, x: l.x_m / 1000, y: l.y_m / 1000, R: l.diameter_km ? l.diameter_km / 2 : (l.radius_km || 0) }));
}
export const landmarks = () => LM;

// degrees clockwise from map-up (toward Earth)
export const bearing = (dx, dy) => (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
export const sector = th => Math.round(th / 45) % 8;
const fmt = d => (d >= 10 ? String(Math.round(d)) : d.toFixed(1));

export const moveShort = (dx, dy) => t('mvShort')[sector(bearing(dx, dy))];
export const movePhrase = (dx, dy) => t('mv')[sector(bearing(dx, dy))];

// Same rule as lunar/orientation/orientation.py describe() (11-14 revision).
// reach = crater radius (rim), half the Gazetteer radius for massifs/ridges (their core), 0 for points
const MASSIF_CORE = 0.5, BESIDE_KM = 10;
const reach = l => l.kind === 'crater' ? l.R : (l.kind === 'massif' || l.kind === 'ridge') ? l.R * MASSIF_CORE : 0;

// tier <= 2 landmark with the smallest gap to its reach; ties (inside several) -> smallest d / reach
export function anchorOf(site) {
  const sx = site.x_m / 1000, sy = site.y_m / 1000;
  let best = null;
  for (const l of LM) {
    if (l.tier > 2) continue;
    const d = Math.hypot(sx - l.x, sy - l.y), r = reach(l), gap = Math.max(d - r, 0), tie = r ? d / r : d;
    if (!best || gap < best.gap || (gap === best.gap && tie < best.tie)) best = { l, d, r, gap, tie, dx: sx - l.x, dy: sy - l.y };
  }
  return best;
}

export function where(site) {
  const a = anchorOf(site);
  if (!a) return '';
  const { l, d, r, gap } = a, name = siteName(l), sec = t('secs')[sector(bearing(a.dx, a.dy))], crater = l.kind === 'crater';
  if (d < 0.5 || (!crater && gap === 0 && d < 0.25 * r)) return t('wAt', name);
  if (crater && Math.abs(d - r) <= Math.max(1.5, 0.15 * r)) return t('wRim', name, sec);
  if (crater && d < r) return t('wInside', name, sec, Math.round(d));
  if (gap === 0) return t('wOn', name, sec);
  if (gap < BESIDE_KM) return t('wBeside', name, sec);
  return t('wAway', name, sec, Math.round(gap));
}

export const fmtLatLon = (lat, lon) => `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(1)}° ${lon < 0 ? 'W' : 'E'}`;
