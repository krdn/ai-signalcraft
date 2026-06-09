# 구독 분석 파이프라인 데이터 손실 수정 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구독 단축 경로(useCollectorLoader=true)의 분석 잡이 일반 경로와 동일한 데이터 정합성·수집 커버리지·운영 가시성을 갖도록 수정한다.

**Architecture:** 3 phase. (1) collector API에 풀셋 동시 반환 procedure 추가 + 분석측에서 source별 분산 RAG 호출 + persist 함수 신설. (2) tRPC `triggerSubscription`이 appliedPreset/limits/options.sources를 채우고, orchestrator가 useCollectorLoader 분기 직후 persistFromCollectorPayload를 호출. (3) `analysis_reports.metadata`에 modulesPartial/warnings/qualityFlags 추가 + markdown footer + UI 배너.

**Tech Stack:** TypeScript 5, Drizzle ORM, Vitest 3, tRPC 11, BullMQ 5, Next.js 15, pgvector, PostgreSQL 16.

**Spec:** `docs/superpowers/specs/2026-04-26-subscription-pipeline-data-loss-fix-design.md`

---

## File Structure

### 신규 파일

- `packages/core/src/pipeline/persist-from-collector.ts` — `persistFromCollectorPayload(jobId, payload)` 단일 함수
- `packages/core/tests/persist-from-collector.test.ts` — 단위 테스트
- `packages/core/tests/data-loader-rag-fanout.test.ts` — Phase 2 source별 호출 검증
- `packages/core/tests/integration/subscription-pipeline.test.ts` — 271 회귀 통합 테스트
- `packages/core/src/analysis/quality-metadata.ts` — `buildQualityMetadata`, `appendQualityFooterToMarkdown`
- `packages/core/tests/quality-metadata.test.ts` — Phase 3 유닛
- `apps/web/src/components/quality-warning-banner.tsx` — UI 배너 + drawer

### 수정 파일

- `apps/collector/src/server/trpc/items.ts:30-200` — `fetchAnalysisPayload` procedure 추가 (기존 query 수정 안 함)
- `packages/core/src/analysis/data-loader.ts:154-408` — `loadAnalysisInputFromCollector`가 fullset 함께 반환 + source별 분산 호출
- `packages/core/src/analysis/pipeline-orchestrator.ts:86-95` — useCollectorLoader 분기 직후 persistFromCollectorPayload 호출
- `apps/web/src/server/trpc/routers/analysis.ts:302-374` — triggerSubscription이 appliedPreset/limits/options.sources 채움
- `packages/core/src/analysis/report-builder.ts` — quality metadata 빌드 + footer append 호출
- `apps/web/src/app/.../report/[id]/page.tsx` — `<QualityWarningBanner>` 삽입
- `apps/web/src/app/.../monitor/...` (모니터 페이지) — 잡 row에 ⚠️ 아이콘

### 변경 안 함

- `packages/core/src/db/schema/*` — schema 변경 없음 (jsonb 활용)
- `packages/core/src/pipeline/persist.ts` — 기존 `persistArticles/persistVideos/persistComments` 그대로 재사용
- 일반 경로 (`triggerCollection`, FlowProducer Flow): 영향 없음

---

## Phase 1 — 데이터 정합성 (PR1, PR2, PR4)

### Task 1: persistFromCollectorPayload 신규 함수 작성 (PR1 시작)

**Files:**

- Create: `packages/core/src/pipeline/persist-from-collector.ts`
- Reference: `packages/core/src/pipeline/persist.ts:22-181` (재사용할 기존 함수들)

- [ ] **Step 1: 작업 브랜치 생성**

```bash
git checkout -b fix/subscription-pipeline-phase1-pr1
```

- [ ] **Step 2: 신규 파일 작성**

`packages/core/src/pipeline/persist-from-collector.ts` 생성:

```typescript
// 구독 단축 경로(useCollectorLoader=true)에서 collector가 반환한 fullset payload를
// 분석 DB의 articles/comments/videos에 upsert하고, article_jobs/comment_jobs/video_jobs
// linkage 테이블에 INSERT한다.
//
// 일반 경로의 collect → normalize → persist 잡을 우회하므로, persist만 별도로 호출해서
// linkage가 비는 결함(job 271 사례)을 막는다.
import { persistArticles, persistVideos, persistComments } from './persist';
import type { articles, videos, comments } from '../db/schema/collections';

export type CollectorFullsetPayload = {
  articles: (typeof articles.$inferInsert)[];
  videos: (typeof videos.$inferInsert)[];
  comments: (typeof comments.$inferInsert)[];
};

export type PersistFromCollectorResult = {
  articles: number;
  videos: number;
  comments: number;
};

/**
 * collector payload를 분석 DB로 영속화 + linkage 채우기.
 *
 * - 본문은 onConflictDoUpdate로 갱신 (`persistArticles` 등 재사용)
 * - linkage(article_jobs/video_jobs/comment_jobs)는 onConflictDoNothing — 같은 잡 재실행 안전
 * - 트랜잭션은 테이블별로 분리(기존 패턴 유지) — articles 실패 시 comments는 롤백 안 됨
 */
export async function persistFromCollectorPayload(
  jobId: number,
  payload: CollectorFullsetPayload,
): Promise<PersistFromCollectorResult> {
  const [articleRows, videoRows, commentRows] = await Promise.all([
    persistArticles(jobId, payload.articles),
    persistVideos(jobId, payload.videos),
    persistComments(jobId, payload.comments),
  ]);
  return {
    articles: articleRows.length,
    videos: videoRows.length,
    comments: commentRows.length,
  };
}
```

- [ ] **Step 3: 단위 테스트 작성 (실패 확인용)**

`packages/core/tests/persist-from-collector.test.ts` 생성:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { persistFromCollectorPayload } from '../src/pipeline/persist-from-collector';

vi.mock('../src/pipeline/persist', () => ({
  persistArticles: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
  persistVideos: vi.fn().mockResolvedValue([{ id: 10 }]),
  persistComments: vi.fn().mockResolvedValue([{ id: 100 }, { id: 101 }, { id: 102 }]),
}));

describe('persistFromCollectorPayload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns counts for each table', async () => {
    const result = await persistFromCollectorPayload(42, {
      articles: [{ source: 'naver-news', sourceId: 'a1', url: 'u', title: 't' } as never],
      videos: [{ source: 'youtube', sourceId: 'v1', url: 'u', title: 't' } as never],
      comments: [{ source: 'naver-comments', sourceId: 'c1', content: 'x' } as never],
    });
    expect(result).toEqual({ articles: 2, videos: 1, comments: 3 });
  });

  it('handles empty payload', async () => {
    const { persistArticles } = await import('../src/pipeline/persist');
    (persistArticles as never as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const result = await persistFromCollectorPayload(42, {
      articles: [],
      videos: [],
      comments: [],
    });
    expect(result.articles).toBe(0);
  });

  it('passes jobId to all three persist functions', async () => {
    const persist = await import('../src/pipeline/persist');
    await persistFromCollectorPayload(99, { articles: [], videos: [], comments: [] });
    expect(persist.persistArticles).toHaveBeenCalledWith(99, []);
    expect(persist.persistVideos).toHaveBeenCalledWith(99, []);
    expect(persist.persistComments).toHaveBeenCalledWith(99, []);
  });
});
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd packages/core && pnpm vitest run tests/persist-from-collector.test.ts`
Expected: 3 passed

- [ ] **Step 5: lint & typecheck**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm lint && pnpm -F @ais/core typecheck`
Expected: no errors

- [ ] **Step 6: 커밋**

