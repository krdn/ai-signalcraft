import { z } from 'zod';
import { eq, desc, asc } from 'drizzle-orm';
import {
  getDb,
  manipulationRuns,
  manipulationSignals,
  manipulationEvidence,
} from '@ai-signalcraft/core';
import { router, protectedProcedure } from '../init';
import { verifyJobOwnership } from '../shared/verify-job-ownership';
import { verifySubscriptionOwnership } from '../shared/verify-subscription-ownership';

export const manipulationRouter = router({
  /**
   * 특정 jobId에 대한 가장 최근 manipulation run + signals + evidence 반환
   * retry로 같은 jobId에 여러 row 생성될 수 있으므로 startedAt DESC로 1건만 조회
   */
  getRunByJobId: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      // 1. 권한 — 헬퍼가 NOT_FOUND throw 또는 통과
      await verifyJobOwnership(ctx, input.jobId);

      // 2. run 조회 (가장 최근 1건)
      const [run] = await getDb()
        .select()
        .from(manipulationRuns)
        .where(eq(manipulationRuns.jobId, input.jobId))
        .orderBy(desc(manipulationRuns.startedAt))
        .limit(1);
      if (!run) return null;

      // 3. signals + evidence (evidence는 rank ASC)
      const signals = await getDb()
        .select()
        .from(manipulationSignals)
        .where(eq(manipulationSignals.runId, run.id));

      const evidence = await getDb()
        .select()
        .from(manipulationEvidence)
        .where(eq(manipulationEvidence.runId, run.id))
        .orderBy(asc(manipulationEvidence.rank));

      return { ...run, signals, evidence };
    }),

  /**
   * 구독 ID로 manipulation run 요약 목록 반환 (startedAt DESC, limit 적용)
   */
  listRunsBySubscription: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifySubscriptionOwnership(ctx, input.subscriptionId);

      return getDb()
        .select({
          id: manipulationRuns.id,
          jobId: manipulationRuns.jobId,
          manipulationScore: manipulationRuns.manipulationScore,
          confidenceFactor: manipulationRuns.confidenceFactor,
          startedAt: manipulationRuns.startedAt,
          status: manipulationRuns.status,
        })
        .from(manipulationRuns)
        .where(eq(manipulationRuns.subscriptionId, input.subscriptionId))
        .orderBy(desc(manipulationRuns.startedAt))
        .limit(input.limit);
    }),
});
