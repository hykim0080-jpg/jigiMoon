# Lunar Landing Site Navigator — by Team Moon-jigi

NASA Space Apps Challenge 2026 · Challenge: Lunar Landing Site Navigator

Large parts of this code were written with the help of Anthropic's Claude (AI coding assistant), directed and reviewed by team Moon-jigi. Details: `submission/AI_USE.md`.

Compares lunar south-pole landing sites and dates by sunlight (power) and direct-to-Earth visibility on real LOLA terrain, and prescribes fixes when a site/date fails: move (km), raise a mast (m), or wait (days).

| Folder | What |
|---|---|
| `lunar/` | Terrain + ephemeris pipeline (Python): horizons, site outputs, masts, frames, layers, orientation data. See `lunar/README.md`. |
| `navigator/` | Web app (static HTML/JS, no build). Open `navigator/index.html` via a local server. See `navigator/README.md`, `DESIGN.md`. |
| `functions/`, `api/` | Verdict API on Cloudflare Pages Functions (see below). `api/core.js` holds the logic, `functions/api/*.js` the routes. |
| `web/` | Site-selection rationale page. |
| `submission/` | Draft submission texts: `SOURCES.md` (references & licences), `AI_USE.md`, `NASA_DATA.md`. |
| `notes/` | Planning notes (Korean). |

Data sources and licences: `submission/SOURCES.md`. AI assistance disclosure: `submission/AI_USE.md`.

## Verdict API (Cloudflare Pages Functions)

The site also answers as JSON, so other planning tools and scripts can use the same verdicts and fixes the page shows.

| Request | Returns |
|---|---|
| `GET /api` | usage and parameters |
| `GET /api/sites` | the 12 sites: id, name, coordinates, GO days per year (14-day and 6-day missions) |
| `GET /api/check?site=nobile-rim-1&date=2027-02-15` | verdict (`GO` / `NO-GO`), Sun / Earth / dark metrics, which criterion fails, the three fixes (wait days, move km with direction, mast m), the recommended fix and a link that opens the same state in the Navigator |

Optional `check` parameters: `mission` (14 or 6), `mast` (m, applies a mast), `sun`, `earth`, `dark` (criteria), `max_move`, `max_mast`, `max_wait` (limits for the recommended fix). Responses allow any origin (CORS) and are cached for an hour.

Example: `/api/check?site=nobile-rim-1&date=2027-02-15` → `NO-GO`, Earth 48.8 % (needs 50 %), fixes: move 0.6 km, mast 7 m or wait 16 days; with `&mast=7` → `GO`.

The Functions read the Navigator's own files in `navigator/data` through the Pages asset binding and reuse `navigator/js/criteria.js`, so the API and the page cannot disagree. `node api/test.mjs` checks every site, day and mission against the precomputed data (36,160 checks). Deployment needs no setting: Cloudflare Pages picks up `/functions` from the repository root on the next deploy of `main` (build output folder stays `navigator`). Local test: `npx wrangler pages dev navigator`.
