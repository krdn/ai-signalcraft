import { asc, eq } from 'drizzle-orm';
import { analysisPresets } from '@krdn/core';
import { router, protectedProcedure } from '../init';

export const presetsRouter = router({
  listEnabled: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: analysisPresets.id,
        slug: analysisPresets.slug,
        category: analysisPresets.category,
        title: analysisPresets.title,
        description: analysisPresets.description,
        icon: analysisPresets.icon,
        highlight: analysisPresets.highlight,
        sources: analysisPresets.sources,
        customSourceIds: analysisPresets.customSourceIds,
        limits: analysisPresets.limits,
        optimization: analysisPresets.optimization,
        skippedModules: analysisPresets.skippedModules,
        enableItemAnalysis: analysisPresets.enableItemAnalysis,
      })
      .from(analysisPresets)
      .where(eq(analysisPresets.enabled, true))
      .orderBy(asc(analysisPresets.sortOrder));
  }),
});
