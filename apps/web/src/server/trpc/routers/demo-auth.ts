import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { users, demoQuotas, verificationTokens } from '@ai-signalcraft/core';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { publicProcedure, protectedProcedure, router } from '../init';
import { DEMO_DEFAULTS } from '../shared/demo-config';
import { sendVerificationEmail } from '../../email';

function generateVerificationToken(): string {
  return crypto.randomUUID();
}

function buildVerificationUrl(token: string): string {
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return `${baseUrl}/verify-email?token=${token}`;
}

export const demoAuthRouter = router({
  // 데모 가입 (이메일+이름+비밀번호)
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1).max(50),
        password: z.string().min(8).max(100),
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

      // 사용자가 입력한 비밀번호로 해시 생성
      const hashedPassword = await bcrypt.hash(input.password, 10);

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

      // 인증 토큰 생성 및 링크 발송
      const token = generateVerificationToken();
      await ctx.db.insert(verificationTokens).values({
        identifier: user.email,
        token,
        expires: new Date(Date.now() + 10 * 60 * 1000), // 10분
      });

      const verificationUrl = buildVerificationUrl(token);
      try {
        await sendVerificationEmail({ to: user.email, verificationUrl });
      } catch (err) {
        // 이메일 발송 실패해도 가입은 진행 — 재발송으로 복구 가능
        console.error('[Demo Signup] 인증 이메일 발송 실패:', err);
        console.log(`[Demo Signup] 인증 링크 (${user.email}): ${verificationUrl}`);
      }

      return {
        email: user.email,
        userId: user.id,
        requiresVerification: true,
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

  // 인증 링크 토큰 검증
  verifyEmail: publicProcedure
    .input(
      z.object({
        token: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [record] = await ctx.db
        .select()
        .from(verificationTokens)
        .where(eq(verificationTokens.token, input.token))
        .limit(1);

      if (!record) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '유효하지 않은 인증 링크입니다',
        });
      }

      if (record.expires < new Date()) {
        await ctx.db
          .delete(verificationTokens)
          .where(eq(verificationTokens.identifier, record.identifier));
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '인증 링크가 만료되었습니다. 새 인증 메일을 요청해 주세요.',
        });
      }

      // 인증 성공: emailVerified 업데이트 + 토큰 삭제
      await Promise.all([
        ctx.db
          .update(users)
          .set({ emailVerified: new Date() })
          .where(eq(users.email, record.identifier)),
        ctx.db
          .delete(verificationTokens)
          .where(eq(verificationTokens.identifier, record.identifier)),
      ]);

      return { verified: true };
    }),

  // 인증 코드 재발송
  resendCode: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      // 사용자 존재 및 인증 상태 확인
      const [user] = await ctx.db
        .select({ id: users.id, emailVerified: users.emailVerified })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '등록되지 않은 이메일입니다' });
      }
      if (user.emailVerified) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '이미 인증된 이메일입니다',
        });
      }

      // rate limit: 최근 토큰이 1분 이내면 거부
      const [recentToken] = await ctx.db
        .select({ expires: verificationTokens.expires })
        .from(verificationTokens)
        .where(eq(verificationTokens.identifier, input.email))
        .limit(1);

      if (recentToken) {
        // 토큰 생성 시간 = expires - 10분
        const createdAt = new Date(recentToken.expires.getTime() - 10 * 60 * 1000);
        if (Date.now() - createdAt.getTime() < 60 * 1000) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: '1분 후에 다시 요청해 주세요',
          });
        }
      }

      // 기존 토큰 삭제 → 새 토큰 생성 → 저장 → 링크 발송
      await ctx.db.delete(verificationTokens).where(eq(verificationTokens.identifier, input.email));

      const token = generateVerificationToken();
      await ctx.db.insert(verificationTokens).values({
        identifier: input.email,
        token,
        expires: new Date(Date.now() + 10 * 60 * 1000),
      });

      const verificationUrl = buildVerificationUrl(token);
      try {
        await sendVerificationEmail({ to: input.email, verificationUrl });
      } catch (err) {
        console.error('[Resend Code] 인증 이메일 발송 실패:', err);
        console.log(`[Resend Code] 인증 링크 (${input.email}): ${verificationUrl}`);
      }

      return { sent: true };
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
