# 달 남극 착륙지 처방 도구: 계산 코드 (실제 지형 버전, 2026-11-14)

착륙 날짜가 밀리면 그 자리의 햇빛(전력)과 지구 직접 통신이 어떻게 바뀌는지, 안 되면 **기다리기 / 마스트 높이기 / 옮기기** 중 무엇으로 해결되는지를 계산한다. 실제 NASA LOLA 지형과 JPL 천체력을 쓴다.

## 결과 파일 (`out/`)
- `out/<id>.json`: 사이트별 결과 (웹용, 약 270 KB). 형식은 아래 "JSON 형식"
- `out/<id>_sky_year.json`: 하늘 돔용 2027년 전체 시간별 해·지구 위치와 가림 여부 (약 260 KB)
- `out/summary_2027.json`: 사이트별 1년 요약 (가능한 날 수, 각 처방으로 해결되는 날 수 등)
- `out/mission_6d/`: 같은 계산을 임무 6일(Artemis III 실제 체류 약 6일)로 한 결과. 파일 이름·형식 동일 (`MISSION_DAYS=6 python run_site.py`)
- `sites.json`: 12개 사이트 좌표와 고른 방법, `region_boxes.json`: NASA 지역 지도에서 읽은 지역 상자(지도 좌표, m)
- `validation.json`, `validation_coarse80m.json`: PGDA 조도 지도와 비교한 검증 결과
- `sample_output_synthetic.json`: 예전 가짜 지형 예시(이전 형식). 이제는 `out/`을 쓰면 된다

사이트 id: `peak-near-cabeus-b, haworth, malapert-massif, mons-mouton-plateau, mons-mouton, nobile-rim-1, nobile-rim-2, de-gerlache-rim-2, slater-plain` (Artemis III 후보 9개 지역), `shackleton-rim`, `connecting-ridge`, `im-2-athena`.

## 계산 조건
- 기간: 2027-01-01 ~ 2028-03-16 UTC, 1시간 간격. **착륙일 = 2027년 365일 각각** (`calendar`), 임무 14일
- 기준: 햇빛 ≥ 70%, 연속 어둠 ≤ 50시간, 지구 보이는 시간 ≥ 50% (`criteria`)
- 기본 착륙 시각(`base`, `wait`, `mast`, `move`의 기준): 2027-06-01 00:00 UTC. 다른 날짜는 `calendar`로 본다
- 관측 높이(태양전지판·안테나): 2 m. 마스트 비교 2·5·10·20·40 m
- 햇빛 = 태양 원반 중 지형 위로 보이는 비율(0~1), 0.1 미만이면 "어둠". 지구 = 지구 중심이 지형 위에 있으면 "보임"
- 옮기기: 반경 3 km 안 0.25 km 격자(441지점), **착륙 경사 ≤ 8°**(지점 중심과 주변 15 m 8곳의 최대 경사)인 곳만 후보

## JSON 형식 (현기 웹용, 기존 키 유지 + 추가)
- `site`: {lat, lon, x_m, y_m, id, name, group, selection}
- `criteria`, `mission_days`, `max_slope_deg`, `landing_utc`, `period_utc`
- `base`: 기본 착륙 시각의 지표 {sun_pct, earth_pct, both_pct, longest_dark_h, longest_no_comm_h, hours_to_sunset, hours_to_earthset, ok, slope_deg}. hours_to_sunset = 0이면 착륙 순간 이미 어둠
- `wait`: {days, ...지표} 또는 null(60일 안에 없음)
- `mast`: [{mast_m, ...지표, ok}]
- `move`: {grid:[{dx_km, dy_km, ok, ok_light, landable, slope_deg, slope_proxy, sun_pct, earth_pct, longest_dark_h, ok_days}], best, best_dist_km, step_km, radius_km}
  - dx = 지도 x(경도 90°E 쪽), dy = 지도 y(경도 0° 쪽) 방향, km
  - ok = 빛·통신 기준 충족 **그리고** 경사 ≤ 8°. ok_light = 빛·통신만. landable = 경사만
  - ok_days = 2027년 착륙일별 ok 여부 문자열("0101…", 365자)
