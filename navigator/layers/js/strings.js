const S = {
  en: {
    app: 'LUNAR LANDING SITE NAVIGATOR', compare: 'Compare sites', find: 'Find a site', go: 'GO', none: 'none', here: 'here', open_cmp: 'Open in Compare ↗',
    layers: 'LAYERS', sites: 'SITES', zones: 'ZONES', d: 'd', ds: ' d', z_add: 'Add', z_erase: 'Erase', z_clear: 'Clear', z_area: 'km²', z_score: 'Score', month: 'Landing days (month)', shadow: 'Shadow',
    m_layers: 'Layers', m_mask: 'Mask', m_score: 'Score', km: 'km', home: '⌂', open: '↗',
    suitable: 'SUITABLE', criteria: 'CRITERIA', adv: 'Advanced',
    c_sun: p => `Sun ≥ ${p} %`, c_earth: p => `Earth in view ≥ ${p} %`, c_dark: h => `Dark spell ≤ ${h} h`, c_slope: 'Slope',
    ge_d: v => `≥ ${v} d`, le_deg: v => `≤ ${v}°`, col_area: 'km²', col_go: 'GO d',
    nogo: 'NO-GO', go_run: n => `GO · ${n}-DAY WINDOW`,
    avail_wait: n => `AVAILABLE IN ${n} ${n === 1 ? 'DAY' : 'DAYS'}`, avail_move_dir: (km, dir) => `AVAILABLE ${km} KM ${dir}`, avail_mast: m => `AVAILABLE WITH ${m} M MAST`,
    noFix: (km, m, d) => `no fix within ${km} km / ${m} m / ${d} d`, slope_fail: v => `SLOPE ${v}°`,
    move: 'MOVE', mast: 'MAST', wait: 'WAIT', move_txt: (dir, km) => `${km} km ${dir}`, mast_gain: n => `20 m · +${n} d`, mast_title: (a, b) => `6-d mission ${a} → ${b} d`, days: n => `${n} d`,
    lat: 'Lat/Lon', expo: n => `☀ ${n} d`, expoTip: p => `sunlit ${p} % of the mission`,
  },
  ko: {
    app: '달 착륙지 내비게이터', compare: '사이트 비교', find: '입지 분석', go: 'GO', none: '없음', here: '여기', open_cmp: '사이트 비교에서 보기 ↗',
    layers: '레이어', sites: '후보지', zones: '구역', d: '일', ds: '일', z_add: '추가', z_erase: '지우기', z_clear: '초기화', z_area: 'km²', z_score: '점수', month: '가능 착륙일 (월)', shadow: '그림자',
    m_layers: '레이어', m_mask: '마스크', m_score: '점수', km: 'km', home: '⌂', open: '↗',
    suitable: '적합', criteria: '조건', adv: '고급',
    c_sun: p => `햇빛 ≥ ${p} %`, c_earth: p => `지구 가시 ≥ ${p} %`, c_dark: h => `연속 어둠 ≤ ${h}시간`, c_slope: '경사',
    ge_d: v => `${v}일 이상`, le_deg: v => `${v}° 이하`, col_area: 'km²', col_go: 'GO 일',
    nogo: '불가', go_run: n => `가능 · ${n}일 연속`,
    avail_wait: n => `${n}일 후 가능`, avail_move_dir: (km, dir) => `${dir} ${km} km 이동 시 가능`, avail_mast: m => `${m} m 마스트로 가능`,
    noFix: (km, m, d) => `${km} km / ${m} m / ${d}일 안에 해법 없음`, slope_fail: v => `경사 ${v}°`,
    move: '이동', mast: '마스트', wait: '대기', move_txt: (dir, km) => `${dir} ${km} km`, mast_gain: n => `20 m · +${n}일`, mast_title: (a, b) => `6일 임무 ${a} → ${b}일`, days: n => `${n}일`,
    lat: '위도/경도', expo: n => `☀ ${n}일`, expoTip: p => `임무 기간 중 ${p} % 햇빛`,
  },
};
const qp = k => new URLSearchParams(location.search).get(k) ?? new URLSearchParams(location.hash.slice(1)).get(k);
export const lang = qp('lang') === 'ko' ? 'ko' : 'en';
export const t = (key, ...args) => { const v = S[lang][key] ?? S.en[key] ?? key; return typeof v === 'function' ? v(...args) : v; };
const EN = { sun_days: 'Sun days', earth_days: 'Earth days', dark_days: 'Dark ≤50 h days', slope: 'Slope', mast: 'Mast', days14: 'GO days', days6: 'GO days (6 d)', psr: 'Permanent shadow', sun: 'Sun %', earth: 'Earth %', both: 'Sun+Earth %', dark14: 'Longest dark' };
export const unitOf = m => (lang === 'en' && m.unit === '일') ? 'd' : m.unit;
export const layerName = m => (lang === 'en' && EN[m.id]) || m.name;
export const MONTH_NAMES = lang === 'en' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
