// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
const S = {
  en: {
    app: 'LUNAR LANDING SITE NAVIGATOR', compare: 'Compare sites', find: 'Find a site', go: 'GO', none: 'none', here: 'here', open_cmp: 'Open in Compare ↗',
    layers: 'LAYERS', sites: 'SITES', zones: 'ZONES', d: 'd', ds: ' d', z_add: 'Add', z_erase: 'Erase', z_clear: 'Clear', z_area: 'km²', z_score: 'Score', month: 'Landing days (month)', shadow: 'Shadow', eshadow: 'Earth shadow',
    b_line: 'Lines', b_shade: 'Relief', m_layers: 'Layers', m_mask: 'Mask', m_score: 'Score', km: 'km', home: '⌂', open: '↗',
    suitable: 'SUITABLE', criteria: 'CRITERIA', adv: 'Advanced', layerTip: 'Show or hide this layer (hatched where it fails)', landDay: 'Landing day', stayHour: 'Hour', loading: 'Loading Moon terrain…', computing: n => `Working out the ${n}-day stay…`, play: 'Play the stay', hint: ['Pick the landing date in the bar below', 'Click any spot on the map', 'If it says NO-GO (no sunlight or no Earth contact), click a fix: MOVE, MAST (antenna pole) or WAIT'], tagline: 'An easy, cost-efficient way to plan a Moon landing', fix_apply: 'Click to apply', plan: 'plan', planBack: 'Back to the planned day', goMeans: 'GO = sunlight and Earth contact for the whole stay', close: 'Close', legHatch: 'Hatched = fails:', legName: { sun: 'Sun', earth: 'Earth', dark: 'Dark', slope: 'Slope' },
    legStay: (n, km) => `Green = works for the whole ${n}-day stay · ${km} km²`, legYear: km => `Green = meets every criterion · ${km} km²`,
    legBase: { sun: 'Orange = sunlight', earth: 'Blue = Earth in view', dark: 'Shade = dark-safe days', slope: 'Shade = flat ground' },
    c_sun: p => `Sun ≥ ${p} %`, c_earth: p => `Earth in view ≥ ${p} %`, c_dark: h => `Dark spell ≤ ${h} h`, c_slope: 'Slope',
    ge_d: v => `≥ ${v} d`, le_deg: v => `≤ ${v}°`, col_area: 'km²', col_go: 'GO d',
    nogo: 'NO-GO', go_run: n => `GO · ${n}-DAY WINDOW`,
    avail_wait: n => `AVAILABLE IN ${n} ${n === 1 ? 'DAY' : 'DAYS'}`, avail_move_dir: (km, dir) => `AVAILABLE ${km} KM ${dir}`, avail_mast: m => `AVAILABLE WITH ${m} M MAST`,
    not_needed: 'not needed', noFix: (km, m, d) => `no fix within ${km} km / ${m} m / ${d} d`, slope_fail: v => `SLOPE ${v}°`,
    move: 'MOVE', mast: 'MAST (antenna pole)', wait: 'WAIT', move_txt: (dir, km) => `${km} km ${dir}`, mast_gain: n => `20 m · +${n} d`, mast_title: (a, b) => `6-d mission ${a} → ${b} d`, days: n => `${n} d`,
    basis: 'Judge by', b_trip: 'This stay', b_year: 'Days per year', lat: 'Lat/Lon', expo: n => `☀ ${n}-day avg`, expoTip: p => `sunlit ${p} % of the mission`,
  },
  ko: {
    app: '달 착륙지 내비게이터', compare: '사이트 비교', find: '입지 분석', go: 'GO', none: '없음', here: '여기', open_cmp: '사이트 비교에서 보기 ↗',
    layers: '레이어', sites: '후보지', zones: '구역', d: '일', ds: '일', z_add: '추가', z_erase: '지우기', z_clear: '초기화', z_area: 'km²', z_score: '점수', month: '가능 착륙일 (월)', shadow: '그림자', eshadow: '지구 그림자',
    b_line: '선', b_shade: '음영', m_layers: '레이어', m_mask: '마스크', m_score: '점수', km: 'km', home: '⌂', open: '↗',
    suitable: '적합', criteria: '조건', adv: '고급', layerTip: '이 레이어 켜기·끄기 (기준에 못 미치는 곳에 빗금)', landDay: '착륙일', stayHour: '시각', loading: '달 지형 불러오는 중…', computing: n => `${n}일 체류 계산 중…`, play: '체류 기간 재생', hint: ['아래 막대에서 착륙일을 고르세요', '지도에서 아무 지점이나 누르세요', '불가(햇빛이나 지구 통신이 부족)라면 해결책을 누르세요: 이동, 마스트(안테나 기둥), 대기'], tagline: '달 착륙을 쉽고 저렴하게 계획하는 방법', fix_apply: '눌러서 적용', plan: '계획', planBack: '계획일로 돌아가기', goMeans: 'GO = 체류 내내 햇빛과 지구 통신 가능', close: '닫기', legHatch: '빗금 = 미달:', legName: { sun: '햇빛', earth: '지구', dark: '어둠', slope: '경사' },
    legStay: (n, km) => `초록 = ${n}일 체류 내내 가능 · ${km} km²`, legYear: km => `초록 = 모든 조건 충족 · ${km} km²`,
    legBase: { sun: '주황 = 햇빛', earth: '파랑 = 지구 보임', dark: '음영 = 어둠 안전 일수', slope: '음영 = 평평한 땅' },
    c_sun: p => `햇빛 ≥ ${p} %`, c_earth: p => `지구 가시 ≥ ${p} %`, c_dark: h => `연속 어둠 ≤ ${h}시간`, c_slope: '경사',
    ge_d: v => `${v}일 이상`, le_deg: v => `${v}° 이하`, col_area: 'km²', col_go: 'GO 일',
    nogo: '불가', go_run: n => `가능 · ${n}일 연속`,
    avail_wait: n => `${n}일 후 가능`, avail_move_dir: (km, dir) => `${dir} ${km} km 이동 시 가능`, avail_mast: m => `${m} m 마스트로 가능`,
    not_needed: '필요 없음', noFix: (km, m, d) => `${km} km / ${m} m / ${d}일 안에 해법 없음`, slope_fail: v => `경사 ${v}°`,
    move: '이동', mast: '마스트(안테나 기둥)', wait: '대기', move_txt: (dir, km) => `${dir} ${km} km`, mast_gain: n => `20 m · +${n}일`, mast_title: (a, b) => `6일 임무 ${a} → ${b}일`, days: n => `${n}일`,
    basis: '판정 기준', b_trip: '이번 체류', b_year: '연간 일수', lat: '위도/경도', expo: n => `☀ ${n}일 평균`, expoTip: p => `임무 기간 중 ${p} % 햇빛`,
  },
};
const qp = k => new URLSearchParams(location.search).get(k) ?? new URLSearchParams(location.hash.slice(1)).get(k);
export const lang = qp('lang') === 'ko' ? 'ko' : 'en';
export const t = (key, ...args) => { const v = S[lang][key] ?? S.en[key] ?? key; return typeof v === 'function' ? v(...args) : v; };
const EN = { sun_days: 'Sun days', earth_days: 'Earth days', dark_days: 'Dark ≤50 h days', slope: 'Slope', mast: 'Mast', days14: 'GO days', days6: 'GO days (6 d)', psr: 'Permanent shadow', sun: 'Sun %', earth: 'Earth %', both: 'Sun+Earth %', dark14: 'Longest dark' };
export const unitOf = m => (lang === 'en' && m.unit === '일') ? 'd' : m.unit;
export const layerName = m => (lang === 'en' && EN[m.id]) || m.name;
export const MONTH_NAMES = lang === 'en' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
