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
- Everything else (site selection, illumination and Earth-visibility data, mast study): see `../lunar/README.md`.
