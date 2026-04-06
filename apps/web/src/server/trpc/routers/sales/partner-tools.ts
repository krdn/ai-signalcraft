import { z } from 'zod';
import { eq, count, sum, sql, desc } from 'drizzle-orm';
import {
  users,
  leads,
  partnerClients,
  commissions,
  collectionJobs,
  analysisReports,
} from '@ai-signalcraft/core';
import { router, salesProcedure } from '../../init';

// 가격 데이터 (landing data 참조)
const PRICING = {
  starter: { name: 'Starter', price: 49, description: '소규모 팀, 컨설턴트' },
  professional: { name: 'Professional', price: 129, description: 'PR 에이전시, 기업 홍보팀' },
  campaign: { name: 'Campaign', price: 249, description: '정치 캠프, 대규모 조직' },
};

export const partnerToolsRouter = router({
  // 파트너별 실적 대시보드
  partnerPerformance: salesProcedure
    .input(z.object({ partnerId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      // 파트너 목록
      const partners = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(sql`${users.role} IN ('partner', 'sales') AND ${users.isActive} = true`);

      if (input.partnerId) {
        // 특정 파트너의 상세 실적
        const [clientStats, referredLeads, totalCommission] = await Promise.all([
          ctx.db
            .select({
              total: count(),
              contracted: sql<number>`count(*) filter (where ${partnerClients.status} = 'contracted')`,
              revenue: sum(partnerClients.monthlyRevenue),
            })
            .from(partnerClients)
            .where(eq(partnerClients.partnerId, input.partnerId)),

          ctx.db
            .select({
              total: count(),
              won: sql<number>`count(*) filter (where ${leads.stage} = 'closed_won')`,
            })
            .from(leads)
            .where(eq(leads.partnerId, input.partnerId)),

          ctx.db
            .select({ total: sum(commissions.commissionAmount) })
            .from(commissions)
            .where(eq(commissions.partnerId, input.partnerId)),
        ]);

        return {
          partners,
          detail: {
            totalClients: clientStats[0]?.total ?? 0,
            contractedClients: Number(clientStats[0]?.contracted ?? 0),
            monthlyRevenue: Number(clientStats[0]?.revenue ?? 0),
            referredLeads: referredLeads[0]?.total ?? 0,
            wonLeads: Number(referredLeads[0]?.won ?? 0),
            totalCommission: Number(totalCommission[0]?.total ?? 0),
          },
        };
      }

      return { partners, detail: null };
    }),

  // 영업 자료 (정적 데이터)
  salesMaterials: salesProcedure.query(async () => {
    return {
      pricing: PRICING,
      comparisons: {
        manualMonitoring: { name: '인력 모니터링', cost: '250~350만원/월', scope: '수집만' },
        socialListening: {
          name: '소셜 리스닝 도구',
          cost: '50~300만원/월',
          scope: '수집+감정분석',
        },
        signalCraft: { name: 'AI SignalCraft', cost: '129만원/월~', scope: '수집+분석+전략' },
      },
      keyBenefits: [
        '5개 소스 자동 수집 (네이버 뉴스, 유튜브, DC, FM코리아, 클리앙)',
        '14개 AI 분석 모듈 (감정, 프레임, 리스크, 기회, 전략)',
        '실시간 여론 변화 모니터링',
        'PDF 리포트 자동 생성',
        '비용 대비 3~5배 효율 (인력 절감)',
      ],
      useCases: [
        { name: 'PR 에이전시', description: '클라이언트 여론 분석 리포트 자동화' },
        { name: '정치 캠프', description: '실시간 여론 추적 및 전략 도출' },
        { name: '기업 홍보팀', description: '브랜드 이슈 조기 감지 및 대응' },
        { name: '컨설팅', description: '데이터 기반 고객 인사이트 제공' },
      ],
    };
  }),

  // 파트너에게 공유 가능한 리포트 목록
  availableReports: salesProcedure
    .input(z.object({ page: z.number().min(1).default(1) }))
    .query(async ({ input, ctx }) => {
      const items = await ctx.db
        .select({
          jobId: collectionJobs.id,
          keyword: collectionJobs.keyword,
          status: collectionJobs.status,
          createdAt: collectionJobs.createdAt,
          hasReport: sql<boolean>`EXISTS (
            SELECT 1 FROM ${analysisReports} WHERE ${analysisReports.jobId} = ${collectionJobs.id}
          )`,
        })
        .from(collectionJobs)
        .where(eq(collectionJobs.status, 'completed'))
        .orderBy(desc(collectionJobs.createdAt))
        .limit(20)
        .offset((input.page - 1) * 20);

      return items;
    }),
});
