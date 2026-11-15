# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Time-sliced sun / Earth visibility maps of the lunar south pole (for the 3D slider map).

For every pixel of a south-polar-stereographic grid and every time step: trace the terrain from the
pixel (observer 2 m above ground) toward the Sun and toward the Earth out to 150 km (LOLA 80 m DEM,
240 m beyond 80S, lunar curvature included) and record
  sun  = visible fraction of the solar disc, 0..1 (stored as uint8 0..250)
  earth = Earth centre above the local terrain horizon (0/1)
Output (out_dir): sun_uint8.bin (T, N, N), earth_bits.bin (T, N, N) uint8 0/1, height_int16.bin (N, N) metres,
meta.json (grid, times, encoding).
"""
import datetime as dt, json, os, sys, time
import numpy as np
import ephem, horizon as H, terrain as T

R_M = H.R_M


def grid(half_km, n):
    xs = np.linspace(-half_km * 1000, half_km * 1000, n)       # pixel centres, column -> +x
    ys = xs[::-1]                                               # row 0 = +y (top = lon 0)
    X, Y = np.meshgrid(xs, ys)
    return X, Y


def target_dirs(X, Y, vec_b, is_point=True):
    """Elevation (deg) and unit map-plane direction (dx, dy) of a body-fixed target vector (km) per pixel."""
    lat, lon = H.xy_to_ll(X, Y)
    la, lo = np.deg2rad(lat), np.deg2rad(lon)
    up = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])   # (3,N,N)
    site = up * ephem.R_MOON_KM
    rel = vec_b[:, None, None] - site
    u = rel / np.linalg.norm(rel, axis=0)
    east = np.stack([-np.sin(lo), np.cos(lo), np.zeros_like(lo)])
    north = np.cross(up, east, axis=0)
    el = np.degrees(np.arcsin(np.clip((u * up).sum(0), -1, 1)))
    az = np.arctan2((u * east).sum(0), (u * north).sum(0))
    # map-plane unit vectors of local north / east (south polar stereographic)
    nmx, nmy = np.sin(lo), np.cos(lo)            # radially outward from the pole = toward the equator = north
    emx, emy = np.cos(lo), -np.sin(lo)
    dx = np.cos(az) * nmx + np.sin(az) * emx
    dy = np.cos(az) * nmy + np.sin(az) * emy
    return el, dx, dy


def horizon_toward(dem, X, Y, h0, dx, dy, dist):
    """Max terrain elevation angle (deg) along map direction (dx,dy) from each pixel."""
    best = np.full(X.shape, -90.0)
    for d in dist:
        h = dem.sample(X + dx * d, Y + dy * d)
        ang = np.degrees(np.arctan2(h - h0 - d * d / (2 * R_M), d))
        np.fmax(best, ang, out=best)
    return best


def run(out_dir, start, days, step_h, half_km=100.0, n=500, mast=2.0, max_km=150.0):
    t_all = time.time()
    os.makedirs(out_dir, exist_ok=True)
    X, Y = grid(half_km, n)
    span = half_km + max_km + 10
    dem = H.DEMStack([H.load_geotiff(T.F80, (-span * 1000, -span * 1000, span * 1000, span * 1000), name="LDEM_80S_80MPP_ADJ"),
                      H.load_geotiff(T.F240, (-span * 1000, -span * 1000, span * 1000, span * 1000), name="LDEM_60S_240MPP_ADJ")])
    h0 = dem.sample(X, Y) + mast
    dist = np.unique(np.concatenate([np.arange(80, 4000, 80), np.arange(4000, 20000, 200),
                                     np.geomspace(20000, max_km * 1000, 160)]))
    nt = int(round(days * 24 / step_h))
    times = ephem.TS.utc(start.year, start.month, start.day, start.hour + np.arange(nt) * step_h)
    vs, ve = ephem.body_vectors(times)
    sun = np.zeros((nt, n, n), np.uint8)
    earth = np.zeros((nt, n, n), np.uint8)
    for k in range(nt):
        t = time.time()
        el, dx, dy = target_dirs(X, Y, vs[:, k])
        r = np.degrees(np.arcsin(696000.0 / np.linalg.norm(vs[:, k])))
        if el.max() + r < -5:      # sun far below every horizon
            hz = np.full(X.shape, 0.0)
        else:
            hz = horizon_toward(dem, X, Y, h0, dx, dy, dist)
        sun[k] = np.round(np.clip((el - hz + r) / (2 * r), 0, 1) * 250).astype(np.uint8)
        el, dx, dy = target_dirs(X, Y, ve[:, k])
        hz = horizon_toward(dem, X, Y, h0, dx, dy, dist)
        earth[k] = (el > hz).astype(np.uint8)
        print(f"frame {k + 1}/{nt} {time.time() - t:.1f}s", flush=True)
    sun.tofile(f"{out_dir}/sun_uint8.bin")
    earth.tofile(f"{out_dir}/earth_bits.bin")
    np.round(dem.sample(X, Y)).astype(np.int16).tofile(f"{out_dir}/height_int16.bin")
    meta = {
        "description": __doc__,
        "grid": {"n": n, "half_km": half_km, "pixel_m": float(X[0, 1] - X[0, 0]),
                 "projection": "+proj=stere +lat_0=-90 +lon_0=0 +R=1737400 (metres); row 0 = +y (lon 0 at top), column 0 = -x",
                 "x0_m": float(X[0, 0]), "y0_m": float(Y[0, 0])},
        "times_utc": [(start + dt.timedelta(hours=k * step_h)).isoformat() + "Z" for k in range(nt)],
        "step_h": step_h, "observer_height_m": mast, "max_distance_km": max_km,
        "files": {"sun_uint8.bin": f"uint8, shape ({nt},{n},{n}), value/250 = visible fraction of the solar disc",
                  "earth_bits.bin": f"uint8, shape ({nt},{n},{n}), 1 = Earth centre above terrain horizon",
                  "height_int16.bin": f"int16, shape ({n},{n}), metres relative to 1737.4 km sphere"},
        "terrain": ["PGDA LOLA LDEM_80S_80MPP_ADJ (80 m)", "PGDA LOLA LDEM_60S_240MPP_ADJ (240 m, beyond 80S)"],
        "ephemeris": "JPL DE421 + IAU 2009 lunar rotation (see ephem.py)",
        "compute_s": round(time.time() - t_all, 1)}
    json.dump(meta, open(f"{out_dir}/meta.json", "w"), indent=1)
    return meta


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "frames"
    start = dt.datetime.fromisoformat(os.environ.get("START", "2027-12-01T00:00"))
    run(out, start, float(os.environ.get("DAYS", 30)), float(os.environ.get("STEP_H", 4)),
        n=int(os.environ.get("N", 500)), half_km=float(os.environ.get("HALF_KM", 100)))
