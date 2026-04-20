import type { Job } from 'bullmq';
import { sql, eq, and } from 'drizzle-orm';
import { getCollector, NaverCommentsCollector } from '@ai-signalcraft/collectors';
import { getDb } from '../db';
import { rawItems, collectionRuns, fetchErrors, keywordSubscriptions } from '../db/schema';
import { buildEmbeddingText, embedPassages } from '../services/embedding';
import { mapToRawItem } from './item-mapper';
import { enqueueCollectionJob } from './queues';
import type {
  CollectionJobData,
  CollectionJobResult,
  CollectorSource,
  CommentTarget,
} from './types';

/**
 * 주어진 source에 대한 collector 선택.
 *
 * 기존 packages/collectors는 registry 기반으로 source 문자열로 lookup.
 */
function resolveCollector(source: CollectorSource) {
  const collector = getCollector(source);
  if (!collector) {
    throw new Error(`No collector registered for source: ${source}`);
  }
  return collector;
}

function itemTypeFor(source: CollectorSource): 'article' | 'video' | 'comment' {
  if (source === 'youtube') return 'video';
  if (source === 'naver-comments') return 'comment';
  return 'article';
}

const NAVER_ARTICLE_URL_RE = /n\.news\.naver\.com\/(?:mnews\/)?article\//;

/**
 * 하나의 수집 job 실행.
 *
 * 흐름:
 *   1) collection_runs 레코드 생성 (status=running)
 *   2) 기존 어댑터 collect() 호출 — AsyncGenerator로 청크 수신
 *   3) 각 청크를 raw_items 스키마로 매핑해 배치 삽입 (ON CONFLICT DO NOTHING)
 *   4) 종료 시 collection_runs 업데이트 + subscription의 lastRunAt/nextRunAt 갱신
 *   5) 실패 시 fetch_errors 기록 + subscription.lastError 업데이트
 */
