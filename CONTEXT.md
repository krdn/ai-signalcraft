# CONTEXT — AI SignalCraft 도메인·아키텍처 어휘

아키텍처 리뷰(`/improve-codebase-architecture`)와 디버깅에서 확정된 도메인 언어와
**load-bearing invariant**(손대면 안 되는 의도된 설계)를 기록한다. 새 리뷰가 같은 지점을
"낮게 매달린 열매"로 다시 제안하지 않도록 하는 것이 목적이다.

## 도메인 어휘

- **AnalysisInput** — DB/collector에서 로드한 분석 입력(articles/videos/comments/dateRange/domain).
  분석 모듈 전체가 읽는 핵심 도메인 모델. 삭제 테스트 통과(개념 자체는 제 몫을 함).
- **구성 경로(intake) 이중성** — `AnalysisInput`을 만드는 두 경로:
  - **키워드 경로** `loadAnalysisInput` — 분석 DB N:M 조인 직접 조회.
  - **구독 경로** `loadAnalysisInputViaCollector` → `loadAnalysisInputFromCollector` — collector RPC(RAG).
  - 선택은 `pipeline-orchestrator.ts`의 `isCollectorPath`(`USE_COLLECTOR_LOADER`/job options).
- **ragSample vs fullset** — collector RPC `fetchAnalysisPayload` 반환의 두 데이터:
  - `ragSample`: 의미검색으로 추린 관련 상위 항목. **유사도 컷오프 없음**(거리순 topK).
  - `fullset`: 잡 윈도우 전체 풀(최대 50,000). linkage 복원·폴백용.
  - 둘은 "둘 중 하나"가 아니라 목적이 다른 데이터. 게이트는 `selectAnalysisRows`가 담당.
- **un-inflated 타겟 vs articleVideoTopK** — `articleTopK+clusterRepresentatives`/`commentTopK`가
  다운스트림 컷 타겟(진짜 필요량). `articleVideoTopK`는 그것을 ×3·1500cap한 **over-fetch 요청값**.
  RAG가 충분히 줬는지 판정할 땐 반드시 **un-inflated 타겟**과 비교한다(over-fetch 값 아님).

## Load-bearing invariants (do NOT "refactor away")

리뷰가 shallow/DRY로 오인하기 쉬우나 의도된 설계다.

### 1. BullMQ prefix 분기 = 서비스 격리 (통일 금지)

- `packages/core/src/queue/connection.ts` → `bull`(운영)/`ais-dev`(개발).
- `apps/collector/src/queue/connection.ts` → `collector`/`collector-dev`.
- core와 collector는 **같은 Redis를 공유하되 prefix로 큐를 분리**한다. 통일하면 두 서비스가
  한 네임스페이스로 병합 → 유령 실행 릴레이·워커 크래시 루프(PR #151/#155)의 큐 오염 재현.
- `getBullMQOptions()` 수동 spread(16곳)는 caller discipline이지만, prefix 분기 자체는 결함이 아님.

### 2. control.ts 큐 스코프: 전역 vs 잡별 (제네릭 가드로 묶지 말 것)

- `pausePipeline`/`resumePipeline`은 **전역** `getQueue('analysis').pause()/.resume()` (전체 잡 영향).
- `cancelPipeline`은 **잡별** `removeWaitingBullMQJobs(jobId)`.
- `setCostLimit`/`setSkippedModules`는 **의도적으로 가드 없음**(running/paused 잡도 변경 허용).
- 이 호출별 부작용 변이를 `guardedTransition` 슬롯으로 숨기면 cross-job 파손(#153,
  `run_cancellations` cooperative cancel 단일 진실)을 유발한다.

### 3. kit는 domain-agnostic — wrapper가 정답 (kit 인터페이스 확장 금지)

- `runner.ts`의 `boundModule`이 `input.domain`/priorResults/JSON_REMINDER를 closure로 바인딩.
- kit(`@krdn/llm-gateway`)은 `buildSystemPrompt()`를 인자 없이 호출(by design). 단일 호출처라
  "잊을" 수 없고, 고토큰 Stage 1은 map-reduce로 kit을 우회한다.
- domain을 kit 인터페이스로 밀면 다른 소비처(아키텍처 워크플로 보고 기준 tickerlens·
  ai-afterschool-fsd — 미검증)로 횡단 확장 → cross-repo blast radius. 현재 wrapper가
  adapter 경계의 정확한 seam.

### 4. collector RAG fallback 게이트 의미론 (`selectAnalysisRows`)

- collector RAG는 유사도 컷오프가 없어 ragSample이 거의 0건이 안 된다. 따라서 "0건이면 폴백"은
  무력화되고, 임베딩 희소(NULL 29~72%)로 RAG가 under-deliver하면 데이터 손실이 났었다(수정됨).
- 현재 판정: ragRows가 **un-inflated 타겟 이상**이면 신뢰(관련도 순위 보존), 미달이고 풀이 더 크면
  `dedup(ragRows ++ fullset)` 병합으로 **커버리지 복구**(이후 시계열 컷이 재샘플하므로 순위가
  아닌 범위 복구). 무조건 병합 금지(RAG 성공 시 관련도 신호 파괴).
