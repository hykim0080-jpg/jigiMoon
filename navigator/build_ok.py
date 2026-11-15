# Per-cell GO calendars (365 landing days) for Detail 3D, same test as layers/js/winworker.js, hourly, exact elevation.
# Usage: python3 build_ok.py navigator <out dir>  (about 10 min), then build_ok_win.py; copy ok*s90_*.wasm to navigator/layers/data/
import numpy as np, json, sys, time
from PIL import Image
NAV = sys.argv[1]; OUT = sys.argv[2]
N = 800; NPX = N * N; NAZ = 64; R = 1737400.0; D2R = np.pi / 180
hor = np.zeros((NAZ, NPX), np.uint8)
for k in range((NAZ + 2) // 3):
    px = np.asarray(Image.open(f'{NAV}/data/horizon/h_{k:02d}.png').convert('RGB')).reshape(NPX, 3)
    for b in range(3):
        if 3 * k + b < NAZ: hor[3 * k + b] = px[:, b]
slope = np.fromfile(f'{NAV}/layers/data/slope.wasm', np.uint8)
cells = np.nonzero(slope <= 50)[0].astype(np.int64); K = cells.size
hk = hor[:, cells].astype(np.float32) / 10 - 5   # (64, K) horizon elevation deg
r_, q_ = cells // N, cells % N
x = -199750 + q_ * 500.0; y = 199750 - r_ * 500.0
L = np.arctan2(x, y); phi = -np.pi / 2 + 2 * np.arctan(np.hypot(x, y) / (2 * R))
c1, s1, c2, s2, Ld = np.cos(L), np.sin(L), np.cos(phi), np.sin(phi), L / D2R
sky = json.load(open(f'{NAV}/data/sky/malapert-massif.json')); nH = sky['hours']
def latlon(xx, yy): return (-np.pi / 2 + 2 * np.arctan(np.hypot(xx, yy) / (2 * R))) / D2R, np.arctan2(xx, yy) / D2R
lat, lon = latlon(-7290, 122530)
def bodydir(az, el):
    p, l, a, e = lat * D2R, lon * D2R, np.asarray(az) * D2R, np.asarray(el) * D2R
    up = np.array([np.cos(p) * np.cos(l), np.cos(p) * np.sin(l), np.sin(p)]); east = np.array([-np.sin(l), np.cos(l), 0])
    north = np.array([-np.sin(p) * np.cos(l), -np.sin(p) * np.sin(l), np.cos(p)])
    return (np.cos(e)[:, None] * (np.cos(a)[:, None] * north + np.sin(a)[:, None] * east) + np.sin(e)[:, None] * up)
S = bodydir(sky['sun_az'], sky['sun_el']); E = bodydir(sky['earth_az'], sky['earth_el'])
ar = np.arange(K)
def horat(az):
    a = np.mod(az / (360 / NAZ), NAZ); k = a.astype(np.int64); f = a - k
    return hk[k, ar] + (hk[(k + 1) % NAZ, ar] - hk[k, ar]) * f
def look(V):
    h = c1 * V[0] + s1 * V[1]; up = c2 * h + s2 * V[2]
    el = np.degrees(np.arcsin(np.clip(up, -1, 1))); az = np.degrees(np.arctan2(-s1 * V[0] + c1 * V[1], -s2 * h + c2 * V[2])) + Ld
    return up, el, horat(az)
ND = nH // 24 + 1
sunD = np.zeros((ND, K), np.float32); earD = np.zeros((ND, K), np.uint8)
g0 = np.zeros((ND, K), np.uint8); g1 = np.zeros((ND, K), np.uint8)   # starts of 51 h dark runs: hours 0-21 / 22-23 of each day
run = np.zeros(K, np.int32); t0 = time.time()
for hh in range(nH):
    up, el, ho = look(S[hh]); f = np.where(up > -0.0875, np.clip((el - ho) / 0.53 + 0.5, 0, 1), 0)
    sunD[hh // 24] += f
    up, el, ho = look(E[hh]); earD[hh // 24] += ((up > -0.0875) & (el > ho)).astype(np.uint8)
    run = np.where(f < 0.1, run + 1, 0)
    st = hh - 50
    if st >= 0:
        (g0 if st % 24 < 22 else g1)[st // 24] += (run >= 51).astype(np.uint8)
    if hh % 500 == 0: print(hh, round(time.time() - t0), flush=True)
np.savez(f'{OUT}/acc.npz', sunD=sunD, earD=earD, g0=g0, g1=g1, cells=cells)
print('done', round(time.time() - t0), flush=True)
