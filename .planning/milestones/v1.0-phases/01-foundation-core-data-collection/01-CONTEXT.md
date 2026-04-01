# Phase 1: Foundation + Core Data Collection - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

프로젝트 인프라(pnpm 모노리포, PostgreSQL DB, BullMQ 큐)를 구축하고, 네이버 뉴스와 유튜브에서 키워드 기반 데이터를 수집하여 DB에 정규화된 형태로 저장하는 파이프라인을 완성한다.

이 Phase에서는 대시보드 UI, AI 분석, 팀 기능을 다루지 않는다.

</domain>

<decisions>
## Implementation Decisions

### 수집 트리거 방식

- **D-01:** 통합 키워드 수집 — 키워드 1개 입력 시 모든 활성 소스(네이버 뉴스 + 유튜브)에서 동시 수집 실행. Phase 4에서 소스가 추가되어도 동일 패턴 유지.
- **D-02:** 수집 기간은 사용자 지정 — 트리거 시 시작일~종료일 직접 입력, 기본값은 최근 7일.

### 수집량 제한

- **D-03:** 소스별 기본 상한 설정 — 뉴스 기사 100건, 유튜브 영상 50건, 댓글 각 500개 등 기본값 제공. 트리거 시 조정 가능.

### 에러 처리 전략

- **D-04:** 부분 실패 허용 — 소스별 독립 실행하여 유튜브가 실패해도 네이버 결과는 저장. 실패한 소스는 상태에 표시하고 개별 재시도 가능.

### 파이프라인 구조

- **D-05:** 3단계 분리 — 수집(collect) → 전처리(normalize + 중복제거) → 저장(persist). BullMQ Flow로 부모-자식 작업 연결. 각 단계 독립 재시도 가능.

### 상태 추적

- **D-06:** 소스별 상세 추적 — 전체 진행률 + 소스별(네이버/유튜브) 상태 + 수집 건수 실시간 추적. Phase 3 대시보드에서 진행률 바로 표시할 수 있는 수준의 데이터 저장.

### 중복 처리

- **D-07:** URL/ID 기반 중복 제거 — 기사 URL, 유튜브 댓글 ID 등 고유값으로 중복 판단. DB upsert로 처리. 동일 인물 반복 분석 시 기존 데이터와 자연스럽게 병합.

### Claude's Discretion

- 모노리포 패키지 구조 (apps/packages 분리 방식)
- DB 스키마 세부 설계 (JSONB vs 정규화 비율)
- Adapter Pattern 수집기 인터페이스 세부 설계
- BullMQ 재시도 횟수/간격 등 세부 설정

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 분석 프롬프트 (DB 스키마 설계 참고)

- `docs/prompt.md` — 8개 분석 모듈 + 4개 추가 기능 정의. 수집 데이터가 어떤 분석에 사용되는지 이해하고, 저장 구조가 분석 요구를 충족하도록 설계해야 함.

### 프로젝트 설정

- `CLAUDE.md` — 기술 스택 결정사항, 패키지 목록, 대안 비교 분석 포함. 설치 패키지와 버전 제약 조건 확인 필수.

### 요구사항

- `.planning/REQUIREMENTS.md` — Phase 1 매핑 요구사항: FOUND-01~04, COLL-01~04, COLL-09~10

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- 없음 — 프로젝트가 빈 상태 (CLAUDE.md, docs/prompt.md, .planning/ 만 존재)

### Established Patterns

- 없음 — 첫 Phase이므로 모든 패턴을 새로 수립

### Integration Points

- 운영 서버(192.168.0.5) PostgreSQL — 기존 포트 5433, 5434 사용 중이므로 새 인스턴스 포트 확인 필요
- 운영 서버 Redis — 6380(프로덕션), 6381(개발) 포트 기존 사용 중, BullMQ용 포트 결정 필요

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

_Phase: 01-foundation-core-data-collection_
_Context gathered: 2026-03-24_
