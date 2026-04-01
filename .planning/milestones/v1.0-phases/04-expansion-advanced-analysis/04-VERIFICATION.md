---
phase: 04-expansion-advanced-analysis
verified: 2026-03-24T11:30:00Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "브라우저에서 분석 실행 탭에 소스 체크박스 5개(네이버/유튜브/DC갤러리/에펨코리아/클리앙)와 '커뮤니티' 그룹 레이블이 표시되는지 확인"
    expected: "5개 체크박스, '뉴스/영상'과 '커뮤니티' 2개 그룹으로 나뉘어 표시됨"
    why_human: 'UI 그룹화 레이아웃과 체크박스 동작은 코드 정적 분석으로 확인 불가'
  - test: "상단 네비게이션에 5번째 탭 '고급 분석'이 표시되고 클릭 시 4개 시각화 카드가 2x2 그리드로 렌더링되는지 확인"
    expected: 'AI 지지율 카드, 프레임 전쟁 차트, 위기 시나리오 카드 3종, 승리 시뮬레이션 카드가 배치됨'
    why_human: '탭 클릭 동작 및 2x2 그리드 시각적 레이아웃은 브라우저에서만 확인 가능'
  - test: 'AI 지지율 카드에 면책 문구가 실제로 표시되는지 확인'
    expected: '카드 하단에 회색 텍스트로 면책 문구(disclaimer 필드 값)가 표시됨'
    why_human: '카드 내 데이터 렌더링과 스타일링은 실제 실행 환경에서만 검증 가능'
  - test: '위기 시나리오 섹션에 확산/통제/역전 3개 카드가 색상 테마별(빨간/노란/초록)로 표시되는지 확인'
    expected: 'spread(빨간), control(노란), reverse(초록) 카드가 가로 3열로 표시됨'
    why_human: '색상 테마와 레이아웃은 브라우저 렌더링으로만 확인 가능'
  - test: '실제 분석을 트리거하여 커뮤니티 소스(DC갤러리 등)가 파이프라인에서 독립 실행되는지 확인'
    expected: '커뮤니티 소스 하나 실패 시 다른 소스 수집이 계속 진행됨'
    why_human: '실시간 수집 파이프라인 동작과 부분 실패 내성은 실제 실행 없이 확인 불가'
---

# Phase 4: Expansion + Advanced Analysis Verification Report

