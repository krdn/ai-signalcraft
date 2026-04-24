// Worker 시작 시 Redis에 잔류한 orphaned(고아) 수집 job을 감지하여 재큐잉.
//
// Worker 재시작으로 인해 processedOn은 있지만 finishedOn이 없는 job이
// Redis 해시에 남아있으면, 같은 data로 새 job을 큐에 적재하고 원본을 정리.

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { getBullMQOptions, getBullPrefix } from './connection';
import { COLLECTOR_SOURCES, type CollectionJobData } from './types';

/**
 * Worker 시작 시 호출 — Redis에서 orphaned job을 찾아 재큐잉.
 *
 * processedOn 필드가 존재하고 finishedOn이 null/missing인 해시를
 * orphaned로 판단하여 동일 data로 새 job을 적재 후 원본 키를 삭제.
 */
export async function recoverOrphanedJobs(): Promise<void> {
  const prefix = getBullPrefix();
  const opts = getBullMQOptions();
  const connectionOpts = opts.connection;

  // ioredis 직접 접근용 인스턴스 생성
  // BullMQ ConnectionOptions는 RedisOptions | ClusterOptions 유니온이므로
  // 공통 필드를 Record로 캐스팅하여 접근
  const optsMap = connectionOpts as Record<string, unknown>;
  const redis = new Redis({
    host: optsMap.host as string | undefined,
    port: optsMap.port as number | undefined,
    password: optsMap.password as string | undefined,
    username: optsMap.username as string | undefined,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  let totalRecovered = 0;

  try {
    await redis.connect();

    for (const source of COLLECTOR_SOURCES) {
      try {
        const pattern = `${prefix}:collect-${source}:*`;
        const orphanedKeys: string[] = [];

        // scanStream으로 Redis 키 스캔 (KEYS 명령 사용 지양)
        const stream = redis.scanStream({ match: pattern, count: 100 });

        await new Promise<void>((resolve, reject) => {
          stream.on('data', (keys: string[]) => {
            for (const key of keys) {
              // :lock 접미사 키는 스킵
              if (key.endsWith(':lock')) continue;
              orphanedKeys.push(key);
            }
          });
          stream.on('end', resolve);
          stream.on('error', reject);
        });

        if (orphanedKeys.length === 0) continue;

        let recovered = 0;

        for (const key of orphanedKeys) {
          // 해시에서 finishedOn, processedOn, data 필드 조회
          const [finishedOn, processedOn, dataRaw] = await redis.hmget(
            key,
            'finishedOn',
            'processedOn',
            'data',
          );

          // processedOn이 없으면 아직 처리 시작 전 — orphaned 아님
          if (!processedOn) continue;

          // finishedOn이 있으면 정상 완료 — orphaned 아님
          if (finishedOn) continue;

          // data 필드가 없으면 복구 불가 — 스킵
          if (!dataRaw) continue;

          let jobData: CollectionJobData;
          try {
            jobData = JSON.parse(dataRaw) as CollectionJobData;
          } catch {
            console.warn(`[startup-recovery] data JSON 파싱 실패: ${key}`);
            continue;
          }

          // 같은 data로 새 job 적재
          const queue = new Queue<CollectionJobData>(`collect-${source}`, getBullMQOptions());

          try {
            await queue.add(`collect-${source}`, jobData, {
              jobId: `${jobData.runId}-${source}-recovered`,
              attempts: 3,
              backoff: { type: 'exponential', delay: 30_000 },
              removeOnComplete: { age: 3600, count: 1000 },
              removeOnFail: { age: 24 * 3600 },
            });

            // 원본 해시 삭제
            await redis.del(key);
            recovered++;
          } finally {
            await queue.close();
          }
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
      }
    }

    if (totalRecovered > 0) {
      console.log(`[startup-recovery] 총 ${totalRecovered}개 orphaned job 복구 완료`);
    } else {
      console.log('[startup-recovery] orphaned job 없음');
    }
  } finally {
    await redis.quit();
  }
}
