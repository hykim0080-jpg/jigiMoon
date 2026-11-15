# Lunar Landing Site Navigator — Design Spec (2D prototype)

Target: static site, plain HTML/CSS/vanilla JS, SVG + one canvas, no build step, GitHub Pages.
Reference frame: 1440×900, no page scroll at that size.

---

## 1. Decision: one page, two views

One page. A single selection `(site, landing date, mission length, mast height)` drives every panel.
No tabs for the six requested screens: five of them are visible at once in **Focus**; the sixth
(side-by-side) is a **Compare** view that swaps only the middle band. Header and calendar never change.

Why: the story is cause → effect → fix. Slip the date in the calendar, see the sky change, see the
prescription change. Tabs would hide the effect from the cause.

Text budget: panel titles are one word (`SKY`, `MAP`, `MOVE`, `MAST`, `WAIT`). No subtitles, no helper
text, no legend boxes. Colour meaning is learned from the three fix cards (which are labelled) and
reused everywhere else.

---

## 2. Wireframe — Focus view (1440×900)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ LUNAR LANDING SITE NAVIGATOR   Malapert Massif ▾   ◀ 2027-03-23 ▶ +9 d   [14 d|6 d]            │ 48
│                                               ● NO-GO  →  MOVE 0.75 km      [Focus|Compare]    │
├───────────────┬──────────────────────────────────────────────────┬───────────────────────────┤
│ MAP           │ SKY                         Sun sets 41 h  Earth sets 6 h │ MOVE                │
│               │                                                  │ 0.75 km   ┌──────────┐     │
│   ·  ·        │  +8°                          ◍ Earth loop       │ ▬▬▬░░░░░  │ 21×21    │     │
│  ·  ◎──ray    │       ☀ ─ ─ ─ ─ ☀━━━━━━━━━━━━━☀                  │           │ grid     │     │ 196
│   · + ·       │  0° ▁▂▃▅▇▆▃▂▁▁▂▃███▃▂▁▁▂▃▄▃▂▁▁▂▃▅▃▂▁   (red=block) │           └──────────┘     │
│  ·   ·        │  -2.5°                                           ├───────────────────────────┤
│   300×300     │   W        N        E        S        W          │ MAST                      │
│               │                                              330 │ 10 m      40 ─○            │
├───────────────┤──────────────────────────────────────────────────┤ ▬▬░░░░░░  20 ─●            │ 196
│ Sun    82% ▬▬▬▬▬|▬▬  │ ▶  sun  ▓▓▓▓▓▓░░▓▓▓▓▓▓▓▓▓▓▓░░░░░▓▓▓▓▓▓▓      │           10 ─●  5 ─○ 2 ─○ │
│ Earth  43% ▬▬▬▬|     │    earth▓▓▓░░░░░░░▓▓▓▓░░░░░░░░░▓▓▓▓░░░░      ├───────────────────────────┤
│ Dark   31 h ▬▬▬  |   │    d0 ──────────●────────────────── d14      │ WAIT                      │
│ No-comm 190 h ▬▬▬▬▬▬ │                                          90 │ 4 d       ▢▢▢▢■■■■▢▢■■■■■■ │ 196
│               │                                                  │ ▬░░░░░░░  (61 day cells)   │
├───────────────┴──────────────────────────────────────────────────┴───────────────────────────┤
│        J    F    M    A    M    J    J    A    S    O    N    D                          OK % │
│ Site A ▓▓▓▒▒░░░▓▓▓▓▒▒░░░░▓▓▓▓ … 365 columns … ▓▓▓▒▒░░                                   ▬▬ 46 │
│ Site B …                                    │ ← selected date line, 14 d bracket on sel. row  │ 216
│ … 12 rows                                                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

CSS grid for `<main>`:

```
grid-template-columns: 300px minmax(540px, 1fr) 400px;
grid-template-rows:    48px minmax(0, 1fr) 216px;
gap: 12px; padding: 12px;
```

Middle band at 1440×900 ≈ 600 px high. Left column: map 300 + metrics. Centre: dome ~470 + timeline 90.
Right: three cards of equal height (flex: 1 each). The right column has the same visual area as the
dome — the prescription is not a sidebar detail.

Laptop widths: `min-width: 1180px` on the grid; below that the right column wraps under the middle band
as three cards in a row and the page scrolls vertically. Below 820 px height the page scrolls; nothing
is scaled down.

---

## 3. State model

```js
state = {
  site: 'malapert',     // id
  day: 82,              // landing day of year, 0..364
  mission: 14,          // 14 | 6
  mast: 0,              // 0 | 2 | 5 | 10 | 20 | 40  (applied to verdict + calendar)
  hour: 0,              // scrubber, hours since landing, 0..mission*24
  baseline: 73,         // planned day; slip = day - baseline
  pinned: [],           // up to 2 extra site ids for Compare
  view: 'focus',        // 'focus' | 'compare'
  playing: false
}
```

`setState(patch)` merges, then calls every module's `render(state)`. No framework, no diffing; each
module redraws its own SVG/canvas. State is mirrored to the URL hash
(`#site=malapert&day=82&m=14&mast=0`) so a demo moment can be bookmarked for the video.

Derived, in `logic.js`:

- `status(site, day)` → `'ok' | 'move' | 'mast' | 'wait' | 'none'`
- `effectiveOk = ok || (state.mast > 0 && mast_ok[state.mast][day])`
- **Best fix** = the fix that uses the smallest fraction of its budget:
  `move_km / 3`, `mast_m / 40`, `wait_d / 60`. Budgets live in `config.js`
  (`BUDGET = { move: 3, mast: 40, wait: 60 }`) so the team can retune (e.g. mast 10 m) without touching
  logic. Ties: wait < move < mast. `null` = unavailable.

---

## 4. Visual system — reuse the team's published site-selection page

Source of truth: the `:root` token block in `/mnt/project-files/space-apps/web/template.html`
(read-only; copy the block into `style.css`, do not link to it). Same tokens, same fonts, same `.seg`
segmented control and `.chip` styles, same `[data-theme]` light/dark switch.

### Theme

The page chrome follows the template: **light by default**, dark via `data-theme="dark"` /
`prefers-color-scheme`. Two panels are **always dark viewports**, in both themes, by setting
`data-theme="dark"` on the panel element itself: **SKY** (black sky, grazing sun — needs luminance
contrast) and **MAP** (the hillshade is a dark image; the template already gives `#map` a `#222`
ground). Everything else (header, metrics, fix cards, calendar, compare gutters) uses the page theme.
For the demo video, record in light chrome — the two dark viewports then read as "windows onto the Moon".

### Colour tokens (verbatim from the template, plus three additions)

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#eef0f4` | `#0f131b` | page |
| `--surface` | `#ffffff` | `#181d28` | panel fill |
| `--ink` | `#151b2b` | `#e8eaf0` | values, site names, selection line/rings |
| `--muted` | `#5a6377` | `#98a1b4` | axis ticks, panel titles, neutral bars |
| `--line` | `#d3d7e0` | `#2b3242` | hairlines, empty bar tracks |
| `--sun` | `#b96f00` | `#f0a531` | sun track, sun bars |
| `--earth` | `#2459b8` | `#74a2f2` | Earth track, Earth bars |
| `--ok` | `#1f8a5b` | `#4cbf82` | OK cells, GO dot |
| `--move` | `#2459b8` | `#74a2f2` | everything about relocation |
| `--mast` | `#7446bd` | `#ab89ec` | everything about mast |
| `--wait` | `#d9a24a` | `#8d6a2c` | everything about waiting |
| `--none` | `#c3c8d2` | `#394052` | cells with no solution |
| `--box` | `#d4a017` | `#e8bd3a` | hover / keyboard-focus highlight (as in the template) |
| `--block` *(new)* | `#c8372d` | `#f0655a` | blocking ridge, failed criterion value, NO-GO dot |
| `--terrain` *(new)* | — | `#2b3242` | horizon silhouette fill (dark viewport only) |
| `--terrain-edge` *(new)* | — | `#5d6880` | horizon top edge |

