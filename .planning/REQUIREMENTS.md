# Requirements: AI SignalCraft

**Defined:** 2026-03-24
**Core Value:** 다양한 플랫폼의 여론 데이터를 AI로 분석하여 전략 팀이 즉시 활용 가능한 종합 분석 리포트를 생성한다.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [x] **FOUND-01**: 프로젝트 스캐폴딩 (Next.js + TypeScript 모노리포 구조)
- [x] **FOUND-02**: PostgreSQL 스키마 설계 및 운영 서버(192.168.0.5) DB 구성
- [x] **FOUND-03**: BullMQ 기반 파이프라인 오케스트레이터 (수동 트리거, 작업 상태 관리)
- [x] **FOUND-04**: AI Gateway 추상화 레이어 (Claude, GPT 등 다중 모델 라우팅)

### Data Collection

- [x] **COLL-01**: 네이버 뉴스 기사 수집기 (키워드 검색, 기간 필터)
- [x] **COLL-02**: 네이버 뉴스 댓글 수집기 (비공식 API 기반)
- [x] **COLL-03**: 유튜브 영상 메타데이터 수집기 (YouTube Data API v3)
- [x] **COLL-04**: 유튜브 댓글 수집기 (YouTube Data API v3)
- [ ] **COLL-05**: X(트위터) 트윗 및 반응 수집기 (X API Basic)
- [ ] **COLL-06**: DC갤러리 게시글/댓글 수집기 (스크래핑)
- [ ] **COLL-07**: 에펨코리아 게시글/댓글 수집기 (스크래핑)
- [ ] **COLL-08**: 클리앙 게시글/댓글 수집기 (스크래핑)
- [x] **COLL-09**: Adapter Pattern 기반 수집기 공통 인터페이스 (소스 독립적)
- [x] **COLL-10**: 수집 데이터 정규화 및 중복 제거 파이프라인

### Core Analysis

- [x] **ANLZ-01**: 감성 분석 (긍정/부정/중립 분류, 감정 비율 산출)
- [x] **ANLZ-02**: 연관어/키워드 분석 (반복 키워드 추출, 연관어 네트워크)
- [x] **ANLZ-03**: 시계열 트렌드 분석 (일별 언급량, 감성 추이, 변곡점 탐지)
- [x] **ANLZ-04**: 집단별 반응 분석 (플랫폼별, 담론 클러스터별 세분화)

### Deep Analysis

- [x] **DEEP-01**: 프레임 분석 (프레임 유형 분류, 긍정/부정 프레임 TOP5, 충돌 구조)
- [x] **DEEP-02**: 메시지 효과 분석 (여론 변화 유발 발언/콘텐츠 식별, 성공 vs 실패 메시지)
- [x] **DEEP-03**: 리스크 분석 (Top 3 리스크 + 영향도 + 확산 가능성)
- [x] **DEEP-04**: 기회 분석 (확장 가능한 긍정 요소, 미활용 영역)
- [x] **DEEP-05**: 전략 도출 (타겟/메시지/콘텐츠/리스크 대응 전략)

### Advanced Analysis

- [ ] **ADVN-01**: AI 지지율 추정 모델 (감정 비율 + 확산력 + 플랫폼 편향 보정)
- [ ] **ADVN-02**: 프레임 전쟁 분석 (지배적/위협/반전 가능 프레임 식별)
- [ ] **ADVN-03**: 위기 대응 시나리오 생성 (확산/통제/역전 3개 시나리오 + 대응 전략)
- [ ] **ADVN-04**: 승리 확률 및 전략 시뮬레이션 (승리/패배 조건 도출)

### Report Generation

- [x] **REPT-01**: AI 종합 분석 리포트 자동 생성 (8개 분석 모듈 결과 통합)
- [x] **REPT-02**: 최종 전략 요약 (현재 상태 + 승부 핵심 한 줄 요약)
- [x] **REPT-03**: 리포트 PDF/마크다운 내보내기

### Dashboard

