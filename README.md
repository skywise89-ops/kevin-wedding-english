# 📸 Kevin's Wedding English

웨딩 포토그래퍼를 위한 **촬영 현장 영어** 학습 + 현장 참조 앱.
빌드 도구 없는 정적 사이트(HTML/CSS/JS), GitHub Pages 배포, 오프라인(PWA) 동작.

👉 https://skywise89-ops.github.io/kevin-wedding-english/

---

## 무엇이 들어 있나

| 탭 | 용도 |
|---|---|
| 🏠 **홈** | 오늘의 레슨, 간격반복 복습 큐, 스트릭·진도 통계, 20레슨 라이브러리 |
| ⚡ **현장** | 촬영 현장에서 바로 꺼내 쓰는 표현 **129개** — 14개 상황 카테고리, 즉시 검색, 즐겨찾기 고정, 탭 한 번에 발음 재생, 야외 고대비 모드 |
| 🎧 **연습** | 플래시카드(간격반복) · 20레슨 통합 랜덤 퀴즈 · 발음 섀도잉 채점 · 듣기 연속재생 |

- **4주 20레슨** — 하루 12분 (1분 회상 / 8분 학습 / 3분 출력)
  - Week 1 라포 형성 · Week 2 디렉팅 · Week 3 칭찬·상황대처 · Week 4 마무리·종합
- **간격반복(SM-2 lite)** — 체감 난이도(다시/어려움/보통/쉬움)에 따라 다음 복습일 자동 계산.
  지난 복습은 사라지지 않고 `D+n` 으로 밀린 순서대로 쌓입니다.
- **오프라인** — 한 번 열어두면 인터넷 없이 동작. 홈 화면에 추가하면 앱처럼 실행됩니다.

## 현장 모드 표현 카테고리

도착·첫인사 / 스몰토크·라포 / 포즈 디렉팅 / 동작·연출 / 표정·시선 / 미세 조정 /
칭찬·자신감 / 가족·단체 / 돌발 상황 / 못 알아들었을 때 / 이동·시간 안내 /
마무리·감사 / 결과물·후기 / 문화·배려

각 표현은 **영어 · 한국어 해석 · 쓰는 순간(뉘앙스)** 3단으로 되어 있고, 카드를 누르면 원어민 음성으로 읽어줍니다.

## 파일 구조

```
index.html              홈 대시보드
field.html              현장 모드
practice.html           연습(플래시카드·퀴즈·섀도잉·듣기)
lessons/0001~0020.html  레슨 페이지 (data/lessons.json 에서 생성)
data/lessons.json       레슨 단일 소스 (표현·용어·시나리오·대화·퀴즈·체크리스트·미션)
data/phrases.json       현장 모드 표현 인덱스 (129개, 14 카테고리)
assets/core.js          상태 저장 · SRS · TTS · 음성인식 · 공용 UI
assets/home.js          홈
assets/field.js         현장 모드
assets/practice.js      연습
assets/lesson.js        레슨 페이지 동작
assets/style.css        다크/라이트 테마
sw.js, manifest.webmanifest   PWA (오프라인·홈 화면 설치)
tools/build_lessons.py  data/lessons.json → lessons/*.html 재생성
tools/enrich.py         표현 한국어 해석·카테고리 → lessons.json + phrases.json
```

## 콘텐츠 수정하는 법

1. `data/lessons.json` 을 고친다 (표현, 대화, 퀴즈 등 모든 레슨 내용이 여기에 있습니다)
2. `python3 tools/build_lessons.py` 실행 → `lessons/*.html` 20개 재생성
3. 현장 표현을 추가·수정하려면 `tools/enrich.py` 의 `KO` / `FIELD` 를 고치고 `python3 tools/enrich.py` 실행
4. 파일을 바꿨으면 `sw.js` 상단 `VERSION` 을 올려 캐시를 갱신 (예: `kwe-v2.0.1`)
5. commit & push → GitHub Pages 자동 반영

## 진도 저장

진도·복습 일정·즐겨찾기는 **브라우저 localStorage** 에만 저장됩니다(서버 없음).
기기를 옮기거나 브라우저 데이터를 지우기 전에 홈 → ⚙️ → **내보내기** 로 JSON 백업을 받아두세요.
기존 v1 진도(`kwe_progress_v1`)는 처음 열 때 자동으로 새 형식으로 이전됩니다.

## 브라우저 지원

| 기능 | 지원 |
|---|---|
| 학습·현장 모드·플래시카드·퀴즈 | 모든 최신 브라우저 |
| 🔊 발음 재생 (Web Speech) | Chrome, Safari, Edge (iOS 포함) |
| 🎙️ 섀도잉 채점 (음성 인식) | 데스크톱 Chrome, Android Chrome |
| 📱 오프라인·홈 화면 설치 | Chrome, Safari(iOS: 공유 → 홈 화면에 추가) |
