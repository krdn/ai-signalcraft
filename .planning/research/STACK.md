# Technology Stack

**Project:** AI SignalCraft - 한국 공인 여론 분석 자동화 파이프라인
**Researched:** 2026-03-24
**Overall Confidence:** MEDIUM-HIGH

---

## Recommended Stack

### Core Framework

| Technology | Version           | Purpose                            | Why                                                                                                                                                                                          | Confidence |
| ---------- | ----------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Next.js    | 15.x (App Router) | 풀스택 프레임워크 (대시보드 + API) | App Router의 Server Components로 대규모 분석 데이터를 서버에서 렌더링하여 클라이언트 JS 최소화. API Routes로 파이프라인 트리거 엔드포인트 구현. pnpm 호환. Vercel 생태계(AI SDK) 활용 극대화 | HIGH       |
| TypeScript | 5.x               | 타입 안전성                        | 다중 데이터 소스의 복잡한 스키마를 타입으로 관리. AI SDK, Drizzle ORM 등 모든 추천 라이브러리가 TypeScript-first                                                                             | HIGH       |
| React      | 19.x              | UI 라이브러리                      | Next.js 15 번들. Server Components + Suspense로 대시보드 성능 최적화                                                                                                                         | HIGH       |

### Database

| Technology  | Version | Purpose           | Why                                                                                                                                                      | Confidence |
| ----------- | ------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| PostgreSQL  | 16.x    | 메인 데이터베이스 | 운영 서버(192.168.0.5)에 이미 PostgreSQL 인프라 존재. JSONB로 비정형 수집 데이터 유연하게 저장. 정형 분석 결과는 관계형 테이블. Full-text search 지원    | HIGH       |
| Drizzle ORM | 0.40.x  | TypeScript ORM    | SQL-like 쿼리 빌더로 복잡한 분석 쿼리 표현 용이. Prisma보다 가볍고 빠름. Identity column 등 최신 PostgreSQL 기능 지원. Drizzle Studio로 데이터 탐색 편리 | HIGH       |
| Redis       | 7.x     | 작업 큐 + 캐싱    | BullMQ 백엔드로 수집/분석 작업 큐 관리. 운영 서버에 이미 Redis 인프라 존재(6380/6381 포트). 분석 결과 캐싱으로 반복 조회 성능 향상                       | HIGH       |

### AI/LLM Integration

| Technology        | Version | Purpose           | Why                                                                                                                                                                                    | Confidence |
| ----------------- | ------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Vercel AI SDK     | v6      | 다중 AI 모델 통합 | 25개 이상 프로바이더 지원. 단일 API로 Claude/GPT 전환 가능. `generateText`, `generateObject`로 구조화된 분석 결과 추출. 프로바이더별 코드 분기 불필요. 비용 관리(budget controls) 내장 | HIGH       |
| @ai-sdk/anthropic | latest  | Claude 프로바이더 | AI SDK v6 공식 Anthropic 프로바이더. Claude Sonnet 4 등 최신 모델 지원                                                                                                                 | HIGH       |
| @ai-sdk/openai    | latest  | GPT 프로바이더    | AI SDK v6 공식 OpenAI 프로바이더. GPT-5.4 Mini 등 최신 모델 지원                                                                                                                       | HIGH       |
| Zod               | 3.x     | 스키마 검증       | AI SDK의 `generateObject`와 통합하여 분석 결과 구조 강제. API 입력 검증. Drizzle 스키마와 공유 가능                                                                                    | HIGH       |

### Data Pipeline / Job Queue

| Technology | Version | Purpose                | Why                                                                                                                                               | Confidence |
| ---------- | ------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| BullMQ     | 5.x     | 작업 큐 시스템         | Redis 기반. 수집 -> 전처리 -> 분석 파이프라인을 Flow(부모-자식 작업)로 표현. 재시도, 지연 실행, 우선순위, 속도 제한 내장. 수동 트리거 방식에 적합 | HIGH       |
| Playwright | 1.50.x  | 웹 스크래핑 (브라우저) | JS 렌더링 필수인 한국 사이트(네이버, DC갤러리 등) 대응. 한국 로케일(ko-KR), 타임존(Asia/Seoul) 설정 지원. Puppeteer보다 안정적이고 API가 깔끔     | HIGH       |
| Cheerio    | 1.x     | HTML 파싱              | Playwright로 가져온 HTML의 경량 파싱. DOM 조작 없이 빠른 데이터 추출                                                                              | HIGH       |
| googleapis | 144.x   | YouTube Data API       | 공식 Google API 클라이언트. `commentThreads.list`로 댓글 수집. OAuth 2.0 / API Key 인증                                                           | HIGH       |

