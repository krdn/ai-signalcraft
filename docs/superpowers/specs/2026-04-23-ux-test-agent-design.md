# UX 테스트 에이전트 설계서

**날짜**: 2026-04-23
**상태**: 승인 완료
**접근법**: C안 — Playwright MCP + 에이전트 체인

## 개요

AI SignalCraft 웹 대시보드의 UI/UX를 자동으로 테스트하고, 문제점을 탐지·수정하는 Claude Code 스킬.
Playwright MCP로 브라우저를 조작하고, 스크린샷 Vision + DOM/A11y 트리 하이브리드 분석으로 4가지 영역(기능 결함, 시각/레이아웃, UX/사용성, 최신 기법 제안)을 커버.

## 아키텍처

```
/ux-test [옵션]
  │
  ├─ Explorer 에이전트 (탐색, 직렬)
  │   └─ Playwright MCP로 페이지 순회
  │   └─ 스크린샷 + DOM/A11y 트리 캡처
  │   └─ manifest.json 생성
  │
  ├─ Analyzer 에이전트 (분석, 병렬 — 페이지별)
  │   └─ 스크린샷 → Vision 모델 분석
  │   └─ DOM 트리 → 구조/A11y/기능 분석
  │   └─ 최신 트렌드 대비 개선점 도출
  │   └─ pages/*.analysis.json 생성
  │
  ├─ Reporter 에이전트 (취합)
  │   └─ 마크다운 리포트 생성
  │   └─ 심각도순 정렬
  │
  └─ Fixer 에이전트 (수정, 사용자 승인 후)
      └─ Critical/Warning 이슈 코드 수정
      └─ 빌드 검증
```

## 스킬 인터페이스

```bash
# 기본 실행
/ux-test

# 특정 페이지
/ux-test /dashboard
/ux-test /subscriptions/monitor

# 범위
/ux-test --scope public|auth|admin|all    # 기본: all
# public: /, /landing, /login, /signup, /demo, /changelog, /feedback, /docs, /whitepaper
# auth: /dashboard, /subscriptions/**, /reports, /showcase
# admin: /admin/**

# 분석 깊이
/ux-test --depth quick|standard|deep      # 기본: standard

# 수정 모드
/ux-test                                   # 리포트만 생성 (기본, 수정 안 함)
/ux-test --fix                             # Critical/Warning 자동 수정
/ux-test --fix --confirm                   # 수정 전 각 항목 승인 요청

# 뷰포트
/ux-test --viewport mobile|tablet|desktop|all  # 기본: desktop
```

## Explorer 에이전트

### 페이지 탐색 전략

1. 브라우저 실행 → 개발 서버(http://localhost:3000) 접속
2. 로그인 (테스트 계정 자동 입력, env에서 credentials 읽기)
3. `apps/web/src/app/` 디렉토리 스캔으로 라우트 자동 감지
4. scope 필터 적용하여 대상 페이지 결정
5. 각 페이지에서:
   - 페이지 로드 완료 대기 (networkidle)
   - 전체 페이지 스크린샷 캡처 (fullPage)
   - 뷰포트 스크린샷 캡처 (above the fold)
   - DOM/A11y 트리 추출 (page.accessibility.snapshot())
   - 주요 인터랙티브 요소 목록 수집
   - depth=deep 시 탭 전환, 모달 열기 등 인터랙션 후 추가 캡처
6. viewport=all 시 각 뷰포트 크기로 반복

### 출력 디렉토리 구조

```
.ux-test/
├── screenshots/
│   ├── dashboard-full.png
│   ├── dashboard-viewport.png
│   └── ...
├── dom/
│   ├── dashboard-a11y.json
│   └── ...
└── manifest.json
```

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
      "interactiveElements": ["button#start-analysis", "a[href='/reports']"],
      "loadTime": 1.2
    }
  ]
}
```

## Analyzer 에이전트

### 병렬 실행

manifest.json의 pages 배열을 읽어 페이지별로 Agent 툴로 병렬 디스패치. 최대 3개 동시 실행.

### Vision 분석 항목 (스크린샷)

| 카테고리    | 탐지 항목                                                         |
| ----------- | ----------------------------------------------------------------- |
| 시각적 결함 | 텍스트 깨짐, 이미지 누락, 오버랩, 레이아웃 깨짐                   |
| 레이아웃    | 정렬 불일치, 여백 과부족, 반응형 문제, 스크롤 문제                |
| UX/사용성   | CTA 가시성, 정보 계층, 시각적 혼잡도, 탐색 흐름                   |
| 최신 기법   | 애니메이션/전환, 마이크로인터랙션, 다크모드 일관성, 스켈레톤 로딩 |

### DOM/A11y 분석 항목

| 카테고리  | 탐지 항목                                 |
| --------- | ----------------------------------------- |
| 기능 결함 | 비활성 버튼, 깨진 링크, 폼 검증 누락      |
| 접근성    | ARIA 누락, 키보드 탐색 불가, 색 대비 부족 |
| 구조      | 시맨틱 HTML, heading 레벨, 라벨 연결      |

### 최신 기법 비교 기준

- 스켈레톤/셰머 로딩 → 실제 콘텐츠 자리표시자 여부
- Optimistic UI 업데이트 적용 여부
- 뷰 전환 API / 페이지 전환 애니메이션
- 인라인 에러 메시지 vs 토스트 알림 적절성

### 분석 결과 포맷 (페이지별)

```json
{
  "route": "/dashboard",
  "issues": [
    {
      "id": "DASH-001",
      "severity": "critical",
      "category": "visual",
      "title": "차트 영역이 사이드바에 가려짐",
      "description": "1440px 뷰포트에서 감성 트렌드 차트의 우측 20%가 사이드바에 의해 가려짐",
      "evidence": "스크린샷 좌표 (820,300)-(1440,600)",
      "suggestion": "차트 컨테이너에 overflow-hidden 대신 반응형 width 적용",
      "file": "apps/web/src/components/dashboard/sentiment-trend-chart.tsx"
    }
  ],
  "suggestions": [
    {
      "id": "DASH-S01",
      "priority": "medium",
      "title": "스켈레톤 로딩 적용 제안",
      "description": "데이터 로딩 시 빈 화면 대신 스켈레톤 UI를 보여주면 체감 성능 향상",
      "reference": "shadcn/ui Skeleton 컴포넌트 활용 가능"
    }
  ]
}
```

### 심각도 기준

| 심각도     | 정의                                          |
| ---------- | --------------------------------------------- |
| Critical   | 기능 동작 불가, 데이터 손실, 주요 콘텐츠 누락 |
| Warning    | 시각적 결함, UX 저하, 접근성 위반             |
| Info       | 사소한 정렬, 일관성 문제                      |
| Suggestion | 개선 제안, 최신 기법 도입                     |

## Reporter 에이전트

### 리포트 구조

```markdown
# UX 테스트 리포트 — YYYY-MM-DD

