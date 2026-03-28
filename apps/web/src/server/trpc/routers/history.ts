import { z } from 'zod';
import { protectedProcedure, adminProcedure, router } from '../init';
import { collectionJobs, deleteJob, deleteJobs, cleanupOldJobs, cleanupOrphanedData, getDataStats } from '@ai-signalcraft/core';
import { desc, sql, eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const historyRouter = router({
  // 히스토리 목록 조회 -- 과거 분석 작업 페이지네이션 (팀 필터링)
  list: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      perPage: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const offset = (input.page - 1) * input.perPage;

      // 팀 소속인 경우 해당 팀의 작업만 필터
      const teamFilter = ctx.teamId
        ? eq(collectionJobs.teamId, ctx.teamId)
        : undefined;

      const baseQuery = ctx.db.select().from(collectionJobs);
      const jobs = teamFilter
        ? await baseQuery.where(teamFilter).orderBy(desc(collectionJobs.createdAt)).limit(input.perPage).offset(offset)
        : await baseQuery.orderBy(desc(collectionJobs.createdAt)).limit(input.perPage).offset(offset);

      const countQuery = ctx.db.select({ count: sql<number>`count(*)::int` }).from(collectionJobs);
      const [{ count }] = teamFilter
        ? await countQuery.where(teamFilter)
        : await countQuery;

      return {
        items: jobs,
        total: count,
        page: input.page,
        perPage: input.perPage,
      };
    }),

  // 단일 작업 삭제
  delete: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await verifyJobOwnership(ctx, input.jobId);
      return deleteJob(input.jobId);
    }),

  // 다건 일괄 삭제
  bulkDelete: protectedProcedure
    .input(z.object({ jobIds: z.array(z.number()).min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      // 모든 job이 해당 팀 소유인지 확인
      for (const jobId of input.jobIds) {
        await verifyJobOwnership(ctx, jobId);
      }
      return deleteJobs(input.jobIds);
    }),

  // 보존 기간 기반 자동 정리 (관리자 전용)
  cleanup: adminProcedure
    .input(z.object({
      retentionDays: z.number().min(1).max(365).default(90),
    }))
    .mutation(async ({ input }) => {
      return cleanupOldJobs(input.retentionDays);
    }),

  // 고아 데이터 정리 (관리자 전용)
  cleanupOrphans: adminProcedure
    .mutation(async () => {
      return cleanupOrphanedData();
    }),

  // 데이터 통계 (관리자 전용)
  stats: adminProcedure
    .query(async () => {
      return getDataStats();
    }),
});

// 작업 소유권 확인 헬퍼
async function verifyJobOwnership(ctx: { teamId?: number | null; db: any }, jobId: number) {
  if (ctx.teamId) {
    const [job] = await ctx.db.select({ id: collectionJobs.id })
      .from(collectionJobs)
      .where(and(eq(collectionJobs.id, jobId), eq(collectionJobs.teamId, ctx.teamId)));
    if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' });
  }
}
