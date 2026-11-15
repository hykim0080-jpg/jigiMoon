# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Build orientation/landers.json: spacecraft that landed / impacted / were planned near the lunar south
pole, plus Artemis III candidate regions (2024 list and the 2022 list). Coordinates as published
(source per item); 'verify' = not confirmed against a primary source."""
import json, math
import numpy as np
import horizon as H
from orientation import describe

LM = json.load(open("/mnt/project-files/space-apps/lunar/orientation/landmarks.json", encoding="utf-8"))
L = []


def add(**k):
    if k.get("lat") is not None:
        x, y = H.ll_to_xy(k["lat"], k["lon"])
        k["x_m"], k["y_m"] = round(float(x)), round(float(y))
        k["in_view"] = bool(max(abs(x), abs(y)) <= 200000)
        k["relative"] = describe(x, y, LM) if k["in_view"] else None
    else:
        k.update({"x_m": None, "y_m": None, "in_view": None, "relative": None})
    k.setdefault("verify", False)
    L.append(k)


add(id="im-2-athena", name="IM-2 Athena", mission="Intuitive Machines IM-2 (NASA CLPS)", kind="landed", status="landed on its side",
    date="2025-03-06", year=2025, lat=-84.7906, lon=29.1957, source="https://lroc.im-ldi.com/images/1408",
    note="intended site -84.78, 29.13E (https://lroc.im-ldi.com/images/1401)")
add(id="im-1-odysseus", name="IM-1 Odysseus", mission="Intuitive Machines IM-1 (NASA CLPS)", kind="landed", status="landed, tipped",
    date="2024-02-22", year=2024, lat=-80.13, lon=1.44, source="https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/",
    note="near Malapert A, 12 deg slope; 'tipped' widely reported, not stated on the NASA page", verify=True)
add(id="lcross-centaur", name="LCROSS Centaur impact", mission="LCROSS (NASA)", kind="impact", status="deliberate impact",
    date="2009-10-09", year=2009, lat=-84.6796, lon=-48.7093, source="https://arxiv.org/abs/1103.1687",
    note="in Cabeus; 1-sigma ~115 m lat, 44 m lon")
add(id="lcross-ssc", name="LCROSS Shepherding Spacecraft impact", mission="LCROSS (NASA)", kind="impact", status="deliberate impact",
    date="2009-10-09", year=2009, lat=-84.719, lon=-49.61, source="https://arxiv.org/abs/1103.1687",
    note="abstract gives -84.719, table gives -84.729", verify=True)
add(id="lunar-prospector", name="Lunar Prospector impact", mission="Lunar Prospector (NASA)", kind="impact", status="deliberate impact",
    date="1999-07-31", year=1999, lat=-87.7, lon=42.1, source="https://en.wikipedia.org/wiki/Lunar_Prospector",
    note="near Shoemaker; coordinates from Wikipedia only", verify=True)
# VIPER: NASA gave only 'near the western edge of Nobile crater'; point = Nobile rim toward west (approximate)
nob = next(m for m in LM if m["id"] == "nobile")
lo = math.radians(nob["lon"]); west = np.array([-math.cos(lo), math.sin(lo)])
px, py = np.array([nob["x_m"], nob["y_m"]]) + west * nob["radius_km"] * 1000
vlat, vlon = H.xy_to_ll(px, py)
add(id="viper", name="VIPER (planned site)", mission="VIPER rover (NASA)", kind="planned", status="cancelled 2024",
    date="2021-09-20", year=2021, lat=round(float(vlat), 3), lon=round(float(vlon), 3),
    source="https://www.nasa.gov/news-release/nasas-artemis-rover-to-land-near-nobile-region-of-moons-south-pole",
    note="NASA gave no coordinates, only 'western edge of Nobile crater'; point placed on Nobile's west rim (approximate)", verify=True, approximate=True)
add(id="change-7", name="Chang'e-7 (planned)", mission="Chang'e-7 (CNSA)", kind="planned", status="launch slipped to early 2027",
    date=None, year=2027, lat=None, lon=None, source="https://www.planetary.org/space-missions/change-7",
    note="target: sunlit rim of Shackleton; exact site not published", verify=True)
add(id="chandrayaan-1-mip", name="Chandrayaan-1 Moon Impact Probe", mission="Chandrayaan-1 (ISRO)", kind="impact", status="deliberate impact",
    date="2008-11-14", year=2008, lat=None, lon=None, source="https://ui.adsabs.harvard.edu/abs/2021LPI....52.1013S/abstract",
    note="near Shackleton rim; coordinates not obtained", verify=True)
add(id="chandrayaan-3", name="Chandrayaan-3 Vikram", mission="Chandrayaan-3 (ISRO)", kind="landed", status="landed upright",
    date="2023-08-23", year=2023, lat=-69.3741, lon=32.32, source="https://lroc.im-ldi.com/images/1314")
add(id="chandrayaan-2", name="Chandrayaan-2 Vikram", mission="Chandrayaan-2 (ISRO)", kind="crash", status="crashed",
    date="2019-09-06", year=2019, lat=-70.881, lon=22.784, source="https://lroc.im-ldi.com/images/1131")
add(id="luna-25", name="Luna-25", mission="Luna-25 (Roscosmos)", kind="crash", status="crashed",
    date="2023-08-19", year=2023, lat=-57.865, lon=61.36, source="https://lroc.im-ldi.com/images/1311",
    note="LROC: 'likely' the Luna-25 crater; intended site -69.545, 43.544E")

# Artemis III candidate regions
rb = json.load(open("region_boxes.json"))["boxes"]
for n, b in rb.items():
    x1, y1, x2, y2 = b["box_m"]; lat, lon = H.xy_to_ll((x1 + x2) / 2, (y1 + y2) / 2)
    add(id="a3-2024-" + n.lower().replace(" ", "-"), name=n, mission="Artemis III candidate region (2024)", kind="candidate_region",
        status="current candidate (Oct 2024)", date="2024-10-28", year=2024, lat=round(float(lat), 3), lon=round(float(lon), 3), box_m=b["box_m"],
        source="https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/",
        note="box read from NASA's region map, georeferenced to PGDA tiles (max error 0.33 km)")
kept = {"Haworth", "Malapert Massif", "Nobile Rim 1", "Nobile Rim 2", "de Gerlache Rim 2"}
for t in json.load(open("a3_2022_tiles.json")):
    st = "kept in 2024 list" if t["name"] in kept else "dropped in 2024"
    if t["name"] == "Leibnitz Beta Plateau":
        st = "same area as 2024 'Mons Mouton' region (Leibnitz Beta renamed Mons Mouton in 2022)"
    add(id="a3-2022-" + t["name"].lower().replace(" ", "-"), name=t["name"], mission="Artemis III candidate region (2022)",
        kind="previous_candidate_region", status=st, date="2022-08-19", year=2022, lat=t["lat"], lon=t["lon"], box_m=t["bounds_m"],
        source="https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/",
        note=f"position = PGDA 5 m tile {t['tile']} named after this region (https://pgda.gsfc.nasa.gov/products/78); approximate region extent", approximate=True)
json.dump(L, open("/mnt/project-files/space-apps/lunar/orientation/landers.json", "w"), ensure_ascii=False, indent=1)
for k in L: print(k["id"], k.get("in_view"), (k["relative"] or {}).get("text_ko"), "VERIFY" if k["verify"] else "")
# then add map labels and purposes: python3 lander_info.py landers.json
