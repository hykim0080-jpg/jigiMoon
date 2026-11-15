# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Mast height vs. sunlight / Earth visibility / feasible landing days, per site (2027, hourly).
Optimal mast (definition): the lowest height (from HEIGHTS) that captures >= 90% of the total gain in
2027 mean sunlight between 2 m and 100 m. Reported both uncapped and capped at the practical limit (20 m)."""
import datetime as dt, json, sys
import numpy as np
import ephem, horizon as H, terrain as T, prescribe as P

HEIGHTS = [2, 3, 5, 7, 10, 15, 20, 30, 50, 75, 100]
CRIT = {"min_sun_pct": 70, "max_dark_h": 50, "min_earth_pct": 50}
PRACTICAL_MAX = 20
T0 = dt.datetime(2027, 1, 1)
times = ephem.hourly(start=(2027, 1, 1), days=365 + 14 + 61)
VS, VE = ephem.body_vectors(times)
YEAR = 365 * 24


def knee(h, v, frac=0.9):
    g = v - v[0]
    if g[-1] <= 0.5:
        return h[0]
    return h[int(np.argmax(g >= frac * g[-1]))]


out = []
for s in json.load(open("sites.json")):
    dem, tile = T.build_stack(s["x_m"], s["y_m"])
    rows = []
    for hgt in HEIGHTS:
        site = P.Site(dem, s["x_m"], s["y_m"], VS, VE, 1.0, mast_m=hgt)
        sf, ev = site.sun_frac, site.earth_vis
        row = {"mast_m": hgt, "sun_pct": round(float(sf[:YEAR].mean() * 100), 1),
               "earth_pct": round(float(ev[:YEAR].mean() * 100), 1),
               "longest_dark_h": float(P.longest_run_rows((sf[:YEAR] < P.DARK)[None])[0])}
        for md in (6, 14):
            n = md * 24
            starts = np.arange(365) * 24
            ok = P.feasible_arr(site.daily(starts, n), CRIT)
            row[f"ok_days_{md}d"] = int(ok.sum())
        rows.append(row)
    h = np.array(HEIGHTS); sun = np.array([r["sun_pct"] for r in rows])
    opt = int(knee(h, sun))
    out.append({"id": s["id"], "name": s["name"], "curve": rows, "optimal_mast_m": opt,
                "optimal_mast_practical_m": min(opt, PRACTICAL_MAX)})
    print(s["id"], opt, [(r["mast_m"], r["sun_pct"], r["earth_pct"], r["ok_days_6d"]) for r in rows], flush=True)
json.dump({"definition": __doc__, "heights_m": HEIGHTS, "criteria": CRIT, "period": "2027-01-01..2027-12-31 UTC hourly",
           "practical_max_m": PRACTICAL_MAX, "concept_max_m": 100, "sites": out},
          open(sys.argv[1] if len(sys.argv) > 1 else "masts.json", "w"), indent=1)
