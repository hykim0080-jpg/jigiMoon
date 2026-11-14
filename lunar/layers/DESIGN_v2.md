# Find a site (입지 분석) — Redesign v2

Applies to `navigator/layers/` (plain HTML/CSS/ES modules, no build). Supersedes the layout, map
rendering, zone list and pin card of `DESIGN.md`; compositing maths, data loading, zoom/pan, sky
graph, shadow and landmark/lander/compass drawing stay as coded. Reference 1440×900, no page scroll.

Facts measured on the shipped data (defaults sun/earth/dark ≥ 60 d, slope ≤ 8°), which drive the design:
- Suitable ground is **680 km² = 2 720 px = 0.4 % of the map**, in 959 fragments (largest 10 km²).
  A fill alone can never "pop" at 1:1; it needs a dimmed base, a glow and markers.
- Joining fragments ≤ 1 km apart gives 444 zones; top five: Mons Mouton 21 km (29.8 km²), Mons
  Mouton 39 km (25.8), Cabeus 95 km (21.5), Nobile 51 km (13.5), Amundsen 59 km (12.5).
- 2 716 of the 2 720 suitable px have ≥ 1 GO day (median 42 d/yr), so green and the pin verdict agree.
- `days6_m20` uses the same 0..250 byte scale as `days6` (the current `×365/250` is right).
- Day 0 (Jan 1) has 6 GO px on the whole map; day 45 (mode A's default, Feb 15) has 11 922.

## 1. First-glance story

1. **Where** — a dark-grey pole with one colour on it: green glows where all four criteria hold.
   Five green numbered badges stand on the five largest zones.
2. **Why** — left, top: four criteria, each one line with one handle. Hover a line and the map shows
   in that line's colour the ground that only this criterion rejects.
3. **Which** — left, below: the same five badges as a ranked list (area, GO days).
4. **Verdict** — right: a pin card that is never empty. On load the pin stands on zone 1's best
   pixel, so the card already reads `GO` or `NO-GO → AVAILABLE IN 12 DAYS`. Click the map or a
   zone row and the pin moves. That is the whole instruction, and it is not written anywhere.

Reading order is left→right = cause → place → verdict. Everything else is behind `고급 / Advanced`.

## 2. Wireframe (1440×900)

```
x:12            312 324                                       1126 1138            1428
 ┌──────────────────────────────────────────────────────────────────────────────────┐
 │ 달 착륙지 내비게이터  [사이트 비교|입지 분석]                               h32   │
 ├───────────────┬────────────────────────────────────────────┬─────────────────────┤ y56
 │ 조건       고급│ ■ 적합 680 km²                    ● Earth  │ 무통산에서 지구 쪽   │
 │■ 햇빛 ≥ 70 %  │                                      ↑     │ 21 km                │
 │      60일 이상│        ·85°      MONS MOUTON                │ ◀ 2027-02-15 ▶       │
 │ ░░▼██████████ │              ①▁▁ ②                         │ ● 불가 → 12일 후 가능│
 │■ 지구 가시≥50%│        ③                 NOBILE  ④         │ 이동  지구쪽 왼편 1.5km│
 │ ░░▼██████████ │                 ·88°                        │ 마스트 20 m   +126일 │
 │■ 연속 어둠≤50h│             SHACKLETON  + 남극점            │ 대기          12일   │
 │ ░░▼██████████ │                      ⑤  AMUNDSEN            │ ■ 햇빛 ≥70% ▬▬|▬░ 134일│
 │■ 경사  8° 이하│                                             │ ■ 지구 가시 ▬▬|▬▬ 266일│
 │ ███▼░░░░░░░░░ │         800×800 canvas + SVG                │ ■ 연속 어둠 ▬|▬░░  92일│
 │───────────────│                                             │ ■ 경사      ▬░|░░   4° │
 │ 구역 444  km² GO일│                                         │ ┌─ sky graph ───────┐ │
 │① 무통산… 21km │                                             │ │ (flex, 120–220)   │ │
 │  ▬▬▬▬▬ 29.8 65│                                             │ └───────────────────┘ │
 │② … ③ … ④ … ⑤ │                                             │ ▮▮ ▮▮▮  ▮▮ |▮  GO 82일│
 │               │ ☀ ⌂                            ├ 50 km ┤    │ [사이트 비교에서 보기↗]│
 └───────────────┴────────────────────────────────────────────┴─────────────────────┘ y858
       300                        802                                   290
```

The pin state is the default state (auto-pin, §7). A user pin differs only in where the yellow pin
stands, the dashed line to the MOVE target, and `pin=` in the hash.

```css
.lyr-main{grid-template-columns:300px var(--S,802px) minmax(250px,1fr)}
```

## 3. Default vs Advanced

`state.adv` (false). Toggle = text button `고급 / Advanced` at the right of the `조건` head,
`aria-pressed`; hash `a=1`. Set `data-adv` on `.lyr-app`; CSS shows/hides.

| | Default | Advanced adds |
|---|---|---|
| Left top | 4 criteria rows (§5) | replaced by the existing LAYERS panel (`panel.js` untouched: seg Layers/Mask/Score, 11 rows, histograms, weights, reorder) in a box `max-height:52%; overflow:auto` |
| Left bottom | zone list, 5 rows (§6) | 20 rows; min-area slider, month strip + `≥N d` slider, ✎ brush, sort seg; per-criterion medians as a labelled line in each row |
| Map raster | simple mask (§4.1) | current mask (near-miss hues, dark veil), Layers and Score modes, score cutoff badge |
| Map vectors | landmarks, landers, compass, graticule, 5 badges, pin | zone numbers 6–20 (current small style), Artemis boxes + site circles |
| Pin card | §7 | a labelled two-column table of every layer value under the criteria checks; lat/lon line |
| Tooltip | place + failing criteria (§4.3) | adds lat/lon and score |
| Keys | `0` home, `Esc` re-auto-pin, ←/→ day | `1/2/3` modes |

Leaving Advanced forces `mode:'mask'`, `month:null`, `edit:null`, `minArea:1`. Brush overrides
(`state.ov`, localStorage) are applied **only while `adv`** (compose and zones read
`st.adv ? st.ov : null`), so a stale edit can never alter the default picture.

## 4. Map

### 4.1 Raster (simple mask: `mode==='mask' && !adv`)

| Pixel | Colour | Rule |
|---|---|---|
| base (everything) | hillshade × **0.72** | `g = h*0.72`; relief stays readable, nothing is veiled |
| passes all on-criteria | `#46e58c` α **.95**, not light-modulated | `out = g*.05 + C*.95` |
| fails exactly one, and it is `state.focusCrit` | that row's hue α **.55**: sun `#f0a531`, earth `#74a2f2`, dark `#e274b8`, slope `#b7d353` | only while a criteria row is hovered, focused or dragged |
| fails ≥ 2, no data, other near-miss | base only | near-misses are otherwise **hidden** |

**Glow.** One-pixel speckle is invisible at 1:1, so clusters get a halo, built after each compose:
1. `mask` canvas 800×800: pass px = `#46e58c` opaque, rest transparent (second `Uint32Array` filled in the same loop).
2. `tmp` 200×200: `drawImage(mask,0,0,200,200)` with smoothing; `halo` 800×800: clear, then
   `drawImage(tmp,0,0,800,800)` **three times** (alpha builds up). No `ctx.filter` (Safari).
3. In `blit()`, after the composite and before the shadow canvas: `globalCompositeOperation='screen'`,
   `globalAlpha = 0.9*clamp((6-k)/4,0,1)`, draw `halo` with the same source rect, then restore.
Lone pixels fade out (1/16 alpha), clusters glow; past k = 6 the halo is gone and cells are crisp.

Legend, top-left where the `MAP` title was (title deleted): 12 px swatch `#46e58c` + `적합 680 km²`
/ `SUITABLE 680 km²`, white 14/600 with text-shadow. The right-top km² badge is removed in default.

### 4.2 Vectors (draw order)

1. Graticule 85°/88° circles and the two axes: opacity .18 (was .25).
2. Hot zone outline only (hovered row/badge): existing `zh1` + `zh2`. No other outlines in default.
3. Landmarks (unchanged; tier 1 always, 13/600), landers (unchanged).
4. **Zone badges**, zones 1–5: stem from the zone's `best` pixel `(x,y)` up to `(x,y-10)`
   (1.5 px `#46e58c` over 3.5 px `#000` α .6), circle `cx=x, cy=y-21, r=11`, fill `#46e58c`,
   stroke `#06241a` 1.5; number 13 px/700 mono `#06241a`, centred. Hot: fill `var(--box)`.
   If a badge centre is within 24 px of a higher-ranked one, flip it below (`cy=y+21`, stem down).
   Badges are clickable (hit r 13, tested before landers) = click on the zone row.
5. Pin: existing yellow teardrop. Dashed line + dot to the MOVE target only when the verdict offers
   a move; stroke `var(--move)`.
6. Compass (unchanged), scale bar (unchanged).

Site boxes/circles: not drawn in default, except the one box containing the pin (class `box hot`,
with its name label), because the Compare link targets it.

### 4.3 Interaction

- Click ground or a site-less spot → `pin = cell`, `autoPin = false`. No unpin; `Esc` → `autoPin = true`.
- Tooltip: line 1 place (`describe`), line 2 `적합` / `SUITABLE` in `#46e58c`, or the failing
  criteria with values, `·`-joined, in `var(--block)`: `햇빛 12일 · 경사 14°`.
- Time bar: closed by default — only the `☀` button shows (bottom-left; `⌂` to its right when
  k > 1). Pressing `☀` turns the shadow on and opens the existing day + hour sliders; pressing again
  closes them. Date is otherwise set from the pin card (§7).

## 5. Criteria panel (default left top)

Rows = layers with `threshold != null`, in `layers.json` order (4). Row 276×48, 1 px `--line` between.

```
L1 24  ■ 햇빛 ≥ 70 %                      60일 이상    toggle · name (13/500) · handle value (13/600 mono)
L2 16    ░░░░░▼███████████████████|█████              6 px track; ▼ handle; | pin tick (1 px --ink)
```

- **Name** is built from `meta.criteria`, so the fixed sub-criterion is said once, in the name:

| id | ko | en |
|---|---|---|
| `sun_days` | `햇빛 ≥ {min_sun_pct} %` | `Sun ≥ {..} %` |
| `earth_days` | `지구 가시 ≥ {min_earth_pct} %` | `Earth in view ≥ {..} %` |
| `dark_days` | `연속 어둠 ≤ {max_dark_h}시간` | `Dark spell ≤ {..} h` |
| `slope` | `경사` | `Slope` |

- **Handle value**: `{v}일 이상` / `≥ {v} d` for day counts, `{v}° 이하` / `≤ {v}°` for slope. Native
  `title` on the row = `meta.definitions[id]` (the only long text, not on screen).
- **Track**: failing side `var(--line)`, passing side the layer colour (stop 3 on light). Handle and
  drag/keyboard/double-click logic: copy `setT`, `fromEv`, key handler from `panel.js`; bigger
  target (track hit area 16 px high). No histogram, no min/max labels, no opacity slider.
- **Toggle** ■ 12 px as now (off = row .45, criterion leaves the mask).
- **Pin tick** at the pin's value (hover does not move it; hover speaks through the tooltip).
- `pointerenter`/`focusin`/drag → `setState({focusCrit:id},'pixels')`; `pointerleave`/`focusout`
  and not dragging → `null`. This is the "why" view of §4.1.

## 6. Zone list (default left bottom)

Zones = connected components of the pass mask **after joining fragments ≤ 1 km apart**
(`ZONE.merge = 1`: label on the mask dilated by one cell, 8-neighbourhood; area, medians and `best`
use real pass pixels only; the outline is the dilated envelope). Kept if ≥ `minArea` (1 km²), ranked
by area. `best` = pass pixel with the largest `days14` byte (≤ 250), ties → nearest the centroid.

```
head 22   구역 444                         km²   GO 일     h2 + count (muted) · two column heads, right-aligned
row  50   ①  무통산에서 지구 쪽 21 km                       badge (r 10, same style as the map) · title 13/500, 1 line, ellipsis
              ▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░        29.8     65       bar 6 px (area / largest area, #1f8a5b on --line) · mono 13/600 · mono 13
```

Columns: badge 28 · bar flex · area 48 · GO days 40 (median `days14` of the zone, in days). The
numbers are named by the head directly above them; no chips, no colour-coded values.
Hover row ⇄ badge + outline on the map. Click row or badge: `pin = zone.best`, `autoPin = false`,
`flyToCells(bbox)` with the zoom capped at **k ≤ 4** so the named landmarks stay in view.
En head: `ZONES 444 · km² · GO d`.

## 7. Pin card (right panel, always present)

Right panel = one card, flex column, gap 8, no border box inside. 266 px inner width.

```
1  title      무통산에서 지구 쪽으로 21 km                  14/600, ≤ 2 lines (describe)
2  date       ◀  2027-02-15  ▶                            28 px, mono; ←/→ keys; = state.tDay
3  verdict    ● 불가 → 12일 후 가능                        16/600, ≤ 2 lines, colour by kind
4  fixes      이동     지구 쪽 왼편 1.5 km                  3 rows × 22: label (11 px caps, own colour) · value mono right
              마스트   20 m · +126일
              대기     12일
5  checks     ■ 햇빛 ≥ 70 %   ▬▬▬|▬▬▬░░░░   134일          4 rows × 20: same order, swatch, name as §5;
              …                                            bar 90 px 0..max with threshold tick; value mono;
                                                           fail → value and fill var(--block)
6  sky        existing drawSky compact                     flex:1, min 120, max 220
7  calendar   ▮▮▮ ▮▮  ▮▮▮▮|▮▮   ▮▮          GO 82일        365-day strip 10 px + month ticks; cursor at tDay;
                                                           click/drag sets tDay; right: count 13/600 --ok
8  link       [ 사이트 비교에서 보기 ↗ ]                     existing; `d=` now carries state.tDay
```

Default date: `state.tDay = 45` (2027-02-15, same as Compare) unless `d=` is in the hash.

### 7.1 Verdict logic (`pin.js`, new `verdict(info, st)`)

```
d      = st.tDay;  i = row*N + col
steep  = slope value > st.threshold.slope            (slope criterion on; else false)
goBit(i, d): binary search of i in ok14.idx, then bit d (existing goDays code, factored out)
goNow  = !steep && goBit(i, d)
run    = number of consecutive GO days starting at d
wait   = steep ? null : (first d2 > d with go[d2]) − d          // within 2027, no wrap
move   = nearest cell within 20 cells (10 km) with goBit(cell, d) && slope(cell) ≤ threshold
         → { km: 0.5·dist, sector, col, row } | null            // replaces nearest(); 41×41 lookups
mast   = steep ? null : { gain: days(days6_m20) − days(days6), from: days(days6), to: days(days6_m20) }
         null when gain < 10                                    // year totals, 6-day mission, 20 m
headline:
  goNow                                   → go
  else best of {wait: wait/60, move: km/3} by lowest cost, tie → wait     (BUDGET as mode A)
  else mast && go.count === 0             → mast
  else                                    → none
```

Cache key adds `tDay` and `threshold.slope`. Everything is re-evaluated when the date changes.

### 7.2 Wording (reuse mode A phrases verbatim)

| kind | colour | ko | en |
|---|---|---|---|
| go | `--ok` | `● 가능 · {run}일 연속` | `● GO · {run}-DAY WINDOW` |
| wait | `--wait` | `● 불가 → {n}일 후 가능` | `● NO-GO → AVAILABLE IN {n} DAYS` (`DAY` if 1) |
| move | `--move` | `● 불가 → {dir} {km} km 이동 시 가능` | `● NO-GO → AVAILABLE {km} KM {DIR}` |
| mast | `--mast` | `● 불가 → 20 m 마스트로 가능` | `● NO-GO → AVAILABLE WITH 20 M MAST` |
| none | `--block` | `● 불가 → 10 km / 20 m / {365−d}일 안에 해법 없음` | `● NO-GO → no fix within 10 km / 20 m / {365−d} d` |

The dot is `--ok` for go and `--block` otherwise; `불가 / NO-GO` in `--ink`; the part after `→` in
the kind's colour. If `steep`, append to the headline's first part: `불가 · 경사 {v}°` / `NO-GO · SLOPE {v}°`.
`{dir}` = `sectorOf(dx,dy)` from `orient.js` (upper-cased in en); km one decimal below 10.

Fix rows (fixed order, label colours `--move`, `--mast`, `--wait`; unavailable → `—` at .45):

| row | ko | en |
|---|---|---|
| 이동 / MOVE | `{dir} {km} km` · go now: `여기` | `{km} km {dir}` · `here` |
| 마스트 / MAST | `20 m · +{gain}일` (title: `6일 임무 {from} → {to}일`) | `20 m · +{gain} d` (title: `6-d mission {from} → {to} d`) |
| 대기 / WAIT | `{n}일` · go now: `0일` | `{n} d` · `0 d` |

The row that the headline chose is 600 weight with a 3 px left bar in its colour.

## 8. State, hash, flow

Add to `state`: `adv:false, autoPin:true, focusCrit:null`; change `tDay:45`. `what` gains nothing new.
- Auto-pin: in the `scheduleZones` callback (main.js), `if (state.autoPin && zones[0] && mode==='mask')
  setState({pin:{col:z.best.col,row:z.best.row}},'panel')`. It follows zone 1 while thresholds are
  dragged. A hash `pin=` sets `autoPin=false`.
- Hash writes: `m` only if adv; `a=1` if adv; `pin` only if `!autoPin`; `d`,`h` if touched; `sh`;
  `mon` only if adv; `lang`. `s` (site) kept for incoming links.
- `'time'` flush must also re-render the pin card (verdict depends on the day).

## 9. Delete (from the default view)

`MAP` title · right-top km² badge · `LAYERS` panel with seg, grips, histograms, ramps, min/max
labels, 7 non-criterion rows · near-miss speckle and the dark multi-fail veil · white outlines and
small numbers of 20 zones · Artemis boxes and site circles · zone and pin value chips · min-area
slider, month strip, `≥N d` slider, ✎ brush · always-on time bar · pin card `×`, lat/lon line,
`가까운 가능 지점` and `20 m →` rows · `3/4` in the tooltip. All but the chips, the `×` and the two
pin rows survive in Advanced.

## 10. File-by-file changes (`navigator/layers/`)

| File | Change |
|---|---|
| `js/config.js` | `ZONE = {…, top:20, simpleTop:5, merge:1, fitMaxK:4}`; `SIMPLE = { pass:'#46e58c', passA:.95, dim:.72, focusA:.55, haloA:.9 }`; `BUDGET = { move:3, wait:60, moveCells:20, mast:20, mastMinGain:10 }`; `DEFAULT_DAY = 45`. |
| `js/state.js` | add `adv, autoPin, focusCrit`; `tDay: 45`. |
| `js/strings.js` | `t(key, ...args)` calls function values (copy mode A's `t`). Add en/ko: `suitable`, `criteria`, `adv`, `c_sun(p)`, `c_earth(p)`, `c_dark(h)`, `c_slope`, `ge_d(v)`, `le_deg(v)`, `col_area`, `col_go`, `nogo`, `go_run(n)`, `avail_wait(n)`, `avail_move_dir(km,dir)`, `avail_mast(m)`, `noFix(km,m,d)`, `slope_fail(v)`, `move`, `mast`, `wait`, `mast_gain(n)`, `mast_title(a,b)`, `days(n)`, `here`. Remove `nearest`, `beyond`, `m20`, `next`. |
| `js/criteria.js` (new, ≤ 90 lines) | `initCriteria(el, data)`, `renderCriteria(st)`, `renderCritTick(sample)`: §5 rows, threshold drag, toggle, `focusCrit`. |
| `js/pincard.js` (new, ≤ 130 lines) | `initPinCard(el, data)`, `renderPinCard(st)`, `renderPinSky(st)`: §7. Move `renderPinCard`, the calendar canvas and `renderPinSky` out of `zones.js`; add date stepper, verdict, fix rows, check rows, calendar cursor + click-to-set-day, advanced value table. Cache key includes `tDay`, `adv`, thresholds. |
| `js/pin.js` | factor `goBit(i,d)`; replace `nearest()` with the day-and-slope-aware `move` search; add `verdict()` (§7.1); `pinInfo` key adds `tDay`, `threshold.slope`; link uses `st.tDay`; return `siteId` of the containing box. |
| `js/compose.js` | mask branch: `simple = !st.adv`; `ov = st.adv ? st.ov : null`; simple colours per §4.1 with `focusCrit` (index of the hovered id in `ids`); fill the `mask` Uint32 buffer; export `buildHalo()`/`haloCanvas()`; `sample()` additionally returns `failIds` (ids failing at the pixel) for the tooltip. Advanced path unchanged. |
| `js/zones.js` | `compute`: dilate `pass` into `grow` by `ZONE.merge`, label on `grow`, per-component counts/centroid over pass px only, `c.pix` = all labelled px (edges, bbox), `top = adv ? ZONE.top : ZONE.simpleTop`, `minArea = adv ? st.minArea : 1`, add `best:{col,row}` and `go` (median `days14` days) to each zone; ignore `ov` unless adv. `initZones`/`rebuild`: new head + row markup (§6), old controls wrapped in `.lyr-zadv` (shown by CSS in adv); row click → `handlers.pick(z)`. Remove the pin card code and `.lyr-pc`. |
| `js/mapview.js` | remove `<h2>`; add legend element (updated in `renderBadge`; old badge only in adv); `blit()` draws the halo (§4.1); `drawOverlay`: graticule opacity, boxes/site circles only in adv (plus the pin's box), outlines only for the hot zone in default, badges for zones 1–5 with flip rule, small numbers for 6–20 in adv, MOVE line from `verdict.move`; add `hitBadge` before `hitSite` in pointer handling (`hitSite` only in adv); click sets `autoPin:false`; tooltip per §4.3; `flyToCells` takes `maxK`. |
| `js/time.js` | bar gets class `open` when `state.shadow`; `☀` always visible. No logic change. |
| `js/main.js` | new skeleton: left `section.panel.lyr-left` = head (`h2` + adv button) + `.lyr-crit` + `.lyr-advwrap` (root for `initPanel`) + `.lyr-zones` (root for `initZones`, no longer a panel); right `section.panel.lyr-pinp` (root for `initPinCard`). Parse/write `a`; auto-pin in the zones callback; `Esc` → `autoPin:true`; ←/→ change `tDay`; `1/2/3` only in adv; adv toggle applies the resets of §3; flush: `'time'` and `'panel'` call `renderPinCard`; `'pixels'` calls `renderCriteria` + `buildHalo`. |
| `layers.css` | grid columns (§2); `.lyr-left{display:flex;flex-direction:column;gap:10px;overflow:hidden}`; `[data-adv]` switches (`.lyr-crit` ⇄ `.lyr-advwrap`, `.lyr-zadv`); criteria rows; zone head/rows/badge; `.lyr-vec .zb` (badge circle), `.zbt` (number), `.zbs` (stem); legend; pin card blocks (`.lyr-vd`, `.lyr-fx`, `.lyr-ck`, date stepper); `.lyr-time:not(.open)` shows only the button, no background/border; delete `.lyr-chip`, `.lyr-pc`, `.lyr-px`, `.lyr-pll`. |
| `index.html` | none. |

Build order (cut from the bottom if short): 1 skeleton + grid + state/hash · 2 simple raster + halo +
legend · 3 zone merge, `best`, badges, new list · 4 `pin.js` verdict + pin card · 5 criteria rows +
`focusCrit` · 6 auto-pin, calendar click, tooltip · 7 advanced toggle wiring · 8 time bar collapse.

## 11. Acceptance

- 1440×900, ko and en: no page scroll; on load, with no interaction, the screen shows green glow on
  Mons Mouton / Cabeus / Nobile / Amundsen, five badges, five list rows, and a filled pin card
  with a coloured verdict line.
- Every number on screen sits under a column head or beside a word label; none is identified by colour alone.
- Hovering `경사` paints lime where slope alone blocks; leaving restores the single-colour map.
- Dragging a threshold moves the green, the legend km², the badges, the list and (while auto) the pin.
- Stepping the date changes the verdict between GO / wait / move without touching the map colours.
- Clicking a list row, a badge or bare ground moves the pin; `Esc` returns it to zone 1.
- `고급` restores the full v1 tool; turning it off returns exactly the default picture.
- Tier-1 names, landers and the Earth compass are visible in both states; up = Earth.
