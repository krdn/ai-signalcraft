# AI SignalCraft

## What This Is

공인(정치인, 연예인, 기업인 등)에 대한 여론을 6개 플랫폼(네이버 뉴스, 유튜브, DC갤러리, 에펨코리아, 클리앙, X)에서 자동 수집하고, 12개 AI 분석 모듈로 종합 전략 리포트를 생성하는 데이터 파이프라인 및 웹 대시보드. 소규모 분석팀(3~10명)이 수동 트리거로 분석을 실행하고, 대시보드에서 시각화된 결과와 AI 리포트를 확인한다.

## Core Value

다양한 플랫폼의 여론 데이터를 수집하고 AI로 분석하여, 정치 캠프나 전략 팀이 실제 의사결정에 즉시 활용할 수 있는 수준의 종합 분석 리포트를 생성한다.

## Current State (v1.0 shipped 2026-03-24)

- **코드베이스**: 24,443 LOC TypeScript, 271 files, pnpm 모노리포 4 packages
- **기술 스택**: Next.js 16 + tRPC 11 + Drizzle ORM + BullMQ + AI SDK v6 + shadcn/ui + Tailwind 4
- **수집기**: 네이버 뉴스/댓글, 유튜브, DC갤러리, 에펨코리아, 클리앙 (5개 활성) + X v1 스텁
- **분석 모듈**: 12개 (Stage 1-4: 감성/프레임/전략/지지율 등)
- **대시보드**: 다크모드, 5탭(트리거/모니터/결과/리포트/고급분석), 10개 시각화 컴포넌트
- **인증**: NextAuth v5 (Credentials + Google), Resend 이메일 초대, RBAC
- **기술 부채**: 13개 low-severity 항목 (상세: milestones/v1.0-MILESTONE-AUDIT.md)

## Requirements

### Validated

- ✓ 네이버 뉴스 기사 및 댓글 수집 — v1.0
- ✓ 유튜브 영상 메타데이터 및 댓글 수집 — v1.0
- ✓ 수집 데이터 운영 서버 DB 저장 — v1.0
- ✓ 커뮤니티(DC갤러리, 에펨코리아, 클리앙) 수집 — v1.0
- ✓ AI 감성/프레임/키워드/트렌드/집단별 분석 — v1.0
- ✓ 리스크/기회/전략/메시지 효과 분석 — v1.0
- ✓ AI 지지율 추정/프레임 전쟁/위기 시나리오/승리 시뮬레이션 — v1.0
- ✓ AI 종합 리포트 자동 생성 + PDF 내보내기 — v1.0
- ✓ 웹 대시보드 시각화 + 수동 트리거 실행 — v1.0
- ✓ 다중 AI 모델 지원 (Claude, GPT) — v1.0
- ✓ 팀 멀티유저 + RBAC + 이메일 초대 — v1.0

### Active

- [ ] Collector 추상화 클래스 (BaseCollector) 도입 — v1.1
- [ ] Core 대형 파일 분할 (worker-process, provider-keys, runner) — v1.1
- [ ] 에러 처리 패턴 통일 — v1.1
- [ ] 타입 정의 중앙화 — v1.1
- [ ] ai-gateway 테스트 추가 — v1.1
- [ ] 대형 테스트 파일 분할 — v1.1
- [ ] X(트위터) 트윗 및 반응 수집 v2 — v1.0에서 이월 (v1.1 범위 외)

### Out of Scope

- 실시간 자동 수집 — 수동 트리거 방식으로 결정, 비용 절감
- 모바일 앱 — 웹 대시보드 우선
- 해외 여론 분석 — 한국 여론에 집중
- 자연어 대화형 인터페이스 — 대시보드 기반
- 여론조사 대체 주장 — AI 추정은 참고치, 법적/윤리적 리스크
- 자동 댓글/게시글 작성 — 여론 조작 도구 변질 방지

## Context

- **분석 프롬프트**: `docs/prompt.md`에 12개 분석 모듈 정의
- **데이터 소스**: 네이버 뉴스, 유튜브, DC갤러리, 에펨코리아, 클리앙, X(v1 스텁)
- **수집 전략**: 공식 API 우선(YouTube Data API), 불가 시 스크래핑(네이버, 커뮤니티)
- **AI 모델**: Claude Sonnet 4 (고급분석), GPT (범용) — AI SDK v6 Gateway로 전환
- **인프라**: 운영 서버(192.168.0.5) PostgreSQL + Redis, 로컬(192.168.0.8) 개발
- **v1.0 감사**: 40/40 요구사항 충족, 13개 기술 부채 (low-severity)

## Constraints

- **인프라**: 운영 서버(192.168.0.5) PostgreSQL 활용 — 기존 인프라
- **API 비용**: AI API 호출 비용 관리 — 분석 단위별 토큰 최적화
- **법적**: 스크래핑 대상 사이트 robots.txt 및 이용약관 준수
- **패키지 매니저**: pnpm 사용

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| API 우선 + 스크래핑 보조 수집 전략 | 안정성과 데이터 품질 확보 | ✓ Good — YouTube API + 커뮤니티 스크래핑 안정 동작 |
| 수동 트리거 실행 방식 | 비용 관리 및 필요 시점 집중 실행 | ✓ Good — BullMQ 파이프라인으로 구현 |
| 다중 AI 모델 유연 전환 | 분석별 최적 모델 선택, 비용/품질 균형 | ✓ Good — AI SDK v6 Gateway로 구현 |
| 운영 서버 DB 저장 | 기존 인프라 활용, 데이터 보안 | ✓ Good — PostgreSQL + Drizzle ORM |
| TypeScript 모노리포 통일 | 단일 언어, 타입 공유, 배포 단순 | ✓ Good — kiwi-nlp npm으로 Python 불필요 |
| Next.js 16 + tRPC 11 | App Router SSR + 타입 안전 API | ✓ Good — Server Components 활용 |
| BullMQ Flow 단순화 | 단일 runner가 내부 3단계 관리 | ✓ Good — 디버깅 용이 |
| window.print() PDF | 서버 Playwright 대신 클라이언트 인쇄 | ⚠️ Revisit — pdf-exporter 미사용 |
| X 수집기 v2 이월 | API $200/월 비용, 우선순위 낮음 | — Pending (v2에서 결정) |

## Current Milestone: v1.1 코드베이스 리팩토링

**Goal:** 코드 품질 5.3→8/10 개선 — 기능 변경 없이 내부 구조만 개선

**Target features:**
- Collector 추상화 클래스 도입 (4개 커뮤니티 어댑터 중복 제거 ~620줄)
- Core 대형 파일 분할 (worker-process 451줄, provider-keys 443줄, runner 383줄)
- 에러 처리 패턴 통일 (공통 에러 클래스 + 로거)
- 타입 정의 중앙화
- ai-gateway 테스트 추가 (현재 0%)
- 대형 테스트 파일 분할

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
*Last updated: 2026-03-27 — v1.1 리팩토링 마일스톤 시작*
