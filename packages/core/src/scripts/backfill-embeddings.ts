/**
 * 기존 기사/댓글에 임베딩을 백필하는 스크립트
 *
 * 사용법:
 *   pnpm --filter @ai-signalcraft/core tsx src/scripts/backfill-embeddings.ts
 *   pnpm --filter @ai-signalcraft/core tsx src/scripts/backfill-embeddings.ts --comments-only
 *   pnpm --filter @ai-signalcraft/core tsx src/scripts/backfill-embeddings.ts --articles-only
 */
import 'dotenv/config';
import { isNull, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { articles, comments } from '../db/schema/collections';
import { embedTexts } from '../analysis/preprocessing/embeddings';

const BATCH_SIZE = 50;

async function backfillArticles(): Promise<number> {
  const db = getDb();
  let total = 0;

  while (true) {
    const rows = await db
      .select({ id: articles.id, title: articles.title, content: articles.content })
      .from(articles)
      .where(isNull(articles.embedding))
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;

    const texts = rows.map((r) => `${r.title} ${(r.content ?? '').slice(0, 300)}`);
    const embeddings = await embedTexts(texts);

    for (let i = 0; i < rows.length; i++) {
      await db
        .update(articles)
        .set({ embedding: embeddings[i] } as any)
        .where(sql`${articles.id} = ${rows[i].id}`);
    }

    total += rows.length;
    console.log(`[backfill] 기사: ${total}건 처리 완료`);
  }

  return total;
}

async function backfillComments(): Promise<number> {
  const db = getDb();
  let total = 0;

  while (true) {
    const rows = await db
      .select({ id: comments.id, content: comments.content })
      .from(comments)
      .where(isNull(comments.embedding))
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;

    const texts = rows.map((r) => r.content);
    const embeddings = await embedTexts(texts);

    for (let i = 0; i < rows.length; i++) {
      await db
        .update(comments)
        .set({ embedding: embeddings[i] } as any)
        .where(sql`${comments.id} = ${rows[i].id}`);
    }

    total += rows.length;
    console.log(`[backfill] 댓글: ${total}건 처리 완료`);
  }

  return total;
}

async function main() {
  const args = process.argv.slice(2);
  const articlesOnly = args.includes('--articles-only');
  const commentsOnly = args.includes('--comments-only');

  console.log('[backfill] 임베딩 백필 시작...');

  if (!commentsOnly) {
    const articleCount = await backfillArticles();
    console.log(`[backfill] 기사 완료: 총 ${articleCount}건`);
  }

  if (!articlesOnly) {
    const commentCount = await backfillComments();
    console.log(`[backfill] 댓글 완료: 총 ${commentCount}건`);
  }

  console.log('[backfill] 완료');
  process.exit(0);
}

main().catch((err) => {
  console.error('[backfill] 오류:', err);
  process.exit(1);
});
