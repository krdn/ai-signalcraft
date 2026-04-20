import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { keywordSubscriptions, collectionRuns } from '../db/schema';
import { enqueueCollectionJob, closeAllQueues } from '../queue/queues';
import type { CollectionJobData } from '../queue/types';

// 이 스크립트는 테스트용 구독을 생성하고 naver-news 수집 job을 collector-dev 큐에 enqueue한다.
// 실제 실행은 별도 터미널에서 `pnpm --filter @ai-signalcraft/collector run worker`를 띄워서 처리.
// fan-out된 naver-comments child job도 같은 워커가 소비하므로 하나의 워커로 전체 검증 가능.

const TEST_OWNER = 'dev-test:fanout';
const TEST_KEYWORD = '이재명';

async function upsertTestSubscription() {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(keywordSubscriptions)
    .where(
      and(
        eq(keywordSubscriptions.keyword, TEST_KEYWORD),
        eq(keywordSubscriptions.ownerId, TEST_OWNER),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [row] = await db
    .insert(keywordSubscriptions)
    .values({
      keyword: TEST_KEYWORD,
      sources: ['naver-news'],
      intervalHours: 6,
      status: 'active',
      limits: { maxPerRun: 20, commentsPerItem: 10 },
      options: {},
      ownerId: TEST_OWNER,
    })
    .returning();
  return row;
}

async function cleanup() {
  const db = getDb();
  const [sub] = await db
    .select()
    .from(keywordSubscriptions)
    .where(
      and(
        eq(keywordSubscriptions.keyword, TEST_KEYWORD),
        eq(keywordSubscriptions.ownerId, TEST_OWNER),
      ),
    )
    .limit(1);
  if (!sub) {
    console.warn(`[cleanup] 삭제할 테스트 구독 없음`);
    return;
  }
  await db.execute(sql`DELETE FROM raw_items WHERE subscription_id=${sub.id}`);
  await db.execute(sql`DELETE FROM collection_runs WHERE subscription_id=${sub.id}`);
  await db.delete(keywordSubscriptions).where(eq(keywordSubscriptions.id, sub.id));
  console.warn(`[cleanup] subscription ${sub.id} 및 관련 데이터 삭제 완료`);
}

async function status() {
  const db = getDb();
  const [sub] = await db
    .select()
    .from(keywordSubscriptions)
    .where(
      and(
        eq(keywordSubscriptions.keyword, TEST_KEYWORD),
        eq(keywordSubscriptions.ownerId, TEST_OWNER),
      ),
    )
    .limit(1);
  if (!sub) {
    console.warn(`[status] 테스트 구독 없음 — trigger로 생성 필요`);
    return;
  }
  const articles = await db.execute<{ c: number }>(
    sql`SELECT COUNT(*)::int AS c FROM raw_items WHERE subscription_id=${sub.id} AND item_type='article'`,
  );
  const comments = await db.execute<{ c: number }>(
    sql`SELECT COUNT(*)::int AS c FROM raw_items WHERE subscription_id=${sub.id} AND item_type='comment'`,
  );
  const runs = await db
    .select()
    .from(collectionRuns)
    .where(eq(collectionRuns.subscriptionId, sub.id))
    .orderBy(collectionRuns.time);

  console.warn(`\n[status] subscription id=${sub.id} keyword=${sub.keyword}`);
  console.warn(`  기사: ${(articles.rows?.[0] as { c: number } | undefined)?.c ?? 0}`);
  console.warn(`  댓글: ${(comments.rows?.[0] as { c: number } | undefined)?.c ?? 0}`);
  console.warn(`  runs:`);
  for (const r of runs) {
    console.warn(
      `    ${r.time.toISOString()} source=${r.source} status=${r.status} collected=${r.itemsCollected} new=${r.itemsNew}`,
    );
  }
}

async function trigger() {
  const sub = await upsertTestSubscription();
  console.warn(`[trigger] subscription id=${sub.id} keyword=${sub.keyword}`);

  const runId = randomUUID();
  const now = new Date();
  const startISO = new Date(now.getTime() - 6 * 3600 * 1000).toISOString();
  const endISO = now.toISOString();

  const data: CollectionJobData = {
    runId,
    subscriptionId: sub.id,
    source: 'naver-news',
    keyword: sub.keyword,
    limits: sub.limits,
    options: sub.options ?? undefined,
    dateRange: { startISO, endISO },
    triggerType: 'manual',
  };

  await enqueueCollectionJob(data);
  console.warn(`[trigger] naver-news enqueued runId=${runId}`);
  console.warn(`[trigger] 워커 실행 필요: pnpm --filter @ai-signalcraft/collector run worker`);
  console.warn(
    `[trigger] 진행 확인: pnpm --filter @ai-signalcraft/collector exec tsx src/scripts/test-comment-fanout.ts status`,
  );
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'cleanup') return cleanup();
  if (cmd === 'status') return status();
  if (cmd === 'trigger' || !cmd) return trigger();
  console.error(`알 수 없는 명령: ${cmd} (trigger|status|cleanup)`);
  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('[test] 실패:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeAllQueues();
    process.exit(process.exitCode ?? 0);
  });
