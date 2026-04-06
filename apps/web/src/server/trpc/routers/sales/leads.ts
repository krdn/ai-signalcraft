import { z } from 'zod';
import { eq, and, desc, count, like, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { leads, leadActivities, users } from '@ai-signalcraft/core';
import { router, salesProcedure } from '../../init';

// 리드 스코어 계산
function calculateLeadScore(lead: {
  companySize?: string | null;
  industry?: string | null;
  source: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  demoAccountId?: string | null;
}): number {
  let score = 0;

  // 회사 규모
  const sizeScores: Record<string, number> = {
    '1-10': 5,
    '11-50': 10,
    '51-200': 15,
    '201-1000': 25,
    '1000+': 30,
  };
  if (lead.companySize) score += sizeScores[lead.companySize] ?? 0;

  // 업종
  const industryScores: Record<string, number> = {
    PR에이전시: 20,
    정치캠프: 20,
    기업홍보팀: 15,
    컨설팅: 15,
    미디어: 10,
  };
  if (lead.industry) score += industryScores[lead.industry] ?? 5;

  // 소스
  const sourceScores: Record<string, number> = {
    inbound: 20,
    demo_signup: 15,
    partner_referral: 10,
    event: 10,
    cold_email: 5,
    other: 0,
  };
  score += sourceScores[lead.source] ?? 0;

  // 연락처
  if (lead.contactEmail) score += 5;
  if (lead.contactPhone) score += 5;

  // 데모 생성
  if (lead.demoAccountId) score += 15;

  return Math.min(score, 100);
}

export const salesLeadsRouter = router({
  // 리드 목록
  list: salesProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(10).max(100).default(20),
        stage: z
          .enum([
            'lead',
            'contacted',
            'demo',
            'proposal',
            'negotiation',
            'closed_won',
            'closed_lost',
          ])
          .optional(),
        source: z
          .enum(['cold_email', 'inbound', 'partner_referral', 'demo_signup', 'event', 'other'])
          .optional(),
        assignedTo: z.string().optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const conditions = [];
      if (input.stage) conditions.push(eq(leads.stage, input.stage));
      if (input.source) conditions.push(eq(leads.source, input.source));
      if (input.assignedTo) conditions.push(eq(leads.assignedTo, input.assignedTo));
      if (input.search) {
        conditions.push(
          or(
            like(leads.companyName, `%${input.search}%`),
            like(leads.contactName, `%${input.search}%`),
            like(leads.contactEmail, `%${input.search}%`),
          ),
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [total]] = await Promise.all([
        ctx.db
          .select({
            id: leads.id,
            companyName: leads.companyName,
            contactName: leads.contactName,
            contactEmail: leads.contactEmail,
            stage: leads.stage,
            source: leads.source,
            expectedPlan: leads.expectedPlan,
            expectedRevenue: leads.expectedRevenue,
            score: leads.score,
            assignedTo: leads.assignedTo,
            assignedName: users.name,
            createdAt: leads.createdAt,
            updatedAt: leads.updatedAt,
          })
          .from(leads)
          .leftJoin(users, eq(leads.assignedTo, users.id))
          .where(where)
          .orderBy(desc(leads.updatedAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ count: count() }).from(leads).where(where),
      ]);

      return { items, total: total.count, page: input.page, pageSize: input.pageSize };
    }),

  // 리드 상세
  getById: salesProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const [lead] = await ctx.db.select().from(leads).where(eq(leads.id, input.id)).limit(1);
    if (!lead) throw new TRPCError({ code: 'NOT_FOUND', message: '리드를 찾을 수 없습니다' });

    const activities = await ctx.db
      .select({
        id: leadActivities.id,
        type: leadActivities.type,
        title: leadActivities.title,
        description: leadActivities.description,
        metadata: leadActivities.metadata,
        createdAt: leadActivities.createdAt,
        userName: users.name,
      })
      .from(leadActivities)
      .leftJoin(users, eq(leadActivities.userId, users.id))
      .where(eq(leadActivities.leadId, input.id))
      .orderBy(desc(leadActivities.createdAt));

    return { ...lead, activities };
  }),

  // 리드 생성
  create: salesProcedure
    .input(
      z.object({
        companyName: z.string().min(1, '회사명을 입력해주세요'),
        contactName: z.string().min(1, '담당자명을 입력해주세요'),
        contactEmail: z.string().email().optional().or(z.literal('')),
        contactPhone: z.string().optional(),
        companySize: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).optional(),
        industry: z.string().optional(),
        source: z
          .enum(['cold_email', 'inbound', 'partner_referral', 'demo_signup', 'event', 'other'])
          .default('other'),
        sourceDetail: z.string().optional(),
        partnerId: z.string().optional(),
        expectedPlan: z.enum(['starter', 'professional', 'campaign']).optional(),
        expectedRevenue: z.number().min(0).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const email = input.contactEmail === '' ? undefined : input.contactEmail;
      const score = calculateLeadScore({ ...input, contactEmail: email });

      const [created] = await ctx.db
        .insert(leads)
        .values({
          ...input,
          contactEmail: email,
          score,
          assignedTo: ctx.userId,
        })
        .returning({ id: leads.id });

      // 생성 활동 기록
      await ctx.db.insert(leadActivities).values({
        leadId: created.id,
        userId: ctx.userId,
        type: 'note',
        title: '리드 등록',
        description: `${input.companyName} 리드가 등록되었습니다`,
      });

      return { id: created.id };
    }),

  // 리드 수정
  update: salesProcedure
    .input(
      z.object({
        id: z.string(),
        companyName: z.string().min(1).optional(),
        contactName: z.string().min(1).optional(),
        contactEmail: z.string().email().optional().or(z.literal('')),
        contactPhone: z.string().optional(),
        companySize: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).optional(),
        industry: z.string().optional(),
        expectedPlan: z.enum(['starter', 'professional', 'campaign']).optional(),
        expectedRevenue: z.number().min(0).optional(),
        expectedCloseDate: z.string().datetime().optional(),
        assignedTo: z.string().optional(),
        lostReason: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, expectedCloseDate, contactEmail, ...rest } = input;

      const [existing] = await ctx.db.select().from(leads).where(eq(leads.id, id)).limit(1);
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      // 스코어 재계산
      const updated = {
        ...existing,
        ...rest,
        contactEmail: contactEmail === '' ? null : (contactEmail ?? existing.contactEmail),
      };
      const score = calculateLeadScore({
        companySize: updated.companySize,
        industry: updated.industry,
        source: updated.source,
        contactEmail: updated.contactEmail,
        contactPhone: updated.contactPhone,
        demoAccountId: updated.demoAccountId,
      });

      await ctx.db
        .update(leads)
        .set({
          ...rest,
          ...(contactEmail !== undefined
            ? { contactEmail: contactEmail === '' ? null : contactEmail }
            : {}),
          ...(expectedCloseDate ? { expectedCloseDate: new Date(expectedCloseDate) } : {}),
          score,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, id));

      return { success: true };
    }),

  // 스테이지 변경
  updateStage: salesProcedure
    .input(
      z.object({
        id: z.string(),
        stage: z.enum([
          'lead',
          'contacted',
          'demo',
          'proposal',
          'negotiation',
          'closed_won',
          'closed_lost',
        ]),
        lostReason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [existing] = await ctx.db.select().from(leads).where(eq(leads.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      const isClosing = input.stage === 'closed_won' || input.stage === 'closed_lost';

      await ctx.db
        .update(leads)
        .set({
          stage: input.stage,
          ...(input.lostReason ? { lostReason: input.lostReason } : {}),
          ...(isClosing ? { closedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, input.id));

      // 자동 활동 기록
      const stageLabels: Record<string, string> = {
        lead: '리드',
        contacted: '연락 완료',
        demo: '데모 진행',
        proposal: '제안서 전달',
        negotiation: '협상 중',
        closed_won: '계약 성사',
        closed_lost: '기회 상실',
      };

      await ctx.db.insert(leadActivities).values({
        leadId: input.id,
        userId: ctx.userId,
        type: 'stage_change',
        title: `스테이지 변경: ${stageLabels[existing.stage]} → ${stageLabels[input.stage]}`,
        description: input.lostReason ? `사유: ${input.lostReason}` : undefined,
        metadata: { from: existing.stage, to: input.stage },
      });

      return { success: true };
    }),

  // 활동 기록 추가
  addActivity: salesProcedure
    .input(
      z.object({
        leadId: z.string(),
        type: z.enum(['call', 'email', 'meeting', 'demo', 'proposal_sent', 'note']),
        title: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [lead] = await ctx.db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
      if (!lead) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.db.insert(leadActivities).values({
        ...input,
        userId: ctx.userId,
      });

      // updatedAt 갱신
      await ctx.db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, input.leadId));

      return { success: true };
    }),

  // 데모 초대
  inviteToDemo: salesProcedure
    .input(z.object({ leadId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [lead] = await ctx.db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
      if (!lead) throw new TRPCError({ code: 'NOT_FOUND' });
      if (!lead.contactEmail) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '이메일이 없는 리드입니다' });
      }
      if (lead.demoAccountId) {
        throw new TRPCError({ code: 'CONFLICT', message: '이미 데모 계정이 생성되었습니다' });
      }

      // 데모 계정 생성은 기존 demo-auth 로직 활용
      // 여기서는 리드에 표시만 하고, 실제 계정 생성은 /demo 페이지에서 진행
      // 대신 이메일로 데모 링크를 발송
      const { sendDemoInviteEmail } = await import('../../../email-sales');

      await sendDemoInviteEmail({
        to: lead.contactEmail,
        contactName: lead.contactName,
        companyName: lead.companyName,
      });

      // 활동 기록
      await ctx.db.insert(leadActivities).values({
        leadId: input.leadId,
        userId: ctx.userId,
        type: 'demo',
        title: '데모 초대 이메일 발송',
        description: `${lead.contactEmail}로 데모 초대 이메일을 발송했습니다`,
      });

      await ctx.db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, input.leadId));

      return { success: true };
    }),

  // 영업 담당자 목록 (할당용)
  salesUsers: salesProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(or(eq(users.role, 'admin'), eq(users.role, 'sales')));
  }),
});
