# Space Agency Partner Data and Other References — Moon-jigi

Lunar Landing Site Navigator, NASA Space Apps Challenge 2026.
Every external dataset, image, library, font and publication used in the project, with its licence or terms of use.
Living list: last updated 2026-11-15 (KST morning). Items marked **[verify]** still need a final check before submission.

## 1. NASA data

| # | Item | Used for | Source | Licence / terms |
|---|---|---|---|---|
| D1 | LOLA 5 m/px south-pole landing-site DEMs and slope maps (tiles Site01, Site04, Site06, Site07, Site11, Site20v2, Site23, DM2, SL2, Haworth) | Local horizons, landing slope, 3 km relocation grid | NASA GSFC Planetary Geodesy Data Archive (PGDA), https://pgda.gsfc.nasa.gov/products/78 — Barker, M.K. et al. (2021), *Planet. Space Sci.* 203, 105119, doi:10.1016/j.pss.2020.105119 | U.S. Government work, public domain; citation requested |
| D2 | LOLA polar DEMs: 20, 40 and 80 m/px (80°S–90°S: `LDEM_80S_20MPP_ADJ`, `LDEM_80S_40MPP_ADJ`, `LDEM_80S_80MPP_ADJ`), 240 m/px (60°S–90°S, `LDEM_60S_240MPP_ADJ`), 20 m slope | Far-field horizons out to 150 km; hourly sun/Earth maps; hillshade backgrounds; site close-ups (20 m); zoom-anywhere terrain tiles and the 100 m/px map (40 m, 20 m) | NASA GSFC PGDA, https://pgda.gsfc.nasa.gov/products/90 (Barker et al.) | Public domain; citation requested |
| D3 | LOLA average illumination and Earth-visibility maps (`AVGVISIB_85S_060M_201608`, `AVGVISIB_75S_120M_201608`, Earth-visibility products) | Choosing representative points inside each region; validation of our model | NASA GSFC PGDA, https://pgda.gsfc.nasa.gov/products/69 — Mazarico, E. et al. (2011), *Icarus* 211, 1066–1081, doi:10.1016/j.icarus.2010.10.030 | Public domain; citation requested |
| D4 | Artemis III candidate landing regions map (9 regions, Oct 2024) | Region boxes (`region_boxes.json`), registered to D1 tiles | NASA, https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ — image credit NASA/GSFC/ASU/JSC/AGDT | NASA media usage guidelines (credit given; no NASA insignia reproduced) |
| D5 | IM-2 (Intuitive Machines Athena) target point, −84.78°, 29.13°E | One of the 12 sites | LROC, NASA/GSFC/Arizona State University, https://www.lroc.asu.edu/images/1401 | Credit NASA/GSFC/Arizona State University |
| D6 | JPL planetary ephemeris DE421 | Sun and Earth positions seen from the Moon | NASA JPL, Folkner, W.M. et al. (2008), IPN Progress Report 42-178; file shipped in the `skyfield-data` package | Public domain |
| D7 | CGI Moon Kit colour map (`navigator/data/moon.jpg`) | Globe inset in the web tool | NASA Scientific Visualization Studio, https://svs.gsfc.nasa.gov/4720 — credit NASA's Scientific Visualization Studio, using LRO LROC/LOLA data | Public domain, credit requested |
| D8 | Gazetteer of Planetary Nomenclature (crater, massif and ridge names and positions) | 27 landmarks on the maps and in the location sentences (`orientation/landmarks.json`) | IAU / USGS Astrogeology, https://planetarynames.wr.usgs.gov | Public domain |
| D9 | 11 lander, impact and planned sites: IM-1, IM-2, Chandrayaan-3 and Chandrayaan-2 Vikram, Luna-25, LCROSS Centaur and shepherding spacecraft, Chandrayaan-1 impact probe, Lunar Prospector, VIPER (planned), Chang'e-7 (planned); Artemis III candidate regions of 2022 and 2024 | Spacecraft markers and cards (`orientation/landers.json`; each entry carries its own `source` URL) | LROC images (NASA/GSFC/Arizona State University), https://lroc.im-ldi.com; NASA releases (IM-1 image, VIPER site, Artemis III regions 2022 and 2024); LCROSS impact sites: arXiv:1103.1687; Chandrayaan-1 probe: LPSC 2021 abstract (ADS 2021LPI....52.1013S); Chang'e-7: The Planetary Society; Lunar Prospector impact: NASA NSSDC lunar artifact table, https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html (positions checked in PR #11) | Credit given per entry |

## 2. Models, papers and mission references

| # | Item | Used for | Source |
|---|---|---|---|
| R1 | IAU WGCCRE 2009 lunar rotation model | Moon orientation (approximation of the LOLA ME frame) | Archinal, B.A. et al. (2011), *Celest. Mech. Dyn. Astr.* 109, 101–135, doi:10.1007/s10569-010-9320-4 |
| R2 | Artemis III site-selection description; ~6-day surface stay | Mission length (6 d option), context | George et al., LPSC 2026 abstract 1901, https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf |
| R3 | NASA BEACON executive summary (VSAT ≥10 m mast, ≥15 m demo boom) | Practical mast height limit (20 m) | https://ntrs.nasa.gov/api/citations/20240015887/downloads/BEACON%20Exec%20Summary.pdf |
| R4 | NASA Langley VSAT mechanisms abstract (16 m reference design) | Same | https://ntrs.nasa.gov/api/citations/20240004914/downloads/VSAT%20Mechanisms%20Abstract%2020240418.pdf |
| R5 | NASA GCD VSAT annual review 2023 (masts up to 20 m explored) | Same | https://ntrs.nasa.gov/api/citations/20230012849/downloads/GCD%20Annual%20Review%20VSAT%20September%202023%20Final.pdf |
| R6 | Honeybee Robotics LUNARSABER, proposed at over 100 m tall (DARPA LunA-10) | Concept mast limit (100 m) | Honeybee Robotics / Blue Origin release, https://www.blueorigin.com/news/honeybee-robotics-to-develop-lunarsaber-for-darpas-luna-10-program |
| R7 | Astrobotic VSAT-XL, about 34 m (112 ft) tall, 50 kW | Concept mast range | Astrobotic releases, https://www.astrobotic.com/astrobotic-developing-xl-solar-array-tech-for-lunar-power-infrastructure/ and https://www.astrobotic.com/astrobotic-awarded-lunar-power-study-with-vsat-xl/ |
| R8 | PGDA README / file headers (projection, pixel registration, height datum) | Data conventions | https://pgda.gsfc.nasa.gov/products/78 and /90 |

## 3. Software libraries

| # | Library | Used for | Licence |
|---|---|---|---|
| S1 | skyfield — https://rhodesmill.org/skyfield/ | Ephemeris computation | MIT |
| S2 | skyfield-data — https://github.com/brunobord/skyfield-data | Bundled DE421 file | MIT (data public domain) |
| S3 | NumPy — https://numpy.org | All numerical work | BSD-3-Clause |
| S4 | rasterio — https://rasterio.readthedocs.io (with GDAL — https://gdal.org) | Reading GeoTIFF DEMs, remote windowed reads | BSD-3-Clause (GDAL: MIT) |
| S5 | pyproj — https://pyproj4.github.io/pyproj | Checking our polar-stereographic transform (not used at runtime) | MIT |
| S6 | SciPy — https://scipy.org | Registering the NASA region map | BSD-3-Clause |
| S7 | Pillow — https://python-pillow.org | Reading/writing images (region map, frames) | MIT-CMU (HPND) |
| S8 | three.js r187 + OrbitControls — https://threejs.org (vendored in `lunar/map3d/vendor/`, licence file included) | 3D sunlight/Earth-visibility map | MIT |
| S9 | Python standard library (json, datetime, multiprocessing, …) | — | PSF License |

## 4. Fonts

| # | Font | Used in | Licence |
|---|---|---|---|
| F1 | IBM Plex Sans KR, IBM Plex Mono — loaded from Google Fonts | Web tool | SIL Open Font License 1.1 |

## 5. Images and media made by the team

| Item | How it was made |
|---|---|
| Pole-map hillshade (`navigator/data/hillshade.jpg`, `web/hillshade.b64`) | Computed by us from LOLA `LDEM_80S_80MPP_ADJ` (D2) |
| Hourly sun/Earth-visibility frames (`lunar/frames/`, `lunar/frames_dec/`, 2027-06 and 2027-12) | Computed by us from D2 + D6 + R1 |
| All charts, maps and UI in the web tool | Rendered by our code from our results |
| Team photo (`team-moon-photo-maximal.png`) | AI-generated/edited image — must carry a visible "AI-generated" watermark if used (see AI_USE.md) **[verify watermark]** |

## 6. Our own outputs (not external)

Site results (`lunar/out/`), mast study (`lunar/masts.json`), validation (`lunar/validation*.json`) and all code in `lunar/`, `navigator/`, `web/` were produced for this hackathon. Site points are chosen by our rule; they are not NASA-designated landing points.

## 7. Hosting and services

| Item | Used for | Terms |
|---|---|---|
| Cloudflare Pages — https://pages.cloudflare.com | Public site https://moonjigi.pages.dev, deployed from GitHub `main`; Pages Functions serve the verdict API (`/api/check`, `/api/sites`; added in PR #7) | Cloudflare terms of service |
| GitHub — https://github.com | Code repository and pull requests | GitHub terms of service |
| Google Fonts | Serving the IBM Plex fonts (F1) | SIL OFL 1.1 fonts; Google Fonts terms |

## Still to add before submission
- [ ] Any new source added by other work threads after this date (check `lunar/README.md`, `navigator/README.md`, `lunar/map3d/`)
- [ ] Any video/slide tools or music used in the demo (the 7-slide demo uses only our own screenshots)
- [ ] Final check of the [verify] item above (team photo watermark)
