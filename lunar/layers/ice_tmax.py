# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
# Ice layer for Find a site: LRO Diviner South Polar Resource Product (annual max surface temperature per facet,
# Paige et al. 2010) averaged into our 800 x 800 polar stereographic 500 m grid. Output bytes = K (0-250), 255 = no data.
# Input: https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab (605 MB)
# Usage: python3 ice_tmax.py dlre_prp_south.tab ../../navigator/layers/data/ice_tmax.wasm
import sys
import numpy as np, pandas as pd

df = pd.read_csv(sys.argv[1], skipinitialspace=True, usecols=['tri_clon', 'tri_clat', 'temp_max'], dtype=np.float64)
R = 1737400.0
lat, lon = np.radians(df.tri_clat.values), np.radians(df.tri_clon.values)
rho = 2 * R * np.tan((np.pi / 2 + lat) / 2)          # +proj=stere lat_0=-90 lon_0=0 R=1737400 (same as the LOLA grids)
x, y = rho * np.sin(lon), rho * np.cos(lon)
col, row = np.floor((x + 200000) / 500).astype(int), np.floor((200000 - y) / 500).astype(int)
ok = (col >= 0) & (col < 800) & (row >= 0) & (row < 800) & (df.temp_max.values > 0)
i = row[ok] * 800 + col[ok]
s, n = np.bincount(i, weights=df.temp_max.values[ok], minlength=640000), np.bincount(i, minlength=640000)
g = np.where(n > 0, s / np.maximum(n, 1), np.nan).reshape(800, 800)
for _ in range(3):   # the few empty cells: mean of the 4 neighbours
    m = np.isnan(g)
    if not m.any(): break
    p = np.pad(g, 1, constant_values=np.nan)
    g = np.where(m, np.nanmean(np.stack([p[1:-1, :-2], p[1:-1, 2:], p[:-2, 1:-1], p[2:, 1:-1]]), axis=0), g)
b = np.clip(np.round(g), 0, 250).astype(np.uint8); b[np.isnan(g)] = 255
open(sys.argv[2], 'wb').write(b.tobytes())
print('cells <= 110 K:', int((b <= 110).sum()))
