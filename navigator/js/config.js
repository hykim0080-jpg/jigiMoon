// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// defaults for the search limits; adjustable on the page (advanced options)
export const BUDGET = { move: 3, mast: 20, wait: 60 };
export const THRESHOLDS = { sun: 70, dark: 50, earth: 50 };
// filled from the data's mast_ok keys by loadIndex()
export const MAST_HEIGHTS = [];
export const MAST_SLIDER = { min: 2, max: 100, mark: 20 };
export const GLOBE = { r: 96 };   // disc radius in a 232-unit plate
export const FIRST_DAY = Date.UTC(2027, 0, 1);

// Demo state: GO on the baseline day, NO-GO nine days later
export const DEFAULT = {
  site: 'nobile-rim-1',
  day: 45,
  baseline: 36,
  mission: 14,
  mast: 0,
  mastMax: BUDGET.mast,
  moveMax: BUDGET.move,
  waitMax: BUDGET.wait,
  hour: 200,
  pinned: [],
  view: 'focus',
  zoom: 1,
  mode: 'date',
  playing: false,
  expo: 0,
  pan: '',
  d3: 0,
  pro: 0
};
// zoom factor: 1 = +-200 km; presets Region 1, Site 4, Spot (+-3.5 km)
export const ZOOM = { site: 4, spot: 200 / 3.5, slideMs: 250 };
export const RIM_TOL = { km: 3, frac: 0.15 };
export const ON_MASSIF_KM = 10;
