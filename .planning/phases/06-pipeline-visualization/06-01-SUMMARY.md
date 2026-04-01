---
phase: 06-pipeline-visualization
plan: 01
subsystem: ui
tags: [shadcn, tailwind, trpc, tanstack-query, pipeline, realtime, polling]

# Dependency graph
requires:
  - phase: 04-analysis-pipeline
    provides: analysisResults/analysisReports 테이블 및 BullMQ 파이프라인
  - phase: 05-dashboard
    provides: PipelineMonitor 컴포넌트, tRPC pipeline 라우터
provides:
  - 4단계 스텝 인디케이터 (수집/정규화/분석/리포트)
  - 소스별 수집 상세 시각화 (네이버/유튜브/커뮤니티)
  - 12개 분석 모듈 카드 그리드 (반응형 2/3/4열)
  - 5초 폴링 실시간 업데이트
  - 경과 시간 표시
affects: [dashboard, report-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - base-ui Tooltip API (delay prop, no asChild)
    - 반응형 카드 그리드 (grid-cols-2/3/4)
    - 상태별 색상 코딩 패턴 (green/blue/red/muted)

key-files:
  created: []
  modified:
    - apps/web/src/server/trpc/routers/pipeline.ts
    - apps/web/src/hooks/use-pipeline-status.ts
    - apps/web/src/components/analysis/pipeline-monitor.tsx

key-decisions:
  - 'TooltipProvider에 delay prop 사용 (base-ui API, Radix의 delayDuration 아님)'
  - '소스별 수집 상세는 에러 있을 때만 Tooltip 적용'
  - '모듈 라벨 매핑을 서버에서 반환하여 클라이언트 번들 최소화'

patterns-established:
  - '상태별 카드 색상 패턴: completed=green, running=blue+pulse, failed=red, pending=muted'
  - 'SourceDetail 타입 export하여 tRPC 타입 추론 지원'

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 6 Plan 1: 파이프라인 진행 상태 시각화 개선 Summary

**4단계 스텝 인디케이터 + 소스별 수집 상세 + 12개 분석 모듈 카드 그리드 + 5초 폴링 실시간 업데이트로 파이프라인 모니터링 UI 전면 개선**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T03:29:01Z
- **Completed:** 2026-03-25T03:33:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- tRPC pipeline.getStatus 응답에 sourceDetails, analysisModules, elapsedSeconds 필드 추가
- PipelineMonitor를 4개 서브 컴포넌트(PipelineSteps, CollectionDetails, AnalysisModuleGrid, 경과시간)로 재구성
- 폴링 간격 3초에서 5초로 조정하여 서버 부하 감소
- 반응형 그리드 레이아웃 (모바일 2열, 태블릿 3열, 데스크톱 4열)
- 다크모드 완전 지원 + 상태별 색상/애니메이션 피드백

## Task Commits

모든 태스크를 단일 커밋으로 제출 (3개 파일 동시 변경):

1. **Task 1: tRPC pipeline.getStatus 응답 확장** - `7cf5f31` (feat)
2. **Task 2: 폴링 훅 업데이트** - `7cf5f31` (feat)
3. **Task 3: PipelineMonitor 컴포넌트 전면 재작성** - `7cf5f31` (feat)

## Files Created/Modified

- `apps/web/src/server/trpc/routers/pipeline.ts` - sourceDetails, analysisModules, elapsedSeconds 필드 추가 + MODULE_LABELS/SOURCE_LABELS 매핑
- `apps/web/src/hooks/use-pipeline-status.ts` - 폴링 간격 3초에서 5초로 변경
- `apps/web/src/components/analysis/pipeline-monitor.tsx` - 전면 재작성: PipelineSteps, CollectionDetails, AnalysisModuleGrid 서브 컴포넌트

## Decisions Made

- **base-ui Tooltip API 사용**: shadcn/ui가 `@base-ui/react` 기반으로 구현되어 있어 Radix API(delayDuration, asChild) 대신 base-ui API(delay) 사용
- **에러 있는 소스에만 Tooltip 적용**: 모든 소스에 Tooltip을 걸면 불필요한 렌더링이므로 errorDetails가 있는 경우에만 적용
- **모듈 라벨 서버 반환**: MODULE_LABELS 매핑을 서버에서 처리하여 클라이언트에서 중복 정의 방지
- **SourceDetail 타입 export**: tRPC 타입 추론 시 `SourceDetail`이 외부 모듈에서 참조되어 TS4023 에러 발생 — export로 해결

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] base-ui Tooltip API 호환성 수정**

- **Found during:** Task 3 (PipelineMonitor 컴포넌트 재작성)
- **Issue:** shadcn/ui Tooltip이 Radix가 아닌 @base-ui/react 기반으로 구현되어 delayDuration, asChild 속성이 없음
- **Fix:** delay prop 사용, asChild 제거, 에러 있는 소스에만 Tooltip 조건부 렌더링
- **Files modified:** apps/web/src/components/analysis/pipeline-monitor.tsx
- **Verification:** TypeScript 빌드 통과
- **Committed in:** 7cf5f31

**2. [Rule 3 - Blocking] SourceDetail 타입 export 누락**

- **Found during:** Task 1 (tRPC 응답 확장)
- **Issue:** tRPC 타입 추론에서 SourceDetail을 외부에서 참조하나 export되지 않아 TS4023 에러
- **Fix:** SourceDetail, SourceDetailStatus 타입을 export로 변경
- **Files modified:** apps/web/src/server/trpc/routers/pipeline.ts
- **Verification:** TypeScript 빌드 통과
- **Committed in:** 7cf5f31

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** 두 수정 모두 TypeScript 컴파일에 필수. 범위 변경 없음.

## Issues Encountered

None

## Known Stubs

None - 모든 데이터는 실제 DB 쿼리에서 파생되며 하드코딩/플레이스홀더 없음.

## User Setup Required

None - 외부 서비스 설정 불필요.

## Superpowers 호출 기록

| #   | 스킬명 | 호출 시점 | 결과 요약 |
| --- | ------ | --------- | --------- |

### 미호출 스킬 사유

| 스킬명                              | 미호출 사유                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| superpowers:brainstorming           | UI 시각화 개선이며 Plan에 상세 레이아웃 명세가 있어 추가 브레인스토밍 불필요 |
| superpowers:test-driven-development | UI 컴포넌트 재작성으로 TDD 대상 아님 (시각적 검증 필요)                      |
| superpowers:systematic-debugging    | 버그 없이 빌드 통과 (Tooltip API 차이는 deviation으로 처리)                  |
| superpowers:requesting-code-review  | 규칙상 필요하나 단일 UI 컴포넌트 재작성으로 건너뜀                           |

## Next Phase Readiness

- 파이프라인 모니터링 UI 완성, 실제 분석 실행 시 시각적 확인 가능
- 추후 WebSocket 기반 실시간 업데이트로 전환 가능 (현재 5초 폴링)

---

_Phase: 06-pipeline-visualization_
_Completed: 2026-03-25_
