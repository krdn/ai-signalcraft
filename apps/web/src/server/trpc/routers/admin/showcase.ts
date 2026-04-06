import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { eq, desc, count } from 'drizzle-orm';
import { collectionJobs, analysisReports } from '@ai-signalcraft/core';
import { systemAdminProcedure, router } from '../../init';

const MAX_FEATURED = 5;

export const adminShowcaseRouter = router({
  // 쇼케이스 토글 (지정/해제)
  toggle: systemAdminProcedure
    .input(z.object({ jobId: z.number(), featured: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      if (input.featured) {
        // 완료 상태 확인
        const [job] = await ctx.db
          .select({ status: collectionJobs.status })
          .from(collectionJobs)
          .where(eq(collectionJobs.id, input.jobId))
          .limit(1);

        if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' });
        if (job.status !== 'completed')
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '완료된 작업만 쇼케이스로 지정할 수 있습니다',
          });

        // 최대 개수 확인
        const [{ value: featuredCount }] = await ctx.db
          .select({ value: count() })
          .from(collectionJobs)
          .where(eq(collectionJobs.isFeatured, true));

        if (featuredCount >= MAX_FEATURED)
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `쇼케이스는 최대 ${MAX_FEATURED}개까지 가능합니다`,
          });
      }

      await ctx.db
        .update(collectionJobs)
        .set({
          isFeatured: input.featured,
          featuredAt: input.featured ? new Date() : null,
        })
        .where(eq(collectionJobs.id, input.jobId));

      return { jobId: input.jobId, featured: input.featured };
    }),

  // 완료 작업 목록 (쇼케이스 관리용)
  list: systemAdminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(10).max(100).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const offset = (input.page - 1) * input.pageSize;

      const [items, [total]] = await Promise.all([
        ctx.db
          .select({
            id: collectionJobs.id,
            keyword: collectionJobs.keyword,
            createdAt: collectionJobs.createdAt,
            isFeatured: collectionJobs.isFeatured,
            featuredAt: collectionJobs.featuredAt,
            oneLiner: analysisReports.oneLiner,
          })
          .from(collectionJobs)
          .leftJoin(analysisReports, eq(analysisReports.jobId, collectionJobs.id))
          .where(eq(collectionJobs.status, 'completed'))
          .orderBy(desc(collectionJobs.isFeatured), desc(collectionJobs.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ value: count() })
          .from(collectionJobs)
          .where(eq(collectionJobs.status, 'completed')),
      ]);

      // 현재 쇼케이스 수
      const [{ value: featuredCount }] = await ctx.db
        .select({ value: count() })
        .from(collectionJobs)
        .where(eq(collectionJobs.isFeatured, true));

      return {
        items,
        total: total.value,
        featuredCount,
        maxFeatured: MAX_FEATURED,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),
});