Rules:
- `--move` and `--earth` are the same blue in the team palette, and `--wait` is close to `--sun`.
  Keep them unambiguous by **territory**, not by adding hues: body colours (`--sun`, `--earth`) appear
  only inside SKY, the timeline strips, and the Sun/Earth metric bars; fix colours appear only in the
  fix cards, the calendar, the map dots, and the header verdict. The two sets never share a panel.
- `--block` is the only new hue and appears only for "this is what fails".
- No gradients, no shadows, no glow except a 6 px blur on the sun disc.
- Never hard-code a hex in JS: read tokens with `getComputedStyle(el).getPropertyValue('--move')`
  (from the element being drawn into, so the dark viewports resolve dark values), and re-render on
  theme change. The calendar canvas needs this explicitly.

### Type

- Body/UI: `var(--f-body)` = `"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif`.
- All numbers: `var(--f-mono)` = `"IBM Plex Mono",ui-monospace,Menlo,monospace`, tabular-nums
  (the template's `.n` class). Same Google Fonts `<link>` as the template.
- Sizes: panel title 11 px / 600 / uppercase (Latin only) / letter-spacing 0.08em / muted.
  Body 13 px. Header verdict 18 px / 600. Fix value 40 px / 500 mono, unit 16 px muted.
  Axis ticks 10 px mono muted.
- Panels: `--surface` fill, 1 px `--line` border, 6 px radius, 12 px padding. The template's heavy
  2 px `--ink` rule is reused once: as the top border of the calendar band.

### Strings

Every user-visible string lives in `js/strings.js`:

```js
export const STRINGS = {
  en: { go: 'GO', nogo: 'NO-GO', move: 'MOVE', mast: 'MAST', wait: 'WAIT', sky: 'SKY', map: 'MAP',
        sunSetsIn: h => `Sun sets in ${h} h`, short: d => `${d}° short`, /* … */ },
  ko: { /* same keys */ }
};
export const t = (key, ...a) => { /* lang from ?lang= or state.lang, default 'en', fallback to en */ };
```

English is the default and the submission language; `?lang=ko` switches. Site names come from the data
(`name_en`, `name_ko` if present). No string literals in any other module — units (`km`, `m`, `d`,
`h`, `%`) included. Text is minimal by design, so the table is ~40 keys.

---

## 5. Components

### 5.1 Header (48 px)

Left to right: product name (13 px, 600, letter-spaced) · site `<select>` · date stepper
`◀ 2027-03-23 ▶` followed by slip `+9 d` (muted; hidden when 0) · segmented `14 d | 6 d` ·
flexible space · **verdict** · segmented `Focus | Compare`.

Verdict: 10 px dot + `GO` (dot `--ok`) or `NO-GO` (dot `--block`), then when NO-GO an arrow and the
best fix in its colour: `→ MOVE 0.75 km`. If a mast is applied and makes it OK: `GO · MAST 10 m` in
MAST colour. If nothing works: `NO-GO → no fix within 3 km / 40 m / 60 d` (the only long string in
the UI; it states the search limits, which is a validity point).

### 5.2 Calendar — the main selector (canvas, full width, 216 px)

- Rows: 12 sites, sorted by yearly OK days, best on top. Row height 14 px, 2 px gap.
- Columns: 365 landing days. Cell width = `(canvasWidth − 150 − 80) / 365` (≈ 3.3 px at 1440), no gap.
- Left gutter 150 px: site name, 12 px. Selected row: text `--ink` and 600 weight; others muted.
  Pinned rows carry a 4 px square in front of the name.
- Right gutter 80 px: a 44 px bar (OK days / 365, `--ok` on hairline track) and the number `46`.
  Column header `OK %` is the only header text.
- Top axis: month initials at month starts, 10 px muted, with 1 px hairline ticks through the rows.
- **Cell colour** = `status(site, day)` under the current mission length and mast:
  `ok → --ok`, `move → --move`, `mast → --mast`, `wait → --wait`, `none → --none`.
  All five at full opacity. Cells that are OK *only because of the applied mast* are drawn in `--ok`
  with a 3 px `--mast` cap along the top of the cell, so the gain is visible but the cell still reads GO.
- Selection: 1 px `--ink` vertical line across all rows at `state.day`; on the selected row a 2 px
  bracket spanning `day … day + mission` above the cells. Baseline: small muted ▼ on the axis.
- Hover: crosshair (1 px muted line) + tooltip, one line:
  `Malapert Massif · 23 Mar · Sun 82 % · Earth 43 % · Move 0.75 km`.
- Click: set `site` + `day`. Drag horizontally: scrub `day` live (this is the "slip" gesture).
  Double-click on the axis: set `baseline`. Click on the pin square / shift-click a row: toggle pin.
- Keyboard: ←/→ day ±1 (shift ±7), ↑/↓ site, space play/pause, `1`/`2` Focus/Compare.

Implementation: one `<canvas>` (devicePixelRatio-aware) for cells; an absolutely positioned
`<div>` overlay for the selection line, bracket, and tooltip so hover never repaints the canvas.

### 5.3 Map (SVG, 300×300)

- Projection: the polar stereographic x, y from the data, ±200 km across the panel, pole at centre,
  lon 0° (Earth direction) up — fixed by the hillshade.
- Background: the team's LOLA 80 m hillshade (700×700 JPEG, ±200 km, top = lon 0°), provided as
  base64 in `/mnt/project-files/space-apps/web/hillshade.b64`. Decode it once into
  `assets/hillshade.jpg` (copy; do not edit the source folder) and draw it as an SVG `<image>` filling
  the panel at 100 % opacity. Site position in panel pixels, for panel size S (300):
  `px = (x_km + 200) / 400 · S`, `py = (200 − y_km) / 400 · S` — identical to the template's mapping
  scaled from 700. Graticule over the image at 50 % opacity: hairline circles at 88° S and 85° S, a + at the pole,
  four spokes at 0/90/180/270° E. Tick text: `88°`, `85°` only.
- Small Earth glyph (6 px `--earth` circle) at the top-centre edge (lon 0°).
- Sites: circle r = 5, fill = status colour for `state.day` (same mapping as the calendar; `none` is a
  hollow circle), all with a 1.5 px `#fff` stroke so they separate from the hillshade. Selected: r = 7 plus a 1 px `--ink` ring at r = 11. Pinned:
  ring only.
- Labels: selected, pinned, and hovered sites only (12 px, offset 10 px, halo in panel colour).
- Hover: label + tooltip same line as the calendar. Click: select site. Shift-click: pin.
- "Why" ray: see 5.6.

### 5.4 Metrics (below the map, 4 rows × 40 px)

Bullet bars, one row each: name (muted, 70 px) · value (16 px, 600, 64 px, right-aligned) · bar.

| Row | Bar scale | Threshold tick | Bar colour |
|---|---|---|---|
| Sun | 0–100 % | at 70 | Sun |
| Earth | 0–100 % | at 50 | Earth |
| Dark | 0–100 h | at 50 | `--muted` |
| No-comm | 0–mission hours | none | muted |

Threshold = 1 px `--ink` tick, 4 px taller than the bar. A failing row turns its **value** red
(`--block`); the bar keeps its colour. No "pass/fail" words — the tick and the red number say it.
Values use the mast-applied numbers only if the data provides them; otherwise unmodified (mast affects
verdict and calendar only).

### 5.5 Sky (SVG) — unwrapped horizon, not a circular dome

A polar "dome" plot is unusable here: everything happens within ±8° of the horizon and would collapse
onto the rim. Use a 360° panorama with strong vertical exaggeration.

- x: azimuth, 360° across the panel width. The panorama is **centred on the site's mean Earth
  azimuth** (circular mean of Earth az over the year) so the Earth loop never splits at the edge.
  Ticks: `N E S W` at their positions, hairline ticks every 30°.
- y: elevation, linear, **−2.5° … +8°**. Hairline at 0° (slightly brighter than others), ticks at
  0, 2, 4, 6, 8 labelled `0°`, `4°`, `8°` only.
- Horizon: closed path from the 720 samples, fill `--terrain`, 1.5 px top stroke `--terrain-edge`, extends to
  the bottom of the panel.
- Sun track for the mission window (hourly points, `landing … landing + mission`): 2 px polyline.
  Segments where disc-visible fraction > 0: solid `--sun`. Fraction = 0: dashed, 40 % opacity, and
  drawn **over** the terrain so the hidden path stays readable. Small tick marks on the track every
  24 h with day numbers `0, 2, 4 …` (10 px muted).
- Earth track for the window: 2 px polyline `--earth`, same solid/dashed rule from the Earth-visible
  flag. It is a small loop; that is expected.
- Bodies at `state.hour`: Sun disc r = 8 px (≈ true vertical angular size at this scale), fill
  `--sun`; when partly hidden, clip the disc with the horizon path so the terrain visibly bites it.
  Earth disc r = 9 px, fill `--earth` (symbolic size — say so nowhere; it is a marker).
- Countdown readouts, top-right of the panel, 13 px, each prefixed by a coloured dot:
  `● Sun sets in 41 h` / `● Sun rises in 12 h`, `● Earth sets in 6 h` / `● Earth rises in 30 h`.
  Computed by scanning forward from `state.hour` in the hourly series (beyond the mission window if
  needed); `> 14 d` if no change is found inside the loaded range.
- Hover on the panorama: vertical guide + small readout `az 214° · horizon +1.9°`.

Mission timeline (90 px, below the panorama, same panel):

- x: hours since landing, 0 … mission×24. Day ticks `0 … 14`.
- Row 1 (12 px): sun — per-hour cells, `--sun` with opacity = disc-visible fraction.
- Row 2 (12 px): Earth — `--earth` where visible, empty elsewhere.
- Longest dark stretch: 1 px bracket under row 1 with `31 h`; red if > 50 h.
  Longest no-comm stretch: same under row 2.
- Scrubber: vertical 1 px line + 10 px handle; drag sets `state.hour`. ▶ button at the left plays
  `hour += 2` per frame-step (whole mission in ~6 s), looping.

### 5.6 "Why?" — shown in the sky itself, always on

No separate mode or button. The cause is drawn wherever a body is hidden.

Whole-window layer (always visible):
- For every azimuth sample where the sun track passes **below** the horizon during the window, fill
  the terrain between the track and the horizon top in `--block` at 55 % opacity. Same for the Earth
  track. The red patches are the blocking ridges; their width is how long, their height is how much.

At the scrubbed hour (when sun and/or Earth is hidden or clipped):
- The horizon top edge within ±3° azimuth of the body becomes a 3 px `--block` stroke.
- A 1 px red vertical dimension line from the body centre up to the horizon top, with a single label
  at the ridge: `az 214° · 0.8° short` (Sun) / `az 12° · 2.1° short` (Earth). "Short" = horizon
  elevation − body elevation.
- On the **map**: a 1 px red ray from the selected site along that azimuth, 60 km long, so the ridge
  can be found geographically. Bearing → map direction for south polar stereographic with
  `x = r·sin(lon), y = r·cos(lon)`: `north = (sin lon, cos lon)`, `east = (cos lon, −sin lon)`,
  `dir = cos(az)·north + sin(az)·east`; remember panel y is flipped (`py` decreases as y grows). **Coder: verify against the data's azimuth convention with one
  known case (the Earth ray should point roughly toward lon 0).**
- When both bodies are visible at that hour, none of the scrubbed-hour marks are drawn.

Clicking a red patch moves the scrubber to the first hour of that blockage.

### 5.7 Fix cards — MOVE / MAST / WAIT (three equal cards, fixed order)

Common card anatomy, identical x-positions in all three so they read as one table:

```
┌──────────────────────────────────────────────┐
│ MOVE                              ┌────────┐ │   title: 11 px, in the fix colour
│ 0.75 km                           │ visual │ │   value: 40 px + 16 px unit
│ ▬▬▬▬░░░░░░░░░░░░   (effort bar)   │168×168 │ │   bar: 180×6 px, same x and width in all cards
└──────────────────────────────────┴────────┴─┘
```

- **Effort bar** = fraction of budget used (`km/3`, `m/40`, `d/60`), fill in the fix colour on a
  hairline track. Because the three bars share x-origin and length, **the shortest bar is the best
  fix** — comparison by aligned length, no ranking text.
- **Best fix**: card gets a 1 px border and a 3 px left edge in its fix colour, value in `--ink`.
  The other two: hairline border, value in `--muted`. Nothing else changes; order never changes.
- Unavailable (`null`): value `—`, bar track drawn dashed, visual at 40 % opacity.
- Site already OK: values `0 km`, `0 m`, `0 d` in muted, no highlighted card; visuals still live.

Visuals:

**MOVE — relocation grid.** 21×21 cells, 8 px, ±3 km, north up consistent with the map.
- OK on `state.day` and landable → solid `--move`.
- OK but slope > 8° → `--move` 1 px outline only (visible but not usable).
- Not OK → `--none`.
- Centre (current site): 1 px `--ink` cross.
- Nearest OK + landable cell: 1.5 px `--ink` ring, and a 1 px line from the centre to it.
- Frame ticks: `3 km` at one edge only.
- Hover cell: `0.50 km E, 0.75 km S · slope 4.2°`. No click action (no dome data off-site).

**MAST — height ladder.** Vertical 1.5 px line with five rungs at 2, 5, 10, 20, 40 m on a square-root
scale; a 10 px lander block at the base. Rungs where `mast_ok[h][day]` is true: filled `--mast`
circle r = 5; false: hollow. Labels `2 5 10 20 40` beside rungs, 10 px. The lowest filled rung is
ringed in `--ink`.
- Click a rung: `state.mast = h` (click again to clear). The verdict, the map dots, and the whole
  calendar re-evaluate with that mast for **all** sites — the calendar visibly gains green cells capped in purple.
  The applied rung shows a 2 px ring; header shows `MAST 10 m`.

**WAIT — next 60 days.** 61 cells in a 16-column wrap (10 px cells, 1 px gap), day 0 first. Cell
colour: OK → `--wait`, not OK → `--none`. First OK cell ringed `--ink`. Week boundary: nothing.
- Hover: `+4 d · 27 Mar`. Click a cell: `state.day += n` (baseline stays, so slip grows) — the
  verdict turns GO, the dome redraws.

### 5.8 Compare view

Replaces the middle band only (map, sky, and fix cards are hidden; header and calendar stay).
Columns = selected site + pinned sites (2–3 columns). If nothing is pinned, auto-fill with the two
sites with the highest `both_pct` on `state.day`, so the view is never empty.

A small-multiples matrix: one row per attribute, one column per site, **every row shares one scale
across columns** so comparison is by position.

```
              Malapert Massif         Shackleton Rim          Connecting Ridge
              ● NO-GO → MOVE 0.75 km  ● GO                    ● NO-GO → WAIT 4 d
SKY           [panorama, 150 px high] [panorama]              [panorama]
              [sun/earth strips]      [strips]                [strips]
Sun           82 %  ▬▬▬▬▬▬|▬          91 % ▬▬▬▬▬▬|▬▬          64 % ▬▬▬▬▬ |
Earth         43 %  ▬▬▬▬|             58 % ▬▬▬▬|▬             51 % ▬▬▬▬|
Dark          31 h  ▬▬▬  |            12 h ▬   |              66 h ▬▬▬▬▬▬|▬
MOVE          0.75 km ▬▬▬░░░          0 km                    —
MAST          10 m   ▬▬░░░░           0 m                     20 m ▬▬▬▬░░
WAIT          4 d    ▬░░░░░           0 d                     4 d  ▬░░░░░
YEAR          [365-cell strip]  31 %  [strip]  46 %           [strip]  22 %
```

- Row labels in a 90 px left gutter, muted 11 px. Column header: site name 16 px + verdict line.
- Panoramas use the same component as Focus (same y-scale, red "why" patches on, scrubber shared).
  Each panorama cell is a dark viewport (`data-theme="dark"`), as in Focus.
- Compare is the one place body colours and fix colours share a panel. A 2 px `--ink` rule between
  the Dark row and the MOVE row separates the two groups (measurements above, fixes below).
- Fix rows use the same effort bars and colours; the best fix per site has its value in `--ink`,
  the others muted. Across a row, the shortest bar is the easiest site for that fix.
- YEAR strip = that site's calendar row, with the selected-date line.
- Click a column header → that site becomes the selected one. × on a pinned column unpins it.

---

## 6. Interaction flow for the 30 s demo

Pre-set by URL hash: a site and baseline date that is GO, 14 d.

| s | Action | What the viewer sees |
|---|---|---|
| 0–4 | Press space | Sun slides sideways along the horizon; Earth hangs in its loop. Header: `GO`. |
| 4–9 | Drag right on the calendar (+9 d) | `+9 d` appears; green cell → fix-coloured cell; red patches grow on the horizon; header flips to `NO-GO → MOVE 0.75 km`. |
| 9–14 | Drag the scrubber into the red patch | Earth disc sinks behind the ridge; red edge + `az 12° · 2.1° short`; red ray on the map points at the ridge. |
| 14–18 | Hover the MOVE grid | Three bars, the shortest card is outlined; ring on the nearest blue cell 0.75 km away. |
| 18–22 | Click MAST rung 10 m | Calendar gains purple-capped green cells across all 12 sites; header `GO · MAST 10 m`. Clear it. |
| 22–25 | Click the first amber WAIT cell | Date jumps +4 d, header `GO`. |
| 25–28 | Press `2` (Compare) | Three sites side by side, same date, bars aligned. |
| 28–30 | Toggle `6 d` | Calendar turns greener — shorter mission, more GO days. |

Each beat is also a slide screenshot: (1) full Focus view, (2) "why" close-up, (3) fix cards,
(4) calendar with mast applied, (5) Compare.

---

## 7. Files

```
index.html          static layout: header, the 3×3 grid, empty <svg>/<canvas> containers
style.css           the template's :root token block + 3 new tokens, grid, panels, type, .seg/.chip
js/strings.js       all user-visible text, en default + ko; t(key, …)
js/config.js        BUDGET, THRESHOLDS {sun:70, dark:50, earth:50}, MAST_HEIGHTS, DEFAULT state
js/data.js          the ONLY file that knows JSON field names: loadIndex(), loadSite(id, mission)
                    → normalised objects used everywhere else; caches per (site, mission)
js/state.js         state object, setState(patch), subscribe(fn), URL-hash read/write
js/logic.js         pure functions: status(), bestFix(), effectiveOk(), nextEvent(series, hour),
                    blockage(horizon, az, el), azToMapDir(lon, az)
js/svg.js           tiny helpers: el(tag, attrs), linear scale, clear(node), tooltip show/hide
js/header.js        site select, date stepper, toggles, verdict
js/calendar.js      canvas heatmap + overlay, hover/click/drag, keyboard
js/map.js           polar map, site dots, why-ray
js/metrics.js       four bullet bars
js/sky.js           panorama, tracks, bodies, why layer, countdowns; exports drawSky(svg, site, state, opts)
                    so compare.js reuses it at a smaller size
js/timeline.js      sun/Earth strips, longest-gap brackets, scrubber, play loop
js/fixes.js         three cards: effort bars, move grid, mast ladder, wait strip
js/compare.js       matrix view built from drawSky + the same bar helpers
js/main.js          boot: load index → load default site → subscribe all render functions
data/               index.json (12 sites + yearly summaries + per-day arrays for both mission lengths),
                    site_<id>.json (horizon, hourly sun/Earth, move grid) loaded on demand
assets/             hillshade.jpg (decoded from the team's hillshade.b64)
```

Conventions for editability: ES modules via `<script type="module">`, one render function per file,
no classes, no shared mutable globals except `state`. Every module follows

```js
export function init(root) { /* build static SVG once, attach listeners */ }
export function render(state, data) { /* update attributes only */ }
```

Data split rationale: the calendar needs all 12 sites × 365 days × 2 mission lengths up front (small:
status inputs only). Hourly series and the 441-point move grid are heavy and only needed for the
selected and pinned sites, so they load lazily per site.

---

## 8. Points the coder must confirm against the real data

1. Azimuth convention of `horizon` and of sun/Earth az (0° = north, clockwise assumed) and the
   stereographic axis orientation — needed for the map ray and the N/E/S/W ticks.
2. Move grid `ok_days per day`: assumed to be a per-landing-day OK flag for each of the 441 points.
   If it is a count instead, the MOVE grid falls back to the nominal-date flag and the card must use
   `nearest_move_km` for the value only.
3. Whether per-day metrics exist per mast height. Assumed not: mast changes verdict, map dots and
   calendar only; the four metric bars stay unmodified.
4. Whether the hourly series extends past 31 Dec 2027; if not, landings after ~17 Dec have a
   truncated window — grey out those calendar columns for 14 d rather than showing partial results.
5. Payload size of the hourly files; if a site file exceeds ~2 MB, quantise az/el to 0.01° integers.

---

## 9. Revision: map-centred layout

Request: make the map the centre of the page, and make it easy to see where the current location is
on the whole Moon. This section overrides the layout in §2, the sizes in §5.3–5.5, the card anatomy in
§5.7 and the Compare frame in §5.8. Tokens, state, logic, calendar, header and all interactions are
unchanged unless listed in 9.8.

### 9.1 Decision

Three columns, map in the middle at the full height of the band. The zoom chain reads left to right
**inside and out of the map**:

```
globe (inset in the map's empty corner)  →  pole map (centre, 588 px)  →  3 km grid (MOVE card)
        containment + outlined cap                              two connector lines
```

- **Globe → map is a nested inset, not a side panel.** All 12 sites lie in the Earth-facing upper
  part of the map or at the pole; the bottom-left corner (far side, x < −30 km, y < −30 km) holds no
  site. The globe goes there. A globe in the left column was rejected: its connector wedge to the
  map's corners would sweep across whatever sits under the globe, and it would cut SKY to half height.
- **Map → MOVE grid is a connected callout.** MOVE is the top card of the right column, so two thin
  lines run from the selected site straight into the grid.
- **SKY moves to the left column** (cause, left) and the fix cards stay right (fix, right); the map
  between them carries the why-ray from one to the other.

### 9.2 Wireframe — Focus (1440×900)

```
x: 12            414 426                              1014 1026            1428
   ┌──────────────────────────────────────────────────────────────────────────┐ y 12
   │ header (unchanged)                                                    48 │
   ├───────────────┬────────────────────────────────────┬─────────────────────┤ y 72
   │ SKY   ● Sun…  │ MAP              ● Earth            │ ┌──────┐ MOVE       │
   │      ● Earth… │            ·  85°                   │ │ grid │ 0.6 km     │ 188
   │               │      · Haworth   ◎ Nobile Rim 1 ════╪═│ 168  │ ▬▬░░░░     │
   │  panorama     │   ·         · 88°  ·           ════╪═└──────┘            │
   │  378×298      │              +                      ├─────────────────────┤ y 272
   │               │            ·   ·                    │ ┌──────┐ MAST       │
   │               │                                     │ │ladder│ 7 m        │ 188
   │ ▶ sun  ▓▓▓░▓▓ │ ┌─────────┐                         │ └──────┘ ▬▬▬░░░     │
   │   earth▓░░▓▓░ │ │ ● Earth │                         ├─────────────────────┤ y 472
   │   0 ───●── 14 │ │  globe  │       588 × 588         │ ┌──────┐ WAIT       │
   ├───────────────┤ │  ⌀200   │                         │ │ 61 d │ 16 d       │ 188
   │ Sun   88 % ▬▬ │ │   ▫◦    │                         │ └──────┘ ▬▬░░░░     │
   │ Earth 49 % ▬▬ │ └─────────┘ 232×232                 │                     │
   │ Dark  23 h ▬  │                                     │                     │
   │ No-comm 172 h │                                     │                     │
   ├───────────────┴────────────────────────────────────┴─────────────────────┤ y 672
   │ calendar 12 × 365 (unchanged)                                        216 │
   └──────────────────────────────────────────────────────────────────────────┘ y 888
        402                       588                          402
```

```
main:  grid-template-columns: minmax(320px,1fr) auto minmax(320px,1fr);
       grid-template-rows:    minmax(0,1fr) 136px 216px;      /* band = 588 at 900 high */
       grid-template-areas:   "sky map fixes" "metrics map fixes" "cal cal cal";
#map-panel: height 100%; aspect-ratio 1;                       /* side S = band height */
```

| Panel | Size at 1440×900 | Area |
|---|---|---|
| MAP | 588 × 588 | 346 k px² — largest, centre |
| SKY (panorama 378×298 + timeline 90) | 402 × 440 | 177 k |
| Fix cards ×3 | 402 × 188 each | 76 k each |
| Metrics (4 rows × 28) | 402 × 136 | 55 k |
| Calendar | 1416 × 216 | unchanged |

Every map measure below is given for S = 588 and scales with S/588, except text and stroke widths.
Below 1180 px wide the page scrolls and the side columns wrap under the map (SKY, then cards in a row).

### 9.3 Globe (new, `js/globe.js`, canvas + SVG overlay)

- Source `data/moon.jpg` (2048×1024 equirectangular; `u = (lon+180)/360`, `v = (90−lat)/180`).
- **Plate**: 232×232 square, 8 px in from the map's left and bottom edges (map px x 8…240,
  y 348…580), fill `#0f131b`, 1 px `#fff` 30 % border, radius 4. It is space; the hillshade must not
  show through.
