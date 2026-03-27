# Requirements: AI SignalCraft v1.1

**Defined:** 2026-03-27
**Core Value:** 코드 품질 5.3→8/10 개선 — 기능 변경 없이 내부 구조만 개선

## v1.1 Requirements

### Collector 추상화 (COL)

- [x] **COL-01**: BaseCollector 추상 클래스를 도입하여 브라우저 초기화/페이지 순회/딜레이/에러처리 공통 패턴을 추출한다
- [x] **COL-02**: clien/dcinside/fmkorea/naver-news 어댑터가 BaseCollector를 상속하여 fetchPage()만 구현한다
- [x] **COL-03**: 브라우저 유틸(launchBrowser, delay, contextOptions)을 공통 모듈로 통합한다
- [x] **COL-04**: community-parser의 중복 파싱 로직을 제거하고 타입을 강화한다
- [x] **COL-05**: 기존 collector 테스트가 리팩토링 후에도 모두 통과한다

### Core 구조 정리 (CORE)

- [x] **CORE-01**: worker-process.ts(451줄)를 config/handlers/start 3~4개 파일로 분할한다
- [x] **CORE-02**: provider-keys.ts(443줄)를 CRUD와 테스트로 분리하여 각 파일 200줄 이하로 줄인다
- [x] **CORE-03**: runner.ts(383줄)의 3단계 오케스트레이션을 모듈화한다
- [x] **CORE-04**: 공통 에러 클래스(AnalysisError 등)와 통일된 로거를 도입한다
- [x] **CORE-05**: 기존 파이프라인 E2E 동작이 리팩토링 후에도 동일하게 유지된다

### 타입 & 테스트 (TYPE)

- [x] **TYPE-01**: 분산된 타입 정의(5곳)를 패키지별 types/로 중앙화한다
- [x] **TYPE-02**: ai-gateway 패키지에 기본 테스트를 추가한다 (현재 0%)
- [x] **TYPE-03**: 300줄 이상 테스트 파일을 모듈별로 분할한다
- [x] **TYPE-04**: 모든 패키지의 기존 테스트가 통과한다

## v2 Requirements

### 기능 확장 (이월)

- **X-01**: X(트위터) 트윗 및 반응 수집 v2
- **INFRA-01**: 운영 서버 Docker 배포 자동화 개선
- **PIPE-01**: 파이프라인 시각화 개선 (Phase 6 계획)

## Out of Scope

| Feature | Reason |
|---------|--------|
| 새 기능 추가 | 리팩토링 전용 마일스톤 — 동작 변경 없음 |
| DB 스키마 변경 | 기존 데이터 호환성 유지 |
| UI/대시보드 변경 | 백엔드 코드 구조만 개선 |
| 패키지 추가/제거 | 기존 의존성 유지 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COL-01 | Phase 7 | Complete |
| COL-02 | Phase 7 | Complete |
| COL-03 | Phase 7 | Complete |
| COL-04 | Phase 7 | Complete |
| COL-05 | Phase 7 | Complete |
| CORE-01 | Phase 8 | Complete |
| CORE-02 | Phase 8 | Complete |
| CORE-03 | Phase 8 | Complete |
| CORE-04 | Phase 8 | Complete |
| CORE-05 | Phase 8 | Complete |
| TYPE-01 | Phase 9 | Complete |
| TYPE-02 | Phase 9 | Complete |
| TYPE-03 | Phase 9 | Complete |
| TYPE-04 | Phase 9 | Complete |

**Coverage:**
- v1.1 requirements: 14 total
- Mapped to phases: 14/14
- Unmapped: 0

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after roadmap creation*