- **`calendar` (새로 추가)**: 착륙일(2027-01-01부터 365일)별
  - sun_pct, earth_pct, both_pct, longest_dark_h, longest_no_comm_h: 길이 365 배열
  - ok: "0101…" 365자
  - wait_days: 그날 안 되면 며칠 기다리면 되는지(0 = 그날 가능, null = 60일 안에 없음)
  - min_mast_m: 그날 기준을 맞추는 가장 낮은 마스트 높이(null = 40 m로도 안 됨)
  - nearest_move_km: 그날 가능한 가장 가까운 지점까지 거리(null = 3 km 안에 없음)
  - mast_ok: {"2": "0101…", …} 2·3·5·7·10·15·20·30·40·50·75·100 m (40 m는 예전 값, `mast_heights_m`에는 없음)
  - min_mast_m: 그날 기준을 맞추는 가장 낮은 높이 (`mast_heights_m` 11단계 중, 100 m로도 안 되면 null)
  - mast_sun_pct / mast_earth_pct / mast_longest_dark_h: {"<높이>": 365개 배열} (`mast_calendar.py`로 추가)
- `sky`: 하늘 돔용 (기본 착륙 시각부터 14일) {az_step, horizon_el[720], sun_az[], sun_el[], earth_az[], earth_el[], sun_frac[], earth_vis[], step_h}
- `terrain`: 쓴 지형 층(이름, 해상도, 범위)
- 방위각: 그 지점의 북쪽(= 달 북극 방향)에서 시계 방향, 동 = 90°

## 2027년 요약 (`out/summary_2027.json`)
| 사이트 | 기준 충족 착륙일 | 안 되는 날 중 3 km 안 이동으로 해결 | 마스트로 해결 | 기다리기 중앙값 |
|---|---|---|---|---|
| Connecting Ridge | 133/365 | 36/232 (중앙값 0.71 km) | 56/232 | 11일 |
| de Gerlache Rim 2 | 94/365 | 22/271 (중앙값 0.56 km) | 18/271 | 11일 |
| Haworth | 126/365 | 63/239 (중앙값 2.36 km) | 67/239 | 10일 |
| IM-2 Athena (Mons Mouton) | 49/365 | 26/316 (중앙값 1.06 km) | 14/316 | 13일 |
| Malapert Massif | 166/365 | 50/199 (중앙값 0.46 km) | 95/199 | 8일 |
| Mons Mouton Plateau | 108/365 | 56/257 (중앙값 1.12 km) | 61/257 | 11일 |
| Mons Mouton | 144/365 | 78/221 (중앙값 1.46 km) | 130/221 | 9일 |
| Nobile Rim 1 | 168/365 | 49/197 (중앙값 2.5 km) | 29/197 | 9일 |
| Nobile Rim 2 | 62/365 | 14/303 (중앙값 1.24 km) | 12/303 | 14일 |
| Peak near Cabeus B | 92/365 | 33/273 (중앙값 0.25 km) | 49/273 | 11일 |
| Shackleton rim | 132/365 | 6/233 (중앙값 0.25 km) | 31/233 | 9일 |
| Slater Plain | 60/365 | 5/305 (중앙값 0.35 km) | 6/305 | 13일 |

(햇빛·통신 기준이 모두 맞는 날이 1년 중 13~46%뿐이다. 지구 보임 ≥ 50% 조건이 가장 자주 걸린다.)

