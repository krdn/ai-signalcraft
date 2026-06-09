# Manipulation Detection Phase 2 — 실데이터 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1 mock loader를 실제 collector tRPC 호출로 대체하고, `runAnalysisPipeline`에 Stage 5로 통합하여 구독 경로 분석 잡 완료 시 manipulation 분석이 자동 실행되도록 한다.

**Architecture:** collector에 baselines 전용 신규 엔드포인트 1개를 추가하고, core에 `CollectorManipulationLoader`(메모이즈된 6개 메서드)를 만들어 `ManipulationDataLoader` 인터페이스를 구현한다. `pipeline-orchestrator.ts`에 새 Stage 5 entry function `runStage5Manipulation`을 호출하되, 실패가 본 파이프라인에 영향 주지 않도록 try/catch + appendJobEvent로 격리한다.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC v11, BullMQ, Vitest 3, pgvector(384), PostgreSQL 16/TimescaleDB

**Worktree:** Phase 1과 동일하게 별도 worktree에서 진행 — 구현 시작 전 `EnterWorktree({ name: "worktree-manipulation-phase2" })` 호출.

---

## File Structure

### New Files

| 파일                                                                                 | 책임                                                            |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `apps/collector/src/server/trpc/items-manipulation.ts`                               | `fetchManipulationBaselines` endpoint — 30일 시간대별 댓글 분포 |
| `apps/collector/src/server/trpc/__tests__/items-manipulation.test.ts`                | 신규 endpoint 단위 테스트                                       |
| `packages/core/src/analysis/manipulation/loaders/collector-loader.ts`                | `CollectorManipulationLoader` — 6개 메서드, lazy memo           |
| `packages/core/src/analysis/manipulation/loaders/__tests__/collector-loader.test.ts` | loader 단위 테스트                                              |
| `packages/core/src/analysis/manipulation/stage5.ts`                                  | `runStage5Manipulation` — orchestrator entry                    |
| `packages/core/src/analysis/manipulation/__tests__/stage5.test.ts`                   | Stage 5 게이트/실패 격리 테스트                                 |

### Modified Files

| 파일                                                  | 변경                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/collector/src/server/trpc/router.ts`            | manipulation router 등록                                            |
| `packages/core/src/db/schema/collections.ts`          | options 타입에 `runManipulation`, `manipulationDomainOverride` 추가 |
| `packages/core/src/analysis/pipeline-orchestrator.ts` | Stage 4 게이트 후 `runStage5Manipulation` 호출                      |
| `packages/core/src/analysis/manipulation/index.ts`    | `runStage5Manipulation` re-export                                   |
| `packages/core/scripts/manipulation-dryrun.ts`        | 실 collector 호출 옵션 추가 (`--useReal`)                           |

---

## Task 1: collector — fetchManipulationBaselines endpoint 정의

**Files:**

- Create: `apps/collector/src/server/trpc/items-manipulation.ts`
- Create: `apps/collector/src/server/trpc/__tests__/items-manipulation.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/collector/src/server/trpc/__tests__/items-manipulation.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// drizzle ctx.db를 mock — 실제 SQL은 Step 3에서 검증, 여기서는 인터페이스만 검증
const execMock = vi.fn();

vi.mock('../../../db', () => ({
  getDb: () => ({ execute: execMock }),
}));

// init protectedProcedure는 ctx.db만 노출하므로 mock context 직접 주입
const ctx = { db: { execute: execMock } };

