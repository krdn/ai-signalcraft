import { z } from 'zod';
import { desc, eq, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { releases, releaseEntries } from '@ai-signalcraft/core';
import { router, systemAdminProcedure } from '../../init';

export const adminReleasesRouter = router({
  listAll: systemAdminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(5).max(50).default(20),
        status: z.enum(['draft', 'published', 'archived']).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const where = input.status ? eq(releases.status, input.status) : undefined;

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

      return { items, total: total.count, page: input.page, pageSize: input.pageSize };
    }),

  getById: systemAdminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const [release] = await ctx.db
        .select()
        .from(releases)
        .where(eq(releases.id, input.id))
        .limit(1);
      if (!release) throw new TRPCError({ code: 'NOT_FOUND' });

      const entries = await ctx.db
        .select()
        .from(releaseEntries)
        .where(eq(releaseEntries.releaseId, input.id))
        .orderBy(releaseEntries.order);

      return { ...release, entries };
    }),

  updateRelease: systemAdminProcedure
    .input(
      z.object({
        id: z.number(),
        summary: z.string().max(500).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...patch } = input;
      const [updated] = await ctx.db
        .update(releases)
        .set(patch)
        .where(eq(releases.id, id))
        .returning({ id: releases.id });
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),

  updateEntry: systemAdminProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullable().optional(),
        category: z.enum(['feature', 'fix', 'pipeline', 'chore', 'breaking']).optional(),
        scope: z.enum(['user', 'internal']).optional(),
        order: z.number().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...patch } = input;
      const [updated] = await ctx.db
        .update(releaseEntries)
        .set(patch)
        .where(eq(releaseEntries.id, id))
        .returning({ id: releaseEntries.id });
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),

  deleteEntry: systemAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.delete(releaseEntries).where(eq(releaseEntries.id, input.id));
      return { success: true };
    }),

  publish: systemAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [updated] = await ctx.db
        .update(releases)
        .set({ status: 'published', publishedAt: new Date() })
        .where(eq(releases.id, input.id))
        .returning({ id: releases.id, version: releases.version });
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return updated;
    }),

  unpublish: systemAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [updated] = await ctx.db
        .update(releases)
        .set({ status: 'draft', publishedAt: null })
        .where(eq(releases.id, input.id))
        .returning({ id: releases.id });
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),

  delete: systemAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.delete(releases).where(eq(releases.id, input.id));
      return { success: true };
    }),
});
