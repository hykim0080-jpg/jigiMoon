# 달 남극 3D 햇빛·지구 지도 (map3d)

남극 ±200 km 실제 지형 위에, 4시간마다 햇빛이 드는 곳(주황), 지구가 보이는 곳(파랑), 둘 다인 곳(초록)을 칠한다. 슬라이더·재생으로 한 달(약 178프레임) 동안 구역이 움직이는 모습을 본다. 2D 버튼 = 위에서 본 지도(위쪽 = 경도 0°, 지구 쪽).

## 파일
- `index.html`: 전체 화면 데모. 기본으로 `../frames/`(2027-06), `../frames_dec/`(2027-12), `../sites.json`을 읽는다. `?data=./a/,./b/&labels=...&sites=...`로 바꿀 수 있다
- `map3d.js`: 독립 모듈. 스타일은 `.lmap` 아래로 한정
- `vendor/`: Three.js r187 (three.module.js, three.core.js, OrbitControls.js, LICENSE)
- 데이터: `../frames/`, `../frames_dec/` (계산 스레드가 만듦, 형식은 각 폴더 `meta.json`의 `encoding`)

## 게시본
- https://claude.ai/artifact/JkSgM9Ei4r2dzieWV1qgtP (현기 소유, 비공개). 게시 도구가 .bin을 못 올려서 높이는 `height.png`(RGB, 값 = R·256+G, 높이 m = 값/2 − 20000, 0.5 m 단위)로 올렸고, `map3d.js`는 `height.bin`이 없으면 이것을 읽는다

## 다른 페이지에 붙이기
```html
<script type="importmap">{ "imports": { "three": "./vendor/three.module.js" } }</script>
<div id="m" style="height:600px"></div>
<script type="module">
  import { mountLunarMap } from './map3d.js';
  const map = mountLunarMap(document.getElementById('m'), {
    datasets: [{label:'2027-06', url:'../frames/'}, {label:'2027-12', url:'../frames_dec/'}],
    sitesUrl: '../sites.json' });
  // map: { destroy, setFrame, getFrame, play, pause, setMode('sun'|'earth'|'both'), setView('3d'|'2d'),
  //        setDataset, setExaggeration, selectSite, loaded, ready }
</script>
```
- 위치 인식: `landmarksUrl`, `landersUrl`(기본 `./orientation/…`, 데모는 `../orientation/`). 지구 방향 나침반, tier 1 랜드마크 이름 상시·tier 2는 확대 시, 크레이터 테두리, 착륙(▲)·충돌(×)·계획(△) 탐사선, 마우스 위치를 "섀클턴에서 지구 쪽으로 5 km"처럼 표시(`orientation.py`의 describe와 같은 규칙)
- 언어: 기본 영어(`lang:'en'`, 심사용), `?lang=ko` 또는 `lang:'ko'`로 한국어
- 옵션: `mode`, `view`, `exaggeration`(기본 3), `frame`, `onFrame(i, isoTime)`
- 정적 서버에서 열어야 한다(`python3 -m http.server`를 `lunar/`에서 실행 후 `/map3d/`). 파일을 바로 열면 브라우저가 데이터를 막는다
- 메모리: 한 달당 약 114 MB(프레임을 GPU 텍스처로 미리 올림)

## 계산 방법 (frames, 계산 스레드)
- 격자: 남극 입체 투영 800×800, 500 m, 관측 높이 2 m
- 화소·프레임마다 해·지구 방향으로 150 km까지 지형을 따라가며 가림 계산(달 곡률 포함). 햇빛 = 해 원반이 보이는 비율, 지구 = 지구 중심이 지평선 위
- 지형: LOLA 80 m(80°S 안) + 240 m(그 밖). 착륙지 수치(5 m 지형)와는 화소 크기 차이로 일부 프레임이 다를 수 있어서, 지도에는 프레임 수치를 숫자로 보여 주지 않는다

## 출처·라이선스
| 자료 | 출처 | 라이선스 |
|---|---|---|
| LOLA DEM LDEM_80S_80MPP_ADJ, LDEM_60S_240MPP_ADJ | NASA GSFC PGDA, https://pgda.gsfc.nasa.gov/products/90 (Barker et al.) | NASA 공개 자료(퍼블릭 도메인), 인용 요청 |
| 해·지구 위치 | JPL DE421 (skyfield-data), IAU 2009 달 자전 모델 (Archinal et al. 2011) | 퍼블릭 도메인 / 논문 인용 |
| 12개 후보지 | `../sites.json` (출처는 `../README.md`) | 위 README 참고 |
| 랜드마크·탐사선 위치 | `../orientation/` (USGS Gazetteer, LROC 등, 항목별 `source`) | 공공 영역 / 출처 표기 |
| Three.js r187 (+ OrbitControls) | https://threejs.org, npm `three@0.187.0` | MIT (`vendor/LICENSE`) |
