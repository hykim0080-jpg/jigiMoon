# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Per-pixel terrain horizon table for the south-pole layer maps (800x800 @500 m, +-200 km).
For each of NA map azimuths (clockwise from map +y), march LOLA terrain (80 m, 240 m beyond 80S) out to
150 km from every pixel (observer MAST m above ground, curvature included) and keep the max elevation angle.
Output: OUT/hz_<mast>m.npy int16 centidegrees, shape (NA, 800, 800). Same grid/terrain as lunar/frames2.py."""
import os, sys, time
import numpy as np
from multiprocessing import Pool
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import horizon as H, terrain as T

N, RES, HALF = 800, 500.0, 200000.0
NA = int(os.environ.get("NA", 720))
MAST = float(sys.argv[1]) if len(sys.argv) > 1 else 2.0
OUT = os.environ.get("OUT", os.path.expanduser("~/work"))
MAXKM = 150.0
xs = -HALF + RES / 2 + np.arange(N) * RES
X, Y = np.meshgrid(xs, xs[::-1])
span = HALF + MAXKM * 1000 + 10000
DEM = H.DEMStack([H.load_geotiff(T.F80, (-span, -span, span, span), name="80m"),
                  H.load_geotiff(T.F240, (-span, -span, span, span), name="240m")])
Z = DEM.sample(X, Y)
H0 = Z + MAST
DIST = np.unique(np.concatenate([np.arange(250, 4000, 125), np.arange(4000, 20000, 250),
                                 np.geomspace(20000, MAXKM * 1000, 160)]))


def one(k):
    a = np.radians(k * 360.0 / NA)
    dx, dy = np.sin(a), np.cos(a)
    best = np.full(X.shape, -90.0, np.float32)
    for d in DIST:
        h = DEM.sample(X + dx * d, Y + dy * d)
        ang = np.degrees(np.arctan2(h - H0 - d * d / (2 * H.R_M), d))
        np.fmax(best, ang, out=best)
    return k, np.round(best * 100).astype(np.int16)


if __name__ == "__main__":
    if os.environ.get("TEST"):
        t = time.time(); one(0); print("one azimuth", time.time() - t); sys.exit()
    os.makedirs(OUT, exist_ok=True)
    tab = np.zeros((NA, N, N), np.int16)
    t = time.time()
    with Pool(4) as p:
        for i, (k, v) in enumerate(p.imap_unordered(one, range(NA))):
            tab[k] = v
            if i % 20 == 0:
                print(MAST, i, round(time.time() - t), flush=True)
    np.save(f"{OUT}/hz_{MAST:g}m.npy", tab)
    np.save(f"{OUT}/height.npy", Z.astype(np.float32))
    print("done", MAST, round(time.time() - t), flush=True)
