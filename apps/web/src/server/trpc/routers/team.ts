import { z } from 'zod';
import { teams, teamMembers, invitations, users } from '@ai-signalcraft/core';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, adminProcedure, router } from '../init';
import { sendInviteEmail } from '../../email';

export const teamRouter = router({
  // 내 팀 정보 조회
  getMyTeam: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user?.id ?? '';

    const result = await ctx.db
      .select({
        teamId: teams.id,
        teamName: teams.name,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId))
      .limit(1);

    if (result.length === 0) return null;

    return {
      id: result[0].teamId,
      name: result[0].teamName,
      myRole: result[0].role,
    };
  }),

  // 팀 생성 (첫 사용자가 팀을 만들 때)
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user?.id ?? '';

      // 이미 팀에 속해 있는지 확인
      if (ctx.teamId) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '이미 팀에 소속되어 있습니다',
        });
      }

      // 트랜잭션으로 팀 + 멤버 생성
      const result = await ctx.db.transaction(async (tx) => {
        const [team] = await tx
          .insert(teams)
          .values({ name: input.name, createdBy: userId })
          .returning();

        await tx.insert(teamMembers).values({
          teamId: team.id,
          userId,
          role: 'admin',
        });

        return team;
      });

      return { id: result.id, name: result.name };
    }),

  // 팀원 목록 조회
  getMembers: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.teamId) return [];

    const members = await ctx.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
      })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, ctx.teamId));

    return members;
  }),

  // 팀원 초대 (Admin만)
  invite: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(['admin', 'member']).default('member'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const teamId = ctx.teamId;

      // 이미 팀에 속한 사용자인지 확인
      const existingUser = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser.length > 0) {
        const existingMember = await ctx.db
          .select({ id: teamMembers.id })
          .from(teamMembers)
          .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, existingUser[0].id)))
          .limit(1);

        if (existingMember.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '이미 팀에 소속된 사용자입니다',
          });
        }
      }

      // 토큰 생성 및 초대 저장
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일 후

      await ctx.db.insert(invitations).values({
        teamId,
        email: input.email,
        token,
        role: input.role,
        expiresAt,
      });

      // 팀 이름 조회
      const [team] = await ctx.db
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      // 초대 이메일 발송
      const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${token}`;
      await sendInviteEmail({
        to: input.email,
        inviterName: ctx.session.user?.name ?? '관리자',
        teamName: team.name,
        inviteUrl,
        role: input.role,
      });

      return { success: true };
    }),

  // 초대 수락
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user?.id ?? '';

      // 초대 정보 조회
      const [invitation] = await ctx.db
        .select()
        .from(invitations)
        .where(eq(invitations.token, input.token))
        .limit(1);

      if (!invitation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '유효하지 않은 초대 링크입니다',
        });
      }

      // 만료 확인
      if (invitation.expiresAt < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '초대 링크가 만료되었습니다',
        });
      }

      // 이미 수락 확인
      if (invitation.acceptedAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '이미 수락된 초대입니다',
        });
      }

      // 이미 팀에 속해 있는지 확인
      const existingMember = await ctx.db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, invitation.teamId), eq(teamMembers.userId, userId)))
        .limit(1);

      if (existingMember.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '이미 팀에 소속되어 있습니다',
        });
      }

      // 트랜잭션: 팀 멤버 추가 + 초대 수락 처리
      await ctx.db.transaction(async (tx) => {
        await tx.insert(teamMembers).values({
          teamId: invitation.teamId,
          userId,
          role: invitation.role,
        });

        await tx
          .update(invitations)
          .set({ acceptedAt: new Date() })
          .where(eq(invitations.id, invitation.id));
      });

      // 팀 이름 반환
      const [team] = await ctx.db
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, invitation.teamId))
        .limit(1);

      return { success: true, teamName: team.name };
    }),

  // 팀원 제거 (Admin만)
  removeMember: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // 자기 자신 제거 방지
      if (input.userId === ctx.session.user?.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '자기 자신을 팀에서 제거할 수 없습니다',
        });
      }

      const result = await ctx.db
        .delete(teamMembers)
        .where(and(eq(teamMembers.teamId, ctx.teamId), eq(teamMembers.userId, input.userId)))
        .returning();

      if (result.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '해당 팀원을 찾을 수 없습니다',
        });
      }

      return { success: true };
    }),

  // 팀원 역할 변경 (Admin만)
  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(['admin', 'member']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 자기 자신 역할 변경 방지
      if (input.userId === ctx.session.user?.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '자기 자신의 역할을 변경할 수 없습니다',
        });
      }

      const result = await ctx.db
        .update(teamMembers)
        .set({ role: input.role })
        .where(and(eq(teamMembers.teamId, ctx.teamId), eq(teamMembers.userId, input.userId)))
        .returning();

      if (result.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '해당 팀원을 찾을 수 없습니다',
        });
      }

      return { success: true };
    }),

  // 대기 중인 초대 목록 (Admin만) -- FLOW-01: acceptedAt IS NULL 조건 추가
  getPendingInvites: adminProcedure.query(async ({ ctx }) => {
    const pending = await ctx.db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        createdAt: invitations.createdAt,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.teamId, ctx.teamId),
          gt(invitations.expiresAt, new Date()),
          isNull(invitations.acceptedAt),
        ),
      );

    return pending;
  }),
});
