# Phase 8: Core 구조 정리 - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

packages/core의 대형 파일 3개(worker-process 452줄, provider-keys 443줄, runner 383줄)를 분할하고 에러 처리 패턴을 통일한다. 기능 변경 없이 내부 구조만 개선하는 리팩토링이다.

</domain>

<decisions>
## Implementation Decisions

### 파일 분할 전략

- **D-01:** worker-process.ts를 Worker별로 분리한다 — collector-worker.ts + pipeline-worker.ts + analysis-worker.ts + worker-config.ts(env 로드/수집기 등록/유틸) + worker-process.ts(진입점/shutdown만)
- **D-02:** provider-keys.ts를 CRUD와 테스트로 분리한다 — provider-keys.ts(CRUD 5개 함수만) + provider-test.ts(testProviderConnection + chatWithProvider + getDefaultBaseUrl)
- **D-03:** runner.ts를 단일 실행과 오케스트레이션으로 분리한다 — runner.ts(runModule 단일 모듈 실행) + pipeline-orchestrator.ts(Stage 0~4 오케스트레이션 로직 + buildResult)

### 에러 처리 패턴

- **D-04:** 계층형 에러 클래스를 도입한다 — SignalCraftError(base) > CollectionError / AnalysisError / PipelineError / ProviderError. 각각 errorCode, context 필드 포함
- **D-05:** 구조화 로거를 도입한다 — createLogger('module-name') 패턴으로 [module] prefix 자동 부여. info/warn/error 레벨 지원. 현재 console.warn/error 혼재를 정리

### export/import 호환성

- **D-06:** 기존 barrel export(index.ts) 패턴을 유지한다 — 분할한 파일들도 각 디렉토리의 index.ts에서 re-export하여 기존 import 경로('@ai-signalcraft/core' 등) 그대로 유지

### 테스트 전략

- **D-07:** 기존 테스트 통과 확인만 수행한다 — 현재 11개 테스트 파일(1442줄)이 리팩토링 후에도 모두 통과하는지만 검증. 추가 테스트 작성은 Phase 9에서 다룸

### Claude's Discretion
- 에러 클래스 파일 위치 (utils/errors.ts 또는 별도 errors/ 디렉토리)
- 로거 구현 세부사항 (console 래핑 수준, 포맷)
- 각 분할 파일의 정확한 줄 수 분배

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 대상 파일 (분할 대상)
- `packages/core/src/queue/worker-process.ts` — Worker 실행 프로세스 (452줄, collector/pipeline/analysis 3개 Worker + env설정 + shutdown)
- `packages/core/src/analysis/provider-keys.ts` — AI 프로바이더 API 키 CRUD + 연결 테스트 + 채팅 테스트 (443줄)
- `packages/core/src/analysis/runner.ts` — 분석 파이프라인 오케스트레이션 Stage 0~4 (383줄)

### 관련 파일 (import/export 영향)
- `packages/core/src/analysis/index.ts` — barrel export (runner, provider-keys re-export)
- `packages/core/src/queue/index.ts` — queue 관련 barrel export
- `packages/core/src/index.ts` — 패키지 최상위 export

### 에러 패턴 참조
- `packages/core/src/pipeline/control.ts` — 파이프라인 제어 (취소/일시정지/비용한도)
- `packages/core/src/analysis/data-loader.ts` — 데이터 로더 에러 처리 패턴
- `packages/core/src/utils/crypto.ts` — 유틸 에러 처리 패턴

### 테스트 파일
- `packages/core/tests/worker.test.ts` — Worker 테스트 (51줄)
- `packages/core/tests/analysis-runner.test.ts` — Runner 테스트 (126줄)
- `packages/core/tests/queue.test.ts` — Queue 테스트 (57줄)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `analysis/index.ts`: 이미 barrel export 패턴 사용 중 — 분할 파일 추가 시 동일 패턴 적용
- `packages/core/src/utils/`: crypto.ts 유틸 모듈 존재 — 에러 클래스, 로거도 utils/에 배치 가능

### Established Patterns
- Barrel export: analysis/index.ts, queue/index.ts, pipeline/index.ts 모두 `export * from` 패턴
- 에러 처리: 현재 throw/catch + console.warn/error 혼재 (47개 패턴, 9개 파일)
- Worker 패턴: createCollectorWorker/createPipelineWorker 팩토리 함수 사용

### Integration Points
- `worker-process.ts`는 독립 프로세스로 실행됨 (`pnpm worker`) — 분할해도 진입점만 유지하면 됨
- `runner.ts`의 `runAnalysisPipeline`은 worker-process.ts에서 호출됨 — import 경로 유지 필수
- `provider-keys.ts`의 함수들은 web API routes에서 직접 import됨 — barrel export로 호환성 보장

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-core*
*Context gathered: 2026-03-27*
