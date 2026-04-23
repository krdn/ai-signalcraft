---
name: ux-test-explorer
description: 'UX 테스트 — Explorer 에이전트. Playwright로 페이지를 순회하며 스크린샷과 DOM/A11y 트리를 캡처하여 manifest.json을 생성.'
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Edit
  - AskUserQuestion
---

<objective>
AI SignalCraft 웹 앱의 UI를 탐색하여 분석용 데이터를 수집합니다.
Playwright를 사용해 각 페이지의 스크린샷(fullPage + viewport)과 DOM/A11y 트리를 캡처합니다.
</objective>

<context>
## 수집 설정

- **baseUrl**: {{baseUrl}} (기본: http://localhost:3000)
- **scope**: {{scope}} (public | auth | admin | all)
- **viewport**: {{viewport}} (mobile: 390x844 | tablet: 768x1024 | desktop: 1440x900 | all)
- **depth**: {{depth}} (quick | standard | deep)
- **테스트 계정**: env에서 TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD 읽기

## 페이지 라우트

다음 디렉토리를 스캔하여 page.tsx 파일에서 라우트를 자동 추출:

- `apps/web/src/app/`

scope에 따라 필터:

- **public**: /, /landing, /login, /signup, /demo, /changelog, /feedback, /docs, /docs/\*, /whitepaper
- **auth**: /dashboard, /subscriptions, /subscriptions/_, /reports, /showcase/_
- **admin**: /admin, /admin/\*

동적 라우트([id])는 제외하고 정적 라우트만 수집. 단, /subscriptions/[id]는
대시보드에서 접근 가능한 첫 번째 구독 ID로 대체.

## 프로젝트 컨텍스트

- **프레임워크**: Next.js 15 App Router + React 19 + shadcn/ui + Tailwind v4
- **인증**: NextAuth.js v5
- **수집기 패키지**: packages/collectors (Playwright ^1.50.0 설치됨)
  </context>

<process>
## Step 1: 개발 서버 확인

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

- 200 응답 시 다음 단계 진행
- 응답 없으면 사용자에게 `pnpm dev` 실행 요청 후 종료

## Step 2: .ux-test 디렉토리 초기화

```bash
rm -rf .ux-test
mkdir -p .ux-test/screenshots .ux-test/dom .ux-test/pages .ux-test/reports
```

## Step 3: Playwright 스크립트 작성 및 실행

`.ux-test/explore.mjs` 임시 스크립트를 작성합니다. 이 스크립트는:

1. chromium 브라우저를 headless 모드로 실행
2. 설정된 viewport 크기로 새 컨텍스트 생성
3. scope에 auth/admin이 포함되면 로그인 수행:
   - /login 페이지로 이동
   - env의 TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD로 폼 입력
   - 제출 후 networkidle 대기
   - 여전히 /login에 있으면 LOGIN_FAILED 출력 후 종료
4. ROUTES 환경변수(JSON 배열)에서 라우트 목록을 읽어 순회
5. 각 라우트에서:
   - 페이지 이동 + networkidle 대기 (타임아웃 15초)
   - fullPage 스크린샷 → `.ux-test/screenshots/{pageName}-full.png`
   - viewport 스크린샷 → `.ux-test/screenshots/{pageName}-viewport.png`
   - A11y 스냅샷 → `.ux-test/dom/{pageName}-a11y.json` (page.accessibility.snapshot())
   - 인터랙티브 요소 수집 (a, button, input, select, textarea, role=button/link) — 최대 50개
   - depth=deep 시 탭 요소(role="tab")를 최대 3개까지 클릭하며 추가 스크린샷
6. viewport=all 시 mobile(390x844), tablet(768x1024), desktop(1440x900) 각각으로 반복
7. manifest.json에 메타데이터 기록 후 EXPLORATION_COMPLETE 출력

### 스크립트 실행

라우트 목록은 apps/web/src/app/ 스캔으로 자동 생성. \_로 시작하거나 ( 그룹 디렉토리는 건너뜀. 동적 라우트([id])는 제외.

```bash
ROUTES=$(node -e "
const fs = require('fs');
const path = require('path');
function findRoutes(dir, base = '') {
  const routes = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name.startsWith('(')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...findRoutes(fullPath, base + '/' + entry.name));
    } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
      routes.push(base || '/');
    }
  }
  return routes;
}
const routes = findRoutes('apps/web/src/app');
const filtered = routes.filter(r => !r.includes('['));
console.log(JSON.stringify(filtered));
")

BASE_URL=http://localhost:3000 \
VIEWPORT='{"width":1440,"height":900}' \
SCOPE=all \
DEPTH=standard \
ROUTES="$ROUTES" \
node .ux-test/explore.mjs
```

## Step 4: 결과 확인

`.ux-test/manifest.json`을 읽어 수집된 페이지 수와 실패 페이지를 보고.
실패한 페이지는 원인을 분석하여 보고.

### manifest.json 구조

```json
{
  "timestamp": "2026-04-23T...",
  "viewport": { "width": 1440, "height": 900 },
  "scope": "all",
  "pages": [
    {
      "route": "/dashboard",
      "title": "AI SignalCraft 대시보드",
      "screenshot": "screenshots/dashboard-full.png",
      "viewportScreenshot": "screenshots/dashboard-viewport.png",
      "a11yTree": "dom/dashboard-a11y.json",
      "interactiveElements": [
        { "tag": "button", "text": "분석 시작", "type": "submit", "role": null, "ariaLabel": null }
      ],
      "loadTime": 1.2
    }
  ]
}
```

실패한 페이지는 error 필드만 포함:

```json
{
  "route": "/admin/users",
  "error": "Navigation timeout"
}
```

</process>
