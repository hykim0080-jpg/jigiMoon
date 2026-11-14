"""Decision-factor layers of the lunar south pole (800x800 @500 m, +-200 km, polar stereographic).
Uses the per-pixel horizon tables from hz_table.py and JPL DE421 Sun/Earth vectors, 2027-01-01..2028-01-15
every 2 h. Same definitions as lunar/prescribe.py (sun = visible disc fraction, dark < 0.1,
both = sun > 0.5 and Earth centre visible). Writes OUT/<id>.bin (uint8, 255 = no data), layers.json,
hillshade.png. Slope from LOLA 80 m (median of 5x5 sub-samples per pixel)."""
import datetime as dt, json, os, sys, time
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import ephem, horizon as H, terrain as T

WORK = os.environ.get("WORK", os.path.expanduser("~/work"))
OUT = os.environ.get("OUT", os.path.join(HERE, "data"))
N, RES, HALF = 800, 500.0, 200000.0
STEP_H, DAYS_TOTAL, CAL = 2.0, 379, 365
CRIT = {"min_sun_pct": 70, "max_dark_h": 50, "min_earth_pct": 50, "max_slope_deg": 8}
xs = -HALF + RES / 2 + np.arange(N) * RES
X, Y = np.meshgrid(xs, xs[::-1])
P = N * N
NT = int(DAYS_TOTAL * 24 / STEP_H)
times = ephem.TS.utc(2027, 1, 1, np.arange(NT) * STEP_H)
VS, VE = ephem.body_vectors(times)
_lat, _lon = H.xy_to_ll(X.ravel(), Y.ravel())
_la, _lo = np.deg2rad(_lat), np.deg2rad(_lon)
UP = np.stack([np.cos(_la) * np.cos(_lo), np.cos(_la) * np.sin(_lo), np.sin(_la)])
SITE = UP * ephem.R_MOON_KM
EAST = np.stack([-np.sin(_lo), np.cos(_lo), np.zeros_like(_lo)])
NORTH = np.cross(UP, EAST, axis=0)
NM, EM = (np.sin(_lo), np.cos(_lo)), (np.cos(_lo), -np.sin(_lo))


def target_dirs(vec):
    """Same as frames.target_dirs, flattened, with the per-pixel axes precomputed. Returns el (deg), map azimuth (deg)."""
    rel = vec[:, None] - SITE
    u = rel / np.linalg.norm(rel, axis=0)
    el = np.degrees(np.arcsin(np.clip((u * UP).sum(0), -1, 1)))
    az = np.arctan2((u * EAST).sum(0), (u * NORTH).sum(0))
    ca, sa = np.cos(az), np.sin(az)
    dx = ca * NM[0] + sa * EM[0]
    dy = ca * NM[1] + sa * EM[1]
    return el, np.degrees(np.arctan2(dx, dy)) % 360


def series(tab, stride=1):
    """frac uint8 (NT,P) sun disc fraction*250, earth bool (NT,P)."""
    na = tab.shape[0]
    tf = tab.reshape(na, -1)
    ar = np.arange(P)
    ks = range(0, NT, stride)
    sun = np.zeros((len(ks), P), np.uint8)
    ear = np.zeros((len(ks), P), bool)
    t = time.time()
    for j, k in enumerate(ks):
        for vec, is_sun in ((VS[:, k], True), (VE[:, k], False)):
            el, a = target_dirs(vec)
            a = a * na / 360.0
            i0 = np.floor(a).astype(np.int32) % na
            w = (a - np.floor(a)).astype(np.float32)
            hz = (tf[i0, ar] * (1 - w) + tf[(i0 + 1) % na, ar] * w) / 100.0
            if is_sun:
                r = np.degrees(np.arcsin(696000.0 / np.linalg.norm(vec)))
                sun[j] = np.round(np.clip((el - hz + r) / (2 * r), 0, 1) * 250)
            else:
                ear[j] = el > hz
        if k % 500 == 0:
            print("series", k, NT, round(time.time() - t), flush=True)
    return sun, ear


