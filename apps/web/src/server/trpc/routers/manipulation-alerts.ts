import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { getDb, manipulationAlertRules } from '@ai-signalcraft/core';
import { router, protectedProcedure } from '../init';
import { verifySubscriptionOwnership } from '../shared/verify-subscription-ownership';

const ChannelSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('slack'),
    webhookUrl: z
      .string()
      .url()
      .refine((u) => u.startsWith('https://hooks.slack.com/'), {
        message: 'Slack webhook은 https://hooks.slack.com/ 도메인이어야 합니다',
      }),
  }),
  z.object({
    type: z.literal('webhook'),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
  }),
]);

const CreateInput = z.object({
  subscriptionId: z.number().int().positive(),
  name: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  scoreThreshold: z.number().min(0).max(100),
  cooldownMinutes: z.number().int().min(1).max(10080).default(360),
  channel: ChannelSchema,
});

const UpdateInput = z.object({
  ruleId: z.number().int().positive(),
  patch: CreateInput.omit({ subscriptionId: true }).partial(),
});

export const manipulationAlertsRouter = router({
  listBySubscription: protectedProcedure
    .input(z.object({ subscriptionId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await verifySubscriptionOwnership(ctx, input.subscriptionId);
      return getDb()
        .select()
        .from(manipulationAlertRules)
        .where(eq(manipulationAlertRules.subscriptionId, input.subscriptionId))
        .orderBy(desc(manipulationAlertRules.createdAt));
    }),

  create: protectedProcedure.input(CreateInput).mutation(async ({ ctx, input }) => {
    await verifySubscriptionOwnership(ctx, input.subscriptionId);
    const [created] = await getDb()
      .insert(manipulationAlertRules)
      .values({
        subscriptionId: input.subscriptionId,
        name: input.name,
        enabled: input.enabled,
        scoreThreshold: input.scoreThreshold,
        cooldownMinutes: input.cooldownMinutes,
        channel: input.channel,
      })
      .returning();
    return created;
  }),

  update: protectedProcedure.input(UpdateInput).mutation(async ({ ctx, input }) => {
    const [rule] = await getDb()
      .select({ subscriptionId: manipulationAlertRules.subscriptionId })
      .from(manipulationAlertRules)
      .where(eq(manipulationAlertRules.id, input.ruleId))
      .limit(1);
    if (!rule) throw new TRPCError({ code: 'NOT_FOUND' });
    await verifySubscriptionOwnership(ctx, rule.subscriptionId);
    const [updated] = await getDb()
      .update(manipulationAlertRules)
      .set({ ...input.patch, updatedAt: new Date() })
      .where(eq(manipulationAlertRules.id, input.ruleId))
      .returning();
    return updated;
  }),

  delete: protectedProcedure
    .input(z.object({ ruleId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [rule] = await getDb()
        .select({ subscriptionId: manipulationAlertRules.subscriptionId })
        .from(manipulationAlertRules)
        .where(eq(manipulationAlertRules.id, input.ruleId))
        .limit(1);
      if (!rule) throw new TRPCError({ code: 'NOT_FOUND' });
      await verifySubscriptionOwnership(ctx, rule.subscriptionId);
      await getDb()
        .delete(manipulationAlertRules)
        .where(eq(manipulationAlertRules.id, input.ruleId));
      return { ok: true as const };
    }),
});
