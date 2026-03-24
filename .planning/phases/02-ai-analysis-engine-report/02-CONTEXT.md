# Phase 2: AI Analysis Engine + Report - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

수집된 데이터에 대해 AI 기반 감성/키워드/심층 분석을 실행하고, 8개 분석 모듈 결과를 통합한 종합 전략 리포트를 자동 생성한다. 추가 기능(지지율 추정, 프레임 전쟁, 위기 시나리오, 승리 시뮬레이션)은 Phase 4 범위.

</domain>

<decisions>
## Implementation Decisions

### 분석 모듈 구조
- **D-01:** 8개 분석 항목을 각각 독립된 모듈로 분리. 각 모듈이 개별 프롬프트 + Zod 스키마로 구조화된 결과 반환.
- **D-02:** Phase 2 범위: 분석 1~7 + 최종 요약(8번). 추가 기능 1~4(ADVN-01~04)는 Phase 4.
  - 모듈 1: 전체 여론 구조 분석 (Macro View) → ANLZ-01
  - 모듈 2: 집단별 반응 분석 (Segmentation) → ANLZ-04
  - 모듈 3: 감정 및 프레임 분석 (Sentiment & Framing) → ANLZ-01, DEEP-01
  - 모듈 4: 메시지 효과 분석 (Message Impact) → DEEP-02
  - 모듈 5: 리스크 분석 (Risk Map) → DEEP-03
  - 모듈 6: 기회 분석 (Opportunity) → DEEP-04
  - 모듈 7: 전략 도출 (Actionable Strategy) → DEEP-05
  - 모듈 8: 최종 전략 요약 → REPT-02

### AI 모델 선택 전략
- **D-03:** 모듈별 최적 AI 모델 지정. 감성/키워드 등 정량 분석은 GPT-4o-mini(비용 절감), 심층 분석(리스크/전략)은 Claude Sonnet(품질 우선). AI Gateway에서 모듈별 모델 라우팅.

### 리포트 생성 방식
- **D-04:** 2단계 하이브리드 생성. 1단계: 각 모듈이 독립적으로 Zod 구조화 결과 생성. 2단계: 모든 모듈 결과를 AI에 넘겨 자연어 종합 리포트 생성.
- **D-05:** 최종 포맷은 마크다운 우선. PDF 내보내기 기능 제공. 두 단계 모두 DB에 저장.

### 분석 결과 DB 스키마
- **D-06:** 단일 `analysis_results` 테이블 + JSONB 구조. jobId, module(감성/키워드/프레임 등), result(JSONB) 저장. 모듈별 Zod 스키마가 다르므로 JSONB가 유연.
- **D-07:** 별도 `analysis_reports` 테이블에 종합 리포트(마크다운) 저장.
- **D-08:** 히스토리 비교 기능은 Phase 3 대시보드에서 구현. Phase 2에서는 저장만.

### 파이프라인 연결
- **D-09:** 수집 완료 후 자동 분석 실행. BullMQ Flow에 analyze 단계 추가: collect → normalize → persist → analyze → report.
- **D-10:** 병렬 분석 → 순차 통합 패턴. 1단계: 감성/키워드/시계열/집단별 분석을 병렬 실행. 2단계: 1단계 결과 기반으로 프레임/메시지효과/리스크/기회/전략 순차 실행. 3단계: 종합 리포트 생성.

### Claude's Discretion
- 각 분석 모듈의 구체적 프롬프트 엔지니어링
- Zod 스키마의 세부 필드 설계
- PDF 내보내기 라이브러리 선택
- 에러 핸들링 및 부분 실패 처리 전략
- 분석 결과 캐싱 전략

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 분석 프롬프트 원본
- `docs/prompt.md` — 8개 분석 모듈 + 4개 추가 기능의 입출력 정의. 각 모듈의 분석 항목과 기대 출력 형식.

### Phase 1 산출물
- `.planning/phases/01-foundation-core-data-collection/01-05-SUMMARY.md` — 정규화/파이프라인 통합 결과
- `.planning/phases/01-foundation-core-data-collection/01-06-SUMMARY.md` — 네이버 댓글 Gap Closure 결과

### 기존 코드
- `packages/ai-gateway/src/gateway.ts` — AI Gateway 골격 (analyzeText, analyzeStructured). AI SDK v4 기반이므로 v6 업그레이드 필요.
- `packages/core/src/db/schema/collections.ts` — 현재 DB 스키마 (collectionJobs, articles, videos, comments). 분석 테이블 추가 필요.
- `packages/core/src/queue/flows.ts` — BullMQ Flow 구조 (collect → normalize → persist). analyze 단계 추가 필요.
- `packages/core/src/pipeline/normalize.ts` — 정규화 함수 패턴 참고.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/ai-gateway/src/gateway.ts`: `analyzeText()`, `analyzeStructured()` — Phase 2 분석 모듈의 AI 호출 기반. Zod 스키마 기반 구조화 출력 이미 지원.
- `packages/core/src/queue/flows.ts`: `triggerCollection()` — BullMQ FlowProducer 패턴. analyze 단계 확장 시 동일 패턴 사용.
- `packages/core/src/pipeline/normalize.ts`: 정규화 함수 4개 — 분석 결과 정규화 함수 작성 시 동일 패턴 참고.
- `packages/core/src/pipeline/persist.ts`: `persistArticles()` 등 upsert 함수 — 분석 결과 persist 함수 작성 시 동일 패턴 참고.

### Established Patterns
- Collector Adapter Pattern: 소스별 수집기가 동일 인터페이스 구현. 분석 모듈도 동일 패턴(AnalysisModule 인터페이스) 적용 가능.
- BullMQ Flow: 부모-자식 관계로 파이프라인 단계 표현. analyze 단계를 persist 다음 자식으로 추가.
- Zod + AI SDK: `analyzeStructured()`가 이미 Zod 스키마 기반 구조화 출력 지원.

### Integration Points
- `packages/core/src/queue/worker-process.ts`: pipelineWorker에 analyze/report 핸들러 추가 필요.
- `packages/core/src/db/schema/collections.ts`: analysis_results, analysis_reports 테이블 추가.
- `packages/core/src/index.ts`: 새 모듈 re-export 필요.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

- 추가 기능 1~4 (지지율 추정, 프레임 전쟁, 위기 시나리오, 승리 시뮬레이션) — Phase 4
- 분석 히스토리 비교/조회 UI — Phase 3
- 재분석(기존 수집 데이터에 대해 다시 분석) 기능 — Phase 3 대시보드에서 트리거

</deferred>

---

*Phase: 02-ai-analysis-engine-report*
*Context gathered: 2026-03-24*
