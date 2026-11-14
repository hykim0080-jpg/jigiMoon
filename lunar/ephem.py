"""Sun and Earth position (azimuth, elevation) seen from a point on the Moon.

Ephemeris: JPL DE421 (bundled by the skyfield-data package, public domain).
Moon orientation: IAU WGCCRE 2009 recommended lunar rotation model
(Archinal et al. 2011, Celest Mech Dyn Astr 109:101-135), which approximates the
Mean Earth/polar axis (ME) frame used by LOLA topography.
"""
import numpy as np
from skyfield.api import load
from skyfield_data import get_skyfield_data_path

R_MOON_KM = 1737.4


def _load():
    from skyfield.api import Loader
    ld = Loader(get_skyfield_data_path(), expire=False)
    eph = ld("de421.bsp")
    ts = ld.timescale(builtin=True)
    return eph, ts


EPH, TS = _load()


def _iau_moon_angles(d):
    """d = days since J2000 TDB. Returns alpha0, delta0, W in radians."""
    T = d / 36525.0
    E = np.deg2rad(np.array([
        125.045 - 0.0529921 * d, 250.089 - 0.1059842 * d, 260.008 + 13.0120009 * d,
        176.625 + 13.3407154 * d, 357.529 + 0.9856003 * d, 311.589 + 26.4057084 * d,
        134.963 + 13.0649930 * d, 276.617 + 0.3287146 * d, 34.226 + 1.7484877 * d,
        15.134 - 0.1589763 * d, 119.743 + 0.0036096 * d, 239.961 + 0.1643573 * d,
        25.053 + 12.9590088 * d]))
    s, c = np.sin, np.cos
    a0 = (269.9949 + 0.0031 * T - 3.8787 * s(E[0]) - 0.1204 * s(E[1]) + 0.0700 * s(E[2])
          - 0.0172 * s(E[3]) + 0.0072 * s(E[5]) - 0.0052 * s(E[9]) + 0.0043 * s(E[12]))
    d0 = (66.5392 + 0.0130 * T + 1.5419 * c(E[0]) + 0.0239 * c(E[1]) - 0.0278 * c(E[2])
          + 0.0068 * c(E[3]) - 0.0029 * c(E[5]) + 0.0009 * c(E[6]) + 0.0008 * c(E[9])
          - 0.0009 * c(E[12]))
    W = (38.3213 + 13.17635815 * d - 1.4e-12 * d ** 2 + 3.5610 * s(E[0]) + 0.1208 * s(E[1])
         - 0.0642 * s(E[2]) + 0.0158 * s(E[3]) + 0.0252 * s(E[4]) - 0.0066 * s(E[5])
         - 0.0047 * s(E[6]) - 0.0046 * s(E[7]) + 0.0028 * s(E[8]) + 0.0052 * s(E[9])
         + 0.0040 * s(E[10]) + 0.0019 * s(E[11]) - 0.0044 * s(E[12]))
    return np.deg2rad(a0), np.deg2rad(d0), np.deg2rad(W)


def _icrf_to_moon(vec, d):
    """Rotate ICRF vectors (3,N) into Moon body-fixed frame for each epoch."""
    a0, d0, W = _iau_moon_angles(d)
    out = np.empty_like(vec)
    for i in range(vec.shape[1]):
        # body-fixed = Rz(W) Rx(90-d0) Rz(90+a0) * icrf
        def rz(t):
            return np.array([[np.cos(t), np.sin(t), 0], [-np.sin(t), np.cos(t), 0], [0, 0, 1]])

        def rx(t):
            return np.array([[1, 0, 0], [0, np.cos(t), np.sin(t)], [0, -np.sin(t), np.cos(t)]])
        M = rz(W[i]) @ rx(np.pi / 2 - d0[i]) @ rz(np.pi / 2 + a0[i])
        out[:, i] = M @ vec[:, i]
    return out


def body_vectors(times):
    """Sun and Earth vectors from Moon centre in the Moon body-fixed frame (km), (3,N)."""
    moon, sun, earth = EPH["moon"], EPH["sun"], EPH["earth"]
    m = moon.at(times).position.km
    vs = sun.at(times).position.km - m
    ve = earth.at(times).position.km - m
    d = times.tdb - 2451545.0
    return _icrf_to_moon(vs, d), _icrf_to_moon(ve, d)


def azel_from_body(lat_deg, lon_deg, vs_b, ve_b, height_km=0.0):
    """Azimuth from local north, clockwise (east = 90). Elevation geometric (no atmosphere)."""
    lat, lon = np.deg2rad(lat_deg), np.deg2rad(lon_deg)
    r = R_MOON_KM + height_km
    site = r * np.array([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
    up = site / np.linalg.norm(site)
    east = np.array([-np.sin(lon), np.cos(lon), 0.0])
    north = np.cross(up, east)
    res = {}
    for name, v in (("sun", vs_b), ("earth", ve_b)):
        rel = v - site[:, None]
        dist = np.linalg.norm(rel, axis=0)
        u = rel / dist
        el = np.degrees(np.arcsin(u.T @ up))
        az = np.degrees(np.arctan2(u.T @ east, u.T @ north)) % 360
        res[name] = {"az": az, "el": el, "dist_km": dist}
    res["sun_radius_deg"] = np.degrees(np.arcsin(696000.0 / res["sun"]["dist_km"]))
    res["earth_radius_deg"] = np.degrees(np.arcsin(6371.0 / res["earth"]["dist_km"]))
    return res


def sun_earth_azel(lat_deg, lon_deg, times, height_km=0.0):
    vs_b, ve_b = body_vectors(times)
    return azel_from_body(lat_deg, lon_deg, vs_b, ve_b, height_km)


def hourly(start=(2026, 1, 1), days=365, step_hours=1.0):
    """UTC times from 00:00 of `start`, every step_hours, for `days` days."""
    n = int(round(days * 24 / step_hours))
    return TS.utc(start[0], start[1], start[2], np.arange(n) * step_hours)
