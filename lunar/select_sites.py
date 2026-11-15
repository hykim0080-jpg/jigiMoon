# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Pick one representative landing point per candidate region.

Region boxes: NASA's official Artemis III candidate-region map (Oct 2024,
https://www.nasa.gov/wp-content/uploads/2024/10/artemis-iii-landing-region-candidates.jpg, credit
NASA/GSFC/ASU/JSC/AGDT). NASA publishes no coordinates, so the image was georeferenced by fitting
scale + offset to five boxes that coincide with PGDA 5 m site tiles (residual < 0.3 km), see region_boxes.json.
Shackleton rim / Connecting Ridge: the PGDA 5 m tile footprint (products/78, Site04 / Site01).

Rule inside each box (same for all): among PGDA illumination-map pixels (products/69, 18.6-yr averages)
with landing slope <= 8 deg (PGDA slope maps), take the pixel with the highest average sunlight among
those with Earth visibility >= 50%; if none reach 50%, the highest sunlight + Earth sum.
IM-2: LROC's published target (-84.78, 29.13E), no selection.
"""
import json
import numpy as np
import rasterio
import horizon as H
import terrain as T

ILL = {"85": ("AVGVISIB_85S_060M_201608.TIF", "AVGVISIB_85S_060M_201608_EARTH.TIF"),
       "75": ("AVGVISIB_75S_120M_201608.TIF", "AVGVISIB_75S_120M_201608_EARTH.TIF")}


def ill_maps(bounds):
    """Return (sun, earth, X, Y) arrays over bounds from the finest illumination map that covers it."""
    for key in ("85", "75"):
        fs, fe = ILL[key]
        with rasterio.open(f"{T.DATA}/dem/{fs}") as s:
            b = s.bounds
            if not (b.left <= bounds[0] and bounds[2] <= b.right and b.bottom <= bounds[1] and bounds[3] <= b.top):
                continue
        sd = H.load_geotiff(f"{T.DATA}/dem/{fs}", bounds)
        ed = H.load_geotiff(f"{T.DATA}/dem/{fe}", bounds)
        ny, nx = sd.z.shape
        X = sd.x0 + np.arange(nx) * sd.res
        Y = sd.y0 - np.arange(ny) * sd.res
        X, Y = np.meshgrid(X, Y)
        return sd.z * 4e-5 * 100, ed.z * 4e-5 * 100, X, Y, sd.res, fs
    raise ValueError("no illumination map covers box")


N_CAND = 15
_VS = None


def our_means(dem, x, y):
    global _VS
    import ephem
    if _VS is None:
        _VS = ephem.body_vectors(ephem.hourly(start=(2008, 1, 1), days=6798, step_hours=6.0))
    az, mask = H.horizon_mask(dem, x, y, mast_m=2.0)
    lat, lon = H.xy_to_ll(x, y)
    e = ephem.azel_from_body(lat, lon, *_VS)
    s, ev = H.visibility(az, mask, e)
    return float(s.mean() * 100), float(ev.mean() * 100)


def pick(bounds, margin_m=3000):
    b = (bounds[0] + margin_m, bounds[1] + margin_m, bounds[2] - margin_m, bounds[3] - margin_m)
    sun, earth, X, Y, res, src = ill_maps(b)
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    slp = T.slope_stack(cx, cy, half_km=max(b[2] - b[0], b[3] - b[1]) / 2000 + 1)
    # slope over the illumination pixel: max of 5 samples (centre + corners at res/2)
    off = res / 2.5
    S = np.nanmax(np.stack([slp.sample(X + dx, Y + dy) for dx, dy in
                            [(0, 0), (-off, -off), (off, -off), (-off, off), (off, off)]]), axis=0)
    good = np.isfinite(sun) & np.isfinite(S) & (S <= 8)
    e_ok = good & (earth >= 50)
    if e_ok.any():
        score = np.where(e_ok, sun, -1); rule = "max sun, slope<=8, earth>=50"
    else:
        score = np.where(good, sun + earth, -1); rule = "max sun+earth, slope<=8 (no pixel with earth>=50)"
    # top-N PGDA candidates, at least 300 m apart
    order = np.argsort(score, axis=None)[::-1]
    cands = []
    for flat in order:
        if score.flat[flat] < 0 or len(cands) >= N_CAND:
            break
        i = np.unravel_index(flat, score.shape)
        x, y = float(X[i]), float(Y[i])
        if all(np.hypot(x - c[0], y - c[1]) >= 300 for c in cands):
            cands.append((x, y, i))
    # re-rank with OUR 5 m model (18.6-yr mean, 6 h steps); the 60/120 m map's best pixel is often
    # shadowed by small relief at 5 m, so we keep the candidate that is best in the finer model.
    dem, _ = T.build_stack(cx, cy, near_half_km=min(50, max(b[2] - b[0], b[3] - b[1]) / 2000 + 25))
    best = None
    for x, y, i in cands:
        for dx, dy in ((0, 0), (-20, 0), (20, 0), (0, -20), (0, 20)):
            if True:
                sl = T.landing_slope(slp, x + dx, y + dy)
                if sl is None or sl > 8:
                    continue
                su, ea = our_means(dem, x + dx, y + dy)
                key = (ea >= 50, su) if e_ok.any() else (True, su + ea)
                if best is None or key > best[0]:
                    best = (key, x + dx, y + dy, i, su, ea, sl)
    _, x, y, i, su, ea, sl = best
    lat, lon = H.xy_to_ll(x, y)
    return {"x_m": x, "y_m": y, "lat": round(float(lat), 4), "lon": round(float(lon), 4),
            "pgda_sun_pct": round(float(sun[i]), 1), "pgda_earth_pct": round(float(earth[i]), 1),
            "ours_sun_pct_18y": round(su, 1), "ours_earth_pct_18y": round(ea, 1),
            "slope_deg": round(float(sl), 1), "rule": rule + f"; top {len(cands)} PGDA pixels (>=300 m apart) + 4 neighbours 20 m away re-ranked by our 5 m model (18.6 yr mean, Earth centre visible >= 50%)",
            "illum_map": src}


if __name__ == "__main__":
    rb = json.load(open("region_boxes.json"))["boxes"]
    tiles = {n: b for n, f, b in T.tile_index()}
    sites = []
    a3 = ["Peak near Cabeus B", "Haworth", "Malapert Massif", "Mons Mouton Plateau", "Mons Mouton",
          "Nobile Rim 1", "Nobile Rim 2", "de Gerlache Rim 2", "Slater Plain"]
    for name in a3:
        p = pick(rb[name]["box_m"])
        sites.append({"id": name.lower().replace(" ", "-"), "name": name, "group": "Artemis III candidate region (NASA, Oct 2024)",
                      "box_m": rb[name]["box_m"], "box_source": "NASA region map, georeferenced", **p})
        print(sites[-1], flush=True)
    for sid, name, tile in [("shackleton-rim", "Shackleton rim", "Site04"), ("connecting-ridge", "Connecting Ridge", "Site01")]:
        p = pick(tiles[tile], margin_m=3000)
        sites.append({"id": sid, "name": name, "group": "PGDA 5 m site (Barker et al. 2021)",
                      "box_m": [round(v) for v in tiles[tile]], "box_source": f"PGDA products/78 {tile} tile", **p})
        print(sites[-1], flush=True)
    x, y = H.ll_to_xy(-84.78, 29.13)
    sites.append({"id": "im-2-athena", "name": "IM-2 Athena (Mons Mouton)", "group": "Actual landing (IM-2, 2025-03-06)",
                  "x_m": float(x), "y_m": float(y), "lat": -84.78, "lon": 29.13, "rule": "LROC published target",
                  "box_source": "https://www.lroc.asu.edu/images/1401 (actual touchdown ~250 m away)"})
    json.dump(sites, open("sites.json", "w"), indent=1)
