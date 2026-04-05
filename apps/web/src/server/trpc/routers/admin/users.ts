import { z } from 'zod';
import { eq, and, sql, desc, count, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { users, teams, teamMembers, collectionJobs } from '@ai-signalcraft/core';
import { systemAdminProcedure, router } from '../../init';

export const usersRouter = router({
  list: systemAdminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(10).max(100).default(20),
        role: z.enum(['admin', 'leader', 'sales', 'partner', 'member', 'demo']).optional(),
        isActive: z.boolean().optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const conditions = [];

      if (input.role) conditions.push(eq(users.role, input.role));
      if (input.isActive !== undefined) conditions.push(eq(users.isActive, input.isActive));
      if (input.search) {
        conditions.push(
          sql`(${users.name} ILIKE ${'%' + input.search + '%'} OR ${users.email} ILIKE ${'%' + input.search + '%'})`,
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [total]] = await Promise.all([
        ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            isActive: users.isActive,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(where)
          .orderBy(desc(users.createdAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ count: count() }).from(users).where(where),
      ]);

      return { items, total: total.count, page: input.page, pageSize: input.pageSize };
    }),

  updateRole: systemAdminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(['admin', 'leader', 'sales', 'partner', 'member', 'demo']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.session.user?.id && input.role !== 'admin') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '자신의 관리자 역할을 제거할 수 없습니다',
        });
      }

      const [updated] = await ctx.db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId))
        .returning({ id: users.id });

      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),

  toggleActive: systemAdminProcedure
    .input(z.object({ userId: z.string(), isActive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.session.user?.id && !input.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '자신의 계정을 비활성화할 수 없습니다',
        });
      }

      const [updated] = await ctx.db
        .update(users)
        .set({ isActive: input.isActive })
        .where(eq(users.id, input.userId))
        .returning({ id: users.id });

      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),

  deleteUser: systemAdminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // 자기 자신 삭제 방지
      if (input.userId === ctx.session.user?.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '자신의 계정은 삭제할 수 없습니다',
        });
      }

      // 대상 사용자 확인
      const [target] = await ctx.db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!target) throw new TRPCError({ code: 'NOT_FOUND' });

      // 실행 중인 작업 확인
      const [runningJob] = await ctx.db
        .select({ id: collectionJobs.id })
        .from(collectionJobs)
        .where(
          and(
            eq(collectionJobs.userId, input.userId),
            inArray(collectionJobs.status, ['running', 'pending', 'paused']),
          ),
        )
        .limit(1);

      if (runningJob) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: '실행 중인 작업이 있어 삭제할 수 없습니다. 작업 완료 후 다시 시도해 주세요.',
        });
      }

      // 팀 생성자인 경우 소유권 이전 (해당 팀의 다른 멤버에게)
      const ownedTeams = await ctx.db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.createdBy, input.userId));

      for (const team of ownedTeams) {
        const [nextMember] = await ctx.db
          .select({ userId: teamMembers.userId })
          .from(teamMembers)
          .where(
            and(eq(teamMembers.teamId, team.id), sql`${teamMembers.userId} != ${input.userId}`),
          )
          .limit(1);

        if (nextMember) {
          await ctx.db
            .update(teams)
            .set({ createdBy: nextMember.userId })
            .where(eq(teams.id, team.id));
        } else {
          // 팀에 다른 멤버가 없으면 팀 삭제 (cascade로 teamMembers, invitations도 삭제)
          await ctx.db.delete(teams).where(eq(teams.id, team.id));
        }
      }

      // collectionJobs.userId → SET NULL (FK 설정), accounts/sessions/teamMembers/demoQuotas → CASCADE
      // 사용자 삭제
      await ctx.db.delete(users).where(eq(users.id, input.userId));

      return { success: true, deletedEmail: target.email };
    }),
});
