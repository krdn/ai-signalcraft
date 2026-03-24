# Phase 1: Foundation + Core Data Collection - Research

**Researched:** 2026-03-24
**Domain:** pnpm monorepo scaffolding, PostgreSQL + Drizzle ORM, BullMQ pipeline, Naver news scraping, YouTube Data API, AI SDK gateway
**Confidence:** HIGH

## Summary

Phase 1은 빈 프로젝트에서 시작하여 인프라(모노리포, DB, 큐)를 구축하고 네이버 뉴스 + 유튜브 2개 소스에서 데이터를 수집하는 파이프라인을 완성한다. 운영 서버(192.168.0.5)에 이미 `ais-postgres` 컨테이너(포트 5436, DB명 `ai_afterschool`)가 존재하므로 이를 재활용하거나 재설정해야 한다. Redis는 기존 6380/6381/6382 포트가 사용 중이므로 새 인스턴스가 필요하다(6383 추천).

기술 스택은 CLAUDE.md에 확정되어 있으며, 핵심은 Next.js 15 + Drizzle ORM + BullMQ + Playwright/Cheerio(네이버) + googleapis(유튜브) + AI SDK v6(게이트웨이)이다. 네이버 뉴스 댓글 수집은 비공식 API(`apis.naver.com/commentBox/cbox/web_naver_list_jsonp.json`)를 사용하며 referer 헤더가 필수이다. YouTube commentThreads.list는 쿼터 1단위/요청으로 효율적이나 일일 10,000 단위 기본 한도를 관리해야 한다.

**Primary recommendation:** pnpm workspace 모노리포(apps/web + packages/core + packages/collectors)로 구조화하고, Adapter Pattern으로 수집기를 추상화한 뒤 BullMQ Flow로 3단계(collect -> normalize -> persist) 파이프라인을 구성한다.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 통합 키워드 수집 -- 키워드 1개 입력 시 모든 활성 소스(네이버 뉴스 + 유튜브)에서 동시 수집 실행
- **D-02:** 수집 기간은 사용자 지정 -- 트리거 시 시작일~종료일 직접 입력, 기본값은 최근 7일
- **D-03:** 소스별 기본 상한 설정 -- 뉴스 기사 100건, 유튜브 영상 50건, 댓글 각 500개 등 기본값 제공. 트리거 시 조정 가능
- **D-04:** 부분 실패 허용 -- 소스별 독립 실행하여 유튜브가 실패해도 네이버 결과는 저장. 실패한 소스는 상태에 표시하고 개별 재시도 가능
- **D-05:** 3단계 분리 -- 수집(collect) -> 전처리(normalize + 중복제거) -> 저장(persist). BullMQ Flow로 부모-자식 작업 연결
- **D-06:** 소스별 상세 추적 -- 전체 진행률 + 소스별(네이버/유튜브) 상태 + 수집 건수 실시간 추적
- **D-07:** URL/ID 기반 중복 제거 -- 기사 URL, 유튜브 댓글 ID 등 고유값으로 중복 판단. DB upsert로 처리

### Claude's Discretion
- 모노리포 패키지 구조 (apps/packages 분리 방식)
- DB 스키마 세부 설계 (JSONB vs 정규화 비율)
- Adapter Pattern 수집기 인터페이스 세부 설계
- BullMQ 재시도 횟수/간격 등 세부 설정

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | 프로젝트 스캐폴딩 (Next.js + TypeScript 모노리포 구조) | pnpm workspace + apps/packages 구조, Next.js 16.2.1 확인 |
| FOUND-02 | PostgreSQL 스키마 설계 및 운영 서버 DB 구성 | Drizzle ORM 0.45.1, 운영서버 ais-postgres(5436) 존재 확인 |
| FOUND-03 | BullMQ 기반 파이프라인 오케스트레이터 | BullMQ 5.71.0 FlowProducer 패턴 조사 완료 |
| FOUND-04 | AI Gateway 추상화 레이어 | AI SDK v6 (6.0.137) generateText + Output.object() 패턴 |
| COLL-01 | 네이버 뉴스 기사 수집기 | Playwright + Cheerio 조합, 네이버 검색 URL 파라미터 구조 확인 |
| COLL-02 | 네이버 뉴스 댓글 수집기 | apis.naver.com 비공식 API 엔드포인트 + referer 헤더 필수 확인 |
| COLL-03 | 유튜브 영상 메타데이터 수집기 | googleapis 171.4.0, search.list(쿼터 100) + videos.list(쿼터 1) |
| COLL-04 | 유튜브 댓글 수집기 | commentThreads.list(쿼터 1), maxResults 100, pageToken 페이지네이션 |
| COLL-09 | Adapter Pattern 기반 수집기 공통 인터페이스 | TypeScript interface 설계 패턴 제안 |
| COLL-10 | 수집 데이터 정규화 및 중복 제거 파이프라인 | DB upsert + unique constraint 패턴 |
</phase_requirements>

