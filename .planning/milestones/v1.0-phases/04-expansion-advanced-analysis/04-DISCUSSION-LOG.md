# Phase 4: Expansion + Advanced Analysis - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 04-expansion-advanced-analysis
**Areas discussed:** X API 전략, 커뮤니티 스크래핑 전략, 고급 분석 모듈 설계, 대시보드 확장

---

## X(트위터) API 전략

| Option                | Description                         | Selected |
| --------------------- | ----------------------------------- | -------- |
| X API Basic ($200/월) | 공식 API, 안정적, 월 15,000건 제한  |          |
| 무료 대안 스크래핑    | Playwright 기반, 비용 없지만 불안정 |          |
| Phase 4에서 X 제외    | 커뮤니티만 추가, X는 v2로 이월      | ✓        |

**User's choice:** Phase 4에서 X 제외, v2로 이월
**Notes:** 비용 대비 ROI 부족 판단

---

## 커뮤니티 스크래핑 전략 — 게시판 선택

| Option                              | Description                          | Selected |
| ----------------------------------- | ------------------------------------ | -------- |
| 키워드 검색                         | 각 사이트 검색 기능으로 키워드 매칭  |          |
| 특정 갤러리 지정                    | 트리거 시 수집 대상 게시판 직접 지정 |          |
| 키워드 검색 + 인기 갤러리 자동 탐색 | 검색 + 키워드 빈출 갤러리 자동 추가  | ✓        |

**User's choice:** 키워드 검색 + 인기 갤러리 자동 탐색

## 커뮤니티 스크래핑 전략 — 반봇 대응

| Option      | Description                      | Selected |
| ----------- | -------------------------------- | -------- |
| 보수적      | 3~5초 딜레이, 50페이지 제한      |          |
| 적응형      | 초기 1초, 차단 감지 시 자동 증가 |          |
| Claude 재량 | 사이트별 특성에 맞게 알아서 결정 | ✓        |

**User's choice:** Claude 재량

---

## 고급 분석 모듈 — 면책 처리

| Option                | Description                  | Selected |
| --------------------- | ---------------------------- | -------- |
| 리포트 내 면책 문구만 | 섹션 상단 면책 표시          |          |
| 면책 + 신뢰도 표시    | 면책 + 샘플 기반 신뢰도 계산 |          |
| Claude 재량           | 적절한 수준으로 알아서 결정  | ✓        |

**User's choice:** Claude 재량

## 고급 분석 모듈 — 위기 시나리오

| Option            | Description                                | Selected |
| ----------------- | ------------------------------------------ | -------- |
| 3개 고정 시나리오 | 확산/통제/역전. 각각 발생 조건 + 대응 전략 | ✓        |
| 동적 시나리오     | AI가 1~5개 자동 선정                       |          |
| Claude 재량       | 구조와 깊이를 알아서 결정                  |          |

**User's choice:** 3개 고정 시나리오 (확산/통제/역전)

---

## 대시보드 확장

| Option                 | Description                    | Selected |
| ---------------------- | ------------------------------ | -------- |
| 기존 탭에 자연 확장    | 별도 탭 없이 기존 차트에 통합  |          |
| 고급 분석 전용 탭 추가 | 기존 4탭 + "고급 분석" = 5탭   | ✓        |
| Claude 재량            | 정보량과 UX에 맞게 알아서 결정 |          |

**User's choice:** 고급 분석 전용 탭 추가

---

## Claude's Discretion

- 사이트별 스크래핑 세부 구현
- 반봇 대응 전략
- 고급 분석 프롬프트/스키마 설계
- AI 지지율 면책 수준
- 고급 분석 탭 시각화 레이아웃

## Deferred Ideas

- X(트위터) 수집기 — v2로 이월
- 히스토리 비교 기능 — Phase 3에서 이월
