import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { getCollectorClient } from '@ai-signalcraft/core';
import { protectedProcedure, router } from '../init';

// collector DB 스키마 타입이 트랜지티브 추론으로 새어나오지 않도록,
// web 경계에서 반환 형태를 명시적으로 선언한다(TS2742 방지).
export interface SubscriptionRecord {
  id: number;
  keyword: string;
  sources: string[];
  intervalHours: number;
  status: 'active' | 'paused' | 'error';
  limits: { maxPerRun: number; maxPerDay?: number; commentsPerItem?: number };
  options?: { collectTranscript?: boolean; includeComments?: boolean } | null;
  domain?: string | null;
  ownerId?: string | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  createdAt: Date;
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
  lastFetchedAt: Date | null;
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
  time: Date;
  errorReason?: string | null;
}

/**
 * 키워드 구독 관리 라우터.
 * collector 서비스(apps/collector)의 tRPC API를 web에서 프록시.
 * 인증된 사용자의 userId를 ownerId로 자동 주입한다.
 */

const SOURCE_ENUM = ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'] as const;

const limitsSchema = z.object({
  maxPerRun: z.number().int().positive(),
  maxPerDay: z.number().int().positive().optional(),
  commentsPerItem: z.number().int().nonnegative().optional(),
});

const optionsSchema = z
  .object({
    collectTranscript: z.boolean().optional(),
    includeComments: z.boolean().optional(),
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
    .query(async ({ input }): Promise<SubscriptionRecord> => {
      try {
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
    .mutation(async ({ input }): Promise<SubscriptionRecord> => {
      try {
        const res = await getCollectorClient().subscriptions.update.mutate(input);
        return res as unknown as SubscriptionRecord;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  pause: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }): Promise<SubscriptionRecord> => {
      try {
        const res = await getCollectorClient().subscriptions.pause.mutate(input);
        return res as unknown as SubscriptionRecord;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  resume: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }): Promise<SubscriptionRecord> => {
      try {
        const res = await getCollectorClient().subscriptions.resume.mutate(input);
        return res as unknown as SubscriptionRecord;
      } catch (err) {
        handleCollectorError(err);
      }
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }): Promise<{ id: number }> => {
      try {
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
    .mutation(async ({ input }): Promise<TriggerNowResult> => {
      try {
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
});