## Standard Stack

### Core (CLAUDE.md 확정 -- 변경 불가)

| Library | Verified Version | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| Next.js | 16.2.1 (npm latest) | 풀스택 프레임워크 | App Router + Server Components. CLAUDE.md에 15.x로 명시되어 있으나 npm 최신은 16.x -- 프로젝트 시작이므로 16.x 사용 권장 |
| TypeScript | 5.x | 타입 안전성 | 전체 스택 통일 |
| Drizzle ORM | 0.45.1 | TypeScript ORM | SQL-like 쿼리 빌더, identity column 지원 |
| drizzle-kit | latest | 마이그레이션 도구 | Drizzle ORM 공식 CLI |
| BullMQ | 5.71.0 | 작업 큐 | Redis 기반, Flow(부모-자식) 지원 |
| Playwright | 1.58.2 | 브라우저 스크래핑 | 네이버 뉴스 JS 렌더링 대응 |
| Cheerio | 1.2.0 | HTML 파싱 | Playwright HTML 경량 파싱 |
| googleapis | 171.4.0 | YouTube Data API | 공식 Google API 클라이언트 |
| ai (AI SDK) | 6.0.137 | AI 모델 통합 | generateText + Output.object() |
| @ai-sdk/anthropic | 3.0.63 | Claude 프로바이더 | AI SDK v6 공식 |
| @ai-sdk/openai | 3.0.48 | GPT 프로바이더 | AI SDK v6 공식 |
| Zod | 4.3.6 | 스키마 검증 | AI SDK + Drizzle 통합 |
| ioredis | latest | Redis 클라이언트 | BullMQ 의존성 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | latest | 환경변수 로딩 | 로컬 개발 시 |
| pg | latest | PostgreSQL 드라이버 | Drizzle 커넥션 |
| kiwi-nlp | 0.23.0 | 한국어 형태소 분석 | Phase 2 분석에서 사용하지만 Phase 1 스키마 설계 시 고려 |

**IMPORTANT -- Next.js 버전 결정:**
CLAUDE.md에 15.x로 명시되어 있으나 npm latest는 16.2.1이다. 새 프로젝트이므로 16.x를 사용하는 것이 합리적이나, CLAUDE.md 수정이 필요하다. 플래너는 이 결정을 명시해야 한다.

**Installation:**
```bash
# apps/web
pnpm add next@latest react@latest react-dom@latest

# packages/core (DB + queue)
pnpm add drizzle-orm pg ioredis bullmq zod
pnpm add -D drizzle-kit @types/pg typescript

# packages/collectors
pnpm add playwright cheerio googleapis

# packages/ai-gateway (Phase 1에서 기본 구조만)
pnpm add ai @ai-sdk/anthropic @ai-sdk/openai zod
```

## Architecture Patterns

### Recommended Monorepo Structure

