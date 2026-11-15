# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Build orientation/landmarks.json and the relative-position helper used by landers.json and sites.
Landmarks: IAU/USGS Gazetteer of Planetary Nomenclature (planetarynames.wr.usgs.gov), planetographic
+East coordinates, diameters in km. Relative position rule: see describe()."""
import json, math
import numpy as np
import horizon as H

G = {a["name"]: a for a in json.load(open("gaz_south.json"))}
TIERS = {1: ["Shackleton", "Mons Malapert", "Mons Mouton", "Amundsen"],
         2: ["Cabeus", "Haworth", "Shoemaker", "Faustini", "de Gerlache", "Sverdrup", "Nobile", "Malapert", "Slater", "Mons Kocher"],
         3: ["Scott", "Henson", "Kocher", "Whitaker", "Cartwright", "Brill", "Haynes", "Burbidge", "Stose", "Mons Cabeus", "Mons Amundsen", "Idel'son"]}
KO = {"Shackleton": "섀클턴", "Mons Malapert": "말라페르트산", "Mons Mouton": "무톤산", "Amundsen": "아문센",
      "Cabeus": "카베우스", "Haworth": "해워스", "Shoemaker": "슈메이커", "Faustini": "파우스티니", "de Gerlache": "드제를라슈",
      "Sverdrup": "스베르드루프", "Nobile": "노빌레", "Malapert": "말라페르트", "Slater": "슬레이터", "Mons Kocher": "코허산"}


def landmarks():
    out = [{"id": "south-pole", "name": "South Pole", "name_ko": "남극점", "kind": "point", "tier": 1, "always_show": True,
            "lat": -90.0, "lon": 0.0, "x_m": 0, "y_m": 0, "radius_km": 0,
            "source": "definition (IAU/IAG lunar coordinate system)"}]
    for tier, names in TIERS.items():
        for n in names:
            if n not in G:
                print("missing", n); continue
            a = G[n]; x, y = H.ll_to_xy(a["lat"], a["lon"])
            kind = "massif" if a["type"].startswith("Mons") else "crater"
            out.append({"id": n.lower().replace(" ", "-").replace("'", ""), "name": n, "name_ko": KO.get(n),
                        "kind": kind, "tier": tier, "always_show": tier == 1,
                        "lat": a["lat"], "lon": a["lon"], "x_m": round(float(x)), "y_m": round(float(y)),
                        "radius_km": None if a["diameter_km"] is None else round(a["diameter_km"] / 2, 2),
                        "diameter_km": a["diameter_km"],
                        "source": f"https://planetarynames.wr.usgs.gov/Feature/{a['gazetteer_id']}"})
    # informal but widely used name (NASA Artemis region); not an IAU name
    out.append({"id": "connecting-ridge", "name": "Connecting Ridge", "name_ko": "연결 능선", "kind": "ridge", "tier": 3,
                "always_show": False, "lat": -89.463, "lon": -137.49, "x_m": -11000, "y_m": -12000, "radius_km": 8,
                "informal": True, "source": "NASA Artemis III region name (2022); position = centre of PGDA 5 m tile Site01 (https://pgda.gsfc.nasa.gov/products/78)"})
    return out


SECTORS = ["지구 쪽", "지구 쪽 오른편", "오른쪽", "지구 반대쪽 오른편", "지구 반대쪽", "지구 반대쪽 왼편", "왼쪽", "지구 쪽 왼편"]


SECTORS_EN = ["Earth side", "Earth-right side", "right side", "back-right side", "back side", "back-left side", "left side", "Earth-left side"]
MASSIF_CORE = 0.5      # Gazetteer massif diameters span the whole footprint; the core is about half of it
BESIDE_KM = 10.0


def _reach(L):
    r = L["radius_km"] or 0
    return r if L["kind"] == "crater" else r * MASSIF_CORE if L["kind"] in ("massif", "ridge") else 0.0


def describe(x, y, lms, max_tier=2):
    """Nearest major landmark (tier <= max_tier) of any kind, and direction relative to the Earth direction.
    Distance = to the crater rim, to the core of a massif (half its Gazetteer radius), or to a point.
    Ties (inside several footprints) go to the landmark whose centre is relatively closest (d / reach).
    Earth direction = map +y (toward lon 0); libration moves the real Earth azimuth by about +-7 deg,
    so 8 sectors of 45 deg are used. 'Right' = map +x when facing Earth."""
    best = None
    for L in lms:
        if L["tier"] > max_tier:
            continue
        d = math.hypot(x - L["x_m"], y - L["y_m"]) / 1000
        r = _reach(L)
        key = (max(d - r, 0.0), d / r if r else d)
        if best is None or key < best[0]:
            best = (key, d, L)
    (gap, _), d, L = best
    r = _reach(L)
    dx, dy = x - L["x_m"], y - L["y_m"]
    bearing = (math.degrees(math.atan2(dx, dy)) + 360) % 360
    si = int(((bearing + 22.5) % 360) // 45)
    sec, sen = SECTORS[si], SECTORS_EN[si]
    ko, en = L["name_ko"] or L["name"], L["name"]
    crater = L["kind"] == "crater"
    if d < 0.5 or (not crater and gap == 0 and d < 0.25 * r):
        rel, tk, te = "at", f"{ko}", f"at {en}"
    elif crater and abs(d - r) <= max(1.5, 0.15 * r):
        rel, tk, te = "rim", f"{ko} 테두리 ({sec})", f"{en} rim, {sen}"
    elif crater and d < r:
        rel, tk, te = "inside", f"{ko} 안 ({sec}, 중심에서 {d:.0f} km)", f"inside {en}, {sen}, {d:.0f} km from centre"
    elif gap == 0:
        rel, tk, te = "on", f"{ko} 위 ({sec})", f"on {en}, {sen}"
    elif gap < BESIDE_KM:
        rel, tk, te = "beside", f"{ko} 옆 ({sec})", f"beside {en}, {sen}"
    else:
        rel, tk, te = "away", f"{ko}에서 {sec}으로 {gap:.0f} km", f"{gap:.0f} km from {en}, {sen}"
    return {"landmark_id": L["id"], "landmark": en, "relation": rel, "distance_km": round(d, 1),
            "gap_km": round(gap, 1), "bearing_from_earth_deg": round(bearing, 1), "sector": sec, "sector_en": sen,
            "inside": bool(crater and d < r), "text_ko": tk, "text_en": te}


if __name__ == "__main__":
    lms = landmarks()
    for L in lms:
        if L["id"] != "south-pole":
            r = describe(L["x_m"], L["y_m"], [m for m in lms if m["id"] != L["id"]])
            L["relative"] = r
    json.dump(lms, open("/mnt/project-files/space-apps/lunar/orientation/landmarks.json", "w"), ensure_ascii=False, indent=1)
    for L in lms: print(L["tier"], L["name"], L["lat"], L["lon"], L.get("radius_km"), L.get("relative", {}).get("text_ko"))
