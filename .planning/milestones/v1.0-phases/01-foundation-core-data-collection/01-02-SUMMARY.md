---
phase: 01-foundation-core-data-collection
plan: 02
subsystem: pipeline
tags: [bullmq, redis, ai-sdk, collector, flowproducer, typescript]

# Dependency graph
requires:
  - phase: 01-foundation-core-data-collection/01
    provides: 'pnpm 모노리포 스캐폴딩, Drizzle DB 스키마 (collectionJobs, articles, videos, comments)'
provides:
  - 'BullMQ FlowProducer 3단계 파이프라인 (collect -> normalize -> persist)'
  - 'triggerCollection(params, dbJobId) 함수'
  - 'Collector 인터페이스 + CollectionOptionsSchema + 레지스트리'
  - 'AI Gateway 골격 (analyzeText + analyzeStructured)'
  - 'CollectionTriggerSchema, SourceStatus, JobProgress 타입'
affects: [01-03, 01-04, 01-05, 02-analysis]

# Tech tracking
tech-stack:
  added: [ai@6.0.137, '@ai-sdk/anthropic@3.0.63', '@ai-sdk/openai@3.0.48']
  patterns:
    [
      'lazy FlowProducer 초기화',
      'ConnectionOptions 기반 Redis 설정',
      'AsyncGenerator Collector 패턴',
    ]

key-files:
  created:
    - packages/core/src/queue/connection.ts
    - packages/core/src/queue/flows.ts
    - packages/core/src/queue/workers.ts
    - packages/core/src/queue/index.ts
    - packages/core/src/types/index.ts
    - packages/collectors/src/adapters/base.ts
    - packages/collectors/src/adapters/registry.ts
    - packages/collectors/src/adapters/index.ts
    - packages/ai-gateway/src/gateway.ts
    - packages/core/tests/queue.test.ts
    - packages/collectors/tests/adapter.test.ts
  modified:
    - packages/core/src/index.ts
    - packages/collectors/src/index.ts
    - packages/ai-gateway/src/index.ts
    - packages/ai-gateway/package.json
    - packages/ai-gateway/tsconfig.json
    - packages/collectors/package.json

key-decisions:
  - 'AI SDK v4->v6 업그레이드: 프로바이더 패키지(@ai-sdk/anthropic v3)와 호환성 확보'
  - 'ConnectionOptions 객체 사용: ioredis 버전 충돌(v5.10.1 vs BullMQ 내장 v5.9.3) 방지'
  - 'FlowProducer lazy 초기화: import 시 Redis 연결 시도 방지, 테스트 안정성 확보'
  - 'ai-gateway tsconfig declaration:false: AI SDK 내부 Output 타입 노출 문제 회피'

patterns-established:
  - 'Lazy Redis connection: BullMQ FlowProducer/Worker를 함수 호출 시점에 생성하여 모듈 import 부작용 방지'
  - 'Collector AsyncGenerator: collect() 메서드가 AsyncGenerator<T[], void, unknown> 반환하여 청크 단위 yield'
  - 'Registry 패턴: Map<string, Collector>로 수집기 등록/조회'

requirements-completed: [FOUND-03, FOUND-04, COLL-09]

# Metrics
duration: 6min
completed: 2026-03-24
---

# Phase 01 Plan 02: 파이프라인 + Collector + AI Gateway Summary

**BullMQ FlowProducer 3단계 파이프라인 오케스트레이터 + AsyncGenerator Collector 인터페이스 + AI SDK v6 기반 듀얼 프로바이더 게이트웨이**

## Performance

- **Duration:** 6min
- **Started:** 2026-03-24T03:56:34Z
- **Completed:** 2026-03-24T04:03:19Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- BullMQ FlowProducer로 collect -> normalize -> persist 3단계 파이프라인 정의 (네이버+유튜브 병렬)
- Collector 인터페이스 (AsyncGenerator 패턴) + 레지스트리로 수집기 플러그인 구조 완성
- AI Gateway가 Anthropic/OpenAI 프로바이더를 단일 API(analyzeText, analyzeStructured)로 라우팅
- CollectionTriggerSchema 검증 + MockCollector 기반 단위 테스트 모두 통과

## Task Commits

Each task was committed atomically:

1. **Task 1: BullMQ 파이프라인 오케스트레이터 + Collector Adapter 인터페이스** - `b028f63` (feat)
2. **Task 2: AI Gateway 골격 + 단위 테스트 스캐폴드** - `2de56dd` (feat)

## Files Created/Modified

- `packages/core/src/types/index.ts` - CollectionTriggerSchema, SourceStatus, JobProgress 타입
- `packages/core/src/queue/connection.ts` - BullMQ Redis ConnectionOptions 설정
- `packages/core/src/queue/flows.ts` - FlowProducer triggerCollection 함수
- `packages/core/src/queue/workers.ts` - createCollectorWorker, createPipelineWorker 팩토리
- `packages/core/src/queue/index.ts` - queue 모듈 re-export
- `packages/core/src/index.ts` - queue, types re-export 추가
- `packages/collectors/src/adapters/base.ts` - Collector 인터페이스, CollectionOptionsSchema
- `packages/collectors/src/adapters/registry.ts` - 수집기 레지스트리 (register/get/getAll)
- `packages/collectors/src/adapters/index.ts` - adapters re-export
- `packages/collectors/src/index.ts` - adapters re-export
- `packages/ai-gateway/src/gateway.ts` - analyzeText, analyzeStructured AI 게이트웨이
- `packages/ai-gateway/src/index.ts` - gateway re-export
- `packages/core/tests/queue.test.ts` - CollectionTriggerSchema 검증 테스트
- `packages/collectors/tests/adapter.test.ts` - Collector 인터페이스 + 레지스트리 테스트

