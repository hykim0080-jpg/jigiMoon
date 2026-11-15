// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// One 3D view shared by Detail and Find a site: where the camera looks (map metres), how far, from which side.
// Saved on every camera stop and when leaving; the other screen opens on the same view.
const KEY = 'moonjigi.cam3d';
// a screen opens on the view left by the OTHER screen in the last 30 minutes (a reload keeps its own link's view)
export function loadCam(me) {
  try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); return c && c.from !== me && Number.isFinite(c.r) && Date.now() - (c.t || 0) < 30 * 60e3 ? c : null; } catch (e) { return null; }
}
export function saveCam(c, me) { try { localStorage.setItem(KEY, JSON.stringify({ ...c, from: me, t: Date.now() })); } catch (e) { /* no storage */ } }

// Live link between Detail and Find a site (Find a site runs in a frame inside Detail): the view, the landing day
// and stay, and the chosen spot are written to localStorage; the other document hears it through 'storage'.
export function share(kind, val, me) { try { localStorage.setItem('moonjigi.' + kind, JSON.stringify({ ...val, from: me, t: Date.now() })); } catch (e) { /* no storage */ } }
export function onShare(me, fn) {
  addEventListener('storage', (e) => {
    if (!e.key || !/^moonjigi\.(cam3d|day|spot)$/.test(e.key) || !e.newValue) return;
    let v = null; try { v = JSON.parse(e.newValue); } catch (err) { return; }
    if (v && v.from !== me) fn(e.key.slice(9), v);
  });
}
