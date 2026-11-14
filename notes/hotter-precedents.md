# "Did It Really Get Hotter?" 선례 조사 (2026-11-13)

Sonnet 서브에이전트로 조사했어요. [V]는 직접 확인한 것, [U]는 기억이나 추정이라 확인이 필요한 것이에요.

## 기존 서비스

| 서비스 | 하는 일 | 위치 / 출생연도 | 유의성 검정 | 링크 |
|---|---|---|---|---|
| NYT "How Much Hotter Is Your Hometown Than When You Were Born?" (2018) | 도시와 출생연도를 넣으면 기온과 32°C 이상 날 수가 얼마나 바뀌었는지, 앞으로 어떻게 될지 보여 줌. 관측값이 아니라 모델값이라는 비판을 받음 | 예 / 예 | 없음 [U] | nytimes.com/interactive/2018/08/30/climate/how-much-hotter-is-your-hometown.html [U] |
| BBC·Carbon Brief (Berkeley Earth 기반) | 도시별 과거 온난화와 미래 전망. 격자가 약 100 km로 거칢 | 예 / 아니오 | 없음 | https://www.carbonbrief.org/mapped-how-every-part-of-the-world-has-warmed-and-could-continue-to-warm |
| NASA SVS Hometown Dashboard | 지역별 기후 정보와 1950~2100년 전망. **NASA 이름을 단 가장 가까운 경쟁자** | 예 / ? | ? (열리지 않아 확인 못함) | https://svs.gsfc.nasa.gov/webapps/hometown-dashboard/ |
| Ed Hawkins #ShowYourStripes | 온난화 줄무늬 그래픽. 일부러 통계를 넣지 않음 | 예 / 아니오 | 없음 | showyourstripes.info |
| Meteoblue Climate Change | 전 세계 도시별 연 기온·강수와 줄무늬. ERA5 기반, 약 30 km, 1979년부터 | 예 / 아니오 | 없음. 점선 추세선만 있고 수치는 없음 | meteoblue.com/en/climate-change |
| Climate Central (Climate Shift Index) | 오늘 더위가 인간 영향으로 몇 배 더 잘 생겼는지 계산. 추세 검정이 아니라 원인 분석 | 예 / 아니오 | 다른 방식 | climatecentral.org |
| Berkeley Earth, IPCC Atlas, Copernicus | 전문가용 도구. IPCC Atlas는 미래 전망에 유의성 표시가 있음 [U] | 지역 단위 | 일부 | |

## 이전 Space Apps
- "Earth System Trend Detective"라는 제목은 이전 연도에서 찾지 못했어요. 올해 새로 생긴 챌린지일 가능성이 높아요.
- 비슷한 과거 챌린지가 있었어요. 2021 "Warning: Things are Heating Up!", 2024 "Uncover the Role of Greenhouse Gases in Your Neighborhood".
- 맨-켄달 검정에 출생연도와 고향을 결합한 출품작은 찾지 못했어요. Devpost와 GitHub 추가 검색을 권해요.

## 비어 있는 부분 (확인한 도구 중 아무도 안 하는 것)
1. 내 위치와 내 기간에 대한 명시적 유의성 검정
2. "우연일 확률 약 2%" 같은 쉬운 말 판정. 자기상관을 보정한 맨-켄달 검정과 센 기울기를 함께 써요
3. 검증 결과를 사용자에게 공개하기. 관측소와 비교한 결과와, 추세 없는 가짜 데이터로 잰 오탐률을 보여 줘요
4. 평균기온, 폭염 일수, 강수를 같은 자료로 함께 판정하기

## 결론
- "태어난 뒤 내 고향" 콘셉트는 새롭지 않아요(NYT 2018). 새롭다고 주장하면 안 돼요.
- 차별점은 "정직한 통계 판정 + 보이는 검증"이에요. 이 조합은 찾지 못했지만 조사 범위에 한계가 있어요.

## NASA POWER 주의점
- 일별 기상 자료는 1981-01-01부터 있어요 [V]. 최근 몇 달은 MERRA-2가 아니라 GEOS FP-IT로 채워서 중간에 자료 출처가 바뀌어요. 방법 설명에 밝히거나, 최근 몇 달을 빼야 해요.
- 해상도는 0.5° × 0.625°로 약 50~60 km 격자예요. "주소" 단위보다 거칠어요.
- 공식 요청 한도 수치는 없지만, 같은 위치를 반복 호출하면 차단될 수 있어요. 캐시를 써야 해요.
- 라이선스와 인용 문구는 문서에서 확인하지 못했어요. 보통 "NASA Langley Research Center POWER Project"로 인용해요 [U].
