import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, desc, sql } from 'drizzle-orm';
import { keywordSubscriptions } from '../../db/schema';
import { router, protectedProcedure } from './init';

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

const createInput = z.object({
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

const updateInput = createInput.partial().extend({ id: z.number().int().positive() });

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
   * 실제 큐 enqueue는 P2(워커 구현)에서 주입 — 현재는 DB 상태만 업데이트.
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

      // nextRunAt을 즉시로 당겨 스캐너가 다음 tick에서 픽업
      const [updated] = await ctx.db
        .update(keywordSubscriptions)
        .set({ nextRunAt: new Date() })
        .where(eq(keywordSubscriptions.id, input.id))
        .returning();

      return {
        queued: true,
        subscription: updated,
        requestedSources: input.sources ?? row.sources,
      };
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
