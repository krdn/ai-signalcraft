import { z } from 'zod';
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { collectionRuns, rawItems, runDiagnostics } from '../../db/schema';
import { cancelRun, cancelBySubscription, cancelAll, retryRun } from '../../queue/run-control';
import { collectLayerA } from '../../diagnostics/collect-run';
import { getCollectQueue } from '../../queue/queues';
import { COLLECTOR_SOURCES } from '../../queue/types';
import type { CollectorSource } from '../../queue/types';
import { protectedProcedure, router } from './init';

const SOURCE_ENUM = [
  'naver-news',
  'naver-comments',
  'youtube',
  'dcinside',
  'fmkorea',
  'clien',
] as const;

export const runsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive().optional(),
        status: z.enum(['running', 'completed', 'blocked', 'failed']).optional(),
        sinceHours: z
          .number()
          .int()
          .positive()
          .max(24 * 30)
          .default(24),
        limit: z.number().int().min(1).max(500).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.sinceHours * 3600 * 1000);
      const conds = [gte(collectionRuns.time, since)];
      if (input.subscriptionId) conds.push(eq(collectionRuns.subscriptionId, input.subscriptionId));
      if (input.status) conds.push(eq(collectionRuns.status, input.status));

      const rows = await ctx.db
        .select()
        .from(collectionRuns)
        .where(and(...conds))
        .orderBy(desc(collectionRuns.time))
        .limit(input.limit);
      return rows;
    }),

  itemBreakdown: protectedProcedure
    .input(
      z.object({
        runIds: z.array(z.string().uuid()).min(1).max(1000),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          fetchedFromRun: rawItems.fetchedFromRun,
          source: rawItems.source,
          itemType: rawItems.itemType,
          count: sql<number>`count(*)::int`,
        })
        .from(rawItems)
        .where(inArray(rawItems.fetchedFromRun, input.runIds))
        .groupBy(rawItems.fetchedFromRun, rawItems.source, rawItems.itemType);
      return rows;
    }),

  sentimentBreakdown: protectedProcedure
    .input(
      z.object({
        runIds: z.array(z.string().uuid()).min(1).max(1000),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          fetchedFromRun: rawItems.fetchedFromRun,
          sentiment: rawItems.sentiment,
          count: sql<number>`count(*)::int`,
        })
        .from(rawItems)
        .where(
          and(
            inArray(rawItems.fetchedFromRun, input.runIds),
            sql`${rawItems.sentiment} IS NOT NULL`,
          ),
        )
        .groupBy(rawItems.fetchedFromRun, rawItems.sentiment);
      return rows;
    }),

  get: protectedProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(collectionRuns)
        .where(eq(collectionRuns.runId, input.runId))
        .orderBy(desc(collectionRuns.time));
      return rows;
    }),

  cancel: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM).optional(),
        mode: z.enum(['graceful', 'force']).default('graceful'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const triggeredBy = `user:${(ctx.apiKey ?? 'unknown').slice(0, 8)}`;
      if (input.source) {
        return cancelRun(input.runId, input.source, input.mode, triggeredBy);
      }
      // source 미지정 — 해당 runId의 모든 running source를 순회 cancel
      const sources = await ctx.db
        .select({ source: collectionRuns.source })
        .from(collectionRuns)
        .where(and(eq(collectionRuns.runId, input.runId), eq(collectionRuns.status, 'running')));
      const results = [];
      for (const s of sources) {
        results.push(await cancelRun(input.runId, s.source, input.mode, triggeredBy));
      }
      return { runId: input.runId, results };
    }),

  cancelBySubscription: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive(),
        mode: z.enum(['graceful', 'force']).default('graceful'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const triggeredBy = `user:${(ctx.apiKey ?? 'unknown').slice(0, 8)}`;
      return cancelBySubscription(input.subscriptionId, input.mode, triggeredBy);
    }),

  cancelAll: protectedProcedure
    .input(
      z.object({
        mode: z.enum(['graceful', 'force']).default('graceful'),
        confirm: z.literal('CANCEL_ALL'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const triggeredBy = `user:${(ctx.apiKey ?? 'unknown').slice(0, 8)}`;
      return cancelAll(input.mode, triggeredBy);
    }),

  retry: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const triggeredBy = `user:${(ctx.apiKey ?? 'unknown').slice(0, 8)}`;
      return retryRun(input.runId, input.source, triggeredBy);
    }),

  /**
   * 실시간 진행 상태. /subscriptions/monitor의 LiveRunFeed + run-actions-modal이 2초 폴링.
   *
   * 데이터 소스 우선순위 (liveness 판정):
   *   1) BullMQ job.progress — {itemsCollected, itemsNew, ts}. Primary.
   *   2) collection_runs.last_progress_at — Redis 장애 시 fallback
   *   3) job.processedOn — 워커가 작업을 잡은 시각 (최소 하한)
   *
   * byType은 rawItems에서 직접 COUNT — job.progress는 insert 완료 전에 찍히므로
   * "DB에 실제 적재된 수"를 UI가 교차 검증할 수 있게 한다.
   */
  progress: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { runId, source } = input;
      const jobId = `${runId}-${source}`;

      // 1) BullMQ job — state/progress/timestamps
      let bullState: string = 'unknown';
      let attemptsMade = 0;
      let failedReason: string | null = null;
      let jobProgress: { itemsCollected?: number; itemsNew?: number; ts?: number } = {};
      let processedOnMs: number | null = null;
      let finishedOnMs: number | null = null;
      let timestampMs: number | null = null;
      try {
        const queue = getCollectQueue(source as CollectorSource);
        const job = await queue.getJob(jobId);
        if (job) {
          bullState = await job.getState();
          attemptsMade = job.attemptsMade ?? 0;
          failedReason = job.failedReason ?? null;
          const raw = job.progress;
          if (raw && typeof raw === 'object') {
            jobProgress = raw as typeof jobProgress;
          }
          processedOnMs = job.processedOn ?? null;
          finishedOnMs = job.finishedOn ?? null;
          timestampMs = job.timestamp ?? null;
        }
      } catch (err) {
        // Redis 장애는 degradation — DB fallback으로 계속
        console.warn(
          `[runs.progress] BullMQ 조회 실패 runId=${runId} source=${source}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        bullState = 'unreachable';
      }

      // 2) DB — 최신 collection_runs row + rawItems byType 집계 병렬
      const [runRowResult, byTypeRows] = await Promise.all([
        ctx.db
          .select()
          .from(collectionRuns)
          .where(and(eq(collectionRuns.runId, runId), eq(collectionRuns.source, source)))
          .orderBy(desc(collectionRuns.time))
          .limit(1),
        ctx.db
          .select({
            itemType: rawItems.itemType,
            count: sql<number>`count(*)::int`,
          })
          .from(rawItems)
          .where(and(eq(rawItems.fetchedFromRun, runId), eq(rawItems.source, source)))
          .groupBy(rawItems.itemType),
      ]);
      const [runRow] = runRowResult;

      const byType = { article: 0, video: 0, comment: 0 };
      for (const r of byTypeRows) {
        byType[r.itemType as keyof typeof byType] = r.count;
      }

      // liveness 결정: Redis progress ts → DB last_progress_at → job.processedOn
      const dbLastProgressMs = runRow?.lastProgressAt ? runRow.lastProgressAt.getTime() : null;
      const lastProgressAtMs =
        jobProgress.ts && dbLastProgressMs
          ? Math.max(jobProgress.ts, dbLastProgressMs)
          : (jobProgress.ts ?? dbLastProgressMs ?? processedOnMs);

      // itemsCollected/itemsNew도 Redis 우선, 없으면 DB
      const itemsCollected = jobProgress.itemsCollected ?? runRow?.itemsCollected ?? 0;
      const itemsNew = jobProgress.itemsNew ?? runRow?.itemsNew ?? 0;

      const startedAtMs = runRow?.time?.getTime() ?? timestampMs ?? null;
      const elapsedMs =
        finishedOnMs && startedAtMs
          ? finishedOnMs - startedAtMs
          : startedAtMs
            ? Date.now() - startedAtMs
            : 0;

      return {
        runId,
        source,
        status: runRow?.status ?? null,
        bullState,
        attemptsMade,
        itemsCollected,
        itemsNew,
        byType,
        lastProgressAtMs,
        processedOnMs,
        finishedOnMs,
        elapsedMs,
        failedReason,
      };
    }),

  diagnose: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM).optional(),
        refresh: z.boolean().default(false),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (input.refresh && input.source) {
        // 강제 새로고침 — Layer A 재수집 후 신규 row insert
        const layerA = await collectLayerA(input.runId, input.source);
        const [row] = await ctx.db
          .insert(runDiagnostics)
          .values({
            runId: input.runId,
            source: input.source,
            triggeredBy: 'manual',
            layerA,
          })
          .returning();
        return row;
      }
      // 최신 진단 row 조회 — source 옵션으로 필터 가능
      const conds = [eq(runDiagnostics.runId, input.runId)];
      if (input.source) conds.push(eq(runDiagnostics.source, input.source));
      const [row] = await ctx.db
        .select()
        .from(runDiagnostics)
        .where(and(...conds))
        .orderBy(desc(runDiagnostics.createdAt))
        .limit(1);
      return row ?? null;
    }),

  stalled: protectedProcedure
    .input(
      z.object({
        staleMinutes: z.number().int().min(1).max(120).default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      const threshold = new Date(Date.now() - input.staleMinutes * 60 * 1000);
      const rows = await ctx.db
        .select()
        .from(collectionRuns)
        .where(
          and(eq(collectionRuns.status, 'running'), sql`${collectionRuns.time} < ${threshold}`),
        )
        .orderBy(desc(collectionRuns.time))
        .limit(50);
      return rows;
    }),

  forceComplete: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const updated = await ctx.db
        .update(collectionRuns)
        .set({
          status: 'failed',
          durationMs: sql`EXTRACT(EPOCH FROM (NOW() - ${collectionRuns.time})) * 1000`,
          errorReason: 'force-completed from monitor (worker unresponsive)',
        })
        .where(
          and(
            eq(collectionRuns.runId, input.runId),
            eq(collectionRuns.source, input.source),
            eq(collectionRuns.status, 'running'),
          ),
        )
        .returning({ runId: collectionRuns.runId });
      return { patched: updated.length, runId: input.runId };
    }),

  backfillSentiment: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().optional(),
        source: z.enum(COLLECTOR_SOURCES).optional(),
        itemType: z.enum(['article', 'video', 'comment']).optional(),
        dryRun: z.boolean().default(false),
        limit: z.number().min(1).max(10000).default(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { dryRun, limit } = input;
      const conditions = [isNull(rawItems.sentiment)];
      if (input.subscriptionId) conditions.push(eq(rawItems.subscriptionId, input.subscriptionId));
      if (input.source) conditions.push(eq(rawItems.source, input.source));
      if (input.itemType) conditions.push(eq(rawItems.itemType, input.itemType));

      const [{ count }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(rawItems)
        .where(and(...conditions));

      if (count === 0 || dryRun) {
        return { processed: 0, updated: 0, total: count, dryRun };
      }

      const rows = await ctx.db
        .select({
          time: rawItems.time,
          sourceId: rawItems.sourceId,
          title: rawItems.title,
          content: rawItems.content,
        })
        .from(rawItems)
        .where(and(...conditions))
        .limit(limit);

      if (rows.length === 0) return { processed: 0, updated: 0, total: count, dryRun };

      const { classifySentimentFromTexts, initSentiment } =
        await import('../../services/sentiment');
      const { buildEmbeddingText } = await import('../../services/embedding');
      await initSentiment();

      const texts = rows.map((r) => buildEmbeddingText(r.title, r.content));
      const sentiments = await classifySentimentFromTexts(texts);

      // batch UPDATE — VALUES + JOIN으로 N건을 단일 쿼리로 처리
      const validEntries = rows
        .map((r, i) => ({ row: r, sentiment: sentiments[i] }))
        .filter(
          (e) => e.sentiment && !(e.sentiment.label === 'neutral' && e.sentiment.score === 0),
        );

      let updated = 0;
      if (validEntries.length > 0) {
        try {
          const valuesClauses = validEntries.map((e, i) =>
            // 첫 행에만 명시적 캐스트 — PostgreSQL이 VALUES의 컬럼 타입을 첫 행으로 추론한다.
            // AS alias(col ...)에는 타입을 넣을 수 없음(syntax error at or near "text").
            i === 0
              ? sql`(${e.row.time.toISOString()}::timestamptz, ${e.row.sourceId}::text, ${e.sentiment!.label}::text, ${e.sentiment!.score}::real)`
              : sql`(${e.row.time.toISOString()}, ${e.row.sourceId}, ${e.sentiment!.label}, ${e.sentiment!.score})`,
          );
          await ctx.db.execute(sql`
            UPDATE raw_items AS t
            SET sentiment = v.s,
                sentiment_score = v.sc
            FROM (VALUES ${sql.join(valuesClauses, sql`, `)}) AS v(ts, sid, s, sc)
            WHERE t.source_id = v.sid
              AND t.time = v.ts
              AND t.sentiment IS NULL
          `);
          updated = validEntries.length;
        } catch {
          // batch UPDATE 실패 시 0건으로 보고
        }
      }

      return { processed: rows.length, updated, total: count, dryRun };
    }),
});
