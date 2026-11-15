// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
import * as findlink from './findlink.js';
import { state, setState, subscribe, limitsOf } from './state.js';
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
import * as view3d from './view3d.js';
import * as full from './full.js';
import * as intro from './intro.js';
import * as verdict from './verdict.js';
import * as drag from './drag.js';
if (intro.shouldPlay()) intro.play();   // opening shot: near side -> south pole

const $ = id => document.getElementById(id);
const isFull = () => $('main').classList.contains('full');   // panels move only on the full map
const data = { index: null, site: null };

// rebuild the per-day entries when the criteria or the mission change (needs every site's file)
const applied = {}, loadingCals = {};
function criteriaReady(st) {
  const key = critKey(st.crit);
  if (applied[st.mission] === key) return true;
  const ids = data.index.sites.map(s => s.id);
  if (applyCriteria(data.index, st.mission, st.crit, id => metricsOf(id, st.mission))) { applied[st.mission] = key; return true; }
  if (!loadingCals[st.mission]) loadingCals[st.mission] = preloadCals(ids.filter(id => !/^pin\d*$/.test(id)), st.mission).then(() => render(state));
  return false;
}

const FH0 = new URLSearchParams(location.hash.slice(1)).get('fh');   // /layers/ links: Find a site's own hash, for its panels
let findAtSite = false;   // first open of Find a site from another view: start at the selected site
function render(st) {
  if (!criteriaReady(st)) return;
  data.site = getSite(st.site, st.mission);
  if (!data.site) {
    loadSite(st.site, st.mission).then(() => render(state));
  }
  document.documentElement.lang = new URLSearchParams(location.search).get('lang') || 'en';
  $('main').dataset.view = st.view;
  document.body.dataset.view = st.view;
  if (st.view === 'search') { setState({ view: 'focus' }); return; }
  $('main').dataset.zoomed = st.zoom > 1.01 ? '1' : '';
  // map side = height of the middle band
  const main = $('main');
  full.render(st);
  if (full.isFull(st)) main.style.setProperty('--S', Math.max(300, Math.min(main.clientHeight, main.clientWidth)) + 'px');
  else if (st.view === 'focus') { const cal = parseFloat(getComputedStyle(main).gridTemplateRows.split(' ').pop()) || 216, gap = parseFloat(getComputedStyle(main).rowGap) || 12; main.style.setProperty('--S', (innerWidth <= 700 ? main.clientWidth : Math.max(300, Math.min(main.clientHeight, (main.clientWidth - 320 - 2 * (parseFloat(getComputedStyle(main).columnGap) || 12)) / 2))) + 'px'); }
  header.render(st, data);
  calendar.render(st, data);
  if (st.view === 'compare') compare.render(st, data);
  if (st.view === 'find' && !$('find').firstChild) { $('find').innerHTML = `<iframe src="${FH0 != null ? `layers/index.html?embed=1&panels=1&lang=${new URLSearchParams(location.search).get('lang') || 'en'}#${FH0}` : header.findHref(st, data, findAtSite).replace('embed=1', 'embed=1&panels=1')}" title="Find a site" allowtransparency="true"></iframe>`; findlink.attach($('find').firstChild, { pushTime: FH0 == null }); }   // panels only, over this page's 3D map
  if (st.view !== 'find') findAtSite = true;
  if (st.view === 'sites') { setState({ view: 'focus' }); return; }   // the Selection tab is gone: old links open Detail
  map.render(st, data);
  view3d.render(st);
  globe.render(st, data);
  // while the site's file loads, keep the last numbers in place (dimmed) instead of emptying the panels
  main.dataset.loading = data.site || st.view === 'compare' ? '' : '1';
  if (!data.site && st.view !== 'compare') return;
  metrics.render(st, data);
  fixes.render(st, data);
  verdict.render(st, data, $('map-panel'), limitsOf(st));
  drag.draggable($('vbadge'), 'verdict', isFull);
  drag.refresh();
  detailNote(st);
  if (st.view === 'focus') { sky.render(st, data); timeline.render(st, data); chain.render(); }
}

// a site opened from Find a site whose verdict there (500 m grid) differs from the detailed one here
const fromFind = (() => { const h = new URLSearchParams(location.hash.slice(1)), fv = h.get('fv'); return fv === '0' || fv === '1' ? { site: h.get('s'), day: Number(h.get('day')), m: Number(h.get('m') || 14), go: fv === '1' } : null; })();
function detailNote(st) {
  let n = document.getElementById('detail-note');
  const e = fromFind && st.site === fromFind.site && st.day === fromFind.day && st.mission === fromFind.m ? data.index.modes[st.mission].sites[st.site] : null;
  const show = e && !!e.ok[st.day] !== fromFind.go;
  if (!show) { if (n) n.remove(); return; }
  if (!n) { n = document.createElement('div'); n.id = 'detail-note'; $('fixes').prepend(n); }
  n.textContent = t('detailDiff', fromFind.go ? t('detailGo') : t('detailNogo'));
}

// open any point as the pin without reloading (map click)
async function openPin(x, y) {
  // no full-screen wait: the map shows a ring at the point until this resolves
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
  try {
    const i = data.index.sites.findIndex(s => s.id === 'pin');
    if (i >= 0) data.index.sites.splice(i, 1);
    delete data.index.byId.pin;
    await pin.setup(data.index, x, y);
    for (const k in applied) delete applied[k];
    setState({ site: 'pin', pinXY: `${x},${y}`, pinned: state.pinned.filter(id => id !== 'pin'), zoom: Math.max(state.zoom, ZOOM.site) });
  } catch (e) { console.error(e); }
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
  if (state.pinsXY) {   // shortlist from Find a site: register each spot as pin1..pinN (computed like the map pin)
    $('busy').hidden = false;
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
    const list = state.pinsXY.split(';').map(s => s.split(',').map(Number));
    for (let k = list.length - 1; k >= 0; k--) {
      try { await pin.setup(data.index, list[k][0], list[k][1], 'pin' + (k + 1)); data.index.byId['pin' + (k + 1)].name = t('spotN', k + 1); } catch (e) { console.error(e); }
    }
    state.pinned = state.pinned.filter(id => data.index.byId[id]);
    $('busy').hidden = true;
  }
  if (!data.index.byId[state.site]) state.site = data.index.sites[0].id;
  await loadSite(state.site, state.mission);
  header.init($('header'), data);
  calendar.init($('cal-panel'), data);
  map.init($('map'), data, openPin);
  view3d.init($('map-panel'), data, openPin);
  globe.init($('globe'), data);
  metrics.init($('metrics-panel'));
  sky.init($('sky'), $('countdowns'));
  timeline.init($('timeline'));
  fixes.init($('fixes'));
  compare.init($('compare'));
  full.init($('main'));
  for (const [id, k] of [['sky-panel', 'sky'], ['metrics-panel', 'numbers'], ['fixes', 'fixes'], ['cal-panel', 'year']]) drag.draggable($(id), k, isFull);
  drag.onChange(() => render(state));
  subscribe(render);
  render(state);
  addEventListener('resize', () => render(state));
  addEventListener('hashchange', () => location.reload());   // a link from Find a site (in its frame) into this page
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render(state));
  addEventListener('keydown', onKey);
  // Space with the 3D map on: back to the selected site, whatever has focus (a slider, a button, the 3D view);
  // caught first on the way down so a focused button or the 3D player does not take it. Text fields keep it.
  const spaceTo3d = e => {
    if (e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey || !view3d.isOn()) return false;
    const a = e.target;
    if (a.matches && a.matches('textarea,select,input:not([type=range]):not([type=button]):not([type=checkbox])')) return false;
    e.preventDefault(); e.stopPropagation();
    return true;
  };
  addEventListener('keydown', e => { if (spaceTo3d(e)) { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); if (!e.repeat) view3d.recenter(); } }, true);
  addEventListener('keyup', spaceTo3d, true);
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
  } else if (e.key === ' ') { e.preventDefault(); if (!view3d.isOn()) setState({ playing: !state.playing }); }
  else if (e.key === '1') setState({ view: 'focus' });
  else if (e.key === '2' || e.key === '0') setState({ view: 'find' });
  else if (e.key === '3') setState({ view: state.view === 'compare' ? 'focus' : 'compare' });
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
