import { collectionJobs } from '@ai-signalcraft/core';
import { eq, and, type SQL } from 'drizzle-orm';
import type { FilterMode } from '../init';

export type { FilterMode };

// 단건 작업 조건 빌더 (jobId + 팀/사용자 필터)
export function buildJobCondition(opts: {
  jobId: number;
  teamId?: number | null;
  userId?: string;
  filterMode?: FilterMode;
}): SQL {
  const conditions: SQL[] = [eq(collectionJobs.id, opts.jobId)];

  if (opts.filterMode === 'mine' && opts.userId) {
    conditions.push(eq(collectionJobs.userId, opts.userId));
  } else if (opts.teamId) {
    conditions.push(eq(collectionJobs.teamId, opts.teamId));
  }

  return and(...conditions)!;
}

// 목록 조회용 조건 빌더 (jobId 없이 팀/사용자 필터)
export function buildJobListCondition(opts: {
  teamId?: number | null;
  userId?: string;
  filterMode?: FilterMode;
}): SQL | undefined {
  if (opts.filterMode === 'mine' && opts.userId) {
    return opts.teamId
      ? and(eq(collectionJobs.teamId, opts.teamId), eq(collectionJobs.userId, opts.userId))
      : eq(collectionJobs.userId, opts.userId);
  }

  if (opts.teamId) {
    return eq(collectionJobs.teamId, opts.teamId);
  }

  return undefined;
}
