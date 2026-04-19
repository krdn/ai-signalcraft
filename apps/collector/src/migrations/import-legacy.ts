/**
 * 레거시 이관: ais-prod-postgres의 articles/videos/comments → ais_collection의 raw_items.
 *
 * 설계:
 *   - keyword별로 keyword_subscriptions 자동 생성 (status='paused' — 수집은 안 함)
 *   - articles/videos/comments의 (source, source_id)가 raw_items 유니크 키와 호환
 *   - 시간축: time = publishedAt ?? collectedAt
 *   - 배치 크기 500, 진행률 stdout
 *   - dryRun 플래그로 삽입 없이 행 수만 집계
 *   - raw_items는 hypertable — 업서트 경로는 UNIQUE INDEX (source, source_id, item_type, time)
 *     → ON CONFLICT DO NOTHING으로 idempotent
 *
 * 실행:
 *   LEGACY_DATABASE_URL=postgres://... \
 *   DATABASE_URL=postgres://.../ais_collection \
 *   pnpm --filter @ai-signalcraft/collector exec tsx src/migrations/import-legacy.ts [--dry-run] [--limit N]
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { keywordSubscriptions, rawItems } from '../db/schema';

type CliFlags = { dryRun: boolean; limit: number | null };

function parseFlags(argv: string[]): CliFlags {
  const dryRun = argv.includes('--dry-run');
  const limitIdx = argv.indexOf('--limit');
  const limit = limitIdx >= 0 && argv[limitIdx + 1] ? Number(argv[limitIdx + 1]) : null;
  return { dryRun, limit };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 필요`);
  return v;
}

const BATCH_SIZE = 500;

interface LegacyArticleRow {
  id: number;
  job_id: number | null;
  source: string;
  source_id: string;
  url: string;
  title: string;
  content: string | null;
  author: string | null;
  publisher: string | null;
  published_at: Date | null;
  collected_at: Date;
  raw_data: unknown;
  keyword: string | null;
}

interface LegacyVideoRow {
  id: number;
  job_id: number | null;
  source: string;
  source_id: string;
  url: string;
  title: string;
  description: string | null;
  channel_title: string | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  transcript: string | null;
  published_at: Date | null;
  collected_at: Date;
  raw_data: unknown;
  keyword: string | null;
}

interface LegacyCommentRow {
  id: number;
  job_id: number | null;
  source: string;
  source_id: string;
  parent_id: string | null;
  article_id: number | null;
  video_id: number | null;
  content: string;
  author: string | null;
  like_count: number | null;
  dislike_count: number | null;
  published_at: Date | null;
  collected_at: Date;
  raw_data: unknown;
  keyword: string | null;
}

async function ensureSubscriptions(
  targetDb: ReturnType<typeof drizzle>,
  keywords: Set<string>,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const kw of keywords) {
    if (!kw) continue;
    const existing = await targetDb
      .select({ id: keywordSubscriptions.id })
      .from(keywordSubscriptions)
      .where(and(eq(keywordSubscriptions.keyword, kw), eq(keywordSubscriptions.ownerId, 'legacy')))
      .limit(1);
    if (existing[0]) {
      map.set(kw, existing[0].id);
      continue;
    }
    const [row] = await targetDb
      .insert(keywordSubscriptions)
      .values({
        keyword: kw,
        sources: ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'],
        intervalHours: 24,
        status: 'paused', // 이관 데이터는 자동 수집 대상 아님
        limits: { maxPerRun: 100 },
        ownerId: 'legacy',
      })
      .returning();
    map.set(kw, row.id);
  }
  return map;
}

type Counter = { scanned: number; inserted: number; skipped: number };

async function migrateArticles(
  src: Pool,
  dst: ReturnType<typeof drizzle>,
  subMap: Map<string, number>,
  flags: CliFlags,
): Promise<Counter> {
  const counter: Counter = { scanned: 0, inserted: 0, skipped: 0 };
  let offset = 0;

  while (true) {
    const { rows } = await src.query<LegacyArticleRow>(
      `SELECT a.id, a.job_id, a.source, a.source_id, a.url, a.title, a.content, a.author,
              a.publisher, a.published_at, a.collected_at, a.raw_data,
              j.keyword AS keyword
       FROM articles a
       LEFT JOIN collection_jobs j ON j.id = a.job_id
       ORDER BY a.id
       LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset],
    );
    if (rows.length === 0) break;

    const batch = rows.map((r) => {
      const t = r.published_at ?? r.collected_at;
      const keyword = r.keyword ?? '__legacy_unknown__';
      const subscriptionId = subMap.get(keyword) ?? subMap.get('__legacy_unknown__')!;
      return {
        time: t,
        subscriptionId,
        source: r.source,
        sourceId: r.source_id,
        itemType: 'article' as const,
        url: r.url,
        title: r.title,
        content: r.content,
        author: r.author,
        publisher: r.publisher,
        publishedAt: r.published_at,
        metrics: null,
        rawPayload: r.raw_data ?? {},
      };
    });

    counter.scanned += batch.length;
    if (!flags.dryRun && batch.length > 0) {
      const res = await dst
        .insert(rawItems)
        .values(batch)
        .onConflictDoNothing({
          target: [rawItems.source, rawItems.sourceId, rawItems.itemType, rawItems.time],
        })
        .returning({ sourceId: rawItems.sourceId });
      counter.inserted += res.length;
      counter.skipped += batch.length - res.length;
    }

    offset += rows.length;
    process.stdout.write(`[articles] scanned=${counter.scanned} inserted=${counter.inserted}\r`);
    if (flags.limit && counter.scanned >= flags.limit) break;
  }
  process.stdout.write('\n');
  return counter;
}

async function migrateVideos(
  src: Pool,
  dst: ReturnType<typeof drizzle>,
  subMap: Map<string, number>,
  flags: CliFlags,
): Promise<Counter> {
  const counter: Counter = { scanned: 0, inserted: 0, skipped: 0 };
  let offset = 0;

  while (true) {
    const { rows } = await src.query<LegacyVideoRow>(
      `SELECT v.id, v.job_id, v.source, v.source_id, v.url, v.title, v.description,
              v.channel_title, v.view_count, v.like_count, v.comment_count, v.transcript,
              v.published_at, v.collected_at, v.raw_data,
              j.keyword AS keyword
       FROM videos v
       LEFT JOIN collection_jobs j ON j.id = v.job_id
       ORDER BY v.id
       LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset],
    );
    if (rows.length === 0) break;

    const batch = rows.map((r) => {
      const t = r.published_at ?? r.collected_at;
      const keyword = r.keyword ?? '__legacy_unknown__';
      const subscriptionId = subMap.get(keyword) ?? subMap.get('__legacy_unknown__')!;
      const body = r.transcript ?? r.description ?? null;
      return {
        time: t,
        subscriptionId,
        source: r.source,
        sourceId: r.source_id,
        itemType: 'video' as const,
        url: r.url,
        title: r.title,
        content: body,
        author: null,
        publisher: r.channel_title,
        publishedAt: r.published_at,
        metrics: {
          viewCount: r.view_count ?? undefined,
          likeCount: r.like_count ?? undefined,
          commentCount: r.comment_count ?? undefined,
        },
        rawPayload: r.raw_data ?? {},
      };
    });

    counter.scanned += batch.length;
    if (!flags.dryRun && batch.length > 0) {
      const res = await dst
        .insert(rawItems)
        .values(batch)
        .onConflictDoNothing({
          target: [rawItems.source, rawItems.sourceId, rawItems.itemType, rawItems.time],
        })
        .returning({ sourceId: rawItems.sourceId });
      counter.inserted += res.length;
      counter.skipped += batch.length - res.length;
    }

    offset += rows.length;
    process.stdout.write(`[videos] scanned=${counter.scanned} inserted=${counter.inserted}\r`);
    if (flags.limit && counter.scanned >= flags.limit) break;
  }
  process.stdout.write('\n');
  return counter;
}

async function migrateComments(
  src: Pool,
  dst: ReturnType<typeof drizzle>,
  subMap: Map<string, number>,
  flags: CliFlags,
): Promise<Counter> {
  const counter: Counter = { scanned: 0, inserted: 0, skipped: 0 };
  let offset = 0;

  while (true) {
    const { rows } = await src.query<LegacyCommentRow>(
      `SELECT c.id, c.job_id, c.source, c.source_id, c.parent_id, c.article_id, c.video_id,
              c.content, c.author, c.like_count, c.dislike_count, c.published_at, c.collected_at,
              c.raw_data,
              j.keyword AS keyword
       FROM comments c
       LEFT JOIN collection_jobs j ON j.id = c.job_id
       ORDER BY c.id
       LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset],
    );
    if (rows.length === 0) break;

    const batch = rows.map((r) => {
      const t = r.published_at ?? r.collected_at;
      const keyword = r.keyword ?? '__legacy_unknown__';
      const subscriptionId = subMap.get(keyword) ?? subMap.get('__legacy_unknown__')!;
      return {
        time: t,
        subscriptionId,
        source: r.source,
        sourceId: r.source_id,
        itemType: 'comment' as const,
        url: null,
        title: null,
        content: r.content,
        author: r.author,
        publisher: null,
        publishedAt: r.published_at,
        parentSourceId: r.parent_id,
        metrics: {
          likeCount: r.like_count ?? undefined,
        },
        rawPayload: r.raw_data ?? {},
      };
    });

    counter.scanned += batch.length;
    if (!flags.dryRun && batch.length > 0) {
      const res = await dst
        .insert(rawItems)
        .values(batch)
        .onConflictDoNothing({
          target: [rawItems.source, rawItems.sourceId, rawItems.itemType, rawItems.time],
        })
        .returning({ sourceId: rawItems.sourceId });
      counter.inserted += res.length;
      counter.skipped += batch.length - res.length;
    }

    offset += rows.length;
    process.stdout.write(`[comments] scanned=${counter.scanned} inserted=${counter.inserted}\r`);
    if (flags.limit && counter.scanned >= flags.limit) break;
  }
  process.stdout.write('\n');
  return counter;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  const srcUrl = requireEnv('LEGACY_DATABASE_URL');
  const dstUrl = requireEnv('DATABASE_URL');

  const src = new Pool({ connectionString: srcUrl });
  const dstPool = new Pool({ connectionString: dstUrl });
  const dst = drizzle(dstPool);

  console.warn(`[import] dryRun=${flags.dryRun} limit=${flags.limit ?? 'all'}`);
  console.warn('[import] keyword 목록 수집 중...');

  const { rows: kwRows } = await src.query<{ keyword: string }>(
    `SELECT DISTINCT keyword FROM collection_jobs WHERE keyword IS NOT NULL`,
  );
  const keywords = new Set<string>(kwRows.map((r) => r.keyword));
  keywords.add('__legacy_unknown__');
  console.warn(`[import] ${keywords.size}개 키워드 발견`);

  const subMap = flags.dryRun
    ? new Map<string, number>(Array.from(keywords).map((k) => [k, 0]))
    : await ensureSubscriptions(dst, keywords);

  const articlesCounter = await migrateArticles(src, dst, subMap, flags);
  console.warn(`[articles] ${JSON.stringify(articlesCounter)}`);

  const videosCounter = await migrateVideos(src, dst, subMap, flags);
  console.warn(`[videos] ${JSON.stringify(videosCounter)}`);

  const commentsCounter = await migrateComments(src, dst, subMap, flags);
  console.warn(`[comments] ${JSON.stringify(commentsCounter)}`);

  await src.end();
  await dstPool.end();

  console.warn('[import] done');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[import] fatal:', err);
    process.exit(1);
  });
}