**Phase Goal:** 커뮤니티(DC갤러리, 에펨코리아, 클리앙) 수집기가 추가되고, AI 지지율 추정/프레임 전쟁/위기 시나리오/승리 시뮬레이션 고급 분석이 대시보드에서 제공된다. X(트위터) 수집기(COLL-05)는 v2로 이월.
**Verified:** 2026-03-24T11:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                             | Status     | Evidence                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DC갤러리, 에펨코리아, 클리앙에서 게시글과 댓글이 수집되며 개별 수집기 실패가 전체 파이프라인에 영향을 주지 않는다 | ✓ VERIFIED | `DCInsideCollector`, `FMKoreaCollector`, `ClienCollector` 모두 223/222/223 라인 완전 구현. BullMQ Flow에서 3개 커뮤니티 소스가 독립 자식 작업으로 등록되어 격리 실행. 개별 게시글 실패 시 `catch`로 건너뜀.                                                                                       |
| 2   | AI 지지율 추정치가 감정 비율과 플랫폼 편향을 보정하여 산출되고 "참고치" 한계가 명시된다                           | ✓ VERIFIED | `ApprovalRatingSchema`에 `estimatedRange(min/max)`, `platformBiasCorrection`, `disclaimer` 필드 확인. `approvalRatingModule.buildSystemPrompt()`에 면책 문구 강제 포함. `approval-rating-card.tsx` 164번 줄에 `disclaimer` 렌더링 코드 확인.                                                      |
| 3   | 프레임 전쟁 분석, 위기 대응 시나리오 3개, 승리 확률 시뮬레이션이 생성되어 리포트에 통합된다                       | ✓ VERIFIED | `FrameWarSchema`(dominantFrames/threateningFrames/reversibleFrames), `CrisisScenarioSchema`(z.tuple로 spread/control/reverse 3개 고정), `WinSimulationSchema`(winProbability/winConditions/loseConditions). `runner.ts`에 Stage 4 파이프라인 통합. `generator.ts`에 advnResults 조건부 섹션 추가. |
| 4   | 대시보드에 5번째 '고급 분석' 탭이 추가되어 고급 분석 결과가 시각화된다                                            | ✓ VERIFIED | `top-nav.tsx`의 `TAB_LABELS`에 '고급 분석' 추가 확인. `page.tsx`에 `AdvancedView` import + `AdvancedTab` 컴포넌트 + panels 배열 인덱스 4 등록 확인. 4개 시각화 컴포넌트 모두 실체 구현(115~210 라인).                                                                                             |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                                                       | Expected                   | Status     | Details                                                                                                                                                      |
| -------------------------------------------------------------- | -------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/collectors/src/adapters/dcinside.ts`                 | DC갤러리 수집기            | ✓ VERIFIED | 223 라인. `DCInsideCollector implements Collector<CommunityPost>`, `source = 'dcinside'`, Playwright+Cheerio 완전 구현, fallback 셀렉터, User-Agent 로테이션 |
| `packages/collectors/src/adapters/fmkorea.ts`                  | 에펨코리아 수집기          | ✓ VERIFIED | 222 라인. `FMKoreaCollector implements Collector<CommunityPost>`, `source = 'fmkorea'`, XE/Rhymix 구조 파싱                                                  |
| `packages/collectors/src/adapters/clien.ts`                    | 클리앙 수집기              | ✓ VERIFIED | 223 라인. `ClienCollector implements Collector<CommunityPost>`, `source = 'clien'`, 403 보호 대응 Playwright 전용, 가장 긴 딜레이(3-5초)                     |
| `packages/collectors/src/types/community.ts`                   | 커뮤니티 공통 타입         | ✓ VERIFIED | `CommunityPost`, `CommunityComment` 인터페이스 정의                                                                                                          |
| `packages/collectors/src/utils/community-parser.ts`            | 커뮤니티 공통 유틸         | ✓ VERIFIED | `parseDateText`, `randomDelay`(sleep), `sanitizeContent`, `buildSearchUrl` 구현                                                                              |
| `packages/core/src/analysis/schemas/approval-rating.schema.ts` | AI 지지율 Zod 스키마       | ✓ VERIFIED | `ApprovalRatingSchema`, `estimatedRange(min/max)`, `platformBiasCorrection`, `disclaimer` 필드 포함                                                          |
| `packages/core/src/analysis/schemas/frame-war.schema.ts`       | 프레임 전쟁 Zod 스키마     | ✓ VERIFIED | `FrameWarSchema`, `dominantFrames`, `threateningFrames`, `reversibleFrames` 포함                                                                             |
| `packages/core/src/analysis/schemas/crisis-scenario.schema.ts` | 위기 시나리오 Zod 스키마   | ✓ VERIFIED | `CrisisScenarioSchema`, `z.tuple`로 spread/control/reverse 3개 순서 강제                                                                                     |
| `packages/core/src/analysis/schemas/win-simulation.schema.ts`  | 승리 시뮬레이션 Zod 스키마 | ✓ VERIFIED | `WinSimulationSchema`, `winProbability(0~100)`, `winConditions`, `loseConditions` 포함                                                                       |
| `packages/core/src/analysis/modules/approval-rating.ts`        | AI 지지율 모듈             | ✓ VERIFIED | 79 라인. `approvalRatingModule`, `buildSystemPrompt`에 면책 문구 강제 포함, `buildPromptWithContext`로 선행 결과 참조                                        |
| `packages/core/src/analysis/modules/frame-war.ts`              | 프레임 전쟁 모듈           | ✓ VERIFIED | 65 라인. `frameWarModule`, `AnalysisModule` 인터페이스 구현                                                                                                  |
| `packages/core/src/analysis/modules/crisis-scenario.ts`        | 위기 시나리오 모듈         | ✓ VERIFIED | 70 라인. `crisisScenarioModule`, 3개 시나리오 고정                                                                                                           |
| `packages/core/src/analysis/modules/win-simulation.ts`         | 승리 시뮬레이션 모듈       | ✓ VERIFIED | 66 라인. `winSimulationModule`, 전체 선행 결과 참조                                                                                                          |
| `apps/web/src/components/advanced/advanced-view.tsx`           | 고급 분석 탭 메인          | ✓ VERIFIED | 115 라인. tRPC `getResults` 쿼리로 실 데이터 조회, 4개 컴포넌트 2x2 그리드, Skeleton 로딩 상태                                                               |
| `apps/web/src/components/advanced/approval-rating-card.tsx`    | AI 지지율 카드             | ✓ VERIFIED | 173 라인. 도넛 차트, disclaimer 렌더링 필수 포함(164번 줄), 신뢰도 배지                                                                                      |
| `apps/web/src/components/advanced/frame-war-chart.tsx`         | 프레임 전쟁 차트           | ✓ VERIFIED | `dominantFrames` 접근, BarChart 시각화                                                                                                                       |
| `apps/web/src/components/advanced/crisis-scenarios.tsx`        | 위기 시나리오 카드         | ✓ VERIFIED | 171 라인. spread/control/reverse 3개 시나리오, SCENARIO_THEME 딕셔너리로 색상/아이콘 관리                                                                    |
| `apps/web/src/components/advanced/win-simulation-card.tsx`     | 승리 시뮬레이션 카드       | ✓ VERIFIED | 210 라인. `winProbability` RadialBarChart, 승리/패배 조건 체크리스트                                                                                         |

### Key Link Verification

| From                                                     | To                         | Via                                         | Status  | Details                                                                                                                            |
| -------------------------------------------------------- | -------------------------- | ------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/collectors/src/adapters/dcinside.ts`           | `Collector<CommunityPost>` | `implements Collector`                      | ✓ WIRED | `export class DCInsideCollector implements Collector<CommunityPost>` 확인                                                          |
| `packages/collectors/src/adapters/index.ts`              | `dcinside.ts`              | `export { DCInsideCollector }`              | ✓ WIRED | index.ts 7번 줄에 export 확인                                                                                                      |
| `packages/core/src/pipeline/normalize.ts`                | `community.ts` 타입        | `normalizeCommunityPost/Comment`            | ✓ WIRED | `normalizeCommunityPost`, `normalizeCommunityComment` 함수 94/114번 줄 확인                                                        |
| `packages/core/src/queue/flows.ts`                       | 커뮤니티 수집기 3개        | BullMQ 독립 자식 작업                       | ✓ WIRED | `collect-dcinside`, `collect-fmkorea`, `collect-clien` 독립 Flow로 등록 확인                                                       |
| `packages/core/src/queue/worker-process.ts`              | `DCInsideCollector` 등     | `registerCollector`                         | ✓ WIRED | 40~42번 줄에 3개 수집기 레지스트리 등록 확인                                                                                       |
| `packages/core/src/analysis/runner.ts`                   | `approvalRatingModule` 등  | `STAGE4_PARALLEL/SEQUENTIAL`                | ✓ WIRED | `STAGE4_PARALLEL = [approvalRatingModule, frameWarModule]`, `STAGE4_SEQUENTIAL = [crisisScenarioModule, winSimulationModule]` 확인 |
| `packages/core/src/report/generator.ts`                  | ADVN 모듈 결과             | `advnResults` 조건부 섹션                   | ✓ WIRED | `ADVN_MODULES` 배열, `advnResults.length === 0`이면 섹션 미추가 로직 확인                                                          |
| `apps/web/src/components/layout/top-nav.tsx`             | `TAB_LABELS`               | '고급 분석' 5번째 탭                        | ✓ WIRED | 24번 줄에 '고급 분석' 추가 확인                                                                                                    |
| `apps/web/src/app/page.tsx`                              | `advanced-view.tsx`        | `AdvancedTab` 렌더링                        | ✓ WIRED | `import { AdvancedView }` + panels 배열 인덱스 4 확인                                                                              |
| `apps/web/src/components/analysis/trigger-form.tsx`      | 소스 enum                  | `dcinside/fmkorea/clien` 추가               | ✓ WIRED | `SourceId` 타입, `SOURCE_OPTIONS` '커뮤니티' 그룹, `ALL_SOURCES` 5개 확인                                                          |
| `apps/web/src/server/trpc/routers/analysis.ts`           | sources enum               | `z.enum([...'dcinside','fmkorea','clien'])` | ✓ WIRED | 11번 줄에 Zod enum 확장 확인                                                                                                       |
| `apps/web/src/components/dashboard/platform-compare.tsx` | 커뮤니티 소스              | `SOURCE_LABELS` 자동 매핑                   | ✓ WIRED | `SOURCE_LABELS`에 DC갤러리/에펨코리아/클리앙 매핑, chartData 자동 변환 확인                                                        |

