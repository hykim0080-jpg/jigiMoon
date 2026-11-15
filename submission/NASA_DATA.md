# Draft — "NASA Data" field

We built the tool on NASA lunar data end to end.

- **LOLA polar topography (NASA GSFC PGDA).** The 5 m/px landing-site DEMs and slope maps (PGDA product 78, Barker et al. 2021) give the horizon around each candidate site and the landing slope for every point on a 3 km relocation grid. The 20 m, 40 m, 80 m and 240 m polar DEMs (product 90) extend each horizon out to 150 km, with lunar curvature, and drive our hourly sunlight / Earth-visibility maps of the whole south polar region.
- **LOLA average illumination and Earth-visibility maps (PGDA product 69, Mazarico et al. 2011).** We used them to pick a representative point inside each region by one fixed rule, and as an independent check of our model: at matched resolution our 18.6-year sunlight differs from PGDA by 2.3 percentage points on average (Earth visibility 2.7 points).
- **Artemis III candidate landing regions (NASA, Oct 2024).** We registered NASA's region map to the LOLA tiles (residual ≤ 0.33 km) to place all nine regions, then added Shackleton Rim, the Connecting Ridge and the IM-2 Athena target (LROC, NASA/GSFC/ASU).
- **JPL DE421 ephemeris (NASA JPL).** Sun and Earth directions from each point, every hour, for every 2027 landing date.
- **NASA mast research (VSAT / BEACON reports on NTRS).** Sets the practical 20 m mast limit for the "raise the mast" fix.
- **NASA SVS CGI Moon Kit.** Globe imagery in the web tool.

With these we compute, for each of 12 sites and each landing day of 2027, whether a lander gets enough sunlight and direct-to-Earth contact, and if not, whether waiting, raising a mast, or moving a short distance fixes it.

_Full list with licences: SOURCES.md._ (Numbers checked against `lunar/README.md` and `lunar/validation*.json`, 2026-11-15.)
