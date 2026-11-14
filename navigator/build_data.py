"""Build web data for the navigator from ../lunar/out (14 d) and ../lunar/out/mission_6d (6 d).
Run: python3 build_data.py   -> data/index.json, data/<mode>/<id>.json, data/sky/<id>.json, data/hillshade.jpg
"""
import json, os, base64
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'lunar', 'out')
MODES = {'14': OUT, '6': os.path.join(OUT, 'mission_6d')}
D = os.path.join(HERE, 'data')

def r1(v): return None if v is None else round(v, 1)

sites = json.load(open(os.path.join(HERE, '..', 'lunar', 'sites.json')))
index = {'sites': [], 'modes': {}}
for s in sites:
    index['sites'].append({k: s[k] for k in ('id', 'name', 'group', 'x_m', 'y_m', 'lat', 'lon', 'slope_deg', 'box_m') if k in s})

for mode, src in MODES.items():
    os.makedirs(os.path.join(D, mode), exist_ok=True)
    summ = {x['id']: x for x in json.load(open(os.path.join(src, 'summary_2027.json')))}
    m = index['modes'][mode] = {'sites': {}}
    for s in sites:
        sid = s['id']
        j = json.load(open(os.path.join(src, sid + '.json')))
        c = j['calendar']
        H = [str(h) for h in c.get('mast_heights_m', [2, 5, 10, 20, 40])]
        c['mast_ok'] = {h: c['mast_ok'][h] for h in H}
        m['mast_heights_m'] = [int(h) for h in H]
        m['criteria'] = j['criteria']; m['mission_days'] = j['mission_days']
        m['first_day_utc'] = c['first_day_utc']
        # compact per-day table for the all-site calendar
        m['sites'][sid] = {
            'ok': c['ok'], 'wait': c['wait_days'], 'mast': c['min_mast_m'],
            'move': [r1(v) for v in c['nearest_move_km']], 'mast_ok': c['mast_ok'], 'summary': summ.get(sid),
        }
        g = j['move']['grid']
        site = {
            'site': j['site'], 'criteria': j['criteria'], 'mission_days': j['mission_days'],
            'max_slope_deg': j['max_slope_deg'], 'terrain': j['terrain'],
            'calendar': {k: c[k] for k in ('sun_pct', 'earth_pct', 'both_pct', 'longest_dark_h', 'longest_no_comm_h', 'ok', 'wait_days', 'min_mast_m', 'nearest_move_km', 'mast_ok')},
            'mast_metrics': {k: {h: c[k][h] for h in H} for k in ('mast_sun_pct', 'mast_earth_pct', 'mast_longest_dark_h') if k in c},
            'move': {'step_km': j['move']['step_km'], 'radius_km': j['move']['radius_km'],
                     'grid': [{'dx': p['dx_km'], 'dy': p['dy_km'], 'landable': p['landable'], 'slope': p['slope_deg'],
                               'ok_days': p['ok_days'],
                               **({'sun': p['cal_sun_pct'], 'earth': p['cal_earth_pct'], 'dark': p['cal_longest_dark_h']}
                                  if p['landable'] and 'cal_sun_pct' in p else {})} for p in g]},
        }
        json.dump(site, open(os.path.join(D, mode, sid + '.json'), 'w'), separators=(',', ':'))

os.makedirs(os.path.join(D, 'sky'), exist_ok=True)
for s in sites:
    sy = json.load(open(os.path.join(OUT, s['id'] + '_sky_year.json')))  # 14 d file covers the longer period
    json.dump(sy, open(os.path.join(D, 'sky', s['id'] + '.json'), 'w'), separators=(',', ':'))
json.dump(index, open(os.path.join(D, 'index.json'), 'w'), separators=(',', ':'))
import shutil
for f in ('masts.json', 'move_sensitivity.json', 'nogo_stats.json'):
    shutil.copy(os.path.join(HERE, '..', 'lunar', f), os.path.join(D, f))
os.makedirs(os.path.join(D, 'orientation'), exist_ok=True)
for f in ('landmarks.json', 'landers.json'):
    shutil.copy(os.path.join(HERE, '..', 'lunar', 'orientation', f), os.path.join(D, 'orientation', f))
shutil.copy(os.path.join(HERE, '..', 'web', 'site-selection.html'), os.path.join(HERE, 'selection.html'))
hb = os.path.join(HERE, '..', 'web', 'hillshade.b64')
if os.path.exists(hb):
    raw = open(hb).read().strip()
    if raw.startswith('data:'): raw = raw.split(',', 1)[1]
    open(os.path.join(D, 'hillshade.jpg'), 'wb').write(base64.b64decode(raw))
print('ok')