### Data-Flow Trace (Level 4)

| Artifact                   | Data Variable | Source                                                                  | Produces Real Data                                   | Status    |
| -------------------------- | ------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- | --------- |
| `advanced-view.tsx`        | `results`     | `trpcClient.analysis.getResults.query({ jobId })`                       | DB `analysisResults` 테이블 SELECT (모든 모듈 포함)  | ✓ FLOWING |
| `approval-rating-card.tsx` | `data` prop   | `advanced-view.tsx`에서 `parseModuleResult(results, 'approval-rating')` | analysisResults에서 module='approval-rating' 행 추출 | ✓ FLOWING |
| `crisis-scenarios.tsx`     | `data` prop   | `advanced-view.tsx`에서 `parseModuleResult(results, 'crisis-scenario')` | analysisResults에서 module='crisis-scenario' 행 추출 | ✓ FLOWING |
| `getResults` tRPC          | DB 쿼리       | `ctx.db.select().from(analysisResults).where(eq(jobId))`                | 실제 DB 쿼리, ADVN 모듈 결과 필터링 없이 전체 반환   | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (no runnable server entry point available for programmatic testing without starting services)

### Requirements Coverage

| Requirement | Source Plan            | Description                     | Status                | Evidence                                                                                      |
| ----------- | ---------------------- | ------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| COLL-05     | 04-01-PLAN             | X(트위터) 수집기 — v2 이월 결정 | ✓ SATISFIED (v2 이월) | X/Twitter 관련 코드 없음 확인. SUMMARY와 PLAN 모두 v2 이월 명시. D-01 결정 근거.              |
| COLL-06     | 04-01-PLAN             | DC갤러리 게시글/댓글 수집기     | ✓ SATISFIED           | `DCInsideCollector` 완전 구현, BullMQ 파이프라인 통합, 정규화 함수 연결                       |
| COLL-07     | 04-01-PLAN             | 에펨코리아 게시글/댓글 수집기   | ✓ SATISFIED           | `FMKoreaCollector` 완전 구현, BullMQ 파이프라인 통합                                          |
| COLL-08     | 04-01-PLAN             | 클리앙 게시글/댓글 수집기       | ✓ SATISFIED           | `ClienCollector` 완전 구현, 403 대응 Playwright 전용, BullMQ 통합                             |
| ADVN-01     | 04-02-PLAN, 04-03-PLAN | AI 지지율 추정 모델             | ✓ SATISFIED           | `ApprovalRatingSchema` + `approvalRatingModule` + `ApprovalRatingCard` + disclaimer 필수 포함 |
| ADVN-02     | 04-02-PLAN, 04-03-PLAN | 프레임 전쟁 분석                | ✓ SATISFIED           | `FrameWarSchema` + `frameWarModule` + `FrameWarChart` 구현                                    |
| ADVN-03     | 04-02-PLAN, 04-03-PLAN | 위기 대응 시나리오 3개          | ✓ SATISFIED           | `CrisisScenarioSchema`(z.tuple로 3개 고정) + `crisisScenarioModule` + `CrisisScenarios` 구현  |
| ADVN-04     | 04-02-PLAN, 04-03-PLAN | 승리 확률 시뮬레이션            | ✓ SATISFIED           | `WinSimulationSchema` + `winSimulationModule` + `WinSimulationCard`(RadialBarChart) 구현      |

