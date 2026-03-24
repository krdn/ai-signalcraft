# Architecture Patterns

**Domain:** Public Opinion Analysis Pipeline (Korean public figures)
**Researched:** 2026-03-24

## Recommended Architecture

**Pipeline-Oriented Architecture with Job Queue Orchestration**

이 시스템은 수동 트리거 기반의 배치 분석 파이프라인이다. 실시간 스트리밍이 아니므로 이벤트 드리븐 아키텍처가 아닌, 잡 큐 기반의 순차/병렬 파이프라인 구조가 적합하다.

```
[Dashboard UI]
     |
     v
[API Server] -----> [Job Queue (BullMQ + Redis)]
     |                        |
     v                        v
[PostgreSQL] <------ [Pipeline Workers]
                        |          |          |
                        v          v          v
                  [Collectors] [Processors] [Analyzers]
                    |    |        |            |     |
                    v    v        v            v     v
                 [APIs] [Scraper] [Normalizer] [Claude] [GPT]
```

### System Layers (Top to Bottom)

| Layer | Description | Technology |
|-------|-------------|------------|
| **Presentation** | 분석 결과 시각화, 분석 실행 트리거 | Next.js Dashboard |
| **API** | REST/tRPC API, 인증, 분석 작업 관리 | Next.js API Routes or Hono |
| **Orchestration** | 파이프라인 잡 관리, 큐잉, 재시도 | BullMQ + Redis |
| **Collection** | 데이터 수집 (API + Scraping) | Crawlee, Cheerio, Playwright |
| **Processing** | 데이터 정규화, 중복 제거, 정제 | Custom TypeScript modules |
| **Analysis** | AI 기반 여론 분석 (8개 모듈 + 4개 추가 기능) | Claude API, OpenAI API |
| **Storage** | 수집 데이터 + 분석 결과 저장 | PostgreSQL (192.168.0.5) |

## Component Boundaries

### 1. Dashboard (Presentation Layer)

| Responsibility | Communicates With |
|----------------|-------------------|
| 분석 대상 인물 검색/등록 | API Server |
| 분석 실행 트리거 (수동) | API Server |
| 파이프라인 진행 상태 모니터링 | API Server (polling or SSE) |
| 분석 결과 시각화 (차트, 테이블, 타임라인) | API Server |
| 팀 멀티유저 접근 제어 | API Server |

**경계 규칙:** Dashboard는 DB에 직접 접근하지 않는다. 모든 데이터는 API를 통해 흐른다.

### 2. API Server

| Responsibility | Communicates With |
|----------------|-------------------|
| 인증/인가 (팀 멤버 관리) | PostgreSQL |
| 분석 작업 CRUD (생성, 조회, 삭제) | PostgreSQL |
| 파이프라인 실행 명령 발행 | BullMQ (Job Queue) |
| 작업 진행 상태 조회 | BullMQ + PostgreSQL |
| 분석 결과 데이터 제공 | PostgreSQL |

**경계 규칙:** API Server는 수집/분석 로직을 직접 실행하지 않는다. Job Queue에 작업을 넣고 Worker가 처리한다.

### 3. Pipeline Orchestrator (BullMQ)

| Responsibility | Communicates With |
|----------------|-------------------|
| 파이프라인 단계별 잡 생성/관리 | Redis |
| 잡 간 의존성 관리 (parent-child) | Redis |
| 재시도 로직 (exponential backoff) | Redis |
| Worker 부하 분산 | Workers |
| 진행 상태 이벤트 발행 | API Server (via QueueEvents) |

**핵심 설계:** BullMQ의 parent-child job 관계를 활용하여 파이프라인 DAG를 구성한다.

```
Analysis Job (parent)
  ├── Collection Job: Naver News (child)
  ├── Collection Job: YouTube (child)
  ├── Collection Job: X/Twitter (child)
  ├── Collection Job: DC Gallery (child)
  ├── Collection Job: FM Korea (child)
  └── Collection Job: Clien (child)
      │
      └── (all children complete)
          │
          ├── Processing Job: Normalize & Deduplicate
          │
          └── (processing complete)
              │
              ├── Analysis Job: Macro View (Module 1)
              ├── Analysis Job: Segmentation (Module 2)
              ├── Analysis Job: Sentiment & Framing (Module 3)
              ├── Analysis Job: Message Impact (Module 4)
              ├── Analysis Job: Risk Map (Module 5)
              ├── Analysis Job: Opportunity (Module 6)
              │
              └── (core analysis complete)
                  │
                  ├── Analysis Job: Strategy (Module 7) -- depends on 1-6
                  ├── Analysis Job: AI Polling (Ext 1) -- depends on 1-3
                  ├── Analysis Job: Frame Battle (Ext 2) -- depends on 3
                  ├── Analysis Job: Crisis Sim (Ext 3) -- depends on 5
                  ├── Analysis Job: Win Probability (Ext 4) -- depends on 1-6
                  │
                  └── Report Job: Final Summary (Module 8) -- depends on all
```

