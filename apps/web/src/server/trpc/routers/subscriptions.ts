import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { getCollectorClient } from '@ai-signalcraft/core';
import { protectedProcedure, adminProcedure, router } from '../init';
import { verifySubscriptionOwnership } from '../shared/verify-subscription-ownership';

// collector DB 스키마 타입이 트랜지티브 추론으로 새어나오지 않도록,
// web 경계에서 반환 형태를 명시적으로 선언한다(TS2742 방지).
export interface SubscriptionRecord {
  id: number;
  keyword: string;
  sources: string[];
  intervalHours: number;
  status: 'active' | 'paused' | 'error';
  limits: { maxPerRun: number; maxPerDay?: number; commentsPerItem?: number };
  options?: {
    collectTranscript?: boolean;
    includeComments?: boolean;
    enableManipulation?: boolean;
  } | null;
  domain?: string | null;
  ownerId?: string | null;
  nextRunAt: Date | string | null;
  lastRunAt: Date | string | null;
  lastErrorAt: Date | string | null;
  lastError: string | null;
  createdAt: Date | string;
}

export interface TriggerNowResult {
  queued: boolean;
  runId: string;
  subscription: SubscriptionRecord;
  enqueuedSources: string[];
}

export interface StatsResult {
  totalItems: number;
  bySource: Array<{ source: string; count: number }>;
  byItemType: Array<{ itemType: string; count: number }>;
  bySourceAndType: Array<{ source: string; itemType: string; count: number }>;
  lastFetchedAt: Date | string | null;
}

export interface SourceHealthRun {
  source: string;
  total: number;
  completed: number;
  blocked: number;
  failed: number;
  avgDurationMs: number;
}

export interface SourceHealthError {
  source: string;
  errorType: string;
  count: number;
}

export interface SourceHealthResult {
  windowHours: number;
  runs: SourceHealthRun[];
  errors: SourceHealthError[];
}

export interface ErrorTimelineEntry {
  date: string;
  errorType: string;
  count: number;
}

export interface ErrorTimelineResult {
  days: number;
  entries: ErrorTimelineEntry[];
}

export interface RunRecord {
  runId: string;
  subscriptionId: number;
  source: string;
  status: string;
  itemsCollected: number;
  itemsNew: number;
  durationMs: number | null;
  triggerType: string;
  time: Date | string;
  errorReason?: string | null;
}

export interface RunItemBreakdownEntry {
  fetchedFromRun: string | null;
  source: string;
  itemType: string;
  count: number;
}

export interface SentimentBreakdownEntry {
  fetchedFromRun: string;
  sentiment: string | null;
  count: number;
}

export interface RunProgress {
  runId: string;
  source: string;
  status: 'running' | 'completed' | 'blocked' | 'failed' | null;
  bullState: string;
  attemptsMade: number;
  itemsCollected: number;
  itemsNew: number;
  byType: { article: number; video: number; comment: number };
  lastProgressAtMs: number | null;
  processedOnMs: number | null;
  finishedOnMs: number | null;
  elapsedMs: number;
  failedReason: string | null;
}

export interface CancelResult {
  runId: string;
  source: string;
  mode: 'graceful' | 'force';
  alreadyCancelled?: boolean;
  alreadyCancelling?: boolean;
  diagnosticId: string;
}

export interface CancelResultBatch {
  runId: string;
  results: CancelResult[];
}

export interface RetryResult {
  newRunId: string;
  reused: boolean;
}

export interface ForceCompleteResult {
  patched: number;
  runId: string;
}

export interface DiagnosticRecord {
  id: string;
  runId: string;
  source: string | null;
  triggeredBy: string;
  layerA: unknown;
  layerB: unknown | null;
  layerC: unknown | null;
  layerAAt: Date | string;
  layerBAt: Date | string | null;
  layerCAt: Date | string | null;
  createdAt: Date | string;
}

export interface StalledRun {
  runId: string;
  source: string;
  time: Date | string;
  subscriptionId: number;
  status: string;
}

export interface SourceState {
  source: string;
  pausedAt: Date | string;
  pausedBy: string;
  reason: string | null;
  resumedAt: Date | string | null;
}

export interface QueueStatus {
  [queueName: string]: {
    workerCount: number;
    workers: Array<{ id: string; addr: string; idleMs: number }>;
    counts: {
      waiting: number;
      active: number;
      delayed: number;
      failed: number;
      paused: number;
    };
    isPaused: boolean;
  };
}