```bash
git add packages/core/src/pipeline/persist-from-collector.ts packages/core/tests/persist-from-collector.test.ts
git commit -m "feat(core): add persistFromCollectorPayload for subscription path

구독 단축 경로에서 collector fullset을 분석 DB로 영속화 + linkage 채움.
일반 경로의 persistArticles/persistVideos/persistComments를 재사용.
호출자는 아직 없음 — Task 9에서 orchestrator가 호출.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: collector API에 fetchAnalysisPayload procedure 추가 (PR2 시작)

**Files:**

- Modify: `apps/collector/src/server/trpc/items.ts` (파일 끝에 신규 procedure 추가)
- Reference: 같은 파일 `query` procedure (라인 30-200)

- [ ] **Step 1: 새 브랜치 생성 (PR1과 병렬)**

```bash
git checkout main
git checkout -b fix/subscription-pipeline-phase1-pr2
```

- [ ] **Step 2: items.ts 끝 위치에 procedure 추가**

`apps/collector/src/server/trpc/items.ts`의 마지막 procedure 뒤(파일 끝 `});` 직전)에 추가:

```typescript
  /**
   * fetchAnalysisPayload — 분석 측 단축 경로용 통합 RPC.
   *
   * 한 번의 RPC로 두 종류의 데이터를 함께 반환:
   *   - ragSample: RAG 의미검색으로 추린 분석 입력 (≤ ragOptions.topK)
   *   - fullset:   잡에 속한 전체 풀셋 (linkage 복원용, 본문 포함)
   *
   * 분석 측이 article_jobs/comment_jobs INSERT 시 풀셋이 필요하기 때문에
   * 이 procedure를 추가했다 (job 271 사례 — linkage 0건 결함 수정).
   *
   * Phase 2(B-1): sources가 주어지면 source별로 ragSample을 분산 호출.
   */
  fetchAnalysisPayload: publicProcedure
    .input(
      z.object({
        keyword: z.string().min(1),
        dateRange: z.object({
          start: z.string(),
          end: z.string(),
        }),
        sources: z.array(z.string()).optional(),
        subscriptionId: z.number().optional(),
        ragPreset: z.enum(['rag-light', 'rag-standard', 'rag-aggressive']).optional(),
        ragOptions: z
          .object({
            articleVideoTopK: z.number().int().min(1).max(500),
            commentTopK: z.number().int().min(1).max(500),
          })
          .optional(),
        maxContentLength: z.number().int().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const start = new Date(input.dateRange.start);
      const end = new Date(input.dateRange.end);

      // fullset: 윈도우 + subscriptionId(있으면) + sources(있으면) WHERE
      const fullsetConds = [between(rawItems.time, start, end)];
      if (input.subscriptionId) fullsetConds.push(eq(rawItems.subscriptionId, input.subscriptionId));
      if (input.sources?.length) {
        const expanded = input.sources.includes('naver-news')
          ? [...input.sources, 'naver-comments']
          : input.sources;
        fullsetConds.push(inArray(rawItems.source, expanded));
      }

      const fullsetRows = await ctx.db
        .select({
          source: rawItems.source,
          sourceId: rawItems.sourceId,
          itemType: rawItems.itemType,
          url: rawItems.url,
          title: rawItems.title,
          content: rawItems.content,
          author: rawItems.author,
          publisher: rawItems.publisher,
          publishedAt: rawItems.publishedAt,
          parentSourceId: rawItems.parentSourceId,
          metrics: rawItems.metrics,
          time: rawItems.time,
        })
        .from(rawItems)
        .where(and(...fullsetConds))
        .orderBy(desc(rawItems.time))
        .limit(50000); // 안전 상한

      if (input.maxContentLength) truncateContent(fullsetRows, input.maxContentLength);

      // ragSample: ragPreset이 주어지면 source별 분산 RAG 호출 (B-1), 아니면 mode='all' 단일 호출
      let ragSample: typeof fullsetRows = [];
      if (input.ragPreset && input.ragOptions) {
        const sources = input.sources?.length
          ? input.sources
          : ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'];
        const perSourceArticleTopK = Math.max(
          1,
          Math.ceil(input.ragOptions.articleVideoTopK / sources.length),
        );
        const perSourceCommentTopK = Math.max(
          1,
          Math.ceil(input.ragOptions.commentTopK / sources.length),
        );
        const qvec = await embedQuery(input.keyword);
        const distExpr = sql<number>`${rawItems.embedding} <=> ${JSON.stringify(qvec)}::vector`;

        const sourceQueries = sources.flatMap((s) => {
          const articleSrcs = s === 'naver-news' ? ['naver-news'] : [s];
          const commentSrcs = s === 'naver-news' ? ['naver-comments'] : [s];
          return [
            ctx.db
              .select({ ...articleColumns(rawItems), _distance: distExpr })
              .from(rawItems)
              .where(
                and(
                  between(rawItems.time, start, end),
                  input.subscriptionId
                    ? eq(rawItems.subscriptionId, input.subscriptionId)
                    : sql`true`,
                  inArray(rawItems.source, articleSrcs),
                  inArray(rawItems.itemType, ['article', 'video']),
                ),
              )
              .orderBy(distExpr)
              .limit(perSourceArticleTopK),
            ctx.db
              .select({ ...articleColumns(rawItems), _distance: distExpr })
              .from(rawItems)
              .where(
                and(
                  between(rawItems.time, start, end),
                  input.subscriptionId
                    ? eq(rawItems.subscriptionId, input.subscriptionId)
                    : sql`true`,
                  inArray(rawItems.source, commentSrcs),
                  eq(rawItems.itemType, 'comment'),
                ),
              )
              .orderBy(distExpr)
              .limit(perSourceCommentTopK),
          ];
        });
        const results = await Promise.all(sourceQueries);
        // dedup by source+sourceId+itemType
        const seen = new Set<string>();
        for (const rows of results) {
          for (const r of rows as Array<Record<string, unknown>>) {
            const key = `${r.source}::${r.sourceId}::${r.itemType}`;
            if (seen.has(key)) continue;
            seen.add(key);
            ragSample.push(r as never);
          }
        }
        if (input.maxContentLength) truncateContent(ragSample, input.maxContentLength);
      }

      // collectionMeta — source별 카운트
      const sourceCounts: Record<
        string,
        { articles: number; comments: number; videos: number }
      > = {};
      for (const r of fullsetRows) {
        const s = r.source as string;
        if (!sourceCounts[s]) sourceCounts[s] = { articles: 0, comments: 0, videos: 0 };
        if (r.itemType === 'article') sourceCounts[s].articles += 1;
        else if (r.itemType === 'comment') sourceCounts[s].comments += 1;
        else if (r.itemType === 'video') sourceCounts[s].videos += 1;
      }

      return {
        ragSample,
        fullset: fullsetRows,
        collectionMeta: {
          sources: Object.keys(sourceCounts),
          sourceCounts,
          window: { start: input.dateRange.start, end: input.dateRange.end },
        },
      };
    }),
```

(`articleColumns` 헬퍼는 기존 columns 객체를 함수로 재사용 — 같은 파일에서 추출. 헬퍼가 없으면 column 객체를 직접 인라인.)

- [ ] **Step 3: 헬퍼가 필요하면 columns 추출**

`items.ts`에서 기존 `query` procedure의 `columns` 객체를 함수로 빼서 재사용:

```typescript
function articleColumns(t: typeof rawItems) {
  return {
    time: t.time,
    subscriptionId: t.subscriptionId,
    source: t.source,
    sourceId: t.sourceId,
    itemType: t.itemType,
    url: t.url,
    title: t.title,
    content: t.content,
    author: t.author,
    publisher: t.publisher,
    publishedAt: t.publishedAt,
    parentSourceId: t.parentSourceId,
    metrics: t.metrics,
    sentiment: t.sentiment,
    sentimentScore: t.sentimentScore,
    fetchedAt: t.fetchedAt,
    transcript: sql<string | null>`${t.rawPayload}->>'transcript'`.as('transcript'),
    transcriptLang: sql<string | null>`${t.rawPayload}->>'transcriptLang'`.as('transcript_lang'),
    durationSec: sql<number | null>`NULLIF(${t.rawPayload}->>'durationSec', '')::int`.as(
      'duration_sec',
    ),
  };
}
```

기존 `query` procedure도 이 헬퍼를 호출하도록 수정 (DRY).

- [ ] **Step 4: 테스트 작성**

`apps/collector/src/server/trpc/items.test.ts`에 추가 (해당 파일 이미 존재 — describe 블록 추가):

```typescript
describe('fetchAnalysisPayload', () => {
  it('returns ragSample empty when ragPreset is not set', async () => {
    // mock ctx.db로 fullsetRows만 반환되고 ragSample=[]임 검증
    // (실제 SQL은 통합 테스트에서 검증)
  });

  it('source별 분산 호출 — 5소스 입력 시 SQL 호출 10회', async () => {
    // ctx.db.select를 spy로 감싸 호출 횟수 검증
  });

  it('collectionMeta.sourceCounts에 itemType별 카운트', async () => {
    // fullsetRows mock으로 article 3, comment 5, video 1 → counts 검증
  });
});
```

- [ ] **Step 5: 테스트 실행**

Run: `cd apps/collector && pnpm vitest run src/server/trpc/items.test.ts`
Expected: all pass

- [ ] **Step 6: 빌드 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm -F @ais/collector build`
Expected: no errors

- [ ] **Step 7: 커밋**

```bash
git add apps/collector/src/server/trpc/items.ts apps/collector/src/server/trpc/items.test.ts
git commit -m "feat(collector): add fetchAnalysisPayload for subscription analysis

한 RPC로 ragSample(분석 입력) + fullset(linkage 복원용) + collectionMeta를 반환.
Phase 2(B-1) source별 분산 RAG 호출도 이 procedure 안에서 수행.

기존 items.query는 변경하지 않음 — 호출자가 점진적으로 마이그레이션.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: data-loader가 fetchAnalysisPayload를 호출하도록 변경 (PR3 시작)

**Files:**

- Modify: `packages/core/src/analysis/data-loader.ts:154-408`
- Test: `packages/core/tests/p4-collector-rag.test.ts` 확장

- [ ] **Step 1: 새 브랜치 (PR2 머지 후)**

```bash
git checkout main
git pull
git checkout -b fix/subscription-pipeline-phase1-pr3
```

- [ ] **Step 2: 응답 타입 확장**

`packages/core/src/analysis/data-loader.ts` 상단에 타입 추가:

```typescript
export type CollectorFullset = {
  articles: (typeof articles.$inferInsert)[];
  videos: (typeof videos.$inferInsert)[];
  comments: (typeof comments.$inferInsert)[];
};

export type CollectionMeta = {
  sources: string[];
  sourceCounts: Record<string, { articles: number; comments: number; videos: number }>;
  window: { start: string; end: string };
};

export type CollectorAnalysisResult = {
  input: AnalysisInput;
  samplingStats: AppliedSamplingStats;
  fullset: CollectorFullset;
  collectionMeta: CollectionMeta;
};
```

- [ ] **Step 3: loadAnalysisInputFromCollector를 fetchAnalysisPayload 호출로 교체**

`packages/core/src/analysis/data-loader.ts:195-408`을 다음으로 교체:

```typescript
export async function loadAnalysisInputFromCollector(
  opts: LoadFromCollectorOptions,
): Promise<CollectorAnalysisResult> {
  const client = getCollectorClient();
  const maxContentLength = opts.maxContentLength ?? MAX_ARTICLE_CONTENT_LENGTH;

  const ragConfig: RAGConfig | null = opts.ragPreset ? RAG_CONFIGS[opts.ragPreset] : null;
  const articleVideoTarget = ragConfig
    ? ragConfig.articleTopK + ragConfig.clusterRepresentatives
    : 0;
  const commentTarget = ragConfig?.commentTopK ?? 0;
  const RAG_TOPK_CAP = 500;
  const articleVideoTopK = Math.min(articleVideoTarget * 3, RAG_TOPK_CAP);
  const commentTopK = Math.min(commentTarget * 3, RAG_TOPK_CAP);

  // 단일 RPC: ragSample + fullset + collectionMeta
  const resp = await client.items.fetchAnalysisPayload.query({
    keyword: opts.keyword,
    dateRange: {
      start: opts.dateRange.start.toISOString(),
      end: opts.dateRange.end.toISOString(),
    },
    sources: opts.sources,
    subscriptionId: opts.subscriptionId,
    ragPreset: opts.ragPreset,
    ragOptions: ragConfig ? { articleVideoTopK, commentTopK } : undefined,
    maxContentLength,
  });

  // ragSample → AnalysisInput
  const articlesOut = resp.ragSample
    .filter((i) => i.itemType === 'article' && i.title)
    .map((a) => ({
      title: a.title as string,
      content: a.content,
      publisher: a.publisher,
      publishedAt: toDate(a.publishedAt),
      source: a.source,
    }));

  const videosOut = resp.ragSample
    .filter((i) => i.itemType === 'video' && i.title)
    .map((v) => ({
      title: v.title as string,
      description: v.content,
      channelTitle: v.publisher,
      viewCount: v.metrics?.viewCount ?? null,
      likeCount: v.metrics?.likeCount ?? null,
      publishedAt: toDate(v.publishedAt),
      content: v.content,
    }));

  const commentsOut = resp.ragSample
    .filter((c) => c.itemType === 'comment' && c.content)
    .map((c) => ({
      content: c.content as string,
      source: c.source,
      author: c.author,
      likeCount: c.metrics?.likeCount ?? null,
      dislikeCount: null,
      publishedAt: toDate(c.publishedAt),
    }));

  const rawInput: AnalysisInput = {
    jobId: opts.jobId,
    keyword: opts.keyword,
    articles: articlesOut,
    videos: videosOut,
    comments: commentsOut,
    dateRange: { start: opts.dateRange.start, end: opts.dateRange.end },
    domain: opts.domain,
  };

  const budget = calculateBudget({
    dateRange: rawInput.dateRange,
    totalArticles: rawInput.articles.length,
    totalComments: rawInput.comments.length,
    totalVideos: rawInput.videos.length,
  });
  const sampled = applyTimeSeriesSampling(rawInput, budget);

  // fullset → DB upsert 형태로 변환
  const fullset = mapFullsetToInsertShape(resp.fullset, opts.jobId);

  return {
    input: sampled.input,
    samplingStats: sampled.stats,
    fullset,
    collectionMeta: resp.collectionMeta,
  };
}

function toDate(d: string | Date | null): Date {
  if (!d) return new Date(0);
  return d instanceof Date ? d : new Date(d);
}

function mapFullsetToInsertShape(
  rows: Array<Record<string, unknown>>,
  jobId: number,
): CollectorFullset {
  const articles: (typeof articlesTable.$inferInsert)[] = [];
  const videos: (typeof videosTable.$inferInsert)[] = [];
  const comments: (typeof commentsTable.$inferInsert)[] = [];
  for (const r of rows) {
    const itemType = r.itemType as string;
    const base = {
      jobId,
      source: r.source as string,
      sourceId: r.sourceId as string,
      url: (r.url as string) ?? '',
      title: (r.title as string) ?? '',
    };
    if (itemType === 'article') {
      articles.push({
        ...base,
        content: (r.content as string) ?? null,
        author: (r.author as string) ?? null,
        publisher: (r.publisher as string) ?? null,
        publishedAt: r.publishedAt ? new Date(r.publishedAt as string) : null,
        rawData: null,
      } as never);
    } else if (itemType === 'video') {
      videos.push({
        ...base,
        description: (r.content as string) ?? null,
        channelTitle: (r.publisher as string) ?? null,
        viewCount: ((r.metrics as Record<string, number> | null)?.viewCount as number) ?? null,
        likeCount: ((r.metrics as Record<string, number> | null)?.likeCount as number) ?? null,
        commentCount:
          ((r.metrics as Record<string, number> | null)?.commentCount as number) ?? null,
        publishedAt: r.publishedAt ? new Date(r.publishedAt as string) : null,
        durationSec: (r.durationSec as number) ?? null,
        transcript: (r.transcript as string) ?? null,
        transcriptLang: (r.transcriptLang as string) ?? null,
        rawData: null,
      } as never);
    } else if (itemType === 'comment') {
      comments.push({
        jobId,
        source: r.source as string,
        sourceId: r.sourceId as string,
        content: (r.content as string) ?? '',
        author: (r.author as string) ?? null,
        likeCount: ((r.metrics as Record<string, number> | null)?.likeCount as number) ?? 0,
        dislikeCount: 0,
        publishedAt: r.publishedAt ? new Date(r.publishedAt as string) : null,
        parentId: (r.parentSourceId as string) ?? null,
        rawData: null,
      } as never);
    }
  }
  return { articles, videos, comments };
}
```

(import 추가: `articles as articlesTable, videos as videosTable, comments as commentsTable from '../db/schema/collections'`)

- [ ] **Step 4: loadAnalysisInputViaCollector 시그니처 동기화**

같은 파일 154-188 라인:

```typescript
export async function loadAnalysisInputViaCollector(
  jobId: number,
): Promise<CollectorAnalysisResult> {
  // 기존 본문 그대로, return loadAnalysisInputFromCollector(...) 만 타입이 자동 전파됨
  // ...
}
```

- [ ] **Step 5: 기존 테스트 확장**

`packages/core/tests/p4-collector-rag.test.ts`에 케이스 추가:

```typescript
it('returns fullset alongside input', async () => {
  // mock collector client → fetchAnalysisPayload returns ragSample(2) + fullset(5)
  const result = await loadAnalysisInputViaCollector(1);
  expect(result.fullset).toBeDefined();
  expect(result.fullset.articles.length + result.fullset.comments.length + result.fullset.videos.length).toBeGreaterThan(0);
});

it('source별 분산 호출 시 5개 sources에 대해 ragSample이 dedup되어 반환', async () => {
  // sources=['naver-news','youtube','dcinside','fmkorea','clien'] mock
  const result = await loadAnalysisInputFromCollector({...});
  // dedup 결과 length가 sum(perSourceTopK*2)보다 작거나 같음
});
```

- [ ] **Step 6: 테스트 실행**

Run: `cd packages/core && pnpm vitest run tests/p4-collector-rag.test.ts`
Expected: 모든 케이스 통과

- [ ] **Step 7: lint & typecheck**

Run: `pnpm lint && pnpm -F @ais/core typecheck`

- [ ] **Step 8: 커밋**

```bash
git add packages/core/src/analysis/data-loader.ts packages/core/tests/p4-collector-rag.test.ts
git commit -m "feat(core): data-loader uses collector fetchAnalysisPayload

ragSample + fullset을 한 번에 받아 분석 입력 + linkage 복원 둘 다 가능.
source별 분산 호출(B-1)은 collector 측에서 수행.
호출자(orchestrator)는 다음 PR에서 fullset을 사용.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Phase 2 source별 분산 동작 회귀 테스트 (PR3 일부)

**Files:**

- Create: `packages/core/tests/data-loader-rag-fanout.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { loadAnalysisInputFromCollector } from '../src/analysis/data-loader';

const mockQuery = vi.fn();
vi.mock('../src/clients/collector-client', () => ({
  getCollectorClient: () => ({
    items: { fetchAnalysisPayload: { query: mockQuery } },
  }),
}));

describe('source별 분산 RAG 호출 (Phase 2 B-1)', () => {
  it('5개 sources 입력 시 ragSample은 dedup되어 합쳐짐', async () => {
    mockQuery.mockResolvedValueOnce({
      ragSample: [
        {
          source: 'naver-news',
          sourceId: 'n1',
          itemType: 'article',
          title: 't',
          content: 'c',
          publisher: null,
          publishedAt: '2026-04-20',
          author: null,
          metrics: null,
          parentSourceId: null,
          url: 'u',
        },
        {
          source: 'dcinside',
          sourceId: 'd1',
          itemType: 'article',
          title: 't',
          content: 'c',
          publisher: null,
          publishedAt: '2026-04-20',
          author: null,
          metrics: null,
          parentSourceId: null,
          url: 'u',
        },
      ],
      fullset: [],
      collectionMeta: {
        sources: ['naver-news', 'dcinside'],
        sourceCounts: {},
        window: { start: '', end: '' },
      },
    });

    const result = await loadAnalysisInputFromCollector({
      jobId: 1,
      keyword: '테스트',
      dateRange: { start: new Date('2026-04-19'), end: new Date('2026-04-26') },
      sources: ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'],
      ragPreset: 'rag-standard',
    });

    expect(result.input.articles.length).toBe(2);
  });

  it('ragPreset 미지정이면 mode=all + 단일 호출', async () => {
    mockQuery.mockResolvedValueOnce({
      ragSample: [],
      fullset: [
        {
          source: 'naver-news',
          sourceId: 'n1',
          itemType: 'article',
          title: 't',
          content: 'c',
          url: 'u',
        },
      ],
      collectionMeta: { sources: ['naver-news'], sourceCounts: {}, window: { start: '', end: '' } },
    });

    const result = await loadAnalysisInputFromCollector({
      jobId: 1,
      keyword: '테스트',
      dateRange: { start: new Date('2026-04-19'), end: new Date('2026-04-26') },
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(result.fullset.articles.length).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실행**

Run: `cd packages/core && pnpm vitest run tests/data-loader-rag-fanout.test.ts`
Expected: 2 passed

- [ ] **Step 3: 커밋**

```bash
git add packages/core/tests/data-loader-rag-fanout.test.ts
git commit -m "test(core): verify source별 분산 RAG 호출 동작

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 4: PR3 푸시·머지**

```bash
git push -u origin fix/subscription-pipeline-phase1-pr3
gh pr create --title "feat(core): Phase 1 PR3 — data-loader uses fetchAnalysisPayload + Phase 2 fan-out" \
  --body "spec: docs/superpowers/specs/2026-04-26-subscription-pipeline-data-loss-fix-design.md
Phase 1 (data-loader 부분) + Phase 2 (B-1 source별 분산)을 한 PR로.
PR2(collector fetchAnalysisPayload) 머지 후에만 머지 가능.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

### Task 5: triggerSubscription이 appliedPreset/limits/options.sources 채움 (PR4 시작)

**Files:**

- Modify: `apps/web/src/server/trpc/routers/analysis.ts:302-374`

- [ ] **Step 1: 새 브랜치 (PR1 + PR3 머지 후)**

```bash
git checkout main
git pull
git checkout -b fix/subscription-pipeline-phase1-pr4
```

- [ ] **Step 2: triggerSubscription 본문 수정**

`apps/web/src/server/trpc/routers/analysis.ts:337-374`를 다음으로 교체:

```typescript
    .mutation(async ({ ctx, input }) => {
      // 1. 구독 검증
      const sub = await getCollectorClient().subscriptions.get.query({
        id: input.subscriptionId,
      });
      if (!sub || sub.ownerId !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '해당 구독에 접근할 수 없습니다.' });
      }
      if (sub.status !== 'active') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '비활성 구독입니다.' });
      }

      // 2. 운영 가시성을 위한 메타 합성
      //    - sub.sources, sub.limits를 collection_jobs에 스냅샷
      //    - 프리셋이 직접 연결돼 있지 않으면 __subscription__ 합성 객체로 채워서
      //      analysis_presets 조회 없이도 모니터링/재실행에서 의미를 보존
      const subscriptionSources = (sub.sources ?? []) as string[];
      const subscriptionLimits = (sub.limits ?? {}) as Record<string, number>;
      const tokenOptimization = input.optimizationPreset ?? 'rag-standard';

      const appliedPreset = {
        slug: '__subscription__',
        title: `구독 #${input.subscriptionId} (${sub.keyword})`,
        sources: subscriptionSources.reduce(
          (acc: Record<string, boolean>, s: string) => {
            acc[s] = true;
            return acc;
          },
          {},
        ),
        limits: {
          naverArticles: subscriptionLimits.naverArticles ?? subscriptionLimits.maxPerRun ?? 500,
          youtubeVideos: subscriptionLimits.youtubeVideos ?? subscriptionLimits.maxPerRun ?? 50,
          communityPosts: subscriptionLimits.communityPosts ?? subscriptionLimits.maxPerRun ?? 100,
          commentsPerItem: subscriptionLimits.commentsPerItem ?? 200,
        },
        optimization: tokenOptimization,
        skippedModules: [],
        enableItemAnalysis: false,
        customized: true,
      };

      // 3. collection_jobs 레코드 생성
      const [job] = await ctx.db
        .insert(collectionJobs)
        .values({
          keyword: sub.keyword,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          status: 'running',
          domain: input.domain || sub.domain || 'general',
          userId: ctx.userId,
          appliedPreset,
          limits: appliedPreset.limits,
          options: {
            subscriptionId: input.subscriptionId,
            skipItemAnalysis: true,
            useCollectorLoader: true,
            tokenOptimization,
            sources: subscriptionSources, // ← 신규: collector API에 전달용 스냅샷
          },
        })
        .returning({ id: collectionJobs.id });

      if (!job) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '잡 생성 실패' });

      // 4. 단축 경로 — analysis 큐에 직접 등록
      await triggerSubscriptionAnalysis(job.id, sub.keyword);

      return { jobId: job.id, keyword: sub.keyword };
    }),
