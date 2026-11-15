// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { state, setState, subscribe } from './state.js';
import { loadAll, fmt } from './data.js';
import { initCompose, compose, sample, scoreIds, critIds, scoreColor } from './compose.js';
import { initMap, blit, drawOverlay, resize, renderBadge, flyTo, flyToCells, flyToCell, setPick } from './mapview.js';
import { initPanel, renderPanel, renderReadout } from './panel.js';
import { initZones, scheduleZones, renderZones, loadOverride, getZones } from './zones.js';
import { readCrit, saveCrit, critHash, applyLevels, isDefault } from './crit.js';
import { initCriteria, renderCriteria, renderCritTick } from './criteria.js';
import { initPinCard, renderPinCard, renderPinSky } from './pincard.js';
import { DEFAULT_ON, ZONE } from './config.js';
import { t, lang } from './strings.js';
import { initPin, setOnCal } from './pin.js';
import { syncShadow, syncExpo, renderTime, ensure as ensureTime } from './time.js';
import { xyToCell, cellToXY } from './geo.js';

export async function mount(root, opts = {}) {
  const { dataUrl = './data/', header = true } = opts;
  const lq = new URLSearchParams(location.search).get('lang') || new URLSearchParams(location.hash.slice(1)).get('lang'), cmp = '../index.html' + (lq ? '?lang=' + lq : '');
  root.innerHTML = `<div class="lyr-app">${header ? `<header><a class="app-name" href="${cmp}">${t('app')}</a><div class="seg lyr-sw"><a href="${cmp}">${t('compare')}</a><button aria-pressed="true">${t('find')}</button></div></header>` : ''}<div class="lyr-main"><section class="panel lyr-left"><div class="lyr-lh"><h2>${t('criteria')}</h2><button class="lyr-advb" aria-pressed="false">${t('adv')}</button></div><div class="lyr-crit"></div><div class="lyr-advwrap lyr-layers"></div><div class="lyr-zones"></div></section><section class="panel lyr-map" data-theme="dark"></section><section class="panel lyr-pinp"></section></div></div><div id="tip" hidden></div>`;
  const data = await loadAll(dataUrl);
  const main = root.querySelector('.lyr-main'), app = root.querySelector('.lyr-app'), pMap = main.querySelector('.lyr-map'), pLayers = main.querySelector('.lyr-advwrap'), pZones = main.querySelector('.lyr-zones'), pCrit = main.querySelector('.lyr-crit'), pPin = main.querySelector('.lyr-pinp'), advBtn = main.querySelector('.lyr-advb');

  const ids = data.layers.map(m => m.id), h = new URLSearchParams(location.hash.slice(1));
  const on = { layers: {}, mask: {}, score: {} }, opacity = {}, threshold = {}, weight = {}, lastWeight = {};
  for (const m of data.layers) {
    opacity[m.id] = .85; threshold[m.id] = m.threshold; weight[m.id] = m.weight ?? m.default_weight ?? 0; lastWeight[m.id] = weight[m.id] || 1;
    on.layers[m.id] = false; on.mask[m.id] = false;
  }
  const firstOn = DEFAULT_ON.layers.find(id => ids.includes(id)); if (firstOn) on.layers[firstOn] = true; else if (ids[0]) on.layers[ids[0]] = true;
  const crit = data.layers.filter(m => m.threshold != null);
  let mdef = DEFAULT_ON.maskHues.map(hh => DEFAULT_ON.pref.map(sf => crit.find(m => m.id === hh + sf)).find(Boolean)).filter(Boolean);
  if (!mdef.length) mdef = crit;
  for (const m of mdef) on.mask[m.id] = true;
  state.crit = readCrit(data.meta, h);
  Object.assign(state, { order: ids, on, opacity, threshold, weight, lastWeight, ov: loadOverride() });
  if (h.get('a') === '1') state.adv = true;
  if (state.adv && ['layers', 'mask', 'score'].includes(h.get('m'))) state.mode = h.get('m');
  if (data.sites.some(s => s.id === h.get('s'))) state.site = h.get('s');
  const dd = Date.parse((h.get('d') || '') + 'T00:00:00Z'); if (!isNaN(dd)) { state.tDay = Math.max(0, Math.min(364, Math.round((dd - Date.UTC(2027, 0, 1)) / 864e5))); state.tTouched = true; }
  if (h.get('h') != null && h.get('h') !== '' && +h.get('h') >= 0 && +h.get('h') <= 23) { state.tHour = Math.round(+h.get('h')); state.tTouched = true; }
  if (h.get('sh') === '1') state.shadow = true;
  const mon = +h.get('mon'); if (state.adv && mon >= 1 && mon <= 12 && data.month) state.month = mon - 1;
  let pinFly = null;
  if (h.get('pin')) { const [px, py] = h.get('pin').split(',').map(Number), c = xyToCell(px, py); if (Number.isFinite(c.col) && c.col >= 0 && c.row >= 0 && c.col < 800 && c.row < 800) { state.pin = c; pinFly = c; state.autoPin = false; } }
  initPin(data); ensureTime(); setOnCal(() => setState({}, 'panel'));

  const { comp } = initCompose(data);
  { const ok = await applyLevels(data, state.crit, dataUrl); if (!ok) state.crit = readCrit(data.meta, new URLSearchParams()), await applyLevels(data, state.crit, dataUrl); }
  const pick = z => { setState({ pin: { col: z.best.col, row: z.best.row }, autoPin: false }, 'panel'); flyToCells(z.bbox, ZONE.fitMaxK); };
  initPanel(pLayers, data); const setCrit = async (param, v, whole) => {
    const next = whole || { ...state.crit, [param]: v };
    if (!(await applyLevels(data, next, dataUrl))) { await applyLevels(data, state.crit, dataUrl); return false; }
    saveCrit(next); setState({ crit: next }, 'pixels'); return true;
  };
  initCriteria(pCrit, data, setCrit); initZones(pZones, data, { pick }); initPinCard(pPin, data); initMap(pMap, data, comp); setPick(pick);
  const setAdv = v => setState(v ? { adv: true } : { adv: false, mode: 'mask', month: null, edit: null, minArea: 1 }, 'pixels');
  advBtn.onclick = () => setAdv(!state.adv);

  const setS = () => {
    const band = main.clientHeight || 800, S = band >= 802 && band < 962 ? 802 : Math.max(500, band);
    main.style.setProperty('--S', S + 'px');
  };
  let passPx = 0;
  const cell = () => state.pin || state.hover;
  const siteFill = s => {
    if (state.mode === 'layers') return 'none';
    const sm = sample(s.cell.col, s.cell.row); if (!sm) return 'none';
    if (state.mode === 'mask') return sm.fails === 0 && sm.nCrit ? 'var(--ok)' : 'none';
    return sm.score != null ? `rgb(${scoreColor(sm.score / 100)})` : 'none';
  };
  const readout = () => { const c = cell(), sm = c ? sample(c.col, c.row) : null; renderReadout(sm, state); renderBadge(passPx, sm?.score); renderCritTick(state.pin ? sample(state.pin.col, state.pin.row) : null); };
  const overlay = () => drawOverlay(state, siteFill);
  let pend = new Set(), raf = 0;
  const flush = () => {
    raf = 0; const p = pend; pend = new Set();
    app.dataset.adv = state.adv ? '1' : ''; advBtn.setAttribute('aria-pressed', state.adv);
    if (p.has('pixels')) { passPx = compose(state).passPx; if (state.adv) renderPanel(state); renderCriteria(state); renderZones(state); zonesSoon(); syncShadow(); syncExpo(state); renderTime(state); renderPinCard(state); renderPinSky(state); blit(); overlay(); readout(); }
    else {
      if (p.has('view')) { blit(); overlay(); }
      if (p.has('time')) { syncShadow(); syncExpo(state); renderTime(state); renderPinCard(state); renderPinSky(state); blit(); overlay(); }
      if (p.has('zones')) { renderZones(state); zonesSoon(); readout(); }
      if (p.has('panel')) { renderZones(state); renderPinCard(state); renderPinSky(state); overlay(); readout(); }
      if (p.has('site')) { overlay(); readout(); }
      if (p.has('hover')) { overlay(); readout(); renderZones(state); }
    }
    const q = new URLSearchParams(); if (state.adv) { q.set('a', 1); q.set('m', state.mode); } if (state.site) q.set('s', state.site);
    if (state.pin && !state.autoPin) { const c = cellToXY(state.pin.col, state.pin.row); q.set('pin', Math.round(c.x) + ',' + Math.round(c.y)); }
    if (state.adv && state.month != null) q.set('mon', state.month + 1);
    if (state.tTouched) { q.set('d', new Date(Date.UTC(2027, 0, 1 + state.tDay)).toISOString().slice(0, 10)); q.set('h', String(state.tHour).padStart(2, '0')); }
    if (state.shadow) q.set('sh', 1);
    { const ch = critHash(data.meta, state.crit); for (const kv of ch ? ch.split('&') : []) { const [a, b] = kv.split('='); q.set(a, b); } }
    if (lq) q.set('lang', lq);
    { const ch = critHash(data.meta, state.crit), href = '../index.html' + (lq ? '?lang=' + lq : '') + (ch ? '#' + ch : ''); for (const a of app.querySelectorAll('.lyr-sw a, .app-name')) a.setAttribute('href', href); }
    history.replaceState(null, '', '#' + q.toString().replace(/%2C/g, ','));
  };
  const zonesSoon = () => scheduleZones(state, () => {
    const z = getZones()[0];
    if (state.autoPin && state.mode === 'mask' && z && !(state.pin && state.pin.col === z.best.col && state.pin.row === z.best.row)) { state.pin = { col: z.best.col, row: z.best.row }; renderPinCard(state); renderPinSky(state); readout(); }
    overlay();
  });
  subscribe((s, what) => { pend.add(what); if (!raf) raf = requestAnimationFrame(flush); });

  const onResize = () => { setS(); resize(); };
  addEventListener('resize', onResize);
  const onKey = e => {
    if (e.target.matches('input,textarea') || e.altKey || e.ctrlKey || e.metaKey) return;
    const m = state.adv ? { 1: 'layers', 2: 'mask', 3: 'score' }[e.key] : null;
    if (m) setState({ mode: m }, 'pixels');
    else if (e.key === '0') setState({ view: { k: 1, cx: 400, cy: 400 } }, 'view');
    else if (e.key === 'Escape') { const z = getZones()[0]; setState({ autoPin: true, pin: z ? { col: z.best.col, row: z.best.row } : state.pin, edit: null }, 'panel'); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setState({ tDay: Math.max(0, Math.min(364, state.tDay + (e.key === 'ArrowRight' ? 1 : -1))), tTouched: true }, 'time');
  };
  addEventListener('keydown', onKey);
  const onHash = () => {
    const nc = readCrit(data.meta, new URLSearchParams(location.hash.slice(1)));
    if (JSON.stringify(nc) !== JSON.stringify(state.crit)) setCrit(null, null, nc);
  };
  addEventListener('hashchange', onHash);
  setS(); resize();
  setState({}, 'pixels');
  if (pinFly) flyToCell(pinFly.col, pinFly.row, 4, true); else if (state.site) flyTo(data.sites.find(s => s.id === state.site), true);
  return { destroy() { removeEventListener('resize', onResize); removeEventListener('keydown', onKey); root.innerHTML = ''; } };
}
