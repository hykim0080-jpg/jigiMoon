# 착륙 지점 선정 근거 페이지 (인계 메모, 2026-11-14)

- 게시본: https://claude.ai/artifact/L8p3c2KB1Krw4YSKmyzLcY (제목 "달 남극 착륙 지점 선정 근거", 현기 소유, 비공개)
- `site-selection.html`: 게시한 완성 파일 (한 파일, 약 470 KB)
- `template.html`: 원본. `__DATA__`, `__HILL__` 자리표시자를 채워 만든다
- `data.json`: 12개 지점, NASA 지역 상자, 검증 결과 (원자료: ../lunar/sites.json, ../lunar/out/, ../lunar/validation*.json)
- `hillshade.b64`: 배경 음영도 JPEG(base64). LOLA LDEM_80S_80MPP_ADJ, 남극 ±200 km, 700×700, 위쪽 = 경도 0°
- 만들기: `python3 -c "t=open('template.html').read(); t=t.replace('__DATA__',open('data.json').read()).replace('__HILL__',open('hillshade.b64').read()); open('site-selection.html','w').write(t)"`
- 디자인: Fable이 다듬음. 원칙 = 보조 라벨·설명 최소화, 레이아웃으로 전달. 팀 이름 Moon-jigi
- 지도 좌표 변환: px = (x_km + 200)/400*700, py = (200 - y_km)/400*700 (남극 입체 투영, R = 1737.4 km)
- 3D 시간 슬라이더 지도는 아직 시작 전 (프레임 계산은 계산 스레드에 요청)