## 사이트를 고른 방법
- **Artemis III 9개 지역:** NASA는 지역 좌표를 숫자로 공개하지 않는다. NASA 공식 지역 지도(2024-10, 아래 출처)를 PGDA 5 m 타일 5곳과 맞춰 위치를 맞췄다(배율 0.2794 km/픽셀, 잔차 최대 0.33 km). 지역 상자는 `region_boxes.json`
- 상자 안 대표 지점 규칙(모든 지역 동일): PGDA 18.6년 평균 조도 지도에서 경사 ≤ 8°이고 지구 보임 ≥ 50%인 화소 중 햇빛 상위 15곳(서로 300 m 이상) → 각 지점과 주변 20 m 4곳을 우리 5 m 모델(18.6년, 6시간 간격)로 다시 계산해 가장 밝은 곳. (Slater Plain은 지구 50% 화소가 없어 햇빛+지구 합 최대)
- **Shackleton rim / Connecting Ridge:** PGDA 5 m 타일 Site04 / Site01 범위에 같은 규칙
- **IM-2 Athena:** LROC가 공개한 목표 지점 (-84.78°, 29.13°E). 실제 착지는 약 250 m 떨어짐
- 지점 선택은 우리 규칙이며 NASA가 정한 착륙 지점이 아니다

## 검증 (PGDA Lunar Polar Illumination, products/69)
PGDA 지도는 18.6년 평균, 표면 높이, 60 m(85°S 안) / 120 m(그 밖) 해상도. 같은 정의(햇빛 = 원반 비율, 지구 = 원반 일부라도 보임)로 2008-01-01부터 18.6년, 3시간 간격, 관측 높이 0.5 m로 계산해 비교.
| 비교 | 지점 수 | 햇빛 평균차(%p) | 햇빛 평균 절대오차 | 햇빛 최대 | 지구 평균차 | 지구 평균 절대오차 | 지구 최대 |
|---|---|---|---|---|---|---|---|
| 같은 해상도(80 m 지형), 무작위 지점 | 24 | -1.4 | 2.3 | 9.2 | +0.2 | 2.7 | 27.8 |
| 같은 해상도(80 m 지형), 선택 지점 | 12 | -2.4 | 4.6 | 10.2 | -0.6 | 1.7 | 5.4 |
| 우리 5 m 지형, 무작위 지점 | 24 | -2.9 | 3.2 | 10.2 | -1.5 | 3.5 | 23.1 |
| 우리 5 m 지형, 선택 지점 | 12 | -7.3 | 7.3 | 38.7 | -0.9 | 1.9 | 8.5 |

- 무작위 지점 = 각 사이트에서 1~3 km 떨어진 임의 지점 2곳씩(24곳). 선택 지점 = 12개 사이트
- **같은 해상도로 맞추면 햇빛 평균 절대오차 2.3%p, 지구 2.7%p**: 계산 방법(천체력·지평선·곡률)은 PGDA와 맞는다
- 5 m 지형을 쓰면 극 가까운 능선 지점에서 차이가 커진다(Shackleton rim 0.5 m 높이에서 −39%p). 60 m 지도가 못 보는 바로 옆 경사가 낮은 해를 가리기 때문이고, 이것이 고해상도 지형을 쓰는 이유다
- 지구 최대 차이(28%p)는 지구가 지평선에 걸치는 지점 하나(Shackleton 근처)에서 나왔다

## 코드
- `ephem.py`: 달 표면 한 점에서 본 해·지구 방위·고도. JPL DE421 + IAU 2009 달 자전 모델(LOLA의 ME 좌표계 근사)
- `horizon.py`: 극 입체 투영, 여러 해상도 지형 합치기(`DEMStack`), 360° 지평선(0.5° 간격, 150 km까지, 곡률 보정), 가림 계산
- `terrain.py`: 사이트 주변 지형 묶음 만들기 5 m → 20 m → 80 m → 240 m, 경사
- `prescribe.py`: 지표, 처방 3가지, 1년 달력
- `select_sites.py`: 지역별 대표 지점 고르기, `run_site.py`: 사이트 계산 실행, `validate.py`: 검증

```
pip install skyfield skyfield-data numpy rasterio
# 데이터: ~/data/dem/LDEM_80S_80MPP_ADJ.TIF, LDEM_60S_240MPP_ADJ.TIF, AVGVISIB_*.TIF
#         ~/data/tiles/<Site>_final_adj_5mpp_{surf,slp}.tif   (20 m 층은 인터넷에서 필요한 부분만 읽음)
python run_site.py connecting-ridge      # 사이트 하나 약 2~3분 (격자 441지점 × 1년)
```

