"""linemap/l20/{c}_{r}.webp: thin-line contour tiles from PGDA LOLA LDEM_80S_20MPP_ADJ (20 m), same grid as navigator/data/t20:
5 km tiles, 80 x 80 over +-200 km, c = floor((x_km+200)/5), r = floor((200-y_km)/5), 500 px per tile (10 m/px).
Contours every 25 m (thin, light grey), every 100 m (thicker, dark grey); white background; WebP q40.
Run: python3 build_l20.py ~/data/dem/LDEM_80S_20MPP_ADJ.TIF l20 [rows e.g. 30-50]  (one tile row per task, 4 processes)"""
import sys, os
import numpy as np, rasterio
from rasterio.windows import from_bounds
from scipy.ndimage import gaussian_filter
from skimage import measure
from PIL import Image, ImageDraw
from multiprocessing import Pool

SRC, OUT = sys.argv[1], sys.argv[2]
R, TK, RES, TP = 200000, 5000, 20.0, 500        # extent, tile km in m, DEM res, tile px
N = int(2 * R / TK); PX = TP / TK                # 80 tiles; px per metre = 0.1
M = 20                                           # DEM margin pixels (400 m) so lines cross tile edges cleanly
SS = 2                                           # supersampling

def row(r):
    top = R - r * TK
    with rasterio.open(SRC) as s:
        z = s.read(1, window=from_bounds(-R - M * RES, top - TK - M * RES, R + M * RES, top + M * RES, s.transform)).astype(np.float32)
    z = gaussian_filter(z, 1.0)                  # 20 m smoothing against pixel stair-steps
    W, H = N * TP * SS, TP * SS
    im = Image.new("L", (W, H), 255); d = ImageDraw.Draw(im)
    k = RES * PX * SS                            # DEM px -> output px
    lo, hi = np.floor(np.nanmin(z) / 25) * 25, np.ceil(np.nanmax(z) / 25) * 25
    for major in (False, True):                  # majors drawn on top
        for lev in np.arange(lo, hi + 1, 25):
            if (lev % 100 == 0) != major: continue
            for c in measure.find_contours(z, lev):
                if len(c) < 4: continue
                c = measure.approximate_polygon(c, 0.3)
                pts = [((p[1] - M) * k, (p[0] - M) * k) for p in c]
                d.line(pts, fill=70 if major else 175, width=(3 if major else 2) if SS == 2 else 1, joint="curve")
    im = im.resize((N * TP, TP), Image.LANCZOS)
    for c in range(N):
        im.crop((c * TP, 0, (c + 1) * TP, TP)).save(f"{OUT}/{c}_{r}.webp", quality=40, method=4)
    return r

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    rows = range(N)
    if len(sys.argv) > 3:
        a, b = map(int, sys.argv[3].split("-")); rows = range(a, b + 1)
    with Pool(4) as p:
        for r in p.imap_unordered(row, rows): print("row", r, flush=True)
