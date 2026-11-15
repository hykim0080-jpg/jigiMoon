// Checks the API against the Navigator's own data: node api/test.mjs
// (1) every site x day x mission at the precomputed criteria (sun 70 / Earth 50 / dark 50) matches the precomputed index,
// (2) custom criteria match navigator/js/criteria.js buildEntry, (3) bad input gives 400.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { check, listSites, ApiError, isoDate } from './core.js';

const root = fileURLToPath(new URL('../navigator', import.meta.url));
const load = async p => JSON.parse(await readFile(root + p, 'utf8'));
const q = o => new URLSearchParams(o);
let fails = 0, n = 0;
const expect = (cond, msg) => { n++; if (!cond) { fails++; if (fails < 20) console.error('FAIL', msg); } };

const index = await load('/data/index.json');
const sites = (await listSites(load)).sites;
expect(sites.length === 12, 'twelve sites');

for (const mission of Object.keys(index.modes)) {
  for (const s of index.sites) {
    const e = index.modes[mission].sites[s.id];
    for (let d = 0; d < 365; d++) {
      const r = await check(load, q({ site: s.id, date: isoDate(d), mission, sun: '70' }));
      const ok = e.ok[d] === '1';
      expect((r.verdict === 'GO') === ok, `${s.id} ${mission} ${d} verdict`);
      expect((r.fixes.mast?.m ?? null) === e.mast[d], `${s.id} ${mission} ${d} mast`);
      expect((r.fixes.move?.km ?? null) === e.move[d], `${s.id} ${mission} ${d} move`);
      expect((r.fixes.wait?.days ?? null) === (ok ? 0 : e.wait[d]), `${s.id} ${mission} ${d} wait`);
      if (!ok && r.fixes.move) expect(Math.abs(Math.hypot(r.fixes.move.dx_km, r.fixes.move.dy_km) - r.fixes.move.km) < 0.06, `${s.id} ${d} move cell`);
    }
  }
}

// demo state shown on the slides
const demo = await check(load, q({ site: 'nobile-rim-1', date: '2027-02-15' }));
expect(demo.verdict === 'NO-GO' && demo.recommended.text === 'AVAILABLE 0.6 KM AWAY', 'demo recommended');
expect(demo.fixes.mast.m === 7 && demo.fixes.wait.days === 16 && demo.failing.join() === 'earth', 'demo fixes');
const withMast = await check(load, q({ site: 'nobile-rim-1', date: '2027-02-15', mast: '7' }));
expect(withMast.verdict === 'GO' && withMast.go_with_mast_m === 7, 'demo with 7 m mast');
const plan = await check(load, q({ site: 'nobile-rim-1', date: '2027-02-06' }));
expect(plan.verdict === 'GO', 'demo plan day GO');

// custom criteria at the default values must equal the precomputed answer
const same = await check(load, q({ site: 'malapert-massif', date: '2027-05-01', sun: '70', earth: '50', dark: '50' }));
const def = await check(load, q({ site: 'malapert-massif', date: '2027-05-01' }));
expect(JSON.stringify(same) === JSON.stringify(def), 'explicit default criteria');
// looser criteria never turn a GO day into NO-GO
for (const s of index.sites) for (let d = 0; d < 365; d += 7) {
  const a = await check(load, q({ site: s.id, date: isoDate(d) }));
  const b = await check(load, q({ site: s.id, date: isoDate(d), sun: '50', earth: '30', dark: '100' }));
  if (a.verdict === 'GO') expect(b.verdict === 'GO', `${s.id} ${d} looser stays GO`);
}

for (const bad of [{ site: 'nope', date: '2027-02-15' }, { site: 'haworth', date: '2026-02-15' },
                   { site: 'haworth', date: '2027-02-30' }, { site: 'haworth', date: '2027-02-15', mission: '9' },
                   { site: 'haworth', date: '2027-02-15', sun: 'x' }]) {
  try { await check(load, q(bad)); expect(false, 'accepted ' + JSON.stringify(bad)); }
  catch (e) { expect(e instanceof ApiError && e.status === 400, 'status for ' + JSON.stringify(bad)); }
}

console.log(`${n - fails}/${n} checks passed`);
process.exit(fails ? 1 : 0);
