# Layers — Design Spec (GIS-style overlay view)

South-pole maps of every decision factor, stacked like a GIS project. Three modes on one map:
**Layers** (inspect, opacity), **Mask** (thresholds intersected), **Score** (weighted sum).
Target: static, plain HTML/CSS/vanilla ES modules, no build step, no libraries. Reference 1440×900,
no page scroll. Self-contained folder `navigator/layers/` that also mounts inside the navigator later.

Visual system = the navigator's (`navigator/DESIGN.md` §4, `navigator/style.css`): same `:root` tokens
(copy the block, light + dark), IBM Plex Sans KR / IBM Plex Mono, `.panel`, `.seg`, `h2`, `#tip`, `.n`.
Light chrome; the map panel is always dark (`data-theme="dark"`, ground `#222`).

Text budget: panel titles `LAYERS`, `MAP`, `SITES`. Mode names `Layers`, `Mask`, `Score`. Layer names
and units come from `layers.json`. Nothing else is written on the page except numbers. No legend box:
**each layer row is at once the legend, the control and the hover readout.**

---

## 1. Wireframe (1440×900)

```
x:12              352 364                                        1166 1178          1428
  ┌───────────────────────────────────────────────────────────────────────────────────┐ y12
  │ LUNAR LANDING SITE NAVIGATOR                                                    48 │
  ├─────────────────┬──────────────────────────────────────────────┬──────────────────┤ y72
  │ LAYERS  [Layers|Mask|Score] │ MAP          ● Earth       3 412 km² │ SITES            │
  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ (Score only)│                                      │ Malapert Massif ↗│
  │ ⋮ ■ Sunlight       82 % │        ·  85°                         │ ●●●○  ▬▬▬▬░░  41 │
  │   ▁▂▃▅▇▆▃▂▁▁ histogram  │     ▢ Haworth      ▢▢ Mons Mouton     │ Nobile Rim 1     │
  │   ████████▼███ ramp     │          ·  88°                       │ ●●○○  ▬▬░░░░  18 │
  │   0     ≥70      100    │              +  pole                  │ …                │
  │   ───────●──────  85 %  │         ▢ de Gerlache                 │ 12 rows × 44     │
  │ ─────────────────────── │                                      │ sorted by number │
  │ ⋮ ■ Earth          43 % │        800 × 800 canvas               │                  │
  │   …                     │        + SVG overlay                  │                  │
  │ 8 rows × 88             │                                      │                  │
  │                         │ ⌂                          ├─ 50 km ─┤ │                  │
  └─────────────────┴──────────────────────────────────────────────┴──────────────────┘ y874
        340                            802                               250
```

```css
.lyr-app  { display:flex; flex-direction:column; gap:12px; padding:12px; height:100vh;
            min-width:1180px; min-height:700px }
.lyr-main { flex:1; min-height:0; display:grid; gap:12px; align-content:start;
            grid-template-columns: 340px var(--S) minmax(230px,1fr); grid-template-rows: var(--S) }
```

`--S` (map panel side, set from JS on resize) = band height; if that is in `[802, 962)` snap to
**802** (800 px canvas + 1 px border → raster shown 1:1). All three panels are `--S` high. `LAYERS`
and `SITES` scroll internally (`overflow:auto`) if the band is shorter than their content.
All class names are prefixed `lyr-` so the CSS can be loaded inside the navigator without clashes.

Header: `.app-name` only, as a link to `../index.html`. It is dropped when embedded.

---

## 2. State

```js
state = {
  mode: 'mask',                       // 'layers' | 'mask' | 'score'   (keys 1 / 2 / 3)
  order: ['sun','earth','both','dark','slope','mast','days','psr'],  // list order, top = drawn last
  on: { layers:{sun:true}, mask:{sun:true,earth:true,dark:true,slope:true}, score:{/* weight>0 */} },
  opacity:   { [id]: 0.85 },          // Layers mode
  threshold: { [id]: number },        // from layers.json; shared by Mask, Score and the readout
  weight:    { [id]: 0..10 },         // from layers.json (`weight`, else `default_weight`, else 0)
  view: { k:1, cx:400, cy:400 },      // zoom factor and centre, in grid pixels
  hover: null | {col,row},  pin: null | {col,row},   // pin = clicked pixel, freezes the readout
  site: null | id                     // selected site
}
```