### 4. Collectors (Data Collection Layer)

각 소스별 독립 모듈로 구성. 새 소스 추가가 기존 코드에 영향을 주지 않는 플러그인 구조.

| Collector | Method | Rate Limiting | Notes |
|-----------|--------|---------------|-------|
| **Naver News** | Scraping (Cheerio/Playwright) | 요청 간 딜레이, robots.txt 준수 | 기사 본문 + 댓글 |
| **YouTube** | YouTube Data API v3 | API 쿼터 관리 (10,000 units/day) | 영상 메타 + 댓글 |
| **X (Twitter)** | X API v2 | Rate limit 준수 | 트윗 + 반응 |
| **DC Gallery** | Scraping (Playwright) | 딜레이, UA rotation | 게시글 + 댓글 |
| **FM Korea** | Scraping (Playwright) | 딜레이, UA rotation | 게시글 + 댓글 |
| **Clien** | Scraping (Cheerio) | 딜레이 | 게시글 + 댓글 |

**인터페이스 규칙:** 모든 Collector는 동일한 인터페이스를 구현한다.

```typescript
interface Collector {
  source: SourceType;
  collect(params: CollectionParams): Promise<RawDocument[]>;
}

interface RawDocument {
  source: SourceType;
  sourceId: string;
  type: 'article' | 'comment' | 'post' | 'tweet' | 'video';
  title?: string;
  content: string;
  author?: string;
  publishedAt: Date;
  metadata: Record<string, unknown>; // 소스별 추가 데이터
  engagements?: { likes?: number; shares?: number; comments?: number };
}
```

### 5. Processor (Data Processing Layer)

| Responsibility | Details |
|----------------|---------|
| 정규화(Normalization) | RawDocument -> NormalizedDocument 변환 |
| 중복 제거(Deduplication) | content hash 기반 중복 필터링 |
| 텍스트 정제(Cleaning) | HTML 태그 제거, 이모지 처리, 욕설 마스킹 |
| 메타데이터 보강(Enrichment) | 날짜 정규화, 소스 분류 태깅 |
| 배치 구성(Batching) | AI 분석을 위한 적절한 크기로 문서 배치 구성 |

**핵심 설계:** Processor는 stateless pure function으로 구현한다. 동일 입력에 동일 출력을 보장한다.

### 6. Analyzers (AI Analysis Layer)

8개 분석 모듈 + 4개 추가 기능을 독립 Analyzer로 구현. prompt.md의 분석 항목과 1:1 대응.

```typescript
interface Analyzer {
  moduleId: string;
  name: string;
  dependsOn: string[]; // 선행 모듈 ID
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
}

interface AnalysisInput {
  targetPerson: PersonInfo;
  documents: NormalizedDocument[];
  previousResults?: Record<string, AnalysisResult>; // 선행 분석 결과
  modelConfig: ModelConfig; // 사용할 AI 모델 설정
}

interface ModelConfig {
  provider: 'anthropic' | 'openai';
  model: string;
  maxTokens: number;
  temperature: number;
}
```

**모델 라우팅 전략:**

| Module | Recommended Model | Rationale |
|--------|-------------------|-----------|
| Macro View, Segmentation | Claude (Sonnet) | 긴 문맥 이해, 구조화 능력 |
| Sentiment & Framing | GPT-4o | 한국어 감정 분석 강점 |
| Risk/Opportunity | Claude (Sonnet) | 분석적 추론 |
| Strategy, Win Probability | Claude (Opus) | 복잡한 전략적 사고 |
| AI Polling Simulation | Claude (Sonnet) | 정량적 추론 |

**주의:** 모델 선택은 실제 테스트 후 조정해야 한다. 위 권장 사항은 LOW confidence이며 벤치마크 필요.

### 7. Storage (PostgreSQL)

