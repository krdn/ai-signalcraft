import { collectionJobs } from '@ai-signalcraft/core';
import { eq, and, type SQL } from 'drizzle-orm';
import type { FilterMode } from '../init';

export type { FilterMode };

// 확장된 필터 스코프
//   'mine' → 자신의 작업만 (member 기본값)
//   'team' → 같은 팀 전체 (admin/leader 기본값, 레거시 호환)
//   'all'  → 시스템 전체 (super_admin 전용)
//   'user' → 특정 사용자(targetUserId) 지정 (admin/leader/super_admin)
export type ScopeMode = 'mine' | 'team' | 'all' | 'user';

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

/**
 * 확장 스코프 기반 조건 빌더
 *
 * 권한 규칙:
 *   - 'mine'  : 항상 본인 작업만
 *   - 'team'  : 소속 팀 전체 (admin/leader만 허용되어야 함 — 서버 라우터에서 보장)
 *   - 'all'   : 시스템 전체 (super_admin 전용 — 서버 라우터에서 보장)
 *   - 'user'  : 특정 사용자 — admin/leader는 자기 팀 범위 내, super_admin은 전체 허용
 *
 * 이 함수는 SQL 조건만 반환한다. 권한 검증은 호출 측에서 수행할 것.
 */
export function buildJobScopeCondition(opts: {
  scope: ScopeMode;
  teamId?: number | null;
  userId?: string;
  targetUserId?: string;
  allowAllScope?: boolean; // super_admin 여부 — 'all' 또는 팀 밖 'user' 허용 여부
}): SQL | undefined {
  const { scope, teamId, userId, targetUserId, allowAllScope } = opts;

  // 'mine' — 본인
  if (scope === 'mine') {
    if (!userId) return undefined;
    return teamId
      ? and(eq(collectionJobs.teamId, teamId), eq(collectionJobs.userId, userId))
      : eq(collectionJobs.userId, userId);
  }

  // 'all' — 시스템 전체 (super_admin 전용)
  if (scope === 'all') {
    return allowAllScope ? undefined : buildJobScopeCondition({ ...opts, scope: 'team' });
  }

  // 'user' — 특정 사용자
  if (scope === 'user' && targetUserId) {
    // super_admin은 팀 경계 무시, 그 외는 teamId 내로 제한
    if (allowAllScope) {
      return eq(collectionJobs.userId, targetUserId);
    }
    return teamId
      ? and(eq(collectionJobs.teamId, teamId), eq(collectionJobs.userId, targetUserId))
      : eq(collectionJobs.userId, targetUserId);
  }

  // 'team' (default) — 소속 팀
  if (teamId) {
    return eq(collectionJobs.teamId, teamId);
  }

  return undefined;
}
