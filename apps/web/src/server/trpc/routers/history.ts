import { z } from 'zod';
import {
  collectionJobs,
  users,
  deleteJob,
  deleteJobs,
  cleanupOldJobs,
  cleanupOrphanedData,
  getDataStats,
} from '@ai-signalcraft/core';
import { desc, sql, eq } from 'drizzle-orm';
import { protectedProcedure, adminProcedure, router } from '../init';
import { verifyJobOwnership } from '../shared/verify-job-ownership';
import { buildJobListCondition } from '../shared/query-helpers';

export const historyRouter = router({
  // 히스토리 목록 조회 -- 역할 기반 필터링 (admin/leader: 팀 전체, member: 내 것만)
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        perPage: z.number().min(1).max(50).default(20),
        filterMode: z.enum(['mine', 'team']).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const offset = (input.page - 1) * input.perPage;
      const filterMode = input.filterMode ?? ctx.defaultFilterMode;

      const filter = buildJobListCondition({
        teamId: ctx.teamId,
        userId: ctx.userId,
        filterMode,
      });

      const baseQuery = ctx.db
        .select({
          id: collectionJobs.id,
          teamId: collectionJobs.teamId,
          userId: collectionJobs.userId,
          keyword: collectionJobs.keyword,
          startDate: collectionJobs.startDate,
          endDate: collectionJobs.endDate,
          status: collectionJobs.status,
          progress: collectionJobs.progress,
          limits: collectionJobs.limits,
          errorDetails: collectionJobs.errorDetails,
          costLimitUsd: collectionJobs.costLimitUsd,
          skippedModules: collectionJobs.skippedModules,
          options: collectionJobs.options,
          createdAt: collectionJobs.createdAt,
          updatedAt: collectionJobs.updatedAt,
          userName: users.name,
        })
        .from(collectionJobs)
        .leftJoin(users, eq(collectionJobs.userId, users.id));

      const jobs = filter
        ? await baseQuery
            .where(filter)
            .orderBy(desc(collectionJobs.createdAt))
            .limit(input.perPage)
            .offset(offset)
        : await baseQuery
            .orderBy(desc(collectionJobs.createdAt))
            .limit(input.perPage)
            .offset(offset);

      const countQuery = ctx.db.select({ count: sql<number>`count(*)::int` }).from(collectionJobs);
      const [{ count }] = filter ? await countQuery.where(filter) : await countQuery;

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
      await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);
      return deleteJob(input.jobId);
    }),

  // 다건 일괄 삭제
  bulkDelete: protectedProcedure
    .input(z.object({ jobIds: z.array(z.number()).min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      for (const jobId of input.jobIds) {
        await verifyJobOwnership(ctx, jobId, ctx.defaultFilterMode);
      }
      return deleteJobs(input.jobIds);
    }),

  // 보존 기간 기반 자동 정리 (관리자 전용)
  cleanup: adminProcedure
    .input(
      z.object({
        retentionDays: z.number().min(1).max(365).default(90),
      }),
    )
    .mutation(async ({ input }) => {
      return cleanupOldJobs(input.retentionDays);
    }),

  // 고아 데이터 정리 (관리자 전용)
  cleanupOrphans: adminProcedure.mutation(async () => {
    return cleanupOrphanedData();
  }),

  // 데이터 통계 (관리자 전용)
  stats: adminProcedure.query(async () => {
    return getDataStats();
  }),
});
