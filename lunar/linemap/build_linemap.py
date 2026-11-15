"""Thin-line map of the lunar south pole: LOLA contours (250 m, 1 km bold) + permanently shadowed outlines + landmark names.
Same frame as navigator/data/hillshade_4000.jpg: polar stereographic (+proj=stere +lat_0=-90 +lon_0=0 +R=1737400),
x,y in +-200 km, 4000 px = 100 m/px, row 0 = y = +200 km (lon 0 = Earth direction up), px = (x_km+200)*10, py = (200-y_km)*10.
Run: python3 build_linemap.py   (needs ~/data/dem/LDEM_80S_80MPP_ADJ.TIF and AVGVISIB_75S_120M_201608.TIF from PGDA)"""
import json, os
import numpy as np, rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from scipy.ndimage import gaussian_filter
from skimage import measure
from PIL import Image, ImageDraw, ImageFont

D = os.path.expanduser("~/data/dem"); OUT = os.path.dirname(os.path.abspath(__file__))
R, N = 200000, 4000; RES = 2 * R / N
SS = 2                                   # supersampling for anti-aliased PNG lines
INK = (40, 44, 52)

def read(path, resamp):
    with rasterio.open(path) as s:
        return s.read(1, window=from_bounds(-R, -R, R, R, s.transform), out_shape=(N, N), resampling=resamp).astype(float)

z = read(f"{D}/LDEM_80S_80MPP_ADJ.TIF", Resampling.average)
zs = gaussian_filter(z, 1.8)            # ~180 m smoothing so 100 m contours do not zig-zag on pixel noise
sun = read(f"{D}/AVGVISIB_75S_120M_201608.TIF", Resampling.nearest) * 4e-5 * 100   # PGDA 18.6-yr mean sunlit %
psr = gaussian_filter((sun <= 0).astype(float), 1.0)

def area(c):
    return 0.5 * abs(np.dot(c[:, 0], np.roll(c[:, 1], 1)) - np.dot(c[:, 1], np.roll(c[:, 0], 1)))

def lines(field, level, tol, min_len, min_area=0):
    out = []
    for c in measure.find_contours(field, level):
        if len(c) < min_len: continue
        if min_area and np.allclose(c[0], c[-1]) and area(c) < min_area: continue
        c = measure.approximate_polygon(c, tol)
        if len(c) >= 2: out.append(c[:, ::-1])          # (row, col) -> (x px, y px)
    return out

layers = []                                            # (name, width_px_at_4000, polylines)
lo, hi = np.floor(zs.min() / 250) * 250, np.ceil(zs.max() / 250) * 250
for lev in np.arange(lo, hi + 1, 250):
    major = lev % 1000 == 0
    layers.append(("major" if major else "minor", 1.6 if major else 0.7, lines(zs, lev, 0.6, 16, 30)))
psr_lines = lines(psr, 0.5, 0.5, 20, 200)              # keeps shadowed areas of 2 km^2 or more
layers.append(("psr", 1.0, psr_lines))

LM = json.load(open(os.path.join(OUT, "..", "orientation", "landmarks.json")))
NAMES = ["Shackleton", "Haworth", "Mons Malapert", "Nobile", "de Gerlache", "Mons Mouton", "Amundsen", "Cabeus"]
labels = [(L["name"], L["x_m"] / RES + N / 2, N / 2 - L["y_m"] / RES) for L in LM if L["name"] in NAMES]

# PNG
font = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Medium.otf", 26 * SS)
def png(bg):
    im = Image.new("RGBA", (N * SS, N * SS), bg); d = ImageDraw.Draw(im)
    for name, w, pl in layers:
        col = INK + (255,) if name != "minor" else INK + (150,)
        dash = name == "psr"
        for c in pl:
            pts = [tuple(p * SS) for p in c]
            if dash:                                   # PSR: dashed outline
                for i in range(0, len(pts) - 1, 2): d.line(pts[i:i + 2], fill=col, width=max(1, round(w * SS)))
            else: d.line(pts, fill=col, width=max(1, round(w * SS)), joint="curve")
    for name, x, y in labels:
        d.text((x * SS, y * SS), name, font=font, fill=INK + (255,), anchor="mm", stroke_width=5 * SS if bg[3] else 0, stroke_fill=bg)
    return im.resize((N, N), Image.LANCZOS)

white = png((255, 255, 255, 255)); white.convert("RGB").save(f"{OUT}/linemap_4000_white.png", optimize=True)
png((255, 255, 255, 0)).save(f"{OUT}/linemap_4000_transparent.png", optimize=True)
white.convert("RGB").resize((1200, 1200), Image.LANCZOS).save(f"{OUT}/linemap_preview_1200.png", optimize=True)

# SVG (same pixel frame, viewBox 0..4000)
def path(c): return "M" + " L".join(f"{p[0]:.1f},{p[1]:.1f}" for p in c)
g = {"minor": 'stroke-width="0.7" stroke-opacity="0.6"', "major": 'stroke-width="1.6"', "psr": 'stroke-width="1" stroke-dasharray="4 4"'}
with open(f"{OUT}/linemap.svg", "w") as f:
    f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" width="{N}" height="{N}">\n')
    f.write(f'<g fill="none" stroke="rgb{INK}" stroke-linejoin="round" stroke-linecap="round">\n')
    for name in ("minor", "major", "psr"):
        f.write(f'<g id="{name}" {g[name]}>\n')
        for n2, w, pl in layers:
            if n2 == name:
                for c in pl: f.write(f'<path d="{path(c)}"/>\n')
        f.write('</g>\n')
    f.write('</g>\n<g id="labels" font-family="Inter, sans-serif" font-size="26" font-weight="500" text-anchor="middle" dominant-baseline="middle" fill="rgb%s">\n' % (INK,))
    for name, x, y in labels: f.write(f'<text x="{x:.0f}" y="{y:.0f}" paint-order="stroke" stroke="#fff" stroke-width="10">{name}</text>\n')
    f.write('</g>\n</svg>\n')
print("contours", sum(len(l[2]) for l in layers if l[0] != "psr"), "psr", len(psr_lines), "z", lo, hi)
