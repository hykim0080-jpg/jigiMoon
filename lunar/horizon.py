# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Terrain horizon masks from lunar south-polar stereographic DEMs (PGDA / LOLA).

Conventions checked against the PGDA files (2026-11-14):
- CRS of every PGDA LOLA GeoTIFF: +proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 (metres),
  i.e. x = rho*sin(lon), y = rho*cos(lon), rho = 2R tan(pi/4 + lat/2). ll_to_xy matches pyproj to <1 mm.
- Heights: metres relative to the 1737.4 km reference sphere, MOON_ME frame of DE421 (PGDA products 78/90/69).
- Pixel registration: GMT 'pixel-registered' (values are pixel centres); GeoTIFF transform gives the
  upper-left CORNER, so the centre of pixel (0,0) is (t.c + res/2, t.f - res/2). Handled in load_geotiff.
- Row 0 is the top (max y); column 0 is the left (min x).
"""
import os
import numpy as np

R_M = 1737400.0

# GDAL settings that work through the agent proxy for range reads of remote COGs
for k, v in {"GDAL_HTTP_MULTIRANGE": "NO", "GDAL_HTTP_MAX_RETRY": "4", "GDAL_HTTP_RETRY_DELAY": "2",
             "GDAL_HTTP_USERAGENT": "curl/8", "CPL_VSIL_CURL_USE_HEAD": "NO",
             "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR"}.items():
    os.environ.setdefault(k, v)
if os.path.exists("/root/.ccr/ca-bundle.crt"):
    os.environ.setdefault("CURL_CA_BUNDLE", "/root/.ccr/ca-bundle.crt")


def ll_to_xy(lat, lon, R=R_M):
    """South polar stereographic (true scale at pole). lat, lon in degrees."""
    lat, lon = np.deg2rad(lat), np.deg2rad(lon)
    rho = 2 * R * np.tan(np.pi / 4 + lat / 2)
    return rho * np.sin(lon), rho * np.cos(lon)


def xy_to_ll(x, y, R=R_M):
    rho = np.hypot(x, y)
    lat = 2 * np.arctan(rho / (2 * R)) - np.pi / 2
    lon = np.arctan2(x, y)
    return np.rad2deg(lat), np.rad2deg(lon)


class DEM:
    """Regular grid. (x0, y0) = CENTRE of pixel (row 0, col 0); rows go towards -y."""

    def __init__(self, z, res, x0, y0, name=""):
        self.z, self.res, self.x0, self.y0 = np.asarray(z, np.float32), float(res), float(x0), float(y0)
        self.name = name

    @property
    def bounds(self):
        ny, nx = self.z.shape
        return (self.x0, self.y0 - (ny - 1) * self.res, self.x0 + (nx - 1) * self.res, self.y0)

    def contains(self, x, y, margin=0.0):
        x1, y1, x2, y2 = self.bounds
        return x1 + margin <= x <= x2 - margin and y1 + margin <= y <= y2 - margin

    def sample(self, x, y):
        """Bilinear sample; NaN outside or where a neighbour is NaN."""
        c = (np.asarray(x) - self.x0) / self.res
        r = (self.y0 - np.asarray(y)) / self.res
        ny, nx = self.z.shape
        ok = (c >= 0) & (c <= nx - 1) & (r >= 0) & (r <= ny - 1)
        c0 = np.clip(np.floor(c).astype(int), 0, nx - 2)
        r0 = np.clip(np.floor(r).astype(int), 0, ny - 2)
        fc, fr = c - c0, r - r0
        z = self.z
        v = (z[r0, c0] * (1 - fc) * (1 - fr) + z[r0, c0 + 1] * fc * (1 - fr)
             + z[r0 + 1, c0] * (1 - fc) * fr + z[r0 + 1, c0 + 1] * fc * fr)
        return np.where(ok, v, np.nan)


class DEMStack:
    """Several DEMs, finest first. sample() takes the finest DEM that has a value."""

    def __init__(self, dems):
        self.dems = [d for d in dems if d is not None]
        self.res = self.dems[0].res

    def sample(self, x, y):
        x, y = np.broadcast_arrays(np.asarray(x, float), np.asarray(y, float))
        out = np.full(x.shape, np.nan)
        for d in self.dems:
            m = np.isnan(out)
            if not m.any():
                break
            out[m] = d.sample(x[m], y[m])
        return out

    def describe(self):
        return [{"name": d.name, "res_m": d.res, "bounds_m": [round(b) for b in d.bounds]} for d in self.dems]


def load_geotiff(path, bounds=None, name=None, tries=5):
    """Retrying wrapper: remote range reads through the proxy occasionally return 0 bytes."""
    import time
    for k in range(tries):
        try:
            return _load_geotiff(path, bounds, name)
        except Exception:
            if k == tries - 1:
                raise
            time.sleep(2 + 3 * k)


def _load_geotiff(path, bounds=None, name=None):
    """Load a PGDA LOLA GeoTIFF (local path or /vsicurl/ URL). bounds=(xmin,ymin,xmax,ymax) in metres
    reads only that window. Returns DEM with pixel-centre registration."""
    import rasterio
    from rasterio.windows import from_bounds, Window
    with rasterio.open(path) as src:
        win = None
        if bounds is not None:
            win = from_bounds(*bounds, transform=src.transform).round_offsets().round_lengths()
            win = win.intersection(Window(0, 0, src.width, src.height))
        if win is None:
            z = src.read(1).astype(np.float32)
        else:  # read remote windows in 1024-px chunks, each retried (big range reads fail via proxy)
            import time
            z = np.empty((int(win.height), int(win.width)), np.float32)
            C = 1024
            for r in range(0, z.shape[0], C):
                for c in range(0, z.shape[1], C):
                    sub = Window(win.col_off + c, win.row_off + r, min(C, z.shape[1] - c), min(C, z.shape[0] - r))
                    for k in range(6):
                        try:
                            z[r:r + sub.height, c:c + sub.width] = src.read(1, window=sub)
                            break
                        except Exception:
                            if k == 5:
                                raise
                            time.sleep(1 + 2 * k)
        if src.nodata is not None and not np.isnan(src.nodata):
            z[z == src.nodata] = np.nan
        t = src.window_transform(win) if win is not None else src.transform
        res = abs(t.a)
        return DEM(z, res, t.c + res / 2, t.f - res / 2, name or os.path.basename(path))


def horizon_mask(dem, x, y, mast_m=2.0, az_step=0.5, max_km=150.0, near=None):
    """Horizon elevation angle (deg) for each azimuth (clockwise from local north).
    dem: DEM or DEMStack. mast_m: observer height above ground (panel / antenna height).
    Distance samples: `near` m steps to 3 km, 20 m to 20 km, then geometric to max_km."""
    az = np.arange(0, 360, az_step)
    n, e = local_axes(x, y)
    h0 = float(dem.sample(np.array([x]), np.array([y]))[0]) + mast_m
    if near is None:
        near = max(dem.res, 5.0)
    d = np.unique(np.concatenate([np.arange(near, 3000, near), np.arange(3000, 20000, 20.0),
                                  np.geomspace(20000, max_km * 1000, 500)]))
    a = np.deg2rad(az)[:, None]
    dirx = np.cos(a) * n[0] + np.sin(a) * e[0]
    diry = np.cos(a) * n[1] + np.sin(a) * e[1]
    h = dem.sample(x + dirx * d, y + diry * d)
    drop = d ** 2 / (2 * R_M)  # curvature of the Moon
    ang = np.degrees(np.arctan2(h - h0 - drop, d))
    hz = np.nanmax(np.where(np.isnan(ang), -90, ang), axis=1)
    return az, np.maximum(hz, -90)


def local_axes(x, y):
    """Unit vectors (in map x,y) of local north and east at a map point."""
    lat, lon = xy_to_ll(x, y)
    xn, yn = ll_to_xy(lat + 1e-4, lon)
    n = np.array([xn - x, yn - y]); n /= np.linalg.norm(n)
    e = np.array([n[1], -n[0]])
    xe, ye = ll_to_xy(lat, lon + 1e-4)
    if np.dot(e, [xe - x, ye - y]) < 0:
        e = -e
    return n, e


def interp_mask(az_grid, mask, az):
    return np.interp(np.asarray(az) % 360, np.append(az_grid, 360), np.append(mask, mask[0]))


def visibility(az_grid, mask, eph):
    """Sun visible fraction (0..1, linear in disk height) and Earth visible (bool: centre above horizon)."""
    hs = interp_mask(az_grid, mask, eph["sun"]["az"])
    r = eph["sun_radius_deg"]
    sun_frac = np.clip((eph["sun"]["el"] - hs + r) / (2 * r), 0, 1)
    he = interp_mask(az_grid, mask, eph["earth"]["az"])
    earth_vis = eph["earth"]["el"] > he
    return sun_frac, earth_vis


def synthetic_dem(size_km=60, res=50.0, seed=1):
    """Test terrain: a crater + a distant ridge, for code testing only (not real data)."""
    n = int(size_km * 1000 / res)
    xs = (np.arange(n) - n / 2) * res
    X, Y = np.meshgrid(xs, -xs)
    rng = np.random.default_rng(seed)
    z = -2500 * np.exp(-((X - 8000) ** 2 + (Y + 3000) ** 2) / (2 * 6000 ** 2))
    z += 2000 * np.exp(-((X + 15000) ** 2) / (2 * 3000 ** 2)) * (np.abs(Y) < 20000)
    z += rng.normal(0, 5, z.shape)
    return DEM(z, res, xs[0], -xs[0], "synthetic")
