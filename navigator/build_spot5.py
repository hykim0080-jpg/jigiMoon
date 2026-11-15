# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""Make data/spot5/<site>.jpg: hillshade (2x vertical exaggeration) of the PGDA LOLA 5 m/px site tiles (https://pgda.gsfc.nasa.gov/products/78), +-4.5 km; outside a tile, the 20 m patch fills in.
Download <tile>_final_adj_5mpp_surf.tif into TILES first."""
import json,os,time,numpy as np,rasterio
from rasterio.windows import from_bounds
from PIL import Image
N=os.path.dirname(os.path.abspath(__file__))
idx=json.load(open(f'{N}/data/index.json')); out=f'{N}/data/spot5'; os.makedirs(out,exist_ok=True)
H=4500
for s in idx['sites']:
    tile=json.load(open(f"{N}/data/14/{s['id']}.json"))['terrain']['near_tile']
    if not tile: print('no tile',s['id']); continue
    url=os.path.join(os.environ.get('TILES','tiles'),f'{tile}.tif')
    x,y=s['x_m'],s['y_m']
    for k in range(5):
        try:
            with rasterio.open(url) as src:
                b=src.bounds; w=from_bounds(x-H,y-H,x+H,y+H,src.transform)
                a=src.read(1,window=w,boundless=True,fill_value=np.nan).astype(float); res=src.res[0]
            break
        except Exception as e: print('retry',s['id'],str(e)[:80]); time.sleep(3)
    else: print('FAIL',s['id']); continue
    nanfrac=np.isnan(a).mean()
    gy,gx=np.gradient(a,res); dzdx,dzdy=2*gx,-2*gy   # 2x vertical exaggeration so small relief reads at Spot zoom
    slope=np.arctan(np.hypot(dzdx,dzdy)); asp=np.arctan2(dzdy,dzdx)
    az=np.radians(135); alt=np.radians(35)
    hs=np.clip(np.sin(alt)*np.cos(slope)+np.cos(alt)*np.sin(slope)*np.cos(asp-az+np.pi),0,1)
    img=30+200*hs**0.9
    if nanfrac>0:   # outside the 5 m tile: fall back to the 20 m patch
        lo=np.asarray(Image.open(f"{N}/data/spot/{s['id']}.jpg").resize(img.shape[::-1],Image.BILINEAR),float)
        img=np.where(np.isnan(img),lo,img)
    img=img.astype(np.uint8)
    Image.fromarray(img).save(f"{out}/{s['id']}.jpg",quality=82)
    print(s['id'],tile,a.shape,res,'nan',round(nanfrac,3),os.path.getsize(f"{out}/{s['id']}.jpg")//1024,'KB')
