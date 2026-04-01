# Phase 9: 타입 & 테스트 강화 - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

분산된 타입 정의를 패키지별 types/ 디렉토리로 중앙화하고, ai-gateway 패키지에 단위 테스트를 추가하며, 300줄 이상인 테스트 파일을 모듈별로 분할한다. 기능 변경 없이 내부 구조만 개선하는 리팩토링이다.

</domain>

<decisions>
## Implementation Decisions

### 타입 중앙화 범위

- **D-01:** Zod schema와 co-located된 타입(z.infer Result 타입)은 schema 파일에 유지한다 — 12개 schema 파일의 Result 타입은 이동하지 않음. schema와 타입이 함께 있어야 수정이 용이
- **D-02:** 인라인 interface/type alias(ReportGenerationInput, PdfExportOptions, ModuleModelConfig, ProviderKeyInfo, CommunitySource 등)는 해당 패키지의 types/ 디렉토리로 이동한다 — import 경로를 통일하고 타입 검색을 한 곳으로 집중
- **D-03:** 기존 barrel export(index.ts) 패턴을 유지하여 외부 import 경로('@ai-signalcraft/core' 등) 호환성을 보장한다 (Phase 8 D-06 계승)

### 패키지 간 타입 공유

- **D-04:** AIProvider 타입은 ai-gateway 패키지에서 단일 정의하고, core 패키지가 ai-gateway에서 import한다 — gateway가 AI 프로바이더 타입의 소유자. core/src/analysis/types.ts의 중복 정의를 제거
- **D-05:** 공유 타입 패키지(packages/shared)는 만들지 않는다 — 현재 중복은 AIProvider 하나뿐이므로 과도한 추상화 불필요

### ai-gateway 테스트 전략

- **D-06:** vi.mock('ai')로 generateText/generateObject를 mock하여 실제 AI 호출 없이 테스트한다 — 비용 발생 없이 빠른 테스트 실행
- **D-07:** 주요 함수(getModel, analyzeText, analyzeStructured) 단위 테스트를 작성한다 — getModel의 프로바이더별 라우팅, baseUrl 정규화, 기본값 처리 + analyzeText/analyzeStructured의 옵션 전달 검증

### 테스트 파일 분할

- **D-08:** 300줄 초과인 테스트 파일만 분할 대상으로 한다 — advn-schema.test.ts(300줄, 경계선)가 대상. 276줄, 225줄 파일은 유지하여 최소한의 변경으로 요구사항 충족
- **D-09:** 분할 기준은 모듈/describe 블록 단위로 한다 — 논리적 그룹별로 파일 분리

### Claude's Discretion

- types/ 디렉토리 내 파일 분류 방식 (analysis.ts, pipeline.ts, report.ts 등 또는 단일 index.ts)
- ai-gateway 테스트 파일 위치 및 구조
- advn-schema.test.ts 분할 시 정확한 경계점

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 타입 분산 현황 (이동 대상)

- `packages/core/src/analysis/types.ts` — AIProvider(중복, 제거 대상), AnalysisModule, AnalysisInput, AnalysisModuleResult
- `packages/core/src/analysis/model-config.ts` — ModuleModelConfig interface
- `packages/core/src/analysis/provider-keys.ts` — ProviderKeyInfo interface
- `packages/core/src/report/generator.ts` — ReportGenerationInput interface
- `packages/core/src/report/pdf-exporter.ts` — PdfExportOptions interface
- `packages/core/src/pipeline/normalize.ts` — CommunitySource type

### 기존 types/ 디렉토리

- `packages/core/src/types/index.ts` — CollectionTrigger, SourceStatus, JobProgress (이미 중앙화됨)
- `packages/collectors/src/types/community.ts` — CommunityPost, CommunityComment (이미 중앙화됨)

### ai-gateway 소스 (테스트 대상)

- `packages/ai-gateway/src/gateway.ts` — getModel, analyzeText, analyzeStructured (112줄, 테스트 0개)
- `packages/ai-gateway/src/index.ts` — barrel export

### 대형 테스트 파일 (분할 대상)

- `packages/core/tests/advn-schema.test.ts` — 300줄 (분할 대상)

### barrel export 파일 (import 경로 영향)

- `packages/core/src/analysis/index.ts` — analysis barrel export
- `packages/core/src/index.ts` — 패키지 최상위 export
- `packages/ai-gateway/src/index.ts` — gateway barrel export

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/core/src/types/index.ts`: 이미 Zod schema + re-export 패턴 사용 중 — 동일 패턴으로 분산 타입 수집
- `packages/collectors/src/types/community.ts`: collectors 패키지의 타입 중앙화 선례 — core도 동일 구조 적용
- `packages/core/tests/`: Vitest 사용 중, vi.mock 패턴 적용 가능

### Established Patterns

- Barrel export: 모든 패키지가 `export * from` 패턴 사용 — 타입 이동 후에도 동일 패턴 유지
- 테스트: Vitest + describe/it 구조, vi.mock으로 외부 의존성 mock
- 패키지 간 의존: core가 ai-gateway에 이미 의존 (`@ai-signalcraft/ai-gateway` import)

### Integration Points

- `AIProvider` 제거 시 core의 analysis/types.ts → ai-gateway import로 변경 필요
- types/ 이동 시 기존 직접 import 경로 → barrel export import로 리다이렉트
- ai-gateway 테스트 추가 시 package.json에 vitest devDependency 확인 필요

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

_Phase: 09-types-tests_
_Context gathered: 2026-03-27_
