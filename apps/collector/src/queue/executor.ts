import type { Job } from 'bullmq';
import { sql, eq, and } from 'drizzle-orm';
import { getCollector, NaverCommentsCollector } from '@ai-signalcraft/collectors';
import { getDb } from '../db';
import { rawItems, collectionRuns, fetchErrors, keywordSubscriptions } from '../db/schema';
import { buildEmbeddingText, embedPassages } from '../services/embedding';
import { CancelledError, checkCancellation, finalizeCancellationIfDone } from './cancellation';
import { mapToRawItem } from './item-mapper';
import { enqueueCollectionJob } from './queues';
import type {
  CollectionJobData,
  CollectionJobResult,
  CollectorSource,
  CommentTarget,
} from './types';

/**
 * 임베딩 배치 크기. Xenova transformers는 CPU에서 동기 추론이라 한 번에 큰 배열을 넘기면
 * 이벤트 루프가 수 분간 블록되어 BullMQ lock 갱신(30초 주기)이 실패 → stalled 판정.
 * 50개 단위로 쪼개면 각 배치 사이에 await가 끼어 lock 갱신이 가능해진다.
 */
const EMBED_BATCH_SIZE = 50;

/**
 * 게시물/비디오에 comments 배열을 inline으로 담아 반환하는 소스.
 * executor가 이 배열을 item_type='comment' raw_items로 풀어준다.
 * naver-news는 별도 fan-out(naver-comments) 경로라 포함하지 않는다.
 */
const INLINE_COMMENT_SOURCES: ReadonlySet<CollectorSource> = new Set<CollectorSource>([
  'youtube',
  'dcinside',
  'fmkorea',
  'clien',
]);

/**
 * texts 전체를 EMBED_BATCH_SIZE로 쪼개 embedPassages를 여러 번 호출한다.
 * 실패하는 배치가 있으면 그 배치 구간만 빈 배열로 채워 전체 길이를 유지한다.
 */