describe('itemsManipulationRouter.fetchManipulationBaselines', () => {
  beforeEach(() => {
    execMock.mockReset();
  });

  it('byHour 객체로 시간대별 일별 카운트를 반환', async () => {
    execMock.mockResolvedValueOnce({
      rows: [
        { hour: 9, counts: [12, 14, 11, 13] },
        { hour: 14, counts: [80, 82, 79, 81] },
      ],
    });

    const { itemsManipulationRouter } = await import('../items-manipulation');
    const caller = itemsManipulationRouter.createCaller(ctx as never);
    const result = await caller.fetchManipulationBaselines({
      subscriptionId: 42,
      referenceEnd: new Date('2026-04-28T00:00:00Z').toISOString(),
      days: 30,
    });

    expect(result.byHour).toEqual({
      '9': [12, 14, 11, 13],
      '14': [80, 82, 79, 81],
    });
  });

  it('빈 결과면 byHour는 빈 객체', async () => {
    execMock.mockResolvedValueOnce({ rows: [] });

    const { itemsManipulationRouter } = await import('../items-manipulation');
    const caller = itemsManipulationRouter.createCaller(ctx as never);
    const result = await caller.fetchManipulationBaselines({
      subscriptionId: 99,
      referenceEnd: new Date('2026-04-28T00:00:00Z').toISOString(),
      days: 30,
    });

    expect(result.byHour).toEqual({});
  });

  it('subscriptionId, referenceEnd, days를 SQL 바인딩에 전달', async () => {
    execMock.mockResolvedValueOnce({ rows: [] });

    const { itemsManipulationRouter } = await import('../items-manipulation');
    const caller = itemsManipulationRouter.createCaller(ctx as never);
    await caller.fetchManipulationBaselines({
      subscriptionId: 42,
      referenceEnd: new Date('2026-04-28T00:00:00Z').toISOString(),
      days: 14,
    });

    expect(execMock).toHaveBeenCalledTimes(1);
    const sqlArg = execMock.mock.calls[0][0];
    // drizzle sql 객체 — 직렬화된 query/parameters에 바인딩 값이 들어가는지만 검증
    const serialized = JSON.stringify(sqlArg);
    expect(serialized).toContain('42'); // subscriptionId
    expect(serialized).toContain('14'); // days
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/collector && pnpm vitest run src/server/trpc/__tests__/items-manipulation.test.ts`
Expected: FAIL with module not found `../items-manipulation`.

- [ ] **Step 3: Implement the endpoint**

`apps/collector/src/server/trpc/items-manipulation.ts`:

```ts
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { protectedProcedure, router } from './init';

export const fetchManipulationBaselinesInput = z.object({
  subscriptionId: z.number().int().positive(),
  referenceEnd: z.string().datetime(),
  days: z.number().int().min(7).max(60).default(30),
});

type BaselineRow = { hour: number; counts: number[] };

/**
 * manipulation Phase 2 — temporal baselines.
 *
 * 분석 윈도우(referenceEnd 직전 1일) 이전 N일치 raw_items 댓글의
 * 시간대(0~23)별·일별 카운트 분포 반환.
 *
 * - timezone: Asia/Seoul (한국 사용자 활동 패턴 기준)
 * - 분석 윈도우 자체는 baseline에서 제외 (자기 자신 비교 방지)
 * - 인덱스: raw_items_subscription_time_idx 사용 (subscription_id, time)
 */
export const itemsManipulationRouter = router({
  fetchManipulationBaselines: protectedProcedure
    .input(fetchManipulationBaselinesInput)
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.execute(sql`
        WITH bucket AS (
          SELECT
            EXTRACT(HOUR FROM time AT TIME ZONE 'Asia/Seoul')::int AS hour,
            DATE(time AT TIME ZONE 'Asia/Seoul') AS day,
            COUNT(*)::int AS cnt
          FROM raw_items
          WHERE subscription_id = ${input.subscriptionId}
            AND item_type = 'comment'
            AND time >= ${new Date(input.referenceEnd)}::timestamptz - make_interval(days => ${input.days})
            AND time <  ${new Date(input.referenceEnd)}::timestamptz - INTERVAL '1 day'
          GROUP BY hour, day
        )
        SELECT hour::int AS hour, array_agg(cnt ORDER BY day) AS counts
        FROM bucket
        GROUP BY hour
        ORDER BY hour
      `);

      const rows = (result.rows ?? result) as BaselineRow[];
      const byHour: Record<string, number[]> = {};
      for (const row of rows) {
        byHour[String(row.hour)] = row.counts;
      }
      return { byHour };
    }),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/collector && pnpm vitest run src/server/trpc/__tests__/items-manipulation.test.ts`
Expected: PASS (3개 테스트 모두 통과)

- [ ] **Step 5: Live SQL smoke test (실 DB로 실행 가능 확인)**

Mock 테스트는 SQL 자체의 PostgreSQL 호환성을 검증하지 못한다. `make_interval` 사용을 실 DB에서 한 번 검증한다.

Run:

```bash
psql "postgresql://gon:gon@192.168.0.5:5435/ais_collection" -c "
SELECT make_interval(days => 30);
SELECT NOW() - make_interval(days => 7);
"
```

Expected: `30 days`, 7일 전 timestamp가 정상 반환. 에러 없음.

만약 `psql` 접근 불가 환경이면 collector 컨테이너 안에서:

```bash
dserver exec ais-collector-api node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(()=>c.query(\"SELECT make_interval(days=>30) AS i\")).then(r=>console.log(r.rows[0])).then(()=>c.end());
"
```

이 step은 **개발자 환경**에서 1회만 — CI에서는 SKIP 가능.

- [ ] **Step 6: Commit**

```bash
git add apps/collector/src/server/trpc/items-manipulation.ts \
        apps/collector/src/server/trpc/__tests__/items-manipulation.test.ts
git commit -m "feat(collector): manipulation baselines tRPC 엔드포인트

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: collector router에 manipulation 라우터 등록

**Files:**

- Modify: `apps/collector/src/server/trpc/router.ts`

- [ ] **Step 1: Read existing router**

Run: `cat apps/collector/src/server/trpc/router.ts`
Expected output 일부:

```ts
import { itemsRouter } from './items';
// ...
export const appRouter = router({
  items: itemsRouter,
  // ...
});
```

- [ ] **Step 2: Modify router.ts**

`apps/collector/src/server/trpc/router.ts`에 import 추가하고 `items` 라우터를 manipulation과 merge:

```ts
import { itemsRouter } from './items';
import { itemsManipulationRouter } from './items-manipulation';
import { mergeRouters, router } from './init';
// ... 다른 imports

const itemsCombined = mergeRouters(itemsRouter, itemsManipulationRouter);

export const appRouter = router({
  items: itemsCombined,
  // ... 기존 라우터들
});
```

만약 `mergeRouters`가 `init.ts`에 없으면 다음 명령으로 확인:

Run: `grep -n "export" apps/collector/src/server/trpc/init.ts`

`mergeRouters`가 없으면 추가:

```ts
// apps/collector/src/server/trpc/init.ts
import { initTRPC } from '@trpc/server';
// ... 기존 코드
export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const protectedProcedure = ...;
```

- [ ] **Step 3: Verify type check**

Run: `cd apps/collector && pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Run all collector tests**

Run: `cd apps/collector && pnpm test`
Expected: 모든 테스트 PASS, 새 테스트 포함.

- [ ] **Step 5: Commit**

```bash
git add apps/collector/src/server/trpc/router.ts apps/collector/src/server/trpc/init.ts
git commit -m "feat(collector): manipulation 라우터 등록

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: core — collections.ts options 타입 확장

**Files:**

- Modify: `packages/core/src/db/schema/collections.ts:53-72`

- [ ] **Step 1: Read existing options type**

Run: `sed -n '53,72p' packages/core/src/db/schema/collections.ts`
Expected:

```ts
options: jsonb('options').$type<{
  enableItemAnalysis?: boolean;
  // ... 기존 필드들
  sources?: string[];
}>(),
```

- [ ] **Step 2: Add manipulation fields**

`packages/core/src/db/schema/collections.ts`의 `options` 타입에 두 필드 추가 (기존 필드 뒤에):

```ts
options: jsonb('options').$type<{
  enableItemAnalysis?: boolean;
  tokenOptimization?:
    | 'none'
    | 'light'
    | 'standard'
    | 'aggressive'
    | 'rag-light'
    | 'rag-standard'
    | 'rag-aggressive';
  limitMode?: 'perDay' | 'total';
  subscriptionId?: number;
  skipItemAnalysis?: boolean;
  useCollectorLoader?: boolean;
  sources?: string[];
  // Phase 2 — manipulation detection (default false; 구독 경로 한정)
  runManipulation?: boolean;
  manipulationDomainOverride?: string;
}>(),
```

- [ ] **Step 3: Type check**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/db/schema/collections.ts
git commit -m "feat(core): collection_jobs options에 runManipulation 추가

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: core — CollectorManipulationLoader 골격 + memoize

**Files:**

- Create: `packages/core/src/analysis/manipulation/loaders/collector-loader.ts`
- Create: `packages/core/src/analysis/manipulation/loaders/__tests__/collector-loader.test.ts`

- [ ] **Step 1: Write the failing test (memoize 검증)**

`packages/core/src/analysis/manipulation/loaders/__tests__/collector-loader.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createCollectorManipulationLoader } from '../collector-loader';

function makeMockClient() {
  const queryFn = vi.fn();
  const baselinesFn = vi.fn();
  // CollectorClient는 tRPC proxy 형태이지만 실제 분기되는 메서드만 모킹.
  return {
    client: {
      items: {
        query: { query: queryFn },
        fetchManipulationBaselines: { query: baselinesFn },
      },
    } as unknown as Parameters<typeof createCollectorManipulationLoader>[0]['client'],
    queryFn,
    baselinesFn,
  };
}

const baseCtx = {
  jobId: 1,
  subscriptionId: 42,
  domain: 'political',
  config: {} as never,
  dateRange: { start: new Date('2026-04-21T00:00:00Z'), end: new Date('2026-04-28T00:00:00Z') },
};

describe('CollectorManipulationLoader', () => {
  it('comments / votes / trendSeries / embeddedComments는 단일 query 호출을 공유 (memoize)', async () => {
    const { client, queryFn } = makeMockClient();
    queryFn.mockResolvedValue({
      items: [
        {
          itemType: 'comment',
          source: 'naver-comments',
          itemId: 'c1',
          parentSourceId: 'p1',
          time: '2026-04-22T10:00:00Z',
          content: 'hello',
          author: 'a',
          metrics: { likeCount: 5 },
          embedding: [0.1, 0.2],
        },
      ],
      nextCursor: null,
    });

    const loader = createCollectorManipulationLoader({
      client,
      subscriptionId: 42,
      sources: ['naver-news', 'naver-comments'],
      dateRange: baseCtx.dateRange,
      baselineDays: 30,
    });

    await loader.loadComments(baseCtx);
    await loader.loadVotes(baseCtx);
    await loader.loadEmbeddedComments(baseCtx);
    await loader.loadTrendSeries(baseCtx);

    // 단일 호출만 발생 — comment 4개 메서드가 같은 응답을 공유
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('embeddedArticles는 별도 query 호출', async () => {
    const { client, queryFn } = makeMockClient();
    queryFn.mockResolvedValue({ items: [], nextCursor: null });

    const loader = createCollectorManipulationLoader({
      client,
      subscriptionId: 42,
      sources: [],
      dateRange: baseCtx.dateRange,
      baselineDays: 30,
    });

    await loader.loadComments(baseCtx); // 1회
    await loader.loadEmbeddedArticles(baseCtx); // 2회

    expect(queryFn).toHaveBeenCalledTimes(2);
    // 두번째 호출은 itemTypes:[article,video]
    const secondCall = queryFn.mock.calls[1][0];
    expect(secondCall.itemTypes).toEqual(['article', 'video']);
  });

  it('baselines는 fetchManipulationBaselines를 호출', async () => {
    const { client, queryFn, baselinesFn } = makeMockClient();
    queryFn.mockResolvedValue({ items: [], nextCursor: null });
    baselinesFn.mockResolvedValue({ byHour: { '9': [10, 12], '14': [50, 51] } });

    const loader = createCollectorManipulationLoader({
      client,
      subscriptionId: 42,
      sources: [],
      dateRange: baseCtx.dateRange,
      baselineDays: 30,
    });

    const result = await loader.loadTemporalBaselines(baseCtx);
    expect(result).toEqual({ '9': [10, 12], '14': [50, 51] });
    expect(baselinesFn).toHaveBeenCalledWith({
      subscriptionId: 42,
      referenceEnd: baseCtx.dateRange.end.toISOString(),
      days: 30,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run src/analysis/manipulation/loaders/__tests__/collector-loader.test.ts`
Expected: FAIL with module not found `../collector-loader`.

- [ ] **Step 3: Implement loader skeleton + comments memoize**

`packages/core/src/analysis/manipulation/loaders/collector-loader.ts`:

```ts
import type { CollectorClient } from '../../../collector-client';
import type {
  ManipulationDataLoader,
  SignalContext,
  CommentRow,
  EmbeddedItem,
  ArticleEmbedded,
  TrendPoint,
} from '../types';
import type { VoteRow } from '../signals/vote';

const COMMENT_QUERY_LIMIT = 10000;
const ARTICLE_QUERY_LIMIT = 10000;
const BUCKET_MS = 5 * 60 * 1000;

export type CollectorLoaderArgs = {
  client: CollectorClient;
  subscriptionId: number;
  sources: string[];
  dateRange: { start: Date; end: Date };
  baselineDays: number;
};

type CommentItem = {
  itemType: 'comment';
  source: string;
  itemId?: string;
  sourceId?: string;
  parentSourceId: string | null;
  time: string;
  content: string | null;
  author: string | null;
  metrics?: { likeCount?: number } | null;
  embedding?: number[] | null;
};

type ArticleItem = {
  itemType: 'article' | 'video';
  source: string;
  itemId?: string;
  sourceId?: string;
  publisher: string | null;
  title: string | null;
  time: string;
  embedding?: number[] | null;
};

export function createCollectorManipulationLoader(
  args: CollectorLoaderArgs,
): ManipulationDataLoader {
  let _commentRaw: CommentItem[] | null = null;
  let _articleRaw: ArticleItem[] | null = null;
  let _baselines: Record<string, number[]> | null = null;

  const dateRange = {
    start: args.dateRange.start.toISOString(),
    end: args.dateRange.end.toISOString(),
  };

  async function fetchComments(): Promise<CommentItem[]> {
    if (_commentRaw) return _commentRaw;
    const result = await args.client.items.query.query({
      subscriptionId: args.subscriptionId,
      dateRange,
      sources: args.sources.length > 0 ? (args.sources as never) : undefined,
      itemTypes: ['comment'],
      mode: 'all',
      scope: 'all',
      includeEmbeddings: true,
      limit: COMMENT_QUERY_LIMIT,
    });
    _commentRaw = (result.items ?? []) as CommentItem[];
    return _commentRaw;
  }

  async function fetchArticles(): Promise<ArticleItem[]> {
    if (_articleRaw) return _articleRaw;
    const result = await args.client.items.query.query({
      subscriptionId: args.subscriptionId,
      dateRange,
      sources: args.sources.length > 0 ? (args.sources as never) : undefined,
      itemTypes: ['article', 'video'],
      mode: 'all',
      scope: 'all',
      includeEmbeddings: true,
      limit: ARTICLE_QUERY_LIMIT,
    });
    _articleRaw = (result.items ?? []) as ArticleItem[];
    return _articleRaw;
  }

  return {
    async loadComments(_ctx: SignalContext): Promise<CommentRow[]> {
      const raw = await fetchComments();
      return raw.map((r) => ({
        itemId: r.itemId ?? r.sourceId ?? '',
        parentSourceId: r.parentSourceId ?? '',
        source: r.source,
        time: new Date(r.time),
        excerpt: (r.content ?? '').slice(0, 280),
      }));
    },

    async loadVotes(_ctx: SignalContext): Promise<VoteRow[]> {
      const raw = await fetchComments();
      return raw.map((r) => ({
        itemId: r.itemId ?? r.sourceId ?? '',
        source: r.source,
        parentSourceId: r.parentSourceId ?? '',
        length: (r.content ?? '').length,
        likeCount: r.metrics?.likeCount ?? 0,
        time: new Date(r.time),
      }));
    },

    async loadEmbeddedComments(_ctx: SignalContext): Promise<EmbeddedItem[]> {
      const raw = await fetchComments();
      return raw
        .filter((r) => Array.isArray(r.embedding) && r.embedding.length > 0)
        .map((r) => ({
          itemId: r.itemId ?? r.sourceId ?? '',
          source: r.source,
          author: r.author,
          text: r.content ?? '',
          embedding: r.embedding!,
          time: new Date(r.time),
        }));
    },

    async loadEmbeddedArticles(_ctx: SignalContext): Promise<ArticleEmbedded[]> {
      const raw = await fetchArticles();
      return raw
        .filter((r) => Array.isArray(r.embedding) && r.embedding.length > 0 && r.publisher)
        .map((r) => ({
          itemId: r.itemId ?? r.sourceId ?? '',
          publisher: r.publisher!,
          headline: r.title ?? '',
          embedding: r.embedding!,
          time: new Date(r.time),
        }));
    },

    async loadTrendSeries(_ctx: SignalContext): Promise<TrendPoint[]> {
      const raw = await fetchComments();
      if (raw.length === 0) return [];
      const buckets = new Map<number, number>();
      for (const c of raw) {
        const t = new Date(c.time).getTime();
        const bucketKey = Math.floor(t / BUCKET_MS) * BUCKET_MS;
        buckets.set(bucketKey, (buckets.get(bucketKey) ?? 0) + 1);
      }
      return [...buckets.entries()]
        .sort(([a], [b]) => a - b)
        .map(([ts, count]) => ({ ts: new Date(ts).toISOString(), count }));
    },

    async loadTemporalBaselines(_ctx: SignalContext): Promise<Record<string, number[]>> {
      if (_baselines) return _baselines;
      const result = await args.client.items.fetchManipulationBaselines.query({
        subscriptionId: args.subscriptionId,
        referenceEnd: args.dateRange.end.toISOString(),
        days: args.baselineDays,
      });
      _baselines = result.byHour;
      return _baselines;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run src/analysis/manipulation/loaders/__tests__/collector-loader.test.ts`
Expected: PASS (3개 테스트 모두 통과)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analysis/manipulation/loaders/collector-loader.ts \
        packages/core/src/analysis/manipulation/loaders/__tests__/collector-loader.test.ts
git commit -m "feat(core): CollectorManipulationLoader 구현

memoize된 6개 ManipulationDataLoader 메서드 — comments/votes/trendSeries/
embeddedComments는 단일 query 응답 공유, embeddedArticles는 별도 호출,
baselines는 fetchManipulationBaselines 호출.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: core — Stage 5 entry function (`runStage5Manipulation`)

**Files:**

- Create: `packages/core/src/analysis/manipulation/stage5.ts`
- Create: `packages/core/src/analysis/manipulation/__tests__/stage5.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/src/analysis/manipulation/__tests__/stage5.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const eventLog: { level: string; msg: string }[] = [];

vi.mock('../../../pipeline/persist', () => ({
  appendJobEvent: vi.fn(async (_jobId: number, level: string, msg: string) => {
    eventLog.push({ level, msg });
  }),
}));

const runDetectionMock = vi.fn();
vi.mock('../runner', () => ({
  runManipulationDetection: (...args: unknown[]) => runDetectionMock(...args),
}));

const persistRunMock = vi.fn();
vi.mock('../persist', () => ({
  persistRun: (...args: unknown[]) => persistRunMock(...args),
}));

const resolveConfigMock = vi.fn();
vi.mock('../config', () => ({
  resolveDomainConfig: (...args: unknown[]) => resolveConfigMock(...args),
}));

vi.mock('../../../db', () => ({
  getDb: () => ({}),
}));

vi.mock('../../../collector-client', () => ({
  getCollectorClient: () => ({
    items: {
      query: { query: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) },
      fetchManipulationBaselines: { query: vi.fn().mockResolvedValue({ byHour: {} }) },
    },
  }),
}));

import { runStage5Manipulation } from '../stage5';

describe('runStage5Manipulation', () => {
  beforeEach(() => {
    eventLog.length = 0;
    runDetectionMock.mockReset();
    persistRunMock.mockReset();
    resolveConfigMock.mockReset();
  });

  it('runManipulation !== true 이면 즉시 SKIP — appendJobEvent도 호출하지 않음', async () => {
    await runStage5Manipulation({
      jobId: 1,
      jobOptions: { runManipulation: false, subscriptionId: 42 },
      domain: 'political',
      dateRange: { start: new Date(), end: new Date() },
    });
    expect(runDetectionMock).not.toHaveBeenCalled();
    expect(eventLog).toEqual([]);
  });

  it('subscriptionId가 없으면 SKIP', async () => {
    await runStage5Manipulation({
      jobId: 1,
      jobOptions: { runManipulation: true },
      domain: 'political',
      dateRange: { start: new Date(), end: new Date() },
    });
    expect(runDetectionMock).not.toHaveBeenCalled();
    expect(eventLog).toEqual([]);
  });

  it('정상 흐름 — config 로드 → 분석 → persist → info 이벤트', async () => {
    resolveConfigMock.mockResolvedValue({
      domain: 'political',
      weights: {} as never,
      thresholds: {} as never,
      baselineDays: 30,
      narrativeContext: '',
    });
    runDetectionMock.mockResolvedValue({
      signals: [],
      aggregate: { manipulationScore: 42.7, confidenceFactor: 0.8, signalScores: {} },
    });
    persistRunMock.mockResolvedValue('run-uuid-1');

    await runStage5Manipulation({
      jobId: 100,
      jobOptions: { runManipulation: true, subscriptionId: 42 },
      domain: 'political',
      dateRange: { start: new Date('2026-04-21'), end: new Date('2026-04-28') },
    });

    expect(resolveConfigMock).toHaveBeenCalledWith('political');
    expect(runDetectionMock).toHaveBeenCalledTimes(1);
    expect(persistRunMock).toHaveBeenCalledTimes(1);
    expect(eventLog).toContainEqual({
      level: 'info',
      msg: expect.stringContaining('manipulation 분석 시작'),
    });
    expect(eventLog).toContainEqual({
      level: 'info',
      msg: expect.stringContaining('42.7'),
    });
  });

  it('실행 중 throw 발생 시 warn 이벤트만 남기고 본 함수는 정상 반환 (격리)', async () => {
    resolveConfigMock.mockResolvedValue({
      domain: 'political',
      weights: {} as never,
      thresholds: {} as never,
      baselineDays: 30,
      narrativeContext: '',
    });
    runDetectionMock.mockRejectedValue(new Error('boom'));

    await expect(
      runStage5Manipulation({
        jobId: 100,
        jobOptions: { runManipulation: true, subscriptionId: 42 },
        domain: 'political',
        dateRange: { start: new Date('2026-04-21'), end: new Date('2026-04-28') },
      }),
    ).resolves.toBeUndefined();

    expect(eventLog).toContainEqual({
      level: 'warn',
      msg: expect.stringContaining('manipulation 실패: boom'),
    });
  });

  it('manipulationDomainOverride가 있으면 그 도메인으로 config 로드', async () => {
    resolveConfigMock.mockResolvedValue({
      domain: 'economic',
      weights: {} as never,
      thresholds: {} as never,
      baselineDays: 30,
      narrativeContext: '',
    });
    runDetectionMock.mockResolvedValue({
      signals: [],
      aggregate: { manipulationScore: 0, confidenceFactor: 1, signalScores: {} },
    });
    persistRunMock.mockResolvedValue('run-uuid-2');

    await runStage5Manipulation({
      jobId: 100,
      jobOptions: {
        runManipulation: true,
        subscriptionId: 42,
        manipulationDomainOverride: 'economic',
      },
      domain: 'political',
      dateRange: { start: new Date(), end: new Date() },
    });

    expect(resolveConfigMock).toHaveBeenCalledWith('economic');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run src/analysis/manipulation/__tests__/stage5.test.ts`
Expected: FAIL — module not found `../stage5` AND `../config`.

- [ ] **Step 3: Create domain config resolver**

`packages/core/src/analysis/manipulation/config.ts` (신규):

```ts
import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { manipulationDomainConfigs, SIGNAL_TYPES } from '../../db/schema/manipulation';
import type { DomainConfig, DomainWeights, DomainThresholds } from './types';

/**
 * domain 이름으로 manipulation_domain_configs 조회 → DomainConfig 변환.
 * 없으면 'political' 기본 도메인으로 폴백 (Phase 1 seed 보장).
 */
export async function resolveDomainConfig(domain: string): Promise<DomainConfig> {
  const db = getDb();
  const [row] =
    (await db
      .select()
      .from(manipulationDomainConfigs)
      .where(eq(manipulationDomainConfigs.domain, domain))
      .limit(1)) ?? [];

  if (!row) {
    if (domain === 'political') {
      throw new Error(
        'manipulation_domain_configs: political 시드가 없습니다. pnpm seed:manipulation-configs 실행 필요',
      );
    }
    return resolveDomainConfig('political');
  }

  // satisfies 가드와 매칭되는 형태로 캐스팅
  return {
    domain: row.domain,
    weights: row.weights as DomainWeights,
    thresholds: row.thresholds as DomainThresholds,
    baselineDays: row.baselineDays,
    narrativeContext: row.narrativeContext,
  };
}

// 빌드 타임 검증을 위한 키 인벤토리 (런타임 사용 안 함)
export const REQUIRED_SIGNAL_KEYS = SIGNAL_TYPES;
```

- [ ] **Step 4: Implement runStage5Manipulation**

`packages/core/src/analysis/manipulation/stage5.ts` (신규):

```ts
import { getDb } from '../../db';
import { appendJobEvent } from '../../pipeline/persist';
import { getCollectorClient } from '../../collector-client';
import { resolveDomainConfig } from './config';
import { createCollectorManipulationLoader } from './loaders/collector-loader';
import { runManipulationDetection } from './runner';
import { persistRun } from './persist';

export type Stage5Args = {
  jobId: number;
  jobOptions: Record<string, unknown>;
  domain: string;
  dateRange: { start: Date; end: Date };
};

/**
 * Stage 5 — Manipulation Detection entry.
 *
 * 실행 조건: jobOptions.runManipulation === true AND options.subscriptionId 존재.
 * 실패는 본 분석 파이프라인에 영향 주지 않음 (try/catch + appendJobEvent 격리).
 */
export async function runStage5Manipulation(args: Stage5Args): Promise<void> {
  const subscriptionId =
    typeof args.jobOptions.subscriptionId === 'number' ? args.jobOptions.subscriptionId : null;
  const runFlag = args.jobOptions.runManipulation === true;
  if (!runFlag || !subscriptionId) {
    return; // 무음 SKIP
  }

  await appendJobEvent(args.jobId, 'info', 'manipulation 분석 시작');

  try {
    const overrideRaw = args.jobOptions.manipulationDomainOverride;
    const targetDomain = typeof overrideRaw === 'string' && overrideRaw ? overrideRaw : args.domain;
    const config = await resolveDomainConfig(targetDomain);
    const sourcesRaw = args.jobOptions.sources;
    const sources = Array.isArray(sourcesRaw) ? (sourcesRaw as string[]) : [];

    const loader = createCollectorManipulationLoader({
      client: getCollectorClient(),
      subscriptionId,
      sources,
      dateRange: args.dateRange,
      baselineDays: config.baselineDays,
    });

    const output = await runManipulationDetection({
      jobId: args.jobId,
      subscriptionId,
      config,
      dateRange: args.dateRange,
      loader,
    });

    await persistRun(getDb(), {
      jobId: args.jobId,
      subscriptionId,
      output,
      weightsVersion: `v1-${config.domain}`,
    });

    await appendJobEvent(
      args.jobId,
      'info',
      `manipulation 완료: score=${output.aggregate.manipulationScore.toFixed(1)}, confidence=${output.aggregate.confidenceFactor.toFixed(2)}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendJobEvent(args.jobId, 'warn', `manipulation 실패: ${msg}`);
    // 부분 실패 케이스(persistRun 이후 throw)는 Phase 2 범위에 없음 — 현재
    // 흐름에서 throw할 수 있는 단계는 모두 persistRun 이전이므로 markRunFailed 불필요.
    // Phase 3에서 LLM Narrative 추가 시 부분 실패 케이스가 생기면 그때 도입.
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run src/analysis/manipulation/__tests__/stage5.test.ts`
Expected: PASS (5개 테스트)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/analysis/manipulation/stage5.ts \
        packages/core/src/analysis/manipulation/config.ts \
        packages/core/src/analysis/manipulation/__tests__/stage5.test.ts
git commit -m "feat(core): manipulation Stage 5 entry function

resolveDomainConfig로 도메인 설정 로드 + CollectorLoader로 실데이터 분석 +
persist까지 단일 entry로 처리. 실패 격리(try/catch + appendJobEvent).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: core — manipulation index에 Stage 5 export 추가

**Files:**

- Modify: `packages/core/src/analysis/manipulation/index.ts`

- [ ] **Step 1: Read existing exports**

Run: `cat packages/core/src/analysis/manipulation/index.ts`
Expected:

```ts
export { runManipulationDetection } from './runner';
export type { RunInput, RunOutput } from './runner';
export { aggregate } from './aggregator';
export type { AggregateResult } from './aggregator';
export { persistRun, markRunFailed } from './persist';
export type { PersistInput } from './persist';
export * from './types';
```

- [ ] **Step 2: Add Stage 5 + config exports**

`packages/core/src/analysis/manipulation/index.ts`에 다음 두 줄 추가 (파일 끝):

```ts
export { runStage5Manipulation } from './stage5';
export type { Stage5Args } from './stage5';
export { resolveDomainConfig } from './config';
```

- [ ] **Step 3: Type check**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/analysis/manipulation/index.ts
git commit -m "chore(core): manipulation public API에 Stage 5 export 추가

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: core — pipeline-orchestrator.ts에 Stage 5 호출 통합

**Files:**

- Modify: `packages/core/src/analysis/pipeline-orchestrator.ts`

- [ ] **Step 1: Read context (Stage 4 게이트 직후 위치 확인)**

Run: `grep -n "awaitStageGate(jobId, 'analysis-stage4')\|generateFinalReport" packages/core/src/analysis/pipeline-orchestrator.ts`
Expected: 두 줄 — `awaitStageGate('analysis-stage4')`가 `generateFinalReport` 직전에 위치.

- [ ] **Step 2: Find current jobOptions and cjRow read site**

Run: `grep -n "cjRow\|jobOptions = " packages/core/src/analysis/pipeline-orchestrator.ts | head -10`
Expected: 80~90줄 부근에서 `cjRow`가 한 번 select됨 + `jobOptions = (cjRow?.options ...) || {}`.

`cjRow`가 select할 때 어떤 컬럼을 가져오는지 확인:

Run: `sed -n '78,90p' packages/core/src/analysis/pipeline-orchestrator.ts`

만약 `cjRow`가 `.select()` (전체 컬럼)로 select하면 `cjRow.startDate`/`cjRow.endDate` 사용 가능. `select({ options: ... })` 식으로 컬럼 선별이면 추가로 startDate/endDate를 select에 포함시켜야 한다 — Step 5에서 처리.

- [ ] **Step 3: Verify dateRange source — collectionJobs.startDate / endDate**

`collectionJobs` 스키마는 `startDate` / `endDate` 컬럼을 가짐 (분석 데이터 윈도우). `startedAt`/`completedAt`은 실행 시각이므로 사용하지 말 것.

Run: `grep -n "startDate\|endDate" packages/core/src/db/schema/collections.ts | head -5`
Expected: `start_date`, `end_date` 두 컬럼 존재 확인.

- [ ] **Step 4: Add imports**

`packages/core/src/analysis/pipeline-orchestrator.ts` 상단 imports에 추가:

```ts
import { runStage5Manipulation } from './manipulation';
```

`logError`, `getDb`, `collectionJobs`, `eq`는 이미 import되어 있음 (확인은 `grep -n "^import" packages/core/src/analysis/pipeline-orchestrator.ts | head -20`).

- [ ] **Step 5: Insert Stage 5 call**

`pipeline-orchestrator.ts`에서 다음 패턴을 찾아:

```ts
// BP 게이트: AI 분석 Stage 4 완료 후
if (!(await awaitStageGate(jobId, 'analysis-stage4'))) {
  ctx.cancelledByUser = true;
  return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
}

// 리포트 생성
const report = await generateFinalReport(ctx.allResults, ctx.input);
```

다음으로 교체 (Stage 5 블록 삽입):

```ts
// BP 게이트: AI 분석 Stage 4 완료 후
if (!(await awaitStageGate(jobId, 'analysis-stage4'))) {
  ctx.cancelledByUser = true;
  return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
}

// Stage 5: Manipulation Detection (옵션, 비차단)
// - default OFF: jobOptions.runManipulation === true 일 때만 실행
// - 구독 경로 한정: subscriptionId 없으면 SKIP
// - 실패 격리: 내부 try/catch + 외부 .catch 안전망
// - dateRange는 collectionJobs.startDate/endDate (분석 데이터 윈도우, 실행 시각이 아님)
try {
  const [windowRow] = await getDb()
    .select({ startDate: collectionJobs.startDate, endDate: collectionJobs.endDate })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);

  if (windowRow?.startDate && windowRow?.endDate) {
    await runStage5Manipulation({
      jobId,
      jobOptions,
      domain: ctx.input.domain,
      dateRange: { start: windowRow.startDate, end: windowRow.endDate },
    });
  } else {
    // startDate/endDate 누락은 schema NOT NULL이라 정상 흐름에선 발생 안 함.
    // 만에 하나 발생해도 manipulation은 SKIP, 본 파이프라인 영향 없음.
    logError('manipulation-stage5', new Error(`jobId ${jobId}: startDate/endDate 누락`));
  }
} catch (err) {
  logError('manipulation-stage5', err);
}

// 리포트 생성
const report = await generateFinalReport(ctx.allResults, ctx.input);
```

- [ ] **Step 6: Type check**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 0 errors.

만약 `cjRow.startedAt`이 함수 스코프 밖이면, `cjRow`가 함수 시작부에서 declared됨을 확인 (`Step 2`에서 86줄 부근).

- [ ] **Step 7: Run all manipulation + orchestrator tests**

Run: `cd packages/core && pnpm vitest run src/analysis/manipulation src/analysis/pipeline-orchestrator`
Expected: 모든 테스트 PASS.

만약 orchestrator 테스트가 없으면 manipulation 테스트만 PASS 확인.

- [ ] **Step 8: Run full test suite**

Run: `cd packages/core && pnpm test`
Expected: 기존 444+ tests 전부 PASS, 새로 추가된 stage5/loader 테스트 포함.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/analysis/pipeline-orchestrator.ts
git commit -m "feat(core): runAnalysisPipeline에 Stage 5 manipulation 통합

Stage 4 게이트 후 runStage5Manipulation 호출. default OFF로 기존 동작 영향 없음.
실패 격리(try/catch + logError 안전망).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: dryrun 스크립트 — 실 collector 호출 옵션 추가

**Files:**

- Modify: `packages/core/scripts/manipulation-dryrun.ts`

- [ ] **Step 1: Read existing dryrun**

Run: `cat packages/core/scripts/manipulation-dryrun.ts`
Expected: 현재 버전은 mock loader 또는 빈 데이터로 동작. CLI args 처리 부분을 찾아 `--useReal` 플래그 추가 위치 확인.

- [ ] **Step 2: Add useReal flag and CollectorLoader integration**

`packages/core/scripts/manipulation-dryrun.ts` 수정 (기존 인자 처리 유지하면서 `--useReal` 분기 추가):

```ts
// 기존 args parser 부분에 추가
const useReal = process.argv.includes('--useReal');
const subscriptionIdArg = process.argv.find((a) => a.startsWith('--subscriptionId='));
const subscriptionId = subscriptionIdArg ? Number(subscriptionIdArg.split('=')[1]) : null;

// loader 생성 분기
let loader: ManipulationDataLoader;
if (useReal) {
  if (!subscriptionId || subscriptionId <= 0) {
    console.error('--useReal 사용 시 --subscriptionId=N (positive int) 필수');
    process.exit(1);
  }
  const { createCollectorManipulationLoader } =
    await import('../src/analysis/manipulation/loaders/collector-loader');
  const { getCollectorClient } = await import('../src/collector-client');
  loader = createCollectorManipulationLoader({
    client: getCollectorClient(),
    subscriptionId,
    sources: [],
    dateRange,
    baselineDays: config.baselineDays,
  });
  console.log(`[dryrun] real collector loader (subscriptionId=${subscriptionId})`);
} else {
  loader = createEmptyMockLoader(); // 기존 mock 함수 (이미 존재)
  console.log('[dryrun] empty mock loader');
}
```

- [ ] **Step 3: Run dryrun in dry mode (no real call)**

Run: `cd packages/core && pnpm tsx scripts/manipulation-dryrun.ts --jobId=999`
Expected: 빈 데이터로 7개 신호 모두 score=0 또는 정상 0-경로 메시지 출력. 종료 코드 0.

- [ ] **Step 4: Verify --useReal flag exits cleanly without subscriptionId**

Run: `cd packages/core && pnpm tsx scripts/manipulation-dryrun.ts --jobId=999 --useReal`
Expected: stderr에 `--subscriptionId 필수` 메시지, exit code 1.

- [ ] **Step 5: Commit**

```bash
git add packages/core/scripts/manipulation-dryrun.ts
git commit -m "feat(core): manipulation-dryrun --useReal 옵션 추가

실제 collector 호출로 1개 구독을 end-to-end 검증할 수 있는 CLI 모드.
--subscriptionId 없으면 즉시 exit 1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: 회귀 게이트 — 전체 테스트 및 lint

**Files:**

- (모든 변경 파일 검증)

- [ ] **Step 1: Run all tests across monorepo**

Run: `pnpm test`
Expected: 모든 워크스페이스 테스트 PASS. core의 444+ tests + 새 11+ tests + collector 신규 3 tests.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Type check across monorepo**

Run: `pnpm -r tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Final verification commit (no-op if clean)**

만약 lint auto-fix가 변경한 파일이 있다면:

```bash
git add -A
git commit -m "chore: lint auto-fix 적용

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

clean이면 commit 생략.

---

## Task 10: PR 분리 가이드 (참고)

이 plan은 다음 3개 PR로 분할 머지 가능하다 (선택사항 — subagent-driven-development는 단일 worktree에서 task별 commit을 하므로 머지 시 분리하면 됨):

- **PR1 (Task 1-2)**: collector — `fetchManipulationBaselines` endpoint + 라우터 등록
- **PR2 (Task 3-7)**: core — DB schema + CollectorLoader + Stage 5 + orchestrator 통합
- **PR3 (Task 8-9)**: dryrun + 회귀 게이트

각 PR은 default OFF이므로 운영 영향 없이 순차 머지 가능.

---

## Self-Review Notes

**Spec coverage**:

- §3.1 통합 위치 → Task 7 ✓
- §3.2 모듈 구조 → Task 1, 4, 5, 6 ✓
- §4 신규 endpoint → Task 1 ✓
- §5 CollectorDataLoader (memoize, 6개 메서드, RTT 3회) → Task 4 ✓
- §6 Stage 5 entry (게이트, try/catch, appendJobEvent) → Task 5 ✓
- §6.3 orchestrator 수정 → Task 7 ✓
- §7 collections.ts options 확장 → Task 3 ✓
- §8 테스트 전략 (loader unit, stage5 unit, collector endpoint unit, dryrun integration, 회귀) → Task 1, 4, 5, 8, 9 ✓
- §9 롤아웃 PR 분할 → Task 10 ✓

**Placeholder scan**: 없음 (모든 step에 실제 코드/명령/expected 포함).

**Type consistency**:

- `CollectorLoaderArgs` (Task 4) ↔ `createCollectorManipulationLoader` 호출 (Task 5, 8) ✓
- `Stage5Args` (Task 5) ↔ orchestrator 호출 (Task 7) ✓
- `resolveDomainConfig` 시그니처 (Task 5 Step 3) ↔ stage5.ts에서의 호출 (Task 5 Step 4) ✓
- `runManipulationDetection` 입력 (Phase 1 기존 RunInput) ↔ stage5.ts에서의 호출 (Task 5 Step 4) ✓
- `persistRun(db, input)` 시그니처 (Phase 1 persist.ts:23) ↔ stage5.ts 호출 (Task 5 Step 4) ✓

**Advisor review 반영 (post-self-review)**:

- Task 1 SQL: `(N || ' days')::interval` → `make_interval(days => N)`로 변경 (PG `int4 || text` 에러 회피) ✓
- Task 1 Step 5: 실 DB SQL smoke test 추가 (mock-only 검증의 한계 보완) ✓
- Task 7 dateRange: `startedAt`/`completedAt`(실행 시각) → `startDate`/`endDate`(분석 데이터 윈도우)로 정정 ✓
- Task 5: 사용하지 않는 `markRunFailed` import 제거 + dead `void` 표현식 제거 ✓
- Worktree 명시: plan 상단 헤더에 `worktree-manipulation-phase2` 사용 권고 추가 ✓
