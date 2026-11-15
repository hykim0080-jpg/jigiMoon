// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import { state, setState, subscribe } from './state.js';
import { loadAll, fmt } from './data.js';
import { initCompose, compose, sample, scoreIds, critIds, scoreColor } from './compose.js';
import { initMap, blit, drawOverlay, resize, renderBadge, flyTo, flyToCells, flyToCell, setPick, setInsets } from './mapview.js';
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
import { initTrip, renderTrip, tripRanked, REGIONS, regionBBox } from './trip.js';
import { mapHome, setBadges, shadowLegend } from './mapview.js';
import { syncWin, winToken, pending } from './window.js';
import { initCart, renderCart, readCart, cartHash } from './cart.js';
import * as g3 from './globe3d.js';

export async function mount(root, opts = {}) {
  const { dataUrl = './data/', header = true } = opts;
  const lq = new URLSearchParams(location.search).get('lang') || new URLSearchParams(location.hash.slice(1)).get('lang'), cmp = '../index.html' + (lq ? '?lang=' + lq : '') + '#v=focus';
  root.innerHTML = `<div class="lyr-app">${header ? `<header><div class="seg lyr-sw"><a href="${cmp}">${t('compare')}</a><button aria-pressed="true">${t('find')}</button></div><div class="app-id"><a class="app-name" href="${cmp}">${t('app')}</a><span class="app-tag">${t('tagline')}</span></div></header>` : ''}<div class="lyr-main"><section class="panel lyr-left"><div class="lyr-lh"><h2>${t('criteria')}</h2><button class="lyr-advb" aria-pressed="false">${t('adv')}</button></div><div class="lyr-crit"></div><div class="lyr-advwrap lyr-layers"></div><div class="lyr-tripl"></div><div class="lyr-zones"></div></section><section class="panel lyr-map" data-theme="dark"></section><div class="lyr-loading" role="status">${t('loading')}</div><section class="panel lyr-pinp"><button class="lyr-pclose" aria-label="${t('close')}">×</button><div class="lyr-pcard"></div></section></div></div><div id="tip" hidden></div>`;
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
  if (['sun', 'earth', 'dark', 'slope'].includes(h.get('b'))) state.base = h.get('b');
  if (state.adv && ['layers', 'mask', 'score'].includes(h.get('m'))) state.mode = h.get('m');
  if (data.sites.some(s => s.id === h.get('s'))) state.site = h.get('s');
  const dd = Date.parse((h.get('d') || '') + 'T00:00:00Z'); if (!isNaN(dd)) { state.tDay = Math.max(0, Math.min(364, Math.round((dd - Date.UTC(2027, 0, 1)) / 864e5))); state.tTouched = true; }
  { const pd = Date.parse((h.get('pd') || '') + 'T00:00:00Z'); state.plan = isNaN(pd) ? state.tDay : Math.max(0, Math.min(364, Math.round((pd - Date.UTC(2027, 0, 1)) / 864e5))); }   // the planned day; the bar can slip the landing day away from it
  if (h.get('h') != null && h.get('h') !== '' && +h.get('h') >= 0 && +h.get('h') < 14 * 24) { state.tHour = Math.round(+h.get('h')); state.tTouched = true; }
  if (h.get('bm') === 'shade') state.basemap = 'shade';
  if (h.get('sh') === '1') state.shadow = true;
  else if (h.get('esh') === '1') state.eshadow = true;   // Earth shadow (exclusive with sh)
  if (h.get('st') === '6') state.mission = 6;
  state.d3 = h.get('d3') !== '0';   // 3D is the default view; d3=0 opens the flat map
  if (state.adv && h.get('jb') === 'y') state.basis = 'year';
  if (REGIONS.some(r => r.id === h.get('r'))) state.region = h.get('r');
  state.cart = readCart(h.get('k'));
  const mon = +h.get('mon'); if (state.adv && mon >= 1 && mon <= 12 && data.month) state.month = mon - 1;
  let pinFly = null;
  if (h.get('pin')) { const [px, py] = h.get('pin').split(',').map(Number), c = xyToCell(px, py); if (Number.isFinite(c.col) && c.col >= 0 && c.row >= 0 && c.col < 800 && c.row < 800) { state.pin = c; pinFly = c; state.autoPin = false; } }
  initPin(data); ensureTime(); setOnCal(() => setState({}, 'panel'));

  const { comp } = initCompose(data);
  { const ok = await applyLevels(data, state.crit, dataUrl); if (!ok) state.crit = readCrit(data.meta, new URLSearchParams()), await applyLevels(data, state.crit, dataUrl); }
  const pick = z => { setState({ pin: { col: z.best.col, row: z.best.row }, autoPin: false }, 'panel'); flyToCells(z.bbox, ZONE.fitMaxK); if (innerWidth <= 700) root.querySelector('.lyr-map').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  initPanel(pLayers, data); const setCrit = async (param, v, whole) => {
    const next = whole || { ...state.crit, [param]: v };
    if (!(await applyLevels(data, next, dataUrl))) { await applyLevels(data, state.crit, dataUrl); return false; }
    saveCrit(next); setState({ crit: next }, 'pixels'); return true;
  };
  initCart(app, data, lang, lq); initCriteria(pCrit, data, setCrit); initZones(pZones, data, { pick }); initPinCard(pPin.querySelector('.lyr-pcard'), data); initMap(pMap, data, comp); g3.init(pMap, data); setPick(pick);
  { const hd = root.querySelector('.lyr-app header'), tl = main.querySelector('.lyr-tripl');
    initTrip(hd || main, tl, data, { pick, fly: bb => flyToCells(bb, 8), home: () => mapHome(), ranked: rk => { if (state.autoPin && rk[0] && !(state.pin && state.pin.col === rk[0].col && state.pin.row === rk[0].row)) setState({ pin: { col: rk[0].col, row: rk[0].row } }, 'panel'); } });
    setBadges(() => { const r = tripRanked(), g = r.filter(z => z.go).length; return r.slice(0, g ? Math.min(g, 15) : 3); }); }
  const setAdv = v => setState(v ? { adv: true } : { adv: false, mode: 'mask', month: null, edit: null, minArea: 1 }, 'pixels');
  advBtn.onclick = () => setAdv(!state.adv);

  const setS = () => {
    const band = main.clientHeight || 800, S = innerWidth <= 700 ? main.clientWidth : Math.min(band >= 802 && band < 962 ? 802 : Math.max(500, band), Math.max(500, main.clientWidth - 300 - 250 - 24));
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
  let pend = new Set(), raf = 0, lastWin = '';
  const flush = () => {
    raf = 0; const p = pend; pend = new Set();
    syncWin(state); { const wt = winToken(state); if (wt !== lastWin) { lastWin = wt; p.add('pixels'); } }   // date, stay or basis changed the judged map
    app.dataset.adv = state.adv ? '1' : ''; advBtn.setAttribute('aria-pressed', state.adv);
    { const open = innerWidth > 700 && !state.autoPin && !!state.pin; if (app.classList.contains('pin-open') !== open) { app.classList.toggle('pin-open', open); setInsets(open ? 344 : 0); p.add('view'); } }   // the spot panel slides in when a spot is clicked
    { const ld = root.querySelector('.lyr-loading'); if (ld) { const pd = pending(state); ld.hidden = !pd; if (pd) ld.textContent = t('computing', state.mission || 14); } }
    if (p.has('pixels')) { passPx = compose(state).passPx; if (state.adv) renderPanel(state); renderCriteria(state); renderZones(state); zonesSoon(); syncShadow(); syncExpo(state); renderTime(state); renderPinCard(state); renderPinSky(state); blit(); overlay(); readout(); g3.repaint(); }
    else {
      if (p.has('view')) { blit(); overlay(); }
      if (p.has('time')) { syncShadow(); syncExpo(state); renderTime(state); shadowLegend(); renderPinCard(state); renderPinSky(state); blit(); overlay(); }
      if (p.has('zones')) { renderZones(state); zonesSoon(); readout(); }
      if (p.has('panel')) { renderZones(state); renderPinCard(state); renderPinSky(state); overlay(); readout(); }
      if (p.has('site')) { overlay(); readout(); }
      if (p.has('hover')) { overlay(); readout(); renderZones(state); }
    }
    renderTrip(state);   // after compose(): the ranked spots follow the current mask
    renderCart(state);
    g3.render(state);
    const q = new URLSearchParams(); if (state.base !== 'sun') q.set('b', state.base); if (state.adv) { q.set('a', 1); q.set('m', state.mode); } if (state.site) q.set('s', state.site);
    if (state.pin && !state.autoPin) { const c = cellToXY(state.pin.col, state.pin.row); q.set('pin', Math.round(c.x) + ',' + Math.round(c.y)); }
    if (state.adv && state.month != null) q.set('mon', state.month + 1);
    if (state.tTouched) { q.set('d', new Date(Date.UTC(2027, 0, 1 + state.tDay)).toISOString().slice(0, 10)); q.set('h', String(state.tHour).padStart(2, '0')); if (state.plan != null && state.plan !== state.tDay) q.set('pd', new Date(Date.UTC(2027, 0, 1 + state.plan)).toISOString().slice(0, 10)); }
    if (state.basemap === 'shade') q.set('bm', 'shade');
    if (state.shadow) q.set('sh', 1);
    if (state.eshadow) q.set('esh', 1);
    if (state.mission !== 14) q.set('st', state.mission);
    if (state.d3 === false) q.set('d3', 0);
    if (state.adv && state.basis === 'year') q.set('jb', 'y');
    if (state.region) q.set('r', state.region);
    if (state.cart.length) q.set('k', cartHash());
    { const ch = critHash(data.meta, state.crit); for (const kv of ch ? ch.split('&') : []) { const [a, b] = kv.split('='); q.set(a, b); } }
    if (lq) q.set('lang', lq);
    { const ch = critHash(data.meta, state.crit), href = '../index.html' + (lq ? '?lang=' + lq : '') + '#v=focus&day=' + state.tDay + '&m=' + state.mission + (ch ? '&' + ch : ''); for (const a of app.querySelectorAll('.lyr-sw a, .app-name')) a.setAttribute('href', href); }
    history.replaceState(null, '', '#' + q.toString().replace(/%2C/g, ',').replace(/%3B/g, ';'));
  };
  const zonesSoon = () => scheduleZones(state, () => {
    const z = getZones()[0];
    if (state.adv && state.autoPin && state.mode === 'mask' && z && !(state.pin && state.pin.col === z.best.col && state.pin.row === z.best.row)) { state.pin = { col: z.best.col, row: z.best.row }; renderPinCard(state); renderPinSky(state); readout(); }
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
    else if (e.key === 'Escape') { const z = tripRanked()[0] || getZones()[0]; setState({ autoPin: true, pin: z ? { col: z.best.col, row: z.best.row } : state.pin, edit: null }, 'panel'); }
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
  pPin.querySelector('.lyr-pclose').onclick = () => setState({ autoPin: true }, 'panel');
  // first visit: one plain hint over the map, gone on the first click
  if (innerWidth > 700 && !localStorage.getItem('mj-hint') && !state.pin) {
    const hint = Object.assign(document.createElement('div'), { className: 'lyr-hint' }); hint.innerHTML = `<ol>${t('hint').map(x => `<li>${x}</li>`).join('')}</ol><p>${t('goMeans')}</p>`;
    pMap.append(hint);
    setTimeout(() => off(), 12000);
    const off = () => { if (!hint.isConnected) return; hint.remove(); localStorage.setItem('mj-hint', '1'); removeEventListener('pointerdown', off, true); };
    addEventListener('pointerdown', off, true);
  }
  if (pinFly) flyToCell(pinFly.col, pinFly.row, 4, true); else if (state.site) flyTo(data.sites.find(s => s.id === state.site), true);
  else if (regionBBox(state.region)) flyToCells(regionBBox(state.region), 8);
  return { destroy() { removeEventListener('resize', onResize); removeEventListener('keydown', onKey); root.innerHTML = ''; } };
}