```
ai-signalcraft/
├── pnpm-workspace.yaml
├── package.json                    # root scripts
├── tsconfig.base.json              # shared TS config
├── .env.example
├── apps/
│   └── web/                        # Next.js App (Phase 3 대시보드)
│       ├── package.json
│       ├── next.config.ts
│       └── src/
│           └── app/                # App Router
├── packages/
│   ├── core/                       # DB 스키마, 공통 타입, 유틸
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── schema/         # Drizzle 스키마 파일들
│   │   │   │   ├── migrations/     # drizzle-kit 마이그레이션
│   │   │   │   └── index.ts        # DB 클라이언트 export
│   │   │   ├── queue/
│   │   │   │   ├── flows.ts        # FlowProducer 정의
│   │   │   │   ├── workers.ts      # Worker 정의
│   │   │   │   └── index.ts
│   │   │   └── types/              # 공유 타입/인터페이스
│   │   └── drizzle.config.ts
│   ├── collectors/                  # 수집기 패키지
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── adapters/           # Adapter 인터페이스 + 구현체
│   │   │   │   ├── base.ts         # BaseCollector interface
│   │   │   │   ├── naver-news.ts   # 네이버 뉴스 기사
│   │   │   │   ├── naver-comments.ts # 네이버 댓글
│   │   │   │   ├── youtube-videos.ts
│   │   │   │   └── youtube-comments.ts
│   │   │   ├── normalizers/        # 데이터 정규화
│   │   │   └── index.ts
│   └── ai-gateway/                 # AI SDK 추상화 (Phase 1 골격만)
│       ├── package.json
│       └── src/
│           └── index.ts
├── docker/
│   ├── docker-compose.dev.yml      # 로컬 개발용
│   └── docker-compose.prod.yml     # 운영 서버용
└── scripts/
    └── seed.ts                     # DB 시드 스크립트
```

### Pattern 1: Collector Adapter Interface

**What:** 모든 수집기가 구현하는 공통 인터페이스
**When to use:** 새 소스 추가 시 이 인터페이스 구현

```typescript
// packages/collectors/src/adapters/base.ts
import { z } from 'zod';

export const CollectionOptionsSchema = z.object({
  keyword: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  maxItems: z.number().optional(),
  maxComments: z.number().optional(),
});
export type CollectionOptions = z.infer<typeof CollectionOptionsSchema>;

export interface CollectionResult<T> {
  source: string;
  items: T[];
  totalCollected: number;
  errors: Error[];
  metadata: {
    startedAt: Date;
    completedAt: Date;
    pagesFetched: number;
  };
}

export interface Collector<T> {
  readonly source: string;
  collect(options: CollectionOptions): AsyncGenerator<T[], void, unknown>;
  // AsyncGenerator로 청크 단위 yield -- 메모리 효율 + 진행률 추적
}
```

### Pattern 2: BullMQ Flow Pipeline (D-05)

**What:** 3단계 파이프라인을 BullMQ Flow로 구현
**When to use:** 키워드 수집 트리거 시

```typescript
// packages/core/src/queue/flows.ts
import { FlowProducer } from 'bullmq';

const flowProducer = new FlowProducer({ connection: redisConnection });

// D-01: 통합 키워드 수집
export async function triggerCollection(params: {
  keyword: string;
  startDate: string;
  endDate: string;
  limits?: { naverArticles?: number; youtubeVideos?: number; comments?: number };
}) {
  const jobId = `collection-${Date.now()}`;

  // 부모: persist (최종 저장)
  // 자식: normalize (각 소스별)
  // 손자: collect (각 소스별)
  const flow = await flowProducer.add({
    name: 'persist',
    queueName: 'pipeline',
    data: { jobId, keyword: params.keyword },
    children: [
      {
        name: 'normalize-naver',
        queueName: 'pipeline',
        data: { source: 'naver-news', jobId },
        children: [
          {
            name: 'collect-naver-articles',
            queueName: 'collectors',
            data: { ...params, source: 'naver-news' },
          },
          {
            name: 'collect-naver-comments',
            queueName: 'collectors',
            data: { ...params, source: 'naver-comments' },
          },
        ],
      },
      {
        name: 'normalize-youtube',
        queueName: 'pipeline',
        data: { source: 'youtube', jobId },
        children: [
          {
            name: 'collect-youtube-videos',
            queueName: 'collectors',
            data: { ...params, source: 'youtube-videos' },
          },
          {
            name: 'collect-youtube-comments',
            queueName: 'collectors',
            data: { ...params, source: 'youtube-comments' },
          },
        ],
      },
    ],
  });

  return flow;
}
```

### Pattern 3: DB Schema Design (Drizzle + PostgreSQL)

**What:** 정규화된 수집 데이터 스키마
**When to use:** 모든 수집 데이터 저장

