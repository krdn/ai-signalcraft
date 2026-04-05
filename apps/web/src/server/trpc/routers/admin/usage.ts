import { z } from 'zod';
import {
  getUsageSummary,
  getUsageByTeam,
  getUsageByModule,
  getUsageTrend,
} from '@ai-signalcraft/core';
import { systemAdminProcedure, router } from '../../init';

const dateRangeInput = z.object({
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
});

export const usageRouter = router({
  summary: systemAdminProcedure.input(dateRangeInput).query(async ({ input }) => {
    return getUsageSummary(input.startDate, input.endDate);
  }),

  byTeam: systemAdminProcedure.input(dateRangeInput).query(async ({ input }) => {
    return getUsageByTeam(input.startDate, input.endDate);
  }),

  byModule: systemAdminProcedure.input(dateRangeInput).query(async ({ input }) => {
    return getUsageByModule(input.startDate, input.endDate);
  }),

  trend: systemAdminProcedure.input(dateRangeInput).query(async ({ input }) => {
    return getUsageTrend(input.startDate, input.endDate);
  }),
});