export interface RawItemRecord {
  time: Date | string;
  subscriptionId: number;
  source: string;
  sourceId: string;
  itemType: 'article' | 'video' | 'comment';
  url: string | null;
  title: string | null;
  content: string | null;
  author: string | null;
  publisher: string | null;
  publishedAt: Date | string | null;
  parentSourceId: string | null;
  metrics: {
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
  } | null;
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  sentimentScore: number | null;
  fetchedAt: Date | string;
  fetchedFromRun?: string | null;
  // YouTube 한정. items.query가 raw_payload에서 promote — 자막/Whisper 전사 + 영상 길이.
  transcript?: string | null;
  transcriptLang?: string | null;
  durationSec?: number | null;
}

export interface QueryItemsResult {
  items: RawItemRecord[];
  total: number;
  mode: string;
  nextCursor: string | null;
}

export interface CommentCountByParentEntry {
  source: string;
  parentSourceId: string;
  count: number;
}

/**
 * 키워드 구독 관리 라우터.
 * collector 서비스(apps/collector)의 tRPC API를 web에서 프록시.
 * 인증된 사용자의 userId를 ownerId로 자동 주입한다.
 */

export const SOURCE_ENUM = ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'] as const;
export type SourceEnum = (typeof SOURCE_ENUM)[number];

const limitsSchema = z.object({
  maxPerRun: z.number().int().positive(),
  maxPerDay: z.number().int().positive().optional(),
  commentsPerItem: z.number().int().nonnegative().optional(),
});

const optionsSchema = z
  .object({
    collectTranscript: z.boolean().optional(),
    includeComments: z.boolean().optional(),
    enableManipulation: z.boolean().optional(),
  })
  .optional();

function handleCollectorError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('COLLECTOR_URL') || msg.includes('COLLECTOR_API_KEY')) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: '수집 서비스 환경 설정이 누락되었습니다 (COLLECTOR_URL/COLLECTOR_API_KEY)',
    });
  }
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `수집 서비스 호출 실패: ${msg}`,
  });
}