def window_stats(sun, ear, mdays):
    """Per landing day d (0..364): sun%, earth%, longest dark h for a mission of mdays."""
    spd = int(24 / STEP_H)
    L = mdays * spd
    def pct(arr, scale):
        cs = np.zeros((DAYS_TOTAL + 1, P), np.float32)
        for d in range(DAYS_TOTAL):          # daily sums, accumulated in place (memory)
            cs[d + 1] = cs[d] + arr[d * spd:(d + 1) * spd].sum(0, dtype=np.float32) / scale
        out = (cs[mdays:mdays + CAL] - cs[:CAL]) / L * 100
        del cs
        return out
    sp = pct(sun, 250.0)
    ep = pct(ear, 1.0)
    ld = np.zeros((CAL, P), np.uint16)
    t = time.time()
    for d in range(CAL):
        cur = np.zeros(P, np.uint16); mx = np.zeros(P, np.uint16)
        for k in range(d * spd, d * spd + L):
            cur += 1; cur *= sun[k] < 25;  # frac < 0.1
            np.maximum(mx, cur, out=mx)
        ld[d] = mx
        if d % 60 == 0:
            print("window", mdays, d, round(time.time() - t), flush=True)
    ld *= int(STEP_H)
    return sp, ep, ld


def enc(v, lo, hi, nodata=None):
    q = np.round((np.asarray(v, np.float64) - lo) / (hi - lo) * 250)
    q = np.clip(q, 0, 250).astype(np.uint8)
    if nodata is not None:
        q[nodata] = 255
    return q.reshape(N, N)


def slope_layer():
    span = HALF + 2000
    dem = H.load_geotiff(T.F80, (-span, -span, span, span), name="80m")
    z = dem.z.astype(np.float64)
    gy, gx = np.gradient(z, dem.res)
    s = H.DEM(np.degrees(np.arctan(np.hypot(gx, gy))).astype(np.float32), dem.res, dem.x0, dem.y0)
    off = (np.arange(5) - 2) * 100.0
    sub = [s.sample(X + ox, Y + oy) for ox in off for oy in off]
    return np.nanmedian(np.stack(sub), 0)


