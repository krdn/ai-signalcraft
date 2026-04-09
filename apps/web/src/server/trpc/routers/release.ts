import { z } from 'zod';
import { desc, eq, count, gt, and, inArray } from 'drizzle-orm';
import { releases, releaseEntries, userReleaseViews } from '@ai-signalcraft/core';
import { router, authedProcedure } from '../init';

export const releaseRouter = router({
  list: authedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(5).max(50).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const where = eq(releases.status, 'published');

      const [items, [total]] = await Promise.all([
        ctx.db
          .select()
          .from(releases)
          .where(where)
          .orderBy(desc(releases.deployedAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ count: count() }).from(releases).where(where),
      ]);

      // 각 release에 속한 entries 조회 (N+1 방지: in 쿼리)
      const releaseIds = items.map((r) => r.id);
      const entries = releaseIds.length
        ? await ctx.db
            .select()
            .from(releaseEntries)
            .where(inArray(releaseEntries.releaseId, releaseIds))
        : [];

      const entriesByRelease = new Map<number, typeof entries>();
      for (const e of entries) {
        const list = entriesByRelease.get(e.releaseId) ?? [];
        list.push(e);
        entriesByRelease.set(e.releaseId, list);
      }

      return {
        items: items.map((r) => ({
          ...r,
          entries: (entriesByRelease.get(r.id) ?? []).sort((a, b) => a.order - b.order),
        })),
        total: total.count,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  getLatest: authedProcedure
    .input(z.object({ limit: z.number().min(1).max(10).default(5) }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit ?? 5;
      const items = await ctx.db
        .select()
        .from(releases)
        .where(eq(releases.status, 'published'))
        .orderBy(desc(releases.deployedAt))
        .limit(limit);
      return items;
    }),

  unreadCount: authedProcedure.query(async ({ ctx }) => {
    // 현재 사용자의 lastViewedReleaseId 조회
    const [view] = await ctx.db
      .select()
      .from(userReleaseViews)
      .where(eq(userReleaseViews.userId, ctx.userId))
      .limit(1);

    const conditions = [eq(releases.status, 'published')];
    if (view?.lastViewedReleaseId) {
      conditions.push(gt(releases.id, view.lastViewedReleaseId));
    }

    const [row] = await ctx.db
      .select({ count: count() })
      .from(releases)
      .where(and(...conditions));

    return { count: Number(row?.count ?? 0) };
  }),

  markAsRead: authedProcedure.mutation(async ({ ctx }) => {
    // 가장 최근 published release 조회
    const [latest] = await ctx.db
      .select({ id: releases.id })
      .from(releases)
      .where(eq(releases.status, 'published'))
      .orderBy(desc(releases.id))
      .limit(1);

    if (!latest) return { success: true, lastViewedReleaseId: null };

    await ctx.db
      .insert(userReleaseViews)
      .values({
        userId: ctx.userId,
        lastViewedReleaseId: latest.id,
        viewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userReleaseViews.userId,
        set: { lastViewedReleaseId: latest.id, viewedAt: new Date() },
      });

    return { success: true, lastViewedReleaseId: latest.id };
  }),
});