```typescript
// packages/core/src/db/schema/collections.ts
import { pgTable, text, timestamp, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

// 수집 작업 (D-06 상태 추적)
export const collectionJobs = pgTable('collection_jobs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  keyword: text('keyword').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'partial_failure', 'failed'] }).notNull().default('pending'),
  progress: jsonb('progress').$type<{
    naver: { status: string; articles: number; comments: number };
    youtube: { status: string; videos: number; comments: number };
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 뉴스 기사
export const articles = pgTable('articles', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer('job_id').references(() => collectionJobs.id),
  source: text('source').notNull(), // 'naver-news'
  sourceId: text('source_id').notNull(), // 기사 고유 ID (oid+aid)
  url: text('url').notNull(),
  title: text('title').notNull(),
  content: text('content'),
  author: text('author'),
  publisher: text('publisher'),
  publishedAt: timestamp('published_at'),
  rawData: jsonb('raw_data'), // 원본 HTML 메타데이터 등
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('articles_source_id_idx').on(table.source, table.sourceId), // D-07 중복 제거
]);

// 영상 (유튜브)
export const videos = pgTable('videos', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer('job_id').references(() => collectionJobs.id),
  source: text('source').notNull(), // 'youtube'
  sourceId: text('source_id').notNull(), // videoId
  url: text('url').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  channelId: text('channel_id'),
  channelTitle: text('channel_title'),
  viewCount: integer('view_count'),
  likeCount: integer('like_count'),
  commentCount: integer('comment_count'),
  publishedAt: timestamp('published_at'),
  rawData: jsonb('raw_data'),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('videos_source_id_idx').on(table.source, table.sourceId),
]);

// 댓글 (네이버 + 유튜브 통합)
export const comments = pgTable('comments', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer('job_id').references(() => collectionJobs.id),
  source: text('source').notNull(), // 'naver-news', 'youtube'
  sourceId: text('source_id').notNull(), // 댓글 고유 ID
  parentId: text('parent_id'), // 대댓글인 경우
  articleId: integer('article_id').references(() => articles.id),
  videoId: integer('video_id').references(() => videos.id),
  content: text('content').notNull(),
  author: text('author'),
  likeCount: integer('like_count').default(0),
  dislikeCount: integer('dislike_count').default(0),
  publishedAt: timestamp('published_at'),
  rawData: jsonb('raw_data'),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('comments_source_id_idx').on(table.source, table.sourceId), // D-07
]);
```