## 확인된 데이터 규약 (PGDA README와 파일 머리글로 확인)
- 좌표: `+proj=stere +lat_0=-90 +lon_0=0 +R=1737400`, x = ρ sin(경도), y = ρ cos(경도). `ll_to_xy`가 pyproj와 1 mm 이내로 일치
- 높이: m, 반지름 1737.4 km 구 기준, DE421의 MOON_ME 좌표계
- 화소: GMT "pixel-registered" → GeoTIFF 변환값은 화소 **모서리**. 예전 코드는 반 칸(2.5 m) 어긋나 있었고 고쳤다

## 한계
- 지형 자체 오차: 5 m 지도도 약 90%가 보간(PGDA 설명). 높이 오차 중앙값 0.3~0.5 m, 경사 1.5~2.5°
- 극 근처는 해 고도가 1.5° 안팎이라 관측 높이에 매우 민감하다. 예: Shackleton rim 지점은 0.5 m에서 18.6년 평균 햇빛 47%, 2 m에서 81%. 웹에서 "마스트 높이" 처방이 중요한 이유이기도 하다
- 달 자세는 IAU 2009 모델(ME 좌표계 근사). 정밀 SPICE 커널(moon_pa_de421)보다 방향 오차가 작게(0.01° 미만 추정, 확인 필요) 남을 수 있다
- 지구 "보임"은 지구 중심 기준이고, 실제 통신은 DSN 지상국 가시성도 따져야 한다
- Artemis III 실제 표면 체류는 약 6일(LPSC 2026 초록 1901). 여기서는 임무 14일로 계산했다(`mission_days`로 바꿀 수 있음)

## 데이터·코드 출처와 라이선스 (대회 규칙상 모두 표기)
| 자료 | 출처 | 라이선스·이용 조건 |
|---|---|---|
| LOLA 5 m 남극 착륙지 DEM·경사 (Site01, Site04, Site06, Site11, Site20v2, Site23, DM2, SL2, Haworth, Site07) | NASA GSFC PGDA, https://pgda.gsfc.nasa.gov/products/78 ; Barker et al. 2021, PSS 203, 105119, doi:10.1016/j.pss.2020.105119 | NASA 공개 자료(미국 정부 저작물, 퍼블릭 도메인), 인용 요청 |
| LOLA 20 m / 80 m (80°S~), 240 m (60°S~) DEM, 20 m 경사 | NASA GSFC PGDA, https://pgda.gsfc.nasa.gov/products/90 (Barker et al.) | 위와 같음 |
| 평균 햇빛·지구 보임 지도 (AVGVISIB_85S_060M_201608, _75S_120M_, _EARTH) | NASA GSFC PGDA, https://pgda.gsfc.nasa.gov/products/69 ; Mazarico et al. 2011, Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030 | 위와 같음 |
| Artemis III 후보 9개 지역 지도 | NASA, https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ (이미지 credit: NASA/GSFC/ASU/JSC/AGDT) | NASA 미디어 이용 지침(출처 표기) |
| Artemis III 선정 설명 | George et al., LPSC 2026 abstract 1901, https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf | 인용 |
| IM-2 목표 지점 | LROC (NASA/GSFC/Arizona State University), https://www.lroc.asu.edu/images/1401 | 출처 표기 |
| 행성 천체력 DE421 | NASA JPL (Folkner et al. 2008), skyfield-data 패키지에 포함 | 퍼블릭 도메인 |
| 달 자전 모델 | IAU WGCCRE 2009, Archinal et al. 2011, Celest Mech Dyn Astr 109:101-135 | 논문 인용 |
| skyfield | https://rhodesmill.org/skyfield/ | MIT |
| skyfield-data | https://github.com/brunobord/skyfield-data | MIT (데이터는 퍼블릭 도메인) |
| numpy | https://numpy.org | BSD-3-Clause |
| rasterio (GDAL) | https://rasterio.readthedocs.io | BSD-3-Clause (GDAL: MIT/X) |
| pyproj (투영 확인에만 사용) | https://pyproj4.github.io/pyproj | MIT |
| scipy, Pillow (지역 지도 상자 위치 읽기에만 사용) | https://scipy.org, https://python-pillow.org | BSD-3-Clause, MIT-CMU(HPND) |