async function embedPassagesBatched(
  texts: string[],
  runId: string,
  source: string,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = new Array(texts.length);
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    // embedding 배치 사이에 체크 — Xenova CPU 추론은 분 단위로 블록 가능하므로
    // 배치 경계가 유일한 cooperative 중단 지점
    await checkCancellation(runId, source);
    const slice = texts.slice(i, i + EMBED_BATCH_SIZE);
    const vectors = await embedPassages(slice);
    for (let j = 0; j < slice.length; j++) {
      out[i + j] = vectors[j] ?? [];
    }
  }
  return out;
}

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

    // 수집 시작 전 체크 — 이미 cancelling이면 네트워크 호출조차 피함
    await checkCancellation(runId, source);

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
      // 각 청크 경계 — 어댑터가 페이지네이션 중에 중단 신호 감지
      await checkCancellation(runId, source);
      if (!Array.isArray(chunk) || chunk.length === 0) continue;

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
      itemsCollected += rows.length;

      // YouTube + 커뮤니티(dcinside/fmkorea/clien)는 게시물에 comments 배열을 포함해 반환한다.
      // executor가 이 배열을 별도 raw_items(item_type='comment')로 풀어주지 않으면
      // 댓글은 raw_payload에만 묻혀 분석 파이프라인에서 조회되지 않는다.
      // naver-news는 별도 fan-out(naver-comments)으로 처리되므로 여기선 제외.
      if (INLINE_COMMENT_SOURCES.has(source)) {
        for (const raw of chunk) {
          const record = raw as Record<string, unknown>;
          const comments = Array.isArray(record.comments)
            ? (record.comments as Record<string, unknown>[])
            : [];
          // 커뮤니티 어댑터는 댓글 객체에 부모 게시물 sourceId를 담지 않는다 (대댓글의 parentId는
          // 부모 댓글 ID). parentSourceId 연결을 유지하려면 수집 컨텍스트인 게시물 sourceId를
          // 여기서 주입한다. YouTube는 이미 어댑터가 videoSourceId를 넣어 반환하므로 덮어쓰지 않는다.
          const postSourceId = typeof record.sourceId === 'string' ? record.sourceId : null;
          for (const c of comments) {
            // 어댑터가 명시적으로 article/video 연결을 넣어준 경우는 존중.
            // 아니면 게시물 sourceId를 postId로 주입 — mapToRawItem이 parentSourceId로 매핑한다.
            // 대댓글의 parentId(부모 댓글 ID)보다 우선순위가 앞서 게시물 연결이 이긴다.
            const hasExplicitParent =
              typeof c.articleSourceId === 'string' || typeof c.videoSourceId === 'string';
            const enriched =
              postSourceId && !hasExplicitParent ? { ...c, postId: postSourceId } : c;
            rows.push(
              mapToRawItem(enriched, {
                subscriptionId,
                source,
                itemType: 'comment',
                runId,
              }),
            );
          }
          itemsCollected += comments.length;
        }
      }

      // 임베딩 생성 — 실패해도 수집은 계속 (embedding은 NULL 허용)
      try {
        const texts = rows.map((r) => buildEmbeddingText(r.title ?? null, r.content ?? null));
        if (texts.some((t) => t.length > 0)) {
          const vectors = await embedPassagesBatched(texts, runId, source);
          rows.forEach((r, i) => {
            if (texts[i].length > 0 && vectors[i]) r.embedding = vectors[i];
          });
        }
      } catch (embedErr) {
        // CancelledError는 재throw해서 outer catch에서 처리
        if (embedErr instanceof CancelledError) throw embedErr;
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

      // 실시간 진행 상태: Redis(job.progress)에 ts 포함해 저장 + DB(collection_runs)에 하트비트 기록.
      // UI는 Redis를 primary로 읽고, DB는 Redis 장애 시 fallback 겸 stalled 판정용.
      const progressTs = Date.now();
      await job.updateProgress({ itemsCollected, itemsNew, ts: progressTs });
      await db
        .update(collectionRuns)
        .set({ itemsCollected, itemsNew, lastProgressAt: new Date(progressTs) })
        .where(
          and(
            eq(collectionRuns.runId, runId),
            eq(collectionRuns.source, source),
            eq(collectionRuns.status, 'running'),
          ),
        );
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

    // race 커버 — 정상 종료 직전에 cancel이 들어왔어도 cancelling row를 cancelled로 정리
    await finalizeCancellationIfDone(runId, source).catch(() => void 0);

    return { runId, itemsCollected, itemsNew, blocked, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const cancelled = err instanceof CancelledError;
    const message = cancelled ? 'cancelled' : err instanceof Error ? err.message : String(err);
    blocked = !cancelled && /block|captcha|429|forbidden|rate.?limit/i.test(message);

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

    if (cancelled) {
      // run_cancellations cancelling→cancelled 전이. race-safe (WHERE status='cancelling').
      await finalizeCancellationIfDone(runId, source);
      // BullMQ 재시도 방지 — CancelledError가 일반 에러처럼 재시도되면 UX가 혼란스러움
      if (typeof job.discard === 'function') {
        await job.discard();
      }
      // lastError는 사용자 취소이므로 subscription에 기록하지 않음
      throw err;
    }

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
    // 수집 시작 전 체크 — 이미 cancelling이면 네트워크 호출조차 피함
    await checkCancellation(runId, source);

    for (const target of commentTargets) {
      try {
        const iter = collector.collectForArticle(target.url, { maxComments });
        for await (const chunk of iter) {
          // 각 청크 경계 — 페이지네이션 중에 중단 신호 감지
          await checkCancellation(runId, source);
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
              const vectors = await embedPassagesBatched(texts, runId, source);
              rows.forEach((r, i) => {
                if (texts[i].length > 0 && vectors[i]) r.embedding = vectors[i];
              });
            }
          } catch (embedErr) {
            // CancelledError는 재throw해서 outer catch에서 처리
            if (embedErr instanceof CancelledError) throw embedErr;
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
          // 댓글 fan-out 경로도 동일 하트비트 — 기사당 1회씩
          const progressTs = Date.now();
          await job.updateProgress({ itemsCollected, itemsNew, ts: progressTs });
          await db
            .update(collectionRuns)
            .set({ itemsCollected, itemsNew, lastProgressAt: new Date(progressTs) })
            .where(
              and(
                eq(collectionRuns.runId, runId),
                eq(collectionRuns.source, source),
                eq(collectionRuns.status, 'running'),
              ),
            );
        }
      } catch (articleErr) {
        // CancelledError는 per-article catch에서 삼키지 않고 outer catch로 전파
        if (articleErr instanceof CancelledError) throw articleErr;
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

    // race 커버 — 정상 종료 직전에 cancel이 들어왔어도 cancelling row를 cancelled로 정리
    await finalizeCancellationIfDone(runId, source).catch(() => void 0);

    return { runId, itemsCollected, itemsNew, blocked: false, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const cancelled = err instanceof CancelledError;
    const message = cancelled ? 'cancelled' : err instanceof Error ? err.message : String(err);
    const blocked = !cancelled && /block|captcha|429|forbidden|rate.?limit/i.test(message);

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

    if (cancelled) {
      // run_cancellations cancelling→cancelled 전이. race-safe (WHERE status='cancelling').
      await finalizeCancellationIfDone(runId, source);
      // BullMQ 재시도 방지
      if (typeof job.discard === 'function') {
        await job.discard();
      }
      throw err;
    }

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
