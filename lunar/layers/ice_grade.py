# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
# Water-ice likelihood grade on the Find a site grid (800 x 800, 500 m, +-200 km, +proj=stere lat_0=-90 lon_0=0 R=1737400,
# row 0 = y +200 km). Combines two NASA datasets per 500 m cell:
#  * permanent shadow: PGDA LOLA 18.6-yr mean illumination (Mazarico et al. 2011), share of 60 m / 120 m pixels with 0 % sunlight
#  * ice stability: LRO Diviner South Polar Resource Product (Paige et al. 2010), per facet `ice_depth` = depth below which water
#    ice loses < 1 kg m^-2 per Gyr (0 = stable at the surface, -999 = deeper than 2.87 m or nowhere)
# Grade (byte), the Ice Stability Region classes VIPER used for site planning (depth at which ice is stable, Diviner PRP):
#   3 = surface (ice stable at the surface), 2 = shallow (stable within 0.5 m), 1 = deep (0.5-1 m), 0 = dry (> 1 m), 255 = no data
#   ice_depth -1 is not in the label; those facets have Tmax <= 101 K (colder than the 0 = surface-stable facets), so -1 is read as surface-stable.
#   A cell gets a class when >= 50 % of its Diviner facets are at least that good.
# Usage: python3 ice_grade.py dlre_prp_south.tab AVGVISIB_85S_060M_201608.TIF AVGVISIB_75S_120M_201608.TIF out_dir
import sys, json
import numpy as np, pandas as pd, rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling

tab, f85, f75, out = sys.argv[1:5]
N, RES, R = 800, 500.0, 200000.0
df = pd.read_csv(tab, skipinitialspace=True, usecols=['tri_clon', 'tri_clat', 'ice_depth'], dtype=np.float64)
lat, lon = np.radians(df.tri_clat.values), np.radians(df.tri_clon.values)
rho = 2 * 1737400.0 * np.tan((np.pi / 2 + lat) / 2)
x, y = rho * np.sin(lon), rho * np.cos(lon)
col, row = np.floor((x + R) / RES).astype(int), np.floor((R - y) / RES).astype(int)
ok = (col >= 0) & (col < N) & (row >= 0) & (row < N)
i, d = row[ok] * N + col[ok], df.ice_depth.values[ok]
n = np.bincount(i, minlength=N * N).astype(float)
surf = np.bincount(i, weights=(d == 0) | (d == -1), minlength=N * N) / np.maximum(n, 1)
shal = np.bincount(i, weights=(d > -999) & (d <= 0.5), minlength=N * N) / np.maximum(n, 1)
deep = np.bincount(i, weights=(d > -999) & (d <= 1.0), minlength=N * N) / np.maximum(n, 1)

def psr_frac(path):
    # share of each 500 m cell that is permanently shadowed (AVGVISIB == 0), area-averaged
    from rasterio.warp import reproject
    from rasterio.transform import from_origin
    dst_t = from_origin(-R, R, RES, RES)
    with rasterio.open(path) as s:
        a = s.read(1).astype(np.float32)
        m = np.where(a >= 0, (a == 0).astype(np.float32), np.nan)
        out = np.full((N, N), np.nan, np.float32)
        reproject(m, out, src_transform=s.transform, src_crs=s.crs, dst_transform=dst_t, dst_crs=s.crs,
                  src_nodata=np.nan, dst_nodata=np.nan, resampling=Resampling.average)
    return out
p85, p75 = psr_frac(f85), psr_frac(f75)
psr = np.where(np.isnan(p85), p75, p85).ravel()

g = np.zeros(N * N, np.uint8)
g[deep >= 0.5] = 1
g[shal >= 0.5] = 2
g[surf >= 0.5] = 3
g[n == 0] = 255
inpsr = {k: round(float(np.nanmean(psr[g == k] >= 0.5)) * 100, 1) if (g == k).any() else None for k in (0, 1, 2, 3)}
open(f"{out}/ice_grade.wasm", "wb").write(g.tobytes())
cnt = {int(k): int((g == k).sum()) for k in (0, 1, 2, 3, 255)}
json.dump({"grid": "800x800, 500 m, +-200 km, row 0 = +y", "values": {"3": "surface: ice stable at the surface", "2": "shallow: ice stable within 0.5 m",
           "1": "deep: ice stable at 0.5-1 m", "0": "dry: no ice stable within 1 m", "255": "no data"},
           "rule": "Diviner PRP ice_depth per facet; a 500 m cell takes a class when >= 50 % of its facets reach it. Classes follow the VIPER Ice Stability Regions.",
           "share_in_permanent_shadow_pct": inpsr,
           "cells": cnt, "area_km2": {k: v * 0.25 for k, v in cnt.items()},
           "sources": ["LRO Diviner South Polar Resource Product, Paige et al. 2010 Science 330:479, https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/",
                       "PGDA Lunar Polar Illumination AVGVISIB_85S_060M / 75S_120M, Mazarico et al. 2011 Icarus 211:1066, https://pgda.gsfc.nasa.gov/products/69"]},
          open(f"{out}/ice_grade.json", "w"), indent=1)
print(cnt)
