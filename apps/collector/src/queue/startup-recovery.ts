// Worker 시작 시 Redis에 잔류한 orphaned(고아) 수집 job을 감지하여 재큐잉.
//
// 워커 프로세스가 강제 종료(OOM, kill -9, 컨테이너 재시작 등)되면 BullMQ의
// stalled-check 루프가 돌지 못해 'active' 상태 그대로 남은 job이 생길 수 있다.
// 새 워커가 뜨면 그 active job들은 결국 stalled로 판정되지만, 그 사이 수 분간
// 큐가 비어 보이는 구간이 생긴다. 이 모듈은 기동 직후 한 번 'active' 큐를
// 확인해 orphan이 있으면 즉시 재큐잉하여 복구 시간을 줄인다.
//
// 이전 구현은 `scanStream`으로 원시 Redis 키를 훑어 `HMGET` 했는데, BullMQ의
// 내부 키(:wait list, :events stream, :meta hash 등)가 동일 prefix를 쓰기에
// 해시가 아닌 키에 HMGET이 꽂혀 WRONGTYPE 에러로 모든 소스 복구가 실패했다.
// 현재 구현은 BullMQ 공개 API인 Queue.getJobs()만 사용해 키 타입 가정 없이
// 안전하게 orphan을 식별한다.

import { Queue } from 'bullmq';
import { and, lt, eq, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionRuns } from '../db/schema';
import { getBullMQOptions } from './connection';
import { isCancellationRequested } from './cancellation';
import { COLLECTOR_SOURCES, type CollectionJobData } from './types';

export async function recoverOrphanedJobs(): Promise<void> {
  let totalRecovered = 0;

  for (const source of COLLECTOR_SOURCES) {
    const queue = new Queue<CollectionJobData>(`collect-${source}`, getBullMQOptions());
    try {
      // 'active'에 있는데 lock 만료된 job = orphan. BullMQ가 다음 stalled 체크에서
      // 자동으로 다시 잡긴 하지만, 여기서 선제적으로 재큐잉해 공백 시간을 줄인다.
      // getJobs는 해시 접근만 하므로 WRONGTYPE이 발생하지 않는다.
      const activeJobs = await queue.getJobs(['active'], 0, 1000, false);

      if (activeJobs.length === 0) continue;

      let recovered = 0;
      let skipped = 0;
      for (const job of activeJobs) {
        if (!job || !job.data) continue;

        // 취소 요청된 run은 재큐잉하지 않음 — 재실행→즉시 취소 실패가 재시작마다
        // 반복되는 루프 방지 (취소된 run이 24h에 283행을 쌓던 사례).
        if (await isCancellationRequested(job.data.runId, source)) {
          await job.remove().catch(() => void 0);
          skipped++;
          continue;
        }

        // processedOn이 있고 finishedOn이 없으면 orphan 후보.
        // active 상태 자체가 이미 processedOn 설정 이후이므로 중복 확인 불필요.
        try {
          // 원본 job 제거. lock이 아직 살아있으면(이전 실행이 유효하게 진행 중) throw —
          // 이때 재큐잉하면 같은 run의 이중 실행이 되므로 stall 메커니즘에 맡기고 건너뛴다.
          await job.remove();
        } catch {
          skipped++;
          continue;
        }

        try {
          await queue.add(`collect-${source}`, job.data, {
            jobId: `${job.data.runId}-${source}-recovered-${Date.now()}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 24 * 3600 },
          });
          recovered++;
        } catch (err) {
          console.warn(
            `[startup-recovery] ${source} job 복구 실패 (id=${job.id}):`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      if (skipped > 0) {
        console.log(`[startup-recovery] ${source}: ${skipped}개 skip (취소됨 또는 lock 유효)`);
      }

      if (recovered > 0) {
        console.log(`[startup-recovery] ${source}: ${recovered}개 orphaned job 복구 완료`);
      }

      totalRecovered += recovered;
    } catch (err) {
      console.error(
        `[startup-recovery] ${source} 복구 중 오류:`,
        err instanceof Error ? err.message : err,
      );
    } finally {
      await queue.close();
    }
  }

  if (totalRecovered > 0) {
    console.log(`[startup-recovery] 총 ${totalRecovered}개 orphaned job 복구 완료`);
  } else {
    console.log('[startup-recovery] orphaned job 없음');
  }
}

/**
 * 어떤 finalize 경로도 못 탄 좀비 'running' 행 정리 — 워커 기동 시 1회 실행.
 *
 * worker.on('failed')의 finalize가 누락되는 경로(finalize 직전 크래시, DB 일시 장애,
 * 잡이 실행 없이 큐에서 제거됨 등)에서 collection_runs가 running으로 영구 잔류한다.
 * packages/core/src/analysis/stale-recovery.ts의 recoverStaleJobs와 동일 패턴.
 *
 * 임계 기본 90분: lockDuration 60분(worker-process.ts)을 초과하면 살아있는 잡일 수
 * 없다 — 살아있다면 lock 갱신과 함께 청크 하트비트(last_progress_at)가 찍힌다.
 *
 * 정리된 행의 잡이 이후 재배달되더라도 ensureRunningRun이 새 running 행을
 * INSERT하므로(재시도 이력 보존 설계) 데이터 손실은 없다.
 */
export async function recoverStaleRunningRuns(thresholdMinutes = 90): Promise<number> {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60_000);
  const swept = await getDb()
    .update(collectionRuns)
    .set({
      status: 'failed',
      errorReason: `startup-recovery: stale running ${thresholdMinutes}분+ 무진행 (worker crash 추정)`,
    })
    .where(
      and(
        eq(collectionRuns.status, 'running'),
        lt(sql`COALESCE(${collectionRuns.lastProgressAt}, ${collectionRuns.time})`, cutoff),
      ),
    )
    .returning({ runId: collectionRuns.runId, source: collectionRuns.source });

  if (swept.length > 0) {
    const detail = swept.map((r) => `${r.runId.slice(0, 8)}/${r.source}`).join(', ');
    console.warn(`[startup-recovery] stale running ${swept.length}건 failed 처리: ${detail}`);
  }
  return swept.length;
}
