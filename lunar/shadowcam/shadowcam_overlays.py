# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
# Turns public KPLO ShadowCam controlled mosaics (20 m Cloud Optimized GeoTIFF, PDS) into web overlays: real images of the inside of
# permanently shadowed craters. The mosaics are already in our projection (+proj=stere +lat_0=-90 +lon_0=0 +R=1737400), so only a
# contrast stretch (1-99.5 percentile) and a size cap are applied. No-data becomes transparent.
# ShadowCam-only mosaics saturate on sunlit ground, so they are cut to permanent shadow (PGDA AVGVISIB_85S_060M = 0);
# the ShadowCam + LRO NAC mosaics are already blended by the archive and are kept whole.
# Usage: python3 shadowcam_overlays.py out_dir AVGVISIB_85S_060M_201608.TIF mosaic1.tif [mosaic2.tif ...]
import sys, os, json, re
import numpy as np, rasterio
from rasterio.enums import Resampling
from PIL import Image
out, psrf, files = sys.argv[1], sys.argv[2], sys.argv[3:]
from rasterio.warp import reproject
os.makedirs(out, exist_ok=True)
BASE = "https://pds.shadowcam.im-ldi.com/derived/"
CAP, R = 2048, 200000.0
items = []
for f in sorted(files):
    name = os.path.basename(f)
    m = re.match(r"shadowcam_(lronac_cmosaic|cmosaic)_(.+?)_p(\d{3})([ns])(\d{4})(?:_([a-z]+)_(\d{2}[ap]m))?_20m_cog\.tif", name)
    kind, mid, season, local = m.group(1), m.group(2), m.group(6), m.group(7)
    with rasterio.open(f) as s:
        k = max(1, int(np.ceil(max(s.width, s.height) / CAP)))
        h, w = s.height // k, s.width // k
        a = s.read(1, out_shape=(h, w), resampling=Resampling.average if k > 1 else Resampling.nearest).astype(np.float64)
        b = s.bounds
        nd = s.nodata
        tr, crs = s.transform * s.transform.scale(s.width / w, s.height / h), s.crs
    psr = np.ones((h, w), np.float32)
    if kind == "cmosaic":
        with rasterio.open(psrf) as p:
            pm = (p.read(1) == 0).astype(np.float32)
            psr[:] = 0
            reproject(pm, psr, src_transform=p.transform, src_crs=p.crs, dst_transform=tr, dst_crs=crs, resampling=Resampling.bilinear)
    valid = np.isfinite(a) & (a > -1e30) & (a != nd) & (a > 0)
    sel = valid & (psr >= 0.5)
    lo, hi = np.percentile(a[sel if sel.sum() > 1000 else valid], [1, 99.5])
    g = np.clip((a - lo) / (hi - lo), 0, 1) ** (1 / 1.6)   # mild gamma so the dark floor stays readable
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = (g * 255).astype(np.uint8)
    valid &= a > lo   # drop the darkest 1 % (unlit gaps between strips)
    rgba[..., 3] = (valid * np.clip((psr - 0.3) / 0.4, 0, 1) * 255).astype(np.uint8)   # soft 0.3-0.7 edge
    fn = f"{mid}{'_nac' if kind == 'lronac_cmosaic' else ''}.webp"
    Image.fromarray(rgba, "RGBA").save(f"{out}/{fn}", quality=70, method=6, exact=False)
    # bounds in metres, x right / y up (y up = Earth side); trimmed to our +-200 km window is left to the client
    inside = b.right > -R and b.left < R and b.top > -R and b.bottom < R
    items.append({"id": mid + ("_nac" if kind == "lronac_cmosaic" else ""), "file": fn, "px": [w, h], "m_per_px": round((b.right - b.left) / w, 2),
                  "bounds_m": [round(b.left), round(b.bottom), round(b.right), round(b.top)], "in_window": bool(inside),
                  "product": "ShadowCam controlled mosaic" if kind == "cmosaic" else "ShadowCam + LRO NAC controlled mosaic",
                  "season": season, "local_time": local,
                  "source": f"{BASE}{'cmosaic' if kind == 'cmosaic' else 'lronac_cmosaic'}/{m.group(2)}/{name}"})
    print(fn, w, h, os.path.getsize(f"{out}/{fn}") // 1024, "KB")
json.dump({"projection": "+proj=stere +lat_0=-90 +lon_0=0 +R=1737400 (same as all Navigator layers)",
           "bounds_m": "[x_min, y_min, x_max, y_max]; +y = Earth side (map up)",
           "credit": "KPLO ShadowCam (NASA instrument on KARI's Korea Pathfinder Lunar Orbiter; Malin Space Science Systems / Arizona State University). NAC mosaics also use LRO LROC NAC (NASA/GSFC/ASU).",
           "license": "NASA-funded PDS data, no U.S. copyright restriction; credit as above",
           "archive": BASE, "items": items}, open(f"{out}/shadowcam.json", "w"), indent=1)
