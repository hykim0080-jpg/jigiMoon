// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Web copy of the contour line map: lunar/linemap/linemap.svg (made by lunar/linemap/build_linemap.py) without its
// label group (the app draws its own landmark names), rendered at 4000 px by headless Chromium, then saved as a
// greyscale WebP (quality 40, about 1.3 MB):
//   node build_linemap_web.js path/to/linemap.svg            -> linemap_raw.png
//   python3 -c "from PIL import Image; Image.open('linemap_raw.png').convert('L').save('data/linemap_4000.webp', 'WEBP', quality=40, method=6)"
const fs = require('fs'), path = require('path'), { chromium } = require('playwright');
(async () => {
  const src = fs.readFileSync(process.argv[2], 'utf8'), a = src.indexOf('<g id="labels"'), b = src.indexOf('</g>', a) + 4;
  const tmp = path.resolve('linemap_nolabels.svg'); fs.writeFileSync(tmp, a < 0 ? src : src.slice(0, a) + src.slice(b));
  const br = await chromium.launch(), p = await br.newPage({ viewport: { width: 4000, height: 4000 } });
  await p.goto('file://' + tmp); await p.screenshot({ path: 'linemap_raw.png' }); await br.close();
})();
