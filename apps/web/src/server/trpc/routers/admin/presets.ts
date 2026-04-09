import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { analysisPresets } from '@ai-signalcraft/core';
import { router, systemAdminProcedure } from '../../init';

const presetInputSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/),
  category: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  icon: z.string().min(1).max(50),
  highlight: z.string().max(200).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  sources: z.record(z.string(), z.boolean()),
  customSourceIds: z.array(z.string().uuid()).default([]),
  limits: z.object({
    naverArticles: z.number().int().min(10).max(5000),
    youtubeVideos: z.number().int().min(5).max(500),
    communityPosts: z.number().int().min(5).max(500),
    commentsPerItem: z.number().int().min(10).max(2000),
  }),
  optimization: z.enum(['none', 'light', 'standard', 'aggressive']).default('standard'),
  skippedModules: z.array(z.string()).default([]),
  enableItemAnalysis: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export const adminPresetsRouter = router({
  list: systemAdminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(analysisPresets).orderBy(asc(analysisPresets.sortOrder));
  }),

  create: systemAdminProcedure.input(presetInputSchema).mutation(async ({ input, ctx }) => {
    const [row] = await ctx.db.insert(analysisPresets).values(input).returning();
    return row;
  }),

  update: systemAdminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        slug: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9_]+$/)
          .optional(),
        category: z.string().min(1).optional(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().min(1).max(500).optional(),
        icon: z.string().min(1).max(50).optional(),
        highlight: z.string().max(200).nullable().optional(),
        sortOrder: z.number().int().min(0).optional(),
        sources: z.record(z.string(), z.boolean()).optional(),
        customSourceIds: z.array(z.string().uuid()).optional(),
        limits: z
          .object({
            naverArticles: z.number().int().min(10).max(5000),
            youtubeVideos: z.number().int().min(5).max(500),
            communityPosts: z.number().int().min(5).max(500),
            commentsPerItem: z.number().int().min(10).max(2000),
          })
          .optional(),
        optimization: z.enum(['none', 'light', 'standard', 'aggressive']).optional(),
        skippedModules: z.array(z.string()).optional(),
        enableItemAnalysis: z.boolean().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...fields } = input;
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) patch[key] = value;
      }

      const [row] = await ctx.db
        .update(analysisPresets)
        .set(patch)
        .where(eq(analysisPresets.id, id))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '프리셋을 찾을 수 없습니다.' });
      return row;
    }),

  delete: systemAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [row] = await ctx.db
        .update(analysisPresets)
        .set({ enabled: false, updatedAt: new Date() })
        .where(eq(analysisPresets.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '프리셋을 찾을 수 없습니다.' });
      return { ok: true };
    }),

  reorder: systemAdminProcedure
    .input(z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })))
    .mutation(async ({ input, ctx }) => {
      for (const item of input) {
        await ctx.db
          .update(analysisPresets)
          .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
          .where(eq(analysisPresets.id, item.id));
      }
      return { ok: true };
    }),
});