```

- [ ] **Step 3: collectionJobs.options 타입 확장**

`packages/core/src/db/schema/collections.ts:60-71`에 `sources?: string[]` 추가:

```typescript
options: jsonb('options').$type<{
  collectTranscript?: boolean;
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
  sources?: string[]; // ← 신규: 구독 경로에서 sub.sources 스냅샷
}>(),
```

- [ ] **Step 4: 단위 테스트**

`apps/web/src/server/trpc/routers/__tests__/analysis-trigger-subscription.test.ts` (신규):

```typescript
import { describe, it, expect, vi } from 'vitest';
// ... ctx mock + collector client mock
describe('triggerSubscription', () => {
  it('appliedPreset/limits/options.sources를 채워 collection_jobs INSERT', async () => {
    // mock sub: sources=['naver-news','clien','dcinside','fmkorea','youtube']
    // 호출 후 ctx.db.insert 인자 검증
    expect(insertedRow.appliedPreset).not.toBeNull();
    expect(insertedRow.appliedPreset.slug).toBe('__subscription__');
    expect(insertedRow.options.sources).toEqual([
      'naver-news',
      'clien',
      'dcinside',
      'fmkorea',
      'youtube',
    ]);
    expect(insertedRow.limits).toBeDefined();
  });
});
```

- [ ] **Step 5: 테스트 실행**

Run: `cd apps/web && pnpm vitest run src/server/trpc/routers/__tests__/analysis-trigger-subscription.test.ts`
Expected: pass

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/server/trpc/routers/analysis.ts \
        apps/web/src/server/trpc/routers/__tests__/analysis-trigger-subscription.test.ts \
        packages/core/src/db/schema/collections.ts
git commit -m "feat(web): triggerSubscription stores appliedPreset/limits/options.sources

운영 가시성: 구독 잡도 일반 잡과 동일한 메타데이터를 collection_jobs에 보유.
sources는 collector API 호출 시 분석측에서 사용 (다음 task에서 활성).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: orchestrator가 persistFromCollectorPayload 호출 + sources 전달 (PR4 계속)

**Files:**

- Modify: `packages/core/src/analysis/pipeline-orchestrator.ts:86-95`
- Modify: `packages/core/src/analysis/data-loader.ts:154-188` (loadAnalysisInputViaCollector — sources 전달)

- [ ] **Step 1: data-loader가 options.sources를 collector API로 전달**

`packages/core/src/analysis/data-loader.ts:177-187` 수정:

```typescript
return loadAnalysisInputFromCollector({
  jobId,
  keyword: job.keyword,
  dateRange: {
    start: ensureDate(job.startDate),
    end: ensureDate(job.endDate),
  },
  domain: (job.domain as AnalysisDomain) || undefined,
  subscriptionId: (opts?.subscriptionId as number) || undefined,
  sources: opts?.sources as string[] | undefined, // ← 신규
  ragPreset,
});
```

(`LoadFromCollectorOptions` 타입에 `sources?: string[]` 추가 필요 — 같은 파일 상단)

- [ ] **Step 2: orchestrator 수정**

`packages/core/src/analysis/pipeline-orchestrator.ts:86-95` 부근:

```typescript
const isCollectorPath =
  options?.useCollectorLoader || jobOptions.useCollectorLoader || shouldUseCollectorLoader();
