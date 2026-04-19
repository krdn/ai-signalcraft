import { Queue } from 'bullmq';
import { getBullMQOptions } from './connection';
import { COLLECTOR_SOURCES, type CollectorSource, type CollectionJobData } from './types';

/**
 * 수집 큐는 source별로 독립 생성 — 한 소스의 차단이 다른 소스를 막지 않도록.
 * 큐 이름: `collect:<source>` (예: collect:naver-news)
 */
const queueCache = new Map<CollectorSource, Queue<CollectionJobData>>();

export function getCollectQueue(source: CollectorSource): Queue<CollectionJobData> {
  let q = queueCache.get(source);
  if (!q) {
    q = new Queue<CollectionJobData>(`collect:${source}`, getBullMQOptions());
    queueCache.set(source, q);
  }
  return q;
}

export function getAllCollectQueues(): Array<{
  source: CollectorSource;
  queue: Queue<CollectionJobData>;
}> {
  return COLLECTOR_SOURCES.map((source) => ({ source, queue: getCollectQueue(source) }));
}

/**
 * 수집 job을 source별 큐에 enqueue.
 * jobId = runId로 설정하여 중복 enqueue 방지.
 */
export async function enqueueCollectionJob(data: CollectionJobData): Promise<void> {
  const queue = getCollectQueue(data.source);
  await queue.add(`collect-${data.source}`, data, {
    jobId: `${data.runId}:${data.source}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600 },
  });
}

export async function closeAllQueues(): Promise<void> {
  await Promise.all([...queueCache.values()].map((q) => q.close()));
  queueCache.clear();
}
