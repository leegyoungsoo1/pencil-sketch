# 추억 한 자루 — 공개 작업실

사진을 올리고 제목·편지를 더해 연필 드로잉 영상과 PNG를 만드는 독립 웹앱입니다. 원본 프로그램은 저장소 루트에 그대로 보존합니다.

- `index.html`: 소개 사이트
- `atelier.html`, `atelier-app.js`, `atelier.css`: 현재 작업실
- `upgraded.html`, `classic.html`: 현재 작업실로 이동하는 이전 주소
- `assets/site/`: 화실 소개 이미지, `assets/backgrounds/`: 선택 가능한 배경

사진 추가는 분석 없이 목록만 준비합니다. 삭제·정렬과 영상 방향 선택 후 **만들기**를 누릅니다. 제목·제목 글꼴·서명은 전체 공통, 손글씨 편지만 사진별로 저장합니다. 서명은 기본 공백·비활성이며 체크박스로 켭니다. 추천 문구는 제거했습니다.

기본 20초/장, 10초 단위로 조정합니다. 선 진하기·해칭은 10% 단위입니다. 원본 전체 구도는 종이를 원본 비율에 맞춰 배치하며 편지와 서명도 종이 안에 들어갑니다. PNG는 각 사진을 별도 파일로 저장하고 브라우저의 다중 다운로드 제한 시 개별 링크를 제공합니다.

반복 작업 시 렌더링 컨텍스트와 잉크·마스크를 초기화합니다. 사진별 장면 준비 사이에 화면 갱신 기회를 주고 동일 계획은 재사용합니다. 인코딩 시 임시 MessageChannel은 닫습니다. 연필 소리 합성과 획별 음량 처리는 루트 `app.js`의 초기 방식을 사용하며 오프라인 오디오 구간의 시간은 각 구간 시작 기준으로 보정합니다.

검증: `node renewal/test-browser.cjs --site`, `node renewal/test-browser.cjs --atelier`.
첫 명령은 반응형·이미지·메뉴를 확인합니다. 두 번째는 분석 지연, 기본값, 공통 제목·개별 편지, 반복 렌더링, 개별 PNG, 여러 사진 MP4, 원본 전체 가로 배치, 초기화를 확인합니다.

접속: 로컬 `/renewal/`, GitHub Pages `/pencil-sketch/renewal/`. 분석과 인코딩 라이브러리 일부는 인터넷에서 불러옵니다.

추가 UI 검증: `node renewal/test-browser.cjs --public-controls` — 공통 서명·글꼴, 편지 분리, 10단위 조절, 파노라마 배치, 초기값 복원을 검사합니다. ONNX의 `env.wasm.proxy`를 켜 무거운 모델 추론을 Web Worker로 분리했습니다([공식 안내](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html)).
