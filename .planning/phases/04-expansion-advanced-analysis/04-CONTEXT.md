# Phase 4: Expansion + Advanced Analysis - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

커뮤니티(DC갤러리, 에펨코리아, 클리앙) 수집기를 추가하고, AI 지지율 추정/프레임 전쟁/위기 시나리오/승리 시뮬레이션 고급 분석 모듈을 구현한다. 결과는 대시보드의 새 "고급 분석" 탭에 시각화한다.

**X(트위터)는 Phase 4 범위에서 제외** — v2로 이월. 비용($200/월) 대비 효용 판단 보류.

</domain>

<decisions>
## Implementation Decisions

### X(트위터) API 전략
- **D-01:** Phase 4에서 X 수집기 제외. COLL-05(X 트윗/반응 수집기)는 v2 Requirements로 이월. 비용($200/월) 및 15,000건 제한으로 현 단계에서는 ROI 부족.

### 커뮤니티 스크래핑 전략
- **D-02:** 키워드 검색 + 인기 갤러리 자동 탐색. 트리거 시 키워드로 각 사이트 검색 후, 해당 키워드가 자주 등장하는 갤러리/게시판을 자동 추가 탐색.
- **D-03:** 기존 CollectorAdapter 패턴 재사용. DC갤러리/에펨코리아/클리앙 각각 독립 어댑터로 구현. 부분 실패 허용(Phase 1 D-04 계승).

### 반봇 대응
- **D-04:** Claude 재량. 사이트별 특성(robots.txt, 요청 제한, 차단 패턴)에 맞게 딜레이/세션 관리 최적화.

### 고급 분석 모듈
- **D-05:** AI 지지율 추정의 면책 처리는 Claude 재량. 적절한 면책 문구와 신뢰도 표현 수준을 구현 시 결정.
- **D-06:** 위기 대응 시나리오는 3개 고정: 확산(worst), 통제(moderate), 역전(best). 각 시나리오에 발생 조건 + 대응 전략 포함.
- **D-07:** 4개 고급 분석 모듈 구조 (Phase 2 패턴 계승):
  - ADVN-01: AI 지지율 추정 (감정 비율 + 확산력 + 플랫폼 편향 보정)
  - ADVN-02: 프레임 전쟁 분석 (지배적/위협/반전 가능 프레임 식별)
  - ADVN-03: 위기 대응 시나리오 생성 (확산/통제/역전 3개)
  - ADVN-04: 승리 확률 및 전략 시뮬레이션

### 대시보드 확장
- **D-08:** 기존 4탭 + "고급 분석" 전용 탭 추가 = 5탭 구성. 지지율/프레임전쟁/시나리오/시뮬레이션을 전용 공간에 시각화.
- **D-09:** 결과 대시보드의 플랫폼 비교 차트에 커뮤니티 소스(DC/에펨/클리앙) 자동 반영. 기존 차트 확장.
- **D-10:** AI 리포트에 고급 분석 섹션 자연 추가. 리포트 생성기가 ADVN 모듈 결과를 통합.

### Claude's Discretion
- 각 커뮤니티 사이트별 스크래핑 세부 구현 (셀렉터, 페이지네이션, 인코딩 등)
- 반봇 대응 딜레이/세션 전략 사이트별 최적화
- 고급 분석 모듈의 프롬프트 설계 및 Zod 스키마 구조
- AI 지지율 면책 문구 및 신뢰도 표현 수준
- 고급 분석 탭 내 시각화 컴포넌트 레이아웃 및 차트 유형 선택

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 수집기 패턴
- `packages/collectors/src/adapters/base.ts` — CollectorAdapter 베이스 클래스
- `packages/collectors/src/adapters/registry.ts` — 어댑터 등록/조회 패턴
- `packages/collectors/src/adapters/naver-news.ts` — 네이버 수집기 참고 구현
- `packages/collectors/src/adapters/youtube-videos.ts` — 유튜브 수집기 참고 구현

### 분석 모듈 패턴
- `packages/core/src/analysis/modules/` — 기존 8개 분석 모듈 (Zod 스키마 + 프롬프트 패턴)
- `packages/core/src/analysis/types.ts` — AnalysisModule 인터페이스/타입
- `packages/core/src/analysis/runner.ts` — 분석 실행 러너 (3단계 파이프라인)
- `packages/core/src/analysis/schemas/` — 분석 결과 Zod 스키마

### 대시보드
- `apps/web/src/app/page.tsx` — 메인 페이지 (탭 구조)
- `apps/web/src/components/layout/top-nav.tsx` — 상단 네비 (탭 추가 필요)
- `apps/web/src/components/dashboard/` — 기존 대시보드 컴포넌트 6종
- `apps/web/src/server/trpc/routers/` — tRPC 라우터 패턴

### 파이프라인
- `packages/core/src/pipeline/` — BullMQ Flow 정의 및 워커 핸들러

### Phase 컨텍스트
- `.planning/phases/01-foundation-core-data-collection/01-CONTEXT.md` — 수집 전략 결정
- `.planning/phases/02-ai-analysis-engine-report/02-CONTEXT.md` — 분석 모듈 구조 결정
- `.planning/phases/03-dashboard-team/03-CONTEXT.md` — 대시보드 레이아웃 결정
- `.planning/phases/03-dashboard-team/03-UI-SPEC.md` — UI 디자인 스펙

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CollectorAdapter` base class — 새 수집기가 상속할 패턴 (collect, normalize, persist 메서드)
- `AdapterRegistry` — 수집기 등록/조회. 새 어댑터 등록만 하면 파이프라인 자동 연결
- 8개 분석 모듈 — Zod 스키마 + AI 프롬프트 패턴 그대로 확장
- `analyzeStructured()` — AI Gateway를 통한 구조화 분석 호출
- shadcn/ui 차트 컴포넌트 — Recharts 기반, 테마 자동 적용
- tRPC 라우터 패턴 — publicProcedure, protectedProcedure, adminProcedure

### Established Patterns
- Playwright 기반 스크래핑 (네이버 뉴스에서 이미 사용)
- BullMQ Flow 부모-자식 작업 패턴
- JSONB 기반 분석 결과 저장 (analysis_results 테이블)
- TanStack Query 폴링 기반 실시간 업데이트

### Integration Points
- `packages/collectors/src/adapters/index.ts` — 새 어댑터 export 추가
- `packages/core/src/analysis/modules/index.ts` — 새 분석 모듈 export 추가
- `packages/core/src/analysis/runner.ts` — Stage 3(고급 분석) 추가
- `apps/web/src/app/page.tsx` — 5번째 탭 추가
- `apps/web/src/components/layout/top-nav.tsx` — TAB_LABELS 배열에 "고급 분석" 추가
- `apps/web/src/components/analysis/trigger-form.tsx` — 소스 체크박스에 커뮤니티 3곳 추가

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

- **X(트위터) 수집기** — COLL-05. $200/월 비용 결정 보류. v2에서 Go/No-Go 재검토.
- **히스토리 비교 기능** — Phase 3에서 이월. 과거 분석 결과 간 변화 비교 대시보드.

</deferred>

---

*Phase: 04-expansion-advanced-analysis*
*Context gathered: 2026-03-24*
