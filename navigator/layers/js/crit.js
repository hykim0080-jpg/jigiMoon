// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// User-adjustable sub-thresholds (sun %, Earth %, dark h): levels come from layers.json `criterion_levels`;
// each level is a layer file with the same encoding as the default one, loaded on first selection.
import { N } from './config.js';
import { readCrit as aRead, saveCrit as aSave, isDefault as aIsDefault, critParams, defFor } from '../../js/criteria.js';
import { state } from './state.js';

const cache = {};
export const levelsOf = meta => meta.criterion_levels || {};
// shared with mode A (navigator/js/criteria.js): same keys cs/ce/cd, localStorage 'moonjigi.crit', same snapping to LEVELS
export const defaults = () => ({ ...defFor(state.mission), sunSet: false });
export const isDefault = (meta, crit) => aIsDefault(crit, state.mission);
export const readCrit = () => aRead(state.mission);
export const saveCrit = crit => aSave(crit);
export const critHash = (meta, crit) => critParams(crit).map(([h, v]) => `${h}=${v}`).join('&');
// swap the byte arrays of the criterion layers to the chosen levels (lazy fetch); false when a level file is missing
export async function applyLevels(data, crit, dataUrl) {
  for (const [lid, cl] of Object.entries(levelsOf(data.meta))) {
    const id = cl.levels[String(crit[cl.param])] ?? cl.levels[String(cl.default)];
    if (!(cl.levels[String(cl.default)] in cache)) cache[cl.levels[String(cl.default)]] = cache[`#base:${lid}`] ??= data.bytes[lid];
    if (!(id in cache)) {
      const r = await fetch(dataUrl + id + '.wasm').catch(() => null);
      const b = r && r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
      if (!b || b.length !== N * N) return false;
      cache[id] = b;
    }
    if (data.bytes[lid]) data.bytes[lid] = cache[id];
  }
  return true;
}
