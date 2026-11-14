"""Site metrics and 'prescriptions' when a landing date slips:
wait (days of delay), raise (mast height), move (nearest feasible + landable point).

Everything is also computed for every possible landing day of the calendar year (`calendar`),
so the web page can show prescriptions for any date without recomputing.
"""
import datetime as dt
import json
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
import ephem
import horizon as H

DARK = 0.1  # sun_frac below this counts as dark


def longest_run_rows(mask2d):
    """Longest run of True in each row of a 2-D boolean array."""
    n = mask2d.shape[1]
    idx = np.arange(n)
    last_false = np.maximum.accumulate(np.where(~mask2d, idx, -1), axis=1)
    return (idx - last_false).max(axis=1)


def window_metrics(sun_frac, earth_vis, starts, n, step_h):
    """Vectorised metrics for windows [s, s+n) for each start index s. Returns dict of arrays."""
    s = sliding_window_view(sun_frac, n)[starts]
    e = sliding_window_view(earth_vis, n)[starts]
    dark = s < DARK
    return {
        "sun_pct": s.mean(1) * 100,
        "earth_pct": e.mean(1) * 100,
        "both_pct": ((s > 0.5) & e).mean(1) * 100,
        "longest_dark_h": longest_run_rows(dark) * step_h,
        "longest_no_comm_h": longest_run_rows(~e) * step_h,
    }


def feasible_arr(m, c):
    return ((m["sun_pct"] >= c["min_sun_pct"]) & (m["longest_dark_h"] <= c["max_dark_h"])
            & (m["earth_pct"] >= c["min_earth_pct"]))


def metrics(sun_frac, earth_vis, i0, n, step_h):
    """Metrics for one window (same keys as before, used for base/wait/mast)."""
    m = {k: float(v[0]) for k, v in window_metrics(sun_frac, earth_vis, np.array([i0]), n, step_h).items()}
    s, e = sun_frac[i0:i0 + n], earth_vis[i0:i0 + n]
    dark = s < DARK
    return {"sun_pct": round(m["sun_pct"], 1), "earth_pct": round(m["earth_pct"], 1),
            "both_pct": round(m["both_pct"], 1), "longest_dark_h": m["longest_dark_h"],
            "longest_no_comm_h": m["longest_no_comm_h"],
            "hours_to_sunset": float(np.argmax(dark) * step_h) if dark.any() else None,
            "hours_to_earthset": float(np.argmax(~e) * step_h) if (~e).any() else None}


def feasible(m, c):
    return bool(m["sun_pct"] >= c["min_sun_pct"] and m["longest_dark_h"] <= c["max_dark_h"]
                and m["earth_pct"] >= c["min_earth_pct"])


def bits(a):
    return "".join("1" if v else "0" for v in a)


class Site:
    def __init__(self, dem, x, y, vs_b, ve_b, step_h, mast_m=2.0, az_step=0.5):
        self.x, self.y = x, y
        lat, lon = H.xy_to_ll(x, y)
        self.lat, self.lon = float(lat), float(lon)
        self.az, self.mask = H.horizon_mask(dem, x, y, mast_m=mast_m, az_step=az_step)
        self.eph = ephem.azel_from_body(lat, lon, vs_b, ve_b)
        self.sun_frac, self.earth_vis = H.visibility(self.az, self.mask, self.eph)
        self.step_h = step_h

    def window(self, i0, n):
        return metrics(self.sun_frac, self.earth_vis, i0, n, self.step_h)

    def daily(self, starts, n):
        return window_metrics(self.sun_frac, self.earth_vis, starts, n, self.step_h)


