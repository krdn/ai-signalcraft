# Phase 8: Core 구조 정리 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 8-Core 구조 정리
**Areas discussed:** 파일 분할 전략, 에러 처리 패턴, export/import 호환성, 테스트 전략

---

## 파일 분할 전략

### worker-process.ts

| Option        | Description                                                                                                  | Selected |
| ------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| Worker별 분리 | collector-worker.ts + pipeline-worker.ts + analysis-worker.ts + worker-config.ts + worker-process.ts(진입점) | ✓        |
| 기능별 분리   | config.ts + handlers.ts + start.ts — ROADMAP 제안과 일치                                                     |          |
| Claude 재량   | 코드 구조 분석 후 최적 판단 위임                                                                             |          |

**User's choice:** Worker별 분리 (추천)
**Notes:** 각 Worker의 로직이 독립적이므로 가장 자연스러운 분할

### provider-keys.ts

| Option             | Description                                                 | Selected |
| ------------------ | ----------------------------------------------------------- | -------- |
| CRUD + 테스트 분리 | provider-keys.ts(CRUD) + provider-test.ts(연결/채팅 테스트) | ✓        |
| 제네릭화로 압축    | CRUD 함수를 제네릭으로 통합하여 코드량 자체를 줄임          |          |
| Claude 재량        | 코드 구조 분석 후 판단 위임                                 |          |

**User's choice:** CRUD + 테스트 분리 (추천)
**Notes:** CRUD와 연결테스트는 관심사가 다름

### runner.ts

| Option              | Description                                                | Selected |
| ------------------- | ---------------------------------------------------------- | -------- |
| 오케스트레이션 분리 | runner.ts(runModule) + pipeline-orchestrator.ts(Stage 0~4) | ✓        |
| Stage별 분리        | stage1.ts, stage2.ts, stage3.ts, stage4.ts 각각 독립 모듈  |          |
| Claude 재량         | 코드 구조 분석 후 판단 위임                                |          |

**User's choice:** 오케스트레이션 분리 (추천)
**Notes:** 단일 실행 vs 전체 파이프라인 분리

---

## 에러 처리 패턴

### 에러 클래스 설계

| Option           | Description                                                                        | Selected |
| ---------------- | ---------------------------------------------------------------------------------- | -------- |
| 계층형 에러      | SignalCraftError > CollectionError / AnalysisError / PipelineError / ProviderError | ✓        |
| 단일 에러 + 코드 | SignalCraftError 하나에 errorCode enum으로 구분                                    |          |
| Claude 재량      | 코드베이스 복잡도에 맞게 판단 위임                                                 |          |

**User's choice:** 계층형 에러 (추천)
**Notes:** 에러 유형별 처리 가능

### 로거 통일

| Option       | Description                                            | Selected |
| ------------ | ------------------------------------------------------ | -------- |
| 구조화 로거  | createLogger('module-name') 패턴, info/warn/error 레벨 | ✓        |
| console 유지 | 기존 console.log/warn/error 유지, prefix만 통일        |          |
| Claude 재량  | 현재 패턴 분석 후 최소 변경 방식 판단                  |          |

**User's choice:** 구조화 로거 (추천)
**Notes:** 현재 console.warn/error 혼재 정리

---

## export/import 호환성

| Option               | Description                                              | Selected |
| -------------------- | -------------------------------------------------------- | -------- |
| barrel export 유지   | 기존 index.ts re-export 패턴 유지, 외부 import 경로 불변 | ✓        |
| 직접 import 업데이트 | 모든 외부 import를 새 파일 경로로 변경                   |          |
| Claude 재량          | 현재 패턴에 따라 판단                                    |          |

**User's choice:** barrel export 유지 (추천)
**Notes:** analysis/index.ts가 이미 barrel export 사용 중

---

## 테스트 전략

| Option                  | Description                                                | Selected |
| ----------------------- | ---------------------------------------------------------- | -------- |
| 기존 테스트 통과 확인만 | 11개 테스트 파일(1442줄) 통과 검증만                       | ✓        |
| 분할 단위 테스트 추가   | 새 모듈(createLogger, SignalCraftError)에 단위 테스트 추가 |          |
| Claude 재량             | 변경 범위에 따라 필요한 테스트만 추가                      |          |

**User's choice:** 기존 테스트 통과 확인만 (추천)
**Notes:** 추가 테스트는 Phase 9에서 다룸

---

## Claude's Discretion

- 에러 클래스 파일 위치
- 로거 구현 세부사항
- 분할 파일의 정확한 줄 수 분배

## Deferred Ideas

None
