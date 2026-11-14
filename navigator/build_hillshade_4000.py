"""Run: python3 build_hillshade_4000.py LDEM_80S_40MPP_ADJ.TIF data/hillshade_4000.jpg  (https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/)
data/hillshade_4000.jpg: +-200 km hillshade at 100 m/px from PGDA LOLA LDEM_80S_40MPP_ADJ (average-downsampled)."""
import sys,numpy as np,rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from PIL import Image
src_path=sys.argv[1]; out=sys.argv[2]
R=200000;n=4000;res=2*R/n
with rasterio.open(src_path) as src:
    a=src.read(1,window=from_bounds(-R,-R,R,R,src.transform),out_shape=(n,n),resampling=Resampling.average).astype(float)
gy,gx=np.gradient(a,res); dzdx,dzdy=gx,-gy
slope=np.arctan(np.hypot(dzdx,dzdy)); asp=np.arctan2(dzdy,dzdx)
az=np.radians(135); alt=np.radians(35)
hs=np.clip(np.sin(alt)*np.cos(slope)+np.cos(alt)*np.sin(slope)*np.cos(asp-az+np.pi),0,1)
Image.fromarray((30+200*hs**0.9).astype(np.uint8)).save(out,quality=82)
print('done',a.shape)
