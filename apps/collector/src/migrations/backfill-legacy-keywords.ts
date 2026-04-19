/**
 * 레거시 키워드 귀속 백필 스크립트.
 *
 * 배경:
 *   import-legacy.ts는 `articles.job_id → collection_jobs.keyword` 경로를 썼으나,
 *   프로덕션 데이터에서는 articles.job_id가 모두 NULL이라 모든 row가
 *   `__legacy_unknown__` 구독으로 귀속됐다. 실제 키워드 매핑은 다음 경로에 있다:
 *     - articles → article_keywords (article_id, keyword)
 *     - videos → video_keywords (video_id, keyword)
 *     - comments → comment_jobs → collection_jobs.keyword
 *
 * 동작:
 *   1) 소스 DB에서 (source, source_id, item_type) → keyword 매핑 build (메모리)
 *   2) 타겟 DB에서 이관된 raw_items의 subscription_id를 올바른 값으로 UPDATE
 *   3) 한 article이 여러 키워드에 매핑된 경우 첫 키워드만 사용 (raw_items는 subscription_id 단수)
 *
 * 실행:
 *   LEGACY_DATABASE_URL=postgres://... \
 *   DATABASE_URL=postgres://.../ais_collection \
 *   pnpm --filter @ai-signalcraft/collector exec tsx src/migrations/backfill-legacy-keywords.ts [--dry-run]
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { keywordSubscriptions } from '../db/schema';

type CliFlags = { dryRun: boolean };

function parseFlags(argv: string[]): CliFlags {
  return { dryRun: argv.includes('--dry-run') };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 필요`);
  return v;
}

interface MappingRow {
  source: string;
  source_id: string;
  item_type: 'article' | 'video' | 'comment';
  keyword: string;
}

async function buildArticleMap(src: Pool): Promise<MappingRow[]> {
  const { rows } = await src.query<MappingRow>(
    `SELECT DISTINCT ON (a.source, a.source_id)
       a.source AS source, a.source_id AS source_id, 'article' AS item_type, ak.keyword AS keyword
     FROM articles a
     INNER JOIN article_keywords ak ON ak.article_id = a.id
     ORDER BY a.source, a.source_id, ak.first_seen_at ASC`,
  );
  return rows;
}

async function buildVideoMap(src: Pool): Promise<MappingRow[]> {
  const { rows } = await src.query<MappingRow>(
    `SELECT DISTINCT ON (v.source, v.source_id)
       v.source AS source, v.source_id AS source_id, 'video' AS item_type, vk.keyword AS keyword
     FROM videos v
     INNER JOIN video_keywords vk ON vk.video_id = v.id
     ORDER BY v.source, v.source_id, vk.first_seen_at ASC`,
  );
  return rows;
}

async function buildCommentMap(src: Pool): Promise<MappingRow[]> {
  const { rows } = await src.query<MappingRow>(
    `SELECT DISTINCT ON (c.source, c.source_id)
       c.source AS source, c.source_id AS source_id, 'comment' AS item_type, j.keyword AS keyword
     FROM comments c
     INNER JOIN comment_jobs cj ON cj.comment_id = c.id
     INNER JOIN collection_jobs j ON j.id = cj.job_id
     WHERE j.keyword IS NOT NULL
     ORDER BY c.source, c.source_id, cj.collected_at ASC`,
  );
  return rows;
}

async function ensureSubscription(
  dst: ReturnType<typeof drizzle>,
  keyword: string,
): Promise<number> {
  const existing = await dst
    .select({ id: keywordSubscriptions.id })
    .from(keywordSubscriptions)
    .where(
      and(eq(keywordSubscriptions.keyword, keyword), eq(keywordSubscriptions.ownerId, 'legacy')),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [row] = await dst
    .insert(keywordSubscriptions)
    .values({
      keyword,
      sources: ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'],
      intervalHours: 24,
      status: 'paused',
      limits: { maxPerRun: 100 },
      ownerId: 'legacy',
    })
    .returning();
  return row.id;
}

async function applyBackfill(
  dstPool: Pool,
  mappings: MappingRow[],
  subMap: Map<string, number>,
  flags: CliFlags,
): Promise<{ updated: number; skipped: number }> {
  // 임시 테이블 + 배치 INSERT + 단일 UPDATE 전략.
  // per-row UPDATE는 너무 느리고 pg-copy-streams 의존성을 피하기 위함.
  const client = await dstPool.connect();
  let updated: number;
  let skipped = 0;
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TEMP TABLE _backfill_map (
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        subscription_id INTEGER NOT NULL
      ) ON COMMIT DROP
    `);

    // 1000개씩 배치 INSERT
    const BATCH = 1000;
    const valid = mappings.filter((m) => {
      if (!subMap.get(m.keyword)) {
        skipped += 1;
        return false;
      }
      return true;
    });

    for (let i = 0; i < valid.length; i += BATCH) {
      const slice = valid.slice(i, i + BATCH);
      const params: unknown[] = [];
      const placeholders: string[] = [];
      for (const m of slice) {
        const sub = subMap.get(m.keyword);
        if (sub === undefined) continue; // 사전 필터링됐으므로 도달 불가
        const base = params.length;
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
        params.push(m.source, m.source_id, m.item_type, sub);
      }
      await client.query(
        `INSERT INTO _backfill_map (source, source_id, item_type, subscription_id) VALUES ${placeholders.join(',')}`,
        params,
      );
      process.stdout.write(
        `[backfill] staging ${Math.min(i + BATCH, valid.length)}/${valid.length}\r`,
      );
    }
    process.stdout.write('\n');

    await client.query(`CREATE INDEX ON _backfill_map (source, source_id, item_type)`);

    if (flags.dryRun) {
      const { rows } = await client.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM raw_items r
         INNER JOIN _backfill_map m
           ON m.source = r.source AND m.source_id = r.source_id AND m.item_type = r.item_type
         WHERE r.subscription_id <> m.subscription_id`,
      );
      updated = Number(rows[0]?.c ?? 0);
      console.warn(`[backfill] (dry-run) 대상 row=${updated}, skipped(매핑없음)=${skipped}`);
      await client.query('ROLLBACK');
    } else {
      const res = await client.query(
        `UPDATE raw_items r
         SET subscription_id = m.subscription_id
         FROM _backfill_map m
         WHERE m.source = r.source
           AND m.source_id = r.source_id
           AND m.item_type = r.item_type
           AND r.subscription_id <> m.subscription_id`,
      );
      updated = res.rowCount ?? 0;
      await client.query('COMMIT');
      console.warn(`[backfill] 업데이트 완료 row=${updated}, skipped(매핑없음)=${skipped}`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return { updated, skipped };
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const srcUrl = requireEnv('LEGACY_DATABASE_URL');
  const dstUrl = requireEnv('DATABASE_URL');

  const src = new Pool({ connectionString: srcUrl });
  const dstPool = new Pool({ connectionString: dstUrl });
  const dst = drizzle(dstPool);

  console.warn(`[backfill] dryRun=${flags.dryRun}`);
  console.warn('[backfill] 소스 DB에서 (source, source_id, item_type) → keyword 매핑 build 중...');

  const [articleMap, videoMap, commentMap] = await Promise.all([
    buildArticleMap(src),
    buildVideoMap(src),
    buildCommentMap(src),
  ]);
  const mappings = [...articleMap, ...videoMap, ...commentMap];
  console.warn(
    `[backfill] 매핑: articles=${articleMap.length} videos=${videoMap.length} comments=${commentMap.length}`,
  );

  // 구독 ensure (keyword → id)
  const keywords = new Set<string>(mappings.map((m) => m.keyword));
  console.warn(`[backfill] 고유 키워드 ${keywords.size}개`);

  const subMap = new Map<string, number>();
  for (const kw of keywords) {
    const id = await ensureSubscription(dst, kw);
    subMap.set(kw, id);
  }
  console.warn(`[backfill] 구독 ensure 완료`);

  await applyBackfill(dstPool, mappings, subMap, flags);

  await src.end();
  await dstPool.end();
  console.warn('[backfill] done');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[backfill] fatal:', err);
    process.exit(1);
  });
}
