# Step 2 of build_ok.py: per-day GO calendars from acc.npz. Usage: python3 build_ok_win.py <dir with acc.npz> navigator
import numpy as np, sys
OUT, NAV = sys.argv[1], sys.argv[2]
a = np.load(f'{OUT}/acc.npz'); sunD, earD, g0, g1, cells = a['sunD'].astype(np.float64), a['earD'].astype(np.int32), a['g0'].astype(np.int32), a['g1'].astype(np.int32), a['cells']
cs = lambda X: np.vstack([np.zeros((1, X.shape[1]), X.dtype), np.cumsum(X, 0)])
CS, CE, CG = cs(sunD), cs(earD), cs(g0 + g1)
def ok(m, sun, earth=50, dark=50):
    assert dark == 50
    out = np.zeros((365, cells.size), bool); n = 24 * m
    for d in range(365):
        su = (CS[d + m] - CS[d]) / n; ea = (CE[d + m] - CE[d]) / n
        gd = (CG[d + m - 3] - CG[d]) + g0[d + m - 3]
        out[d] = (np.floor(200 * su + 1e-6) >= 2 * sun) & (np.floor(200 * ea + 1e-6) >= 2 * earth) & (gd == 0)
    return out
def write(o, name):
    keep = o.any(0); idx = cells[keep].astype(np.uint32); bits = np.packbits(o[:, keep].T, axis=1)   # (n, 46): byte=day>>3, bit 7-(day&7)
    bits = np.pad(bits, ((0, 0), (0, 46 - bits.shape[1])))
    idx.tofile(f'{OUT}/{name}_idx.wasm'); bits.astype(np.uint8).tofile(f'{OUT}/{name}_bits.wasm'); print(name, idx.size, o.sum())
# check against the shipped 14-day / 70 % calendar
o70 = ok(14, 70)
ref_idx = np.fromfile(f'{NAV}/layers/data/ok14_idx.wasm', np.uint32); ref_bits = np.fromfile(f'{NAV}/layers/data/ok14_bits.wasm', np.uint8).reshape(-1, 46)
ref = np.zeros((365, 640000), bool); ref[:, ref_idx] = np.unpackbits(ref_bits, axis=1)[:, :365].T
r = ref[:, cells]; print('check 14d/70: agree', (r == o70).mean(), 'ref GO', r.sum(), 'ours', o70.sum(), 'only ref', (r & ~o70).sum(), 'only ours', (~r & o70).sum())
write(ok(14, 90), 'ok14s90'); write(ok(6, 90), 'ok6s90')
