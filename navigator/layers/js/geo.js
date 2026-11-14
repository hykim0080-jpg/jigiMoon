import { N, PX, HALF, R_MOON } from './config.js';
export const xyToCell = (x, y) => ({ col: Math.floor((x + HALF) / PX), row: Math.floor((HALF - y) / PX) });
export const cellToXY = (col, row) => ({ x: -HALF + (col + .5) * PX, y: HALF - (row + .5) * PX });
export function cellToLatLon(col, row) {
  const { x, y } = cellToXY(col, row);
  const r = Math.hypot(x, y);
  return { lat: -90 + 2 * Math.atan(r / (2 * R_MOON)) * 180 / Math.PI, lon: Math.atan2(x, y) * 180 / Math.PI };
}
export const latRadius = lat => 2 * R_MOON * Math.tan((90 - Math.abs(lat)) * Math.PI / 360);
export const inGrid = (c, r) => c >= 0 && r >= 0 && c < N && r < N;
