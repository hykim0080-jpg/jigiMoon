import { state, setState, subscribe } from './state.js';
import { loadIndex, loadSite, getSite, preloadCals, metricsOf } from './data.js';
import { applyCriteria, critKey } from './criteria.js';
import { t } from './strings.js';
import { ZOOM } from './config.js';
import * as header from './header.js';
import * as calendar from './calendar.js';
import * as map from './map.js';
import * as metrics from './metrics.js';
import * as sky from './sky.js';
import * as timeline from './timeline.js';
import * as fixes from './fixes.js';
import * as compare from './compare.js';
import * as globe from './globe.js';
import * as chain from './chain.js';
import * as orient from './orient.js';
import * as pin from './pin.js';

const $ = id => document.getElementById(id);
const data = { index: null, site: null };

// rebuild the per-day entries when the criteria or the mission change (needs every site's file)
const applied = {}, loadingCals = {};
function criteriaReady(st) {
  const key = critKey(st.crit);
  if (applied[st.mission] === key) return true;
  const ids = data.index.sites.map(s => s.id);
  if (applyCriteria(data.index, st.mission, st.crit, id => metricsOf(id, st.mission))) { applied[st.mission] = key; return true; }
  if (!loadingCals[st.mission]) loadingCals[st.mission] = preloadCals(ids.filter(id => id !== 'pin'), st.mission).then(() => render(state));
  return false;
}

function render(st) {
  if (!criteriaReady(st)) return;
  data.site = getSite(st.site, st.mission);
  if (!data.site) {
    loadSite(st.site, st.mission).then(() => render(state));
  }
  document.documentElement.lang = new URLSearchParams(location.search).get('lang') || 'en';
  $('main').dataset.view = st.view;
  $('main').dataset.zoomed = st.zoom > 1.01 ? '1' : '';
  // map side = height of the middle band
  const main = $('main');
  if (st.view === 'focus') { const cal = parseFloat(getComputedStyle(main).gridTemplateRows.split(' ').pop()) || 216, gap = parseFloat(getComputedStyle(main).rowGap) || 12; main.style.setProperty('--S', Math.max(300, main.clientHeight - cal - gap) + 'px'); }
  header.render(st, data);
  calendar.render(st, data);
  if (st.view === 'compare') compare.render(st, data);
  if (st.view === 'sites' && !$('sites').firstChild) $('sites').innerHTML = '<iframe src="selection.html" title="selection"></iframe>';
  map.render(st, data);
  globe.render(st, data);
  metrics.render(st, data);
  fixes.render(st, data);
  if (st.view === 'focus') { sky.render(st, data); timeline.render(st, data); chain.render(); }
}

// open any point as the pin without reloading (map click)
async function openPin(x, y) {
  $('busy').hidden = false;
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
  try {
    const i = data.index.sites.findIndex(s => s.id === 'pin');
    if (i >= 0) data.index.sites.splice(i, 1);
    delete data.index.byId.pin;
    await pin.setup(data.index, x, y);
    for (const k in applied) delete applied[k];
    setState({ site: 'pin', pinXY: `${x},${y}`, pinned: state.pinned.filter(id => id !== 'pin'), zoom: Math.max(state.zoom, ZOOM.site) });
  } catch (e) { console.error(e); }
  $('busy').hidden = true;
}

async function boot() {
  document.querySelectorAll('[data-t]').forEach(n => { n.textContent = t(n.dataset.t); });
  data.index = await loadIndex();
  orient.setLandmarks(data.index.landmarks);
  if (state.pinXY) {
    $('busy').hidden = false;
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
    try { const [x, y] = state.pinXY.split(',').map(Number); await pin.setup(data.index, x, y); }
    catch (e) { console.error(e); state.pinXY = ''; if (state.site === 'pin') state.site = data.index.sites[0].id; }
    $('busy').hidden = true;
  }
  if (!data.index.byId[state.site]) state.site = data.index.sites[0].id;
  await loadSite(state.site, state.mission);
  header.init($('header'), data);
  calendar.init($('cal-panel'), data);
  map.init($('map'), data, openPin);
  globe.init($('globe'), data);
  metrics.init($('metrics-panel'));
  sky.init($('sky'), $('countdowns'));
  timeline.init($('timeline'));
  fixes.init($('fixes'));
  compare.init($('compare'));
  subscribe(render);
  render(state);
  addEventListener('resize', () => render(state));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render(state));
  addEventListener('keydown', onKey);
  document.addEventListener('mapframe', () => { if (state.view === 'focus') chain.render(); });
  const ids = data.index.sites.map(s => s.id);
  preloadCals(ids, state.mission).then(() => render(state));
}

function onKey(e) {
  if (e.target.matches('input,select,textarea')) return;
  const ids = data.index.sites.map(s => s.id);
  const step = e.shiftKey ? 7 : 1;
  if (e.key === 'ArrowLeft') setState({ day: state.day - step });
  else if (e.key === 'ArrowRight') setState({ day: state.day + step });
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    const i = ids.indexOf(state.site) + (e.key === 'ArrowUp' ? -1 : 1);
    setState({ site: ids[(i + ids.length) % ids.length] });
  } else if (e.key === ' ') { e.preventDefault(); setState({ playing: !state.playing }); }
  else if (e.key === '1') setState({ view: 'focus' });
  else if (e.key === '2') setState({ view: 'compare' });
  else if (e.key === '3') setState({ view: 'sites' });
  else if (e.key === 'z' || e.key === 'Z') setState({ zoom: state.zoom === 1 ? 4 : 1 });
  else if (e.key === 'Escape') setState({ zoom: 1 });
}

boot();

// mission change needs per-day numbers for the new length
let lastMission = state.mission;
subscribe(st => {
  if (st.mission !== lastMission) {
    lastMission = st.mission;
    preloadCals(data.index.sites.map(s => s.id), st.mission).then(() => render(state));
  }
});