### Korean NLP

| Technology | Version      | Purpose            | Why                                                                                                                                                                                                                      | Confidence |
| ---------- | ------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| kiwi-nlp   | 0.22.x (npm) | 한국어 형태소 분석 | C++ 기반으로 빠른 속도. Node.js npm 패키지로 직접 사용 가능(Python 별도 프로세스 불필요). 평균 87% 정확도(웹 텍스트), 94%(정형 텍스트). 멀티스레딩 지원으로 대량 텍스트 처리에 적합. 200개 이상 GitHub 프로젝트에서 활용 | MEDIUM     |

**Note:** LLM 기반 감성분석이 주력이므로, 형태소 분석은 키워드 추출, 워드클라우드, 빈도 분석 등 보조 용도. 핵심 감성/프레임 분석은 Claude/GPT가 직접 수행.

### Frontend UI

| Technology     | Version | Purpose            | Why                                                                                                                                                                     | Confidence |
| -------------- | ------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| shadcn/ui      | latest  | UI 컴포넌트 시스템 | Copy-paste 모델로 완전한 코드 소유권. Tailwind CSS + Radix UI 기반. 53개 내장 차트 컴포넌트(Recharts 기반). 다크모드 자동 지원. 대시보드 레이아웃 블록 제공             | HIGH       |
| Tailwind CSS   | 4.x     | 스타일링           | shadcn/ui 기반 스택. 유틸리티 우선으로 빠른 대시보드 UI 개발                                                                                                            | HIGH       |
| Recharts       | 2.x     | 차트/그래프        | shadcn/ui 차트 컴포넌트의 기반 라이브러리. SVG 기반 깔끔한 렌더링. 시계열 차트(여론 트렌드), 파이 차트(감정 비율), 바 차트(플랫폼별 비교) 등 필요한 차트 타입 모두 지원 | HIGH       |
| TanStack Query | 5.x     | 서버 상태 관리     | 분석 결과 캐싱, 자동 갱신, 페이지네이션. tRPC와 통합하여 타입 안전한 데이터 패칭                                                                                        | HIGH       |

### API Layer

| Technology | Version | Purpose       | Why                                                                                                                                                                                        | Confidence |
| ---------- | ------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| tRPC       | 11.x    | 타입 안전 API | Next.js App Router 완전 통합. Server Components에서 `createCaller`로 HTTP 요청 없이 직접 호출. 클라이언트에서는 TanStack Query 자동 통합. 입력 검증(Zod), 미들웨어(인증), 에러 핸들링 내장 | HIGH       |

### Authentication

| Technology            | Version | Purpose | Why                                                                                                                       | Confidence |
| --------------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------- | ---------- |
| NextAuth.js (Auth.js) | 5.x     | 팀 인증 | 3~10명 소규모 팀 인증. Credentials 프로바이더로 간단한 ID/PW 인증 또는 OAuth(Google 등). Next.js App Router 네이티브 지원 | MEDIUM     |

### Infrastructure

| Technology     | Version | Purpose               | Why                                                                                                 | Confidence |
| -------------- | ------- | --------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| Docker         | 27.x    | 컨테이너화            | 운영 서버(192.168.0.5) Docker 환경과 일치. PostgreSQL, Redis, App 서버를 docker-compose로 통합 관리 | HIGH       |
| Docker Compose | 2.x     | 서비스 오케스트레이션 | 로컬 개발과 운영 서버 동일한 환경 구성. 기존 dserver/dlocal alias 활용                              | HIGH       |

### DevTools