## 요약

- 스캔 페이지: N개
- Critical: N | Warning: N | Info: N | Suggestion: N

## Critical 이슈

### ID: 제목

- **페이지**: /route | **파일**: filename.tsx
- **설명**: ...
- **제안**: ...

## Warning 이슈

...

## Info 이슈

...

## 개선 제안 (최신 기법)

...

## 수정 계획

| ID  | 심각도 | 파일 | 상태 |
| --- | ------ | ---- | ---- |
| ... | ...    | ...  | 대기 |
```

### 저장 위치

`.ux-test/reports/YYYY-MM-DD-HHMM-ux-report.md`

## Fixer 에이전트

### 실행 조건

`--fix` 옵션 명시 시에만 Reporter 완료 후 실행. 기본(옵션 없음)은 리포트까지만 생성.

### 실행 흐름

1. 리포트에서 Critical/Warning 이슈 추출
2. `--confirm` 모드: 각 이슈를 사용자에게 승인 요청
3. 승인된 이슈에 대해:
   - 관련 파일 읽기
   - 원인 분석
   - 코드 수정 (Edit/Write)
   - 수정 결과 로그 기록
4. 모든 수정 완료 후:
   - 수정 요약 출력
   - 재테스트 제안 (--depth quick)
5. 리포트 상태 업데이트 (대기 → 완료/건너뜀)

### 안전장치

- Critical 이슈는 자동 수정 후 `pnpm build` 검증
- Warning은 사용자 승인 후 수정
- Info/Suggestion은 수정하지 않고 리포트에만 기록
- 각 수정은 개별 커밋 권장

## 파일 구성

```
.claude/skills/ux-test.md              # 스킬 정의 (진입점)
.claude/agents/ux-test-explorer.md     # Explorer 에이전트
.claude/agents/ux-test-analyzer.md     # Analyzer 에이전트
.claude/agents/ux-test-reporter.md     # Reporter 에이전트
.claude/agents/ux-test-fixer.md        # Fixer 에이전트
```

## 설정 파일 (선택)

```yaml
# .ux-test/config.yaml (없으면 기본값 사용)
testAccount:
  email: ${TEST_ACCOUNT_EMAIL}
  password: ${TEST_ACCOUNT_PASSWORD}
baseUrl: http://localhost:3000
defaultViewport: desktop
excludeRoutes:
  - /api/*
  - /shared/*
```

## 페이지 라우트 자동 감지

Explorer가 `apps/web/src/app/` 디렉토리를 스캔해 page.tsx 파일에서 라우트를 자동 추출.
동적 라우트(`[id]`)는 대시보드에서 접근 가능한 실제 데이터로 탐색.