const loadResult = isCollectorPath
  ? await loadAnalysisInputViaCollector(jobId)
  : await loadAnalysisInput(jobId);
let input = loadResult.input;
const samplingStats = loadResult.samplingStats;

// 구독 단축 경로에서도 article_jobs/comment_jobs/video_jobs를 채워
// RAG SQL과 UI 카운트가 일반 경로와 동일한 의미를 갖도록 보장.
// (job 271 사례 — linkage 0건 결함 수정)
if (isCollectorPath && 'fullset' in loadResult) {
  await updateJobProgress(jobId, {
    persist: { status: 'running', source: 'collector' },
  });
  const persistResult = await persistFromCollectorPayload(jobId, loadResult.fullset);
  await updateJobProgress(jobId, {
    persist: {
      status: 'completed',
      source: 'collector',
      articles: persistResult.articles,
      videos: persistResult.videos,
      comments: persistResult.comments,
    },
  });
}
```

(import 추가: `import { persistFromCollectorPayload } from '../pipeline/persist-from-collector';`)

- [ ] **Step 3: 단위 테스트**

`packages/core/tests/analysis-runner.test.ts`에 케이스 추가 — useCollectorLoader=true이고 fullset이 있으면 persistFromCollectorPayload 호출 검증:

```typescript
it('useCollectorLoader=true → persistFromCollectorPayload 호출', async () => {
  // mock loadAnalysisInputViaCollector → returns { input, samplingStats, fullset: { articles: [a1], videos: [], comments: [c1] } }
  // mock persistFromCollectorPayload spy
  // run pipeline
  expect(persistFromCollectorPayload).toHaveBeenCalledWith(
    jobId,
    expect.objectContaining({ articles: [a1], comments: [c1] }),
  );
});
```

- [ ] **Step 4: 테스트 실행**

Run: `cd packages/core && pnpm vitest run tests/analysis-runner.test.ts`

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/analysis/data-loader.ts \
        packages/core/src/analysis/pipeline-orchestrator.ts \
        packages/core/tests/analysis-runner.test.ts
git commit -m "feat(core): orchestrator persists collector fullset on subscription path

useCollectorLoader=true 경로에서 분석 직전 article_jobs/comment_jobs/video_jobs를
채워 RAG SQL이 의미검색 폴백을 안 타도록 보장.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: 271 회귀 통합 테스트 (PR4 머지 게이트)

**Files:**

- Create: `packages/core/tests/integration/subscription-pipeline.test.ts`

- [ ] **Step 1: 통합 테스트 작성**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../../src/db';
import {
  collectionJobs,
  articles,
  comments,
  articleJobs,
  commentJobs,
} from '../../src/db/schema/collections';
import { runAnalysisPipeline } from '../../src/analysis/pipeline-orchestrator';
import { eq } from 'drizzle-orm';

// 통합: 실제 DB(테스트 컨테이너 또는 ais-dev) + collector mock
describe('integration — 구독 경로 데이터 정합성 (271 회귀)', () => {
  let jobId: number;

  beforeAll(async () => {
    // collector client mock — 271 패턴 페이로드 (1110 articles + 22031 comments)을
    // 줄여서 100 articles + 1000 comments로 시드
    setMockCollectorPayload({
      ragSample: generateRagSample(100, 200, 50), // articles, comments, videos
      fullset: generateFullset(100, 1000, 50),
      collectionMeta: {
        sources: ['naver-news', 'dcinside', 'fmkorea', 'clien', 'youtube'],
        sourceCounts: {},
        window: { start: '', end: '' },
      },
    });

    // collection_jobs INSERT (구독 경로처럼)
    const [job] = await getDb()
      .insert(collectionJobs)
      .values({
        keyword: '한동훈',
        startDate: new Date('2026-04-19'),
        endDate: new Date('2026-04-26'),
        status: 'running',
        domain: 'political',
        userId: 'test-user',
        appliedPreset: {
          slug: '__subscription__',
          title: 'test',
          sources: { 'naver-news': true },
          limits: {
            naverArticles: 500,
            youtubeVideos: 50,
            communityPosts: 100,
            commentsPerItem: 200,
          },
          optimization: 'rag-standard',
          skippedModules: [],
          enableItemAnalysis: false,
          customized: true,
        } as never,
        limits: {
          naverArticles: 500,
          youtubeVideos: 50,
          communityPosts: 100,
          commentsPerItem: 200,
        } as never,
        options: {
          subscriptionId: 999,
          skipItemAnalysis: true,
          useCollectorLoader: true,
          tokenOptimization: 'rag-standard',
          sources: ['naver-news', 'dcinside', 'fmkorea', 'clien', 'youtube'],
        } as never,
      })
      .returning({ id: collectionJobs.id });
    jobId = job!.id;
  });

  afterAll(async () => {
    await getDb().delete(collectionJobs).where(eq(collectionJobs.id, jobId));
  });

  it('article_jobs/comment_jobs/video_jobs가 채워진다', async () => {
    await runAnalysisPipeline(jobId, { useCollectorLoader: true });

    const articleCount = await getDb()
      .select({ c: count() })
      .from(articleJobs)
      .where(eq(articleJobs.jobId, jobId));
    const commentCount = await getDb()
      .select({ c: count() })
      .from(commentJobs)
      .where(eq(commentJobs.jobId, jobId));

    expect(articleCount[0].c).toBeGreaterThanOrEqual(100);
    expect(commentCount[0].c).toBeGreaterThanOrEqual(1000);
  });

  it('appliedPreset이 NULL이 아니다', async () => {
    const [job] = await getDb().select().from(collectionJobs).where(eq(collectionJobs.id, jobId));
    expect(job!.appliedPreset).not.toBeNull();
  });

  it('progress.persist.status === completed', async () => {
    const [job] = await getDb().select().from(collectionJobs).where(eq(collectionJobs.id, jobId));
    const progress = job!.progress as { persist?: { status?: string } };
    expect(progress.persist?.status).toBe('completed');
  });
});
```

