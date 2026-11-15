// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Shared by Detail and Find a site: the lighting frames of the 3D map (4 h steps) exist for Feb, Jun and Dec 2027.
// Other dates show the same day-of-month and hour of the nearest computed month.
export const SETS = [{ label: '2027-02', url: 'data/3d/frames_feb/', y: 2027, m: 1 }, { label: '2027-06', url: 'data/3d/frames/', y: 2027, m: 5 }, { label: '2027-12', url: 'data/3d/frames_dec/', y: 2027, m: 11 }];
export const STEP_H = 4;
const T0 = Date.UTC(2027, 0, 1);
// day = days since 1 Jan 2027, hour = hours from that day's 00:00 UTC (may run past 24)
export function frameFor(day, hour) {
  const ms = T0 + (day * 24 + hour) * 3600e3, d = new Date(ms);
  const mon = d.getUTCMonth(), dist = m => Math.min(Math.abs(mon - m), 12 - Math.abs(mon - m));
  let k = 0;
  SETS.forEach((S, j) => { if (dist(S.m) < dist(SETS[k].m)) k = j; });
  const S = SETS[k];
  const exact = d.getUTCFullYear() === S.y && mon === S.m;
  const t0 = Date.UTC(S.y, S.m, 1), dim = new Date(Date.UTC(S.y, S.m + 1, 0)).getUTCDate();
  const tt = exact ? ms : Date.UTC(S.y, S.m, Math.min(d.getUTCDate(), dim), d.getUTCHours());
  const i = Math.max(0, Math.round((tt - t0) / (STEP_H * 3600e3)));
  return { k, i, exact, shown: t0 + i * STEP_H * 3600e3 };
}
