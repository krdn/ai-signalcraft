# Phase 2: AI Analysis Engine + Report - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 02-ai-analysis-engine-report
**Areas discussed:** 분석 모듈 구조, 리포트 생성 방식, 분석 결과 DB 스키마, 파이프라인 연결 방식

---

## 분석 모듈 구조

| Option               | Description                                                                                         | Selected |
| -------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| 모듈별 개별 프롬프트 | 8개 분석 항목을 각각 독립된 모듈로 분리. Zod 스키마로 구조화된 결과 반환. 모듈별 AI 모델 선택 가능. | ✓        |
| 단일 통합 프롬프트   | prompt.md 전체를 한 번에 AI에 넘기고 전체 리포트 생성. 단순하지만 토큰 비용 높음.                   |          |
| 2단계 하이브리드     | 1단계 개별 모듈 분석, 2단계 통합 리포트. 유연하지만 복잡도 높음.                                    |          |

**User's choice:** 모듈별 개별 프롬프트
**Notes:** -

## AI 모델 선택 전략

| Option           | Description                                                                           | Selected |
| ---------------- | ------------------------------------------------------------------------------------- | -------- |
| 모듈별 모델 지정 | 감성분석은 GPT-4o-mini(비용 절감), 심층분석은 Claude Sonnet 등 모듈별 최적 모델 지정. | ✓        |
| 단일 모델 고정   | 모든 모듈이 동일한 AI 모델 사용.                                                      |          |
| Claude 재량      | 구현 시 모듈 특성에 맞게 결정.                                                        |          |

**User's choice:** 모듈별 모델 지정
**Notes:** -

## Phase 2 모듈 범위

| Option              | Description                                          | Selected |
| ------------------- | ---------------------------------------------------- | -------- |
| 분석 1~7 + 최종요약 | ROADMAP 그대로. 추가기능은 Phase 4.                  | ✓        |
| 핵심 분석만 먼저    | 감성/키워드/시계열 + 리포트만. 심층분석은 Phase 2.5. |          |

**User's choice:** 분석 1~7 + 최종요약
**Notes:** -

## 리포트 포맷

| Option                       | Description                                                 | Selected |
| ---------------------------- | ----------------------------------------------------------- | -------- |
| 마크다운 우선 + PDF 내보내기 | DB에 마크다운 저장, 대시보드에서 렌더링, PDF 내보내기 제공. | ✓        |
| 구조화 JSON + 템플릿 렌더링  | 구조화 JSON으로 저장, 템플릿으로 렌더링.                    |          |
| AI 통합 리포트 생성          | 모듈 결과를 AI에 다시 넘겨 자연어 통합.                     |          |

**User's choice:** 마크다운 우선 + PDF 내보내기
**Notes:** -

## 리포트 생성 방식

| Option                | Description                              | Selected |
| --------------------- | ---------------------------------------- | -------- |
| 모듈별 분석 → AI 통합 | 1단계 구조화 결과, 2단계 AI 종합 리포트. | ✓        |
| 모듈별 결과만 저장    | 리포트는 Phase 3에서 조합.               |          |

**User's choice:** 모듈별 분석 → AI 통합
**Notes:** -

## DB 스키마

| Option              | Description                                       | Selected |
| ------------------- | ------------------------------------------------- | -------- |
| 단일 테이블 + JSONB | analysis_results 테이블에 module + result(JSONB). | ✓        |
| 모듈별 개별 테이블  | sentiment_results, keyword_results 등 분리.       |          |
| Claude 재량         | 최적 구조 결정.                                   |          |

**User's choice:** 단일 테이블 + JSONB
**Notes:** -

## 히스토리 비교

| Option                 | Description              | Selected |
| ---------------------- | ------------------------ | -------- |
| 저장만, 비교는 Phase 3 | Phase 2에서는 DB 저장만. | ✓        |
| Phase 2에서 CLI 비교   | 터미널로 과거 분석 비교. |          |

**User's choice:** 저장만, 비교는 Phase 3
**Notes:** -

## 파이프라인 트리거

| Option            | Description                      | Selected |
| ----------------- | -------------------------------- | -------- |
| 수집 후 자동 분석 | BullMQ Flow에 analyze 단계 추가. | ✓        |
| 수동 분석 트리거  | 수집과 분석 독립 트리거.         |          |
| 둘 다 지원        | 자동 기본 + 재분석 가능.         |          |

**User's choice:** 수집 후 자동 분석
**Notes:** -

## 모듈 의존관계

| Option                | Description                           | Selected |
| --------------------- | ------------------------------------- | -------- |
| 병렬 분석 → 순차 통합 | 1단계 병렬, 2단계 순차, 3단계 리포트. | ✓        |
| 전체 순차 실행        | 1번부터 8번까지 순서대로.             |          |
| Claude 재량           | 의존성 분석 후 최적 순서.             |          |

**User's choice:** 병렬 분석 → 순차 통합
**Notes:** -

---

## Claude's Discretion

- 각 분석 모듈의 구체적 프롬프트 엔지니어링
- Zod 스키마 세부 필드 설계
- PDF 내보내기 라이브러리 선택
- 에러 핸들링 및 부분 실패 처리 전략

## Deferred Ideas

- 추가 기능 1~4 → Phase 4
- 분석 히스토리 비교/조회 UI → Phase 3
- 재분석 기능 → Phase 3