export const subscriptionsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(['active', 'paused', 'error']).optional(),
          limit: z.number().int().min(1).max(500).default(100),
        })
        .optional(),
    )
    .query(async ({ ctx, input }): Promise<SubscriptionRecord[]> => {
      try {
        const res = await getCollectorClient().subscriptions.list.query({
          status: input?.status,
          ownerId: ctx.userId,
          limit: input?.limit ?? 100,
        });
        return res as unknown as SubscriptionRecord[];
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }): Promise<SubscriptionRecord> => {
      try {
        await verifySubscriptionOwnership(ctx, input.id);
        const res = await getCollectorClient().subscriptions.get.query({ id: input.id });
        return res as unknown as SubscriptionRecord;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        keyword: z.string().trim().min(1).max(200),
        sources: z.array(z.enum(SOURCE_ENUM)).min(1),
        intervalHours: z
          .number()
          .int()
          .min(1)
          .max(24 * 7)
          .default(6),
        limits: limitsSchema,
        options: optionsSchema,
        domain: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<SubscriptionRecord> => {
      try {
        const res = await getCollectorClient().subscriptions.create.mutate({
          ...input,
          ownerId: ctx.userId,
        });
        return res as unknown as SubscriptionRecord;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        keyword: z.string().trim().min(1).max(200).optional(),
        sources: z.array(z.enum(SOURCE_ENUM)).min(1).optional(),
        intervalHours: z
          .number()
          .int()
          .min(1)
          .max(24 * 7)
          .optional(),
        limits: limitsSchema.optional(),
        options: optionsSchema,
        domain: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<SubscriptionRecord> => {
      try {
        await verifySubscriptionOwnership(ctx, input.id);
        const res = await getCollectorClient().subscriptions.update.mutate(input);
        return res as unknown as SubscriptionRecord;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  pause: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }): Promise<SubscriptionRecord> => {
      try {
        await verifySubscriptionOwnership(ctx, input.id);
        const res = await getCollectorClient().subscriptions.pause.mutate(input);
        return res as unknown as SubscriptionRecord;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  resume: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }): Promise<SubscriptionRecord> => {
      try {
        await verifySubscriptionOwnership(ctx, input.id);
        const res = await getCollectorClient().subscriptions.resume.mutate(input);
        return res as unknown as SubscriptionRecord;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }): Promise<{ id: number }> => {
      try {
        await verifySubscriptionOwnership(ctx, input.id);
        const res = await getCollectorClient().subscriptions.remove.mutate(input);
        return res as unknown as { id: number };
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  triggerNow: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        sources: z.array(z.enum(SOURCE_ENUM)).optional(),
        ignoreCooldown: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<TriggerNowResult> => {
      try {
        await verifySubscriptionOwnership(ctx, input.id);
        const res = await getCollectorClient().subscriptions.triggerNow.mutate(input);
        return res as unknown as TriggerNowResult;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  stats: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1),
        dateRange: z.object({ start: z.string(), end: z.string() }),
      }),
    )
    .query(async ({ input }): Promise<StatsResult> => {
      try {
        const res = await getCollectorClient().items.stats.query(input);
        return res as unknown as StatsResult;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  itemStats: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive().optional(),
        keyword: z.string().optional(),
        dateRange: z.object({ start: z.string(), end: z.string() }),
      }),
    )
    .query(async ({ input }): Promise<StatsResult> => {
      try {
        const res = await getCollectorClient().items.stats.query(input);
        return res as unknown as StatsResult;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  sourceHealth: protectedProcedure
    .input(
      z
        .object({
          sinceHours: z
            .number()
            .int()
            .positive()
            .max(24 * 7)
            .default(24),
        })
        .optional(),
    )
    .query(async ({ input }): Promise<SourceHealthResult> => {
      try {
        const res = await getCollectorClient().health.sourceStatus.query(input);
        return res as unknown as SourceHealthResult;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  errorTimeline: protectedProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(30).default(7),
      }),
    )
    .query(async ({ input }): Promise<ErrorTimelineResult> => {
      try {
        const res = await getCollectorClient().health.errorTimeline.query(input);
        return res as unknown as ErrorTimelineResult;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  runs: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive().optional(),
        status: z.enum(['running', 'completed', 'blocked', 'failed']).optional(),
        sinceHours: z
          .number()
          .int()
          .positive()
          .max(24 * 30)
          .optional(),
        limit: z.number().int().min(1).max(500).default(100),
      }),
    )
    .query(async ({ input }): Promise<RunRecord[]> => {
      try {
        const res = await getCollectorClient().runs.list.query(input);
        return res as unknown as RunRecord[];
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  runItemBreakdown: protectedProcedure
    .input(
      z.object({
        runIds: z.array(z.string().uuid()).min(1).max(1000),
      }),
    )
    .query(async ({ input }): Promise<RunItemBreakdownEntry[]> => {
      try {
        const res = await getCollectorClient().runs.itemBreakdown.query(input);
        return res as unknown as RunItemBreakdownEntry[];
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  runSentimentBreakdown: protectedProcedure
    .input(
      z.object({
        runIds: z.array(z.string().uuid()).min(1).max(1000),
      }),
    )
    .query(async ({ input }) => {
      try {
        const res = await getCollectorClient().runs.sentimentBreakdown.query(input);
        return res as unknown as Array<{
          fetchedFromRun: string;
          sentiment: string | null;
          count: number;
        }>;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  runProgress: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM),
      }),
    )
    .query(async ({ input }): Promise<RunProgress> => {
      try {
        const res = await getCollectorClient().runs.progress.query(input);
        return res as unknown as RunProgress;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  cancelRun: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM).optional(),
        mode: z.enum(['graceful', 'force']).default('graceful'),
      }),
    )
    .mutation(async ({ input }): Promise<CancelResult | CancelResultBatch> => {
      try {
        const res = await getCollectorClient().runs.cancel.mutate(input);
        return res as unknown as CancelResult | CancelResultBatch;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  forceCompleteRun: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM),
      }),
    )
    .mutation(async ({ input }): Promise<ForceCompleteResult> => {
      try {
        const res = await getCollectorClient().runs.forceComplete.mutate(input);
        return res as unknown as ForceCompleteResult;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  cancelBySubscription: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive(),
        mode: z.enum(['graceful', 'force']).default('graceful'),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<{ cancelled: number; runIds: string[] }> => {
      try {
        await verifySubscriptionOwnership(ctx, input.subscriptionId);
        const res = await getCollectorClient().runs.cancelBySubscription.mutate(input);
        return res as unknown as { cancelled: number; runIds: string[] };
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  cancelAll: adminProcedure
    .input(
      z.object({
        mode: z.enum(['graceful', 'force']).default('graceful'),
        confirm: z.literal('CANCEL_ALL'),
      }),
    )
    .mutation(async ({ input }): Promise<{ cancelled: number }> => {
      try {
        const res = await getCollectorClient().runs.cancelAll.mutate(input);
        return res as unknown as { cancelled: number };
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  retry: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM),
      }),
    )
    .mutation(async ({ input }): Promise<RetryResult> => {
      try {
        const res = await getCollectorClient().runs.retry.mutate(input);
        return res as unknown as RetryResult;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  diagnose: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM).optional(),
        refresh: z.boolean().default(false),
      }),
    )
    .query(async ({ input }): Promise<DiagnosticRecord | null> => {
      try {
        const res = await getCollectorClient().runs.diagnose.query(input);
        return res as unknown as DiagnosticRecord | null;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  stalled: protectedProcedure
    .input(
      z
        .object({
          staleMinutes: z.number().int().min(1).max(120).default(10),
        })
        .optional(),
    )
    .query(async ({ input }): Promise<StalledRun[]> => {
      try {
        const res = await getCollectorClient().runs.stalled.query({
          staleMinutes: input?.staleMinutes ?? 10,
        });
        return res as unknown as StalledRun[];
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  queueStatus: protectedProcedure.query(async (): Promise<QueueStatus> => {
    try {
      const res = await getCollectorClient().queue.status.query();
      return res as unknown as QueueStatus;
    } catch (err) {
      handleCollectorError(err);
    }
  }),

  sourceList: protectedProcedure.query(async (): Promise<SourceState[]> => {
    try {
      const res = await getCollectorClient().sources.list.query();
      return res as unknown as SourceState[];
    } catch (err) {
      handleCollectorError(err);
    }
  }),

  sourcePause: protectedProcedure
    .input(
      z.object({
        source: z.enum(SOURCE_ENUM),
        reason: z.string().max(200).nullable().default(null),
      }),
    )
    .mutation(async ({ input }): Promise<{ source: string; paused: boolean }> => {
      try {
        const res = await getCollectorClient().sources.pause.mutate(input);
        return res as unknown as { source: string; paused: boolean };
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  sourceResume: protectedProcedure
    .input(z.object({ source: z.enum(SOURCE_ENUM) }))
    .mutation(async ({ input }): Promise<{ source: string; paused: boolean }> => {
      try {
        const res = await getCollectorClient().sources.resume.mutate(input);
        return res as unknown as { source: string; paused: boolean };
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  queryItems: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive(),
        dateRange: z.object({ start: z.string(), end: z.string() }),
        sources: z.array(z.enum(SOURCE_ENUM)).optional(),
        itemTypes: z.array(z.enum(['article', 'video', 'comment'])).optional(),
        cursor: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }): Promise<QueryItemsResult> => {
      try {
        // 뷰어 피드 전용. scope='feed'로 고정해 collector가 기사/영상만 반환하고
        // COALESCE(published_at, time) DESC로 정렬하도록 한다. 댓글은 queryComments로 lazy load.
        const res = await getCollectorClient().items.query.query({
          subscriptionId: input.subscriptionId,
          dateRange: input.dateRange,
          sources: input.sources,
          cursor: input.cursor,
          limit: input.limit,
          mode: 'all',
          scope: 'feed',
        });
        return res as unknown as QueryItemsResult;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  queryComments: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive(),
        dateRange: z.object({ start: z.string(), end: z.string() }),
        parent: z.object({
          source: z.enum(SOURCE_ENUM),
          sourceId: z.string().min(1),
        }),
        cursor: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      }),
    )
    .query(async ({ input }): Promise<QueryItemsResult> => {
      try {
        const res = await getCollectorClient().items.query.query({
          subscriptionId: input.subscriptionId,
          dateRange: input.dateRange,
          cursor: input.cursor,
          limit: input.limit,
          mode: 'all',
          scope: 'comments-for-parent',
          parent: input.parent,
        });
        return res as unknown as QueryItemsResult;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  commentCountByParent: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive(),
        dateRange: z.object({ start: z.string(), end: z.string() }),
        sources: z.array(z.enum(SOURCE_ENUM)).optional(),
      }),
    )
    .query(async ({ input }): Promise<CommentCountByParentEntry[]> => {
      try {
        const res = await getCollectorClient().items.commentCountByParent.query(input);
        return res as unknown as CommentCountByParentEntry[];
      } catch (err) {
        handleCollectorError(err);
      }
    }),
});
