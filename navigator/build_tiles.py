# Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
"""data/t<res>/<col>_<row>.jpg: LOLA hillshade tiles of 250 px covering +-200 km (col 0 = west edge, row 0 = top/Earth side).
Run: python3 build_tiles.py LDEM_80S_40MPP_ADJ.TIF 40 data/t40   or   python3 build_tiles.py LDEM_80S_20MPP_ADJ.TIF 20 data/t20
Source: PGDA LOLA polar DEMs, https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/ . Processed one tile row at a time."""
import sys,os,numpy as np,rasterio
from rasterio.windows import from_bounds
from PIL import Image
src_path,res,out=sys.argv[1],float(sys.argv[2]),sys.argv[3]; os.makedirs(out,exist_ok=True)
R=200000; T=250; tk=T*res; n=int(round(2*R/tk)); tot=0
az=np.float32(np.radians(135)); alt=np.float32(np.radians(35))
with rasterio.open(src_path) as src:
    for r in range(n):
        top=R-r*tk
        a=src.read(1,window=from_bounds(-R-res,top-tk-res,R+res,top+res,src.transform)).astype(np.float32)
        gy,gx=np.gradient(a,res); dzdx,dzdy=gx,-gy
        slope=np.arctan(np.hypot(dzdx,dzdy)); asp=np.arctan2(dzdy,dzdx)
        hs=np.clip(np.sin(alt)*np.cos(slope)+np.cos(alt)*np.sin(slope)*np.cos(asp-az+np.float32(np.pi)),0,1)
        img=(30+200*hs**0.9).astype(np.uint8)[1:-1,1:-1]
        for c in range(n):
            f=f"{out}/{c}_{r}.jpg"; Image.fromarray(img[:,c*T:(c+1)*T]).save(f,quality=78); tot+=os.path.getsize(f)
print(n*n,'tiles',round(tot/1e6,1),'MB')