**JSONB vs 정규화 비율 결정 (Claude's Discretion):**
- 정규화 컬럼: 분석/검색에 자주 사용되는 필드 (title, content, author, publishedAt, likeCount 등)
- JSONB (`rawData`): 소스별 고유 메타데이터, 원본 데이터 보존용
- 비율: 약 80% 정규화 / 20% JSONB. 분석 쿼리 성능을 위해 정규화 우선

### Anti-Patterns to Avoid
- **단일 패키지에 모든 코드:** 수집기, DB, 큐를 한 패키지에 넣으면 의존성이 엉킴. packages/ 분리 필수
- **Playwright를 모든 네이버 요청에 사용:** 뉴스 검색 결과 페이지만 Playwright, 댓글 API는 단순 fetch로 충분
- **BullMQ Worker를 Next.js 서버에 내장:** Worker는 별도 프로세스로 실행해야 함. Next.js API Route에서는 FlowProducer만 호출
- **동기적 전체 수집 후 저장:** AsyncGenerator로 청크 단위 yield + 저장하여 메모리 효율 확보

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 작업 큐/재시도 | 커스텀 큐 시스템 | BullMQ | 재시도, 지연, 우선순위, Flow 모두 내장 |
| DB 마이그레이션 | 수동 SQL 파일 관리 | drizzle-kit | `drizzle-kit push/generate/migrate` |
| YouTube API 인증 | 직접 OAuth 구현 | googleapis | 공식 클라이언트가 인증/쿼터 관리 |
| HTML 파싱 | regex로 HTML 파싱 | Cheerio | DOM 쿼리 API로 안정적 추출 |
| 브라우저 자동화 | 직접 CDP 구현 | Playwright | auto-wait, 안티봇 우회 내장 |
| AI 모델 라우팅 | 프로바이더별 SDK 직접 호출 | AI SDK v6 | 단일 API로 모델 전환, Output.object() 구조화 |

## Common Pitfalls

### Pitfall 1: 네이버 뉴스 댓글 API 차단
**What goes wrong:** referer 헤더 없이 요청하면 error code 3999 반환
**Why it happens:** 네이버가 비공식 API에 referer 검증을 적용
**How to avoid:** 모든 댓글 API 요청에 `Referer: https://n.news.naver.com/article/comment/{oid}/{aid}` 헤더 필수. User-Agent도 브라우저와 동일하게 설정
**Warning signs:** 응답에 `error` 필드가 있거나 빈 `result` 반환

### Pitfall 2: 네이버 IP 차단 (Rate Limiting)
**What goes wrong:** 짧은 간격으로 대량 요청 시 IP 차단
**Why it happens:** 네이버 anti-bot 시스템
**How to avoid:** 요청 간 1-3초 딜레이. BullMQ의 rateLimiter 옵션 활용. 수집 상한(D-03) 준수
**Warning signs:** HTTP 403 또는 CAPTCHA 페이지 반환

### Pitfall 3: YouTube API 쿼터 소진
**What goes wrong:** 일일 10,000 유닛 한도 도달 시 모든 API 호출 실패
**Why it happens:** search.list가 100유닛/요청으로 비쌈 (commentThreads.list는 1유닛)
**How to avoid:** search.list 호출 최소화. 가능하면 채널의 uploads playlist로 영상 목록 조회(playlistItems.list = 1유닛). 쿼터 사용량 추적 로직 구현
**Warning signs:** HTTP 403 `quotaExceeded` 에러

### Pitfall 4: BullMQ Worker와 Next.js 프로세스 혼합
**What goes wrong:** Next.js hot-reload 시 Worker가 중복 생성되거나 죽음
**Why it happens:** Next.js dev 서버는 모듈을 리로드하므로 Worker 인스턴스 관리 불가
**How to avoid:** Worker를 별도 Node.js 프로세스(스크립트)로 실행. `packages/core/src/queue/worker.ts`를 `tsx watch`로 실행
**Warning signs:** 작업이 두 번 처리되거나 "Missing lock" 에러

### Pitfall 5: Drizzle ORM identity column 사용법
**What goes wrong:** `serial()` 대신 `integer().generatedAlwaysAsIdentity()` 사용 시 insert에서 id를 제공하면 에러
**Why it happens:** `generatedAlwaysAsIdentity`는 DB가 항상 생성, 직접 값 지정 불가
**How to avoid:** insert 시 id 필드 제외. `generatedByDefaultAsIdentity()` 사용 시에는 직접 지정 가능
**Warning signs:** PostgreSQL "cannot insert a non-DEFAULT value into column" 에러

### Pitfall 6: 네이버 뉴스 댓글 API objectId 형식
**What goes wrong:** 기사 URL에서 objectId를 잘못 추출하면 빈 결과
**Why it happens:** objectId 형식이 `news{oid},{aid}` (예: `news016,0002042395`)이며 기사 URL 구조에 따라 추출 방식이 다름
**How to avoid:** 기사 URL 파싱 시 oid(언론사 코드)와 aid(기사 번호)를 정확히 추출하는 유틸 함수 작성. URL 패턴: `https://n.news.naver.com/article/{oid}/{aid}`
**Warning signs:** API 응답의 `result.count.comment`가 0인데 실제 기사에 댓글이 있음

## Code Examples

### Naver News Comment API Call

```typescript
// Source: https://seul1230.github.io/blog/네이버뉴스기사댓글수집
// 비공식 API -- 변경될 수 있음 (LOW-MEDIUM confidence)

const NAVER_COMMENT_API = 'https://apis.naver.com/commentBox/cbox/web_naver_list_jsonp.json';

interface NaverCommentParams {
  oid: string;      // 언론사 코드 (예: '016')
  aid: string;      // 기사 번호 (예: '0002042395')
  page: number;
  pageSize: number;  // 1-100
  sort: 'favorite' | 'new' | 'old';
}

async function fetchNaverComments(params: NaverCommentParams) {
  const url = new URL(NAVER_COMMENT_API);
  url.searchParams.set('ticket', 'news');
  url.searchParams.set('pool', 'cbox5');
  url.searchParams.set('lang', 'ko');
  url.searchParams.set('objectId', `news${params.oid},${params.aid}`);
  url.searchParams.set('pageSize', String(params.pageSize));
  url.searchParams.set('page', String(params.page));
  url.searchParams.set('sort', params.sort === 'favorite' ? 'FAVORITE' : params.sort === 'new' ? 'NEW' : 'OLD');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': `https://n.news.naver.com/article/comment/${params.oid}/${params.aid}`,
    },
  });

  // 응답이 JSONP 형태일 수 있으므로 파싱 필요
  const text = await response.text();
  // _callback( {...} ) 형태에서 JSON 추출
  const jsonStr = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '');
  return JSON.parse(jsonStr);
}
```

### YouTube commentThreads.list

```typescript
// Source: https://developers.google.com/youtube/v3/docs/commentThreads/list
import { google } from 'googleapis';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

