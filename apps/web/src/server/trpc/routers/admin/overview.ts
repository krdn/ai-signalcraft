import { sql, count } from 'drizzle-orm';
import { users, teams, collectionJobs, demoQuotas, getUsageSummary } from '@ai-signalcraft/core';
import { systemAdminProcedure, router } from '../../init';

export const overviewRouter = router({
  stats: systemAdminProcedure.query(async ({ ctx }) => {
    const [[userStats], [teamStats], [jobStats], [demoStats]] = await Promise.all([
      ctx.db
        .select({
          total: count(),
          active: sql<number>`COUNT(*) FILTER (WHERE ${users.isActive} = true)`,
          admins: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'admin')`,
          leaders: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'leader')`,
          sales: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'sales')`,
          partners: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'partner')`,
          members: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'member')`,
          demos: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'demo')`,
        })
        .from(users),
      ctx.db.select({ total: count() }).from(teams),
      ctx.db
        .select({
          total: count(),
          running: sql<number>`COUNT(*) FILTER (WHERE ${collectionJobs.status} = 'running')`,
          completed: sql<number>`COUNT(*) FILTER (WHERE ${collectionJobs.status} = 'completed')`,
          failed: sql<number>`COUNT(*) FILTER (WHERE ${collectionJobs.status} = 'failed')`,
        })
        .from(collectionJobs),
      ctx.db
        .select({
          total: count(),
          converted: sql<number>`COUNT(*) FILTER (WHERE ${demoQuotas.totalUsed} > 0)`,
        })
        .from(demoQuotas),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyCost = await getUsageSummary(monthStart, now);
    const totalMonthlyCost = monthlyCost.reduce((sum, r) => sum + r.estimatedCostUsd, 0);

    return {
      users: userStats,
      teams: { total: teamStats.total },
      jobs: jobStats,
      demo: demoStats,
      monthlyCost: Math.round(totalMonthlyCost * 100) / 100,
    };
  }),
});
