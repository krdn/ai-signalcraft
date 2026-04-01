# Phase 3: Dashboard + Team - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

분석팀이 웹 대시보드에서 인물/키워드를 입력하여 분석을 트리거하고, 파이프라인 진행 상태를 모니터링하며, 차트와 AI 리포트로 시각화된 결과를 팀원과 함께 확인한다. 이메일/비밀번호 + Google OAuth 인증과 팀 멤버 관리(초대/역할) 기능을 포함한다.

이 Phase에서는 추가 수집 소스(커뮤니티/X)나 고급 분석(지지율/시뮬레이션)을 다루지 않는다.

</domain>

<decisions>
## Implementation Decisions

### 대시보드 레이아웃

- **D-01:** 단일 페이지 + 탭 구조. 상단 네비게이션 바에 Logo, 탭, 사용자 메뉴 배치.
- **D-02:** 4개 탭 구성: 분석 실행 | 결과 대시보드 | AI 리포트 | 히스토리.
- **D-03:** 데이터 대시보드 전문 툴 느낌. 다크모드 기본, 카드 기반 레이아웃, 데이터 밀도 높음. Grafana/Mixpanel 참고.
- **D-04:** 분석 실행 탭은 단일 폼 카드 — 키워드 입력 + 소스 체크박스(All/네이버/유튜브) + 기간 선택 + 실행 버튼. 아래에 최근 실행 목록 표시.

### 분석 결과 시각화

- **D-05:** 고정 그리드 레이아웃으로 차트 배치 (드래그 커스터마이즈 없음).
- **D-06:** 감성 비율은 Pie/Donut 차트, 시계열 트렌드는 Line 차트 (Recharts via shadcn 차트 컴포넌트).
- **D-07:** 키워드/연관어는 워드클라우드로 시각화. React 워드클라우드 라이브러리 활용.
- **D-08:** 리스크/기회는 카드 리스트 + 영향도 프로그레스 바로 표현. 긴급도별 정렬, 색상 코딩.

### AI 리포트 뷰어

- **D-09:** 마크다운 렌더링 + 왼쪽 섹션 네비게이션 구조. PDF 내보내기 버튼 상단 배치.
- **D-10:** Phase 2에서 생성된 마크다운 리포트를 전용 렌더러로 표시. 섹션별 빠른 이동 지원.

### 파이프라인 모니터링

- **D-11:** TanStack Query refetchInterval 폴링 방식 (2~5초 간격). SSE/WebSocket 불필요.
- **D-12:** 단계별 프로그레스 바 (수집 → 정규화 → 분석 → 리포트) + 소스별(네이버/유튜브) 수집 건수 표시. Phase 1 DB 데이터 직접 활용.
- **D-13:** 에러 발생 시 인라인 에러 표시 + 재시도 버튼. 성공한 소스 결과는 유지 (Phase 1 부분실패 허용 정책 계승).

### 인증

- **D-14:** NextAuth.js 5.x — Credentials(이메일/비밀번호) + Google OAuth 프로바이더 병행.
- **D-15:** 팀원 역할은 2단계: Admin(팀원 초대/제거 + 전체 기능) / Member(분석 실행 + 결과 조회).
- **D-16:** 팀원 초대는 이메일 초대 링크 방식. 관리자가 이메일 입력 → 초대 링크 발송 → 클릭 시 회원가입/로그인. 메일 서버(Resend 또는 Nodemailer) 필요.

### 히스토리 및 비교

- **D-17:** 히스토리 탭에서 과거 분석 목록 조회 (날짜, 키워드, 상태). 클릭 시 해당 결과 대시보드/리포트로 이동.
- **D-18:** Phase 2에서 저장된 analysis_results, analysis_reports 테이블 기반으로 조회.

### Claude's Discretion

- shadcn/ui 컴포넌트 조합 및 테마 세부 설정
- 그리드 레이아웃 세부 크기/배치 비율
- 워드클라우드 라이브러리 선택 (react-wordcloud 등)
- 마크다운 렌더러 라이브러리 선택 (react-markdown 등)
- 폼 유효성 검증 세부 로직
- 로딩 스켈레톤 및 빈 상태(empty state) 디자인
- tRPC 라우터 구조 및 API 엔드포인트 설계
- DB 테이블 추가 필요 시 스키마 설계 (users, teams, invitations 등)
- 폴링 간격 세부 조정 (2초 vs 5초)
- 메일 서버 선택 및 설정

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 분석 프롬프트 (리포트 구조 참고)

