import { z } from 'zod';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { reportShareLinks, analysisReports, collectionJobs } from '@ai-signalcraft/core';
import { router, salesProcedure, publicProcedure } from '../../init';

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export const shareLinksRouter = router({
  // 공유 링크 생성
  create: salesProcedure
    .input(
      z.object({
        jobId: z.number(),
        customTitle: z.string().optional(),
        customLogo: z.string().url().optional(),
        watermark: z.string().optional(),
        password: z.string().optional(),
        expiresInDays: z.number().min(1).max(90).optional(),
        maxViews: z.number().min(1).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 리포트 존재 확인
      const [report] = await ctx.db
        .select()
        .from(analysisReports)
        .where(eq(analysisReports.jobId, input.jobId))
        .limit(1);

      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '해당 작업의 리포트가 없습니다' });
      }

      const token = generateToken();
      let hashedPassword: string | undefined;
      if (input.password) {
        const { hash } = await import('bcryptjs');
        hashedPassword = await hash(input.password, 10);
      }

      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      const [created] = await ctx.db
        .insert(reportShareLinks)
        .values({
          token,
          jobId: input.jobId,
          createdBy: ctx.userId,
          customTitle: input.customTitle,
          customLogo: input.customLogo,
          watermark: input.watermark,
          password: hashedPassword,
          expiresAt,
          maxViews: input.maxViews,
        })
        .returning({ id: reportShareLinks.id, token: reportShareLinks.token });

      return { id: created.id, token: created.token };
    }),

  // 내 공유 링크 목록
  list: salesProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(10).max(50).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const where = eq(reportShareLinks.createdBy, ctx.userId);

      const [items, [total]] = await Promise.all([
        ctx.db
          .select({
            id: reportShareLinks.id,
            token: reportShareLinks.token,
            jobId: reportShareLinks.jobId,
            customTitle: reportShareLinks.customTitle,
            expiresAt: reportShareLinks.expiresAt,
            viewCount: reportShareLinks.viewCount,
            downloadCount: reportShareLinks.downloadCount,
            isActive: reportShareLinks.isActive,
            createdAt: reportShareLinks.createdAt,
            keyword: collectionJobs.keyword,
          })
          .from(reportShareLinks)
          .leftJoin(collectionJobs, eq(reportShareLinks.jobId, collectionJobs.id))
          .where(where)
          .orderBy(desc(reportShareLinks.createdAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ count: count() }).from(reportShareLinks).where(where),
      ]);

      return { items, total: total.count };
    }),

  // 공유 링크 업데이트
  update: salesProcedure
    .input(
      z.object({
        id: z.string(),
        isActive: z.boolean().optional(),
        expiresInDays: z.number().min(1).max(90).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [existing] = await ctx.db
        .select()
        .from(reportShareLinks)
        .where(and(eq(reportShareLinks.id, input.id), eq(reportShareLinks.createdBy, ctx.userId)))
        .limit(1);

      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.db
        .update(reportShareLinks)
        .set({
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.expiresInDays
            ? { expiresAt: new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000) }
            : {}),
        })
        .where(eq(reportShareLinks.id, input.id));

      return { success: true };
    }),

  // 공개: 토큰으로 리포트 조회
  getByToken: publicProcedure
    .input(z.object({ token: z.string(), password: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const [link] = await ctx.db
        .select()
        .from(reportShareLinks)
        .where(eq(reportShareLinks.token, input.token))
        .limit(1);

      if (!link || !link.isActive) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '유효하지 않은 공유 링크입니다' });
      }

      // 만료 확인
      if (link.expiresAt && link.expiresAt < new Date()) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '만료된 공유 링크입니다' });
      }

      // 조회수 제한
      if (link.maxViews && link.viewCount >= link.maxViews) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '최대 조회 횟수를 초과했습니다' });
      }

      // 비밀번호 확인
      if (link.password) {
        if (!input.password) {
          return { requiresPassword: true as const };
        }
        const { compare } = await import('bcryptjs');
        const valid = await compare(input.password, link.password);
        if (!valid) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '비밀번호가 올바르지 않습니다' });
        }
      }

      // 리포트 조회
      const [report] = await ctx.db
        .select()
        .from(analysisReports)
        .where(eq(analysisReports.jobId, link.jobId))
        .limit(1);

      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '리포트를 찾을 수 없습니다' });
      }

      // 조회수 증가
      await ctx.db
        .update(reportShareLinks)
        .set({
          viewCount: sql`${reportShareLinks.viewCount} + 1`,
          lastViewedAt: new Date(),
        })
        .where(eq(reportShareLinks.id, link.id));

      return {
        requiresPassword: false as const,
        report: {
          title: link.customTitle ?? report.title,
          markdownContent: report.markdownContent,
          oneLiner: report.oneLiner,
          metadata: report.metadata,
        },
        branding: {
          customLogo: link.customLogo,
          watermark: link.watermark,
        },
      };
    }),
});
