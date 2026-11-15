# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Per-criterion pass-day layers (2 m, 14-day mission, 2027 landing days): number of landing days on which the
mission alone meets sun >= 70% (sun_days), Earth >= 50% (earth_days), longest darkness <= 50 h (dark_days).
These are the static GIS inputs; days14 (all three on the same day) is the exact combined result."""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_layers as M

CR = M.CRIT
tab = np.load(f"{M.WORK}/hz_2m.npy")
sun, ear = M.series(tab); del tab
sp, ep, ld = M.window_stats(sun, ear, 14); del sun, ear
cnt = {"sun_days": (sp >= CR["min_sun_pct"]).sum(0), "earth_days": (ep >= CR["min_earth_pct"]).sum(0),
       "dark_days": (ld <= CR["max_dark_h"]).sum(0)}
for k, v in cnt.items():
    M.enc(v.astype(np.float32), 0, 365).tofile(f"{M.OUT}/{k}.bin")
    np.save(f"{M.WORK}/{k}.npy", v)
    print(k, np.percentile(v, [50, 90, 99]), flush=True)
