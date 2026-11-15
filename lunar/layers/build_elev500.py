"""500 m elevation grid of the +-200 km south-pole map for the web tool (navigator/layers/data/elev500.png).

Source: LOLA LDEM_80S_40MPP_ADJ (NASA GSFC PGDA, https://pgda.gsfc.nasa.gov/products/90), averaged to 500 m.
Encoding: v = round((z_m + 8000) * 4), R = v >> 8, G = v & 255 (0.25 m steps); row 0 = map top (y = +200 km).
Used to find the ridge that hides the Sun or Earth from a clicked spot (navigator/layers/js/sightlines.js).
"""
import sys
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else "LDEM_80S_40MPP_ADJ.TIF"
out = sys.argv[2] if len(sys.argv) > 2 else "elev500.png"
with rasterio.open(src) as d:
    z = d.read(1, window=from_bounds(-200000, -200000, 200000, 200000, d.transform),
               out_shape=(800, 800), resampling=Resampling.average).astype(np.float64)
v = np.clip(np.round((z + 8000) * 4), 0, 65535).astype(np.uint32)
img = np.zeros((800, 800, 3), np.uint8)
img[..., 0] = v >> 8
img[..., 1] = v & 255
Image.fromarray(img).save(out, optimize=True)