async function* fetchYoutubeComments(videoId: string, maxComments: number = 500) {
  let pageToken: string | undefined;
  let collected = 0;

  while (collected < maxComments) {
    const response = await youtube.commentThreads.list({
      part: ['snippet', 'replies'],
      videoId,
      maxResults: Math.min(100, maxComments - collected),
      pageToken,
      textFormat: 'plainText',
      order: 'relevance',
    });

    const items = response.data.items ?? [];
    yield items;
    collected += items.length;

    pageToken = response.data.nextPageToken ?? undefined;
    if (!pageToken || items.length === 0) break;
  }
}
```

### BullMQ Worker with Error Handling (D-04)

```typescript
// Source: https://docs.bullmq.io/guide/flows
import { Worker } from 'bullmq';

const collectorWorker = new Worker('collectors', async (job) => {
  const { source, keyword, startDate, endDate } = job.data;

  try {
    // Adapter Pattern으로 소스별 수집기 선택
    const collector = getCollector(source);
    const results = [];

    for await (const chunk of collector.collect({ keyword, startDate: new Date(startDate), endDate: new Date(endDate) })) {
      results.push(...chunk);
      // 진행률 업데이트 (D-06)
      await job.updateProgress({ collected: results.length, source });
    }

    return { source, items: results, count: results.length };
  } catch (error) {
    // D-04: 부분 실패 -- 에러를 반환값에 포함하고 부모가 판단
    return { source, items: [], count: 0, error: (error as Error).message };
  }
}, {
  connection: redisConnection,
  concurrency: 2, // 동시 수집 2개 제한 (네이버 rate limit 고려)
  limiter: { max: 10, duration: 60000 }, // 분당 10 작업
});
```

### AI SDK v6 Gateway (FOUND-04 기본 구조)

```typescript
// Source: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
// packages/ai-gateway/src/index.ts
import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Phase 1에서는 기본 구조만 -- 실제 분석은 Phase 2
export type ModelProvider = 'anthropic' | 'openai';

export function getModel(provider: ModelProvider, modelId?: string) {
  switch (provider) {
    case 'anthropic':
      return anthropic(modelId ?? 'claude-sonnet-4-20250514');
    case 'openai':
      return openai(modelId ?? 'gpt-5.4-mini');
  }
}

