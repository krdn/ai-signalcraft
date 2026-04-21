/**
 * 이미 수집된 raw_items에 감정 분석 결과를 backfill.
 *
 * 사용법:
 *   pnpm --filter collector tsx src/scripts/backfill-sentiment.ts
 *   pnpm --filter collector tsx src/scripts/backfill-sentiment.ts --subscription-id 5
 *   pnpm --filter collector tsx src/scripts/backfill-sentiment.ts --source naver-news
 *   pnpm --filter collector tsx src/scripts/backfill-sentiment.ts --item-type comment
 *   pnpm --filter collector tsx src/scripts/backfill-sentiment.ts --dry-run
 */
import { sql, isNull, and, eq, type SQL } from 'drizzle-orm';
import { getDb } from '../db';
import { rawItems } from '../db/schema';
import { initSentiment, classifySentimentFromTexts } from '../services/sentiment';
import { buildEmbeddingText } from '../services/embedding';

const BATCH_SIZE = 50;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const subscriptionId = parseArg(args, '--subscription-id');
  const source = parseArg(args, '--source');
  const itemType = parseArg(args, '--item-type');

  console.log('[backfill-sentiment] 시작', { dryRun, subscriptionId, source, itemType });

  await initSentiment();

  const db = getDb();
  const conditions: SQL[] = [isNull(rawItems.sentiment)];
  if (subscriptionId) conditions.push(eq(rawItems.subscriptionId, Number(subscriptionId)));
  if (source) conditions.push(eq(rawItems.source, source));
  if (itemType) conditions.push(eq(rawItems.itemType, itemType as 'article' | 'video' | 'comment'));

  // 대상 건수 확인
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rawItems)
    .where(and(...conditions));
  console.log(`[backfill-sentiment] 대상: ${count}건`);

  if (count === 0) {
    console.log('[backfill-sentiment] 처리할 데이터 없음');
    return;
  }

  let processed = 0;
  let updated = 0;

  // 커서 기반 페이지네이션
  let lastTime: Date | null = null;
  let lastSourceId: string | null = null;

  while (true) {
    const cursorConditions: SQL[] = lastTime
      ? [
          ...conditions,
          sql`(${rawItems.time}, ${rawItems.sourceId}) > (${lastTime}, ${lastSourceId})`,
        ]
      : conditions;

    const rows = await db
      .select({
        time: rawItems.time,
        sourceId: rawItems.sourceId,
        title: rawItems.title,
        content: rawItems.content,
      })
      .from(rawItems)
      .where(and(...cursorConditions))
      .orderBy(rawItems.time, rawItems.sourceId)
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;

    const texts = rows.map((r) => buildEmbeddingText(r.title, r.content));
    const sentiments = await classifySentimentFromTexts(texts);

    if (!dryRun) {
      // batch UPDATE — VALUES + JOIN으로 N건을 단일 쿼리로 처리
      const validEntries = rows
        .map((r, i) => ({ row: r, sentiment: sentiments[i] }))
        .filter(
          (e) => e.sentiment && !(e.sentiment.label === 'neutral' && e.sentiment.score === 0),
        );

      if (validEntries.length > 0) {
        try {
          const valuesClauses = validEntries.map((e, i) =>
            // 첫 행에만 명시적 캐스트 — PostgreSQL이 VALUES의 컬럼 타입을 첫 행으로 추론한다.
            // AS alias(col ...)에는 타입을 넣을 수 없음(syntax error at or near "text").
            i === 0
              ? sql`(${e.row.time.toISOString()}::timestamptz, ${e.row.sourceId}::text, ${e.sentiment!.label}::text, ${e.sentiment!.score}::real)`
              : sql`(${e.row.time.toISOString()}, ${e.row.sourceId}, ${e.sentiment!.label}, ${e.sentiment!.score})`,
          );
          await db.execute(sql`
            UPDATE raw_items AS t
            SET sentiment = v.s,
                sentiment_score = v.sc
            FROM (VALUES ${sql.join(valuesClauses, sql`, `)}) AS v(ts, sid, s, sc)
            WHERE t.source_id = v.sid
              AND t.time = v.ts
              AND t.sentiment IS NULL
          `);
          updated += validEntries.length;
        } catch (err) {
          console.warn(
            `[backfill-sentiment] batch UPDATE 실패: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    processed += rows.length;

    lastTime = rows[rows.length - 1].time;
    lastSourceId = rows[rows.length - 1].sourceId;

    if (processed % 500 === 0 || rows.length < BATCH_SIZE) {
      console.log(`[backfill-sentiment] 진행: ${processed}/${count} (업데이트: ${updated})`);
    }
  }

  console.log(
    `[backfill-sentiment] 완료: ${processed}건 처리, ${updated}건 업데이트${dryRun ? ' (dry-run)' : ''}`,
  );
}

function parseArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined;
}

main().catch((err) => {
  console.error('[backfill-sentiment] 오류:', err);
  process.exit(1);
});
