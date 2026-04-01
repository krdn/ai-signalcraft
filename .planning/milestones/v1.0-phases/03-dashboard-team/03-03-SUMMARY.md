---
phase: 03-dashboard-team
plan: 03
subsystem: ui, dashboard, visualization
tags: [recharts, donut-chart, line-chart, word-cloud, bar-chart, progress-bar, shadcn-chart]

# Dependency graph
requires:
  - phase: 03-dashboard-team
    provides: shadcn/ui + tRPC init + analysis.getResults 라우터
  - phase: 02-analysis-engine
    provides: 분석 모듈 결과 JSONB 스키마 (sentiment-framing, macro-view, segmentation, risk-map, opportunity)
provides:
  - 감성 비율 Donut 차트 (PieChart + innerRadius)
  - 시계열 트렌드 Line 차트 (4개 데이터 시리즈)
  - 워드클라우드 (dynamic import, SSR 비활성화)
  - 소스별 감성 비교 Stacked Bar 차트
  - 리스크 카드 (긴급도별 정렬, Progress bar 색상 코딩)
  - 기회 카드 (실현가능성별 정렬, 동일 레이아웃)
  - 2열 반응형 대시보드 그리드 레이아웃
affects: [03-04, 03-05, 03-06]

# Tech tracking
tech-stack:
  added: [recharts (via shadcn chart), @isoterik/react-word-cloud]
  patterns: [ChartContainer + ChartConfig 패턴, dynamic import SSR 비활성화, 모듈별 result JSONB 파싱]

key-files:
  created:
    - apps/web/src/components/dashboard/sentiment-chart.tsx
    - apps/web/src/components/dashboard/trend-chart.tsx
    - apps/web/src/components/dashboard/word-cloud.tsx
    - apps/web/src/components/dashboard/platform-compare.tsx
    - apps/web/src/components/dashboard/risk-cards.tsx
    - apps/web/src/components/dashboard/opportunity-cards.tsx
    - apps/web/src/components/dashboard/dashboard-view.tsx
    - apps/web/src/components/ui/chart.tsx
  modified:
    - apps/web/src/app/page.tsx
    - apps/web/next.config.ts
    - apps/web/src/server/trpc/routers/team.ts
    - apps/web/src/components/team/member-list.tsx

key-decisions:
  - "shadcn chart 컴포넌트(ChartContainer) 사용으로 Recharts 래핑 통일"
  - "워드클라우드 dynamic import + as any 캐스팅으로 SSR/타입 이슈 해결"
  - "resend serverExternalPackages 추가로 빌드 시 API 키 검증 우회"

patterns-established:
  - "ChartConfig 패턴: chart-1~5 CSS 변수를 ChartConfig에 매핑하여 일관된 색상 적용"
  - "모듈별 결과 파싱: parseModuleResult 유틸로 JSONB result를 타입 캐스팅"
  - "카드 컴포넌트 빈 상태: null 데이터 시 role='status' + 한국어 placeholder 표시"

requirements-completed: [DASH-03, DASH-04, DASH-07, DASH-05]

# Metrics
duration: 9min
completed: 2026-03-24
---

# Phase 03 Plan 03: 결과 대시보드 시각화 컴포넌트 Summary

**6개 시각화 컴포넌트(감성 Donut, 시계열 Line, 워드클라우드, 플랫폼 비교 Bar, 리스크/기회 카드) + 2열 반응형 그리드 대시보드 레이아웃으로 AI 분석 결과를 직관적으로 표시**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-24T09:07:48Z
- **Completed:** 2026-03-24T09:16:48Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- 감성 비율 Donut 차트 (3색 긍정/부정/중립, innerRadius 도넛 형태)
- 시계열 트렌드 Line 차트 (4개 데이터 시리즈, prefers-reduced-motion 대응)
- 워드클라우드 (d3-cloud 기반, SSR 비활성화 dynamic import)
- 소스별 감성 비교 Stacked Bar 차트 (플랫폼별 3색 스택)
- 리스크/기회 카드 (긴급도/실현가능성별 정렬, Progress bar 색상 코딩)
- 2열 반응형 그리드 레이아웃 (lg:grid-cols-2, mobile 1열)
- DashboardView에서 trpc.analysis.getResults로 모듈별 결과 파싱/표시

## Task Commits

Each task was committed atomically:

1. **Task 1: 감성/트렌드 차트 + 워드클라우드 + 플랫폼 비교 컴포넌트** - `f60365c` (feat)
2. **Task 2: 리스크/기회 카드 + 대시보드 그리드 조합 + 탭 연결** - `a1fe106` (feat)

## Files Created/Modified

