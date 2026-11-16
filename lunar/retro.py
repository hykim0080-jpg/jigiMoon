# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Retro check: what our tool would have said for past missions on their real dates.
Same horizon, ephemeris and metrics as the 2027 calendar (2 m mast, 0.5 deg azimuth steps), run from the real hour.
Writes navigator/data/orientation/retro.json (read by the web page's verdict box).

Horizons: LOLA LDEM 20 m (+-25 km) over LDEM 40 m (+-155 km), local copies in $LDEM_DIR (PGDA product 78).
Checked against navigator/data/sky/im-2-athena.json: mean 0.003 deg.
Times (UTC): IM-2 Athena 2025-03-06 ~17:30 (Intuitive Machines, ~12:30 ET), judged at its intended site
-84.78, 29.13 E (LROC 1401); LCROSS Centaur 2009-10-09 11:31:19, shepherding spacecraft 11:35:36;
Chandrayaan-1 MIP 2008-11-14 15:01; Lunar Prospector 1999-07-31 09:52:02. Impacts are judged at the impact
point, as if a lander had been there.
"""
import json, sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import ephem, horizon as H
from prescribe import metrics

NAV = os.path.join(os.path.dirname(__file__), '..', 'navigator', 'data')
LDEM = os.environ.get('LDEM_DIR', '.')
CASES = [("im-2-athena", (2025, 3, 6, 17), (-84.78, 29.13), True),
         ("lcross-centaur", (2009, 10, 9, 11), None, False),
         ("lcross-ssc", (2009, 10, 9, 11), None, False),
         ("chandrayaan-1-mip", (2008, 11, 14, 15), None, False),
         ("lunar-prospector", (1999, 7, 31, 9), None, False)]


def mask_at(x, y):
    a = H.load_geotiff(os.path.join(LDEM, 'LDEM20.tif'), bounds=(x - 25e3, y - 25e3, x + 25e3, y + 25e3), name='20')
    b = H.load_geotiff(os.path.join(LDEM, 'LDEM40.tif'), bounds=(x - 155e3, y - 155e3, x + 155e3, y + 155e3), name='40')
    return H.horizon_mask(H.DEMStack([a, b]), x, y, mast_m=2.0, az_step=0.5)


landers = {l["id"]: l for l in json.load(open(os.path.join(NAV, 'orientation', 'landers.json')))}
out = {}
for cid, (yy, mo, dd, hh), ll, target in CASES:
    lat, lon = ll or (landers[cid]["lat"], landers[cid]["lon"])
    x, y = (float(v) for v in H.ll_to_xy(lat, lon))
    azg, mask = mask_at(x, y)
    t = ephem.hourly(start=(yy, mo, dd), days=16)
    e = ephem.sun_earth_azel(lat, lon, t, height_km=0.002)
    sf, ev = H.visibility(azg, mask, e)
    r = {"utc": f"{yy:04d}-{mo:02d}-{dd:02d}T{hh:02d}:00Z", "lat": lat, "lon": lon, "target": target}
    for days in (6, 14):
        n = days * 24
        m = metrics(sf, ev, hh, n, 1.0)
        el = e["sun"]["el"][hh:hh + n]
        r[str(days)] = {"sun": m["sun_pct"], "earth": m["earth_pct"], "dark": m["longest_dark_h"],
                        "sun_el_min": round(float(el.min()), 1), "sun_el_max": round(float(el.max()), 1)}
    out[cid] = r
    print(cid, r, flush=True)
json.dump(out, open(os.path.join(NAV, 'orientation', 'retro.json'), 'w'), indent=1)