`on` is kept per mode, so switching modes never loses a setup. Hash: write only `m` (mode) and `s`
(site) with `history.replaceState`; read them on load. `setState(patch, what)` with
`what ∈ 'pixels' | 'view' | 'overlay' | 'panel'` so each change triggers the cheapest redraw (§7.5).

---

## 3. LAYERS panel

Head: `h2 LAYERS` left, `.seg` `Layers | Mask | Score` right. Then 8 rows, 1 px `--line` between.

### 3.1 Row anatomy (316 px wide, 88 px high; 72 px in Mask)

```
L1 20  ⋮  ■  Sunlight                                   82 %     grip · toggle · name · readout
L2 20        ▁▂▃▅▇▆▃▂▁▁▂▃▃▂▁                                      histogram, 50 bars
L3  8        ████████████████▼██████████                         ramp = legend; ▼ threshold handle
L4 14        0              ≥70               100                 10 px mono muted
L5 18        ─────────────●─────────           85 %               one slider, meaning set by mode
```

- **Toggle** `■`: 12×12 square button, filled with the layer colour (ramp stop 3, §5) when on, 1 px
  `--muted` outline when off. Off rows stay the same height at `opacity:.45`. `aria-pressed`.
- **Readout** (L1 right, mono 14/600): value of this layer at the pinned-or-hovered pixel, with unit.
  `--block` colour when it fails the row's threshold; `–` for no data; empty when no pixel. Shown for
  every row, on or off — hovering the map always reads all eight layers.
- **Histogram**: counts of the 640 000 pixels in 50 bins (5 byte-values each, 255 excluded),
  bar height ∝ √count, max 20 px. Bars on the passing side of the threshold use the layer colour,
  failing side `--none`. A 1 px `--ink` tick spans L2–L3 at the readout value.
- **Ramp**: the layer's colour ramp as a CSS `linear-gradient`, min at left. Threshold layers carry a
  handle (▼, 9 px, `--ink`) on it; the failing side of the ramp is covered with `--surface` at 60 %.
  Drag, or focus + ←/→ (one byte-step = (max−min)/250), double-click = default. `role="slider"`.
- **L4**: `min`, `max` at the ends, threshold as `≥70` / `≤8` centred under the handle.
- **L5 slider** (`<input type=range>`, accent = layer colour):
  - Layers → opacity 0–100 %, number `85 %`.
  - Score → weight 0–10 step 1, number = share of the total, `25 %`. Weight 0 = row off.
  - Mask → L5 not rendered.
- **Grip** `⋮`: native `draggable` rows; drop reorders `state.order`. Alt+↑/↓ on a focused row does the
  same. Order only changes pixels in Layers mode.

### 3.2 Which rows are active

| Mode | Active rows | Others |
|---|---|---|
| Layers | all | — |
| Mask | rows whose `threshold` is not null (sun, earth, dark, slope, mast) | toggle disabled, row at .45 |
| Score | all; on ⇔ weight > 0 (toggle sets weight 0 / restores last) | — |

Defaults: Layers `sun`; Mask `sun, earth, dark, slope` (`mast` off — turning `sun`+`earth` off and
`mast` on shows how much ground a mast buys); Score = weights from `layers.json`.

### 3.3 Score composition bar

Score mode only, between head and rows: one 8 px bar, 316 px wide, split into segments ∝ weight, each
in its layer colour, 1 px `--surface` gaps. It is the formula; no text.

---

## 4. MAP panel

Stack: `<canvas class="lyr-raster">` + `<svg class="lyr-vec">` (same box, `position:absolute; inset:0`).
`h2 MAP` top-left, white with dark text-shadow (as in the navigator).

### 4.1 Result badge (top-right, white 18 px/600 mono, text-shadow)