def prescribe(dem, x, y, times, i0, mission_days, crit, step_h=1.0, t0=None,
              masts=(2, 5, 10, 20, 40), move_km=3.0, move_step_km=0.25, max_wait_days=60,
              cal_days=365, slope=None, max_slope_deg=8.0, progress=False):
    """dem: DEM/DEMStack; times: skyfield Time array (hourly) starting at 00:00 UTC of t0 (datetime).
    i0: index of nominal landing hour. cal_days: number of landing days in the calendar.
    Returns (main JSON dict, full-period sky dict)."""
    vs_b, ve_b = ephem.body_vectors(times)
    n = int(mission_days * 24 / step_h)
    per_day = int(round(24 / step_h))
    n_days_all = (len(times) - n) // per_day + 1
    starts = np.arange(n_days_all) * per_day
    cal_days = min(cal_days, n_days_all)

    if slope is not None:
        import terrain as T
        slope_of = lambda xx, yy: T.landing_slope(slope, xx, yy)
    else:
        slope_of = lambda xx, yy: None

    base = Site(dem, x, y, vs_b, ve_b, step_h)
    out = {"site": {"lat": base.lat, "lon": base.lon, "x_m": float(x), "y_m": float(y)},
           "criteria": crit, "mission_days": mission_days, "max_slope_deg": max_slope_deg,
           "landing_utc": None if t0 is None else (t0 + dt.timedelta(hours=i0 * step_h)).isoformat() + "Z",
           "base": base.window(i0, n)}
    out["base"]["ok"] = feasible(out["base"], crit)
    out["base"]["slope_deg"] = slope_of(x, y)

    bd = base.daily(starts, n)
    base_ok = feasible_arr(bd, crit)

    # wait
    wait = None
    for dd in range(0, max_wait_days + 1):
        j = i0 + dd * per_day
        if j + n > len(base.sun_frac):
            break
        m = base.window(j, n)
        if feasible(m, crit):
            wait = {"days": dd, **m}
            break
    out["wait"] = wait

    # raise
    mast_res, mast_ok = [], {}
    for h in masts:
        s = base if h == 2 else Site(dem, x, y, vs_b, ve_b, step_h, mast_m=h)
        m = s.window(i0, n); m["mast_m"] = h; m["ok"] = feasible(m, crit)
        mast_res.append(m)
        mast_ok[h] = feasible_arr(s.daily(starts, n), crit)
    out["mast"] = mast_res

    # move
    grid, grid_ok_days = [], []
    k = int(round(move_km / move_step_km))
    pts = [(ix, iy) for iy in range(-k, k + 1) for ix in range(-k, k + 1)
           if np.hypot(ix, iy) * move_step_km <= move_km + 1e-9]
    for c, (ix, iy) in enumerate(pts):
        dx, dy = ix * move_step_km * 1000, iy * move_step_km * 1000
        s = base if (ix == 0 and iy == 0) else Site(dem, x + dx, y + dy, vs_b, ve_b, step_h)
        okd = feasible_arr(s.daily(starts, n), crit)
        sl = slope_of(x + dx, y + dy)
        landable = sl is None or sl <= max_slope_deg
        m = s.window(i0, n)
        light_ok = feasible(m, crit)
        grid.append({"dx_km": round(dx / 1000, 3), "dy_km": round(dy / 1000, 3),
                     "ok": bool(light_ok and landable), "ok_light": light_ok, "landable": bool(landable),
                     "slope_deg": None if sl is None else round(sl, 1),
                     "slope_proxy": None if sl is None else round(sl, 1),
                     "sun_pct": m["sun_pct"], "earth_pct": m["earth_pct"],
                     "longest_dark_h": m["longest_dark_h"],
                     "ok_days": bits((okd & landable)[:cal_days])})
        grid_ok_days.append(okd & landable)
        if progress and c % 50 == 0:
            print(f"  move {c}/{len(pts)}", flush=True)
    oks = [g for g in grid if g["ok"]]
    best = min(oks, key=lambda g: np.hypot(g["dx_km"], g["dy_km"])) if oks else None
    out["move"] = {"grid": grid,
                   "best": None if best is None else {k2: v for k2, v in best.items() if k2 != "ok_days"},
                   "best_dist_km": None if best is None else round(float(np.hypot(best["dx_km"], best["dy_km"])), 2),
                   "step_km": move_step_km, "radius_km": move_km}

    # calendar: every landing day
    G = np.array(grid_ok_days)
    dist = np.array([np.hypot(g["dx_km"], g["dy_km"]) for g in grid])
    nearest, wait_days, min_mast = [], [], []
    for d in range(cal_days):
        sel = G[:, d]
        nearest.append(None if not sel.any() else round(float(dist[sel].min()), 2))
        nxt = np.nonzero(base_ok[d:d + max_wait_days + 1])[0]
        wait_days.append(int(nxt[0]) if len(nxt) else None)
        mm = [h for h in masts if mast_ok[h][d]]
        min_mast.append(mm[0] if mm else None)
    out["calendar"] = {
        "first_day_utc": None if t0 is None else t0.isoformat() + "Z", "days": cal_days,
        "sun_pct": np.round(bd["sun_pct"][:cal_days], 1).tolist(),
        "earth_pct": np.round(bd["earth_pct"][:cal_days], 1).tolist(),
        "both_pct": np.round(bd["both_pct"][:cal_days], 1).tolist(),
        "longest_dark_h": bd["longest_dark_h"][:cal_days].astype(float).tolist(),
        "longest_no_comm_h": bd["longest_no_comm_h"][:cal_days].astype(float).tolist(),
        "ok": bits(base_ok[:cal_days]),
        "wait_days": wait_days, "min_mast_m": min_mast, "nearest_move_km": nearest,
        "mast_ok": {str(h): bits(mast_ok[h][:cal_days]) for h in masts},
    }

    # sky dome data for the web (base site, nominal mission window)
    out["sky"] = {"az_step": float(base.az[1] - base.az[0]),
                  "horizon_el": np.round(base.mask, 2).tolist(),
                  "sun_az": np.round(base.eph["sun"]["az"][i0:i0 + n], 2).tolist(),
                  "sun_el": np.round(base.eph["sun"]["el"][i0:i0 + n], 3).tolist(),
                  "earth_az": np.round(base.eph["earth"]["az"][i0:i0 + n], 2).tolist(),
                  "earth_el": np.round(base.eph["earth"]["el"][i0:i0 + n], 3).tolist(),
                  "sun_frac": np.round(base.sun_frac[i0:i0 + n], 3).tolist(),
                  "earth_vis": base.earth_vis[i0:i0 + n].astype(int).tolist(),
                  "step_h": step_h}
    L = cal_days * per_day + n
    sky_year = {"step_h": step_h, "first_utc": out["calendar"]["first_day_utc"], "hours": L,
                "az_step": out["sky"]["az_step"], "horizon_el": out["sky"]["horizon_el"],
                "sun_az": np.round(base.eph["sun"]["az"][:L], 1).tolist(),
                "sun_el": np.round(base.eph["sun"]["el"][:L], 2).tolist(),
                "earth_az": np.round(base.eph["earth"]["az"][:L], 1).tolist(),
                "earth_el": np.round(base.eph["earth"]["el"][:L], 2).tolist(),
                "sun_frac": np.round(base.sun_frac[:L], 2).tolist(),
                "earth_vis": base.earth_vis[:L].astype(int).tolist()}
    return out, sky_year


if __name__ == "__main__":
    import time
    dem = H.synthetic_dem()
    x, y = H.ll_to_xy(-89.6, -120)
    t0 = dt.datetime(2027, 1, 1)
    times = ephem.hourly(start=(2027, 1, 1), days=60)
    crit = {"min_sun_pct": 70, "max_dark_h": 50, "min_earth_pct": 50}
    t = time.time()
    res, _ = prescribe(dem, x, y, times, i0=0, mission_days=14, crit=crit, t0=t0, move_km=2,
                       move_step_km=0.5, cal_days=30)
    res["note"] = "SYNTHETIC TEST TERRAIN - not real lunar data"
    print("seconds", round(time.time() - t, 1))
    print("base", res["base"])
    print("calendar ok", res["calendar"]["ok"])
    json.dump(res, open("sample_output_synthetic.json", "w"))
