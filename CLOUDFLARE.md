# Cloudflare 공개 배포

이 저장소는 두 영역을 분리해서 관리합니다.

- 작업용 원본: 저장소의 `renewal`, `assets` 등
- 공개 배포판: 빌드할 때 생성되는 `.public-site`

`wrangler.jsonc`의 `assets.directory`는 반드시 `./.public-site`여야 합니다. 저장소 전체를 뜻하는 `.`으로 지정하면 `.git`, 테스트 결과, 관리자 제작 파일까지 업로드 대상으로 잡힙니다.

Cloudflare Workers의 **Settings > Build**에서 다음처럼 설정합니다.

- Root directory: 비워 두거나 `/`
- Build command: `node renewal/build-public-site.cjs`
- Deploy command: `npx wrangler deploy`

`.public-site`는 Git에 저장하지 않는 생성 결과물입니다. 따라서 Cloudflare의 Build command를 생략하면 안 됩니다.

로컬에서 공개판을 검사하려면 다음 명령을 실행합니다.

```powershell
node renewal/build-public-site.cjs
```

이 빌드는 다음 문제를 자동으로 차단합니다.

- Cloudflare 공개 경로가 `.public-site`가 아닌 경우
- `.git`, `.github`, `.test-output`, `node_modules`가 공개판에 들어간 경우
- 파일 하나가 Cloudflare 제한인 25 MiB 이상인 경우
- 관리자 제작 화면이 공개판에 들어간 경우