| Technology | Version | Purpose           | Why                                                       | Confidence |
| ---------- | ------- | ----------------- | --------------------------------------------------------- | ---------- |
| Vitest     | 3.x     | 테스트 프레임워크 | Vite 기반 빠른 테스트. TypeScript 네이티브. Jest 호환 API | HIGH       |
| ESLint     | 9.x     | 린터              | Flat config. Next.js 공식 플러그인 지원                   | HIGH       |
| Prettier   | 3.x     | 코드 포매터       | 일관된 코드 스타일                                        | HIGH       |

---

## Alternatives Considered

| Category   | Recommended           | Alternative                       | Why Not                                                                                                                                                 |
| ---------- | --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ORM        | Drizzle ORM           | Prisma                            | Prisma는 무겁고 느림. 복잡한 분석 쿼리에서 Drizzle의 SQL-like 빌더가 더 표현력 있음. Drizzle의 번들 사이즈가 훨씬 작음                                  |
| Chart      | Recharts (via shadcn) | Nivo                              | Nivo는 Next.js 13+ App Router에서 모든 차트에 'use client' 필수. shadcn/ui와 통합 안 됨. Recharts가 shadcn 테마 시스템과 자동 통합                      |
| Chart      | Recharts (via shadcn) | Tremor                            | Tremor 자체가 Recharts 위에 구축된 메타 라이브러리. shadcn/ui를 쓰면 Tremor 불필요. shadcn 차트가 더 커스터마이즈 가능                                  |
| API        | tRPC                  | Server Actions only               | Server Actions는 데이터 캐싱/갱신 기능 없음. 대시보드의 필터링, 정렬, 페이지네이션에 TanStack Query 통합이 필수. tRPC가 이를 자연스럽게 제공            |
| API        | tRPC                  | REST API (Next.js Route Handlers) | 타입 안전성 없음. 스키마 수동 관리 필요. tRPC는 TypeScript 추론만으로 자동 타입 공유                                                                    |
| Scraper    | Playwright            | Puppeteer                         | Playwright가 더 안정적인 auto-wait. 다중 브라우저 지원. 한국 로케일 설정이 더 깔끔. API 디자인이 현대적                                                 |
| Queue      | BullMQ                | Agenda.js                         | BullMQ가 더 활발하게 유지보수됨. Flow 기능으로 파이프라인 의존성 표현 가능. Redis 기반으로 기존 인프라 활용                                             |
| Korean NLP | kiwi-nlp (npm)        | KoNLPy (Python)                   | KoNLPy는 Python 전용으로 별도 프로세스/마이크로서비스 필요. kiwi-nlp는 npm으로 Node.js에서 직접 사용. 전체 스택을 TypeScript로 통일                     |
| Korean NLP | kiwi-nlp (npm)        | Python 형태소 분석 마이크로서비스 | 배포/운영 복잡도 증가. Node.js ↔ Python 통신 오버헤드. 이 프로젝트에서 형태소 분석은 보조 기능이므로 별도 서비스 비용 대비 효과 낮음                    |
| DB         | PostgreSQL            | MongoDB                           | 운영 서버에 MongoDB도 있지만(27018), 분석 결과는 구조화된 관계형 데이터에 적합. JSONB로 비정형 데이터도 충분히 처리 가능. 복잡한 집계 쿼리는 SQL이 우위 |
| Auth       | NextAuth.js 5         | Lucia Auth                        | NextAuth.js가 Next.js 생태계 표준. 3~10명 소규모 팀에 충분. Lucia는 더 low-level                                                                        |
| AI SDK     | Vercel AI SDK v6      | LangChain.js                      | AI SDK가 Next.js와 네이티브 통합. LangChain은 과도한 추상화로 디버깅 어려움. 이 프로젝트는 체이닝보다 단일 프롬프트 분석이 주력이므로 AI SDK가 적합     |

---

## Architecture Decision: Monorepo vs Polyglot

**Decision: TypeScript 모노리포 (단일 언어)**

| Approach                       | Pros                                                             | Cons                                                              |
| ------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| **TypeScript 모노리포** (선택) | 단일 언어로 스택 통일. 타입 공유. 배포 단순. pnpm workspace 활용 | Korean NLP 라이브러리 선택지 제한                                 |
| Python + TypeScript 폴리글랏   | Python NLP 생태계 풍부 (KoNLPy, transformers)                    | 두 언어 관리. 통신 오버헤드. Docker 이미지 복잡. 배포 복잡도 증가 |

