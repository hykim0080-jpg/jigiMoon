# SAR 도시 침수 탐지 선행 연구 정리 (2026-11-12)

조사: Sonnet 서브에이전트 2개(논문 / 운영 서비스·도구). **V** = 원문이나 초록을 직접 확인함, **M** = 기억이나 검색 요약에 의존해서 인용 전 확인 필요.

## 결론
- "도시에서 침수되면 밝아진다(이중 반사)"와 "간섭 일관성(coherence)이 떨어진다"를 신호로 쓰는 방법은 **새롭지 않음**. 2014년부터 여러 번 발표됐고, 공개 데이터셋 UrbanSARFloods의 라벨도 바로 이 방식으로 만들었음.
- 아직 비어 있는 곳: (1) 여러 해의 사건을 쌓은 **도시 반복 침수(빈도) 지도**(찾지 못함, 확신도 낮음), (2) 홍수가 없던 기간을 대조군으로 쓴 **오탐률 측정**, (3) 감시가 부족한 여러 대륙 도시에 적용하고 투명하게 검증하기, (4) NISAR(L-band) 시연.
- 발표는 "새 방법"이 아니라 "검증된 원리를 계획용 제품으로 바꾼 것"으로 잡고 아래 논문을 인용할 것.

## 핵심 논문
| 논문 | 방법 | 성과·한계 | 링크 |
|---|---|---|---|
| Mason et al. 2014, JAG 28:150 (V) | TerraSAR-X 3 m + LiDAR DSM, 이중 반사 모델 | 표본이 아주 작음. 위성 비행 방향과 평행한 거리에서만 잘 됨 | https://centaur.reading.ac.uk/35451/ |
| Mason, Dance, Cloke 2021, JARS 15(3) (V) | Sentinel-1에서 밝아짐 변화 + WSF 도시 마스크 + WorldDEM | **우리 발상과 가장 가까움.** DSM이 필요하고 밀집 지역에서 정확도가 떨어짐 | https://reading-clone.eprints-hosting.org/95506 |
| Chini et al. 2019, Remote Sensing 11(2):107 (V) | Sentinel-1 coherence 하락, 휴스턴 사례 | 정량 지표 없음, 사건 1건 | https://iris.uniroma1.it/handle/11573/1449537 |
| Li et al. 2019, Remote Sensing 11(19):2231 (V) | 밝기 + coherence를 베이지안 네트워크로 결합 | 휴스턴 정확도 94.5%, 조소(ALOS-2) 89.6%. 사건 2건 | https://mdpi.com/2072-4292/11/19/2231 |
| Zhao et al. 2024, CVPRW, UrbanSARFloods (V) | 데이터셋: 18개 사건, 5개 대륙, 20 m | 라벨이 coherence 하락 0.3 기준이라 순환적임. 도시 F1 대부분 0.25 미만 | https://arxiv.org/abs/2406.04111 |
| Ohki et al. 2020, Remote Sensing 12(17):2709 (V) | ALOS-2 L-band + 홍수 모델 융합 | 도시 특화인지 확인 못함 | doi:10.3390/rs12172709 |

확인 필요(M): Giustarini 2013, Pulvirenti 2016, Tanguy 2017, Cian 2018, Martinis 2018 / Rättich 2020, Pelich·Chini의 확률적 도시 침수 연구.

## 실패 요인
- 건물·거리 방향이 위성 관측 방향과 어긋나면 신호가 약함.
- 밀집 주거지: 그림자와 겹침(layover), 거리 폭이 픽셀보다 좁음.
- 홍수 전 기준 영상이 필요함. coherence는 짧은 시간 간격과 적은 식생이 필요함.
- 공사·철거·차량·습기 변화가 오탐으로 잡힘. 사건마다 임계값을 따로 맞춰야 함.

## 운영 서비스
- **Copernicus GFM**: 도시를 "감도 없음(no sensitivity)" 제외 마스크의 예로 듦. 침수되지 않은 것으로 분류된 픽셀만 가리며, 문서 스스로 도시에서는 과소 추정이 많다고 함(PUM §3.4, §4.2. 요약 표현이므로 인용 전 PDF 원문 확인). https://extwiki.eodc.eu/gfm_assets/gfm4.0_pum_2025.pdf
- **NASA OPERA**
  - DSWx-S1: 남극을 뺀 전 지구, 30 m, 2024년 9월부터. 도시 마스크 처리 여부는 확인 못함.
  - DISP-S1(지반 변위)과 CSLC-S1: **북미만** 다룸.
- **Copernicus EMS EXFLOS(2025년 9월)**: 도시 주변에서 관측한 물로 도시 안 침수를 모델링함. 사건마다 요청해서 쓰는 방식. https://emergency.copernicus.eu/news/a-more-powerful-tool-for-mapping-urban-floods/
- **ICEYE Flood Insights**: 상용 서비스이고, 도시용 방법은 공개되지 않음.
- **Global Flood Database**: MODIS 250 m라 도시에는 너무 거침.

## NISAR (ASF에서 무료, Earthdata 로그인 필요)
- 2026-02-27: 베타 데이터 공개.
- 2026-07-20: 잠정(Provisional) 데이터 공개. GCOV, GSLC, GUNW 등 포함.
- 2026-11-06: 검증(Validated) L0~2 제품 공개. 2026-10-21 촬영분부터.
- 2026-07-27 ~ 08-10: 관측 공백.
- 보관 기간이 약 1년이라 반복 침수 분석에는 부족함. NISAR 기반 도시 침수 제품은 찾지 못함. DSWx-NI는 아직 공개 전.
- https://nisar-docs.asf.alaska.edu/availability-overview/

## 도구·데이터 접근
- **ASF HyP3**: 월 8,000 크레딧 무료. RTC 30 m는 5 크레딧. InSAR(coherence 포함)는 80 m / 40 m라 도시에는 거침.
- **Earth Engine S1 GRD**: 바로 쓸 수 있지만 coherence는 없음.
- **오픈소스**
  - UrbanSARFloods: https://github.com/jie666-6/UrbanSARFloods. 라이선스는 CC BY-NC-SA로 보이지만 확인 필요.
  - HYDRAFloods: GPLv3, 도시 처리 없음.
  - UN-SPIDER coherence 튜토리얼: https://www.un-spider.org/node/13460
