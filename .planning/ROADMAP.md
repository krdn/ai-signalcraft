# Roadmap: AI SignalCraft

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-03-24) → [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 코드베이스 리팩토링** — Phases 7-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-03-24</summary>

- [x] Phase 1: Foundation + Core Data Collection (6/6 plans) — completed 2026-03-24
- [x] Phase 2: AI Analysis Engine + Report (5/5 plans) — completed 2026-03-24
- [x] Phase 3: Dashboard + Team (6/6 plans) — completed 2026-03-24
- [x] Phase 4: Expansion + Advanced Analysis (3/3 plans) — completed 2026-03-24
- [x] Phase 5: Integration & Flow Gap Closure (1/1 plan) — completed 2026-03-24

</details>

### Post-MVP Improvements

- [ ] Phase 6: Pipeline Visualization — 파이프라인 진행 상태 시각화 개선 (4단계 스텝 인디케이터 + 12개 분석 모듈 카드 그리드 뷰 + 소스별 수집 상태 + 5초 폴링 실시간 업데이트)

### 🚧 v1.1 코드베이스 리팩토링 (In Progress)

**Milestone Goal:** 코드 품질 5.3→8/10 개선 — 기능 변경 없이 내부 구조만 리팩토링

- [ ] **Phase 7: Collector 추상화** - BaseCollector 도입 + 4개 커뮤니티 어댑터 마이그레이션 + 브라우저 유틸 통합
- [ ] **Phase 8: Core 구조 정리** - 대형 파일 3개 분할 + 에러 처리 패턴 통일
- [ ] **Phase 9: 타입 & 테스트 강화** - 타입 정의 중앙화 + ai-gateway 테스트 추가 + 대형 테스트 분할

## Phase Details

### Phase 7: Collector 추상화
**Goal**: 4개 커뮤니티 수집기(clien/dcinside/fmkorea/naver-news)의 공통 패턴을 BaseCollector로 추출하여 중복 ~620줄을 제거한다
**Depends on**: Nothing (v1.1 첫 번째 phase)
**Requirements**: COL-01, COL-02, COL-03, COL-04, COL-05
**Success Criteria** (what must be TRUE):
  1. BaseCollector 추상 클래스가 존재하며 브라우저 초기화/페이지 순회/딜레이/에러처리를 공통으로 제공한다
  2. 4개 어댑터(clien, dcinside, fmkorea, naver-news)가 BaseCollector를 상속하고 fetchPage()만 개별 구현한다
  3. 브라우저 유틸(launchBrowser, delay, contextOptions)이 단일 공통 모듈에서 export된다
  4. community-parser에 중복 파싱 로직이 없고 파싱 함수에 타입이 명시되어 있다
  5. 기존 collector 관련 테스트가 리팩토링 후 모두 통과한다
**Plans:** 3/3 plans executed

Plans:
- [x] 07-01-PLAN.md — browser.ts 유틸 확장 + BrowserCollector/CommunityBaseCollector 추상 클래스 생성
- [x] 07-02-PLAN.md — clien/dcinside/fmkorea 3개 어댑터 CommunityBaseCollector 마이그레이션
- [x] 07-03-PLAN.md — naver-news BrowserCollector 마이그레이션 + community-parser 타입 강화 + index.ts 정리

### Phase 8: Core 구조 정리
**Goal**: packages/core의 대형 파일 3개(worker-process 451줄, provider-keys 443줄, runner 383줄)를 분할하고 에러 처리를 통일한다
**Depends on**: Phase 7
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05
**Success Criteria** (what must be TRUE):
  1. worker-process.ts가 config/handlers/start 등 3~4개 파일로 분할되어 각 파일이 200줄 이하이다
  2. provider-keys.ts가 CRUD와 테스트로 분리되어 각 파일이 200줄 이하이다
  3. runner.ts의 3단계 오케스트레이션(수집/분석/리포트)이 모듈별로 분리되어 있다
  4. 공통 에러 클래스(AnalysisError 등)와 통일된 로거가 도입되어 throw/catch 패턴이 일관적이다
  5. 기존 파이프라인 E2E 동작이 리팩토링 후에도 동일하게 유지된다
**Plans:** 3 plans

Plans:
- [x] 08-01-PLAN.md — 에러 클래스/로거 도입 + provider-keys.ts CRUD/테스트 분리
- [x] 08-02-PLAN.md — runner.ts를 runModule(단일 실행) + pipeline-orchestrator(오케스트레이션) 분리
- [ ] 08-03-PLAN.md — worker-process.ts 5개 파일 분할 + 전체 테스트 검증

### Phase 9: 타입 & 테스트 강화
**Goal**: 분산된 타입 정의를 중앙화하고 ai-gateway 테스트를 추가하며 대형 테스트 파일을 분할한다
**Depends on**: Phase 8
**Requirements**: TYPE-01, TYPE-02, TYPE-03, TYPE-04
**Success Criteria** (what must be TRUE):
  1. 분산된 타입 정의(5곳)가 각 패키지의 types/ 디렉토리로 중앙화되어 import 경로가 통일되어 있다
  2. ai-gateway 패키지에 기본 테스트가 존재하며 주요 함수에 대한 단위 테스트가 통과한다
  3. 300줄 이상이었던 테스트 파일이 모듈별로 분할되어 각 파일이 300줄 이하이다
  4. 모든 패키지(collectors, core, ai-gateway, web)의 기존 테스트가 통과한다
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation + Core Data Collection | v1.0 | 6/6 | Complete | 2026-03-24 |
| 2. AI Analysis Engine + Report | v1.0 | 5/5 | Complete | 2026-03-24 |
| 3. Dashboard + Team | v1.0 | 6/6 | Complete | 2026-03-24 |
| 4. Expansion + Advanced Analysis | v1.0 | 3/3 | Complete | 2026-03-24 |
| 5. Integration & Flow Gap Closure | v1.0 | 1/1 | Complete | 2026-03-24 |
| 6. Pipeline Visualization | post-MVP | 0/? | Planned | — |
| 7. Collector 추상화 | v1.1 | 3/3 | In Progress|  |
| 8. Core 구조 정리 | v1.1 | 0/3 | Planned | — |
| 9. 타입 & 테스트 강화 | v1.1 | 0/? | Not started | — |
