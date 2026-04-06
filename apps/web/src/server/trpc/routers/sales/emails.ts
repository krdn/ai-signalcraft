import { z } from 'zod';
import { eq, and, desc, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { emailTemplates, emailSendLogs, leads } from '@ai-signalcraft/core';
import { router, salesProcedure } from '../../init';
import { sendSalesEmail } from '../../../email-sales';

// 변수 치환
function replaceVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export const salesEmailsRouter = router({
  templates: router({
    // 템플릿 목록
    list: salesProcedure
      .input(
        z.object({
          category: z
            .enum(['cold_outreach', 'follow_up', 'demo_invite', 'proposal', 'partner_intro'])
            .optional(),
        }),
      )
      .query(async ({ input, ctx }) => {
        const conditions = [];
        if (input.category) conditions.push(eq(emailTemplates.category, input.category));

        return ctx.db
          .select()
          .from(emailTemplates)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(emailTemplates.updatedAt));
      }),

    // 템플릿 생성
    create: salesProcedure
      .input(
        z.object({
          name: z.string().min(1),
          category: z.enum([
            'cold_outreach',
            'follow_up',
            'demo_invite',
            'proposal',
            'partner_intro',
          ]),
          subject: z.string().min(1),
          body: z.string().min(1),
          variables: z.array(z.string()).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const [created] = await ctx.db
          .insert(emailTemplates)
          .values({ ...input, createdBy: ctx.userId })
          .returning({ id: emailTemplates.id });
        return { id: created.id };
      }),

    // 템플릿 수정
    update: salesProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(1).optional(),
          category: z
            .enum(['cold_outreach', 'follow_up', 'demo_invite', 'proposal', 'partner_intro'])
            .optional(),
          subject: z.string().min(1).optional(),
          body: z.string().min(1).optional(),
          variables: z.array(z.string()).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...rest } = input;
        await ctx.db
          .update(emailTemplates)
          .set({ ...rest, updatedAt: new Date() })
          .where(eq(emailTemplates.id, id));
        return { success: true };
      }),

    // 템플릿 삭제
    delete: salesProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
      await ctx.db.delete(emailTemplates).where(eq(emailTemplates.id, input.id));
      return { success: true };
    }),

    // 기본 템플릿 생성
    seedDefaults: salesProcedure.mutation(async ({ ctx }) => {
      const defaults = [
        {
          name: '초기 접근 - PR 에이전시',
          category: 'cold_outreach' as const,
          subject: '[AI SignalCraft] AI 여론 분석으로 클라이언트 리포트 자동화하세요',
          body: `<p>{{contactName}}님 안녕하세요,</p>
<p>{{companyName}}에서 클라이언트 여론 분석 리포트를 수작업으로 작성하고 계신가요?</p>
<p>AI SignalCraft는 5개 소스에서 자동 수집 → 14개 AI 모듈 분석 → 리포트 자동 생성까지 원클릭으로 처리합니다.</p>
<p><strong>현재 무료 체험 중:</strong> AI 분석 3회, 7일간 무료</p>
<p>5분만 시간 내주시면 {{companyName}}에 어떻게 도움이 될지 설명드리겠습니다.</p>`,
          variables: ['contactName', 'companyName'],
          isDefault: true,
        },
        {
          name: '팔로업 - 데모 후',
          category: 'follow_up' as const,
          subject: 'Re: AI SignalCraft 데모 후속',
          body: `<p>{{contactName}}님 안녕하세요,</p>
<p>지난번 데모에서 보여드린 분석 결과가 도움이 되셨기를 바랍니다.</p>
<p>혹시 추가 질문이나 다른 키워드로 테스트해 보고 싶으신 부분이 있으신가요?</p>
<p>{{companyName}}의 실제 사례로 맞춤 분석도 가능합니다.</p>`,
          variables: ['contactName', 'companyName'],
          isDefault: true,
        },
        {
          name: '제안서 전달',
          category: 'proposal' as const,
          subject: '[AI SignalCraft] {{companyName}} 맞춤 제안서',
          body: `<p>{{contactName}}님 안녕하세요,</p>
<p>말씀 나누었던 내용을 바탕으로 {{companyName}} 맞춤 제안서를 준비했습니다.</p>
<p><strong>추천 플랜:</strong> {{plan}}</p>
<p>첨부된 제안서를 확인해 주시고, 궁금하신 점이 있으시면 편하게 연락 주세요.</p>`,
          variables: ['contactName', 'companyName', 'plan'],
          isDefault: true,
        },
      ];

      for (const template of defaults) {
        // 중복 방지
        const [existing] = await ctx.db
          .select()
          .from(emailTemplates)
          .where(and(eq(emailTemplates.name, template.name), eq(emailTemplates.isDefault, true)))
          .limit(1);

        if (!existing) {
          await ctx.db.insert(emailTemplates).values({ ...template, createdBy: ctx.userId });
        }
      }

      return { success: true };
    }),
  }),

  // 이메일 발송
  send: salesProcedure
    .input(
      z.object({
        templateId: z.string().optional(),
        leadId: z.string().optional(),
        recipientEmail: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        variables: z.record(z.string()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const subject = input.variables
        ? replaceVariables(input.subject, input.variables)
        : input.subject;
      const body = input.variables ? replaceVariables(input.body, input.variables) : input.body;

      try {
        const result = await sendSalesEmail({
          to: input.recipientEmail,
          subject,
          body,
        });

        await ctx.db.insert(emailSendLogs).values({
          templateId: input.templateId,
          leadId: input.leadId,
          sentBy: ctx.userId,
          recipientEmail: input.recipientEmail,
          subject,
          status: 'sent',
          resendMessageId: result.messageId,
        });

        return { success: true };
      } catch {
        await ctx.db.insert(emailSendLogs).values({
          templateId: input.templateId,
          leadId: input.leadId,
          sentBy: ctx.userId,
          recipientEmail: input.recipientEmail,
          subject,
          status: 'failed',
        });

        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '이메일 발송 실패' });
      }
    }),

  // 발송 이력
  sendLogs: salesProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(10).max(100).default(20),
        leadId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const conditions = [];
      if (input.leadId) conditions.push(eq(emailSendLogs.leadId, input.leadId));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [total]] = await Promise.all([
        ctx.db
          .select({
            id: emailSendLogs.id,
            recipientEmail: emailSendLogs.recipientEmail,
            subject: emailSendLogs.subject,
            status: emailSendLogs.status,
            createdAt: emailSendLogs.createdAt,
            companyName: leads.companyName,
            contactName: leads.contactName,
          })
          .from(emailSendLogs)
          .leftJoin(leads, eq(emailSendLogs.leadId, leads.id))
          .where(where)
          .orderBy(desc(emailSendLogs.createdAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ count: count() }).from(emailSendLogs).where(where),
      ]);

      return { items, total: total.count };
    }),
});
