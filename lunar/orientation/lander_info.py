"""Short map label and one-line purpose (en/ko) for each spacecraft in landers.json.
Run after landers.py: python3 lander_info.py landers.json"""
import json, sys
INFO = {
 "im-2-athena": ("IM-2 2025", "NASA CLPS lander carrying an ice drill (PRIME-1) and a hopper; landed on its side and ended early.",
                 "얼음 드릴(PRIME-1)과 호퍼를 실은 NASA CLPS 착륙선. 옆으로 누운 채 착륙해 일찍 끝남."),
 "im-1-odysseus": ("IM-1 2024", "First commercial soft landing on the Moon, carrying NASA instruments; came to rest tipped.",
                   "NASA 장비를 실은 첫 민간 연착륙. 기울어진 채 멈춤."),
 "lcross-centaur": ("LCROSS 2009", "Spent Centaur rocket stage aimed into Cabeus to throw up a plume; the plume showed water ice.",
                    "다 쓴 센타우르 로켓을 카베우스에 일부러 충돌시켜 분출물을 일으킴. 분출물에서 물 얼음 확인."),
 "lcross-ssc": ("", "Shepherding spacecraft that flew through the Centaur plume to measure it, then struck Cabeus minutes later.",
                "센타우르 분출물 속을 지나며 측정한 뒤 몇 분 후 카베우스에 충돌한 동반 탐사선."),
 "lunar-prospector": ("Lunar Prospector 1999", "Orbiter steered into a shadowed crater at mission end to look for a water-vapour plume; none was seen.",
                      "임무 끝에 영구 그림자 크레이터로 충돌시켜 수증기를 찾으려 한 궤도선. 관측되지 않음."),
 "viper": ("VIPER (cancelled)", "NASA rover planned to map water ice near Nobile; cancelled in 2024 before launch.",
           "노빌레 근처 물 얼음을 탐사할 예정이던 NASA 로버. 2024년 발사 전 취소."),
 "change-7": ("Chang'e-7 2027", "Chinese orbiter, lander, rover and hopper to search for water ice near Shackleton.",
              "섀클턴 근처 물 얼음을 찾을 중국의 궤도선·착륙선·로버·호퍼."),
 "chandrayaan-1-mip": ("Chandrayaan-1 MIP 2008", "Probe dropped from India's first lunar orbiter; measured the thin lunar atmosphere on the way down.",
                       "인도 첫 달 궤도선에서 떨어뜨린 충돌 탐침. 내려가며 희박한 달 대기 측정."),
 "chandrayaan-3": ("Chandrayaan-3 2023", "India's first soft landing, the closest to the south pole at the time (69.4° S).",
                   "인도 첫 연착륙. 당시 남극에 가장 가까운 착륙(남위 69.4°)."),
 "chandrayaan-2": ("Chandrayaan-2 2019", "India's Vikram lander, lost during its final descent.", "인도 비크람 착륙선. 마지막 하강 중 실패."),
 "luna-25": ("Luna-25 2023", "Russian south-pole lander; crashed after an orbit-change burn ran too long.",
             "러시아 남극 착륙선. 궤도 변경 분사가 너무 길어 추락."),
}
for f in sys.argv[1:]:
    L = json.load(open(f, encoding="utf-8"))
    for l in L:
        if l["id"] in INFO:
            l["short"], l["purpose_en"], l["purpose_ko"] = INFO[l["id"]]
    json.dump(L, open(f, "w"), ensure_ascii=False, indent=1)
    print("ok", f)
