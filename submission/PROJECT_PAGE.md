# Draft — project page text (spaceappschallenge.org form)

Living draft, 2026-11-15. Paste each section into the field of the same name. Before pasting, check the two items marked **[check]**.

---

## Project Name

Lunar Landing Site Navigator

## High-Level Project Summary

Landing dates slip. At the lunar south pole the Sun and Earth skim the horizon, so a delay of a few days, or a landing point a few kilometres off, can leave a lander without power or without a direct radio link to Earth. Our Lunar Landing Site Navigator, built on real NASA LOLA terrain and JPL ephemerides, shows for 12 candidate sites (the nine Artemis III regions, Shackleton rim, the Connecting Ridge and the IM-2 target) and every landing day of 2027 whether a lander gets enough sunlight and Earth contact, and why not when it fails. It does not stop at "NO-GO": it prescribes the smallest fix, whether to move a short distance, raise an antenna mast, or wait. Across the 4,380 site-days of 2027 (12 sites × 365 landing days, 6-day stay), 61 % fail our criteria, and 51.7 % of those are rescued by moving at most 1 km, a mast of at most 20 m, or waiting at most 7 days. Mission planners get a fast answer to "what now?" when a schedule changes; students and the public get a clear picture of why the south pole is both attractive and hard.

## Detailed Project Description

**What it does.** The Navigator answers one question for any site and landing day in 2027: can a lander keep power and Earth contact for the whole mission, and if not, what is the cheapest fix? A day is GO when the site is sunlit at least 70 % of the mission, Earth is in view at least 50 %, and no dark spell lasts longer than 50 hours (NASA's VIPER survival value). All three thresholds can be changed in the tool. When a day fails, three fix cards show the alternatives side by side: MOVE (distance and direction to the nearest GO point, within 3 km and on slopes of 8° or less), MAST (the antenna height that clears the blocking ridge), and WAIT (days until the site works again). The page shows the quickest one in its verdict.

**How you use it.** Two modes share one map of the south pole, with Earth always at the top. *Compare sites* covers the 12 candidates: a SKY panel draws the Sun's and Earth's paths against the real horizon and marks in red what blocks them; the map shows where you are; a calendar shows all 12 sites × 365 days, coloured by verdict and by fix. Drag along the calendar to make a landing slip and watch the verdict change; click a mast height to apply it everywhere. *Find a site* needs no candidates: stack criteria layers (sunlight, Earth in view, dark spell, slope, mast) to see where everything passes, then click anywhere to get that point's verdict and fixes.

**How it works.** For each point we trace the horizon in every direction using NASA LOLA terrain: 5 m/px landing-site models nearby and the 20–240 m polar models out to 150 km, including lunar curvature. Sun and Earth directions come from the JPL DE421 ephemeris and the IAU lunar rotation model, every hour of 2027. From these we compute the share of the mission in sunlight and with Earth in view, the longest dark spell, and the same numbers for a 3 km relocation grid and for masts from 2 to 100 m. We validated the model against NASA's own PGDA illumination maps: at matched resolution the long-term sunlight differs by 2.3 percentage points on average and Earth visibility by 2.7. The relocation advice is robust: of 430 prescribed MOVE points (6-day stay), 97.2 % stay GO when the nearby terrain model is one step coarser, and 81.6 % stay GO if the lander touches down 30 m from the point.

**Benefits.** When a launch slips, a team can see in seconds whether to wait, move or add a mast, and what each costs, instead of rerunning a terrain analysis. Small lander teams without in-house analysts get the same answer as large ones. The same views explain the south pole's light and shadow to students and the public.

**What we hope to achieve.** A planning aid that turns "the site is dark that day" into a decision. Next steps: sunlit rover routes that chain GO cells, base siting with long-term criteria, and relay-satellite coverage for places that never see Earth.

**Tools.** Python (NumPy, rasterio/GDAL, skyfield, SciPy, Pillow) for the terrain and ephemeris pipeline; plain HTML, CSS and JavaScript modules for the web app (no framework, no build); three.js for the 3D view; GitHub for code; Cloudflare Pages for hosting, deployed automatically from GitHub. **[check: keep the next sentence only if PR #7 is merged]** Cloudflare Pages Functions also serve the verdicts as a JSON API (`/api/check?site=…&date=…`), so other tools can use them. Anthropic's Claude helped write code and text under our direction (see the AI field).

## Link to Final Project

https://moonjigi.pages.dev

## Link to Project Demo

**[check: add the public link to the 7-slide deck]**