- Mask: passing area, `3 412 km²` (pass pixels × 0.25, thin-space thousands).
- Score: a 120×8 px ramp (score ramp) with `0` and `100` at its ends and a white tick at the readout.
- Layers: nothing.

### 4.2 Vector overlay (SVG, redrawn on view / hover / selection change; never rasterised)

- Graticule: circles at 85°S and 88°S, the two axes through the pole; white, 1 px, opacity .25;
  `85°` `88°` 10 px mono, opacity .6. Earth marker: 4 px `--earth` dot at the top edge centre (k = 1 only).
- **Region boxes** (9 Artemis III regions + 2 PGDA boxes, `box_m = [xmin,ymin,xmax,ymax]`): `rect`,
  no fill, white 1 px opacity .7. Hovered or selected: `--box` 2 px.
- **Site markers** (12, at `x_m,y_m`): circle r 4, white 1.5 px stroke. Fill tells the result at
  that pixel — Mask: `--ok` if all on-criteria pass, else none; Score: score-ramp colour; Layers: none.
- Labels: only the hovered and the selected site (12 px, white, 2.5 px black stroke, `paint-order:stroke`).
  Hovering a SITES row highlights its marker and box, and vice versa.
- Hover: when `k ≥ 4`, a 1 px white square around the hovered pixel. Pin: white `+`, 9 px.
- Scale bar bottom-right: nearest of 100 / 50 / 20 / 10 / 5 km that is ≤ 120 px wide, white, label `50 km`.
- `#tip` (navigator style) follows the cursor: `86.37°S 23.3°W` and, in Mask, ` · 3/4`; in Score ` · 72`.

### 4.3 Interaction

- Move: `hover` → readouts update (panel only, no recompose). Click on ground: pin / unpin. Esc: unpin.
- **Zoom/pan: included, minimal.** Wheel zooms about the cursor (×1.2 per notch, `k ∈ [1,16]`), drag
  pans (clamped so the map always covers the panel), double-click ×2, `⌂` button bottom-left (only when
  `k > 1`) and key `0` reset. No inertia, no pinch.
- Click a marker or box: select the site and fly (250 ms, skipped under `prefers-reduced-motion`) to its
  box with 20 % margin; a site without a box → `k = 8` centred on it.

---

## 5. Colour

Ramps are 5 stops at t = 0, .25, .5, .75, 1, linear interpolation in sRGB bytes, low value = dark.
One hue family per layer, taken from the navigator tokens where one exists. **Layer colour** = stop 3
(index 2) on the light panel, stop 4 (index 3) on the dark map.

| id | stop 1 | stop 2 | stop 3 | stop 4 | stop 5 | note |
|---|---|---|---|---|---|---|
| `sun` | `#2b1a04` | `#6e4200` | `#b96f00` | `#f0a531` | `#ffe7a6` | amber |
| `earth` | `#0b1833` | `#173873` | `#2459b8` | `#74a2f2` | `#dce8ff` | blue |
| `both` | `#04222a` | `#0b4a57` | `#14808f` | `#4fc0c9` | `#d4f4f3` | teal |
| `dark` | `#2b0a22` | `#6b1c57` | `#ab3a8c` | `#e274b8` | `#fbd9ee` | magenta |
| `slope` | `#1a2206` | `#44580f` | `#7c9a1e` | `#b7d353` | `#eef7c4` | lime |
| `days` | `#06241a` | `#0f5238` | `#1f8a5b` | `#4cbf82` | `#d6f6e3` | green; value 0 → transparent |
| score | `#440154` | `#3b528b` | `#21918c` | `#5ec962` | `#fde725` | viridis, 0–100 |

Discrete layers (no interpolation):

| id | values → colour | layer colour |
|---|---|---|
| `mast` | ≤2 m `#e6dbfb` · ≤10 m `#ab89ec` · ≤20 m `#7446bd` · byte 255 (= >20 m) transparent | `#7446bd` / `#ab89ec` |
| `psr` | 1 `#9fe3ff` · 0 transparent | `#3aa7cf` / `#9fe3ff` |

Mask colours (on the map):