**Coverage:** 8/8 Phase 4 requirements satisfied (COLL-05는 v2 이월 결정에 따라 미구현이 올바른 상태)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| 없음 | -    | -       | -        | -      |

스캔 대상: 3개 커뮤니티 수집기, 4개 ADVN 모듈, 5개 대시보드 컴포넌트 전체 검토 완료.
TODO/FIXME/placeholder/stub 패턴 미발견. `return null`/`return {}` 패턴이 컴포넌트에 없음. 모든 컴포넌트가 실제 tRPC 쿼리로 데이터를 조회함.

### Human Verification Required

**배경:** 자동화 검증에서 4/4 목표 진실이 모두 코드 수준에서 확인되었다. 남은 항목은 브라우저 UI 렌더링 및 실시간 파이프라인 동작에 해당한다.

#### 1. 소스 그룹 체크박스 UI

**Test:** `pnpm dev` 실행 후 http://localhost:3000 접속. 로그인 후 '분석 실행' 탭 진입.
**Expected:** 소스 체크박스가 '뉴스/영상' 그룹(네이버/유튜브)과 '커뮤니티' 그룹(DC갤러리/에펨코리아/클리앙)으로 구분되어 표시된다. '전체 선택' 체크박스가 5개 소스를 모두 토글한다.
**Why human:** UI 그룹 레이아웃과 체크박스 상호작용은 정적 분석으로 확인 불가.

