# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Make data/spot/<site>.jpg: hillshade of the PGDA LOLA 20 m/px DEM (LDEM_80S_20MPP_ADJ), +-4.5 km around each site.
Run: python3 build_spot.py  (needs rasterio and network access to pgda.gsfc.nasa.gov)"""
import json,os,numpy as np,rasterio
from rasterio.windows import from_bounds
from PIL import Image
idx=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'data','index.json')))
url='/vsicurl/https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF'
H=4500; out=os.path.join(os.path.dirname(os.path.abspath(__file__)),'data','spot'); os.makedirs(out,exist_ok=True)
import time
for s in idx['sites']:
    if os.path.exists(f"{out}/{s['id']}.jpg"): continue
    x,y=s['x_m'],s['y_m']
    for k in range(5):
      try:
        with rasterio.open(url) as src: a=src.read(1,window=from_bounds(x-H,y-H,x+H,y+H,src.transform)).astype(float)
        break
      except Exception as e: print("retry",e); time.sleep(3)
    else: print("FAIL",s["id"]); continue
    gy,gx=np.gradient(a,20.0)       # rows go south: gy = -dz/dy
    dzdx, dzdy = gx, -gy
    slope=np.arctan(np.hypot(dzdx,dzdy)); asp=np.arctan2(dzdy,dzdx)
    az=np.radians(135); alt=np.radians(35)   # light from upper-left (math angle 135)
    hs=np.sin(alt)*np.cos(slope)+np.cos(alt)*np.sin(slope)*np.cos(asp-az+np.pi)
    hs=np.clip(hs,0,1)
    img=(30+200*hs**0.9).astype(np.uint8)
    Image.fromarray(img).save(f"{out}/{s['id']}.jpg",quality=85)
    print(s['id'],a.shape,round(np.degrees(slope).max(),1))
