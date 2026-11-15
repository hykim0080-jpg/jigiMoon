# Relief shading for the Moon globe in 3D (map3d glow style), from the NASA SVS CGI Moon Kit elevation maps
# (https://svs.gsfc.nasa.gov/4720, LOLA): ldem_4.tif (float km, 4 px/deg) and ldem_16_uint.tif (0.5 m units, 16 px/deg).
# Lit like the terrain patch (map3d FRAG: light (-0.55, 0.55, 0.62) in map axes, 0.42 + 0.78 * amb, flat = 1).
# Usage: python3 build_moon_relief.py <dir with the two tifs> navigator   (writes data/moon_relief.jpg, data/moon_relief_pole.jpg)
import numpy as np, sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
SRC, NAV = sys.argv[1], sys.argv[2]
R = 1737.4
L = np.array([-0.55, 0.55, 0.62]); L /= np.linalg.norm(L)
shade = lambda amb: (0.42 + 0.78 * np.clip(amb, 0, 1.3)) / 0.81
save = lambda f, name: Image.fromarray(np.clip(f / 2 * 255, 0, 255).astype(np.uint8)).save(f'{NAV}/data/{name}', quality=88)

# whole globe, equirectangular like moon.jpg (row 0 = 90N, column 0 = 180W); light turned with longitude as on the polar map
z = np.array(Image.open(f'{SRC}/ldem_4.tif'), np.float64); H, W = z.shape; d = np.radians(0.25); k = 6.0
lat = np.radians(90 - (np.arange(H) + .5) * 0.25)[:, None]; lon = np.radians(-180 + (np.arange(W) + .5) * 0.25)[None, :]
zE = (np.roll(z, -1, 1) - np.roll(z, 1, 1)) / (2 * R * np.maximum(np.cos(lat), 0.02) * d)
zp = np.vstack([z[:1], z, z[-1:]]); zN = (zp[:-2] - zp[2:]) / (2 * R * d)
nx, ny = -k * zE, -k * zN; nl = np.sqrt(nx * nx + ny * ny + 1)
le = L[0] * np.cos(lon) - L[1] * np.sin(lon); ln = L[0] * np.sin(lon) + L[1] * np.cos(lon)
save(shade(0.5 + 1.15 * ((nx * le + ny * ln + L[2]) / nl - L[2])), 'moon_relief.jpg')

# around the south pole: stereographic +-700 km, 1024 px, row 0 = +y (lon 0, Earth side), x = rho sin(lon), y = rho cos(lon)
z = np.array(Image.open(f'{SRC}/ldem_16_uint.tif')).astype(np.float32) * 0.5 / 1000; H, W = z.shape
N, E, k = 1024, 700.0, 4.0; px = 2 * E / N; c = (np.arange(N) + .5) * px - E
X, Y = np.meshgrid(c, -c); rho = np.hypot(X, Y)
la = -90 + np.degrees(2 * np.arctan(rho / (2 * R))); lo = np.degrees(np.arctan2(X, Y))
row = np.clip((90 - la) * 16 - .5, 0, H - 1.001); col = ((lo + 180) * 16 - .5) % W
r0 = np.floor(row).astype(int); c0 = np.floor(col).astype(int); fr = row - r0; fc = col - c0; c1 = (c0 + 1) % W
h = (z[r0, c0] * (1 - fc) + z[r0, c1] * fc) * (1 - fr) + (z[r0 + 1, c0] * (1 - fc) + z[r0 + 1, c1] * fc) * fr
gx = np.gradient(h, axis=1) / px; gy = -np.gradient(h, axis=0) / px
nx, ny = -k * gx, -k * gy; nl = np.sqrt(nx * nx + ny * ny + 1)
save(shade(0.5 + 1.15 * ((nx * L[0] + ny * L[1] + L[2]) / nl - L[2])), 'moon_relief_pole.jpg')
