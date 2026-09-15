# 팬심 한 자루 — 별도 리뉴얼 프로그램

기존 프로그램을 변경하지 않는 독립 버전입니다. 이 폴더에 실행 코드와 이미지 자산이 모두 들어 있습니다.

- `index.html`: 새 소개 웹사이트
- `upgraded.html`: 리뉴얼 작업실 (크로키, 편지, 서명, 배경, 영상·PNG 저장)
- `classic.html`: 이 버전 안에서 제공하는 기존 방식 작업실
- `assets/site/`: 새로 생성한 이미지 5장. 생성 프롬프트는 `PROMPTS.md`에 기록했습니다.

저장소 루트의 기존 `index.html`, `upgraded.html`, 제작 코드는 유지됩니다. 이후 새 버전 수정은 `renewal/` 안에서 진행하세요.

로컬 HTTP 서버가 저장소 루트에서 실행 중이면 `/renewal/`로 접속합니다. GitHub Pages에서는 `/pencil-sketch/renewal/`입니다. 이미지 분석과 영상 인코더 일부는 외부 라이브러리를 불러오므로 인터넷 연결이 필요합니다.

검증: `node renewal/test-browser.cjs --site`, `node renewal/test-browser.cjs --project` (저장소 루트에서 실행). 첫 번째 검증은 이미지, 메뉴, 반응형 레이아웃을 확인하고, 두 번째는 첫 번째 테스트 사진으로 PNG와 연결 영상·60초 영상을 저장합니다.

기존 프로그램과 사용자 설정이 섞이지 않도록 문구 추천 이력·가수 선택·자동 추천 설정의 저장 공간도 구분했습니다.

## 새 작업실 추가

`atelier.html`은 큰 미리보기를 한 행 전체에 배치한 새 작업실입니다. `atelier-app.js`, `atelier.css`, `atelier.js`로 독립되어 있으며 기존 `upgraded.html`, `classic.html` 및 실행 코드는 변경하지 않았습니다. 세로 미리보기 기본 폭은 최대 720px이며 화면 폭 확대와 전체 화면을 지원합니다. 가로 영상은 전체 폭으로 표시합니다. 메인 사이트의 작업실 버튼은 새 작업실로 연결합니다.

검증: `node renewal/test-browser.cjs --atelier` (첫 번째 사진으로 PNG, 연결 영상, 60초 저장).