```
┌─────────────────────────────────────────────────┐
│ PostgreSQL (192.168.0.5)                        │
│                                                 │
│  ┌─────────────┐  ┌──────────────┐              │
│  │ targets     │  │ analysis_jobs│              │
│  │ (분석 대상)  │  │ (작업 관리)   │              │
│  └──────┬──────┘  └──────┬───────┘              │
│         │                │                      │
│  ┌──────┴──────┐  ┌──────┴───────┐              │
│  │ raw_docs    │  │ analysis_    │              │
│  │ (수집 원본)  │  │ results      │              │
│  │             │  │ (분석 결과)   │              │
│  └──────┬──────┘  └──────────────┘              │
│         │                                       │
│  ┌──────┴──────┐                                │
│  │ normalized_ │                                │
│  │ docs        │                                │
│  │ (정제 데이터) │                                │
│  └─────────────┘                                │
└─────────────────────────────────────────────────┘
```

**PostgreSQL을 선택하는 이유 (MongoDB 대비):**
- 분석 결과가 구조화된 테이블 형태 (감정 비율, 지지율 등 정량 데이터)
- 시계열 쿼리 (여론 추이 분석)에 PostgreSQL이 유리
- JSONB 컬럼으로 비정형 메타데이터도 유연하게 저장 가능
- 운영 서버에 이미 PostgreSQL 인스턴스 운영 중 (news-postgres)
- Drizzle ORM + PostgreSQL 조합이 TypeScript 생태계에서 가장 성숙

## Data Flow

### Full Pipeline Flow

```
1. TRIGGER
   User clicks "분석 실행" on Dashboard
   → API receives: { targetPerson, keywords, dateRange, sources }

2. JOB CREATION
   API creates analysis_job record in DB (status: 'queued')
   API enqueues parent job to BullMQ

3. COLLECTION (parallel)
   BullMQ spawns child jobs per source
   Each Collector fetches data → saves RawDocument[] to DB
   Progress: 0% → 40%

4. PROCESSING (sequential)
   Processor reads RawDocuments from DB
   Normalizes, deduplicates, cleans
   Saves NormalizedDocument[] to DB
   Batches documents for AI analysis
   Progress: 40% → 50%

5. CORE ANALYSIS (parallel where possible)
   Modules 1-6 run in parallel (independent)
   Each reads NormalizedDocuments + sends to AI API
   Saves AnalysisResult per module to DB
   Progress: 50% → 80%

6. DERIVED ANALYSIS (parallel, depends on core)
   Module 7 (Strategy) + Extensions 1-4 run
   Read previous AnalysisResults as context
   Progress: 80% → 95%

7. REPORT GENERATION
   Module 8 (Final Summary) synthesizes all results
   Generates final structured report
   Updates job status to 'completed'
   Progress: 95% → 100%

8. NOTIFICATION
   Dashboard receives completion event (SSE/polling)
   User views full analysis report
```

### Data Size Estimates (Per Analysis Run)

| Stage | Volume | Storage |
|-------|--------|---------|
| Raw collection | 500-5,000 documents | ~5-50 MB |
| Normalized | 300-3,000 documents (deduped) | ~3-30 MB |
| AI API calls | 10-30 calls (batched) | N/A |
| Analysis results | 12 modules x 1 result | ~500 KB JSON |
| Total per run | - | ~10-80 MB |

## Patterns to Follow

### Pattern 1: Plugin-Based Collector Registry

**What:** 각 데이터 소스를 독립 플러그인으로 등록하는 패턴
**When:** 새로운 수집 소스 추가 시
**Why:** 소스 추가/제거가 기존 코드에 영향 없음

```typescript
// src/collectors/registry.ts
const collectors = new Map<SourceType, Collector>();

export function registerCollector(collector: Collector) {
  collectors.set(collector.source, collector);
}

export function getCollector(source: SourceType): Collector {
  const collector = collectors.get(source);
  if (!collector) throw new Error(`No collector for source: ${source}`);
  return collector;
}

// src/collectors/naver-news.ts
registerCollector({
  source: 'naver-news',
  async collect(params) { /* ... */ }
});
```

### Pattern 2: Analysis Module Chain with Dependency Resolution

**What:** 분석 모듈 간 의존성을 선언적으로 정의하고, 실행 순서를 자동 결정
**When:** 분석 파이프라인 실행 시