export async function executeCollectionJob(
  job: Job<CollectionJobData>,
): Promise<CollectionJobResult> {
  // naver-comments는 fan-out된 child job — 전용 실행 경로로 분기
  if (job.data.source === 'naver-comments') {
    return executeCommentsJob(job);
  }

  const { runId, subscriptionId, source, keyword, limits, options, dateRange, triggerType } =
    job.data;
  const db = getDb();
  const startedAt = Date.now();

  await db.insert(collectionRuns).values({
    time: new Date(),
    runId,
    subscriptionId,
    source,
    status: 'running',
    triggerType,
  });

  let itemsCollected = 0;
  let itemsNew = 0;
  let blocked = false;
  const collectedArticleUrls: string[] = [];

  try {
    const collector = resolveCollector(source);
    const itemType = itemTypeFor(source);

    const iter = collector.collect({
      keyword,
      startDate: dateRange.startISO,
      endDate: dateRange.endISO,
      maxItems: limits.maxPerRun,
      // perDay cap을 maxPerRun 자체로 지정 — rolling overlap으로 범위가 자정을 건드려
      // dayCount가 2가 되더라도 각 일자에서 maxPerRun까지 가져와 누락을 줄인다.
      // UNIQUE(source, source_id, item_type, time)로 중복은 자동 차단.
      maxItemsPerDay: limits.maxPerRun,
      maxComments: limits.commentsPerItem,
      collectTranscript: options?.collectTranscript,
      mode: job.data.mode,
    });

    for await (const chunk of iter) {
      if (!Array.isArray(chunk) || chunk.length === 0) continue;
      itemsCollected += chunk.length;

      const rows = chunk.map((raw) => {
        const record = raw as Record<string, unknown>;
        // naver-news fan-out 준비: 기사 URL 기록 (이후 commentTargets 구성)
        if (source === 'naver-news') {
          const url = typeof record.url === 'string' ? record.url : null;
          if (url && NAVER_ARTICLE_URL_RE.test(url)) {
            collectedArticleUrls.push(url);
          }
        }
        return mapToRawItem(record, {
          subscriptionId,
          source,
          itemType,
          runId,
        });
      });

      // 임베딩 생성 — 실패해도 수집은 계속 (embedding은 NULL 허용)
      try {
        const texts = rows.map((r) => buildEmbeddingText(r.title ?? null, r.content ?? null));
        if (texts.some((t) => t.length > 0)) {
          const vectors = await embedPassages(texts);
          rows.forEach((r, i) => {
            if (texts[i].length > 0 && vectors[i]) r.embedding = vectors[i];
          });
        }
      } catch (embedErr) {
        console.warn(
          `[executor:${source}] embedding failed (continuing without): ${
            embedErr instanceof Error ? embedErr.message : String(embedErr)
          }`,
        );
      }

      // TimescaleDB는 UNIQUE 제약이 시간 컬럼을 포함해야 하므로 애플리케이션 레벨에서
      // ON CONFLICT DO NOTHING 효과를 위해 dedup 인덱스를 활용.
      const result = await db
        .insert(rawItems)
        .values(rows)
        .onConflictDoNothing({
          target: [rawItems.source, rawItems.sourceId, rawItems.itemType, rawItems.time],
        })
        .returning({ insertedAt: rawItems.fetchedAt });

      itemsNew += result.length;

      await job.updateProgress({ itemsCollected, itemsNew });
    }

    const durationMs = Date.now() - startedAt;

    await db
      .update(collectionRuns)
      .set({
        status: 'completed',
        itemsCollected,
        itemsNew,
        blocked: false,
        durationMs,
      })
      .where(and(eq(collectionRuns.runId, runId), eq(collectionRuns.source, source)));

    // naver-news → naver-comments fan-out
    // 조건: commentsPerItem > 0 AND includeComments !== false AND 기사 URL 1건 이상
    if (
      source === 'naver-news' &&
      limits.commentsPerItem &&
      limits.commentsPerItem > 0 &&
      options?.includeComments !== false &&
      collectedArticleUrls.length > 0
    ) {
      const seen = new Set<string>();
      const targets: CommentTarget[] = [];
      for (const url of collectedArticleUrls) {
        const parsed = url.match(/n\.news\.naver\.com\/(?:mnews\/)?article\/(\d+)\/(\d+)/);
        if (!parsed) continue;
        const articleSourceId = `${parsed[1]}_${parsed[2]}`;
        if (seen.has(articleSourceId)) continue;
        seen.add(articleSourceId);
        targets.push({ url, articleSourceId });
      }
      if (targets.length > 0) {
        try {
          await enqueueCollectionJob({
            ...job.data,
            source: 'naver-comments',
            commentTargets: targets,
          });
          console.warn(
            `[executor:${source}] fan-out naver-comments runId=${runId} targets=${targets.length}`,
          );
        } catch (fanOutErr) {
          // fan-out 실패해도 기사 수집 자체는 성공으로 간주 (naver-comments run은 생성되지 않음)
          console.error(
            `[executor:${source}] naver-comments fan-out 실패 runId=${runId}: ${
              fanOutErr instanceof Error ? fanOutErr.message : String(fanOutErr)
            }`,
          );
        }
      }
    }

    // subscription 상태 업데이트 (source 중 하나라도 완료되면 lastRunAt 갱신)
    const nextRunAt = await computeNextRunAt(subscriptionId);
    await db
      .update(keywordSubscriptions)
      .set({
        lastRunAt: new Date(),
        nextRunAt,
        status: 'active',
        lastError: null,
      })
      .where(eq(keywordSubscriptions.id, subscriptionId));

    return { runId, itemsCollected, itemsNew, blocked, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    blocked = /block|captcha|429|forbidden|rate.?limit/i.test(message);

    await db
      .update(collectionRuns)
      .set({
        status: blocked ? 'blocked' : 'failed',
        itemsCollected,
        itemsNew,
        blocked,
        errorReason: message.slice(0, 500),
        durationMs,
      })
      .where(and(eq(collectionRuns.runId, runId), eq(collectionRuns.source, source)));

    await db.insert(fetchErrors).values({
      time: new Date(),
      subscriptionId,
      source,
      errorType: blocked ? 'blocked' : 'other',
      errorMessage: message.slice(0, 1000),
    });

    await db
      .update(keywordSubscriptions)
      .set({
        lastErrorAt: new Date(),
        lastError: message.slice(0, 500),
      })
      .where(eq(keywordSubscriptions.id, subscriptionId));

    throw err;
  }
}

/**
 * naver-comments child job 실행.
 *
 * 동일 runId 하에 source='naver-comments' row를 별도로 기록하고,
 * commentTargets 배열의 각 기사 URL에 대해 NaverCommentsCollector.collectForArticle을
 * 직렬 호출한다(네이버 댓글 API rate limit 고려). 기사 단위 try/catch로 부분 실패를 격리.
 *
 * subscription 상태(lastRunAt/nextRunAt)는 parent(naver-news) run이 이미 갱신했으므로
 * 여기서는 손대지 않는다 — 동일 runId에 대한 중복 갱신 방지.
 */
async function executeCommentsJob(job: Job<CollectionJobData>): Promise<CollectionJobResult> {
  const { runId, subscriptionId, source, limits, commentTargets, triggerType } = job.data;
  const db = getDb();
  const startedAt = Date.now();

  if (!commentTargets || commentTargets.length === 0) {
    // 댓글 대상이 없으면 아무것도 하지 않음 — run row도 만들지 않음
    return { runId, itemsCollected: 0, itemsNew: 0, blocked: false, durationMs: 0 };
  }

  await db.insert(collectionRuns).values({
    time: new Date(),
    runId,
    subscriptionId,
    source,
    status: 'running',
    triggerType,
  });

  let itemsCollected = 0;
  let itemsNew = 0;
  const errors: string[] = [];
  const maxComments = limits.commentsPerItem ?? 100;
  const collector = new NaverCommentsCollector();

  try {
    for (const target of commentTargets) {
      try {
        const iter = collector.collectForArticle(target.url, { maxComments });
        for await (const chunk of iter) {
          if (!Array.isArray(chunk) || chunk.length === 0) continue;
          itemsCollected += chunk.length;

          const rows = chunk.map((raw) =>
            mapToRawItem(raw as unknown as Record<string, unknown>, {
              subscriptionId,
              source,
              itemType: 'comment',
              runId,
            }),
          );

          // 댓글 임베딩 — title 없이 content만 임베딩 (실패해도 계속)
          try {
            const texts = rows.map((r) => buildEmbeddingText(null, r.content ?? null));
            if (texts.some((t) => t.length > 0)) {
              const vectors = await embedPassages(texts);
              rows.forEach((r, i) => {
                if (texts[i].length > 0 && vectors[i]) r.embedding = vectors[i];
              });
            }
          } catch (embedErr) {
            console.warn(
              `[executor:${source}] embedding failed (continuing without): ${
                embedErr instanceof Error ? embedErr.message : String(embedErr)
              }`,
            );
          }

          const result = await db
            .insert(rawItems)
            .values(rows)
            .onConflictDoNothing({
              target: [rawItems.source, rawItems.sourceId, rawItems.itemType, rawItems.time],
            })
            .returning({ insertedAt: rawItems.fetchedAt });

          itemsNew += result.length;
          await job.updateProgress({ itemsCollected, itemsNew });
        }
      } catch (articleErr) {
        const msg = articleErr instanceof Error ? articleErr.message : String(articleErr);
        errors.push(`${target.articleSourceId}: ${msg}`);
        console.warn(
          `[executor:${source}] collectForArticle 실패 ${target.articleSourceId}: ${msg}`,
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    const partialFailure = errors.length > 0;
    const totalFailure = errors.length === commentTargets.length;
    const blocked = errors.some((m) => /block|captcha|429|forbidden|rate.?limit/i.test(m));
    // 전부 실패면 failed/blocked, 일부만 실패면 completed로 기록하되 errorReason에 집계
    const status = totalFailure ? (blocked ? 'blocked' : 'failed') : 'completed';
    const errorReason = partialFailure ? errors.slice(0, 5).join(' | ').slice(0, 500) : null;

    await db
      .update(collectionRuns)
      .set({
        status,
        itemsCollected,
        itemsNew,
        blocked: totalFailure && blocked,
        errorReason,
        durationMs,
      })
      .where(and(eq(collectionRuns.runId, runId), eq(collectionRuns.source, source)));

    // totalFailure인 경우 BullMQ retry를 위해 에러 throw
    if (totalFailure) {
      throw new Error(`naver-comments 전체 실패 (${errors.length}건): ${errors[0] ?? 'unknown'}`);
    }

    return { runId, itemsCollected, itemsNew, blocked: false, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    const blocked = /block|captcha|429|forbidden|rate.?limit/i.test(message);

    // 위의 finalize가 이미 failed로 기록했을 수 있지만, 예상치 못한 예외 보호
    await db
      .update(collectionRuns)
      .set({
        status: blocked ? 'blocked' : 'failed',
        itemsCollected,
        itemsNew,
        blocked,
        errorReason: message.slice(0, 500),
        durationMs,
      })
      .where(and(eq(collectionRuns.runId, runId), eq(collectionRuns.source, source)));

    await db.insert(fetchErrors).values({
      time: new Date(),
      subscriptionId,
      source,
      errorType: blocked ? 'blocked' : 'other',
      errorMessage: message.slice(0, 1000),
    });

    throw err;
  }
}

/**
 * 다음 실행 시각 — subscription.intervalHours 기반.
 */
async function computeNextRunAt(subscriptionId: number): Promise<Date> {
  const db = getDb();
  const [row] = await db
    .select({ intervalHours: keywordSubscriptions.intervalHours })
    .from(keywordSubscriptions)
    .where(eq(keywordSubscriptions.id, subscriptionId))
    .limit(1);
  const hours = row?.intervalHours ?? 6;
  return new Date(Date.now() + hours * 3600 * 1000);
}

// sql import used implicitly by drizzle query builders above — suppress unused
void sql;
