# /ux-test — AI SignalCraft UI/UX 자동 테스트 스킬

## 트리거

`/ux-test` 명령어 또는 다음 키워드:

- "UI 테스트"
- "UX 테스트"
- "화면 테스트"
- "UI 점검"
- "UX 점검"

## 인자 파싱

```
/ux-test [/route] [--scope public|auth|admin|all] [--depth quick|standard|deep] [--viewport mobile|tablet|desktop|all] [--fix] [--fix --confirm] [--no-fix]
```

| 인자            | 기본값   | 설명                                                   |
| --------------- | -------- | ------------------------------------------------------ |
| /route          | 없음     | 특정 페이지만 테스트                                   |
| --scope         | all      | public/auth/admin/all                                  |
| --depth         | standard | quick(스크린샷만)/standard(+DOM)/deep(+인터랙션)       |
| --viewport      | desktop  | mobile(390x844)/tablet(768x1024)/desktop(1440x900)/all |
| --fix           | 없음     | Critical/Warning 자동 수정                             |
| --fix --confirm | 없음     | 수정 전 각 항목 승인 요청                              |
| --no-fix        | (기본)   | 리포트만 생성                                          |

### scope 분류

- **public**: /, /landing, /login, /signup, /demo, /changelog, /feedback, /docs, /docs/\*, /whitepaper
- **auth**: /dashboard, /subscriptions, /subscriptions/_, /reports, /showcase/_
- **admin**: /admin, /admin/\*

## 실행 절차

### Phase 1: 사전 준비

1. **개발 서버 확인**:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

- 200이 아니면 사용자에게 `pnpm dev` 실행 요청 후 대기

2. **Playwright 설치 확인**:

```bash
npx playwright install chromium 2>/dev/null
```

3. **.ux-test 디렉토리 초기화**:

```bash
rm -rf .ux-test && mkdir -p .ux-test/screenshots .ux-test/dom .ux-test/pages .ux-test/reports
```

### Phase 2: Explorer 에이전트 실행

Agent 툴로 Explorer 에이전트를 디스패치:

```
Agent({
  subagent_type: "general-purpose",
  description: "UX 테스트 Explorer",
  prompt: "ux-test-explorer 에이전트 정의를 읽고 따르세요: .claude/agents/ux-test-explorer.md

전달 파라미터:
- baseUrl: http://localhost:3000
- scope: {사용자가 지정한 scope, 기본 all}
- viewport: {사용자가 지정한 viewport 설정}
- depth: {사용자가 지정한 depth, 기본 standard}

Explorer 에이전트는 Playwright로 페이지를 순회하며 스크린샷과 DOM/A11y 트리를 캡처합니다."
})
```

Explorer는 직렬 실행 (한 번에 하나의 페이지만 탐색).
완료 후 `.ux-test/manifest.json` 확인하여 성공/실패 페이지 수 보고.

### Phase 3: Analyzer 에이전트 병렬 실행

manifest.json의 pages 배열을 읽어 에러 없는 페이지별로 Analyzer 에이전트를 디스패치.
최대 3개 동시 병렬 실행:

```
// 페이지당 하나의 Agent 호출
Agent({
  subagent_type: "general-purpose",
  description: "UX 분석: {route}",
  prompt: "ux-test-analyzer 에이전트 정의를 읽고 따르세요: .claude/agents/ux-test-analyzer.md

분석 대상:
- route: {page.route}
- title: {page.title}
- screenshot: {page.screenshot}
- viewportScreenshot: {page.viewportScreenshot}
- a11yTree: {page.a11yTree}
- interactiveElements: {page.interactiveElements}
- loadTime: {page.loadTime}

Analyzer는 스크린샷 Vision 분석과 DOM/A11y 트리 분석을 모두 수행합니다."
})
```

각 Analyzer는 독립 컨텍스트에서 실행.
결과를 `.ux-test/pages/{pageName}.analysis.json`에 저장.

### Phase 4: Reporter 에이전트 실행

모든 Analyzer 완료 후 Reporter 디스패치:

```
Agent({
  subagent_type: "general-purpose",
  description: "UX 리포트 생성",
  prompt: "ux-test-reporter 에이전트 정의를 읽고 따르세요: .claude/agents/ux-test-reporter.md

모든 분석 결과(.ux-test/pages/*.analysis.json)를 취합하여 마크다운 리포트를 생성합니다."
})
```

리포트 생성 후 사용자에게 요약 출력.

### Phase 5: Fixer 에이전트 실행 (선택)

`--fix` 또는 `--fix --confirm` 옵션인 경우에만 실행:

```
Agent({
  subagent_type: "general-purpose",
  description: "UX 이슈 자동 수정",
  prompt: "ux-test-fixer 에이전트 정의를 읽고 따르세요: .claude/agents/ux-test-fixer.md

수정 모드: {--fix면 auto, --fix --confirm이면 confirm}
리포트 위치: .ux-test/reports/

Fixer는 Critical/Warning 이슈의 코드를 수정하고 빌드 검증을 수행합니다."
})
```

Fixer 완료 후 수정 결과 요약 출력.

## 완료 조건

- 리포트 파일이 `.ux-test/reports/`에 생성됨
- (fix 모드) 수정된 파일들이 빌드를 통과함
