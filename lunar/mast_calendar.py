"""Add per-landing-day verdicts for 11 mast heights to out/<id>.json and out/mission_6d/<id>.json."""
import datetime as dt, json, sys
import numpy as np
import ephem, terrain as T, prescribe as P

HEIGHTS = [2, 3, 5, 7, 10, 15, 20, 30, 50, 75, 100]
CRIT = {"min_sun_pct": 70, "max_dark_h": 50, "min_earth_pct": 50}
D = "/mnt/project-files/space-apps/lunar/out"
times = ephem.hourly(start=(2027, 1, 1), days=365 + 14 + 61)
VS, VE = ephem.body_vectors(times)
starts = np.arange(365) * 24
ids = sys.argv[1:] or [s["id"] for s in json.load(open("sites.json"))]
S = {s["id"]: s for s in json.load(open("sites.json"))}
for sid in ids:
    s = S[sid]
    dem, _ = T.build_stack(s["x_m"], s["y_m"])
    per = {}
    for h in HEIGHTS:
        site = P.Site(dem, s["x_m"], s["y_m"], VS, VE, 1.0, mast_m=h)
        for md in (6, 14):
            m = site.daily(starts, md * 24)
            per[(h, md)] = (P.feasible_arr(m, CRIT), m)
    for md, path in ((14, f"{D}/{sid}.json"), (6, f"{D}/mission_6d/{sid}.json")):
        r = json.load(open(path)); c = r["calendar"]
        for h in HEIGHTS:
            c["mast_ok"][str(h)] = P.bits(per[(h, md)][0])
        c["mast_heights_m"] = HEIGHTS
        c["min_mast_m"] = [next((h for h in HEIGHTS if per[(h, md)][0][d]), None) for d in range(365)]
        c["mast_sun_pct"] = {str(h): np.round(per[(h, md)][1]["sun_pct"], 1).tolist() for h in HEIGHTS}
        c["mast_earth_pct"] = {str(h): np.round(per[(h, md)][1]["earth_pct"], 1).tolist() for h in HEIGHTS}
        c["mast_longest_dark_h"] = {str(h): per[(h, md)][1]["longest_dark_h"].astype(float).tolist() for h in HEIGHTS}
        json.dump(r, open(path + ".tmp", "w"), separators=(",", ":"))
        import os; os.replace(path + ".tmp", path)
    print(sid, "done", flush=True)
