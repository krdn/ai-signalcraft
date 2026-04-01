# Phase 1: Foundation + Core Data Collection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 01-Foundation + Core Data Collection
**Areas discussed:** 수집기 설계, 파이프라인 흐름

---

## 수집기 설계

### 수집 단위

| Option                         | Description                               | Selected |
| ------------------------------ | ----------------------------------------- | -------- |
| 통합 키워드 수집 (Recommended) | 키워드 1개 입력 → 모든 소스에서 동시 수집 | ✓        |
| 소스별 개별 수집               | 네이버/유튜브를 각각 따로 트리거          |          |
| 둘 다 지원                     | 통합이 기본이지만 소스 선택적 수집도 가능 |          |

**User's choice:** 통합 키워드 수집
**Notes:** 분석팀이 간단하게 하나만 누르면 되는 방식 선호

### 수집량 제한

| Option                       | Description                                                         | Selected |
| ---------------------------- | ------------------------------------------------------------------- | -------- |
| 기본 상한 설정 (Recommended) | 뉴스 100건, 영상 50건, 댓글 각 500개 등 기본값. 트리거 시 조정 가능 | ✓        |
| 제한 없이 전체 수집          | 검색 결과 전체 수집                                                 |          |
| 다단계 수집                  | 1차 요약 수집 → 필요시 2차 확장                                     |          |

**User's choice:** 기본 상한 설정
**Notes:** None

### 에러 처리

| Option                       | Description                                    | Selected |
| ---------------------------- | ---------------------------------------------- | -------- |
| 부분 실패 허용 (Recommended) | 실패한 소스만 재시도 가능, 성공한 소스는 저장  | ✓        |
| 전체 실패 처리               | 하나라도 실패하면 전체 작업 실패               |          |
| 자동 재시도 후 허용          | 3회 자동 재시도 → 여전히 실패시 부분 성공 진행 |          |

**User's choice:** 부분 실패 허용
**Notes:** None

### 수집 기간

| Option                    | Description                              | Selected |
| ------------------------- | ---------------------------------------- | -------- |
| 사용자 지정 (Recommended) | 시작일~종료일 직접 입력, 기본값 최근 7일 | ✓        |
| 프리셋 선택               | 1일/7일/30일/90일 중 선택                |          |
| Claude에게 위임           | 적절한 방식으로 구현                     |          |

**User's choice:** 사용자 지정
**Notes:** None

---

## 파이프라인 흐름

### 단계 분리

| Option                   | Description                                        | Selected |
| ------------------------ | -------------------------------------------------- | -------- |
| 3단계 분리 (Recommended) | 수집 → 전처리 → 저장. BullMQ Flow로 부모-자식 연결 | ✓        |
| 2단계 분리               | 수집 → 저장(전처리 포함)                           |          |
| Claude에게 위임          | 적절히 판단                                        |          |

**User's choice:** 3단계 분리
**Notes:** None

### 상태 추적

| Option                    | Description                                       | Selected |
| ------------------------- | ------------------------------------------------- | -------- |
| 소스별 상세 (Recommended) | 전체 진행률 + 소스별 상태 + 수집 건수 실시간 추적 | ✓        |
| 작업 단위만               | 전체 작업 시작/완료/실패만 추적                   |          |
| 단계별 상세               | 수집/전처리/저장 각 단계 진행 상황까지 추적       |          |

**User's choice:** 소스별 상세
**Notes:** Phase 3 대시보드에서 진행률 바로 표시할 수 있도록

### 중복 제거

| Option                              | Description                                                 | Selected |
| ----------------------------------- | ----------------------------------------------------------- | -------- |
| URL/ID 기반 중복 제거 (Recommended) | 기사 URL, 유튜브 댓글 ID 등 고유값으로 판단. DB upsert 처리 | ✓        |
| 콘텐츠 해시 기반                    | 본문 해시값 비교로 유사 콘텐츠 감지                         |          |
| Claude에게 위임                     | 적절한 방식으로 구현                                        |          |

**User's choice:** URL/ID 기반 중복 제거
**Notes:** None

---

## Claude's Discretion

- 모노리포 패키지 구조
- DB 스키마 세부 설계
- Adapter Pattern 수집기 인터페이스
- BullMQ 재시도 설정값

## Deferred Ideas

None
