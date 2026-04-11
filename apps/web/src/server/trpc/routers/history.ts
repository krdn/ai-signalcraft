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
import { TRPCError } from '@trpc/server';
import { protectedProcedure, adminProcedure, router } from '../init';
import { verifyJobOwnership } from '../shared/verify-job-ownership';
import { buildJobScopeCondition } from '../shared/query-helpers';

// 스코프 필터 권한 검증 헬퍼
//   - admin / leader : mine | team | user(팀 범위)
//   - super_admin    : 위의 전부 + all + user(시스템 전체)
//   - 그 외          : mine 고정
function resolveScopeForUser(opts: {
  requestedScope?: 'mine' | 'team' | 'all' | 'user';
  requestedTargetUserId?: string;
  userRole?: string;
  systemRole?: string;
  defaultFilterMode: 'mine' | 'team';
}): { scope: 'mine' | 'team' | 'all' | 'user'; targetUserId?: string; allowAllScope: boolean } {
  const isSuperAdmin = opts.systemRole === 'super_admin';
  const isTeamAdmin = opts.userRole === 'admin' || opts.userRole === 'leader';
  const canUseAdvanced = isSuperAdmin || isTeamAdmin;

  if (!canUseAdvanced) {
    // 일반 사용자는 항상 본인 것만
    return { scope: 'mine', allowAllScope: false };
  }

  const requested = opts.requestedScope ?? opts.defaultFilterMode;
  // all 스코프는 super_admin만
  if (requested === 'all' && !isSuperAdmin) {
    return { scope: 'team', allowAllScope: false };
  }
  return {
    scope: requested,
    targetUserId: opts.requestedTargetUserId,
    allowAllScope: isSuperAdmin,
  };
}

export const historyRouter = router({
  // 히스토리 목록 조회 — 역할 기반 확장 스코프 (mine / team / all / user)
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        perPage: z.number().min(1).max(50).default(20),
        // 레거시 호환: 'mine'|'team'만 올 수 있음
        filterMode: z.enum(['mine', 'team']).optional(),
        // 신규 스코프: 'mine' | 'team' | 'all' | 'user'
        scope: z.enum(['mine', 'team', 'all', 'user']).optional(),
        targetUserId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const offset = (input.page - 1) * input.perPage;

      // super_admin 여부 조회 (자기 자신의 systemRole)
      const [me] = await ctx.db
        .select({ systemRole: users.systemRole })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);
      const systemRole = me?.systemRole ?? 'external';
      const userRole = ctx.session.user.role as string | undefined;

      // 입력 해석: scope 우선, 없으면 filterMode(레거시) 사용
      const requestedScope = input.scope ?? input.filterMode ?? undefined;

      const resolved = resolveScopeForUser({
        requestedScope,
        requestedTargetUserId: input.targetUserId,
        userRole,
        systemRole,
        defaultFilterMode: ctx.defaultFilterMode,
      });

      const filter = buildJobScopeCondition({
        scope: resolved.scope,
        teamId: ctx.teamId,
        userId: ctx.userId,
        targetUserId: resolved.targetUserId,
        allowAllScope: resolved.allowAllScope,
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
          domain: collectionJobs.domain,
          keywordType: collectionJobs.keywordType,
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
        // 클라이언트가 실제 적용된 스코프를 알 수 있도록 반환
        appliedScope: resolved.scope,
        appliedTargetUserId: resolved.targetUserId ?? null,
      };
    }),

  // 스코프 범위 내의 실행자(사용자) 목록 조회 — 필터 드롭다운용
  // admin/leader: 팀 범위, super_admin: 전체
  listScopeUsers: protectedProcedure
    .input(
      z.object({
        scope: z.enum(['team', 'all']).default('team'),
      }),
    )
    .query(async ({ input, ctx }) => {
      const userRole = ctx.session.user.role as string | undefined;
      const [me] = await ctx.db
        .select({ systemRole: users.systemRole })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);
      const systemRole = me?.systemRole ?? 'external';
      const isSuperAdmin = systemRole === 'super_admin';
      const isTeamAdmin = userRole === 'admin' || userRole === 'leader';

      if (!isSuperAdmin && !isTeamAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '사용자 목록 조회 권한이 없습니다',
        });
      }

      // all 스코프는 super_admin만
      const effectiveScope: 'team' | 'all' = input.scope === 'all' && isSuperAdmin ? 'all' : 'team';

      // collection_jobs의 실행자 DISTINCT + users 조인
      const baseQuery = ctx.db
        .selectDistinct({
          userId: collectionJobs.userId,
          userName: users.name,
          userEmail: users.email,
          userRole: users.role,
          userSystemRole: users.systemRole,
        })
        .from(collectionJobs)
        .innerJoin(users, eq(collectionJobs.userId, users.id));

      const rows =
        effectiveScope === 'team' && ctx.teamId
          ? await baseQuery.where(eq(collectionJobs.teamId, ctx.teamId))
          : effectiveScope === 'team'
            ? await baseQuery.where(sql`false`) // 팀 정보 없으면 빈 결과
            : await baseQuery;

      return {
        scope: effectiveScope,
        isSuperAdmin,
        isTeamAdmin,
        users: rows
          .filter((r): r is typeof r & { userId: string } => !!r.userId)
          .map((r) => ({
            id: r.userId,
            name: r.userName ?? '(이름 없음)',
            email: r.userEmail ?? null,
            role: r.userRole ?? null,
            systemRole: r.userSystemRole ?? null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
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
