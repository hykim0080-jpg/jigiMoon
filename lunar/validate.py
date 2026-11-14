"""Compare our horizon+ephemeris model with PGDA Lunar Polar Illumination maps (products/69).
PGDA: 18.6-yr average, hourly; sun = visible fraction of the solar disc, Earth = visible if ANY part of the disc
is above the horizon. Ours: same definitions, 18.6 years (2008-01-01 + 6798 d) at 3-hour steps,
observer 0.5 m above the surface (the PGDA maps are at the surface; 0.5 m avoids self-shadowing by the
interpolated pixel)."""
import json, sys
import numpy as np
import ephem, horizon as H, terrain as T

times = ephem.hourly(start=(2008, 1, 1), days=6798, step_hours=3.0)
VS, VE = ephem.body_vectors(times)


def ours(x, y, dem, mast=0.5):
    az, mask = H.horizon_mask(dem, x, y, mast_m=mast)
    lat, lon = H.xy_to_ll(x, y)
    e = ephem.azel_from_body(lat, lon, VS, VE)
    sun, _ = H.visibility(az, mask, e)
    he = H.interp_mask(az, mask, e["earth"]["az"])
    earth_any = e["earth"]["el"] + e["earth_radius_deg"] > he
    earth_ctr = e["earth"]["el"] > he
    return sun.mean() * 100, earth_any.mean() * 100, earth_ctr.mean() * 100


def pgda(x, y):
    import rasterio
    out = []
    for f in ("AVGVISIB_85S_060M_201608.TIF", "AVGVISIB_85S_060M_201608_EARTH.TIF"):
        with rasterio.open(f"{T.DATA}/dem/{f}") as s:
            b = s.bounds
            lat_, _ = H.xy_to_ll(x, y)
            if not (b.left < x < b.right and b.bottom < y < b.top) or lat_ > -85:
                f = f.replace("85S_060M", "75S_120M")
        with rasterio.open(f"{T.DATA}/dem/{f}") as s:
            v = next(s.sample([(x, y)]))[0]
            out.append(float(v) * 4e-5 * 100)
    return out


COARSE = "--coarse" in sys.argv

if __name__ == "__main__":
    sys.argv = [a for a in sys.argv if a != "--coarse"]
    sites = json.load(open("sites.json"))
    rng = np.random.default_rng(0)
    pts = [(s["id"], s["x_m"], s["y_m"]) for s in sites]
    # extra random points 1-3 km around each site (not chosen for being bright)
    for s in sites:
        for k in range(2):
            a, r = rng.uniform(0, 2 * np.pi), rng.uniform(1000, 3000)
            pts.append((s["id"] + f"~r{k}", s["x_m"] + r * np.cos(a), s["y_m"] + r * np.sin(a)))
    rows = []
    cur = None
    for pid, x, y in pts:
        base = pid.split("~")[0]
        if cur != base:
            s0 = next(s for s in sites if s["id"] == base)
            dem, tile = T.build_stack(s0["x_m"], s0["y_m"])
            if COARSE:  # drop the 5 m tile and 20 m layers: closer to the 60/120 m PGDA maps
                dem = H.DEMStack([d for d in dem.dems if d.res >= 80])
            cur = base
        su, ea, ec = ours(x, y, dem, mast=0.5)
        ps, pe = pgda(x, y)
        lat, lon = H.xy_to_ll(x, y)
        rows.append({"point": pid, "lat": round(float(lat), 4), "lon": round(float(lon), 4),
                     "ours_sun_pct": round(su, 1), "pgda_sun_pct": round(ps, 1), "d_sun": round(su - ps, 1),
                     "ours_earth_pct": round(ea, 1), "pgda_earth_pct": round(pe, 1), "d_earth": round(ea - pe, 1),
                     "ours_earth_centre_pct": round(ec, 1)})
        print(rows[-1], flush=True)
    def stats(rr):
        ds = np.array([r["d_sun"] for r in rr]); de = np.array([r["d_earth"] for r in rr])
        return {"n": len(rr), "sun_bias": round(float(ds.mean()), 2), "sun_mae": round(float(np.abs(ds).mean()), 2),
            "sun_rmse": round(float(np.sqrt((ds ** 2).mean())), 2), "sun_max_abs": round(float(np.abs(ds).max()), 1),
            "earth_bias": round(float(de.mean()), 2), "earth_mae": round(float(np.abs(de).mean()), 2),
            "earth_rmse": round(float(np.sqrt((de ** 2).mean())), 2), "earth_max_abs": round(float(np.abs(de).max()), 1)}
    summ = {"random_points": stats([r for r in rows if "~" in r["point"]]),
            "chosen_sites": stats([r for r in rows if "~" not in r["point"]]), "all": stats(rows)}
    print(summ)
    json.dump({"method": __doc__, "summary": summ, "points": rows}, open(sys.argv[1] if len(sys.argv) > 1 else "validation.json", "w"), indent=1)
