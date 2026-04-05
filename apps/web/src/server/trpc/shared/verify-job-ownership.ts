import { TRPCError } from '@trpc/server';
import { collectionJobs } from '@ai-signalcraft/core';
import { eq, and, type SQL } from 'drizzle-orm';
import type { FilterMode } from '../init';

// 작업 소유권 확인 헬퍼 — 팀/사용자 기반 접근 제어
export async function verifyJobOwnership(
  ctx: { teamId?: number | null; userId?: string; db: any },
  jobId: number,
  filterMode?: FilterMode,
) {
  const conditions: SQL[] = [eq(collectionJobs.id, jobId)];

  if (filterMode === 'mine' && ctx.userId) {
    conditions.push(eq(collectionJobs.userId, ctx.userId));
  } else if (ctx.teamId) {
    conditions.push(eq(collectionJobs.teamId, ctx.teamId));
  }

  const [job] = await ctx.db
    .select({ id: collectionJobs.id })
    .from(collectionJobs)
    .where(and(...conditions));

  if (!job) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' });
  }
}
