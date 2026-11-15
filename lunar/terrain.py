# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Build the terrain stack (5 m site tile -> 20 m -> 80 m -> 240 m) around a site, plus slope.

All inputs are PGDA LOLA products (NASA GSFC, public domain):
- 5 m site tiles  : https://pgda.gsfc.nasa.gov/products/78  (data/LOLA_5mpp/<Site>/<Site>_final_adj_5mpp_surf.tif, _slp.tif)
- 20 m 80S-90S    : https://pgda.gsfc.nasa.gov/products/90  (data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF, LDSM_80S_20MPP_ADJ.TIF), read by window
- 80 m 80S-90S    : products/90 LDEM_80S_80MPP_ADJ.TIF (downloaded whole)
- 240 m 60S-90S   : products/90 LDEM_60S_240MPP_ADJ.TIF (downloaded whole; only for horizon samples beyond 80S)
"""
import glob
import os
import numpy as np
import rasterio
import horizon as H

DATA = os.environ.get("LUNAR_DATA", os.path.expanduser("~/data"))
TILES = os.path.join(DATA, "tiles")
CACHE = os.path.join(DATA, "cache")
URL20 = "/vsicurl/https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF"
URL20S = "/vsicurl/https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDSM_80S_20MPP_ADJ.TIF"
F80 = os.path.join(DATA, "dem", "LDEM_80S_80MPP_ADJ.TIF")
F240 = os.path.join(DATA, "dem", "LDEM_60S_240MPP_ADJ.TIF")


def tile_index():
    out = []
    for f in sorted(glob.glob(os.path.join(TILES, "*_final_adj_5mpp_surf.tif"))):
        try:
            with rasterio.open(f) as s:
                b = s.bounds
            out.append((os.path.basename(f).split("_final")[0], f, (b.left, b.bottom, b.right, b.top)))
        except Exception:
            pass
    return out


def find_tile(x, y, margin=3500.0):
    """Tile containing (x,y) with the largest distance to its edge (must be >= margin if possible)."""
    best = None
    for name, f, (x1, y1, x2, y2) in tile_index():
        m = min(x - x1, x2 - x, y - y1, y2 - y)
        if m > 0 and (best is None or m > best[0]):
            best = (m, name, f)
    if best is None:
        return None
    return best[1], best[2], best[0]


def _cached(key, fn):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, key + ".npz")
    if os.path.exists(p):
        d = np.load(p)
        return H.DEM(d["z"], float(d["res"]), float(d["x0"]), float(d["y0"]), str(d["name"]))
    dem = fn()
    np.savez_compressed(p, z=dem.z, res=dem.res, x0=dem.x0, y0=dem.y0, name=dem.name)
    return dem


def _box(x, y, half):
    return (x - half, y - half, x + half, y + half)


def build_stack(x, y, near_half_km=25.0, far_half_km=170.0):
    tile = find_tile(x, y)
    dems = []
    if tile:
        dems.append(H.load_geotiff(tile[1], name=f"PGDA LOLA 5 m {tile[0]}"))
    key = f"ldem20_{int(round(x / 1000))}_{int(round(y / 1000))}_{int(near_half_km)}"
    dems.append(_cached(key, lambda: H.load_geotiff(URL20, _box(x, y, near_half_km * 1000),
                                                    name="PGDA LOLA LDEM_80S_20MPP_ADJ")))
    dems.append(H.load_geotiff(F80, _box(x, y, far_half_km * 1000), name="PGDA LOLA LDEM_80S_80MPP_ADJ"))
    dems.append(H.load_geotiff(F240, _box(x, y, far_half_km * 1000), name="PGDA LOLA LDEM_60S_240MPP_ADJ"))
    return H.DEMStack(dems), (tile[0] if tile else None)


def slope_stack(x, y, half_km=6.0):
    tile = find_tile(x, y)
    dems = []
    if tile:
        dems.append(H.load_geotiff(tile[1].replace("_surf.tif", "_slp.tif"), name=f"PGDA 5 m slope {tile[0]}"))
    key = f"ldsm20_{int(round(x / 1000))}_{int(round(y / 1000))}_{int(half_km)}"
    dems.append(_cached(key, lambda: H.load_geotiff(URL20S, _box(x, y, half_km * 1000),
                                                    name="PGDA LOLA LDSM_80S_20MPP_ADJ")))
    return H.DEMStack(dems)


def landing_slope(slp, x, y, radius=15.0):
    """Max slope (deg) at the point and 8 neighbours `radius` m away (a ~30 m pad)."""
    off = np.array([-radius, 0, radius])
    X, Y = np.meshgrid(x + off, y + off)
    v = slp.sample(X.ravel(), Y.ravel())
    return float(np.nanmax(v)) if np.isfinite(v).any() else None
