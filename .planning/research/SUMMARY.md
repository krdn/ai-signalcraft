# Project Research Summary

**Project:** AI SignalCraft — 한국 공인 여론 분석 자동화 파이프라인
**Domain:** Political/Public Figure Opinion Analysis Pipeline (Korean)
**Researched:** 2026-03-24
**Confidence:** MEDIUM-HIGH

## Executive Summary

AI SignalCraft는 한국 공인(정치인, 연예인, 기업인)에 대한 여론을 멀티 플랫폼에서 수집하고, LLM 기반으로 심층 분석하여 전략적 인사이트를 자동 생성하는 파이프라인 시스템이다. 핵심 설계 원칙은 수동 트리거 방식의 배치 분석이며, BullMQ + Redis 기반 잡 큐로 수집 → 전처리 → 분석 단계를 DAG(방향 비순환 그래프)로 조율한다. 기술 스택은 TypeScript 모노리포(Next.js 15 + Drizzle ORM + tRPC)로 통일하고, AI 분석은 Vercel AI SDK v6를 통해 Claude/GPT를 단일 인터페이스로 추상화한다. 전통 NLP보다 LLM 기반 분석이 주력이므로, 한국어 처리 복잡성의 상당 부분을 AI 모델에 위임할 수 있다. 운영 서버(192.168.0.5)에 PostgreSQL(5433)과 Redis(6380/6381)가 이미 운영 중이어서 신규 인프라 비용 없이 프로젝트를 시작할 수 있다.

기존 경쟁 도구(빅카인즈, 썸트렌드, VAIV)가 수치와 그래프만 제공하고 해석은 사용자 몫으로 남기는 반면, AI SignalCraft의 핵심 차별점은 8개 분석 모듈(여론 구조, 집단별 반응, 감정/프레임, 메시지 효과, 리스크, 기회, 전략, 종합 리포트) 결과를 자동으로 텍스트 전략 리포트로 종합하는 것이다. 이 기능이 MVP 단계에서 가장 빠르게 검증해야 할 핵심 가치이므로, 로드맵은 "데이터 수집 → 기본 분석 → AI 리포트 생성" 흐름으로 최단 경로를 확보하는 방향으로 설계해야 한다.

가장 큰 리스크는 세 가지 축에서 동시에 발생한다. (1) 데이터 수집의 불안정성: 네이버 공식 댓글 API 부재로 비공식 엔드포인트에 의존하게 되고, 커뮤니티 사이트의 Cloudflare 차단이 지속적으로 강화되고 있으며, X API는 Basic 티어($200/월)에서도 15,000건 제한으로 사실상 유의미한 분석이 어렵다. (2) AI 분석의 신뢰성: 한국 정치 맥락에서 LLM 환각·편향이 높고, 한국 인터넷 커뮤니티의 자모 분리/초성 축약/인물명 변형 등 비표준 언어가 전통 NLP를 무력화한다. (3) 비용 통제: AI API 토큰 비용이 분석 빈도에 따라 월 수백~수천 달러까지 급증 가능하므로 Batch API, Prompt Caching, 모델 티어링을 아키텍처 수준에서 내장해야 한다.

## Key Findings

### Recommended Stack

TypeScript 모노리포 단일 언어 전략을 권장한다. LLM 기반 분석이 핵심이므로 Python NLP 생태계 의존도가 낮고, kiwi-nlp npm 패키지로 키워드 추출/빈도 분석 보조 기능을 Node.js 내에서 커버할 수 있다. Vercel AI SDK v6의 `generateObject` + Zod 조합은 구조화된 분석 결과 추출에 핵심이며, Prompt Caching과 Batch API를 활용하면 토큰 비용을 최대 90% 절감할 수 있다. Prisma 대신 Drizzle ORM을 선택한 이유는 복잡한 시계열 분석 쿼리를 SQL-like 빌더로 표현할 수 있고 번들 크기가 훨씬 작기 때문이다.