| Pixel | Colour | Alpha |
|---|---|---|
| passes every on-criterion | `#4cbf82` | .80 |
| fails exactly one | that layer's colour (stop 4) — the limiting factor | .40 |
| fails two or more | `#0f131b` | .65 |
| no data in any on-criterion | `#0f131b` | .85 |

So the Mask map answers "where" in green and "what is missing here" in the hue of the row to blame.
Score: score-ramp colour at alpha .85; no data → `#0f131b` .85. These are data colours: constants in
`config.js`, not theme tokens. No gradients or shadows in the chrome.

---

## 6. SITES panel

12 rows, 44 px each, sorted descending by the row number; ties keep `sites.json` order.

```
Malapert Massif                         ↗      13 px; 600 when selected; ↗ only on the selected row
●●●○   ▬▬▬▬▬▬▬▬░░░░░░░░░░░░           41      dots · bar (6 px, --line track) · mono number
```

| Mode | Dots | Bar + number |
|---|---|---|
| Mask | one per on-criterion in panel order: filled layer colour = passes at the site pixel, 1 px outline = fails | % of the region box that passes all (zonal share); bar `--ok` |
| Score | — | mean score of the region box, 0–100; bar in the score-ramp colour of that value |
| Layers | — | value at the site pixel of the top-most on layer; bar ∝ (v−min)/(max−min) in the layer colour |

Site without `box_m` (IM-2 Athena): use the 21×21 px square (±5 km) around the site.
Hover a row → highlight on the map. Click → select + fly. The `↗` on the selected row is the bridge to
the navigator: `<a href="../index.html#s=<id>">` standalone, or `opts.onSite(id)` when embedded (§8).

---

## 7. Rendering algorithm

### 7.1 Grid and coordinates

```
N = 800, PX = 500 m, HALF = 200 000 m, R = 1 737 400 m
col = floor((x + HALF) / PX)        row = floor((HALF − y) / PX)        i = row*N + col
x = −HALF + (col + .5)*PX           y =  HALF − (row + .5)*PX
r = hypot(x, y)   lat = −90 + 2·atan(r / 2R)·180/π   lon = atan2(x, y)·180/π   (0° up, +E right)
radius of latitude φ: 2R·tan((90 − |φ|)/2)      → 85° = 151.7 km, 88° = 60.7 km
value = min + v·(max − min)/250 ; v = 255 → no data (except `mast`, where 255 = ">20 m" = fail)
```

Number format: 1 decimal when `max − min ≤ 30`, else integer. Screen ↔ grid, with `W` = panel side in
CSS px, `s = W·k/N`: `sx = (col − (cx − N/2k))·s`, same for y. `view.cx, cy` clamped to
`[N/2k, N − N/2k]`.

### 7.2 Buffers (allocated once)

- `layer[id]`: `Uint8Array(640000)` from `data/<id>.bin` (`fetch → arrayBuffer`; check `byteLength`).
- `hill`: `Uint8Array(640000)`, R channel of `data/hillshade.png` drawn once to a temp 800×800 canvas.
- `light[256]`: `Float32Array`, `light[h] = 0.45 + 0.55·h/255` — keeps relief visible under colour.
- `comp`: offscreen `<canvas>` 800×800; one `ImageData`; write through `new Uint32Array(img.data.buffer)`
  (little-endian: `0xFF000000 | b<<16 | g<<8 | r`). Output is always opaque.
- Per layer LUTs, 256 entries, rebuilt only when their input changes:
  `rampR/G/B/A` (colour; A = 0 where transparent or v = 255), `pass` (Uint8: 1 pass, 0 fail, 2 no data),
  `score` (Float32 0..1, −1 no data).
- Results, reused by the readout and SITES: `failCount: Uint8Array` (255 = no data) and
  `score100: Uint8Array` (255 = no data).

### 7.3 Per-pixel compositing — one loop over 640 000 pixels per mode

**Layers** — premultiplied "over", bottom of the list first, then shade and lay on the hillshade:

```
pr = pg = pb = 0; A = 0
for id of on-layers, reversed order:  v = layer[id][i];  a = rampA[v]/255 · opacity[id];  if a == 0 continue
    pr = rampR[v]·a + pr·(1−a)  (same g, b);   A = a + A·(1−a)
h = hill[i];  L = light[h]
out = h·(1−A) + p·L          // per channel
```

**Mask** — `pass[v]` per on-criterion; count fails and remember the last failing layer:

```
pass[v] = 2 if v == 255 (mast: 0)  else  direction '>=' ? value >= thr : value <= thr
n == 0 fails → C = #4cbf82, a = .80        n == 1 → C = hue4(failing layer), a = .40
n >= 2       → C = #0f131b, a = .65        any no-data → C = #0f131b, a = .85
out = h·(1−a) + C·L·a ;  failCount[i] = n  (255 if no data)
```

With no criterion on: draw the bare hillshade and show no badge.

**Score** — weighted linear combination; the threshold is the mid-point of each layer's score, so
moving a threshold reshapes the score map too:

```
worst/best = min/max ('>=') or max/min ('<=');   threshold null → s = (val − min)/(max − min)
s(val) = val on the failing side:  0.5·(val − worst)/(thr − worst)
         val on the passing side:  0.5 + 0.5·(val − thr)/(best − thr)        (clamp 0..1; guard ÷0)
mast: byte 255 → s = 0.   Any other on-layer with v = 255 → pixel is no data.
S = Σ w·s / Σ w ;  score100[i] = round(100·S) ;  C = scoreRamp[S], a = .85 ;  out = h·(1−a) + C·L·a
```

Keep the loops monomorphic: gather the on-layers' arrays and LUTs into plain arrays before the loop,
no closures or object lookups inside. Expected cost < 10 ms; recompose inside `requestAnimationFrame`,
coalesced, directly on slider `input` events (live while dragging).

### 7.4 Visible canvas, devicePixelRatio, zoom

Backing store `W·dpr` square (`dpr = min(devicePixelRatio, 2)`), CSS size `W`. Blit:

```js
ctx.imageSmoothingEnabled = (W * dpr * k / N) < 1.5;       // crisp cells once magnified
const w = N / k, x0 = cx - w/2, y0 = cy - w/2;
ctx.drawImage(comp, x0, y0, w, w, 0, 0, W*dpr, W*dpr);
```

At 1440×900, dpr 1, k 1 this is a 1:1 copy. Zoom and pan never recompose; they only blit and redraw SVG.

### 7.5 Redraw matrix

| Change | recompose | zonal stats | blit | SVG | panel |
|---|---|---|---|---|---|
| mode, toggle, threshold, weight, opacity, order | ✓ | ✓ | ✓ | ✓ | ✓ |
| view (zoom, pan, resize) | | | ✓ | ✓ | |
| hover, pin | | | | ✓ | readouts + ticks only |
| site select / hover | | | | ✓ | SITES rows |

Zonal stats: each site's box → `{c0,c1,r0,r1}` once at load; after a recompose, loop those pixels over
`failCount` / `score100` (≤ 20 000 px per site). Histograms are computed once at load.

---

## 8. Files and exports

