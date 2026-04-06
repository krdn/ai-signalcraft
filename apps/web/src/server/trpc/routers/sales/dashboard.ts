import { sql, eq, count, sum, desc, and, gte } from 'drizzle-orm';
import { leads, leadActivities, users } from '@ai-signalcraft/core';
import { router, salesProcedure } from '../../init';

export const salesDashboardRouter = router({
  // KPI 통계
  stats: salesProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pipeline, wonThisMonth, avgDeal] = await Promise.all([
      // 파이프라인 가치 (active 리드의 예상 매출 합)
      ctx.db
        .select({
          totalValue: sum(leads.expectedRevenue),
          totalLeads: count(),
        })
        .from(leads)
        .where(and(sql`${leads.stage} NOT IN ('closed_won', 'closed_lost')`)),

      // 이번 달 closed_won
      ctx.db
        .select({
          wonCount: count(),
          wonRevenue: sum(leads.expectedRevenue),
        })
        .from(leads)
        .where(and(eq(leads.stage, 'closed_won'), gte(leads.closedAt, monthStart))),

      // 평균 거래 기간 (closed_won 리드의 생성~종료 일수 평균)
      ctx.db
        .select({
          avgDays: sql<number>`
            COALESCE(AVG(EXTRACT(DAY FROM ${leads.closedAt} - ${leads.createdAt})), 0)::int
          `,
        })
        .from(leads)
        .where(eq(leads.stage, 'closed_won')),
    ]);

    // 전환율: closed_won / (closed_won + closed_lost)
    const [conversionData] = await ctx.db
      .select({
        won: sql<number>`count(*) filter (where ${leads.stage} = 'closed_won')`,
        lost: sql<number>`count(*) filter (where ${leads.stage} = 'closed_lost')`,
      })
      .from(leads);

    const won = Number(conversionData?.won ?? 0);
    const lost = Number(conversionData?.lost ?? 0);
    const conversionRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

    return {
      pipelineValue: Number(pipeline[0]?.totalValue ?? 0),
      activeLeads: pipeline[0]?.totalLeads ?? 0,
      monthlyRevenue: Number(wonThisMonth[0]?.wonRevenue ?? 0),
      monthlyWonCount: wonThisMonth[0]?.wonCount ?? 0,
      conversionRate,
      avgDealDays: avgDeal[0]?.avgDays ?? 0,
    };
  }),

  // 스테이지별 파이프라인 요약
  pipelineSummary: salesProcedure.query(async ({ ctx }) => {
    const stages = await ctx.db
      .select({
        stage: leads.stage,
        count: count(),
        totalRevenue: sum(leads.expectedRevenue),
      })
      .from(leads)
      .groupBy(leads.stage);

    return stages.map((s) => ({
      stage: s.stage,
      count: s.count,
      totalRevenue: Number(s.totalRevenue ?? 0),
    }));
  }),

  // 최근 활동 피드
  recentActivity: salesProcedure.query(async ({ ctx }) => {
    const activities = await ctx.db
      .select({
        id: leadActivities.id,
        type: leadActivities.type,
        title: leadActivities.title,
        description: leadActivities.description,
        createdAt: leadActivities.createdAt,
        leadId: leadActivities.leadId,
        companyName: leads.companyName,
        userName: users.name,
      })
      .from(leadActivities)
      .leftJoin(leads, eq(leadActivities.leadId, leads.id))
      .leftJoin(users, eq(leadActivities.userId, users.id))
      .orderBy(desc(leadActivities.createdAt))
      .limit(20);

    return activities;
  }),

  // 월별 트렌드 (최근 12개월)
  monthlyTrend: salesProcedure.query(async ({ ctx }) => {
    const trends = await ctx.db
      .select({
        month: sql<string>`to_char(${leads.closedAt}, 'YYYY-MM')`,
        wonCount: count(),
        wonRevenue: sum(leads.expectedRevenue),
      })
      .from(leads)
      .where(
        and(eq(leads.stage, 'closed_won'), gte(leads.closedAt, sql`NOW() - INTERVAL '12 months'`)),
      )
      .groupBy(sql`to_char(${leads.closedAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${leads.closedAt}, 'YYYY-MM')`);

    return trends.map((t) => ({
      month: t.month,
      wonCount: t.wonCount,
      wonRevenue: Number(t.wonRevenue ?? 0),
    }));
  }),
});
