import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { users, demoQuotas } from '@ai-signalcraft/core';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { publicProcedure, protectedProcedure, router } from '../init';
import { DEMO_DEFAULTS } from '../shared/demo-config';

export const demoAuthRouter = router({
  // 데모 가입 (비밀번호 없이 이메일+이름만)
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1).max(50),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 이미 존재하는 이메일 확인
      const [existing] = await ctx.db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existing) {
        if (existing.role === 'demo') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '이미 데모 계정이 존재합니다. 기존 계정으로 로그인해 주세요.',
          });
        }
        throw new TRPCError({
          code: 'CONFLICT',
          message: '이미 가입된 이메일입니다. 로그인해 주세요.',
        });
      }

      // 데모 전용 임시 비밀번호 생성 (자동 로그인에 사용)
      const tempPassword = crypto.randomUUID();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // 사용자 생성
      const [user] = await ctx.db
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          role: 'demo',
          hashedPassword,
        })
        .returning();

      // 데모 쿼터 생성
      await ctx.db.insert(demoQuotas).values({
        userId: user.id,
        dailyLimit: DEMO_DEFAULTS.dailyLimit,
        todayUsed: 0,
        totalUsed: 0,
        allowedModules: DEMO_DEFAULTS.allowedModules,
        maxCollectionLimits: DEMO_DEFAULTS.maxCollectionLimits,
        expiresAt: new Date(Date.now() + DEMO_DEFAULTS.expiryDays * 24 * 60 * 60 * 1000),
      });

      // 자동 로그인을 위한 credentials 반환
      return {
        email: user.email,
        tempPassword,
        userId: user.id,
      };
    }),

  // 데모 → 정식 전환 (비밀번호 설정)
  upgrade: protectedProcedure
    .input(
      z.object({
        password: z.string().min(8).max(100),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user!.id!;
      const userRole = ctx.session.user.role;

      if (userRole !== 'demo') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '데모 계정만 업그레이드할 수 있습니다.',
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);

      // role을 member로 변경, 비밀번호 설정
      await ctx.db
        .update(users)
        .set({ role: 'member', hashedPassword })
        .where(eq(users.id, userId));

      // 데모 쿼터 삭제
      await ctx.db.delete(demoQuotas).where(eq(demoQuotas.userId, userId));

      return { success: true };
    }),

  // 현재 데모 쿼터 조회 (데모 사용자용)
  getQuota: protectedProcedure.query(async ({ ctx }) => {
    const userRole = ctx.session.user.role;
    if (userRole !== 'demo') return null;

    const [quota] = await ctx.db
      .select()
      .from(demoQuotas)
      .where(eq(demoQuotas.userId, ctx.session.user!.id!))
      .limit(1);

    if (!quota) return null;

    const today = new Date().toISOString().slice(0, 10);
    const todayUsed = quota.todayDate === today ? quota.todayUsed : 0;

    return {
      dailyLimit: quota.dailyLimit,
      todayUsed,
      todayRemaining: quota.dailyLimit - todayUsed,
      totalUsed: quota.totalUsed,
      expiresAt: quota.expiresAt.toISOString(),
      isExpired: quota.expiresAt < new Date(),
      daysLeft: Math.max(
        0,
        Math.ceil((quota.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      ),
    };
  }),
});