- [x] **DASH-01**: 분석 실행 트리거 UI (인물/키워드 입력, 소스 선택, 기간 설정)
- [x] **DASH-02**: 파이프라인 실행 상태 모니터링 (진행률, 작업별 상태)
- [ ] **DASH-03**: 감성 분석 시각화 (긍정/부정/중립 비율 차트, 시계열 트렌드)
- [ ] **DASH-04**: 키워드/연관어 시각화 (워드클라우드, 네트워크 그래프)
- [x] **DASH-05**: AI 리포트 뷰어 (분석 결과 전문 표시, 섹션 네비게이션)
- [x] **DASH-06**: 분석 히스토리 목록 (과거 분석 결과 조회, 비교)
- [ ] **DASH-07**: 리스크/기회 대시보드 (리스크 맵, 기회 매트릭스)

### Team & Auth

- [x] **TEAM-01**: 사용자 인증 (이메일/비밀번호 로그인)
- [ ] **TEAM-02**: 팀 멤버 관리 (초대, 역할 할당)
- [ ] **TEAM-03**: 분석 결과 팀 공유 (동일 분석 결과 팀원 전체 접근)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Features

- **ENH-01**: 경쟁 인물 비교 분석 (2인 병렬 대시보드, Share-of-Voice)
- **ENH-02**: 분석 결과 텔레그램/슬랙 알림
- **ENH-03**: 분석 스케줄링 (정기 자동 실행)
- **ENH-04**: 분석 템플릿 저장/재사용
- **ENH-05**: 커스텀 분석 프롬프트 편집

## Out of Scope

| Feature | Reason |
|---------|--------|
| 실시간 스트리밍 수집 | 비용 폭증, 수동 트리거로 결정 |
| 모바일 네이티브 앱 | 반응형 웹으로 대체 |
| 해외 여론 분석 | 한국 여론에 집중 |
| 챗봇/대화형 UI | 대시보드 기반 UX로 결정 |
| 여론조사 대체 주장 | AI 추정은 참고치, 법적/윤리적 리스크 |
| 개인정보 프로파일링 | 개인정보보호법 위반 가능 |
| 자동 댓글/게시글 작성 | 여론 조작 도구 변질 방지 |
| 범용 브랜드 마케팅 분석 | 공인 여론 분석에 특화 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| COLL-01 | Phase 1 | Complete |
| COLL-02 | Phase 1 | Complete |
| COLL-03 | Phase 1 | Complete |
| COLL-04 | Phase 1 | Complete |
| COLL-05 | Phase 4 | Pending |
| COLL-06 | Phase 4 | Pending |
| COLL-07 | Phase 4 | Pending |
| COLL-08 | Phase 4 | Pending |
| COLL-09 | Phase 1 | Complete |
| COLL-10 | Phase 1 | Complete |
| ANLZ-01 | Phase 2 | Complete |
| ANLZ-02 | Phase 2 | Complete |
| ANLZ-03 | Phase 2 | Complete |
| ANLZ-04 | Phase 2 | Complete |
| DEEP-01 | Phase 2 | Complete |
| DEEP-02 | Phase 2 | Complete |
| DEEP-03 | Phase 2 | Complete |
| DEEP-04 | Phase 2 | Complete |
| DEEP-05 | Phase 2 | Complete |
| ADVN-01 | Phase 4 | Pending |
| ADVN-02 | Phase 4 | Pending |
| ADVN-03 | Phase 4 | Pending |
| ADVN-04 | Phase 4 | Pending |
| REPT-01 | Phase 2 | Complete |
| REPT-02 | Phase 2 | Complete |
| REPT-03 | Phase 2 | Complete |
| DASH-01 | Phase 3 | Complete |
| DASH-02 | Phase 3 | Complete |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 3 | Pending |
| DASH-05 | Phase 3 | Complete |
| DASH-06 | Phase 3 | Complete |
| DASH-07 | Phase 3 | Pending |
| TEAM-01 | Phase 3 | Complete |
| TEAM-02 | Phase 3 | Pending |
| TEAM-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after roadmap phase mapping*