- [ ] **Step 2: 테스트 실행**

Run: `cd packages/core && pnpm vitest run tests/integration/subscription-pipeline.test.ts`
Expected: 3 passed

- [ ] **Step 3: 커밋 + PR4 푸시**

```bash
git add packages/core/tests/integration/subscription-pipeline.test.ts
git commit -m "test(core): 271 regression — subscription path data integrity

Co-Authored-By: Claude <noreply@anthropic.com>"
git push -u origin fix/subscription-pipeline-phase1-pr4
gh pr create --title "feat: Phase 1 PR4 — subscription pipeline data integrity (271 회귀 게이트)" \
  --body "spec: docs/superpowers/specs/2026-04-26-subscription-pipeline-data-loss-fix-design.md
이 PR이 머지되면 구독 경로 잡도 article_jobs/comment_jobs를 채움.
271 회귀 통합 테스트가 머지 게이트.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Phase 3 — 운영 가시성 (PR5)

### Task 8: quality-metadata 빌더 작성

**Files:**

- Create: `packages/core/src/analysis/quality-metadata.ts`
- Create: `packages/core/tests/quality-metadata.test.ts`

- [ ] **Step 1: 새 브랜치 (PR1과 병렬 가능)**

```bash
git checkout main
git checkout -b fix/subscription-pipeline-phase3-pr5
```

- [ ] **Step 2: 신규 파일 작성**

`packages/core/src/analysis/quality-metadata.ts`:

```typescript
// analysis_reports.metadata에 부분 실패/경고 정보를 채우는 빌더.
// 보고서 markdown에 footer를 append하는 헬퍼도 함께.
//
// 출처:
//   - collection_jobs.progress._events (level === 'warn')
//   - collection_jobs.progress.sampling.{articles,comments}.totalSampled
//
// schema 변경 없음 — analysis_reports.metadata는 jsonb.