**Core technologies:**
- **Next.js 15 (App Router)**: 풀스택 프레임워크 — Server Components로 대규모 분석 데이터 서버 렌더링, API Routes로 파이프라인 트리거 엔드포인트 제공
- **PostgreSQL 16 + Drizzle ORM 0.40**: 기본 데이터 저장소 — 기존 운영 인프라 재활용, JSONB로 비정형 수집 데이터 처리, 복잡한 시계열 집계 쿼리
- **Redis 7 + BullMQ 5**: 파이프라인 오케스트레이터 — parent-child job으로 DAG 파이프라인 표현, 재시도/지연 실행/속도 제한 내장
- **Vercel AI SDK v6**: AI 추상화 레이어 — Claude/GPT 25개+ 프로바이더 단일 인터페이스, `generateObject`로 구조화 출력, Prompt Caching + Batch API 비용 최적화
- **tRPC 11 + TanStack Query 5**: 타입 안전 API — 클라이언트-서버 자동 타입 공유, 대시보드 필터링/페이지네이션에 TanStack Query 통합
- **Playwright 1.50 + Cheerio 1**: 웹 스크래핑 — JS 렌더링 필수인 한국 사이트 대응, 한국 로케일(ko-KR)/타임존(Asia/Seoul) 설정
- **shadcn/ui + Recharts 2**: 대시보드 UI — 53개 내장 차트 컴포넌트, 다크모드, 완전한 코드 소유권 모델

### Expected Features

**Must have (table stakes):**
- **멀티 플랫폼 데이터 수집** — 네이버 뉴스, 유튜브, X, DC갤러리, 에펨코리아, 클리앙 (소스별 수집 전략 상이)
- **키워드/인물 기반 검색 + 기간/소스 필터링** — 모든 분석의 진입점
- **감성 분석 (Sentiment Analysis)** — 여론 분석의 핵심 기본 지표
- **시계열 트렌드 차트** — 일별/주별 언급량 + 감성 비율 추이
- **연관어/키워드 분석** — 워드클라우드 + 빈도 테이블
- **기본 대시보드 시각화** — 차트, 요약 카드, 테이블
- **데이터 내보내기 (CSV/PDF)** — 보고서 활용 필수
- **수집 데이터 이력 관리** — 분석 재현성 보장
- **팀 멀티유저 접근** — 3~10명 팀 인증 + 권한 관리

**Should have (differentiators):**
- **AI 종합 분석 리포트 자동 생성** — 핵심 차별점, 8개 모듈 결과를 전략 텍스트로 종합
- **프레임 분석** — 담론 프레임 식별 (도덕성/능력/안보 프레임 등), LLM 기반
- **메시지 효과 분석** — 특정 발언/이벤트 전후 여론 변화
- **리스크/기회 분석** — AI 기반 리스크 요인 추출 + 영향도 평가
- **집단별(플랫폼별) 반응 세분화** — DC갤러리 vs 클리앙 vs 네이버 논조 비교
- **전략 도출 및 권고** — 모든 분석 결과 종합 전략 제안
- **경쟁 인물 비교 분석** — Share-of-Voice 개념 적용

**Defer (v2+):**
- **AI 지지율 추정** — 복잡도 매우 높음, 정확도 보장 어려움
- **위기 대응 시나리오 생성** — 리스크 분석 안정화 후 추가
- **분석 히스토리 비교** — 히스토리 데이터 충분히 축적 후 의미 있음
- **승리 확률 시뮬레이션** — 장기 연구 과제, MVP에서 명시적 제외

### Architecture Approach

파이프라인 지향 아키텍처(Pipeline-Oriented Architecture)를 BullMQ 잡 큐로 오케스트레이션하는 구조다. Dashboard → API Server → BullMQ → Workers(Collectors/Processors/Analyzers) → PostgreSQL의 단방향 데이터 흐름을 유지하며, Dashboard는 DB에 직접 접근하지 않는다. 파이프라인 로직(pipeline/ + workers/)은 FSD 레이어 외부에 분리 배치하고, `shared/ai`의 AI Gateway를 통해 모든 AI 호출을 중앙에서 관리한다. 각 Collector는 동일한 `collect(params): Promise<RawDocument[]>` 인터페이스를 구현하는 플러그인 구조로, 새 소스 추가가 기존 코드에 영향을 주지 않는다.

