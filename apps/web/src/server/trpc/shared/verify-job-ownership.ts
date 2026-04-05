import { TRPCError } from '@trpc/server';
import { collectionJobs } from '@ai-signalcraft/core';
import { eq, and } from 'drizzle-orm';

// 작업 소유권 확인 헬퍼 — 팀 소속인 경우 해당 작업이 팀 것인지 검증
export async function verifyJobOwnership(ctx: { teamId?: number | null; db: any }, jobId: number) {
  if (ctx.teamId) {
    const [job] = await ctx.db
      .select({ id: collectionJobs.id })
      .from(collectionJobs)
      .where(and(eq(collectionJobs.id, jobId), eq(collectionJobs.teamId, ctx.teamId)));
    if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' });
  }
}
