# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Optimal mast layer, same definition as lunar/masts.py (optimal_mast_practical_m) but per 500 m pixel and with
the heights we have horizon tables for (2, 10, 20 m): the lowest height that gets 90% of the gain in feasible
landing days (6-day mission, 2027) available up to 20 m; gain < 10 days -> stay at 2 m.
Also writes days6_m20 (feasible 6-day landing days with a 20 m mast). Run after make_layers.py."""
import json, os, sys, time
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_layers as M

CR = M.CRIT
days = {}
ok2 = np.unpackbits(np.load(f"{M.WORK}/ok6.npy"), axis=0)[:M.CAL]
days[2] = ok2.sum(0).astype(np.float32); del ok2
for mast in (10, 20):
    tab = np.load(f"{M.WORK}/hz_{mast}m.npy")
    sun, ear = M.series(tab); del tab
    sp, ep, ld = M.window_stats(sun, ear, 6); del sun, ear
    days[mast] = ((sp >= CR["min_sun_pct"]) & (ld <= CR["max_dark_h"]) & (ep >= CR["min_earth_pct"])).sum(0).astype(np.float32)
    del sp, ep, ld
    print("mast", mast, flush=True)
gain = days[20] - days[2]
opt = np.full(M.P, 20.0, np.float32)
opt[days[10] - days[2] >= 0.9 * gain] = 10
opt[days[2] >= days[2] + 0.9 * gain] = 2   # only when gain == 0
opt[gain < 10] = 2
meta = json.load(open(f"{M.OUT}/layers.json"))
M.enc(opt, 0, 25).tofile(f"{M.OUT}/mast.bin")
M.enc(days[20], 0, 365).tofile(f"{M.OUT}/days6_m20.bin")
L = [l for l in meta["layers"] if l["id"] not in ("mast", "days6_m20")]
i = [l["id"] for l in L].index("days6") + 1
L.insert(i, {"id": "days6_m20", "name": "가능 착륙일 (6일, 마스트 20 m)", "unit": "일", "min": 0, "max": 365,
             "threshold": None, "direction": ">=", "weight": 0, "nodata": 255})
mi = [l["id"] for l in L].index("slope") + 1
L.insert(mi, {"id": "mast", "name": "마스트", "unit": "m", "min": 0, "max": 25, "threshold": None,
              "direction": "<=", "weight": 0, "nodata": 255})
meta["layers"] = L
meta["masts_m"] = [2, 10, 20]
meta["definitions"]["mast"] = ("optimal mast of 2/10/20 m, as lunar/masts.py: lowest height reaching 90% of the gain in "
                               "feasible 6-day landing days (2027) available up to 20 m; gain < 10 days -> 2 m")
meta["definitions"]["days6_m20"] = "feasible 6-day landing days in 2027 with a 20 m mast"
json.dump(meta, open(f"{M.OUT}/layers.json", "w"), indent=1, ensure_ascii=False)
print("done", {k: float(np.percentile(v, 95)) for k, v in days.items()}, np.unique(opt, return_counts=True))