**Major components:**
1. **Dashboard (Presentation Layer)** — 분석 트리거, 진행 상태 모니터링, 결과 시각화 (Next.js + shadcn/ui)
2. **API Server** — 분석 작업 CRUD, 인증/인가, 파이프라인 실행 명령 발행 (tRPC + NextAuth.js v5)
3. **Pipeline Orchestrator (BullMQ)** — parent-child job으로 DAG 파이프라인 구성, 단계별 재시도/부하분산
4. **Collectors** — 소스별 독립 수집 플러그인 (Playwright/Cheerio/YouTube API/X API)
5. **Processor** — 정규화/중복제거/정제/배치 구성 (stateless pure function)
6. **Analyzers** — 12개 AI 분석 모듈 (Vercel AI SDK v6 + AI Gateway 중앙화)
7. **Storage (PostgreSQL)** — targets, analysis_jobs, raw_docs, normalized_docs, analysis_results 5개 핵심 테이블

### Critical Pitfalls

1. **네이버 비공식 댓글 API 의존** — 공식 댓글 API 미제공으로 내부 엔드포인트에 의존. Adapter Pattern으로 수집 로직을 격리하고 headless browser fallback 구조를 처음부터 설계
2. **X(Twitter) API 비용 폭탄** — Basic $200/월에 15,000건 제한, Pro는 $5,000/월. X를 "보조 소스"로 포지셔닝하고 네이버/유튜브/커뮤니티를 주력으로 설계. Phase 0에서 비용 시뮬레이션 필수
3. **LLM 환각·한국 정치 편향** — 한국 정치 맥락에서 서구 학습 데이터 편향, 동일 입력에 다른 결과. temperature=0, 원본 데이터 인용 필수, majority voting 교차 검증, 정량 집계는 코드로 직접 처리
4. **AI API 토큰 비용 폭증** — 분석 1회 $5~20, 월 $400~1,600+ 가능. Batch API(50% 할인), Prompt Caching(최대 90% 절감), 모델 티어링(단순 분류는 Haiku, 심층 분석은 Sonnet), 200K 토큰 청크 분할 아키텍처 수준에서 내장 필수
5. **한국어 비표준 언어 처리** — 자모 분리(ㅋㅋ, ㄹㅇ), 인물명 변형(문재앙), 반어 표현이 전통 형태소 분석기에서 실패. LLM 기반 감성 분석 주력, 인물별 alias 사전, 자모 전처리 정규화(soynlp) 구비

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 0: Pre-work — 사전 검토 및 프로젝트 기반
**Rationale:** X API 비용 시뮬레이션(Pitfall #2)과 법적 리스크 검토(Pitfall #5)는 수집 대상 확정 전에 완료해야 한다. kiwi-nlp Node.js v24 동작 검증도 이 단계에서 처리해야 한다.
**Delivers:** API 비용 예산 확정, 수집 소스 Go/No-Go 결정, 프로젝트 스캐폴딩(Next.js 15 + pnpm workspace), DB/Queue 인프라 연결 확인, ESLint/Vitest 설정
**Addresses:** 프로젝트 구조 초기화, FSD 디렉토리 설계, 운영 서버 포트/DB 인스턴스 확인
**Avoids:** Pitfall #2 (X API 비용 폭탄 — 예산 확정 없이 시작 금지), Pitfall #5 (법적 리스크 — 수집 대상 문서화)

### Phase 1: Foundation — 데이터 수집 파이프라인 (네이버 + 유튜브)
**Rationale:** Storage가 먼저 있어야 수집 데이터를 저장할 수 있고, Collection이 있어야 Processing을 테스트할 수 있다. MVP 최소 검증을 위해 API 기반의 안정적인 소스(네이버 뉴스 + 유튜브) 2개로 시작한다.
**Delivers:** PostgreSQL 스키마(Drizzle ORM 5개 핵심 테이블), BullMQ 파이프라인 기반, 네이버 뉴스 수집기(Adapter Pattern), 유튜브 댓글 수집기, Processor(정규화/중복제거/배치), 헬스체크 + 수집 실패 알림
**Addresses:** 멀티 플랫폼 데이터 수집 (기본 2개 소스), 수집 데이터 이력 관리
**Avoids:** Pitfall #1 (어댑터 패턴으로 비공식 API 격리), Pitfall #6 (YouTube quota 예산 관리 로직), Pitfall #9 (수집 시점 중복 제거 파이프라인 내장)
**Research flag:** 네이버 뉴스 비공식 댓글 API 현재 엔드포인트 실측 검증, Playwright fallback 시 CAPTCHA 대응 방법 조사 필요

### Phase 2: Core Analysis — AI 분석 엔진 + AI 리포트 MVP
**Rationale:** Processing이 있어야 Analysis에 정제된 데이터를 제공할 수 있다. 핵심 차별점인 AI 리포트 생성을 Phase 2에 포함하여 프로젝트 가치를 조기 검증한다. 비용 관리 아키텍처를 이 단계에서 확립하지 않으면 이후 확장이 불가능하다.
**Delivers:** AI Gateway(모델 라우팅, 토큰 추적, 비용 로깅, Batch API + Prompt Caching 통합), 감성 분석 모듈, 연관어/키워드 분석, AI 종합 리포트 생성(핵심 차별점), 프롬프트 버전 관리 시스템, 분석 결과 DB 저장
**Addresses:** 감성 분석(table stakes), AI 종합 리포트(핵심 differentiator), 연관어/키워드 분석
**Avoids:** Pitfall #3 (환각 검증: temperature=0 + 원본 인용 필수 + 한국 정치 맥락 시스템 프롬프트), Pitfall #4 (alias 사전 + 자모 전처리 모듈), Pitfall #7 (Batch API + Prompt Caching + 모델 티어링 아키텍처 내장), Pitfall #13 (프롬프트 버전 관리로 모델 전환 일관성 유지)
**Research flag:** Claude vs GPT 한국어 감성 분석 품질 비교 벤치마크, Vercel AI SDK v6 Batch API + Prompt Caching 실제 구현 패턴 확인 필요

### Phase 3: Dashboard MVP — 대시보드 + 팀 기능
**Rationale:** Analysis가 있어야 Dashboard에 보여줄 실제 결과가 있다. API와 UI는 Mock 데이터로 Phase 2와 병렬 개발 가능하지만, 실제 데이터 통합은 Phase 2 완료 후 진행한다.
**Delivers:** tRPC API 엔드포인트(분석 작업 CRUD, 결과 조회, 진행 상태), 기본 대시보드 시각화(시계열 차트/감성 비율/키워드 테이블), 분석 트리거 UI, 파이프라인 진행 상태 모니터(SSE/polling), NextAuth.js v5 팀 인증, 데이터 내보내기(CSV/PDF)
**Addresses:** 대시보드 시각화(table stakes), 기간/소스 필터링, 팀 멀티유저 접근, 데이터 내보내기
**Avoids:** Pitfall #11 (비동기 큐 + 단계별 진행률 표시 + 예상 소요 시간 UI), Pitfall #12 (AI 지지율 → "온라인 여론 지수" 명칭 + 한계 표시)

### Phase 4: Deep Analysis — 심층 분석 모듈
**Rationale:** 기본 감성 분석과 데이터 수집이 안정화된 후 심층 분석을 추가한다. 프레임 분석, 메시지 효과 분석은 시계열 트렌드 + 감성 데이터를 입력으로 사용하므로 Phase 2 완료 후 가능하다.
**Delivers:** 프레임 분석 모듈, 메시지 효과 분석, 리스크/기회 분석, 전략 도출 모듈, 집단별(플랫폼별) 반응 세분화, 경쟁 인물 비교 분석
**Addresses:** 프레임 분석(differentiator), 메시지 효과 분석, 리스크/기회 분석, 전략 권고, 경쟁 인물 비교
**Avoids:** Pitfall #10 (인구통계 추정 불가 → 플랫폼별 담론 클러스터 분석으로 대체, 한계 명시)

### Phase 5: Expansion — 추가 데이터 소스 + 고급 기능
**Rationale:** 기본 파이프라인 안정화 후 커뮤니티 스크래핑(불안정 소스)과 X API를 추가한다. 각 커뮤니티 수집기를 독립 모듈로 격리하여 차단 시 전체 파이프라인이 중단되지 않도록 설계한다.
**Delivers:** DC갤러리/에펨코리아/클리앙 수집기, X(Twitter) 수집기(예산 확정 시), 분석 히스토리 비교, 월간 비용 추이 대시보드
**Addresses:** 나머지 멀티 플랫폼 수집 완성, 분석 히스토리 비교
**Avoids:** Pitfall #8 (Cloudflare 차단 → 독립 모듈 + 부분 실패 허용 + 성공률 모니터링)

### Phase Ordering Rationale

- **데이터 → 처리 → 분석 → UI** 순서는 컴포넌트 간 실제 의존성에 기반한다. Storage 없이 Collection 불가, Collection 없이 Processing 불가, Processing 없이 Analysis 불가.
- **핵심 차별점(AI 리포트) 조기 검증**: FEATURES.md MVP 권고에 따라 AI 종합 리포트를 Phase 2에 포함하여 프로젝트 가치를 조기 증명한다.
- **불안정 소스 후순위**: 커뮤니티 스크래핑과 X API는 Pitfall #2, #8에 따라 Phase 5로 지연한다. 안정적인 API 소스(네이버, YouTube)로 먼저 파이프라인을 검증한다.
- **법적/비용 리스크 선행**: Phase 0에서 API 비용과 법적 리스크를 해소하지 않으면 Phase 1 이후 수집 대상 설계 변경이 불가피하다.
- **비용 관리 아키텍처를 Phase 2에 확립**: 토큰 비용 최적화 전략(Batch API, Prompt Caching, 모델 티어링)을 분석 모듈 초기 구현 시 내장하지 않으면 나중에 리팩토링 비용이 크다.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 1 (네이버 수집기):** 네이버 뉴스 비공식 댓글 API 현재 엔드포인트 실측 및 Playwright fallback 시 CAPTCHA/봇 감지 대응 전략 조사 필요
- **Phase 2 (AI 분석):** Vercel AI SDK v6 Batch API + Prompt Caching 실제 구현 패턴, Claude vs GPT 한국어 감성 분석 품질 비교 벤치마크 필요
- **Phase 5 (커뮤니티 수집):** DC갤러리/에펨코리아/클리앙 현재 Cloudflare 차단 수준 실측, 각 사이트 DOM 구조 분석 필요

**Phases with standard patterns (skip research-phase):**
- **Phase 0 (인프라 설계):** PostgreSQL + Drizzle ORM + BullMQ 설정은 공식 문서화가 충분히 성숙함
- **Phase 3 (대시보드):** Next.js 15 + tRPC + shadcn/ui + NextAuth.js v5 조합은 확립된 패턴, 추가 연구 불필요
- **Phase 4 (심층 분석 모듈):** Phase 2의 AI Gateway 패턴을 그대로 확장하는 구조이므로 별도 연구 없이 구현 가능

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Next.js, Drizzle, BullMQ, Vercel AI SDK v6 모두 공식 문서 확인. kiwi-nlp npm 바인딩 Node.js v24 안정성만 MEDIUM |
| Features | MEDIUM-HIGH | 경쟁 도구(빅카인즈, 썸트렌드, VAIV) 기능 분석 완료. AI 지지율 추정 정확도 및 집단별 분석 대안은 LOW |
| Architecture | MEDIUM-HIGH | BullMQ parent-child 패턴, FSD 디렉토리 구조, Collector 플러그인 패턴 검증됨. AI 모델 라우팅 최적화(어느 모듈에 Claude vs GPT)는 실제 벤치마크 필요(LOW) |
| Pitfalls | HIGH | 네이버 API 부재, X 가격, LLM 환각, 토큰 비용, 법적 리스크 모두 공식 문서/판례/논문으로 확인. Cloudflare 차단 수준은 사이트별로 가변적(MEDIUM) |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **kiwi-nlp Node.js v24 안정성**: Phase 0에서 설치/동작 검증 필수. 실패 시 해당 기능만 Python 마이크로서비스로 분리 재검토
- **AI 모델 라우팅 최적화**: 어떤 분석 모듈에 Claude vs GPT가 더 적합한지 연구 근거가 LOW. Phase 2에서 동일 데이터셋 A/B 테스트 후 결정
- **네이버 댓글 비공식 API 현황**: Phase 1 시작 전 현재 동작 방식과 엔드포인트 실측 필요
- **집단별(연령/성향) 분석 요구사항 재정의**: 플랫폼에서 인구통계 메타데이터를 얻을 수 없음(Pitfall #10). "플랫폼별 담론 클러스터" 분석으로 요구사항을 재정의하고 대시보드에 한계 명시
- **PostgreSQL 신규 인스턴스 포트 확인**: 기존 서비스(5433: news-postgres, 5434: n8n-postgres)와 충돌 없는 포트 배정 필요

## Sources

### Primary (HIGH confidence)
- [Vercel AI SDK v6 Documentation](https://ai-sdk.dev/docs/introduction) — AI 추상화, generateObject, Prompt Caching, Batch API
- [BullMQ Documentation](https://docs.bullmq.io/) — parent-child job, flow pattern, rate limiting
- [Drizzle ORM PostgreSQL Docs](https://orm.drizzle.team/docs/get-started-postgresql) — ORM 설계, 마이그레이션
- [YouTube Data API v3 Quota](https://developers.google.com/youtube/v3/determine_quota_cost) — quota 체계 확인
- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — 토큰 비용 계산 기준
- [X API Pricing 2025-2026](https://zernio.com/blog/twitter-api-pricing) — Basic/Pro/Enterprise 가격
- [shadcn/ui Charts](https://ui.shadcn.com/charts/area) — 대시보드 차트 컴포넌트
- [tRPC Next.js Integration](https://trpc.io/docs/client/nextjs) — API 레이어 설계
- [네이버 오픈 API 목록](https://naver.github.io/naver-openapi-guide/apilist.html) — 댓글 API 공식 미제공 확인

### Secondary (MEDIUM confidence)
- [빅카인즈 서비스 안내](https://www.bigkinds.or.kr/v2/intro/service.do) — 경쟁 도구 기능 분석
- [썸트렌드 Sometrend](https://some.co.kr/) — 경쟁 도구 기능 분석
- [Kiwi Morphological Analyzer (GitHub)](https://github.com/bab2min/Kiwi) — kiwi-nlp npm 패키지 기반
- [LLMs for Public Opinion Analysis](https://www.cogitatiopress.com/mediaandcommunication/article/viewFile/9677/4381) — LLM 분석 한계 및 편향
- [Cloudflare AI Crawler Default Blocking 2025](https://www.cloudflare.com/press/press-releases/2025/cloudflare-just-changed-how-ai-crawlers-scrape-the-internet-at-large/) — 스크래핑 차단 현황
- [데이터 크롤링의 한국법상 허용기준](https://www.mondaq.com/copyright/1266554) — 법적 리스크 검토
- [대법원 2022도1533 판결](https://file.scourt.go.kr/dcboard/1727143941701_111221.pdf) — 웹 크롤링 형사법적 판례

### Tertiary (LOW confidence)
- [LLM Hallucination Rate — Frontiers in AI](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1609097/full) — 57.33% 환각률 (특정 실험 기준, 일반화 주의)
- [LLM Agents Pipeline for Public Opinion Analysis (arxiv)](https://arxiv.org/abs/2505.11401) — 아키텍처 참고
- [Naver Scraping Guide (Scrapfly)](https://scrapfly.io/blog/posts/how-to-scrape-naver) — 네이버 스크래핑 방법 참고 (지속적 변경 가능성 있음)
- [Korean Sentiment Analysis — KoBERT (MDPI)](https://www.mdpi.com/2071-1050/14/7/4113) — 한국어 감성 분석 기술 참고 (LLM 대안으로 대체 채택)

---
*Research completed: 2026-03-24*
*Ready for roadmap: yes*
