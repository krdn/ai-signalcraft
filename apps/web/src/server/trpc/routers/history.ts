import { z } from 'zod';
import {
  collectionJobs,
  users,
  teamMembers,
  analysisSeries,
  deleteJob,
  deleteJobs,
  cleanupOldJobs,
  cleanupOrphanedData,
  getDataStats,
} from '@ai-signalcraft/core';
import { desc, sql, eq, and, inArray } from 'drizzle-orm';
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
        keyword: z.string().optional(),
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
          seriesId: collectionJobs.seriesId,
          seriesOrder: collectionJobs.seriesOrder,
          seriesTitle: analysisSeries.title,
        })
        .from(collectionJobs)
        .leftJoin(users, eq(collectionJobs.userId, users.id))
        .leftJoin(analysisSeries, eq(collectionJobs.seriesId, analysisSeries.id));

      const keywordCond = input.keyword ? eq(collectionJobs.keyword, input.keyword) : undefined;
      const finalCond = filter && keywordCond ? and(filter, keywordCond) : (filter ?? keywordCond);

      const jobs = finalCond
        ? await baseQuery
            .where(finalCond)
            .orderBy(desc(collectionJobs.createdAt))
            .limit(input.perPage)
            .offset(offset)
        : await baseQuery
            .orderBy(desc(collectionJobs.createdAt))
            .limit(input.perPage)
            .offset(offset);

      const countQuery = ctx.db.select({ count: sql<number>`count(*)::int` }).from(collectionJobs);
      const [{ count }] = finalCond ? await countQuery.where(finalCond) : await countQuery;

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

  // 스코프 범위 내의 사용자 목록 조회 — 필터 드롭다운용
  //
  // 반환 소스 전략:
  //   - super_admin + scope='all' → users 테이블 전체 (collection_jobs 기록 유무 무관)
  //   - 그 외 (admin/leader, team 스코프) → 스코프 내 collection_jobs 실행자 DISTINCT
  //
  // 'collection_jobs 기록이 있는 사용자만'이 원칙이지만,
  // 레거시 데이터에서 user_id가 NULL인 row가 많아 드롭다운이 비는 문제를 방지하기 위해
  // super_admin은 users 테이블을 직접 조회해 안전망을 제공한다.
  listScopeUsers: protectedProcedure
    .input(
      z.object({
        scope: z.enum(['team', 'all']).default('team'),
      }),
    )
    .query(async ({ ctx }) => {
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

      // super_admin은 항상 'all' 취급 (teamId가 없는 경우가 많아 team 제한은 부적합)
      // 입력 scope는 서버가 항상 권한에 맞게 재결정
      const effectiveScope: 'team' | 'all' = isSuperAdmin ? 'all' : 'team';

      type UserRow = {
        id: string;
        name: string;
        email: string | null;
        role: string | null;
        systemRole: string | null;
      };

      let rows: UserRow[] = [];

      if (effectiveScope === 'all') {
        // super_admin: users 테이블 전체 직접 조회 (비활성 포함은 이후 정책)
        const allUsers = await ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            systemRole: users.systemRole,
          })
          .from(users);
        rows = allUsers.map((u) => ({
          id: u.id,
          name: u.name ?? u.email ?? '(이름 없음)',
          email: u.email ?? null,
          role: u.role ?? null,
          systemRole: u.systemRole ?? null,
        }));
      } else {
        // admin/leader: 소속 팀의 collection_jobs 실행자 DISTINCT
        if (ctx.teamId) {
          const teamRows = await ctx.db
            .selectDistinct({
              userId: collectionJobs.userId,
              userName: users.name,
              userEmail: users.email,
              userRole: users.role,
              userSystemRole: users.systemRole,
            })
            .from(collectionJobs)
            .innerJoin(users, eq(collectionJobs.userId, users.id))
            .where(eq(collectionJobs.teamId, ctx.teamId));
          rows = teamRows
            .filter((r): r is typeof r & { userId: string } => !!r.userId)
            .map((r) => ({
              id: r.userId,
              name: r.userName ?? r.userEmail ?? '(이름 없음)',
              email: r.userEmail ?? null,
              role: r.userRole ?? null,
              systemRole: r.userSystemRole ?? null,
            }));
        }

        // 팀에 기록이 없으면 team_members에서라도 목록 확보
        if (rows.length === 0 && ctx.teamId) {
          const teamMates = await ctx.db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              role: users.role,
              systemRole: users.systemRole,
            })
            .from(users)
            .innerJoin(teamMembers, eq(teamMembers.userId, users.id))
            .where(eq(teamMembers.teamId, ctx.teamId));
          rows = teamMates.map((u) => ({
            id: u.id,
            name: u.name ?? u.email ?? '(이름 없음)',
            email: u.email ?? null,
            role: u.role ?? null,
            systemRole: u.systemRole ?? null,
          }));
        }
      }

      return {
        scope: effectiveScope,
        isSuperAdmin,
        isTeamAdmin,
        users: rows.sort((a, b) => a.name.localeCompare(b.name, 'ko')),
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
      // 단일 쿼리로 접근 권한 있는 잡 ID 조회
      const accessibleJobs = await ctx.db
        .select({ id: collectionJobs.id })
        .from(collectionJobs)
        .where(
          and(
            inArray(collectionJobs.id, input.jobIds),
            ctx.teamId
              ? eq(collectionJobs.teamId, ctx.teamId)
              : eq(collectionJobs.userId, ctx.userId),
          ),
        );
      const accessibleIds = new Set(accessibleJobs.map((j) => j.id));
      const unauthorized = input.jobIds.filter((id) => !accessibleIds.has(id));
      if (unauthorized.length > 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `접근 권한 없는 작업: ${unauthorized.join(',')}`,
        });
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
