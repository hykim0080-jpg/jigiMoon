# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Run prescribe for one site from sites.json and write out/<id>.json and out/<id>_sky_year.json."""
import datetime as dt, json, os, sys, time
import numpy as np
import ephem, terrain as T, prescribe as P

CRIT = {"min_sun_pct": 70, "max_dark_h": 50, "min_earth_pct": 50}
T0 = dt.datetime(2027, 1, 1)
NOMINAL = dt.datetime(2027, 6, 1)         # nominal landing date for base/wait/mast/move (calendar covers all of 2027)
MISSION_DAYS = float(os.environ.get("MISSION_DAYS", 14))
DAYS_SPAN = 365 + 14 + 61                 # 2027 landing days + up to 14-day mission + 60-day wait


def run(site, out_dir, move_km=3.0, move_step_km=0.25):
    t = time.time()
    x, y = site["x_m"], site["y_m"]
    dem, tile = T.build_stack(x, y)
    slp = T.slope_stack(x, y)
    times = ephem.hourly(start=(T0.year, T0.month, T0.day), days=DAYS_SPAN)
    i0 = int((NOMINAL - T0).total_seconds() // 3600)
    res, sky = P.prescribe(dem, x, y, times, i0=i0, mission_days=MISSION_DAYS, crit=CRIT, t0=T0,
                           move_km=move_km, move_step_km=move_step_km, slope=slp, progress=True)
    res["site"].update({"id": site["id"], "name": site["name"], "group": site.get("group"),
                        "selection": {k: site.get(k) for k in ("rule", "box_m", "box_source", "illum_map",
                                                                "pgda_sun_pct", "pgda_earth_pct")}})
    res["terrain"] = {"near_tile": tile, "layers": dem.describe(), "observer_height_m": 2.0}
    res["period_utc"] = [T0.isoformat() + "Z", (T0 + dt.timedelta(days=DAYS_SPAN)).isoformat() + "Z"]
    res["compute_s"] = round(time.time() - t, 1)
    os.makedirs(out_dir, exist_ok=True)
    json.dump(res, open(f"{out_dir}/{site['id']}.json", "w"), separators=(",", ":"))
    json.dump(sky, open(f"{out_dir}/{site['id']}_sky_year.json", "w"), separators=(",", ":"))
    return res


if __name__ == "__main__":
    sites = {s["id"]: s for s in json.load(open("sites.json"))}
    ids = sys.argv[1:] or list(sites)
    step = float(os.environ.get("MOVE_STEP", 0.25))
    for sid in ids:
        r = run(sites[sid], os.environ.get("OUT", "out"), move_step_km=step)
        print(sid, r["compute_s"], "s", r["base"], "wait", r["wait"] and r["wait"]["days"],
              "mast", [(m["mast_m"], m["ok"]) for m in r["mast"]], "move", r["move"]["best_dist_km"],
              "cal ok days", r["calendar"]["ok"].count("1"), flush=True)
