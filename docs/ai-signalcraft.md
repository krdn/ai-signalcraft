> **원본 소스**: 프로젝트 디렉토리 `/home/gon/projects/ai/ai-signalcraft`
> **작성일**: 2026-04-02

# AI SignalCraft — 프로젝트 아키텍처 정리

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [모노레포 패키지 구조](#2-모노레포-패키지-구조)
3. [데이터 파이프라인](#3-데이터-파이프라인)
4. [AI 분석 모듈 (14개)](#4-ai-분석-모듈-14개)
5. [데이터 수집기 (5개 소스)](#5-데이터-수집기-5개-소스)
6. [DB 스키마](#6-db-스키마)
7. [웹 대시보드 구조](#7-웹-대시보드-구조)
8. [기술 스택 선택 근거](#8-기술-스택-선택-근거)
9. [개발 명령어](#9-개발-명령어)
10. [배포 인프라](#10-배포-인프라)

---

## 1. 프로젝트 개요

**AI SignalCraft**는 공인(정치인·인물) 관련 여론을 자동으로 수집하고 AI로 분석하는 파이프라인과 웹 대시보드 시스템입니다.

| 항목            | 내용                                                 |
| --------------- | ---------------------------------------------------- |
| **대상 사용자** | 소규모 팀 (3~10명)                                   |
| **실행 방식**   | 수동 트리거 (UI에서 분석 시작)                       |
| **수집 소스**   | 5개 (네이버 뉴스, 네이버 댓글, 유튜브, 커뮤니티 3곳) |
| **분석 모듈**   | 14개 (Stage 1~4 단계별 실행)                         |
| **인프라**      | PostgreSQL 16 + Redis 7 @ 192.168.0.5                |

---

## 2. 모노레포 패키지 구조

```
ai-signalcraft/                   # pnpm 워크스페이스 루트
├── apps/
│   └── web/                      # Next.js 15 App Router 대시보드
├── packages/
│   ├── core/                     # 비즈니스 로직 (분석·DB·큐·리포트)
│   ├── collectors/               # 데이터 수집기 (Playwright + Cheerio)
│   └── ai-gateway/               # AI 프로바이더 통합 (Vercel AI SDK v6)
├── docker/                       # Docker Compose 설정
├── scripts/                      # 트리거 스크립트
└── docs/                         # 기술 문서
```

### 의존성 방향 (단방향, 역방향 금지)

```
apps/web → packages/core → packages/collectors
                         → packages/ai-gateway
```

- `web`은 `core`의 `index.ts` public API만 참조 (내부 경로 직접 import 금지)
- `collectors`와 `ai-gateway`는 서로 독립 (상호 참조 금지)

---

## 3. 데이터 파이프라인

전체 파이프라인은 **BullMQ 5** 기반 Flow로 구성됩니다.

```
[UI 트리거]
    ↓
[수집 단계]  ←─ collector-worker.ts
  5개 소스 병렬 수집
    ↓
[정규화]  ←─ pipeline/normalize.ts
  수집 데이터 → 공통 포맷
    ↓
[DB 저장]  ←─ pipeline/persist.ts
  PostgreSQL collections 테이블
    ↓
[AI 분석]  ←─ analysis-worker.ts
  Stage 1 (병렬 4개)
  Stage 2 (순차 4개, Stage 1 결과 참조)
  Stage 4 (선택적 고급 분석 6개)
    ↓
[리포트 생성]  ←─ report/generator.ts
  PDF 내보내기 지원
```

### 큐 워커 구성

| 파일                  | 역할                     |
| --------------------- | ------------------------ |
| `collector-worker.ts` | 각 소스별 수집 작업 실행 |
| `analysis-worker.ts`  | AI 분석 모듈 실행        |
| `pipeline-worker.ts`  | 전체 파이프라인 조율     |
| `worker-process.ts`   | 워커 프로세스 진입점     |
| `startup-cleanup.ts`  | 시작 시 stale 작업 정리  |

---

## 4. AI 분석 모듈 (14개)

모듈 위치: `packages/core/src/analysis/modules/`
스키마 위치: `packages/core/src/analysis/schemas/`

### Stage 1 — 병렬 실행 (4개)

| 모듈명             | 파일                   | 분석 내용                   |
| ------------------ | ---------------------- | --------------------------- |
| `macroView`        | `macro-view.ts`        | 거시적 여론 흐름            |
| `segmentation`     | `segmentation.ts`      | 지지층·반대층 세그먼트 분류 |
| `sentimentFraming` | `sentiment-framing.ts` | 감정 프레이밍 분석          |
| `messageImpact`    | `message-impact.ts`    | 메시지 파급력 평가          |

### Stage 2 — 순차 실행 (4개, Stage 1 결과 참조)

| 모듈명         | 파일               | 분석 내용        |
| -------------- | ------------------ | ---------------- |
| `riskMap`      | `risk-map.ts`      | 위기·리스크 지도 |
| `opportunity`  | `opportunity.ts`   | 기회 요소 발굴   |
| `strategy`     | `strategy.ts`      | 전략 제언        |
| `finalSummary` | `final-summary.ts` | 종합 요약        |

### Stage 4 — 고급 분석 (6개, 선택적)

병렬 실행 후 순차:

| 모듈명           | 파일                 | 분석 내용               |
| ---------------- | -------------------- | ----------------------- |
| `approvalRating` | `approval-rating.ts` | 지지율 추정 (병렬)      |
| `frameWar`       | `frame-war.ts`       | 프레임 전쟁 분석 (병렬) |
| `crisisScenario` | `crisis-scenario.ts` | 위기 시나리오 (순차)    |
| `winSimulation`  | `win-simulation.ts`  | 승리 시뮬레이션 (순차)  |

### 모듈 패턴

```typescript
export const exampleModule: AnalysisModule<ExampleResult> = {
  name: 'example',
  displayName: '예시 분석',
  provider: MODULE_MODEL_MAP['example'].provider,
  model: MODULE_MODEL_MAP['example'].model,
  schema: ExampleSchema,          // Zod 스키마
  buildSystemPrompt(): string { ... },
  buildPrompt(data: AnalysisInput): string { ... },
  // Stage 2+: 이전 결과 참조
  buildPromptWithContext?(data, priorResults): string { ... },
};
```

---

## 5. 데이터 수집기 (5개 소스)

수집기 위치: `packages/collectors/src/adapters/`

| 수집기      | 파일                                    | 방식       | 데이터          |
| ----------- | --------------------------------------- | ---------- | --------------- |
| 네이버 뉴스 | `naver-news.ts`                         | Cheerio    | 뉴스 기사       |
| 네이버 댓글 | `naver-comments.ts`                     | Cheerio    | 뉴스 댓글       |
| 유튜브 영상 | `youtube-videos.ts`                     | Google API | 영상 정보       |
| 유튜브 댓글 | `youtube-comments.ts`                   | Google API | 영상 댓글       |
| 커뮤니티    | `clien.ts`, `dcinside.ts`, `fmkorea.ts` | Playwright | 커뮤니티 게시글 |

### 수집기 계층 구조

```
Collector (인터페이스, base.ts)
  └── CommunityBaseCollector (community-base-collector.ts)
        ├── ClienCollector (clien.ts)
        ├── DCInsideCollector (dcinside.ts)
        └── FmKoreaCollector (fmkorea.ts)
  └── BrowserCollector (browser-collector.ts, Playwright 기반)
```

---

## 6. DB 스키마

ORM: Drizzle ORM | DB: PostgreSQL 16
스키마 위치: `packages/core/src/db/schema/`

| 파일             | 테이블                     | 내용                      |
| ---------------- | -------------------------- | ------------------------- |
| `collections.ts` | collections                | 수집된 원문 데이터        |
| `analysis.ts`    | analyses, analysis_results | AI 분석 결과 (JSONB)      |
| `ontology.ts`    | entities, relations        | 온톨로지 엔티티/관계      |
| `auth.ts`        | users, sessions, accounts  | NextAuth.js 5 인증        |
| `settings.ts`    | settings                   | 팀 설정 (모델, API 키 등) |

### pgvector 임베딩

- **모델**: multilingual-e5-small (384차원, 로컬 추론)
- **저장**: `articles.embedding`, `comments.embedding` (vector384 컬럼)
- **인덱스**: HNSW (cosine distance), m=16, ef_construction=64
- **활용**: 시맨틱 검색, RAG 기반 분석 최적화, 클러스터링/중복 제거

### 온톨로지 (지식 그래프)

분석 결과에서 추출한 엔티티와 관계를 저장:

**entities 테이블**: 6가지 타입 (person, organization, issue, keyword, frame, claim)
**relations 테이블**: 6가지 관계 (supports, opposes, related, causes, cooccurs, threatens)

추출 소스: sentiment-framing, segmentation, frame-war, risk-map, message-impact, macro-view, strategy
시각화: D3.js force-directed 그래프 (대시보드에 내장)

---

## 7. 웹 대시보드 구조

프레임워크: Next.js 15 App Router + tRPC 11 + shadcn/ui

### 페이지 구성

| 경로              | 설명               |
| ----------------- | ------------------ |
| `/`               | 메인 대시보드      |
| `/login`          | 인증               |
| `/queue-status`   | BullMQ 큐 모니터링 |
| `/invite/[token]` | 팀 초대            |

### 컴포넌트 도메인

| 디렉토리                | 역할                                             |
| ----------------------- | ------------------------------------------------ |
| `components/dashboard/` | KPI 카드, 감정 차트, 트렌드 차트, 수집 데이터 뷰 |
| `components/analysis/`  | 파이프라인 모니터, 트리거 폼, 작업 목록          |
| `components/advanced/`  | 지지율 카드, 프레임 전쟁 차트, 위기 시나리오     |
| `components/report/`    | 리포트 뷰어, 섹션 네비게이션                     |
| `components/settings/`  | AI 모델 설정, API 키 관리, 수집 한도             |
| `components/team/`      | 팀원 관리, 초대 다이얼로그                       |
| `components/auth/`      | 로그인 폼                                        |

---

## 8. 기술 스택 선택 근거

| 카테고리 | 선택              | 대안                | 선택 이유                                    |
| -------- | ----------------- | ------------------- | -------------------------------------------- |
| ORM      | Drizzle ORM       | Prisma              | 복잡한 분석 쿼리에 SQL-like 빌더가 더 적합   |
| 차트     | Recharts (shadcn) | Nivo, Tremor        | shadcn/ui 테마 통합 지원                     |
| API      | tRPC 11           | Server Actions only | TanStack Query 캐싱·갱신 통합 필요           |
| 스크래퍼 | Playwright        | Puppeteer           | 안정성, 한국 로케일, auto-wait               |
| 큐       | BullMQ 5          | Agenda.js           | Flow 기능, Redis 인프라 활용                 |
| AI SDK   | Vercel AI SDK v6  | LangChain.js        | 단순 프롬프트 중심, 과도한 추상화 불필요     |
| DB       | PostgreSQL 16     | MongoDB             | 분석 결과는 관계형 적합, JSONB로 비정형 처리 |
| Auth     | NextAuth.js 5     | Lucia Auth          | 생태계 표준, 소규모 팀에 충분                |

**아키텍처 결정**: TypeScript 모노레포 (Python+TS 폴리글랏 대신)

- 단일 언어로 타입 공유, 배포 단순화

---

## 9. 개발 명령어

```bash
pnpm dev          # 웹 개발 서버 (Next.js)
pnpm dev:all      # 웹 + BullMQ 워커 동시 실행
pnpm worker       # BullMQ 워커만 실행
pnpm test         # 전체 Vitest 테스트
pnpm lint         # ESLint 9 Flat Config
pnpm format       # Prettier 포맷팅
pnpm db:push      # Drizzle 스키마 → PostgreSQL 동기화
pnpm db:studio    # Drizzle Studio (DB GUI)
pnpm build        # 프로덕션 빌드
pnpm trigger      # 수집 트리거 스크립트 실행
```

---

## 10. 배포 인프라

| 항목          | 값                                             |
| ------------- | ---------------------------------------------- |
| **배포 방식** | Docker Compose                                 |
| **DB 서버**   | PostgreSQL 16 @ 192.168.0.5:5433               |
| **큐/캐시**   | Redis 7 @ 192.168.0.5:6380 (prod) / 6381 (dev) |
| **CI/CD**     | GitHub Actions (`.github/workflows/`)          |
| **컨테이너**  | Dockerfile + `docker/docker-compose.prod.yml`  |

### 디버깅 원칙

- **근본 원인 먼저**: DB → API → Worker → Frontend 전체 경로 추적
- SQL 변경 시 ambiguous column reference 확인
- 스크래퍼 오류: CSS 셀렉터/URL 패턴 변경부터 확인