- `docs/prompt.md` — 8개 분석 모듈 출력 형식. 리포트 뷰어가 표시해야 할 섹션 구조 정의.

### 기존 DB 스키마

- `packages/core/src/db/schema/collections.ts` — collectionJobs, articles, videos, comments 테이블. 히스토리 목록 조회 시 collectionJobs 기반.
- `packages/core/src/db/schema/analysis.ts` — analysis_results, analysis_reports 테이블. 분석 결과 시각화 및 리포트 뷰어의 데이터 소스.

### 파이프라인 구조

- `packages/core/src/queue/flows.ts` — BullMQ Flow 구조. 파이프라인 모니터링이 참조할 작업 상태.
- `packages/core/src/queue/worker-process.ts` — Worker 핸들러. 분석 트리거 API가 호출할 진입점.

### AI Gateway

- `packages/ai-gateway/src/gateway.ts` — AI 모델 호출 게이트웨이. 대시보드에서 재분석 트리거 시 활용.

### 이전 Phase CONTEXT

- `.planning/phases/01-foundation-core-data-collection/01-CONTEXT.md` — 수집 트리거 방식, 상태 추적, 부분실패 허용 정책 참고.
- `.planning/phases/02-ai-analysis-engine-report/02-CONTEXT.md` — 분석 모듈 구조, 리포트 생성 방식, DB 스키마 결정사항 참고.

### 요구사항

- `.planning/REQUIREMENTS.md` — Phase 3 매핑 요구사항: DASH-01~07, TEAM-01~03

### 프로젝트 설정

- `CLAUDE.md` — 기술 스택 결정사항 (shadcn/ui, Recharts, TanStack Query, tRPC, NextAuth.js 등)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/core/src/queue/flows.ts`: `triggerCollection()` — 분석 실행 트리거 API에서 호출할 BullMQ Flow 진입점.
- `packages/core/src/db/schema/analysis.ts`: analysis_results, analysis_reports 스키마 — 결과 시각화 및 리포트 조회 데이터 소스.
- `packages/core/src/db/schema/collections.ts`: collectionJobs 스키마 — 파이프라인 상태 모니터링 및 히스토리 목록 데이터 소스.
- `packages/ai-gateway/src/gateway.ts`: AI Gateway — 재분석 트리거 시 동일 패턴 활용 가능.

### Established Patterns

- BullMQ Flow: 부모-자식 작업 관계로 파이프라인 단계 표현. 모니터링 UI가 이 구조를 반영.
- Drizzle ORM: SQL-like 쿼리 빌더. tRPC 라우터에서 직접 사용.
- Zod 스키마: AI 분석 결과 구조화. 시각화 컴포넌트의 타입 안전성 보장.

### Integration Points

- `apps/web/src/app/` — 현재 빈 상태 (layout.tsx, page.tsx만 존재). 모든 페이지/컴포넌트를 새로 구축해야 함.
- `apps/web/package.json` — 기본 Next.js만 설치됨. shadcn/ui, Tailwind, tRPC, NextAuth, TanStack Query, Recharts 등 모든 의존성 추가 필요.
- `packages/core/` — tRPC 라우터가 core 패키지의 DB 쿼리를 호출. web → core 워크스페이스 의존성 추가 필요.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

- 재분석(기존 수집 데이터 재처리) 트리거 기능 — Phase 2 CONTEXT에서 deferred로 명시되었으나, Phase 3 히스토리 탭에서 자연스럽게 구현 가능. Planner 판단에 위임.
- 드래그 기반 대시보드 커스터마이즈 — 고정 그리드로 결정. 향후 사용자 요구 시 별도 phase.
- 분석 결과 비교 뷰 (A vs B 나란히) — 히스토리에서 조회만 가능, 비교 UI는 향후.

</deferred>

---

_Phase: 03-dashboard-team_
_Context gathered: 2026-03-24_
