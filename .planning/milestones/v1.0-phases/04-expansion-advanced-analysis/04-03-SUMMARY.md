---
phase: 04-expansion-advanced-analysis
plan: 03
subsystem: ui
tags: [dashboard, recharts, shadcn, advanced-analysis, visualization, trpc, trigger-form]

# Dependency graph
requires:
  - phase: 04-expansion-advanced-analysis
    provides: "4개 고급 분석 모듈 (Plan 02) + 커뮤니티 수집기 (Plan 01)"
provides:
  - "트리거 폼 커뮤니티 소스 5종 선택 UI"
  - "고급 분석 5번째 탭 + 4개 시각화 컴포넌트"
  - "플랫폼 비교 차트 커뮤니티 소스 자동 반영"
affects: [dashboard, analysis-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "그룹별 소스 선택 UI (SOURCE_OPTIONS 배열 기반 동적 렌더링)"
    - "ADVN 시각화: 각 모듈별 전용 카드 컴포넌트 (2x2 그리드)"
    - "CrisisScenarios 3열 카드: 시나리오별 테마 설정 객체 (SCENARIO_THEME)"

key-files:
  created:
    - apps/web/src/components/advanced/advanced-view.tsx
    - apps/web/src/components/advanced/approval-rating-card.tsx
    - apps/web/src/components/advanced/frame-war-chart.tsx
    - apps/web/src/components/advanced/crisis-scenarios.tsx
    - apps/web/src/components/advanced/win-simulation-card.tsx
  modified:
    - apps/web/src/components/analysis/trigger-form.tsx
    - apps/web/src/server/trpc/routers/analysis.ts
    - apps/web/src/components/dashboard/platform-compare.tsx
    - apps/web/src/components/layout/top-nav.tsx
    - apps/web/src/app/page.tsx

key-decisions:
  - "소스 체크박스를 SOURCE_OPTIONS 배열 기반 그룹별 렌더링으로 변경 (확장성)"
  - "CrisisScenarios 카드는 lg:col-span-2로 전체 폭 사용 (3열 카드 공간 확보)"
  - "WinSimulationCard에 RadialBarChart 반원형 프로그레스 사용 (PolarAngleAxis 0-100 범위)"

patterns-established:
  - "고급 분석 컴포넌트 패턴: Record<string, unknown> props + 내부 타입 캐스팅"
  - "시나리오 테마 객체 패턴: 아이콘/색상/레이블을 SCENARIO_THEME 딕셔너리로 관리"

requirements-completed: [COLL-06, COLL-07, COLL-08, ADVN-01, ADVN-02, ADVN-03, ADVN-04]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 04 Plan 03: Dashboard Extension Summary

**트리거 폼 커뮤니티 5종 소스 선택 + 고급 분석 탭(AI 지지율/프레임 전쟁/위기 시나리오/승리 시뮬레이션) 4개 시각화 컴포넌트**

## Performance

- **Duration:** 5min
- **Started:** 2026-03-24T10:59:25Z
- **Completed:** 2026-03-24T11:04:30Z
- **Tasks:** 2 of 3 (Task 3은 human-verify checkpoint)
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments
- 트리거 폼에 DC갤러리/에펨코리아/클리앙 3개 커뮤니티 소스 추가 (그룹별 UI)
- 상단 네비게이션에 5번째 '고급 분석' 탭 추가
- 4개 고급 분석 시각화 컴포넌트 구현 (ApprovalRatingCard, FrameWarChart, CrisisScenarios, WinSimulationCard)
- 플랫폼 비교 차트에 커뮤니티 소스 한국어 레이블 자동 매핑
- AI 지지율 카드에 면책 문구(disclaimer) 표시 (per D-05)

## Task Commits

Each task was committed atomically:

1. **Task 1: 트리거 폼 소스 확장 + tRPC + 플랫폼 차트** - `72b0db3` (feat)
2. **Task 2: 고급 분석 탭 + 4개 시각화 컴포넌트** - `d4d88d9` (feat)

## Files Created/Modified
- `apps/web/src/components/analysis/trigger-form.tsx` - 5개 소스 그룹별 체크박스 UI
- `apps/web/src/server/trpc/routers/analysis.ts` - sources enum에 커뮤니티 3종 추가
- `apps/web/src/components/dashboard/platform-compare.tsx` - SOURCE_LABELS 매핑 + chartData 변환
- `apps/web/src/components/layout/top-nav.tsx` - TAB_LABELS에 '고급 분석' 추가
- `apps/web/src/app/page.tsx` - AdvancedTab 컴포넌트 + panels 배열 추가
- `apps/web/src/components/advanced/advanced-view.tsx` - 고급 분석 탭 메인 (2x2 그리드)
- `apps/web/src/components/advanced/approval-rating-card.tsx` - AI 지지율 도넛 차트 + 면책 문구
- `apps/web/src/components/advanced/frame-war-chart.tsx` - 프레임 강도 BarChart + 위협/반전 카드
- `apps/web/src/components/advanced/crisis-scenarios.tsx` - 확산/통제/역전 3열 카드
- `apps/web/src/components/advanced/win-simulation-card.tsx` - RadialBar 승리 확률 + 조건 체크리스트

## Decisions Made
- 소스 체크박스를 SOURCE_OPTIONS 배열 기반 그룹별 렌더링으로 변경 (향후 소스 추가 용이)
- CrisisScenarios는 lg:col-span-2로 전체 폭 사용 (3열 카드가 충분한 공간 필요)
- Collapsible 컴포넌트 미설치 -- 추론 과정 접이식을 useState + button으로 구현 (의존성 최소화)
- WinSimulationCard에 Recharts RadialBarChart + PolarAngleAxis 조합으로 반원형 프로그레스 구현

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Known Stubs
None - 모든 컴포넌트가 tRPC 쿼리로 실제 데이터를 조회하며, 결과 없을 시 적절한 안내 메시지 표시.

## User Setup Required
None - 외부 서비스 설정 불필요.

## Next Phase Readiness
- Phase 4 전체 UI가 구현되어 Task 3(human-verify)에서 시각적 검증 대기 중
- 트리거 폼 -> 수집 -> 분석 -> 결과 시각화 전체 플로우가 연결됨

## Superpowers 호출 기록

| # | 스킬명 | 호출 시점 | 결과 요약 |
|---|--------|----------|----------|
| - | - | - | - |

### 미호출 스킬 사유
| 스킬명 | 미호출 사유 |
|--------|-----------|
| superpowers:brainstorming | 병렬 실행 에이전트에서 Skill 도구 접근 불가 |
| superpowers:test-driven-development | UI 컴포넌트 작업으로 TDD 미적용 (시각적 검증 대상) |
| superpowers:systematic-debugging | 버그 미발생 (tsc --noEmit 클린 통과) |
| superpowers:requesting-code-review | 병렬 실행 에이전트에서 Skill 도구 접근 불가 |

## Self-Check: PASSED

- All 5 created files verified present
- All 2 commits verified in git log (72b0db3, d4d88d9)
- tsc --noEmit clean

---
*Phase: 04-expansion-advanced-analysis*
*Completed: 2026-03-24*
