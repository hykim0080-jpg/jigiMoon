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
| D10 | The Blue Marble: land surface, ocean colour and sea ice, 2048×1024 (`navigator/data/earth_bluemarble_1024.jpg`, resized to 1024×512) | The Earth globe in the 3D sky | NASA Visible Earth / NASA Goddard Space Flight Center (Reto Stöckli, Robert Simmon et al.), https://visibleearth.nasa.gov/images/57730 ; file taken from Wikimedia Commons copy https://commons.wikimedia.org/wiki/File:Land_ocean_ice_2048.jpg | Public domain (NASA), credit requested |
| D11 | SDO/HMI Quick-Look Continuum image, 2026-11-15 08:45 UTC (`navigator/data/sun_sdo_512.png`, disc cut out with a glow added; the timestamp text is outside the disc and removed) | The Sun in the 3D sky | NASA/SDO and the HMI science team, https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg | Public domain (NASA), credit "Courtesy of NASA/SDO and the HMI science team" |

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
| R9 | VIPER mission planning: 50 h minimum-power endurance, safe havens | Dark-spell criterion (≤ 50 h) | NASA, https://www.nasa.gov/wp-content/uploads/2022/05/overview_of_mission_planning_for_the_viper_rover.pdf ; https://ntrs.nasa.gov/api/citations/20230011558/downloads/VIPER%20Mission%20Overview%20Presentation-%20CATIE%20Expo.pdf |
| R10 | South-pole direct-to-Earth availability (~51 %) and best-site sunlight | Earth-in-view criterion (50 %), sunlight context | Bryant (2009), JPL IPN Progress Report 42-176C, https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.html |
| R11 | Best-site sunlight at 2 m and 10 m above ground | Sunlight criterion (70 %), mast context | Gläser et al. (2014), *Icarus* 243, 78–90 |
| R12 | Artemis III candidate regions, 2022 | Site context (earlier region set) | NASA, https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/ |
| R13 | CLPS missions last one lunar day (≤ 14 Earth days) | 14-day mission option | NASA, https://smd-cms.nasa.gov/wp-content/uploads/2023/11/techshow-jej.pdf |
| R14 | Blue Ghost Mission 1: 14 days of surface operations | 14-day mission option | Firefly Aerospace, https://fireflyspace.com/news/firefly-aerospace-successfully-completes-14-days-of-surface-operations-on-the-moon |
| R15 | IM-2 mission end (battery) one day after landing | Context: why sunlight and contact matter | SpacePolicyOnline, https://spacepolicyonline.com/news/im-2-mission-ends-one-day-after-lunar-landing/ |

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
| F1 | Inter (variable, Latin + Latin Extended), by The Inter Project Authors — woff2 files bundled in `navigator/fonts/` (from the @fontsource-variable/inter package), licence text in `navigator/fonts/Inter-OFL.txt`; Korean text uses the system font | Web tool | SIL Open Font License 1.1 |

## 5. Images and media made by the team

| Item | How it was made |
|---|---|
| Pole-map hillshade (`navigator/data/hillshade.jpg`, `web/hillshade.b64`) | Computed by us from LOLA `LDEM_80S_80MPP_ADJ` (D2) |
| 500 m elevation grid (`navigator/layers/data/elev500.png`, `lunar/layers/build_elev500.py`) | Computed by us: LOLA `LDEM_80S_40MPP_ADJ` (D2) averaged to 500 m; finds the ridge that hides the Sun or Earth from a clicked spot |
| Contour line map (`navigator/data/linemap_4000.webp`, `lunar/linemap/`) | Computed by us: 250 m / 1 km contours from LOLA `LDEM_80S_80MPP_ADJ` (D2), permanently shadowed outlines from PGDA `AVGVISIB_75S_120M_201608` (D3); see `lunar/linemap/README.md` |
| Hourly sun/Earth-visibility frames (`lunar/frames/`, `lunar/frames_dec/`, `lunar/frames_2027-MM/`; 2027-01 to 2027-06 and 2027-12) | Computed by us from D2 + D6 + R1 |
| Ice-likely shade distance (Find a site layer `ice`, Compare ❄ value; `navigator/layers/js/data.js` `iceDistance`, `navigator/js/ice.js`) | Computed by us in the browser: distance to the nearest 500 m cell that is never sunlit at any 2-hour step of 2027 in our own illumination run (the `psr` layer, from LOLA D2 and DE421 D6). A permanent shadow may hold water ice; it is not proven. Used as a preference only |
| All charts, maps and UI in the web tool | Rendered by our code from our results |
| Team photo (`team-moon-photo-maximal.png`) | AI-generated/edited image — must carry a visible "AI-generated" watermark if used (see AI_USE.md) **[verify watermark]** |

## 6. Our own outputs (not external)

Site results (`lunar/out/`), mast study (`lunar/masts.json`), validation (`lunar/validation*.json`) and all code in `lunar/`, `navigator/`, `web/` were produced for this hackathon. Site points are chosen by our rule; they are not NASA-designated landing points.

## 7. Hosting and services

| Item | Used for | Terms |
|---|---|---|
| Cloudflare Pages — https://pages.cloudflare.com | Public site https://moonjigi.pages.dev, deployed from GitHub `main`; Pages Functions serve the verdict API (`/api/check`, `/api/sites`; added in PR #7) | Cloudflare terms of service |
| GitHub — https://github.com | Code repository and pull requests | GitHub terms of service |

## Still to add before submission
- [ ] Any new source added by other work threads after this date (check `lunar/README.md`, `navigator/README.md`, `lunar/map3d/`)
- [ ] Any video/slide tools or music used in the demo (the 7-slide demo uses only our own screenshots)
- [ ] Final check of the [verify] item above (team photo watermark)
