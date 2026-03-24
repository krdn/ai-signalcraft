# AI SignalCraft

## What This Is

공인(정치인, 연예인, 기업인 등)에 대한 여론을 자동 수집·분석하여 전략적 인사이트를 제공하는 데이터 파이프라인 및 웹 대시보드. 소규모 분석팀(3~10명)이 수동 트리거로 분석을 실행하고, 대시보드에서 결과를 확인한다.

## Core Value

다양한 플랫폼의 여론 데이터를 수집하고 AI로 분석하여, 정치 캠프나 전략 팀이 실제 의사결정에 즉시 활용할 수 있는 수준의 종합 분석 리포트를 생성한다.

## Requirements

### Validated

- [x] 네이버 뉴스 기사 및 댓글 수집 (API/스크래핑) — Validated in Phase 1
- [x] 유튜브 영상 메타데이터 및 댓글 수집 (YouTube Data API) — Validated in Phase 1
- [x] 수집 데이터 운영 서버 DB 저장 (192.168.0.5) — Validated in Phase 1
- [x] AI 기반 여론 구조 분석 (긍정/부정/혼재, 변곡점) — Validated in Phase 2
- [x] 집단별 반응 분석 (연령/성별/정치성향/플랫폼별) — Validated in Phase 2
- [x] 감정 및 프레임 분석 (감정 비율, 키워드, 프레임 유형) — Validated in Phase 2
- [x] 메시지 효과 분석 (성공/실패 메시지 식별) — Validated in Phase 2
- [x] 리스크 분석 (Top 3 리스크 + 영향도) — Validated in Phase 2
- [x] 기회 분석 (확장 가능한 긍정 요소) — Validated in Phase 2
- [x] 전략 도출 (타겟/메시지/콘텐츠/리스크 대응) — Validated in Phase 2
- [x] 다중 AI 모델 지원 (Claude, GPT 등 유연 전환) — Validated in Phase 2
- [x] AI 종합 분석 리포트 자동 생성 + PDF 내보내기 — Validated in Phase 2

- [x] 커뮤니티(DC갤러리, 에펨코리아, 클리앙) 게시글/댓글 수집 (스크래핑) — Validated in Phase 4
- [x] AI 지지율 추정 모델 — Validated in Phase 4
- [x] 프레임 전쟁 분석 (경쟁 프레임 구조) — Validated in Phase 4
- [x] 위기 대응 시나리오 생성 — Validated in Phase 4
- [x] 승리 확률 및 전략 시뮬레이션 — Validated in Phase 4
- [x] 웹 대시보드 (분석 결과 시각화) — Validated in Phase 3
- [x] 수동 트리거 기반 분석 파이프라인 실행 — Validated in Phase 3
- [x] 다중 AI 모델 지원 (Claude, GPT 등 유연 전환) — Validated in Phase 2
- [x] 팀 멀티유저 지원 (3~10명) — Validated in Phase 3

### Active

- [ ] X(트위터) 트윗 및 반응 수집 (API) — v2로 이월 (D-01)

### Out of Scope

- 실시간 자동 수집 (수동 트리거 방식으로 결정) — 복잡도와 비용 절감
- 모바일 앱 — 웹 대시보드 우선
- 해외 여론 분석 — 한국 여론에 집중
- 자연어 대화형 인터페이스 — 대시보드 기반

## Context

- **분석 프롬프트**: `docs/prompt.md`에 8개 분석 모듈 + 4개 추가 기능 정의됨
- **데이터 소스**: 네이버 뉴스, 유튜브, X(트위터), DC갤러리, 에펨코리아, 클리앙
- **수집 전략**: 공식 API 우선(YouTube Data API, X API), 불가 시 스크래핑(네이버 뉴스, 커뮤니티)
- **AI 모델**: Claude API, OpenAI GPT 등 혼합 사용, 분석 항목별 최적 모델 선택
- **인프라**: 운영 서버(192.168.0.5)에 DB 저장, 로컬(192.168.0.8)에서 개발
- **분석 대상**: 한국 공인 전반 (정치인, 연예인, 기업인 등)

## Constraints

- **인프라**: 운영 서버(192.168.0.5) PostgreSQL 또는 MongoDB 활용 — 기존 인프라 활용
- **API 비용**: AI API 호출 비용 관리 필요 — 분석 단위별 토큰 최적화
- **법적**: 스크래핑 대상 사이트 robots.txt 및 이용약관 준수
- **패키지 매니저**: pnpm 사용

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| API 우선 + 스크래핑 보조 수집 전략 | 안정성과 데이터 품질 확보, API 미제공 소스만 스크래핑 | — Pending |
| 수동 트리거 실행 방식 | 비용 관리 및 분석 필요 시점에 집중 실행 | — Pending |
| 다중 AI 모델 유연 전환 | 분석 항목별 최적 모델 선택, 비용/품질 균형 | — Pending |
| 운영 서버 DB 저장 | 기존 인프라 활용, 데이터 보안 | — Pending |
| 기술 스택은 리서치 후 결정 | 도메인 특성에 맞는 최적 스택 선택 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-24 after Phase 2 completion — AI Analysis Engine + Report 완료*
