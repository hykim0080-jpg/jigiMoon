# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Robustness of the 'move' prescription.
For each site, take the grid points that are prescribed as the nearest feasible alternative on NO-GO days
(6-day mission, 2027), up to the 8 most-used points. For each such point and each day it is prescribed:
 (1) terrain resolution: recompute with the finer near-field layer removed (5 m tile -> 20 m; sites with
     no 5 m tile: 20 m -> 80 m) and check whether the verdict stays GO;
 (2) position error: recompute at 8 points 30 m away (N, NE, E, ...) with the full terrain and count how
     many keep GO on that day.
Reported: share of (point, day) prescriptions that stay GO."""
import json, sys
import numpy as np
import ephem, horizon as H, terrain as T, prescribe as P

D = "/mnt/project-files/space-apps/lunar"
CRIT = {"min_sun_pct": 70, "max_dark_h": 50, "min_earth_pct": 50}
MD = 6
times = ephem.hourly(start=(2027, 1, 1), days=365 + 14 + 61)
VS, VE = ephem.body_vectors(times)
starts = np.arange(365) * 24
OFF = [(30 * np.cos(a), 30 * np.sin(a)) for a in np.deg2rad(np.arange(0, 360, 45))]


def ok_days(dem, x, y):
    s = P.Site(dem, x, y, VS, VE, 1.0, mast_m=2.0)
    return P.feasible_arr(s.daily(starts, MD * 24), CRIT)


out = []
ids = sys.argv[1:] or [s["id"] for s in json.load(open(f"{D}/sites.json"))]
S = {s["id"]: s for s in json.load(open(f"{D}/sites.json"))}
for sid in ids:
    s = S[sid]
    r = json.load(open(f"{D}/out/mission_6d/{sid}.json"))
    c, grid = r["calendar"], r["move"]["grid"]
    dist = np.array([np.hypot(g["dx_km"], g["dy_km"]) for g in grid])
    G = np.array([[ch == "1" for ch in g["ok_days"]] for g in grid])
    use = {}
    for d in range(365):
        if c["ok"][d] == "1" or not G[:, d].any():
            continue
        cand = np.nonzero(G[:, d])[0]
        i = int(cand[np.argmin(dist[cand])])
        use.setdefault(i, []).append(d)
    top = sorted(use, key=lambda i: -len(use[i]))[:8]
    full, tile = T.build_stack(s["x_m"], s["y_m"])
    coarse = H.DEMStack(full.dems[1:])
    n_pres = n_res = n_pos = n_pos_tot = 0
    pts = []
    for i in top:
        x, y = s["x_m"] + grid[i]["dx_km"] * 1000, s["y_m"] + grid[i]["dy_km"] * 1000
        days = use[i]
        base = ok_days(full, x, y)
        crs = ok_days(coarse, x, y)
        offs = [ok_days(full, x + dx, y + dy) for dx, dy in OFF]
        keep_res = int(sum(crs[d] for d in days))
        keep_pos = int(sum(o[d] for o in offs for d in days))
        n_pres += len(days); n_res += keep_res; n_pos += keep_pos; n_pos_tot += len(days) * len(OFF)
        pts.append({"dx_km": grid[i]["dx_km"], "dy_km": grid[i]["dy_km"], "days": len(days),
                    "base_consistent": int(sum(base[d] for d in days)),
                    "keep_coarser_terrain": keep_res, "keep_30m_offsets": keep_pos, "offset_trials": len(days) * len(OFF)})
    row = {"id": sid, "name": s["name"], "near_layer": full.dems[0].name, "coarser_layer": coarse.dems[0].name,
           "prescriptions": n_pres, "covered_prescriptions_pct": round(100 * n_pres / max(1, sum(len(v) for v in use.values())), 1),
           "keep_coarser_terrain_pct": round(100 * n_res / max(1, n_pres), 1),
           "keep_30m_offset_pct": round(100 * n_pos / max(1, n_pos_tot), 1), "points": pts}
    out.append(row)
    print(json.dumps({k: v for k, v in row.items() if k != "points"}), flush=True)
json.dump(out, open(sys.stdout.name if False else f"/root/work/sens_{ids[0]}.json", "w"), indent=1)