- **Disc**: radius 100 px, centre at plate (116, 124). Orthographic, **view centre lat −55°, lon 0°,
  north up, fixed**. Result: south pole 57 px below the disc centre, near side fills the upper disc up
  to 35° N at the limb, sub-Earth point 82 px above centre.
- **Same orientation as the map.** Lon 0° runs up and 90° E points right in both. The map is this
  globe seen from straight under the pole; the globe is the map tipped 35° back toward Earth. Nothing
  rotates between the two, so no north arrow or caption is needed.
- Overlays (SVG on the canvas), all 1 px:
  - limb circle `#fff` 40 %; equator and the 0° meridian (pole → top limb) `#fff` 25 %. The meridian
    is the same line as the map's 0° spoke.
  - **Earth glyph**: `--earth` circle r 4, white 1 px stroke, at plate (116, 11), directly above the
    limb on the meridian. Identical glyph to the one at the map's top-centre edge.
  - **Cap outline**: the map's ±200 km square, projected (sample 8 points per edge, inverse
    stereographic as in `build_data.py`, then orthographic). ≈ 23 × 19 px. Stroke 1.5 px `#fff`,
    no fill. The map panel gets the matching frame: 1.5 px `#fff` inset border. Same stroke, same
    shape — that pairing is the whole scale statement.
  - Sites: all 12 as r 1 `#fff` 60 % dots. **Selected site**: r 2.5 dot in its status colour, white
    1 px stroke, plus a `#fff` ring r 6. Pinned: ring r 6 only. Hovering a site on the map or a row
    in the calendar moves a `--box` ring r 6 to it.