def hillshade(z, exag=3.0):
    gr, gc = np.gradient(z, RES)
    gx, gy = gc * exag, -gr * exag          # row 0 = +y
    az, alt = np.radians(315), np.radians(35)   # light from map NW (az clockwise from +y)
    L = np.array([np.cos(alt) * np.sin(az), np.cos(alt) * np.cos(az), np.sin(alt)])
    hs = (-gx * L[0] - gy * L[1] + L[2]) / np.sqrt(gx * gx + gy * gy + 1)
    return np.clip(hs * 255, 0, 255).astype(np.uint8)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    t0 = time.time()
    layers, vals = [], {}
    Z = np.load(f"{WORK}/height.npy")
    Image.fromarray(hillshade(Z), "L").save(f"{OUT}/hillshade.png", optimize=True)
    zz = np.where(np.isfinite(Z), Z, np.nanmean(Z)).astype("<f4"); zz.tofile(f"{OUT}/height.bin")

    sl = slope_layer(); vals["slope"] = sl.ravel()
    print("slope done", round(time.time() - t0), flush=True)

    means = {}
    for mast in (2, 10, 20):
        f = f"{WORK}/hz_{mast}m.npy"
        if not os.path.exists(f):
            print("missing", f); continue
        stride = 1 if mast == 2 else 3
        tab = np.load(f)
        sun, ear = series(tab, stride)
        del tab
        n = CAL * int(24 / STEP_H) // stride
        means[mast] = (sun[:n].mean(0, dtype=np.float32) / 2.5, ear[:n].mean(0, dtype=np.float32) * 100)
        if mast == 2:
            vals["sun"], vals["earth"] = means[2]
            acc = np.zeros(P, np.float32)
            for k0 in range(0, n, 200):
                acc += ((sun[k0:min(n, k0 + 200)] > 125) & ear[k0:min(n, k0 + 200)]).sum(0)
            vals["both"] = acc / n * 100
            vals["psr"] = (sun[:n].max(0) == 0).astype(np.float32)
            for md in (14, 6):
                sp, ep, ld = window_stats(sun, ear, md)
                ok = (sp >= CRIT["min_sun_pct"]) & (ld <= CRIT["max_dark_h"]) & (ep >= CRIT["min_earth_pct"])
                vals[f"days{md}"] = ok.sum(0).astype(np.float32)
                vals[f"dark{md}"] = np.median(ld, 0).astype(np.float32)
                np.save(f"{WORK}/ok{md}.npy", np.packbits(ok, axis=0))
                del sp, ep, ld, ok
        del sun, ear
        print("mast", mast, "done", round(time.time() - t0), flush=True)

    mast = np.full(P, 255.0, np.float32)
    for m in sorted(means, reverse=True):
        s, e = means[m]
        mast[(s >= CRIT["min_sun_pct"]) & (e >= CRIT["min_earth_pct"])] = m
    vals["mast"] = mast

    nod_slope = ~np.isfinite(vals["slope"])
    spec = [  # id, name_ko, unit, lo, hi, threshold, direction, weight
        ("sun", "햇빛", "%", 0, 100, CRIT["min_sun_pct"], ">=", 3),
        ("earth", "지구", "%", 0, 100, CRIT["min_earth_pct"], ">=", 3),
        ("both", "햇빛+지구", "%", 0, 100, None, ">=", 0),
        ("dark14", "최장 어둠", "h", 0, 336, CRIT["max_dark_h"], "<=", 2),
        ("dark6", "최장 어둠 (6일)", "h", 0, 144, CRIT["max_dark_h"], "<=", 0),
        ("slope", "경사", "°", 0, 40, CRIT["max_slope_deg"], "<=", 2),
        ("mast", "마스트", "m", 0, 25, 20, "<=", 1),
        ("days14", "가능 착륙일", "일", 0, 365, None, ">=", 0),
        ("days6", "가능 착륙일 (6일)", "일", 0, 365, None, ">=", 0),
        ("psr", "영구 그늘", "", 0, 1, None, ">=", 0),
    ]
    for lid, name, unit, lo, hi, thr, dirn, w in spec:
        if lid not in vals:
            continue
        v = vals[lid]
        nod = nod_slope if lid == "slope" else (v == 255 if lid == "mast" else None)
        enc(v, lo, hi, nod).tofile(f"{OUT}/{lid}.bin")
        layers.append({"id": lid, "name": name, "unit": unit, "min": lo, "max": hi, "threshold": thr,
                       "direction": dirn, "weight": w, "nodata": 255,
                       **({"over_255": "> 20 m (fails)"} if lid == "mast" else {})})
    meta = {"grid": {"nx": N, "ny": N, "res_m": RES, "x_min": float(xs[0]), "x_max": float(xs[-1]),
                     "y_min": float(xs[0]), "y_max": float(xs[-1]), "row0": "max_y",
                     "projection": "+proj=stere +lat_0=-90 +lon_0=0 +R=1737400; x = rho sin(lon), y = rho cos(lon); pixel centres"},
            "encoding": "uint8 v -> min + v*(max-min)/250; 255 = no data (mast: higher than 20 m)",
            "period_utc": ["2027-01-01", "2027-12-31"], "step_h": STEP_H, "observer_m": 2,
            "criteria": CRIT, "masts_m": sorted(means),
            "definitions": {
                "sun": "2027 mean visible fraction of the solar disc, observer 2 m",
                "earth": "2027 mean fraction of time the Earth centre is above the terrain horizon",
                "both": "2027 fraction of time with sun > 50% of disc and Earth visible",
                "dark14": "median over 2027 landing days of the longest continuous darkness (sun < 10% of disc) in a 14-day mission",
                "dark6": "same for a 6-day mission (Artemis III surface stay)",
                "slope": "median slope of LOLA 80 m DEM over 25 sub-samples (100 m apart) of the 500 m pixel",
                "mast": "lowest mast of 2/10/20 m at which 2027 mean sun >= 70% and Earth >= 50%; 255 = needs more than 20 m",
                "days14": "number of 2027 landing days on which a 14-day mission meets sun >= 70%, longest dark <= 50 h, Earth >= 50% (2 m)",
                "days6": "same for a 6-day mission",
                "psr": "1 = never sunlit (disc fraction 0) at any 2 h step of 2027 (proxy for permanent shadow at 500 m)"},
            "method": "per pixel horizon table (1 deg azimuth, LOLA 80 m DEM + 240 m beyond 80S, out to 150 km, curvature) interpolated at the Sun/Earth azimuth each 2 h; Sun/Earth from JPL DE421 + IAU 2009 lunar rotation",
            "sources": ["NASA GSFC PGDA LOLA LDEM_80S_80MPP_ADJ, LDEM_60S_240MPP_ADJ (https://pgda.gsfc.nasa.gov/products/90), public domain",
                        "JPL DE421 via skyfield-data (public domain); skyfield (MIT)"],
            "layers": layers, "compute_s": round(time.time() - t0)}
    json.dump(meta, open(f"{OUT}/layers.json", "w"), indent=1, ensure_ascii=False)
    print("all done", round(time.time() - t0), flush=True)
