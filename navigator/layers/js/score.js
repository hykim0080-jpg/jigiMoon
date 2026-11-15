// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// How a candidate spot scores for a landing day, shared by Find a site's ranked list (trip.js) and Detail's best spots
// (js/rank3d.js): judged from the ground (2 m) first, then with a 10 m and a 20 m mast; the lowest height that passes is
// the spot's mast. Score = how far it clears the criteria (+ a small lift for ice-likely shade within 10 km) minus a
// cost for the mast, so ground spots come first and a taller mast ranks lower.
export const MASTS = [2, 10, 20];
export const MAST_COST = { 2: 0, 10: 0.3, 20: 0.6 };
export const passes = (w, d, c) => w.sun[d] >= c.sun - 1e-9 && w.earth[d] >= c.earth - 1e-9 && w.dark[d] <= c.dark;
export const marginOf = (w, d, c, iceKm) => (w.sun[d] - c.sun) / c.sun + (w.earth[d] - c.earth) / c.earth + (c.dark - w.dark[d]) / c.dark + (iceKm == null || iceKm > 10 ? 0 : 0.25 * (1 - iceKm / 10));
// ws = { 2: series, 10: series, 20: series } (each { sun, earth, dark } per landing day; a missing one is skipped)
// -> { mast, w, score } for the lowest mast that passes, or null
export function bestMast(ws, d, c, iceKm) {
  for (const m of MASTS) { const w = ws[m]; if (w && passes(w, d, c)) return { mast: m, w, score: marginOf(w, d, c, iceKm) - MAST_COST[m] }; }
  return null;
}