```typescript
// 모듈 의존성 그래프
const MODULE_DEPS: Record<string, string[]> = {
  'macro-view': [],
  'segmentation': [],
  'sentiment-framing': [],
  'message-impact': [],
  'risk-map': [],
  'opportunity': [],
  'strategy': ['macro-view', 'segmentation', 'sentiment-framing',
               'message-impact', 'risk-map', 'opportunity'],
  'ai-polling': ['macro-view', 'segmentation', 'sentiment-framing'],
  'frame-battle': ['sentiment-framing'],
  'crisis-sim': ['risk-map'],
  'win-probability': ['macro-view', 'segmentation', 'sentiment-framing',
                       'message-impact', 'risk-map', 'opportunity'],
  'final-summary': ['strategy', 'ai-polling', 'frame-battle',
                     'crisis-sim', 'win-probability'],
};
```

### Pattern 3: Token Budget Management

**What:** AI API 호출 시 토큰 사용량을 추적하고 예산 초과를 방지
**When:** 모든 AI 분석 호출 시

```typescript
interface TokenBudget {
  maxInputTokens: number;
  maxOutputTokens: number;
  used: { input: number; output: number };
  estimatedCost: number;
}

// 분석 실행 전 비용 추정 → 사용자 확인 → 실행
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Pipeline Function

**What:** 수집-처리-분석을 하나의 거대한 함수에서 순차 실행
**Why bad:** 중간 실패 시 처음부터 재실행, 병렬화 불가, 진행 상태 추적 불가
**Instead:** BullMQ Job 단위로 분리하여 각 단계를 독립적으로 실행/재시도

### Anti-Pattern 2: AI API Direct Coupling

**What:** 각 분석 모듈이 직접 anthropic/openai SDK를 import하여 호출
**Why bad:** 모델 교체 시 모든 모듈 수정 필요, 토큰 추적 분산
**Instead:** AI Gateway 레이어를 두어 모든 AI 호출을 중앙에서 관리

```typescript
// Bad
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();
await client.messages.create({ ... });

// Good
import { aiGateway } from '@/shared/ai/gateway';
await aiGateway.analyze({
  moduleId: 'sentiment-framing',
  prompt: analysisPrompt,
  modelPreference: 'claude-sonnet',
});
```

### Anti-Pattern 3: Scraping Without Resilience

**What:** 스크래핑 실패 시 전체 파이프라인 중단
**Why bad:** 외부 사이트 구조 변경, 차단 등으로 빈번하게 실패 가능
**Instead:** 각 소스 수집을 독립 Job으로 실행, 부분 실패 허용, 사용 가능한 데이터로 분석 진행

### Anti-Pattern 4: Storing Raw HTML in DB

**What:** 스크래핑한 HTML 원본을 DB에 그대로 저장
**Why bad:** 저장 공간 낭비, 쿼리 불가, 재파싱 필요
**Instead:** 수집 시점에 구조화된 데이터로 변환하여 저장. 디버깅 필요 시 파일시스템에 HTML 캐시.

## Scalability Considerations

| Concern | 3-10 Users (MVP) | 50+ Users | 100+ Concurrent Analyses |
|---------|-------------------|-----------|--------------------------|
| API Server | 단일 Next.js 인스턴스 | PM2 cluster mode | Kubernetes + Load Balancer |
| Job Queue | 단일 Redis 인스턴스 | Redis Sentinel | Redis Cluster |
| DB | 단일 PostgreSQL | Read replica 추가 | Connection pooling (PgBouncer) |
| AI API | 순차 호출, 기본 rate limit | 병렬 호출, 큐잉 | API key rotation, 멀티 계정 |
| Worker | 단일 프로세스 | 복수 Worker 프로세스 | 분산 Worker (별도 서버) |

**MVP 단계에서는 단일 서버(192.168.0.5)로 충분하다.** 3-10명 팀의 수동 트리거 분석이므로 동시 분석 실행은 1-3건 이내로 예상.

## Suggested Build Order

컴포넌트 간 의존성을 기반으로 한 빌드 순서:

```
Phase 1: Foundation
  ├── PostgreSQL schema + Drizzle ORM setup
  ├── Project scaffolding (Next.js + monorepo)
  └── BullMQ + Redis setup

Phase 2: Collection Layer
  ├── Collector interface definition
  ├── 1-2 Collector 구현 (Naver News + YouTube)
  └── Raw data storage

Phase 3: Processing Layer
  ├── Normalizer implementation
  ├── Deduplication logic
  └── Batch composition

Phase 4: Analysis Layer
  ├── AI Gateway (model routing, token tracking)
  ├── Core modules (1-6, parallel)
  └── Derived modules (7, Ext 1-4)