const SAMPLING_SHALLOW_THRESHOLD = 200;
const CHUNK_FAILURE_RE = /^([\w-]+) 청크 분석 실패.*Last error: (.+?)\.?$/;

export type ModulePartial = {
  module: string;
  reason: 'rate-limit' | 'parse-error' | 'unknown';
  chunksTotal: number | null;
  chunksFailed: number | null;
};

export type QualityWarning = {
  ts: string;
  phase: string | null;
  module: string | null;
  level: 'warn';
  msg: string;
};

export type QualityFlags = {
  hasRateLimitFailures: boolean;
  hasPartialModules: boolean;
  samplingShallow: boolean;
};

export type QualityMetadata = {
  modulesPartial: ModulePartial[];
  warnings: QualityWarning[];
  qualityFlags: QualityFlags;
};

export function buildQualityMetadata(
  progress: Record<string, unknown> | null | undefined,
): QualityMetadata {
  const events =
    (progress?._events as Array<{ ts: string; level: string; msg: string }> | undefined) ?? [];
  const warns = events.filter((e) => e.level === 'warn');

  const modulesPartial: ModulePartial[] = [];
  const seen = new Set<string>();
  for (const w of warns) {
    const m = w.msg.match(CHUNK_FAILURE_RE);
    if (!m) continue;
    const [, mod, lastErr] = m;
    if (seen.has(mod)) continue;
    seen.add(mod);
    const reason: ModulePartial['reason'] = /capacity|exhausted|quota/.test(lastErr)
      ? 'rate-limit'
      : /parse|json/i.test(lastErr)
        ? 'parse-error'
        : 'unknown';
    modulesPartial.push({ module: mod, reason, chunksTotal: null, chunksFailed: null });
  }

  const warnings: QualityWarning[] = warns.map((w) => {
    const m = w.msg.match(CHUNK_FAILURE_RE);
    return {
      ts: w.ts,
      phase: m ? 'analysis' : null,
      module: m?.[1] ?? null,
      level: 'warn',
      msg: w.msg,
    };
  });

  const sampling = progress?.sampling as
    | {
        articles?: { totalSampled?: number };
        comments?: { totalSampled?: number };
      }
    | undefined;
  const articlesShallow =
    (sampling?.articles?.totalSampled ?? Infinity) < SAMPLING_SHALLOW_THRESHOLD;
  const commentsShallow =
    (sampling?.comments?.totalSampled ?? Infinity) < SAMPLING_SHALLOW_THRESHOLD;

  const qualityFlags: QualityFlags = {
    hasRateLimitFailures: modulesPartial.some((m) => m.reason === 'rate-limit'),
    hasPartialModules: modulesPartial.length > 0,
    samplingShallow: articlesShallow || commentsShallow,
  };

  return { modulesPartial, warnings, qualityFlags };
}

export function appendQualityFooterToMarkdown(markdown: string, meta: QualityMetadata): string {
  const f = meta.qualityFlags;
  if (!f.hasPartialModules && !f.samplingShallow && !f.hasRateLimitFailures) {
    return markdown;
  }

  const lines: string[] = [
    '',
    '---',
    '',
    '## ⚠️ 분석 경고',
    '',
    '이 보고서에는 다음 경고가 포함됩니다:',
    '',
  ];
  if (meta.modulesPartial.length > 0) {
    const mods = meta.modulesPartial.map((m) => m.module).join(', ');
    const reason = meta.modulesPartial.every((m) => m.reason === 'rate-limit')
      ? 'rate-limit으로 일부 청크 분석 누락'
      : '일부 청크 분석 실패';
    lines.push(`- **부분 실패 모듈**: ${mods} (${reason})`);
  }
  if (f.samplingShallow) {
    lines.push(
      `- **얕은 표본**: 분석 입력 중 articles 또는 comments 표본이 ${SAMPLING_SHALLOW_THRESHOLD}건 미만입니다.`,
    );
  }
  lines.push(
    '',
    '자세한 경고 로그는 모니터 페이지의 "분석 경고" 또는 잡 상세의 progress._events를 확인하세요.',
  );
  return markdown.trimEnd() + '\n' + lines.join('\n') + '\n';
}
```

- [ ] **Step 3: 테스트 작성**

`packages/core/tests/quality-metadata.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildQualityMetadata,
  appendQualityFooterToMarkdown,
} from '../src/analysis/quality-metadata';

