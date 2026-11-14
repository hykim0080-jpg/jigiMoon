export const N = 800, PX = 500, HALF = 200000, R_MOON = 1737400;
export const FAIL_AT_255 = ['mast'];
export const ZERO_TRANSPARENT = ['days', 'psr'];
export const hue = id => id.split('_')[0].replace(/\d+$/, '');

export const RAMPS = {
  sun:   ['#2b1a04', '#6e4200', '#b96f00', '#f0a531', '#ffe7a6'],
  earth: ['#0b1833', '#173873', '#2459b8', '#74a2f2', '#dce8ff'],
  both:  ['#04222a', '#0b4a57', '#14808f', '#4fc0c9', '#d4f4f3'],
  dark:  ['#2b0a22', '#6b1c57', '#ab3a8c', '#e274b8', '#fbd9ee'],
  slope: ['#1a2206', '#44580f', '#7c9a1e', '#b7d353', '#eef7c4'],
  days:  ['#06241a', '#0f5238', '#1f8a5b', '#4cbf82', '#d6f6e3'],
  other: ['#1c1f26', '#3a404d', '#6c7488', '#a3abbd', '#e6e9f0'],
};
// steps: [upper bound (inclusive, in layer units), colour|null]; values above the last bound are transparent
export const DISCRETE = {
  mast: { steps: [[2, '#e6dbfb'], [10, '#ab89ec'], [20, '#7446bd']], light: '#7446bd', dark: '#ab89ec' },
  psr:  { steps: [[0.5, null], [1, '#9fe3ff']], light: '#3aa7cf', dark: '#9fe3ff' },
};
export const SCORE_RAMP = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'];
RAMPS.score = SCORE_RAMP;
export const MASK_COLORS = {
  pass: ['#4cbf82', .80], one: .40, many: ['#0f131b', .75], nodata: ['#0f131b', .85], score: .85,
};
// per hue, preferred ids in order; the mask defaults to the first present id with a threshold of each hue
export const DEFAULT_ON = { layers: ['sun_days', 'sun'], maskHues: ['sun', 'earth', 'dark', 'slope'], pref: ['_days', '', '14'] };
export const ZONE = { top: 20, simpleTop: 5, merge: 1, fitMaxK: 4, minAreaRange: [0.25, 25], debounce: 100, cutoff: 70 };
export const SIMPLE = { pass: '#46e58c', passA: .95, dim: .72, focusA: .55, haloA: .9 };
export const BUDGET = { move: 3, wait: 60, moveCells: 20, mast: 20, mastMinGain: 10 };
export const DEFAULT_DAY = 45;
export const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
export const GRATICULE_LATS = [85, 88];
