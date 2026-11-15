// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// ShadowCam: real photos inside permanently shadowed craters (KPLO ShadowCam, NASA/KARI, MSSS/ASU; data/shadowcam/,
// lunar/shadowcam/README.md). Each image is RGBA, transparent outside the shadow, and drawn straight into its
// bounds_m rectangle (our map projection, +y = Earth side). Shown with the Ice layer when its ShadowCam button is on.
import { N, PX, HALF } from './config.js';
const URL0 = new URL('../data/shadowcam/', import.meta.url);
let items = null, load = null;
const SKIP = new Set(['shackleton02']);   // the same area as shackleton01
export const photosOn = st => !!(st.photos && st.factor === 'ice');
// [{ x0, y0, x1, y1, url, img }] once loaded (null before); onReady runs when the list or an image arrives
export function photoList(onReady) {
  if (items || load) return items;
  load = fetch(new URL('shadowcam.json', URL0)).then(r => r.json()).then(j => {
    items = j.items.filter(it => !SKIP.has(it.id)).map(it => {
      const [x0, y0, x1, y1] = it.bounds_m, url = new URL(it.file, URL0).href, img = new Image();
      img.onload = () => onReady && onReady(); img.src = url;
      return { x0, y0, x1, y1, url, img };
    });
    if (onReady) onReady();
  }).catch(e => console.error(e));
  return null;
}
// 2D map: each loaded photo into its rectangle (view in cells: x0c, y0c the top-left visible cell, kx, ky px per cell)
export function drawPhotos(g, x0c, y0c, kx, ky) {
  for (const p of items || []) {
    if (!p.img.complete || !p.img.naturalWidth) continue;
    const cl = (p.x0 + HALF) / PX, cr = (p.x1 + HALF) / PX, rt = (HALF - p.y1) / PX, rb = (HALF - p.y0) / PX;
    g.drawImage(p.img, (cl - x0c) * kx, (rt - y0c) * ky, (cr - cl) * kx, (rb - rt) * ky);
  }
}
