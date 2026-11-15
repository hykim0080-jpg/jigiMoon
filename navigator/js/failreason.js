// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Why a NO-GO day has no fix within the limits, as one sentence (en / ko).
// Copy text and rules from the site-data thread (space-apps/ux-text). Inputs follow navigator/js/data.js loadSite():
//   site = { cal: {sun, earth, dark, noComm}           365-day arrays (%, %, h, h)
//            mast: {sun: {h: [365]}, earth: {...}, dark: {...}} | null   (heights as strings '2'..'100')
//            grid: [{dx, dy, landable, slope, sun?, earth?, dark?}]       relocation cells (km), arrays 365
//            sky:  {horizon, azStep, sunAz, sunEl, sunFrac, earthAz, earthEl, earthVis}  hourly from 2027-01-01 }
//   day = landing day index (0 = 1 Jan 2027), crit = {sun, earth, dark}, lim = {move, mast, wait}, mission = 6 | 14
// Usage: failReason(failStats(site, day, crit, lim, mission), lang)  ->  {code, text}

const pass = (c, s, e, k) => s >= c.sun && e >= c.earth && k <= c.dark;

function horizonAt(sky, az) {
  const n = sky.horizon.length, f = ((az % 360) + 360) % 360 / sky.azStep, i = Math.floor(f) % n, j = (i + 1) % n;
  return sky.horizon[i] + (sky.horizon[j] - sky.horizon[i]) * (f - Math.floor(f));
}

// Collect what every lever can reach on this day, plus physical numbers for the explanation.
export function failStats(site, day, crit, lim, mission) {
  const N = 365, c = site.cal, opts = [];
  opts.push({ lever: 'base', sun: c.sun[day], earth: c.earth[day], dark: c.dark[day] });
  for (let j = 1; j <= lim.wait && day + j < N; j++)
    opts.push({ lever: 'wait', v: j, sun: c.sun[day + j], earth: c.earth[day + j], dark: c.dark[day + j] });
  if (site.mast) for (const h of Object.keys(site.mast.sun).map(Number).filter(h => h <= lim.mast))
    opts.push({ lever: 'mast', v: h, sun: site.mast.sun[h][day], earth: site.mast.earth[h][day], dark: site.mast.dark[h][day] });
  const cells = (site.grid || []).filter(g => Math.hypot(g.dx, g.dy) <= lim.move + 1e-9);
  const landable = cells.filter(g => g.landable && g.sun);
  for (const g of landable) opts.push({ lever: 'move', v: Math.hypot(g.dx, g.dy), sun: g.sun[day], earth: g.earth[day], dark: g.dark[day] });

  // best value of each criterion over all options, and which criteria fail in every option
  const best = { sun: Math.max(...opts.map(o => o.sun)), earth: Math.max(...opts.map(o => o.earth)), dark: Math.min(...opts.map(o => o.dark)) };
  const unreachable = ['sun', 'earth', 'dark'].filter(k => k === 'dark' ? best.dark > crit.dark : best[k] < crit[k]);

  // beyond the limits: first GO day later in the year, lowest mast that would do it
  let nextOk = null;
  for (let j = lim.wait + 1; day + j < N; j++) if (pass(crit, c.sun[day + j], c.earth[day + j], c.dark[day + j])) { nextOk = j; break; }
  let mastNeeded = null;
  if (site.mast) for (const h of Object.keys(site.mast.sun).map(Number).sort((a, b) => a - b))
    if (h > lim.mast && pass(crit, site.mast.sun[h][day], site.mast.earth[h][day], site.mast.dark[h][day])) { mastNeeded = h; break; }

  // physics over the mission window: how far the Sun / Earth get above the local skyline
  let sunMargin = null, earthMargin = null;
  if (site.sky) {
    const a = day * 24, b = Math.min(a + mission * 24, site.sky.sunEl.length);
    sunMargin = -Infinity; earthMargin = -Infinity;
    for (let i = a; i < b; i++) {
      sunMargin = Math.max(sunMargin, site.sky.sunEl[i] - horizonAt(site.sky, site.sky.sunAz[i]));
      earthMargin = Math.max(earthMargin, site.sky.earthEl[i] - horizonAt(site.sky, site.sky.earthAz[i]));
    }
  }
    // closest option: smallest summed relative shortfall
  const short = o => Math.max(0, (crit.sun - o.sun) / crit.sun) + Math.max(0, (crit.earth - o.earth) / crit.earth) + Math.max(0, (o.dark - crit.dark) / crit.dark);
  const closest = opts.reduce((a, o) => short(o) < short(a) ? o : a, opts[0]);
  return { crit, lim, mission, base: opts[0], best, closest, unreachable, landableCells: landable.length, cellsInReach: cells.length,
           nextOk, mastNeeded, sunMargin, earthMargin };
}

