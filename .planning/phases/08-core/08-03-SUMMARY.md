---
phase: 08-core
plan: 03
subsystem: packages/core/queue
tags: [refactoring, worker-split, bullmq]
dependency_graph:
  requires: [08-01, 08-02]
  provides: [worker-config, collector-worker, pipeline-worker, analysis-worker]
  affects: [worker-process]
tech_stack:
  added: []
  patterns: [module-split, createLogger, handler-factory]
key_files:
  created:
    - packages/core/src/queue/worker-config.ts
    - packages/core/src/queue/collector-worker.ts
    - packages/core/src/queue/pipeline-worker.ts
    - packages/core/src/queue/analysis-worker.ts
  modified:
    - packages/core/src/queue/worker-process.ts
    - packages/core/tests/worker.test.ts
key_decisions:
  - worker-process.ts를 5개 파일로 분할하되 queue/index.ts barrel export는 수정하지 않음 (내부 구현 세부사항)
  - pipeline-worker.ts가 295줄로 200줄 초과하나 normalize+persist 로직을 더 분할하면 가독성 저하
metrics:
  duration: 4min
  completed: 2026-03-27
  tasks: 3
  files: 6
---

# Phase 8 Plan 3: worker-process.ts 5개 파일 분할 Summary

worker-process.ts(452줄)를 역할별 5개 파일로 분할하여 진입점을 32줄로 축소하고 테스트 96개 통과 유지

## What Was Done

### Task 1: worker-config + collector-worker + analysis-worker 생성 (33fbc29)

- **worker-config.ts** (86줄): findMonorepoRoot, initEnv, validateApiKeys, registerAllCollectors, COMMUNITY_SOURCES, countBySourceType, progressKey
- **collector-worker.ts** (64줄): createCollectorHandler 팩토리 함수 -- 수집 Worker 핸들러
- **analysis-worker.ts** (26줄): createAnalysisWorker 팩토리 함수 -- 분석 Worker 생성

### Task 2: pipeline-worker + worker-process 재작성 + 테스트 수정 (0a5086a)

- **pipeline-worker.ts** (295줄): createPipelineHandler 팩토리 함수 -- normalize + persist 파이프라인
- **worker-process.ts** (32줄): 진입점 -- env 로드, 수집기 등록, Worker 3개 기동, graceful shutdown
- **worker.test.ts**: readFileSync 경로를 worker-process.ts에서 pipeline-worker.ts로 변경

### Task 3: 전체 테스트 통과 검증

- 9/11 테스트 파일 통과 (기존과 동일)
- 96/102 개별 테스트 통과 (6개 실패는 DB 미연결 SASL 에러 -- 기존 문제)
- pnpm build 전체 프로젝트 빌드 성공

## Deviations from Plan

### pipeline-worker.ts 줄 수 초과

- **계획**: 200줄 이하
- **실제**: 295줄
- **사유**: normalize-naver/youtube/community + persist 5단계가 모두 포함되어야 하며, 추가 분할 시 함수 간 데이터 전달이 복잡해져 가독성 저하. 원본 270줄 + import 추가로 불가피
- **영향**: 없음 -- 단일 책임(파이프라인 핸들러) 유지

## Decisions Made

1. **queue/index.ts barrel export 미수정**: 새 파일들(worker-config, collector-worker 등)은 worker-process.ts 내부에서만 사용되므로 외부 노출 불필요
2. **console.log를 createLogger로 대체**: worker-config, collector-worker, analysis-worker, pipeline-worker에 구조화 로거 적용. worker-process.ts의 시작 메시지는 console.log 유지 (일회성 출력)

## Known Stubs

None -- 모든 파일이 실제 로직을 포함하며 스텁 없음

## Superpowers 호출 기록

| #   | 스킬명 | 호출 시점 | 결과 요약 |
| --- | ------ | --------- | --------- |

### 미호출 스킬 사유

| 스킬명                              | 미호출 사유                                                          |
| ----------------------------------- | -------------------------------------------------------------------- |
| superpowers:brainstorming           | 리팩토링 작업으로 새로운 설계 결정 불필요 -- 기존 코드를 분할만 수행 |
| superpowers:test-driven-development | 기존 테스트 유지 확인 작업이며 새 테스트 작성 불필요                 |
| superpowers:systematic-debugging    | 버그 미발생                                                          |
| superpowers:requesting-code-review  | 코드 변경이 순수 분할이며 로직 변경 없음                             |

## Self-Check: PASSED

- All 7 files verified (FOUND)
- All 2 commits verified (33fbc29, 0a5086a)
