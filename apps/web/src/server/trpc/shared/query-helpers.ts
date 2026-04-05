import { collectionJobs } from '@ai-signalcraft/core';
import { eq, and, type SQL } from 'drizzle-orm';

// 팀 소속 여부에 따른 작업 조건 빌더
export function buildJobCondition(jobId: number, teamId?: number | null): SQL {
  return teamId
    ? and(eq(collectionJobs.id, jobId), eq(collectionJobs.teamId, teamId))!
    : eq(collectionJobs.id, jobId);
}
