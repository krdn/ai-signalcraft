import { eq, and, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { analysisResults, calculateCost } from '@ai-signalcraft/core';
import { protectedProcedure, router } from '../init';
import { verifyJobOwnership } from '../shared/verify-job-ownership';

export const llmInsightsRouter = router({
  getModuleModels: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);

      const rows = await ctx.db
        .select({
          module: analysisResults.module,
          status: analysisResults.status,
          usage: analysisResults.usage,
        })
        .from(analysisResults)
        .where(and(eq(analysisResults.jobId, input.jobId), isNotNull(analysisResults.usage)));

      return rows.map((row) => ({
        moduleName: row.module,
        status: row.status,
        provider: row.usage!.provider,
        model: row.usage!.model,
      }));
    }),

  getTokenCosts: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);

      const rows = await ctx.db
        .select({
          module: analysisResults.module,
          usage: analysisResults.usage,
        })
        .from(analysisResults)
        .where(and(eq(analysisResults.jobId, input.jobId), isNotNull(analysisResults.usage)));

      const items = rows.map((row) => {
        const u = row.usage!;
        return {
          moduleName: row.module,
          provider: u.provider,
          model: u.model,
          inputTokens: u.inputTokens,
          outputTokens: u.outputTokens,
          costUsd: calculateCost(u.inputTokens, u.outputTokens, u.model),
        };
      });

      const total = items.reduce(
        (acc, item) => ({
          inputTokens: acc.inputTokens + item.inputTokens,
          outputTokens: acc.outputTokens + item.outputTokens,
          costUsd: acc.costUsd + item.costUsd,
        }),
        { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      );

      return { items, total };
    }),
});
