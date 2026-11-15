# Thin-line south pole map (`linemap/`)

A line-only base map with the same frame as `navigator/data/hillshade_4000.jpg`, so it overlays 1:1.
- Projection: polar stereographic, `+proj=stere +lat_0=-90 +lon_0=0 +R=1737400`.
- Extent: x, y in ±200 km.
- Size: 4000 px at 100 m/px.
- Orientation: row 0 is y = +200 km, so lon 0° (the Earth direction) is up.
- Pixel position: px = (x_km + 200) × 10, py = (200 − y_km) × 10.

| File | Contents |
|---|---|
| `linemap_4000_white.png` | 4000 px, white background |
| `linemap_4000_transparent.png` | 4000 px, transparent background, for laying over the hillshade or colour layers |
| `linemap.svg` | Same lines as vectors, viewBox 0–4000. Groups: `minor`, `major`, `psr`, `labels` |
| `linemap_preview_1200.png` | 1200 px preview |
| `build_linemap.py` | Build script |

What the lines are:
- **Thin contours** every 250 m. Heights are relative to the 1737.4 km sphere.
- **Thicker contours** every 1 km.
- Contour heights come from LOLA LDEM_80S_80MPP_ADJ, average-resampled to 100 m and smoothed with σ = 180 m.
- **Dashed outlines** mark permanently shadowed regions: places that are sunlit 0 % of the time in the PGDA 18.6-year mean illumination map AVGVISIB_75S_120M_201608. Only patches of 2 km² or more are kept.
- **Labels** name eight landmarks: Shackleton, Haworth, Mons Malapert, Nobile, de Gerlache, Mons Mouton, Amundsen and Cabeus. Positions come from `orientation/landmarks.json`, which uses the USGS Gazetteer.

Sources:
- PGDA LOLA DEM, Barker et al. (2021), https://pgda.gsfc.nasa.gov/products/90 (LDEM_80S_80MPP_ADJ.TIF).
- PGDA Lunar Polar Illumination, Mazarico et al. (2011), https://pgda.gsfc.nasa.gov/products/69 (AVGVISIB_75S_120M_201608.TIF).
- USGS Gazetteer of Planetary Nomenclature, https://planetarynames.wr.usgs.gov.
- NASA data are public domain. The font is Inter, under the SIL Open Font License.
