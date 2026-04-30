import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, desc, sql } from 'drizzle-orm';
import { keywordSubscriptions } from '../../db/schema';
import { enqueueCollectionJob } from '../../queue/queues';
import { isSourcePaused } from '../../queue/source-pause';
import type { CollectorSource } from '../../queue/types';
import { computeSourceStartBatch } from '../../scheduler/source-window';
import { ROLLING_OVERLAP_RATIO } from '../../scheduler/scanner';
import { router, protectedProcedure } from './init';

const SOURCE_ENUM = ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'] as const;

// __tests__/subscriptions-input.test.ts에서 Zod 입력 회귀 테스트를 위해 export.
export const limitsSchema = z.object({
  maxPerRun: z.number().int().positive(),
  maxPerDay: z.number().int().positive().optional(),
  commentsPerItem: z.number().int().nonnegative().optional(),
});

export const optionsSchema = z
  .object({
    collectTranscript: z.boolean().optional(),
    includeComments: z.boolean().optional(),
    enableManipulation: z.boolean().optional(),
  })
  .optional();

export const createInput = z.object({
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
  ownerId: z.string().optional(),
});

export const updateInput = createInput.partial().extend({ id: z.number().int().positive() });

const idInput = z.object({ id: z.number().int().positive() });

export const subscriptionsRouter = router({
  create: protectedProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .insert(keywordSubscriptions)
      .values({
        keyword: input.keyword,
        sources: input.sources as unknown as string[],
        intervalHours: input.intervalHours,
        limits: input.limits,
        options: input.options,
        domain: input.domain,
        ownerId: input.ownerId,
        nextRunAt: new Date(), // 즉시 첫 수집 대상
      })
      .returning();
    return row;
  }),

  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(['active', 'paused', 'error']).optional(),
          ownerId: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(100),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conds = [];
      if (input?.status) conds.push(eq(keywordSubscriptions.status, input.status));
      if (input?.ownerId) conds.push(eq(keywordSubscriptions.ownerId, input.ownerId));

      const rows = await ctx.db
        .select()
        .from(keywordSubscriptions)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(keywordSubscriptions.createdAt))
        .limit(input?.limit ?? 100);
      return rows;
    }),

  get: protectedProcedure.input(idInput).query(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .select()
      .from(keywordSubscriptions)
      .where(eq(keywordSubscriptions.id, input.id))
      .limit(1);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return row;
  }),

  update: protectedProcedure.input(updateInput).mutation(async ({ ctx, input }) => {
    const { id, ...patch } = input;
    const values: Record<string, unknown> = {};
    if (patch.keyword !== undefined) values.keyword = patch.keyword;
    if (patch.sources !== undefined) values.sources = patch.sources;
    if (patch.intervalHours !== undefined) values.intervalHours = patch.intervalHours;
    if (patch.limits !== undefined) values.limits = patch.limits;
    if (patch.options !== undefined) values.options = patch.options;
    if (patch.domain !== undefined) values.domain = patch.domain;
    if (patch.ownerId !== undefined) values.ownerId = patch.ownerId;

    if (Object.keys(values).length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: '변경할 값이 없습니다' });
    }

    const [row] = await ctx.db
      .update(keywordSubscriptions)
      .set(values)
      .where(eq(keywordSubscriptions.id, id))
      .returning();
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return row;
  }),

  pause: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .update(keywordSubscriptions)
      .set({ status: 'paused' })
      .where(eq(keywordSubscriptions.id, input.id))
      .returning();
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return row;
  }),

  resume: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .update(keywordSubscriptions)
      .set({ status: 'active', nextRunAt: new Date() })
      .where(eq(keywordSubscriptions.id, input.id))
      .returning();
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return row;
  }),

  remove: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .delete(keywordSubscriptions)
      .where(eq(keywordSubscriptions.id, input.id))
      .returning();
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return { id: row.id };
  }),

  /**
   * 수동 즉시 트리거 — 스케줄과 무관하게 수집 큐에 즉시 enqueue.
   * 쿨다운: 직전 성공 수집 후 MANUAL_TRIGGER_COOLDOWN_SEC 이내면 거부.
   * sources 지정 시 해당 소스만, 아니면 subscription.sources 전체 enqueue.
   */
  triggerNow: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        sources: z.array(z.enum(SOURCE_ENUM)).optional(),
        ignoreCooldown: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(keywordSubscriptions)
        .where(eq(keywordSubscriptions.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });

      const cooldownSec = Number(process.env.MANUAL_TRIGGER_COOLDOWN_SEC ?? 600);
      if (!input.ignoreCooldown && row.lastRunAt) {
        const elapsed = (Date.now() - row.lastRunAt.getTime()) / 1000;
        if (elapsed < cooldownSec) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: `쿨다운 중입니다 (${Math.ceil(cooldownSec - elapsed)}초 남음)`,
          });
        }
      }

      const targetSources = (input.sources ??
        (row.sources as CollectorSource[])) as CollectorSource[];
      if (targetSources.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '수집할 소스가 없습니다' });
      }

      const runId = randomUUID();
      const now = new Date();
      const intervalMs = row.intervalHours * 3600 * 1000;
      // Rolling overlap — scanner.ts와 동일 비율(상수 재사용)
      const overlapMs = Math.floor(intervalMs * ROLLING_OVERLAP_RATIO);
      const endISO = now.toISOString();
      // 소스별 "items>0 성공"만 lastSuccess로 간주하여 startISO를 계산.
      // subscription.lastRunAt 단일 기준을 쓰면 한 소스가 계속 0건이어도 다른 소스 성공으로
      // lastRunAt이 갱신되어 해당 소스가 영구 0건 상태에 빠진다 (구독 225 clien 사례).
      const startBySource = await computeSourceStartBatch({
        subscriptionId: row.id,
        sources: targetSources,
        now,
        overlapMs,
      });

      const enqueuedSources: CollectorSource[] = [];
      const skippedSources: string[] = [];
      for (const source of targetSources) {
        if (await isSourcePaused(source)) {
          skippedSources.push(source);
          continue;
        }
        const win = startBySource.get(source);
        if (!win) continue;
        await enqueueCollectionJob({
          runId,
          subscriptionId: row.id,
          source,
          keyword: row.keyword,
          limits: row.limits,
          options: row.options ?? undefined,
          dateRange: { startISO: win.startISO, endISO },
          triggerType: 'manual',
        });
        enqueuedSources.push(source);
      }

      // 다음 스케줄 실행 시각을 intervalHours 뒤로 — 스캐너 중복 enqueue 방지
      const [updated] = await ctx.db
        .update(keywordSubscriptions)
        .set({ nextRunAt: new Date(now.getTime() + intervalMs) })
        .where(eq(keywordSubscriptions.id, input.id))
        .returning();

      return {
        queued: true,
        runId,
        subscription: updated,
        enqueuedSources,
        skippedSources,
      };
    }),

  /**
   * 백필 수동 실행 — fromDate~toDate 범위를 day-windowed backfill 모드로 즉시 enqueue.
   * windowDays = toDate - fromDate + 1 (1~90일 범위 제한).
   */
  backfill: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive(),
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD KST 형식'),
        toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD KST 형식'),
        perDay: z.number().int().positive().max(1000).default(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fromMs = new Date(`${input.fromDate}T00:00:00+09:00`).getTime();
      const toMs = new Date(`${input.toDate}T00:00:00+09:00`).getTime();
      if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '유효하지 않은 날짜입니다 (fromDate/toDate)',
        });
      }
      const windowDays = Math.floor((toMs - fromMs) / 86400000) + 1;
      if (windowDays < 1 || windowDays > 90) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `windowDays는 1~90 범위여야 합니다 (입력: ${windowDays})`,
        });
      }

      const [sub] = await ctx.db
        .select()
        .from(keywordSubscriptions)
        .where(eq(keywordSubscriptions.id, input.subscriptionId))
        .limit(1);
      if (!sub) throw new TRPCError({ code: 'NOT_FOUND' });

      const runId = randomUUID();
      const startISO = new Date(fromMs).toISOString();
      const endISO = new Date(toMs + 86400000).toISOString(); // toDate의 KST 자정 + 24h

      const enqueued: CollectorSource[] = [];
      const skippedSources: string[] = [];
      for (const source of sub.sources as CollectorSource[]) {
        if (await isSourcePaused(source)) {
          skippedSources.push(source);
          continue;
        }
        await enqueueCollectionJob({
          runId,
          subscriptionId: sub.id,
          source,
          keyword: sub.keyword,
          limits: { ...sub.limits, maxPerRun: input.perDay },
          options: sub.options ?? undefined,
          dateRange: { startISO, endISO },
          triggerType: 'manual',
          mode: 'backfill',
          windowDays,
        });
        enqueued.push(source);
      }

      return { runId, windowDays, sources: enqueued, skippedSources };
    }),

  /**
   * 다음 실행 대상 — 스케줄러가 조회용으로 사용.
   * 외부 클라이언트도 "지금 수집 대기 중인 키워드"를 볼 수 있음.
   */
  dueForRun: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(keywordSubscriptions)
        .where(
          and(
            eq(keywordSubscriptions.status, 'active'),
            sql`${keywordSubscriptions.nextRunAt} IS NULL OR ${keywordSubscriptions.nextRunAt} <= now()`,
          ),
        )
        .orderBy(keywordSubscriptions.nextRunAt)
        .limit(input.limit);
      return rows;
    }),
});