**Rationale:** 이 프로젝트의 핵심 분석은 LLM(Claude/GPT)이 수행하므로, 전통적 NLP 라이브러리 의존도가 낮음. kiwi-nlp npm 패키지로 키워드 추출/빈도 분석 정도는 충분히 커버 가능. 만약 kiwi-nlp의 Node.js 바인딩이 불안정하면, 해당 기능만 Python 마이크로서비스로 분리하는 것을 Phase 1 이후에 재검토.

---

## X (Twitter) API 전략

**현실:** X API 가격이 매우 높음 ($100/월에 15,000 트윗, $5,000/월에 1M 트윗).

**권장 접근:**

1. **Phase 1:** X API Basic ($100/월)으로 시작. 수동 트리거 방식이므로 월 15,000 트윗이면 초기에 충분
2. **대안 검토:** 분석 빈도 증가 시 Apify 등 서드파티 스크래핑 API 평가
3. **법적 참고:** 공개 데이터 스크래핑은 합법이나, X의 ToS 위반 가능성 있음. API 우선 정책 유지 권장

---

## Installation

```bash
# Core framework
pnpm add next@latest react@latest react-dom@latest typescript

# Database
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit @types/pg

# AI SDK
pnpm add ai @ai-sdk/anthropic @ai-sdk/openai zod

# Data pipeline
pnpm add bullmq cheerio
pnpm add -D playwright @playwright/test

# API layer
pnpm add @trpc/server @trpc/client @trpc/react-query @tanstack/react-query

# Korean NLP
pnpm add kiwi-nlp

# UI
pnpm add tailwindcss @radix-ui/react-slot class-variance-authority clsx tailwind-merge lucide-react recharts

# Auth
pnpm add next-auth@beta

# YouTube API
pnpm add googleapis

# DevTools
pnpm add -D vitest @testing-library/react eslint prettier
```

**Note:** shadcn/ui는 `npx shadcn@latest init`으로 초기화 후 필요한 컴포넌트를 개별 추가하는 방식.

---

## Key Version Constraints

| Package    | Min Version | Reason                      |
| ---------- | ----------- | --------------------------- |
| Node.js    | 24.x        | 사용자 환경(v24.14.0)       |
| pnpm       | 9.x         | 패키지 매니저 (사용자 기본) |
| PostgreSQL | 16.x        | Identity column, JSONB 개선 |
| Redis      | 7.x         | BullMQ 5.x 호환             |

---

## Sources

- [AI SDK v6 Introduction](https://ai-sdk.dev/docs/introduction) - HIGH confidence
- [Drizzle ORM PostgreSQL Docs](https://orm.drizzle.team/docs/get-started-postgresql) - HIGH confidence
- [BullMQ Documentation](https://docs.bullmq.io/) - HIGH confidence
- [shadcn/ui Charts](https://ui.shadcn.com/charts/area) - HIGH confidence
- [Kiwi Morphological Analyzer](https://github.com/bab2min/Kiwi) - MEDIUM confidence (npm 바인딩 안정성 검증 필요)
- [tRPC Next.js Integration](https://trpc.io/docs/client/nextjs) - HIGH confidence
- [YouTube Data API v3](https://developers.google.com/youtube/v3/docs/comments/list) - HIGH confidence
- [Playwright Web Scraping Guide](https://www.scraperapi.com/web-scraping/playwright/) - HIGH confidence
- [KoNLPy Documentation](https://konlpy.org/) - MEDIUM confidence (Python 전용, 대안 참고용)
- [X API Pricing Discussion](https://scrapecreators.com/blog/how-to-scrape-twitter-x-api-2025) - MEDIUM confidence
- [DCInside Crawler (dcoutside)](https://github.com/j1wan/dcoutside) - LOW confidence (Python 구현, 참고용)
- [Naver Scraping Guide](https://scrapfly.io/blog/posts/how-to-scrape-naver) - MEDIUM confidence