- **No rotation on site change.** The sites span 12° of the sphere; recentring would move the globe
  by a few pixels and break the shared orientation with the map. Only the marker moves.
- **One animation, once, on load**: view centre tips from (0°, 0°) — the familiar full-Moon face —
  to (−55°, 0°) over 1200 ms ease-out, overlays fading in over the last 300 ms. It shows that the
  top of the map is the side facing Earth. Skipped under `prefers-reduced-motion` and when the page
  opens with a `#` hash that includes `noanim`.
- Render the texture to an offscreen canvas at 200 × devicePixelRatio (per-pixel inverse
  orthographic, nearest sample) and cache it; re-render per frame only during the intro.
- No pointer interaction on the globe.

### 9.4 Map at 588 px (changes to §5.3)

- Scale 1.47 px/km. `px = (x_km+200)/400·S`, `py = (200−y_km)/400·S`. Hillshade as before.
- Graticule unchanged (88° circle r 89 px, 85° circle r 223 px, pole cross, four spokes).
- Site dots r 6; selected r 7 with `#fff` ring r 12; pinned ring r 12 dashed. Hit target r 12.
- **Site names move onto the map — all 12.** 11 px, `#fff` 85 %, 3 px black halo; selected and
  pinned 13 px / 600 / 100 %. Greedy placement in priority order selected → pinned → calendar rank:
  try E, W, NE, SE, NW, SW of the dot (12 px offset); reject a position that overlaps a placed
  label, any dot, or the globe plate; a label with no free position is hidden until hover. The
  calendar keeps its name gutter.