## Decisions Made

- **AI SDK v4 -> v6 업그레이드:** 프로바이더 패키지(@ai-sdk/anthropic v3)가 LanguageModelV3를 반환하여 AI SDK v4(LanguageModelV1 기대)와 비호환. v6으로 업그레이드하여 해결
- **ConnectionOptions 객체 사용:** ioredis 직접 인스턴스 대신 ConnectionOptions 객체 전달로 ioredis 버전 충돌 방지
- **FlowProducer lazy 초기화:** 모듈 import 시 Redis 연결 시도 방지하여 테스트 환경 안정성 확보
- **ai-gateway declaration:false:** AI SDK v6 내부 Output 타입이 declaration 파일에서 참조 불가 문제 회피. 패키지가 source(src/index.ts) 기반으로 소비되므로 영향 없음

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ioredis 버전 충돌로 타입 에러**

- **Found during:** Task 1 (BullMQ 파이프라인 구현)
- **Issue:** 직접 의존 ioredis@5.10.1과 BullMQ 내장 ioredis@5.9.3 간 타입 비호환
- **Fix:** IORedis 인스턴스 대신 ConnectionOptions 객체로 Redis 연결 설정
- **Files modified:** packages/core/src/queue/connection.ts
- **Verification:** `pnpm -r build` 성공

**2. [Rule 3 - Blocking] AI SDK v4와 프로바이더 패키지 비호환**

- **Found during:** Task 2 (AI Gateway 구현)
- **Issue:** @ai-sdk/anthropic v3가 LanguageModelV3 반환, ai v4는 LanguageModelV1 기대
- **Fix:** ai 패키지를 ^4.0.0에서 ^6.0.0으로 업그레이드, maxTokens -> maxOutputTokens 변경
- **Files modified:** packages/ai-gateway/package.json, packages/ai-gateway/src/gateway.ts

**3. [Rule 1 - Bug] FlowProducer import 시 Redis 연결 시도**

- **Found during:** Task 2 (테스트 실행)
- **Issue:** flows.ts에서 모듈 스코프 FlowProducer 생성이 import 시 Redis 연결 시도
- **Fix:** lazy 초기화 패턴 적용 (getFlowProducer 함수)
- **Files modified:** packages/core/src/queue/flows.ts
- **Verification:** `pnpm --filter @ai-signalcraft/core test` 성공 (unhandled error 없음)

**4. [Rule 3 - Blocking] AI SDK v6 declaration 파일 Output 타입 노출 불가**

- **Found during:** Task 2 (AI Gateway 빌드)
- **Issue:** generateText 반환 타입의 Output 타입이 declaration 파일에서 참조 불가
- **Fix:** ai-gateway tsconfig에 declaration:false 설정
- **Files modified:** packages/ai-gateway/tsconfig.json
- **Verification:** `pnpm --filter @ai-signalcraft/ai-gateway build` 성공

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking)
**Impact on plan:** 모든 수정은 빌드/테스트 통과에 필수적인 변경. 기능 범위 변경 없음.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - 모든 구현체가 계획대로 완성됨. AI Gateway의 분석 프롬프트 연결은 Phase 2 범위.

## Next Phase Readiness

- Plan 03 (네이버 뉴스 수집기): Collector 인터페이스 + CollectionOptionsSchema 준비 완료
- Plan 04 (유튜브 수집기): 동일한 Collector 인터페이스 기반으로 구현 가능
- Plan 05 (파이프라인 통합): triggerCollection + createCollectorWorker/createPipelineWorker 준비 완료
- AI Gateway는 Phase 2에서 8개 분석 모듈 프롬프트와 연결 예정

## Superpowers 호출 기록

| #   | 스킬명 | 호출 시점 | 결과 요약 |
| --- | ------ | --------- | --------- |

### 미호출 스킬 사유

| 스킬명                              | 미호출 사유                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| superpowers:brainstorming           | Plan이 매우 구체적인 코드 스니펫을 포함하여 추가 브레인스토밍 불필요          |
| superpowers:test-driven-development | Plan이 TDD가 아닌 구현 후 테스트 스캐폴드 방식으로 설계됨                     |
| superpowers:systematic-debugging    | 빌드 에러는 모두 명확한 원인(버전 충돌, API 변경)이 있어 체계적 디버깅 불필요 |
| superpowers:requesting-code-review  | 병렬 실행 에이전트로 코드 리뷰 스킬 호출 생략                                 |

---

_Phase: 01-foundation-core-data-collection_
_Completed: 2026-03-24_