describe('buildQualityMetadata', () => {
  it('rate-limit warn 4건 + sampling 130 → 모든 flag true', () => {
    const progress = {
      _events: [
        {
          ts: 't1',
          level: 'warn',
          msg: 'segmentation 청크 분석 실패 (계속 진행): Failed after 3 attempts. Last error: You have exhausted your capacity on this model. Your quota will reset after 0s.',
        },
        {
          ts: 't2',
          level: 'warn',
          msg: 'macro-view 청크 분석 실패 (계속 진행): Failed after 3 attempts. Last error: You have exhausted your capacity.',
        },
      ],
      sampling: { articles: { totalSampled: 130 }, comments: { totalSampled: 200 } },
    };
    const m = buildQualityMetadata(progress);
    expect(m.qualityFlags.hasRateLimitFailures).toBe(true);
    expect(m.qualityFlags.hasPartialModules).toBe(true);
    expect(m.qualityFlags.samplingShallow).toBe(true);
    expect(m.modulesPartial).toHaveLength(2);
    expect(m.modulesPartial[0].module).toBe('segmentation');
  });

  it('빈 progress → 모든 flag false', () => {
    const m = buildQualityMetadata({});
    expect(m.qualityFlags.hasRateLimitFailures).toBe(false);
    expect(m.qualityFlags.hasPartialModules).toBe(false);
    expect(m.qualityFlags.samplingShallow).toBe(false);
    expect(m.modulesPartial).toHaveLength(0);
  });

  it('null progress → 모든 flag false', () => {
    const m = buildQualityMetadata(null);
    expect(m.qualityFlags.hasPartialModules).toBe(false);
  });
});

describe('appendQualityFooterToMarkdown', () => {
  it('flags 모두 false → footer 없음', () => {
    const meta = {
      modulesPartial: [],
      warnings: [],
      qualityFlags: {
        hasRateLimitFailures: false,
        hasPartialModules: false,
        samplingShallow: false,
      },
    };
    expect(appendQualityFooterToMarkdown('# 본문', meta)).toBe('# 본문');
  });

  it('hasPartialModules true → footer 포함', () => {
    const meta = {
      modulesPartial: [
        {
          module: 'segmentation',
          reason: 'rate-limit' as const,
          chunksTotal: null,
          chunksFailed: null,
        },
      ],
      warnings: [],
      qualityFlags: { hasRateLimitFailures: true, hasPartialModules: true, samplingShallow: false },
    };
    const out = appendQualityFooterToMarkdown('# 본문', meta);
    expect(out).toContain('## ⚠️ 분석 경고');
    expect(out).toContain('segmentation');
  });
});
```

- [ ] **Step 4: 테스트 실행**

Run: `cd packages/core && pnpm vitest run tests/quality-metadata.test.ts`
Expected: 5 passed

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/analysis/quality-metadata.ts packages/core/tests/quality-metadata.test.ts
git commit -m "feat(core): buildQualityMetadata + appendQualityFooterToMarkdown

analysis_reports.metadata에 부분 실패 정보를 채우고 markdown footer를 자동 append.
호출자(report-builder)는 다음 task에서 연결.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: report-builder가 quality metadata + footer 사용

**Files:**

- Modify: `packages/core/src/analysis/report-builder.ts`

- [ ] **Step 1: 코드 위치 확인**

```bash
rtk grep -n "metadata\|markdownContent\|persistAnalysisReport" /home/gon/projects/ai/ai-signalcraft/packages/core/src/analysis/report-builder.ts | head -20
```

- [ ] **Step 2: report-builder에 quality metadata 통합**

`packages/core/src/analysis/report-builder.ts`의 보고서 build 흐름에서 markdown 생성 직후, persistAnalysisReport 직전에 추가:

```typescript
import { buildQualityMetadata, appendQualityFooterToMarkdown } from './quality-metadata';

// (기존 markdown/oneLiner/totalTokens 빌드 끝난 후)
const qualityMeta = buildQualityMetadata(jobRow.progress as Record<string, unknown>);
const finalMarkdown = appendQualityFooterToMarkdown(report.markdownContent, qualityMeta);

await persistAnalysisReport({
  jobId,
  title,
  markdownContent: finalMarkdown,
  oneLiner: report.oneLiner,
  metadata: {
    keyword: jobRow.keyword,
    dateRange: { start: jobRow.startDate.toISOString(), end: jobRow.endDate.toISOString() },
    generatedAt: new Date().toISOString(),
    reportModel: { model: reportModel, provider: reportProvider },
    totalTokens: report.totalTokens,
    modulesFailed,
    modulesCompleted,
    // === 신규 ===
    modulesPartial: qualityMeta.modulesPartial,
    warnings: qualityMeta.warnings,
    qualityFlags: qualityMeta.qualityFlags,
  },
});
```

(현재 metadata 객체가 어떻게 만들어지는지 코드를 보고, 그 위치에 신규 필드 3개를 추가하면 됨.)

- [ ] **Step 3: 단위 테스트 — 보고서 빌드 시 metadata에 신규 필드**

`packages/core/tests/report.test.ts`(기존)에 케이스 추가:

```typescript
it('progress._events에 청크 실패 warn → metadata.modulesPartial 채워짐', async () => {
  // mock jobRow with progress._events containing rate-limit warns
  // run report-builder
  // assert persistAnalysisReport 인자의 metadata.qualityFlags.hasPartialModules === true
});
```

- [ ] **Step 4: 테스트 실행**

Run: `cd packages/core && pnpm vitest run tests/report.test.ts`
Expected: pass

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/analysis/report-builder.ts packages/core/tests/report.test.ts
git commit -m "feat(core): analysis_reports.metadata gets quality fields + footer

modulesPartial/warnings/qualityFlags가 신규 보고서에 자동 기록.
markdown footer는 qualityFlags 중 하나라도 true면 자동 append.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: UI 배너 컴포넌트

**Files:**

- Create: `apps/web/src/components/quality-warning-banner.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
'use client';
import { useState } from 'react';

type QualityFlags = {
  hasRateLimitFailures: boolean;
  hasPartialModules: boolean;
  samplingShallow: boolean;
};

type ModulePartial = {
  module: string;
  reason: string;
  chunksTotal: number | null;
  chunksFailed: number | null;
};
type QualityWarning = {
  ts: string;
  phase: string | null;
  module: string | null;
  level: 'warn';
  msg: string;
};

type Metadata = {
  modulesPartial?: ModulePartial[];
  warnings?: QualityWarning[];
  qualityFlags?: QualityFlags;
};

type JobProgress = {
  _events?: Array<{ ts: string; level: string; msg: string }>;
} | null;

function deriveFlags(metadata: Metadata | null, progress: JobProgress): QualityFlags | null {
  if (metadata?.qualityFlags) return metadata.qualityFlags;
  if (!progress?._events) return null;
  const warns = progress._events.filter((e) => e.level === 'warn');
  if (warns.length === 0) return null;
  return {
    hasRateLimitFailures: warns.some((w) => /capacity|exhausted|quota/.test(w.msg)),
    hasPartialModules: warns.some((w) => /청크 분석 실패/.test(w.msg)),
    samplingShallow: false,
  };
}