- Why-ray unchanged in meaning; 60 km is now 88 px.
- Z-order: hillshade, graticule, why-ray, dots, labels, globe plate, frame, `MAP` title.
- Click, shift-click, hover unchanged.

### 9.5 Connector: selected site → MOVE grid

One overlay `<svg id="chain">` covering the middle band, `pointer-events:none`, above all panels.

- Two straight 1 px lines, from the top and bottom of the selection ring to the top and bottom of
  the grid's 3 km disc:
  `(sx, sy − 12) → (gx, gy − 84)` and `(sx, sy + 12) → (gx, gy + 84)`,
  where `(sx, sy)` is the selected site in page px and `(gx, gy)` the grid centre (at 1440×900:
  `gx = 1122`, `gy = 166`; read both from `getBoundingClientRect`, never hard-code).
- Each line is drawn in two pieces, split at the map's right edge: `#fff` 70 % over the map,
  `--ink` 45 % across the gap and inside the card.
- Redrawn on site change and on resize; no animation. Hidden in Compare.
- The grid must be drawn in the **map frame** (grid +y = map up = toward lon 0°), so the callout is
  a true enlargement. Coder: check whether `dx_km, dy_km` are stereographic offsets (then nothing to
  do) or local east/north (then rotate each cell by the site's longitude before drawing). The hover
  readout keeps its E/N wording from the data either way.

### 9.6 Side columns (changes to §5.4, §5.5, §5.7)

- **SKY** 402×440, still a dark viewport. Inner 378×416: title + countdowns row 20, panorama
  378×298 (1.05 px per degree of azimuth), 8 gap, timeline 90. Countdowns stack on two lines at the
  top right if they do not fit on one. Sun disc r 6, Earth disc r 7. Everything else as §5.5–5.6.
- **Metrics** 402×136, under SKY: same four bullet rows, row height 28, columns 62 / 62 / 1fr.
- **Fix cards** 402×188, **mirrored**: visual (168×168) at the left edge, then title, value and
  effort bar (180 px) in a right block. Applies to all three cards so bars still share one x-origin
  and length. Reason: the MOVE grid must face the map with nothing between it and the connectors.
  Best-fix accent edge stays on the card's left.

### 9.7 Compare view (changes to §5.8)

The map stays; it moves to the left and the matrix takes the rest. Header and calendar unchanged.

```
x: 12            414 426                                                   1428
   ├───────────────┬─────────────────────────────────────────────────────────┤ y 72
   │ MAP 402×402   │        Site A            Site B            Site C       │
   │  (no inset)   │        ● verdict         ● verdict         ● verdict    │
   │               │ SKY    [296×150]         [296×150]         [296×150]    │
   │               │        [strips]          [strips]          [strips]     │
   ├ ─ ─ ─ ─ ─ ─ ─ ┤ Sun … Earth … Dark  (bars, shared scales)               │
   │   globe ⌀160  │ ═══════════════════════════════════════════════════     │
   │   402×186     │ MOVE … MAST … WAIT  (effort bars)                       │
   │               │ YEAR   [strip] 46 %      [strip] 45 %      [strip] 39 % │
   ├───────────────┴─────────────────────────────────────────────────────────┤ y 672
```

```
main[data-view="compare"]: grid-template-columns: 402px 1fr;
                           grid-template-areas: "map cmp" "map cmp" "cal cal";
```

- Left: one dark panel 402×588. Square map 402×402 at the top (same component, S = 402), and the
  globe below it in the remaining 402×186 strip: disc r 80, centred, same view and overlays, no
  plate (the panel is the black). The inset is not drawn on the map in this view.
- Map and globe mark every compared site: selected filled with ring, pinned ring; only compared
  sites are labelled here (13 px / 600). Clicking a dot selects, shift-click pins, as in Focus.
- Matrix: 1002 px wide — 88 px row-label gutter + 3 columns of 296, 12 px gaps. Rows, scales, rule
  between Dark and MOVE, and click behaviour as §5.8. Panoramas 296×150.
- No connectors and no MOVE grid in Compare.

### 9.8 What changes, file by file

| File | Change |
|---|---|
| `style.css` | new `main` grid (9.2, 9.7); map panel square from band height; card mirrored; metric row 28 px |
| `index.html` | add `#globe` (canvas + svg) inside the map panel, `#chain` svg over the band |
| `js/globe.js` *(new)* | texture render, overlays, intro tilt; `init(root)`, `render(state, data)` |
| `js/map.js` | S from the container instead of 300; all-site labels with placement; frame; plate slot; Compare variant |
| `js/fixes.js` | mirrored card; grid in map frame; expose grid centre for the chain |
| `js/main.js` | draw/refresh `#chain` after map and fixes render, and on resize |
| `js/sky.js`, `js/timeline.js`, `js/metrics.js` | read size from container; smaller discs |
| `js/compare.js` | 3 × 296 columns; leave the left 402 px to the map panel |
| `js/config.js` | `GLOBE = { lat: -55, lon: 0, r: 100, introMs: 1200 }` |

No new strings. Demo (§6): the load tilt occupies the first second of beat 1; beat 3's map ray is now
88 px long and next to the SKY panel; beat 4 gains the connector into the MOVE grid.

---

## 10. Revision: orientation — knowing where you are

Principle (approved): polar terrain looks the same everywhere, so every view must answer "which part
of the Moon is this?" at a glance, in words the user can repeat, and the same five place names must
come back often enough to be remembered. This section overrides §9.3 (globe behaviour), §9.4 (site
labels), §9.5 (grid radius) and the E/N wording in §5.7. Tokens, layout, calendar and state are
unchanged unless listed in 10.9. No new colours.

### 10.1 Decisions

| Question | Decision |
|---|---|
| Compass | **Earth is up, everywhere.** One glyph, the *Earth mark*, sits at the top-centre of every spatial view. No north arrow, no N/E/S/W anywhere in the default UI. |
| Direction words | Four words, relative to Earth-up: **toward Earth / left / right / away from Earth**. Not clock positions, not compass points. |
| Landmarks | Five tier-1 names always on the map; everything else appears only when zoomed or hovered. |
| Site labels | **Only the selected, pinned and hovered sites are named on the map.** The other nine are dots. This replaces "all 12 labelled" in §9.4 and removes the Nobile / Mons Mouton pile-up. |
| Zoom | **Yes, two fixed levels, no free pan**: Region (±200 km, home) and Site (±50 km, centred on the selected site). Free pan is rejected: it is the way people get lost. |
| Off-screen landmarks | Edge arrow + name + km on the Site-level map; ring ticks + two signpost rows on the MOVE card. |
| Location | One sentence, in the map title. Lat/lon only in hover tips. |
| Spacecraft | White diamonds and crosses, never status-coloured. Inside ±200 km on the map, the rest on the globe only. |

Why words and not clock positions: near the pole "north" is every direction, and a clock needs a
second convention ("12 = Earth") on top of the first. The four words need only "Earth is up", they
translate directly (지구 쪽 / 왼쪽 / 오른쪽 / 지구 반대쪽), and they hold on the ground: the map is
seen from above the surface, so for a person standing at the site and facing Earth, map-left is
their left hand. The same four words therefore label the sky panorama.

Geometry behind it: at a site of longitude λ the map-up direction has local azimuth
`azE = (360 − λ) mod 360`, and Earth never moves more than ~8° from it. "Up" is parallel across the
whole ±200 km map, so the Earth mark is a fixed screen direction, not a point.

### 10.2 The Earth mark (one glyph, five places)

Glyph: `--earth` disc r 6, 1.5 px `#fff` stroke, with a `#fff` chevron (`^`, 8 wide × 4 high,
1.5 px stroke) 3 px beyond the disc on the outward side. It never rotates and is never interactive.

| View | Where | Extra |
|---|---|---|
| Map | top-centre, disc centre (S/2, 16), chevron above | the word `EARTH` once, 10 px panel-title style, 6 px right of the disc. The 0° spoke from the pole to the top edge is recoloured `--earth` 60 %, 1 px: the **Earth line**. Replaces the r 4 dot. |
| MOVE grid | top-centre of the card SVG at (88, 7), r 4 variant | no word |
| Sky panorama | on the azimuth axis at `x = X(azE)`, r 4 variant, in place of the old axis letters | see 10.6 |
| Globe | at the sub-Earth point (lat 0, lon 0), end of the Earth line | see 10.7 |
| Compare map | as Map, r 5, no word | |

Rule for the coder: the Earth mark marks the direction "up = Earth"; the moving `--earth` disc in the
sky is the real Earth. They are different sizes (r 4 on the axis vs r 7 in the sky) and never share a row.

### 10.3 Landmarks

**Tier 1 — recommended final five** (confirm against `landmarks.json` `tier`): **Shackleton** (the
pole), **de Gerlache** (left of the pole), **Malapert Massif** (straight toward Earth), **Mons
Mouton** (toward Earth, right), **Cabeus** (toward Earth, left). They form a fan opening toward
Earth with Shackleton at the hinge; every one of the 12 sites is within 95 km of one of them.
Tier 2: Haworth, Nobile, Shoemaker, Faustini, Slater, Sverdrup, Amundsen and whatever else the data
carries. Expected Region-level positions at S = 588 (1.47 px/km): Shackleton (306, 303),
de Gerlache (228, 291), Malapert Massif (303, 116), Mons Mouton (420, 88), Cabeus (154, 140).

Glyphs (all `#fff`, no fill, `pointer-events` on the label only):

- `crater`: rim circle of radius `diameter_km / 2`, 1 px, 35 % opacity, dash `2 3`. The ring is what
  makes a named crater findable in look-alike terrain.
- `massif`: open triangle, 8 px base, 7 px high, 1.5 px, 80 %, at the summit.
- `ridge`: 14 px line, 1.5 px, 80 %, along the ridge if the data gives an axis, else horizontal.

Label style — different from site names so "Haworth" the crater and "Haworth" the site never read
as the same thing:

| Class | Text | When shown |
|---|---|---|
| Tier-1 landmark | 11 px, 600, **uppercase, letter-spacing .08em**, `#fff` 90 %, 2.5 px black halo | always, every zoom, Focus and Compare (10 px in Compare) |
| Tier-2 landmark | 10 px, 400, uppercase, .08em, `#fff` 60 % | Site level only; or on hover of its ring; or when it is the selected site's anchor (10.5), then styled as tier 1 |
| Selected / pinned / hovered site | 13 px, 600, sentence case, `#fff` 100 % (unchanged) | always |
| Other sites | — | hover only (11 px) at Region level; at Site level shown 11 px if a free slot exists |
| Spacecraft | 10 px, 400, sentence case, `#fff` 70 % | hover only at Region level; at Site level if a free slot exists |

Placement and collision (one greedy pass, replaces the pass in `map.js`):

1. Obstacles placed first: every site dot (18 × 18), every spacecraft glyph (12 × 12), the globe
   plate, the Earth mark with its word (S/2 − 12 … S/2 + 56, 4 … 28), the map title box, edge arrows.
2. Priority: selected site → tier-1 landmarks → pinned sites → hovered item → tier-2 → spacecraft →
   other sites. A lower class never moves a higher one.
3. Candidates. Crater label: centred on the crater centre; then 14 px below centre; 14 px above;
   then outside the rim on the side away from Earth (below the ring), centred. Crater floors hold no
   sites (ours are on rims and ridges), so the first candidate normally wins. Massif / ridge label:
   E, W, N, S of the glyph at 10 px. Site label: the six candidates already in `map.js`.
4. A tier-1 label or a selected-site label that finds no free slot is drawn anyway at its first
   candidate (never hidden). Anything else without a slot is hidden until hover.
5. Text boxes use measured width (`getComputedTextLength`), not the `length × 0.56` estimate.

### 10.4 Map: two zoom levels, edge arrows, spacecraft

**Zoom.** New state `zoom: 1 | 4`.

- Region (×1): today's ±200 km view. Always the home view and the view on load.
- Site (×4): ±50 km, 5.88 px/km, centred on the selected site, centre clamped so the viewport stays
  inside ±200 km. Changing site at this level slides the view (300 ms ease-out; none under
  `prefers-reduced-motion`). Nothing rotates; Earth stays up.
- Control: a two-button `.seg` `Region | Site`, 8 px in from the map's top-right corner. Also
  double-click on the map, wheel up/down over the map (one notch = one level), key `Z`. `Esc` returns
  to Region.
- Imagery: `data/hillshade.jpg` is 700 px (571 m/px) and would be a blur at ×4. `build_data.py`
  writes `data/hillshade_2800.jpg` (143 m/px, same extent), loaded on first use of Site level and
  drawn over the 700 px image once decoded.
- Scale bar, bottom-right, 12 px in: 1 px `#fff` line with 4 px end ticks and a 10 px label —
  `50 km` (73.5 px) at Region, `10 km` (58.8 px) at Site. This is the only scale text on the map;
  the `85°` / `88°` graticule labels stay.
- At Site level the selection ring is drawn at **true 3 km radius** (17.6 px) instead of r 12, and
  the connector lines of §9.5 leave from its top and bottom. The ring is then literally the MOVE disc.
- Why-ray: 60 km at Region (88 px), capped to 30 km at Site (176 px).
- Globe plate stays at both levels.

**Edge arrows** (Site level; at Region level all tier-1 landmarks are on screen, so none appear).
For each tier-1 landmark whose centre is outside the viewport inset by 20 px:

- Anchor point: where the segment from the viewport centre to the landmark crosses the frame inset
  by 14 px. Where that crossing falls on the globe plate, use the plate's top or right edge + 14 px.
- Arrow: filled `#fff` 90 % isosceles triangle, 10 px long, 8 px base, tip pointing at the landmark,
  1 px black outline.
- Text: `SHACKLETON 144 km` — name in tier-1 style, number and unit 11 px mono 400. On the left /
  right edges the text sits inward of the arrow on the same baseline (anchor start / end); on the
  top / bottom edges it is centred under / over the arrow and clamped 6 px inside the frame.
- Distance is from the **selected site** to the landmark centre, whole km.
- Spacing: at least 18 px between two arrows on the same edge, the farther landmark gives way; keep
  44 px clear either side of the Earth mark.
- Not interactive. Only tier-1 landmarks get arrows — never sites, spacecraft or tier 2.

**Spacecraft and earlier sites** (`landers.json`). Glyphs are white with a 2.5 px black halo and
carry no status colour, so they cannot be mistaken for our circular, coloured site dots:

| `outcome` | Glyph (9 px box on the map, 7 px on the globe) |
|---|---|
| `landed` | filled diamond |
| `planned` | open diamond, 1.5 px |
| `impact`, `crash` | cross `×`, 1.5 px |

- Map shows those with `|x_m|, |y_m| ≤ 200 km` (expect LCROSS in Cabeus, the Chandrayaan-1 impact
  probe and Lunar Prospector near the pole, IM-2). All others (Chandrayaan-3, Luna-25, IM-1,
  Chang'e etc.) appear on the globe only.
- Hover tip, one line: `LCROSS · NASA · 2009 · impact`.
- A spacecraft within 8 px of one of our site dots (IM-2 Athena is both) is not drawn separately:
  the site dot gets the diamond as a badge at (+8, −8) and the site's tip gains the spacecraft line.
- Z-order (replaces §9.4): hillshade, graticule + Earth line, crater rings, why-ray, spacecraft,
  site dots, landmark glyphs, labels, edge arrows, globe plate, frame, title, Earth mark, zoom control.

### 10.5 Location as a sentence

Two functions in a new `js/orient.js`, both pure:

**Direction.** Bearing θ is measured clockwise from map-up (0° = toward Earth), in the map frame.
Eight 45° sectors centred on 0°, 45°, …:

| Sector | Position phrase (`… of X`) | Movement phrase |
|---|---|---|
| 0° | Earthward of | toward Earth |
| 45° | Earthward-right of | toward Earth and right |
| 90° | right of | right |
| 135° | beyond-right of | away from Earth and right |
| 180° | beyond | away from Earth |
| 225° | beyond-left of | away from Earth and left |
| 270° | left of | left |
| 315° | Earthward-left of | toward Earth and left |

"Beyond X" means farther from Earth than X. It is the only position word that drops "of".

**Position sentence** `where(site)`. Anchor A = the nearest tier-1 landmark by centre distance d;
but if the site is inside or on the rim of any crater (tier 1 or 2), that crater is the anchor, and
if it is tier 2 its label is promoted on the map while the site is selected. Bearing is from A to
the site. With R = `diameter_km / 2` and rim tolerance `tol = max(3 km, 0.15 R)`:

| Case | Sentence |
|---|---|
| crater, `|d − R| ≤ tol` | `on A's rim, <side> side` — side is one of the four plain words: Earthward, left, right, far |
| crater, `d < R − tol` | `inside A` |
| massif or ridge, `d ≤ 10 km` | `on A` |
| otherwise | `<d> km <position phrase> A` |

Distances: whole km from 10 km up, one decimal below. No lat/lon, no bearing in degrees.

**Prescription** `heading(dx, dy)` for the nearest GO cell: `<d> km <movement phrase>`, d to 0.1 km.
`dx, dy` must be in the map frame (§9.5 check still applies; if they are local east/north, rotate by
the site longitude first).

Examples (computed from the site file and catalogue coordinates; re-derive once `landmarks.json`
lands):

1. Nobile Rim 1 → `26 km beyond Mons Mouton`
2. Shackleton Rim → `on Shackleton's rim, left side`
3. de Gerlache Rim 2 → `on de Gerlache's rim, Earthward side`
4. Slater Plain → `73 km beyond-right of Shackleton`
5. Prescription, Nobile Rim 1 on 2027-02-15 (nearest GO cell dx −0.25, dy +0.5) →
   `Move 0.6 km toward Earth and left → available`

**Where the sentences render** — each once, nothing repeated:

| Place | Text | Style |
|---|---|---|
| Map title (top-left, replaces the bare `MAP`) | `MAP · 26 km beyond Mons Mouton` | `MAP` as now; sentence 13 px, 500, `#fff`, 2.5 px halo; max 280 px so it stops short of the Earth mark. The site name is not repeated — it is in the header and on the dot. |
| Header verdict | `NO-GO → AVAILABLE 0.6 KM TOWARD EARTH AND LEFT` | replaces `… 0.6 KM AWAY`; mast and wait verdicts unchanged |
| MOVE card | under `0.6 km`: `toward Earth and left` | 12 px `--muted`, one line, above the effort bar |
| Compare column header | the position sentence under each site name | 11 px `--muted`, one line, ellipsis |
| Hover: site dot (map, globe) | line 1 as today; line 2 `26 km beyond Mons Mouton · 85.30° S 37.1° E` | tip |
| Hover: MOVE cell | `0.5 km toward Earth, 0.25 km left · slope 6°` (the two axis components; replaces E/N) | tip |
| Hover: landmark | `Shackleton · crater 21 km · 89.67° S 129.8° E` | tip |

The calendar, metrics, MAST and WAIT cards get no location text.

### 10.6 Sky panorama

The panorama is already centred on the mean Earth azimuth, which is `azE` to within libration. So
the picture is "you are standing at the site, facing Earth", and its left and right are the map's.

- Axis letters `S W N E` are removed. In their place, on the same row: `away` at the left end,
  `left` at `azE − 90°`, the **Earth mark** (r 4) at `azE`, `right` at `azE + 90°`, `away` at the
  right end. 10 px tick style. Tick marks stay every 90° from `azE`.
- Centre the panorama on `azE` exactly (not the libration mean), so the mark is at mid-width for
  every site and the frame never shifts between sites.
- The blockage label drops the azimuth: `2.0° short`. Azimuth in degrees stays in the hover readout
  (`az 329° · horizon +1.2°`), like lat/lon.
- The why-ray on the map already points along this azimuth; with the panorama centred on Earth, a
  blockage right of centre in the sky is a ray leaning right on the map. No extra element needed.

### 10.7 Globe inset

Kept: drag to turn, two buttons. Changed so that it obeys the compass:

- **Earth line**: the 0° meridian from the south pole to the sub-Earth point, `--earth`, 1.5 px,
  always drawn (40 % opacity on the hidden side), ending in the Earth mark (r 4) at (0°, 0°). It is
  the same line as the map's Earth line; in any orientation the user can see which way Earth is.
- **Earth view** button: unchanged target. The pole is at the bottom, the Earth line runs up the
  disc: toward Earth = up.
- Second button becomes **Pole view**: view centre (−90°, 0°) instead of the selected site's own
  lat/lon. Today's target turns the globe by the site longitude and breaks "Earth is up"; all 12
  sites are within 6° of the pole, so nothing is lost. In this view the globe has exactly the map's
  orientation, the Earth mark sits at the top limb like the map's, the cap outline is a 22 px square
  at the centre, and everything down to ~60° S is visible around it — this is the view for the
  spacecraft. Coder: check that the projection at lat0 = −90 puts lon 0 up; if not, use −89.9.
  Strings: `viewSite` → `Pole view` / `극에서 본 모습`; the button icon becomes the cap square.
- After a free drag nothing snaps back; either button restores a compass view in 600 ms.
- Spacecraft: all entries of `landers.json`, 7 px glyphs; name on hover only (`Chandrayaan-3 · ISRO
  · 2023 · landed`); hit radius 8 px. Those inside the cap are drawn too, so the two views agree.
- Tier-1 landmarks are not drawn on the globe (they fall inside the 22 px cap).
- Site markers, cap outline and the frame pairing of §9.3 are unchanged.

### 10.8 MOVE card

- Grid disc radius 84 → **72 px** (`sc = 144 / (2r)`), centre unchanged at (88, 84). The freed 12 px
  ring carries the orientation marks. `gridCenter().r` and the chain end-points follow.
- Earth mark at the top (10.2).
- **Ring ticks**: for the two nearest tier-1 landmarks (the sentence anchor first), a filled
  `--ink` triangle, 6 px base × 6 px, centred on radius 78, pointing outward along the bearing from
  the site to the landmark. A tick within 12° of straight up moves to ±12° to clear the Earth mark.
- **Signpost rows** in the text block, below the effort bar, 16 px row height, at most two:
  `[arrow] Mons Mouton 26 km`. The arrow is a 10 px `--ink` arrow rotated to the same bearing as its
  ring tick; name 12 px `--ink`; distance 12 px mono `--muted`, right-aligned to the bar's end.
  These are the grid's edge arrows: the tick gives the direction at the edge, the row names it.
  Text is kept out of the ring: there is no room for a name between the disc and the card's left edge.
- Direction line under the value (10.5). Cell hover in the four words.
- When the card is `na`, ticks and rows stay (they are about place, not about the fix); only the
  direction line is blank.

### 10.9 What changes, file by file

| File | Change |
|---|---|
| `build_data.py` | write `data/hillshade_2800.jpg`; copy `lunar/orientation/landmarks.json` and `landers.json` to `data/orientation/` |
| `js/orient.js` *(new)* | load both files; `sector(θ)`, `where(site)`, `heading(dx,dy)`, `axisParts(dx,dy)`, `edgeAnchor(viewport, plate, point)`, `nearestLandmarks(site, n)`; no DOM |
| `js/data.js` | fetch the two orientation files with the index; panorama `center = (360 − lon) % 360` |
| `js/state.js` | `zoom: 1 \| 4` (hash key `z`); `Z`, `Esc` |
| `js/config.js` | `ZOOM = { site: 4, slideMs: 300 }`, `RIM_TOL = { km: 3, frac: 0.15 }`, `ON_MASSIF_KM = 10`, `GRID_R = 72` |
| `js/strings.js` | en + ko: `earthWord`, the 8 position and 8 movement phrases, `onRim`, `inside`, `on`, `side` words, `beyond`, `skyLeft/Right/Away`, `zoomRegion`, `zoomSite`, outcome words, `avail_move(v, dir)`, `cell(a, b, slope)`, `short(d)`; change `viewSite`; remove `east/west/north/south`, the `az` part of `ridge` |
| `js/map.js` | viewport transform for zoom + slide; hi-res image swap; Earth mark, word and Earth line; crater rings and landmark glyphs; spacecraft glyphs and site badge; new label pass (10.3); edge arrows; scale bar; title sentence; true 3 km ring at Site level; zoom control and wheel / double-click; `sitePos()` honours zoom |
| `js/globe.js` | Earth line and mark; Pole view target; spacecraft glyphs and tips |
| `js/fixes.js` | disc r 72; Earth mark; ring ticks; signpost rows; direction line; cell tip wording |
| `js/sky.js` | axis words and Earth mark; exact `azE` centring; shorter blockage label |
| `js/header.js` | move verdict with direction |
| `js/compare.js` | sentence under each column's site name; Compare map gets tier-1 labels, rings, spacecraft at 7 px, no zoom |
| `js/main.js` | redraw `#chain` on zoom change and during the slide |
| `style.css` | landmark / spacecraft / edge-arrow / signpost classes; zoom `.seg` on the map; map title sentence |
| `index.html` | `<span id="where">` in the map title; zoom control container |

Demo (§6): beat 1 opens on the Region map with five names and the Earth mark, voice-over can say the
title sentence verbatim; beat 4 reads the header prescription ("0.6 km toward Earth and left") and
the same direction is visible in the MOVE grid under its Earth mark.

Points to confirm against the data: the `tier` values and `diameter_km` of the five landmarks; that
`landmarks.json` `x_m, y_m` use the same stereographic frame as the sites; the MOVE `dx, dy` frame
(§9.5); and whether a 2800 px hillshade can be produced from the source DEM in `build_data.py`.
