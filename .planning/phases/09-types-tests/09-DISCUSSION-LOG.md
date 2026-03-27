# Phase 9: 타입 & 테스트 강화 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 09-타입 & 테스트 강화
**Areas discussed:** 타입 중앙화 범위, ai-gateway 테스트 전략, 테스트 파일 분할 기준, 패키지 간 타입 공유

---

## 타입 중앙화 범위

### Q1: Zod schema co-located 타입 처리

| Option | Description | Selected |
|--------|-------------|----------|
| schema와 붙여두기 | Zod z.infer 타입은 schema 파일에 유지. types/로는 interface/type alias만 이동 | ✓ |
| types/로 모두 이동 | schema Result 타입도 types/analysis.ts로 re-export | |
| Claude 재량 | Claude의 재량에 맡김 | |

**User's choice:** schema와 붙여두기 (추천)
**Notes:** schema와 타입이 함께 있어야 수정이 쉬움

### Q2: 인라인 interface 처리

| Option | Description | Selected |
|--------|-------------|----------|
| types/로 이동 | 모듈 파일에서 제거하고 types/에 수집. import 경로 통일 | ✓ |
| 모듈 옆에 유지 | 각 모듈과 함께 두고 barrel export로만 정리 | |
| Claude 재량 | Claude의 재량에 맡김 | |

**User's choice:** types/로 이동 (추천)
**Notes:** 분산된 5곳+ 정리

---

## ai-gateway 테스트 전략

### Q1: AI SDK mock 전략

| Option | Description | Selected |
|--------|-------------|----------|
| vi.mock으로 모듈 mock | vi.mock('ai')로 generateText/generateObject mock. AI 호출 없이 테스트 | ✓ |
| provider mock만 | createAnthropic/createOpenAI만 mock. generateText는 실제 SDK 통과 | |
| Claude 재량 | Claude의 재량에 맡김 | |

**User's choice:** vi.mock으로 모듈 mock (추천)
**Notes:** 비용 없이 빠른 테스트

### Q2: 테스트 커버리지 범위

| Option | Description | Selected |
|--------|-------------|----------|
| 주요 함수 단위 테스트 | getModel 라우팅 + baseUrl 정규화 + 기본값 + analyzeText/analyzeStructured 호출 검증 | ✓ |
| 최소한만 | analyzeText/analyzeStructured 반환값만 확인 | |
| Claude 재량 | Claude의 재량에 맡김 | |

**User's choice:** 주요 함수 단위 테스트 (추천)
**Notes:** None

---

## 테스트 파일 분할 기준

### Q1: 분할 기준선

| Option | Description | Selected |
|--------|-------------|----------|
| 300줄 초과만 분할 | advn-schema.test.ts(300줄)만 대상. 최소한의 변경 | ✓ |
| 200줄 기준으로 분할 | advn-schema(300), stage1(276), stage2(225) 모두 분할 | |
| Claude 재량 | Claude의 재량에 맡김 | |

**User's choice:** 300줄 초과만 분할 (추천)
**Notes:** 요구사항 기준 "300줄 이상" 충족

---

## 패키지 간 타입 공유

### Q1: AIProvider 중복 해결

| Option | Description | Selected |
|--------|-------------|----------|
| ai-gateway에서 정의, core가 import | gateway가 AI 프로바이더 타입 소유자 | ✓ |
| core에서 정의, ai-gateway가 import | core가 기본 패키지이므로 타입을 core에 배치 | |
| 공유 패키지 생성 | packages/shared 또는 packages/types 패키지 생성 | |
| Claude 재량 | Claude의 재량에 맡김 | |

**User's choice:** ai-gateway에서 정의, core가 import (추천)
**Notes:** 중복은 AIProvider 하나뿐이므로 공유 패키지는 과도한 추상화

---

## Claude's Discretion

- types/ 디렉토리 내 파일 분류 방식
- ai-gateway 테스트 파일 위치 및 구조
- advn-schema.test.ts 분할 시 정확한 경계점

## Deferred Ideas

None — discussion stayed within phase scope