Phase 5: API + Dashboard
  ├── API endpoints (job CRUD, results)
  ├── Dashboard UI (trigger, status, results)
  └── Auth (team multi-user)

Phase 6: Polish
  ├── Remaining collectors (X, DC, FM, Clien)
  ├── Cost tracking dashboard
  └── Error handling & monitoring
```

**의존성 근거:**
- Storage가 먼저 있어야 수집 데이터를 저장할 수 있다
- Collection이 있어야 Processing을 테스트할 수 있다
- Processing이 있어야 Analysis에 정제된 데이터를 제공할 수 있다
- Analysis가 있어야 Dashboard에 보여줄 결과가 있다
- 그러나 Dashboard와 API는 Mock 데이터로 병렬 개발 가능

## Directory Structure (FSD-based)

```
src/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Dashboard pages
│   ├── api/                      # API routes
│   └── layout.tsx
├── widgets/
│   ├── analysis-dashboard/       # 분석 결과 대시보드
│   ├── pipeline-monitor/         # 파이프라인 상태 모니터
│   └── target-manager/           # 분석 대상 관리
├── features/
│   ├── analysis-trigger/         # 분석 실행 트리거
│   ├── result-viewer/            # 결과 뷰어
│   └── auth/                     # 인증
├── entities/
│   ├── target/                   # 분석 대상 (인물)
│   ├── analysis-job/             # 분석 작업
│   ├── document/                 # 수집 문서
│   └── analysis-result/          # 분석 결과
├── shared/
│   ├── ai/                       # AI Gateway
│   ├── db/                       # Drizzle ORM config + schema
│   ├── queue/                    # BullMQ config
│   ├── ui/                       # 공통 UI (shadcn/ui)
│   └── lib/                      # 유틸리티
├── pipeline/                     # 파이프라인 전용 (FSD 외부)
│   ├── collectors/               # 소스별 수집기
│   │   ├── naver-news.ts
│   │   ├── youtube.ts
│   │   ├── twitter.ts
│   │   ├── dc-gallery.ts
│   │   ├── fmkorea.ts
│   │   ├── clien.ts
│   │   └── registry.ts
│   ├── processors/               # 데이터 처리기
│   │   ├── normalizer.ts
│   │   ├── deduplicator.ts
│   │   └── batcher.ts
│   ├── analyzers/                # AI 분석 모듈
│   │   ├── macro-view.ts
│   │   ├── segmentation.ts
│   │   ├── sentiment-framing.ts
│   │   ├── message-impact.ts
│   │   ├── risk-map.ts
│   │   ├── opportunity.ts
│   │   ├── strategy.ts
│   │   ├── ai-polling.ts
│   │   ├── frame-battle.ts
│   │   ├── crisis-sim.ts
│   │   ├── win-probability.ts
│   │   ├── final-summary.ts
│   │   └── registry.ts
│   └── orchestrator.ts           # BullMQ pipeline DAG
└── workers/                      # BullMQ Worker 프로세스
    ├── collection-worker.ts
    ├── processing-worker.ts
    └── analysis-worker.ts
```

**FSD 예외:** `pipeline/`과 `workers/`는 FSD 레이어 외부에 배치한다. 이들은 백엔드 파이프라인 로직으로, UI 레이어 구조(FSD)와 관심사가 다르다. `shared/` 레이어의 AI Gateway, DB, Queue 설정은 공유한다.

## Sources

- [LLM Agents Pipeline for Public Opinion Analysis (arxiv)](https://arxiv.org/abs/2505.11401) - Agentic pipeline architecture reference (MEDIUM confidence)
- [BullMQ Documentation](https://docs.bullmq.io/) - Job queue orchestration (HIGH confidence)
- [Social Media Sentiment Analysis Pipeline](http://kwatch.io/how-to-build-a-social-media-sentiment-analysis-pipeline) - Pipeline component patterns (MEDIUM confidence)
- [Framework for Social Listening Data](https://www.researchgate.net/publication/392742376_A_Framework_for_Integrating_Social_Listening_Data_into_Brand_Sentiment_Analytics) - Architecture components (MEDIUM confidence)
- [TypeScript Web Scraping Guide](https://scrapfly.io/blog/posts/ultimate-intro-to-web-scraping-with-typescript) - Collector patterns (HIGH confidence)
- [Real-Time Sentiment Analysis Pipeline](https://www.simform.com/blog/how-to-build-a-real-time-social-media-sentiment-analysis-data-pipeline/) - Data flow patterns (MEDIUM confidence)