## 시간별 햇빛·지구 지도 (`frames/`, 3D 지도용)
- `frames2.py`로 만든다(방법은 `frames.py`). 남극 ±200 km, 500 m 화소(800×800), 2027-06-01 00:00 UTC부터 4시간 간격 178장(한 달)
- `f_NNN.png`: R = 태양 원반이 보이는 비율 ×255, G = 지구 중심이 보이면 255. `height.bin`: float32 800×800 높이(m). `meta.json`: 격자, 시각, 남극점에서 본 해·지구 방위·고도, 출처
- 화소마다 높이 2 m에서 해·지구 방향으로 150 km까지 LOLA 80 m(80°S 밖은 240 m) 지형을 따라가며 가림 판정(곡률 포함)
- 12개 지점 화소에서 사이트 계산과 비교하면 햇빛 상태 약 80%, 지구 96%가 일치. 차이는 해상도 때문이다(지도는 500 m 화소 중심·80 m 지형, 사이트는 정확한 지점·5 m 지형). 지점 수치는 `out/`을 쓴다

## 마스트 높이 (`masts.json`, `masts.py`)
- 높이 한계(근거): 착륙선 탑재 약 10 m, **실용 최대 20 m**(NASA VSAT: 10 m 이상 마스트 기준, 15 m 전개형 시연 붐, Langley 기준 설계 16 m, 20 m까지 검토), **구상 최대 100 m**(Honeybee LUNARSABER 약 100 m 구상, DARPA LunA-10; Astrobotic VSAT-XL 30 m 이상). 링크는 masts.json `height_limits.sources`
- 지점별로 2·3·5·7·10·15·20·30·50·75·100 m에서 2027년 평균 햇빛·지구 보임, 가장 긴 어둠, 가능 착륙일(6일·14일 임무)을 계산 (`curve`)
- 최적 마스트 정의: 2 m에서 한계 높이까지 늘 수 있는 가능 착륙일(6일 임무) 증가분의 90%를 얻는 가장 낮은 높이. 증가분이 10일 미만이면 2 m 유지. `optimal_mast_practical_m`(≤20 m), `optimal_mast_concept_m`(≤100 m)
- 높이를 올려 주로 좋아지는 것은 햇빛보다 **지구 보임**이다(예: Malapert 2 m 70% → 10 m 100%)

## 발표용 대표 숫자 (`nogo_stats.json`, `nogo_stats.py`)
- NO-GO일: 고른 지점(마스트 2 m)에 그날 착륙하면 기준(햇빛 ≥ 70%, 연속 어둠 ≤ 50 h, 지구 ≥ 50%)을 못 맞추는 날. 12곳 × 365일 = 4,380 사이트·날
- 해결 정의(각각 따로 셈): (a) 1 km 이내 경사 8° 이하 지점으로 옮기면 GO (b) 마스트 20 m 이하로 GO (c) N일 이내 기다리면 GO, (d) a·b·c(7일) 중 하나라도
- 6일 임무: NO-GO 2,678건(61.1%). 1 km 이동 10.4%, 20 m 마스트 14.6%, 7일 대기 46.3%, **셋 중 하나로 51.7%** 해결. 14일 대기면 80.1%
- 14일 임무: NO-GO 3,046건(69.5%). 1 km 6.3%, 20 m 15.4%, 7일 31.7%, 셋 중 하나 39.2%

## 이동 처방 민감도 (`move_sensitivity.json`, `sensitivity.py`)
- 6일 임무, 사이트마다 가장 많이 처방된 대안 지점 최대 8곳, 그 지점이 처방된 날 전부(총 430건)
- 지형 해상도: 가까운 층을 한 단계 거칠게(5 m 타일 → 20 m, 5 m 타일이 없는 곳은 20 m → 80 m) 바꿔도 GO 유지 **97.2%**
- 위치 오차: 처방 지점에서 30 m 떨어진 8방향에 착륙해도 GO 유지 **81.6%** (사이트별 73~94%)
- 같은 조건으로 다시 계산하면 100% 같은 판정(재현성)
- 해석: 처방은 지형 해상도에는 강하고, 착륙 정확도(수십 m)에는 약 5건 중 1건이 뒤집힌다. 실제 착륙 정확도 목표(예: IM-2 50 m 목표, 실제 250 m 벗어남)를 고려하면 처방 지점 주변의 '안전 반경'을 함께 보여 주는 것이 좋다

