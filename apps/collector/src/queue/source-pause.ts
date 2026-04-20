import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db';
import { sourcePauseState, type SourcePauseRow } from '../db/schema';

/**
 * 시스템 전역 소스 일시정지. subscriptions.pause(개별 구독)와 별개 —
 * 이 스위치는 해당 source의 모든 구독 enqueue를 차단한다.
 */
export async function pauseSource(
  source: string,
  reason: string | null,
  actor: string,
): Promise<void> {
  const now = new Date();
  await getDb()
    .insert(sourcePauseState)
    .values({
      source,
      pausedAt: now,
      pausedBy: actor,
      reason,
      resumedAt: null,
    })
    .onConflictDoUpdate({
      target: sourcePauseState.source,
      set: { pausedAt: now, pausedBy: actor, reason, resumedAt: null },
    });
}

/**
 * 재개 — row는 유지 (이력 보존), resumedAt만 기록.
 */
export async function resumeSource(source: string): Promise<void> {
  await getDb()
    .update(sourcePauseState)
    .set({ resumedAt: new Date() })
    .where(and(eq(sourcePauseState.source, source), isNull(sourcePauseState.resumedAt)));
}

/**
 * paused 판정: row 존재 AND resumedAt IS NULL.
 * scheduler/triggerNow/backfill이 enqueue 전 호출.
 */
export async function isSourcePaused(source: string): Promise<boolean> {
  const [row] = await getDb()
    .select()
    .from(sourcePauseState)
    .where(and(eq(sourcePauseState.source, source), isNull(sourcePauseState.resumedAt)))
    .limit(1);
  return !!row;
}

export async function listSourceStates(): Promise<SourcePauseRow[]> {
  return getDb().select().from(sourcePauseState);
}