#### 2. 5번째 탭 '고급 분석' 렌더링

**Test:** 로그인 후 상단 네비게이션을 확인하고 '고급 분석' 탭을 클릭.
**Expected:** 탭이 5번째로 표시되고, 클릭 시 2x2 그리드에 4개 시각화 카드(AI 지지율/프레임 전쟁/위기 시나리오/승리 시뮬레이션)가 렌더링된다. jobId 없는 초기 상태에는 "분석 결과를 선택하세요" 안내가 표시된다.
**Why human:** 탭 전환 동작 및 컴포넌트 레이아웃은 브라우저 실행으로만 확인 가능.

#### 3. AI 지지율 면책 문구 표시

**Test:** 분석 결과가 있는 jobId를 선택 후 '고급 분석' 탭의 AI 지지율 카드 확인.
**Expected:** 카드 하단에 회색 텍스트로 면책 문구(예: "이 추정치는 AI 분석 기반 참고용이며, 과학적 여론조사를 대체하지 않습니다")가 표시된다.
**Why human:** 실제 API 응답 데이터의 disclaimer 필드가 화면에 렌더링되는지는 실행 환경에서만 확인 가능.

#### 4. 위기 시나리오 3열 카드 시각화

**Test:** '고급 분석' 탭에서 위기 시나리오 섹션 확인.
**Expected:** 확산(빨간/AlertTriangle), 통제(노란/Shield), 역전(초록/TrendingUp) 테마로 카드 3개가 가로로 배치되고, 각 카드에 트리거 조건과 대응 전략이 표시된다.
**Why human:** 색상 테마 적용 및 카드 레이아웃은 브라우저 렌더링으로만 확인 가능.

#### 5. 커뮤니티 수집기 파이프라인 독립 실행

**Test:** 분석 트리거 시 DC갤러리 등 커뮤니티 소스를 포함하여 실행. 의도적으로 하나의 커뮤니티 소스가 실패하는 상황을 시뮬레이션(또는 실제 수집 중 파이프라인 모니터링).
**Expected:** 하나의 커뮤니티 수집기가 실패해도 나머지 소스의 수집이 계속 진행되고, 전체 파이프라인이 부분 성공으로 완료된다.
**Why human:** 실시간 파이프라인 실행 및 부분 실패 내성 확인은 실제 환경 실행 없이 불가.

### Gaps Summary

자동화 검증 단계에서 갭 없음. 모든 코드 수준 검증 통과:

- 3개 커뮤니티 수집기: 완전 구현, 레지스트리 등록, 파이프라인 통합
- 4개 ADVN 모듈: Zod 스키마, 분석 모듈, Stage 4 파이프라인, 리포트 통합
- 대시보드 UI: 5번째 탭, 4개 시각화 컴포넌트, 트리거 폼 확장, 플랫폼 비교 차트 확장
- 8개 커밋 모두 git에서 실존 확인
- COLL-05 X 수집기는 계획대로 v2 이월(미구현이 올바른 상태)

남은 항목은 브라우저 UI 렌더링과 실제 파이프라인 실행에 대한 사람 검증만 필요.

## Superpowers Phase 호출 기록

| #   | 스킬명                                     | 호출 시점 | 결과 요약                                  |
| --- | ------------------------------------------ | --------- | ------------------------------------------ |
| -   | superpowers:verification-before-completion | 미호출    | verifier 에이전트에서 Skill 도구 접근 불가 |

---

_Verified: 2026-03-24T11:30:00Z_
_Verifier: Claude (gsd-verifier)_
