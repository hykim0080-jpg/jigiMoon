# Lunar Landing Site Navigator

Static prototype (plain HTML/CSS/ES modules). Serve the folder with any static server, for example
`python3 -m http.server`, and open `index.html`. Design spec: `DESIGN.md`.

## Sources and credits

- Moon globe texture (`data/moon.jpg`): NASA SVS CGI Moon Kit, https://svs.gsfc.nasa.gov/4720.
  Credit: NASA's Scientific Visualization Studio, using LRO LROC/LOLA data.
- Pole map hillshade (`data/hillshade.jpg`): LOLA hillshade from the Planetary Geodesy Data Archive (PGDA).
- Site close-up hillshades (`data/spot/*.jpg`, Spot zoom): made by `build_spot.py` from PGDA LOLA LDEM_80S_20MPP_ADJ (20 m/px), https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/.
- Site close-ups at 5 m (`data/spot5/*.jpg`, 8 of 12 sites): `build_spot5.py` from PGDA LOLA 5 m/px site DEM tiles, https://pgda.gsfc.nasa.gov/products/78 (shown with 2x vertical exaggeration).
- Sharper pole map for Site zoom and Find a site (`data/hillshade_4000.jpg`, 100 m/px): `build_hillshade_4000.py` from PGDA LOLA LDEM_80S_40MPP_ADJ, https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/.
- Ice layer in Find a site (`layers/data/ice_tmax.wasm`, 800×800 bytes = annual maximum surface temperature in K, 255 = no data): LRO Diviner South Polar Resource Product `DLRE_PRP_SOUTH.TAB` (PDS LRO-L-DLRE-5-PRP-V2.0, Paige et al. 2010, Science 330:479), https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/ — facet centres (tri_clon, tri_clat) projected to our polar stereographic 500 m grid and temp_max averaged per cell (gaps filled from neighbours). Shown bright where ≤ 110 K (surface ice stable), brighter when colder.
- Contour line map (`data/linemap_4000.webp`, 100 m/px, default base map in Find a site, option in Compare): `lunar/linemap/build_linemap.py` (LOLA LDEM_80S_80MPP_ADJ contours, PGDA AVGVISIB_75S_120M_201608 shadowed outlines), converted for the web by `build_linemap_web.js`.
- Zoom-anywhere terrain tiles (`data/t40`, `data/t20`; 250 px JPG tiles at 40 m and 20 m/px over ±200 km): `build_tiles.py` from PGDA LOLA LDEM_80S_40MPP_ADJ and LDEM_80S_20MPP_ADJ, https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/.
- Everything else (site selection, illumination and Earth-visibility data, mast study): see `../lunar/README.md`.

## 3D view (Compare map, 2D/3D toggle)
- `map3d/`: copy of `lunar/map3d` (imports point at `./vendor/` so no importmap is needed; adds `focus(x_m, y_m, halfKm)`). Loaded only when 3D is first switched on.
- `data/3d/frames_jan/` … `frames_may/` (January to May 2027), `data/3d/frames/` (June 2027), `frames_jul/` … `frames_nov/` (July to November 2027) and `data/3d/frames_dec/` (December 2027): sunlit / Earth-visible frames every 4 h on a 500 m grid, from `lunar/` (LOLA LDEM_80S_80MPP_ADJ + LDEM_60S_240MPP_ADJ, NASA GSFC PGDA; Sun/Earth from JPL DE421).
- Three.js r187 + OrbitControls, https://threejs.org, MIT (`map3d/vendor/LICENSE`).
