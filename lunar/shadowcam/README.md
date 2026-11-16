# Water-ice grade and ShadowCam overlays (11-16)

## Ice grade: `navigator/layers/data/ice_grade.wasm` (script: `lunar/layers/ice_grade.py`)
- Grid: 800 × 800 bytes, 500 m, ±200 km, row 0 = Earth side (same as every Find a site layer).
- Values: 3 = surface (ice stable at the surface), 2 = shallow (stable within 0.5 m), 1 = deep (0.5–1 m), 0 = dry (no ice stable within 1 m), 255 = no data.
- Method: LRO Diviner Polar Resource Product `ice_depth`, which is the depth where water ice would lose less than 1 kg m⁻² per billion years. A 500 m cell takes a class when at least 50 % of its Diviner facets reach that class. The classes follow the Ice Stability Regions that VIPER used for site planning.
- `ice_depth = -1` is not described in the label. Those facets all have a maximum temperature of 101 K or less, which is colder than the facets marked 0 (surface-stable, 101–130 K). We therefore treat −1 as surface-stable.
- Areas inside ±200 km: surface 12,273 km², shallow 72,115 km², deep 6,483 km², dry 69,080 km². 84 % of surface-class cells are inside permanent shadow (PGDA AVGVISIB = 0).
- This shows where ice **can survive**. It does not show where ice has been detected.
- Sources:
  - Paige et al. 2010, Science 330:479. Diviner PRP: https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/
  - Mazarico et al. 2011, Icarus 211:1066. PGDA: https://pgda.gsfc.nasa.gov/products/69

## ShadowCam overlays: `navigator/layers/data/shadowcam/` (script: `shadowcam_overlays.py`)
- Real images of the inside of permanently shadowed craters, from KPLO ShadowCam controlled mosaics (20 m Cloud Optimized GeoTIFF). Archive: https://pds.shadowcam.im-ldi.com/derived/
- The mosaics are already in our polar stereographic projection (R = 1737.4 km), so `bounds_m` in `shadowcam.json` places each WebP directly on the map. In `bounds_m`, +y is the Earth side.
- ShadowCam-only mosaics are cut to permanent shadow (PGDA 60 m, soft edge), because ShadowCam saturates on sunlit ground. Mosaics that combine ShadowCam with LRO NAC (`*_nac`) are kept whole.
- Included inside ±200 km: Shackleton (×2, summer and fall), Faustini, Shoemaker, Amundsen, Idel'son L, Kocher, Kuhn and Wiechert J. ShadowCam + NAC mosaics: Haworth, Malapert, Nobile, Amundsen rim. Cabeus B (82° S) lies outside the map.
- Credit: KPLO ShadowCam, a NASA instrument on KARI's Korea Pathfinder Lunar Orbiter, built by Malin Space Science Systems and operated by Arizona State University. LRO LROC NAC: NASA/GSFC/ASU.
- License: NASA-funded PDS data with no U.S. copyright restriction. Credit as above.
- ShadowCam images show the terrain inside the shadow. They are not an ice detector, so they do not change the grade.
