# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Headline numbers: of the 2027 landing days that are NO-GO at the chosen point (2 m mast), what share is
fixed by (a) moving <= 1 km (slope <= 8 deg, same criteria), (b) a mast <= 20 m, (c) waiting <= N days,
(d) any of a/b/c(<=7 d). Per site and pooled over the 12 sites."""
import json
D = "/mnt/project-files/space-apps/lunar"
sites = json.load(open(f"{D}/sites.json"))
res = {"definition": __doc__, "modes": {}}
for mode, sub in (("6d", "out/mission_6d"), ("14d", "out")):
    rows, P = [], {k: 0 for k in ["days", "nogo", "move1", "move3", "mast20", "mast100", "wait3", "wait7", "wait14", "any7"]}
    for s in sites:
        c = json.load(open(f"{D}/{sub}/{s['id']}.json"))["calendar"]
        n = len(c["ok"]); ng = [d for d in range(n) if c["ok"][d] == "0"]
        mv = lambda d, km: c["nearest_move_km"][d] is not None and c["nearest_move_km"][d] <= km
        ma = lambda d, h: c["min_mast_m"][d] is not None and c["min_mast_m"][d] <= h
        wa = lambda d, w: c["wait_days"][d] is not None and c["wait_days"][d] <= w
        r = {"id": s["id"], "name": s["name"], "days": n, "nogo": len(ng),
             "move1": sum(mv(d, 1) for d in ng), "move3": sum(mv(d, 3) for d in ng),
             "mast20": sum(ma(d, 20) for d in ng), "mast100": sum(ma(d, 100) for d in ng),
             "wait3": sum(wa(d, 3) for d in ng), "wait7": sum(wa(d, 7) for d in ng), "wait14": sum(wa(d, 14) for d in ng),
             "any7": sum(mv(d, 1) or ma(d, 20) or wa(d, 7) for d in ng)}
        for k in P: P[k] += r[k]
        for k in ["move1", "move3", "mast20", "mast100", "wait3", "wait7", "wait14", "any7"]:
            r[k + "_pct"] = round(100 * r[k] / max(1, r["nogo"]), 1)
        rows.append(r)
    for k in ["move1", "move3", "mast20", "mast100", "wait3", "wait7", "wait14", "any7"]:
        P[k + "_pct"] = round(100 * P[k] / P["nogo"], 1)
    P["nogo_pct_of_days"] = round(100 * P["nogo"] / P["days"], 1)
    res["modes"][mode] = {"pooled": P, "sites": rows}
json.dump(res, open(f"{D}/nogo_stats.json", "w"), indent=1)
for m, v in res["modes"].items():
    print(m, v["pooled"])
    for r in v["sites"]: print("  ", r["name"], r["nogo"], r["move1_pct"], r["mast20_pct"], r["wait7_pct"], r["any7_pct"])
