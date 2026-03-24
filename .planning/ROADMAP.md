# Roadmap: AI SignalCraft

## Overview

한국 공인 여론 분석 파이프라인을 4개 Phase로 구축한다. 먼저 프로젝트 기반과 안정적인 데이터 소스(네이버 뉴스, 유튜브) 수집 파이프라인을 세우고, AI 분석 엔진과 리포트 생성으로 핵심 가치를 조기 검증한다. 이후 대시보드와 팀 기능으로 사용자 접점을 완성하고, 마지막으로 불안정한 추가 소스(커뮤니티, X)와 고급 분석 기능을 확장한다.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation + Core Data Collection** - 프로젝트 기반 구축 및 네이버/유튜브 수집 파이프라인 완성
- [ ] **Phase 2: AI Analysis Engine + Report** - 감성/키워드/심층 분석 모듈 및 AI 종합 리포트 자동 생성
- [ ] **Phase 3: Dashboard + Team** - 웹 대시보드 시각화, 분석 트리거 UI, 팀 인증/공유 기능
- [ ] **Phase 4: Expansion + Advanced Analysis** - 커뮤니티/X 수집기 확장 및 AI 지지율/시뮬레이션 고급 분석

## Phase Details

### Phase 1: Foundation + Core Data Collection
**Goal**: 프로젝트 인프라가 구축되고 네이버 뉴스와 유튜브에서 데이터를 수집하여 DB에 정규화된 형태로 저장할 수 있다
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, COLL-01, COLL-02, COLL-03, COLL-04, COLL-09, COLL-10
**Success Criteria** (what must be TRUE):
  1. pnpm workspace 모노리포 구조에서 dev 서버가 정상 기동되고 TypeScript 빌드가 통과한다
  2. 운영 서버(192.168.0.5) PostgreSQL에 스키마가 생성되고 Drizzle ORM으로 CRUD가 동작한다
  3. 키워드를 입력하면 네이버 뉴스 기사와 댓글이 수집되어 DB에 정규화된 형태로 저장된다
  4. 키워드를 입력하면 유튜브 영상 메타데이터와 댓글이 수집되어 DB에 저장된다
  5. BullMQ 파이프라인으로 수집 작업이 큐잉/실행/상태추적되고 중복 데이터가 자동 제거된다
**Plans**: 6 plans

Plans:
- [x] 01-01-PLAN.md -- pnpm 모노리포 스캐폴딩 + PostgreSQL DB 스키마
- [x] 01-02-PLAN.md -- BullMQ 파이프라인 + Collector Adapter 인터페이스 + AI Gateway 골격
- [x] 01-03-PLAN.md -- 네이버 뉴스 기사/댓글 수집기
- [x] 01-04-PLAN.md -- 유튜브 영상/댓글 수집기
- [x] 01-05-PLAN.md -- 정규화/중복제거 파이프라인 통합 + E2E 검증
- [ ] 01-06-PLAN.md -- 네이버 댓글 수집 파이프라인 연결 (COLL-02 Gap Closure)

### Phase 2: AI Analysis Engine + Report
**Goal**: 수집된 데이터에 대해 AI 기반 감성/키워드/심층 분석을 실행하고, 8개 분석 모듈 결과를 통합한 종합 전략 리포트를 자동 생성할 수 있다
**Depends on**: Phase 1
**Requirements**: ANLZ-01, ANLZ-02, ANLZ-03, ANLZ-04, DEEP-01, DEEP-02, DEEP-03, DEEP-04, DEEP-05, REPT-01, REPT-02, REPT-03
**Success Criteria** (what must be TRUE):
  1. 수집된 데이터에 대해 감성 분석(긍정/부정/중립)이 실행되고 감정 비율이 산출된다
  2. 연관어/키워드 추출과 시계열 트렌드(일별 언급량, 감성 추이, 변곡점)가 분석된다
  3. 프레임 분석, 리스크/기회 분석, 메시지 효과 분석, 전략 도출이 실행되어 구조화된 결과가 DB에 저장된다
  4. 모든 분석 결과를 통합한 AI 종합 리포트가 자동 생성되고 PDF/마크다운으로 내보내기된다
  5. Claude/GPT 등 다중 AI 모델이 AI Gateway를 통해 유연하게 전환되고 토큰 사용량이 추적된다
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md -- 분석 DB 스키마 + AnalysisModule 인터페이스/타입 + AI Gateway 확장
- [x] 02-02-PLAN.md -- Stage 1 분석 모듈 4개 (macro-view, segmentation, sentiment-framing, message-impact)
- [x] 02-03-PLAN.md -- Stage 2 분석 모듈 4개 (risk-map, opportunity, strategy, final-summary)
- [x] 02-04-PLAN.md -- 분석 실행 러너 + BullMQ Flow 확장 + Worker 핸들러
- [ ] 02-05-PLAN.md -- 통합 리포트 생성기 + PDF 내보내기

### Phase 3: Dashboard + Team
**Goal**: 분석팀이 웹 대시보드에서 분석을 트리거하고, 진행 상태를 모니터링하며, 시각화된 결과를 팀원과 함께 확인할 수 있다
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, TEAM-01, TEAM-02, TEAM-03
**Success Criteria** (what must be TRUE):
  1. 사용자가 대시보드에서 인물/키워드를 입력하고 소스/기간을 선택하여 분석을 실행할 수 있다
  2. 파이프라인 실행 중 단계별 진행률과 작업 상태가 실시간으로 표시된다
  3. 감성 비율 차트, 시계열 트렌드, 워드클라우드, 리스크/기회 매트릭스가 대시보드에 시각화된다
  4. AI 종합 리포트를 섹션별로 탐색하고 과거 분석 히스토리를 조회/비교할 수 있다
  5. 이메일/비밀번호로 로그인하고 팀원을 초대하여 동일한 분석 결과를 공유할 수 있다
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Expansion + Advanced Analysis
**Goal**: 커뮤니티(DC갤러리, 에펨코리아, 클리앙)와 X(트위터) 수집기가 추가되고, AI 지지율 추정/프레임 전쟁/위기 시나리오/승리 시뮬레이션 고급 분석이 제공된다
**Depends on**: Phase 3
**Requirements**: COLL-05, COLL-06, COLL-07, COLL-08, ADVN-01, ADVN-02, ADVN-03, ADVN-04
**Success Criteria** (what must be TRUE):
  1. DC갤러리, 에펨코리아, 클리앙에서 게시글과 댓글이 수집되며 개별 수집기 실패가 전체 파이프라인에 영향을 주지 않는다
  2. X(트위터)에서 트윗과 반응이 수집되어 다른 소스와 동일한 정규화 형태로 저장된다
  3. AI 지지율 추정치가 감정 비율과 플랫폼 편향을 보정하여 산출되고 "참고치" 한계가 명시된다
  4. 프레임 전쟁 분석, 위기 대응 시나리오 3개, 승리 확률 시뮬레이션이 생성되어 리포트에 통합된다
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Core Data Collection | 5/6 | In Progress|  |
| 2. AI Analysis Engine + Report | 1/5 | In Progress|  |
| 3. Dashboard + Team | 0/3 | Not started | - |
| 4. Expansion + Advanced Analysis | 0/2 | Not started | - |