- `apps/web/src/components/dashboard/sentiment-chart.tsx` - 감성 비율 Donut 차트 (PieChart + ChartContainer)
- `apps/web/src/components/dashboard/trend-chart.tsx` - 시계열 Line 차트 (4개 데이터 시리즈)
- `apps/web/src/components/dashboard/word-cloud.tsx` - 워드클라우드 (dynamic import, SSR false)
- `apps/web/src/components/dashboard/platform-compare.tsx` - 소스별 감성 비교 Stacked BarChart
- `apps/web/src/components/dashboard/risk-cards.tsx` - 리스크 카드 (긴급도별 정렬 + Progress)
- `apps/web/src/components/dashboard/opportunity-cards.tsx` - 기회 카드 (실현가능성별 정렬 + Progress)
- `apps/web/src/components/dashboard/dashboard-view.tsx` - 대시보드 2열 그리드 뷰 + 결과 파싱
- `apps/web/src/components/ui/chart.tsx` - shadcn chart 컴포넌트 (Recharts 래퍼)
- `apps/web/src/app/page.tsx` - DashboardTab에 DashboardView 연결
- `apps/web/next.config.ts` - resend serverExternalPackages 추가
- `apps/web/src/server/trpc/routers/team.ts` - 타입 에러 수정 (optional chaining)
- `apps/web/src/components/team/member-list.tsx` - 타입 캐스팅 수정

## Decisions Made

- shadcn chart 컴포넌트(ChartContainer + ChartConfig) 사용: Recharts를 직접 사용하지 않고 shadcn 래퍼로 통일하여 테마 색상 변수 자동 적용
- 워드클라우드 dynamic import + 타입 캐스팅: @isoterik/react-word-cloud의 export 구조가 TypeScript와 호환되지 않아 `as any` + ComponentType 캐스팅 적용
- resend serverExternalPackages 추가: 병렬 에이전트가 추가한 team.ts의 Resend 패키지가 빌드 시 API 키를 요구하여 외부 패키지로 격리

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 워드클라우드 타입 에러 수정**

- **Found during:** Task 1
- **Issue:** @isoterik/react-word-cloud의 default export 구조가 TypeScript와 호환되지 않아 dynamic import 타입 에러
- **Fix:** `as any` 캐스팅 + ComponentType 타입 단언으로 해결
- **Files modified:** apps/web/src/components/dashboard/word-cloud.tsx
- **Verification:** `pnpm --filter @ai-signalcraft/web build` 성공
- **Committed in:** f60365c

**2. [Rule 3 - Blocking] Resend API 키 빌드 에러 해결**

- **Found during:** Task 1 (빌드 검증)
- **Issue:** 병렬 에이전트(03-05)가 추가한 team.ts의 Resend 패키지가 빌드 시 API 키 없이 초기화 실패
- **Fix:** next.config.ts serverExternalPackages에 'resend' 추가
- **Files modified:** apps/web/next.config.ts
- **Verification:** `pnpm --filter @ai-signalcraft/web build` 성공
- **Committed in:** f60365c

**3. [Rule 3 - Blocking] team.ts/member-list.tsx 타입 에러 수정**

- **Found during:** Task 1 (빌드 검증)
- **Issue:** 병렬 에이전트(03-05)가 추가한 team.ts에서 ctx.session.user optional chaining 누락, member-list.tsx에서 joinedAt Date/string 타입 불일치
- **Fix:** optional chaining 추가, `as unknown as TeamMember[]` 캐스팅
- **Files modified:** apps/web/src/server/trpc/routers/team.ts, apps/web/src/components/team/member-list.tsx
- **Verification:** TypeScript 빌드 통과
- **Committed in:** f60365c

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** 모든 auto-fix가 빌드 통과에 필수적. 병렬 에이전트 코드 호환성 이슈. 스코프 변경 없음.

## Issues Encountered

- 병렬 에이전트 간 빌드 충돌: `next build` 프로세스 동시 실행 시 lock file 충돌로 대기 필요
- Resend v6 빌드 시 초기화: serverExternalPackages로 해결

## Known Stubs

None - 모든 차트/카드 컴포넌트가 trpc.analysis.getResults를 통해 실제 분석 결과 데이터를 소비함. 빈 상태 표시는 데이터 미존재 시 정상 동작.

## User Setup Required

None - 외부 서비스 설정 불필요.

## Superpowers 호출 기록

| #   | 스킬명 | 호출 시점 | 결과 요약                                                                      |
| --- | ------ | --------- | ------------------------------------------------------------------------------ |
| -   | -      | -         | GSD executor 병렬 실행 환경에서 Superpowers 스킬 호출 불가 (Agent tool 미사용) |

### 미호출 스킬 사유

| 스킬명                              | 미호출 사유                         |
| ----------------------------------- | ----------------------------------- |
| superpowers:brainstorming           | 병렬 실행 agent - Agent tool 미사용 |
| superpowers:test-driven-development | Plan이 tdd="true" 미지정            |
| superpowers:systematic-debugging    | 빌드 에러는 직접 수정으로 해결      |
| superpowers:requesting-code-review  | 병렬 실행 agent - Agent tool 미사용 |

## Next Phase Readiness

- 6개 시각화 컴포넌트 완성, 대시보드 탭에서 분석 결과 즉시 확인 가능
- Plan 04 (AI 리포트)와 독립적으로 동작
- Plan 05/06 (팀 관리)에서 추가 대시보드 기능 확장 가능

---

_Phase: 03-dashboard-team_
_Completed: 2026-03-24_