// Phase 2에서 사용할 구조화된 출력 예시
export async function analyzeWithSchema<T extends z.ZodType>(
  prompt: string,
  schema: T,
  provider: ModelProvider = 'anthropic',
) {
  const { object } = await generateText({
    model: getModel(provider),
    prompt,
    output: Output.object({ schema }),
  });
  return object;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI SDK generateObject() | generateText() + Output.object() | AI SDK v6 (2026) | generateObject deprecated. 통합 API 사용 |
| Drizzle serial() PK | integer().generatedAlwaysAsIdentity() | Drizzle 0.30+ | PostgreSQL identity column 표준 사용 |
| Prisma | Drizzle ORM | 2024-2025 trend | 더 가벼움, SQL-like, 번들 사이즈 작음 |
| Next.js Pages Router | App Router (Server Components) | Next.js 13+ | 서버 렌더링 기본, 번들 최적화 |
| Bull (v4) | BullMQ (v5) | 2023 | Flow, Worker 분리, TypeScript native |

**Deprecated/outdated:**
- `generateObject()` / `streamObject()`: AI SDK v6에서 deprecated. `generateText()` + `Output.object()` 사용
- `serial()` in Drizzle: `generatedAlwaysAsIdentity()` 또는 `generatedByDefaultAsIdentity()` 권장

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 전체 | OK | v24.14.0 | -- |
| pnpm | 패키지 관리 | OK | 10.28.2 | -- |
| Docker | 컨테이너화 | OK | 27.5.1 | -- |
| PostgreSQL (운영서버) | FOUND-02 | OK | 16.x (ais-postgres, port 5436) | -- |
| Redis (운영서버) | FOUND-03 | 새 인스턴스 필요 | -- | 포트 6383에 새 컨테이너 생성 |
| Playwright CLI | COLL-01 | 미설치 (npx로 설치) | -- | `npx playwright install chromium` |
| YouTube API Key | COLL-03/04 | 미확인 | -- | 환경변수 설정 필요 |
| Naver API | COLL-01/02 | 비공식 API (키 불필요) | -- | -- |

**운영 서버 기존 인프라 상세:**
- `ais-postgres`: 127.0.0.1:5436, DB명 `ai_afterschool`, user `postgres` -- 이미 존재하지만 다른 프로젝트용으로 보임. 재활용 가능 여부 확인 필요. 새 DB를 같은 컨테이너에 CREATE DATABASE로 추가하거나, 전용 컨테이너 생성 가능
- Redis: 6380(news-prod), 6381(미확인), 6382(voice) 사용 중. BullMQ용으로 6383 포트에 새 컨테이너 필요

**Missing dependencies with fallback:**
- Redis: 새 컨테이너 docker-compose로 생성 (Phase 1 첫 Task)

**Missing dependencies requiring setup:**
- YouTube API Key: Google Cloud Console에서 생성 필요 (환경변수 `YOUTUBE_API_KEY`)
- Playwright 브라우저: `npx playwright install chromium` 실행 필요

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | vitest.config.ts (Wave 0에서 생성) |
| Quick run command | `pnpm --filter @ai-signalcraft/core test` |
| Full suite command | `pnpm -r test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | pnpm workspace 빌드 통과 | smoke | `pnpm -r build` | -- Wave 0 |
| FOUND-02 | Drizzle 스키마 + CRUD | integration | `pnpm --filter @ai-signalcraft/core test -- --grep "db"` | -- Wave 0 |
| FOUND-03 | BullMQ flow 생성/실행 | integration | `pnpm --filter @ai-signalcraft/core test -- --grep "queue"` | -- Wave 0 |
| FOUND-04 | AI Gateway 기본 구조 | unit | `pnpm --filter @ai-signalcraft/ai-gateway test` | -- Wave 0 |
| COLL-01 | 네이버 뉴스 기사 수집 | integration | `pnpm --filter @ai-signalcraft/collectors test -- --grep "naver-article"` | -- Wave 0 |
| COLL-02 | 네이버 뉴스 댓글 수집 | integration | `pnpm --filter @ai-signalcraft/collectors test -- --grep "naver-comment"` | -- Wave 0 |
| COLL-03 | 유튜브 영상 수집 | integration | `pnpm --filter @ai-signalcraft/collectors test -- --grep "youtube-video"` | -- Wave 0 |
| COLL-04 | 유튜브 댓글 수집 | integration | `pnpm --filter @ai-signalcraft/collectors test -- --grep "youtube-comment"` | -- Wave 0 |
| COLL-09 | Adapter 인터페이스 | unit | `pnpm --filter @ai-signalcraft/collectors test -- --grep "adapter"` | -- Wave 0 |
| COLL-10 | 중복 제거 파이프라인 | integration | `pnpm --filter @ai-signalcraft/core test -- --grep "dedup"` | -- Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter <affected-package> test`
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/core/vitest.config.ts` -- Vitest 설정
- [ ] `packages/collectors/vitest.config.ts` -- Vitest 설정
- [ ] `packages/core/tests/db.test.ts` -- DB CRUD 테스트
- [ ] `packages/core/tests/queue.test.ts` -- BullMQ flow 테스트
- [ ] `packages/collectors/tests/adapters/` -- 수집기별 테스트
- [ ] Framework install: `pnpm add -D vitest` (root + packages)

## Open Questions

1. **ais-postgres 컨테이너 재사용 여부**
   - What we know: 포트 5436에 `ai_afterschool` DB가 있는 PostgreSQL 16 컨테이너가 이미 존재
   - What's unclear: 이 컨테이너가 다른 활성 프로젝트에서 사용 중인지, 재활용 가능한지
   - Recommendation: 같은 PostgreSQL 인스턴스에 `ai_signalcraft` DB를 CREATE DATABASE로 추가하여 컨테이너 재활용. 격리가 필요하면 새 컨테이너(5438 포트)

2. **네이버 뉴스 댓글 API 안정성**
   - What we know: `apis.naver.com/commentBox/cbox/web_naver_list_jsonp.json` 비공식 API 존재
   - What's unclear: 네이버가 이 API를 언제든 변경/차단할 수 있음
   - Recommendation: API 응답 검증 로직을 강화하고, 실패 시 Playwright fallback 고려. 수집기 테스트에서 실제 API 호출 검증

3. **Next.js 16.x vs 15.x**
   - What we know: CLAUDE.md에 15.x 명시, npm latest는 16.2.1
   - What's unclear: 16.x breaking changes가 스택 호환성에 영향을 주는지
   - Recommendation: 새 프로젝트이므로 16.x 사용. CLAUDE.md 업데이트 필요

## Project Constraints (from CLAUDE.md)

- **패키지 매니저:** pnpm 사용 (bun 보조)
- **인프라:** 운영 서버(192.168.0.5) PostgreSQL/Redis 활용
- **기술 스택:** CLAUDE.md에 명시된 스택 고정 (대안 검토 불필요)
- **API 비용:** AI API 호출 비용 관리 -- 분석 단위별 토큰 최적화
- **법적:** 스크래핑 대상 사이트 robots.txt 및 이용약관 준수
- **커밋 컨벤션:** 한국어 커밋 메시지, `feat:`, `fix:` 등 영어 타입
- **보안:** API 키 하드코딩 금지, .env 커밋 금지
- **FSD 아키텍처:** 이 프로젝트는 10+ 페이지, 다중 도메인이므로 FSD 적용 대상. 하지만 Phase 1은 백엔드 파이프라인 중심이므로 Phase 3(대시보드)에서 FSD 적용
- **GSD Workflow:** Edit/Write 전에 GSD 명령어로 시작 필수
- **Superpowers:** 코드 구현 시 TDD, 완료 후 코드 리뷰 스킬 호출 필수

## Sources

### Primary (HIGH confidence)
- BullMQ Flows docs: https://docs.bullmq.io/guide/flows -- FlowProducer, parent-child 패턴
- YouTube Data API v3 commentThreads: https://developers.google.com/youtube/v3/docs/commentThreads/list -- 쿼터 1유닛, 파라미터
- AI SDK v6 generateText: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text -- Output.object() 패턴
- Drizzle ORM PostgreSQL: https://orm.drizzle.team/docs/get-started/postgresql-new -- identity column, JSONB
- pnpm Workspaces: https://pnpm.io/next/workspaces -- workspace 설정

### Secondary (MEDIUM confidence)
- 네이버 뉴스 댓글 API: https://seul1230.github.io/blog/네이버뉴스기사댓글수집 -- 비공식 API 엔드포인트, referer 필수
- Naver scraping guide: https://scrapfly.io/blog/posts/how-to-scrape-naver -- JS 렌더링 필요성
- Drizzle best practices 2025: https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717

### Tertiary (LOW confidence)
- 네이버 댓글 API objectId 형식 -- 비공식이므로 변경 가능성 있음. 실측 검증 필요

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- CLAUDE.md에 확정, npm 버전 검증 완료
- Architecture: HIGH -- pnpm workspace + BullMQ Flow 패턴은 공식 문서 기반
- Pitfalls: MEDIUM -- 네이버 비공식 API 관련은 실측 필요
- Naver comment API: LOW-MEDIUM -- 비공식 API, 변경 가능성

**Research date:** 2026-03-24
**Valid until:** 2026-04-07 (네이버 API 변동 가능성으로 7일)