```
layers/
  index.html        fonts <link>, <div id="layers-root">, <script type="module" src="js/main.js">
  layers.css        tokens (copied) + .lyr-* rules
  data/             layers.json, <id>.bin ×8, hillshade.png, sites.json (copy of lunar/sites.json)
  js/
    main.js         export async function mount(root, opts = {})  // opts: { dataUrl='./data/',
                    //   header=true, onSite=null, lang }  → builds DOM, loads, wires; returns { destroy }
                    // index.html calls mount(document.getElementById('layers-root'))
    config.js       export const N, PX, HALF, R_MOON, RAMPS, DISCRETE, MASK_COLORS, SCORE_RAMP,
                    //   DEFAULT_ON, FAIL_AT_255 = ['mast'], ZERO_TRANSPARENT = ['days','psr']
    strings.js      export const t(key)            // en + ko, ?lang=ko; ~10 keys incl. units
    data.js         export async function loadAll(dataUrl)  → { layers:[meta…], bytes:{id:Uint8Array},
                    //   hill:Uint8Array, sites:[…], hist:{id:Uint32Array(50)} }
                    export const decode(meta, v), fmt(meta, val)
    state.js        export const state; export function setState(patch, what); export function subscribe(fn)
    geo.js          export const xyToCell(x,y), cellToXY(col,row), cellToLatLon(col,row), latRadius(latDeg)
    ramps.js        export function buildRampLUT(id)  → {r,g,b,a: Uint8Array(256)}
                    export function rampCss(id)       → 'linear-gradient(…)'
                    export function colorAt(stops, t) → [r,g,b];  export const layerColor(id, onDark)
    compose.js      export function initCompose(data) → { comp /*canvas*/, failCount, score100 }
                    export function passLUT(meta, thr), scoreLUT(meta, thr)
                    export function compose(state)    // fills comp + result arrays, returns { passPx }
                    export function sample(col,row)   → { values:{id:number|null}, pass:{id:bool|null},
                                                         fails:n|null, score:n|null }
                    export function zonal(site, mode) → number
    mapview.js      export function initMap(panelEl, data, handlers)  // canvas + svg + pointer/wheel
                    export function blit(), drawOverlay(state), flyTo(site), cellFromEvent(e)
    panel.js        export function initPanel(el, data), renderPanel(state), renderReadout(sampleResult)
    sites.js        export function initSites(el, data, handlers), renderSites(state, stats)
```

Each file ≤ ~200 lines. No user-visible string literal outside `strings.js` and `layers.json`.
No colour hex outside `config.js` and the CSS tokens.

Embedding in the navigator later: `import { mount } from './layers/js/main.js'` and
`mount(el, { header:false, onSite: id => setState({ site:id, view:'focus' }) })`. The navigator's
hash key for the site is `s` and its site ids are the `id`s in `sites.json`.

---

## 9. Build order (≈ 2 h)

1. `config`, `geo`, `data`, `ramps`; page shell and CSS grid. (20 min)
2. `compose` Layers mode + `mapview` blit at k = 1 → one layer over the hillshade. (25 min)
3. `panel` rows: toggle, ramp, histogram, opacity slider, hover readout. (25 min)
4. Mask mode + threshold handle + area badge; Score mode + weights + composition bar. (25 min)
5. SVG overlay: graticule, boxes, markers, tip; `sites` panel with zonal numbers and `↗`. (15 min)
6. Zoom/pan, reorder, keys, hash. Cut in this order if short: reorder → fly animation → hash. (10 min)

If `data/` is not there yet, test against throwaway synthetic `.bin` files (radial gradients) made by a
script kept outside the module; ship none of it.

## 10. Confirm against the real data

- `layers.json` key names (`weight` vs `default_weight`; `threshold: null` for `both`, `days`, `psr`).
- `mast`: that min/max decode bytes 2/10/20 to metres, and that 255 means ">20 m" there, not "no data".
- `psr` / `days`: byte 0 is a real value (drawn transparent), 255 the only no-data code.
- Orientation: Malapert Massif's marker (x −7.3 km, y +122.5 km) must sit near the top centre, on a
  bright ridge in the hillshade; the Shackleton rim marker next to the pole.
- Sanity: at the 12 site pixels, `sun`/`earth`/`slope` readouts should be within a few points of
  `ours_sun_pct_18y`, `ours_earth_pct_18y`, `slope_deg` in `sites.json` (different epoch and resolution).

## 11. Acceptance

- 1440×900: no page scroll, raster 1:1, three panels equal height, no text beyond the budget stated at the top.
- Dragging any threshold or weight updates map, badge and SITES order live, without visible lag.
- Hovering the map fills all eight readouts; failing values are red; the tick moves on each ramp.
- Mask with `sun, earth, dark, slope`: green area is the intersection; turning one off can only grow it.
- Score with a single weighted layer reproduces that layer's pattern (threshold at mid-ramp).
- `↗` on a selected site opens the navigator on that site.
