import { eq, and, desc, ilike, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  analysisSeries,
  seriesDeltaResults,
  collectionJobs,
  analysisResults,
} from '@ai-signalcraft/core';
import { protectedProcedure, router } from '../init';

export const seriesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        perPage: z.number().default(20),
        status: z.enum(['active', 'archived', 'all']).default('active'),
      }),
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(analysisSeries.teamId, ctx.teamId!)];
      if (input.status !== 'all') {
        conditions.push(eq(analysisSeries.status, input.status));
      }

      const where = and(...conditions);
      const items = await ctx.db
        .select()
        .from(analysisSeries)
        .where(where)
        .orderBy(desc(analysisSeries.updatedAt))
        .limit(input.perPage)
        .offset((input.page - 1) * input.perPage);

      const [{ count }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(analysisSeries)
        .where(where);

      return { items, total: count, page: input.page, perPage: input.perPage };
    }),

  getDetail: protectedProcedure
    .input(z.object({ seriesId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [series] = await ctx.db
        .select()
        .from(analysisSeries)
        .where(and(eq(analysisSeries.id, input.seriesId), eq(analysisSeries.teamId, ctx.teamId!)))
        .limit(1);
      if (!series) return null;

      const jobs = await ctx.db
        .select({
          id: collectionJobs.id,
          keyword: collectionJobs.keyword,
          startDate: collectionJobs.startDate,
          endDate: collectionJobs.endDate,
          status: collectionJobs.status,
          seriesOrder: collectionJobs.seriesOrder,
          createdAt: collectionJobs.createdAt,
        })
        .from(collectionJobs)
        .where(eq(collectionJobs.seriesId, input.seriesId))
        .orderBy(collectionJobs.seriesOrder);

      const deltas = await ctx.db
        .select()
        .from(seriesDeltaResults)
        .where(eq(seriesDeltaResults.seriesId, input.seriesId))
        .orderBy(seriesDeltaResults.createdAt);

      return { series, jobs, deltas };
    }),

  searchByKeyword: protectedProcedure
    .input(z.object({ keyword: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      return ctx.db
        .select({
          id: analysisSeries.id,
          keyword: analysisSeries.keyword,
          domain: analysisSeries.domain,
          title: analysisSeries.title,
          metadata: analysisSeries.metadata,
          updatedAt: analysisSeries.updatedAt,
        })
        .from(analysisSeries)
        .where(
          and(
            eq(analysisSeries.teamId, ctx.teamId!),
            eq(analysisSeries.status, 'active'),
            ilike(analysisSeries.keyword, `%${input.keyword}%`),
          ),
        )
        .orderBy(desc(analysisSeries.updatedAt))
        .limit(5);
    }),

  getTimelineData: protectedProcedure
    .input(z.object({ seriesId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [series] = await ctx.db
        .select({ id: analysisSeries.id })
        .from(analysisSeries)
        .where(and(eq(analysisSeries.id, input.seriesId), eq(analysisSeries.teamId, ctx.teamId!)))
        .limit(1);
      if (!series) return null;

      const jobs = await ctx.db
        .select({
          id: collectionJobs.id,
          startDate: collectionJobs.startDate,
          endDate: collectionJobs.endDate,
          status: collectionJobs.status,
          seriesOrder: collectionJobs.seriesOrder,
        })
        .from(collectionJobs)
        .where(
          and(eq(collectionJobs.seriesId, input.seriesId), eq(collectionJobs.status, 'completed')),
        )
        .orderBy(collectionJobs.seriesOrder);

      const timelinePoints = [];
      for (const job of jobs) {
        const results = await ctx.db
          .select({ module: analysisResults.module, result: analysisResults.result })
          .from(analysisResults)
          .where(and(eq(analysisResults.jobId, job.id), eq(analysisResults.status, 'completed')));

        const resultMap = new Map(results.map((r) => [r.module, r.result]));
        const sf = resultMap.get('sentiment-framing') as any;
        const mv = resultMap.get('macro-view') as any;

        timelinePoints.push({
          jobId: job.id,
          seriesOrder: job.seriesOrder,
          startDate: job.startDate?.toISOString(),
          endDate: job.endDate?.toISOString(),
          sentimentRatio: sf?.sentimentRatio ?? null,
          mentions: mv?.dailyMentionTrend?.reduce((s: number, d: any) => s + d.count, 0) ?? 0,
          overallDirection: mv?.overallDirection ?? null,
          topKeywords: sf?.topKeywords?.slice(0, 10) ?? [],
        });
      }

      const deltas = await ctx.db
        .select()
        .from(seriesDeltaResults)
        .where(eq(seriesDeltaResults.seriesId, input.seriesId))
        .orderBy(seriesDeltaResults.createdAt);

      return { timelinePoints, deltas };
    }),

  create: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1).max(50),
        domain: z.string(),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [series] = await ctx.db
        .insert(analysisSeries)
        .values({
          teamId: ctx.teamId ?? null,
          userId: ctx.userId,
          keyword: input.keyword,
          domain: input.domain,
          title: input.title ?? `${input.keyword} 시리즈`,
          metadata: { totalJobs: 0, lastJobId: null, lastAnalyzedAt: null },
        })
        .returning();
      return { seriesId: series.id };
    }),

  archive: protectedProcedure
    .input(z.object({ seriesId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .update(analysisSeries)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(and(eq(analysisSeries.id, input.seriesId), eq(analysisSeries.teamId, ctx.teamId!)));
      return { success: true };
    }),

  getDelta: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [delta] = await ctx.db
        .select()
        .from(seriesDeltaResults)
        .where(eq(seriesDeltaResults.jobId, input.jobId))
        .limit(1);
      return delta ?? null;
    }),
});