export function QualityWarningBanner(props: {
  metadata: Metadata | null;
  jobProgress: JobProgress;
}) {
  const [open, setOpen] = useState(false);
  const flags = deriveFlags(props.metadata, props.jobProgress);
  if (!flags) return null;
  if (!flags.hasPartialModules && !flags.samplingShallow && !flags.hasRateLimitFailures)
    return null;

  return (
    <div className="rounded-md border border-yellow-500 bg-yellow-50 p-3 text-yellow-900 mb-4">
      <div className="flex items-center justify-between gap-3">
        <span>
          ⚠️ 이 분석에는 일부 모듈이 부분 실패했거나 표본이 얕습니다. 결과 해석 시 주의하세요.
        </span>
        <button onClick={() => setOpen((v) => !v)} className="underline text-sm">
          {open ? '닫기' : '상세 보기'}
        </button>
      </div>
      {open && (
        <div className="mt-3 text-sm">
          {props.metadata?.modulesPartial && props.metadata.modulesPartial.length > 0 && (
            <div>
              <strong>부분 실패 모듈:</strong>
              <ul className="list-disc ml-5">
                {props.metadata.modulesPartial.map((m) => (
                  <li key={m.module}>
                    {m.module} ({m.reason})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {props.metadata?.warnings && props.metadata.warnings.length > 0 && (
            <div className="mt-2">
              <strong>경고 로그:</strong>
              <ul className="list-disc ml-5 max-h-40 overflow-y-auto">
                {props.metadata.warnings.map((w, i) => (
                  <li key={i} className="font-mono text-xs">
                    [{w.ts}] {w.msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 보고서 페이지에서 사용**

`apps/web/src/app/.../report/[id]/page.tsx`(또는 동등 위치) 상단에 배너 삽입:

```tsx
import { QualityWarningBanner } from '@/components/quality-warning-banner';

// 보고서 데이터 fetch 후
return (
  <div>
    <QualityWarningBanner metadata={report.metadata} jobProgress={job.progress} />
    {/* 기존 보고서 본문 */}
  </div>
);
```

- [ ] **Step 3: 모니터 페이지의 잡 row에 ⚠️ 아이콘**

모니터 페이지(`apps/web/src/app/.../monitor/...`)의 잡 row 컴포넌트에서:

```tsx
{
  deriveFlags(null, job.progress)?.hasPartialModules && (
    <span title="부분 실패 모듈 있음" className="ml-2">
      ⚠️
    </span>
  );
}
```

- [ ] **Step 4: 빌드/타입 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm -F @ais/web build`
Expected: no errors

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/components/quality-warning-banner.tsx \
        apps/web/src/app/**/report/**/page.tsx \
        apps/web/src/app/**/monitor/**
git commit -m "feat(web): QualityWarningBanner on report + monitor pages

진행 중 잡은 progress._events, 완료 잡은 metadata.qualityFlags를 출처로 사용.
구버전 보고서(qualityFlags 없는)는 배너 표시 안 함.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 6: PR5 푸시**

```bash
git push -u origin fix/subscription-pipeline-phase3-pr5
gh pr create --title "feat: Phase 3 PR5 — quality metadata + footer + UI banner" \
  --body "spec: docs/superpowers/specs/2026-04-26-subscription-pipeline-data-loss-fix-design.md
analysis_reports.metadata 확장 + markdown footer + UI 배너.
schema 변경 없음(jsonb).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## 마무리

### Task 11: 수동 검증 + 모니터링 (PR6)

**Files:**

- 운영 검증 결과 기록 — `docs/superpowers/plans/2026-04-26-subscription-pipeline-validation-log.md`

- [ ] **Step 1: 모든 PR(PR1–PR5) 머지 확인**

```bash
gh pr list --state merged --search "subscription-pipeline" --limit 10
```

- [ ] **Step 2: 개발 환경에서 새 구독 분석 잡 1회 실행**

웹 UI(`localhost:3000`)에서 subscription 37 같은 패턴으로 trigger. jobId 기록.

- [ ] **Step 3: DB 검증**

```bash
dserver exec ais-prod-postgres psql -U ais -d ai_signalcraft -c "
SELECT id, applied_preset IS NOT NULL AS has_preset, limits IS NOT NULL AS has_limits,
       options->'sources' AS sources,
       progress->'persist'->>'status' AS persist_status
FROM collection_jobs
ORDER BY id DESC LIMIT 5;"

dserver exec ais-prod-postgres psql -U ais -d ai_signalcraft -c "
SELECT job_id, COUNT(*) FROM article_jobs WHERE job_id = <NEW_JOB_ID> GROUP BY job_id;
SELECT job_id, COUNT(*) FROM comment_jobs WHERE job_id = <NEW_JOB_ID> GROUP BY job_id;"

dserver exec ais-prod-postgres psql -U ais -d ai_signalcraft -c "
SELECT metadata->'qualityFlags', metadata->'modulesPartial'
FROM analysis_reports WHERE job_id = <NEW_JOB_ID>;"
```

기대값:

- `has_preset = t`, `has_limits = t`, `sources = ['naver-news', ...]`, `persist_status = 'completed'`.
- `article_jobs.count >= 100` (또는 collector raw_items에 따라 더 많이).
- `qualityFlags`/`modulesPartial`이 jsonb 객체로 존재.

- [ ] **Step 4: 보고서 페이지 UI 확인**

브라우저로 `/reports/<NEW_JOB_ID>` 열어 배너 노출(rate-limit 발생 시) + footer markdown 끝에 "⚠️ 분석 경고" 섹션 확인.

- [ ] **Step 5: 운영 환경 동일 검증**

운영 웹(`http://192.168.0.5:3300`)에서 위 절차 반복.

- [ ] **Step 6: 검증 로그 기록**

```bash
cat > docs/superpowers/plans/2026-04-26-subscription-pipeline-validation-log.md <<'EOF'
# 구독 파이프라인 수정 — 검증 로그

| 항목 | 결과 |
|---|---|
| article_jobs INSERT | OK (실측 N건) |
| comment_jobs INSERT | OK (실측 N건) |
| applied_preset NOT NULL | OK |
| options.sources 저장 | OK |
| progress.persist.status | completed |
| metadata.qualityFlags | 존재 |
| markdown footer | rate-limit 발생 시 노출 |
| UI 배너 | 노출 |
EOF
git add docs/superpowers/plans/2026-04-26-subscription-pipeline-validation-log.md
git commit -m "docs: subscription pipeline fix validation log"
```

---

## Self-Review

본 plan을 spec(`docs/superpowers/specs/2026-04-26-subscription-pipeline-data-loss-fix-design.md`)과 대조 검토.

### Spec coverage 매핑

| Spec 섹션                                          | 구현 Task                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 3.2 (a) triggerSubscription 채움                   | Task 5                                                                             |
| 3.2 (b) collector fetchAnalysisPayload             | Task 2                                                                             |
| 3.2 (c) loadAnalysisInputViaCollector fullset 반환 | Task 3                                                                             |
| 3.2 (d) persistFromCollectorPayload 신규           | Task 1                                                                             |
| 3.2 (e) orchestrator 호출                          | Task 6                                                                             |
| 3.2 (f) collector sources 우선                     | Task 2 (`fetchAnalysisPayload`가 sources 받음) + Task 6 (data-loader가 전달)       |
| 4. Phase 2 B-1 source별 분산                       | Task 2 (collector 측 구현) + Task 4 (회귀 테스트)                                  |
| 5.2 metadata 확장 + 5.3 채우기                     | Task 8                                                                             |
| 5.4 markdown footer                                | Task 8                                                                             |
| 5.5 UI 배너                                        | Task 10                                                                            |
| 5.6 진행 중 잡 처리                                | Task 10 (deriveFlags 함수)                                                         |
| 6.2 271 회귀 통합 테스트                           | Task 7                                                                             |
| 6.4 수동 검증                                      | Task 11                                                                            |
| 6.5 PR 분리                                        | Task 1=PR1, Task 2=PR2, Task 3+4=PR3, Task 5+6+7=PR4, Task 8+9+10=PR5, Task 11=PR6 |

### Placeholder scan

- 모든 step에 실제 코드/명령어 포함됨.
- 모든 file path가 절대/상대 경로로 명시됨.
- "TBD"/"TODO"/"add error handling" 같은 표현 없음.
- 한 가지 예외: Task 10 Step 3에서 모니터 페이지 정확한 파일 경로(`apps/web/src/app/.../monitor/...`)가 추상적 — 구현자가 모니터 페이지 컴포넌트 위치를 grep로 찾아야 함. 이는 의도된 유연성(여러 page.tsx에 분산되어 있을 수 있음).

### Type 일관성

- `CollectorAnalysisResult` (Task 3) → `loadResult.fullset` (Task 6)에서 동일 필드 참조. ✓
- `CollectorFullsetPayload` (Task 1) === `CollectorAnalysisResult['fullset']` (Task 3). 두 타입을 같은 형태로 정의하되 import 경로 다름. 통일 권장 — Task 3에서 Task 1의 타입을 re-export 하거나, 한쪽이 다른 쪽을 import.

→ 인라인 수정: Task 3 Step 2의 `CollectorFullset` 정의를 Task 1의 `CollectorFullsetPayload`와 호환 — Task 3에서 `import type { CollectorFullsetPayload as CollectorFullset } from '../pipeline/persist-from-collector'`로 가져오는 편이 더 깔끔. (구현 시 자유롭게 통일.)

### 결론

spec 모든 요구사항이 task에 매핑됨. 위 type 일관성 메모는 구현자가 자연스럽게 처리 가능한 범위.
