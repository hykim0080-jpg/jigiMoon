# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Frames for the 3D map thread: 800x800 @500 m (+-200 km), PNG per frame (R = sun disc fraction*255,
G = 255 if Earth centre visible), height.bin float32, meta.json. See frames.py for the method."""
import datetime as dt, json, os, sys, time
import numpy as np
from multiprocessing import Pool
from PIL import Image
import ephem, horizon as H, terrain as T
from frames import target_dirs, horizon_toward

OUT = os.environ.get("OUT", "/mnt/project-files/space-apps/lunar/frames")
N, RES, HALF = 800, 500.0, 200000.0
START = dt.datetime.fromisoformat(os.environ.get("START", "2027-06-01T00:00"))
STEP_H, NT = 4.0, 178
MAST, MAXKM = 2.0, 150.0
xs = -HALF + RES / 2 + np.arange(N) * RES
X, Y = np.meshgrid(xs, xs[::-1])
span = HALF + MAXKM * 1000 + 10000
DEM = H.DEMStack([H.load_geotiff(T.F80, (-span, -span, span, span), name="80m"),
                  H.load_geotiff(T.F240, (-span, -span, span, span), name="240m")])
Z = DEM.sample(X, Y)
H0 = Z + MAST
DIST = np.unique(np.concatenate([np.arange(250, 4000, 125), np.arange(4000, 20000, 250),
                                 np.geomspace(20000, MAXKM * 1000, 160)]))
times = ephem.TS.utc(START.year, START.month, START.day, np.arange(NT) * STEP_H)
VS, VE = ephem.body_vectors(times)


def frame(k):
    p = f"{OUT}/f_{k:03d}.png"
    if os.path.exists(p):
        return k
    el, dx, dy = target_dirs(X, Y, VS[:, k])
    r = np.degrees(np.arcsin(696000.0 / np.linalg.norm(VS[:, k])))
    hz = horizon_toward(DEM, X, Y, H0, dx, dy, DIST)
    sun = np.clip((el - hz + r) / (2 * r), 0, 1)
    el, dx, dy = target_dirs(X, Y, VE[:, k])
    hz = horizon_toward(DEM, X, Y, H0, dx, dy, DIST)
    rgb = np.zeros((N, N, 3), np.uint8)
    rgb[..., 0] = np.round(sun * 255).astype(np.uint8)
    rgb[..., 1] = np.where(el > hz, 255, 0)
    Image.fromarray(rgb).save(p + ".tmp.png", optimize=True)
    os.replace(p + ".tmp.png", p)
    return k


def pole_azel(v):
    u = v / np.linalg.norm(v, axis=0)
    el = np.degrees(np.arcsin(-u[2]))
    az = np.degrees(np.arctan2(u[1], u[0])) % 360   # map: x ~ body Y, y ~ body X; az from map +y clockwise
    return [[round(float(a), 2), round(float(e), 3)] for a, e in zip(az, el)]


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    zz = np.where(np.isfinite(Z), Z, np.nanmean(Z)).astype("<f4")
    zz.tofile(f"{OUT}/height.bin")
    site_e = VE - 0  # Earth parallax from the pole point is small (~0.26 deg); computed from pole surface point:
    pole = np.array([0, 0, -ephem.R_MOON_KM])[:, None]
    meta = {"grid": {"nx": N, "ny": N, "res_m": RES, "x_min": float(xs[0]), "x_max": float(xs[-1]),
                     "y_min": float(xs[0]), "y_max": float(xs[-1]), "row0": "max_y",
                     "projection": "+proj=stere +lat_0=-90 +lon_0=0 +R=1737400; x = rho sin(lon), y = rho cos(lon); values are pixel centres"},
            "times_utc": [(START + dt.timedelta(hours=k * STEP_H)).isoformat() + "Z" for k in range(NT)],
            "step_h": STEP_H, "observer_m": MAST, "max_distance_km": MAXKM,
            "encoding": {"png": "f_NNN.png RGB: R = visible fraction of solar disc * 255; G = 255 if Earth centre above terrain horizon else 0; B = 0",
                         "height.bin": "float32 little-endian, 800x800 row-major, metres vs 1737.4 km sphere"},
            "sun_az_el_at_pole": pole_azel(VS - pole), "earth_az_el_at_pole": pole_azel(VE - pole),
            "az_convention": "at the pole: degrees clockwise from map +y (toward lon 0) to map +x (toward lon 90E); el in degrees",
            "method": "per pixel and frame: march the terrain from the pixel (observer 2 m) toward the Sun/Earth direction out to 150 km with curvature; Sun disc fraction linear in disc height; Earth = centre above horizon",
            "sources": ["NASA GSFC PGDA LOLA LDEM_80S_80MPP_ADJ (https://pgda.gsfc.nasa.gov/products/90)",
                        "NASA GSFC PGDA LOLA LDEM_60S_240MPP_ADJ (products/90), beyond 80S",
                        "JPL DE421 ephemeris (skyfield-data), IAU 2009 lunar rotation model (Archinal et al. 2011)"],
            "status": "running"}
    json.dump(meta, open(f"{OUT}/meta.json", "w"), indent=1)
    order = list(range(0, NT, max(1, NT // 4)))[:4] + list(range(NT))
    t = time.time()
    with Pool(4) as pool:
        for k in pool.imap(frame, order[:4]):
            print("first", k, round(time.time() - t), flush=True)
        open(f"{OUT}/FIRST_FRAMES_READY", "w").write(",".join(map(str, order[:4])))
        for k in pool.imap_unordered(frame, order[4:]):
            print("done", k, round(time.time() - t), flush=True)
    meta["status"] = "complete"; meta["compute_s"] = round(time.time() - t)
    json.dump(meta, open(f"{OUT}/meta.json", "w"), indent=1)