## 위치 인식(오리엔테이션) 데이터 (`orientation/`)
- `landmarks.json`: 남극점 + USGS Gazetteer 지형 26개. tier 1(항상 표시) = South Pole, Shackleton, Mons Malapert, Mons Mouton, Amundsen. tier 2 = Cabeus, Haworth, Shoemaker, Faustini, de Gerlache, Sverdrup, Nobile, Malapert, Slater, Mons Kocher. tier 3 = 나머지(+비공식 Connecting Ridge). 필드: id, name, name_ko, kind, tier, always_show, lat, lon, x_m, y_m, radius_km, diameter_km, source, relative.
- `landers.json`: 실제 착륙·충돌 지점(IM-2, IM-1, LCROSS Centaur/SSC, Lunar Prospector, VIPER 계획지 등)과 Artemis III 후보 지역(2024년 9곳, 2022년 13곳). 필드: id, name, mission, kind, status, date, lat, lon, x_m, y_m, in_view(±200 km 지도 안), relative, verify.
- 코드: `orientation.py`(landmarks + `describe(x, y)`), `landers.py`, 입력 `gaz_south.json`(Gazetteer 남극 추출).
- **상대 위치 규칙 (11-14 수정):** tier ≤ 2 랜드마크 중 "닿는 범위"까지 가장 가까운 것. 닿는 범위 = 크레이터는 반지름(테두리), 산(massif)은 Gazetteer 반지름의 0.5배(산 본체), 점은 0. 여러 범위 안에 있으면 (거리 ÷ 범위)가 작은 쪽. 방위는 지구 방향(지도 +y)에서 시계방향, 8구역(지구 쪽 / 지구 쪽 오른편 / 오른쪽 / 지구 반대쪽 오른편 / 지구 반대쪽 / … , 오른쪽 = 지도 +x). 문장: at(중심 0.5 km 이내 또는 산 중심부) → "무톤산"; rim(|d−r| ≤ max(1.5 km, 0.15r)) → "섀클턴 테두리 (왼쪽)"; inside → "카베우스 안 (왼쪽, 중심에서 26 km)"; on(산 범위 안) → "무톤산 위 (지구 쪽)"; beside(범위 밖 10 km 미만) → "섀클턴 옆 (왼쪽)"; 그 외 → "슬레이터에서 지구 반대쪽으로 19 km". 영어 text_en도 함께("on Mons Mouton, Earth side", "beside Shackleton, left side"). 칭동 때문에 실제 지구 방향은 ±7° 흔들림.
- `verify: true` 항목은 좌표를 1차 출처로 확인하지 못한 것(위키백과 값 또는 추정 위치). 화면에서는 "약" 표시 권장.
- 출처: USGS Gazetteer of Planetary Nomenclature (planetarynames.wr.usgs.gov, 공공 영역), LROC (lroc.asu.edu, IM-2 image 1408 등), NASA Artemis III 후보 지역 발표(2022·2024), LCROSS 위치 arXiv:1103.1687, 기타 항목별 `source` 필드 URL.

## 고해상도 음영 지도 (`navigator/data/hillshade_2800.jpg`)
- 2800×2800 회색 JPEG(q80, 143 m/px), ±200 km 극 입체 투영, 위 = 경도 0°(지구 쪽). px=(x_km+200)/400·W, py=(200−y_km)/400·W.
- LDEM_80S_80MPP_ADJ(PGDA) 평균 리샘플 → 음영(광원 방위 315°, 고도 35°) 0.75 + 고도 정규화(2–98%) 0.25. web/hillshade.b64(700 px)와 같은 방식, 축소 비교 상관 0.99.