const r1 = v => Math.round(v * 10) / 10;
// shown values never round onto the threshold: shortfalls round down, excess darkness rounds up
const lo = v => Math.floor(v * 10) / 10, hi = v => Math.ceil(v);
const leverText = (o, ko) => o.lever === 'base' ? (ko ? '그대로 내리면' : 'Landing as planned')
  : o.lever === 'wait' ? (ko ? `${o.v}일 기다리면` : `Waiting ${o.v} d`)
  : o.lever === 'mast' ? (ko ? `${o.v} m 마스트면` : `A ${o.v} m mast`)
  : (ko ? `${r1(o.v)} km 옮기면` : `Moving ${r1(o.v)} km`);
function missing(o, c, ko) {
  const out = [];
  if (o.sun < c.sun) out.push(ko ? `햇빛 ${lo(o.sun)} %(기준 ${c.sun})` : `sunlight ${lo(o.sun)} % (need ${c.sun})`);
  if (o.earth < c.earth) out.push(ko ? `지구 ${lo(o.earth)} %(기준 ${c.earth})` : `Earth ${lo(o.earth)} % (need ${c.earth})`);
  if (o.dark > c.dark) out.push(ko ? `연속 어둠 ${hi(o.dark)}시간(기준 ${c.dark})` : `${hi(o.dark)} h dark in a row (max ${c.dark})`);
  return out;
}

// One sentence: the cause first, then what it would take.
export function failReason(s, lang = 'en') {
  const ko = lang === 'ko', b = s.best;
  let code, en, kr;
  const k = s.unreachable[0];
  if (k === 'sun' && b.sun < 5) {
    code = 'shadow';
    en = s.sunMargin != null && s.sunMargin < 0
      ? `In shadow: the Sun stays ${r1(-s.sunMargin)}° below the skyline for the whole ${s.mission} days.`
      : `In shadow: the Sun is almost never visible (best ${lo(b.sun)} %).`;
    kr = s.sunMargin != null && s.sunMargin < 0
      ? `그늘: ${s.mission}일 내내 해가 지형선보다 ${r1(-s.sunMargin)}° 아래에 있어요.`
      : `그늘: 해가 거의 보이지 않아요 (최대 ${lo(b.sun)} %).`;
  } else if (k === 'sun') {
    code = 'low-sun';
    en = `Too little sunlight: at best ${lo(b.sun)} % of the mission, need ${s.crit.sun} %.`;
    kr = `햇빛 부족: 최대 ${lo(b.sun)} %, 기준 ${s.crit.sun} %.`;
  } else if (k === 'earth' && b.earth < 1) {
    code = 'no-earth';
    en = s.earthMargin != null && s.earthMargin < 0
      ? `No radio link: Earth stays ${r1(-s.earthMargin)}° below the skyline.`
      : `No radio link: Earth never rises above the skyline.`;
    kr = s.earthMargin != null && s.earthMargin < 0
      ? `통신 불가: 지구가 지형선보다 ${r1(-s.earthMargin)}° 아래에 머물러요.`
      : `통신 불가: 지구가 지형선 위로 뜨지 않아요.`;
  } else if (k === 'earth') {
    code = 'low-earth';
    en = `Earth too low: visible at best ${lo(b.earth)} % of the time, need ${s.crit.earth} %.`;
    kr = `지구 가시 부족: 최대 ${lo(b.earth)} %, 기준 ${s.crit.earth} %.`;
  } else if (k === 'dark') {
    code = 'long-night';
    en = `Night too long: at least ${hi(b.dark)} h of darkness in a row, batteries last ${s.crit.dark} h.`;
    kr = `어둠이 너무 김: 최소 ${hi(b.dark)}시간 연속 어둠, 배터리 한계 ${s.crit.dark}시간.`;
  } else if (s.landableCells === 0 && s.cellsInReach > 0) {
    code = 'steep';
    en = `No flat ground: every spot within ${s.lim.move} km is steeper than 8°.`;
    kr = `평지 없음: ${s.lim.move} km 안이 모두 8°보다 가팔라요.`;
  } else {
    // each criterion can be met by some option, but never all at once: show the closest option
    code = 'trade-off';
    const o = s.closest, m = missing(o, s.crit, false), mk = missing(o, s.crit, true);
    en = `No option meets all three at once. Closest: ${leverText(o, false).replace(/^\w/, ch => ch.toLowerCase())} still leaves ${m.join(' and ')}.`;
    kr = `세 기준을 한꺼번에 맞추는 방법이 없어요. 가장 가까운 것: ${leverText(o, true)} ${mk.join(', ')}.`;
  }
  // what it would take beyond the limits
  const extra = [];
  if (s.nextOk != null) extra.push(ko ? `${s.nextOk}일 대기` : `after ${s.nextOk} d of waiting`);
  if (s.mastNeeded != null) extra.push(ko ? `${s.mastNeeded} m 마스트` : `with a ${s.mastNeeded} m mast`);
  const tail = extra.length ? (ko ? ` ${extra.join(' 또는 ')}로 가능해요.` : ` Would be GO ${extra.join(' or ')}.`)
                            : (ko ? ' 2027년 데이터 안에는 해법이 없어요.' : ' No fix in the 2027 data.');
  return { code, text: (ko ? kr : en) + tail };
}
