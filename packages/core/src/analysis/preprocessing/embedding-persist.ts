import { sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { articles, comments } from '../../db/schema/collections';
import { embedTexts } from './embeddings';

// 1회 처리 최대 건수 (임베딩 API 배치 한도)
const EMBED_BATCH_SIZE = 500;

/**
 * 기사에 임베딩을 생성하여 DB에 저장.
 * 이미 임베딩이 있는 기사는 스킵.
 */
export async function persistArticleEmbeddings(articleIds: number[]): Promise<void> {
  if (articleIds.length === 0) return;

  const db = getDb();

  // 요청된 ID 중 임베딩이 없는 기사만 조회 (jobId 범위 내로 한정)
  const target = await db
    .select({ id: articles.id, title: articles.title, content: articles.content })
    .from(articles)
    .where(
      sql`${articles.id} = ANY(ARRAY[${sql.raw(articleIds.join(','))}]::int[]) AND ${articles.embedding} IS NULL`,
    )
    .limit(EMBED_BATCH_SIZE);

  if (target.length === 0) return;

  // 텍스트 준비: title + content 앞부분
  const texts = target.map((a) => `${a.title} ${(a.content ?? '').slice(0, 300)}`);

  // 임베딩 생성
  const embeddings = await embedTexts(texts);

  // DB에 저장
  for (let i = 0; i < target.length; i++) {
    await db
      .update(articles)
      .set({ embedding: embeddings[i] } as any)
      .where(sql`${articles.id} = ${target[i].id}`);
  }

  console.error(`[embedding] 기사 임베딩 저장: ${target.length}건`);
}

/**
 * 댓글에 임베딩을 생성하여 DB에 저장.
 * 이미 임베딩이 있는 댓글은 스킵.
 * 배치 크기(EMBED_BATCH_SIZE)를 초과하는 경우 첫 번째 배치만 처리.
 */
export async function persistCommentEmbeddings(commentIds: number[]): Promise<void> {
  if (commentIds.length === 0) return;

  const db = getDb();

  // 요청된 ID 중 임베딩이 없는 댓글만 조회 (jobId 범위 내로 한정)
  const target = await db
    .select({ id: comments.id, content: comments.content })
    .from(comments)
    .where(
      sql`${comments.id} = ANY(ARRAY[${sql.raw(commentIds.slice(0, 2000).join(','))}]::int[]) AND ${comments.embedding} IS NULL`,
    )
    .limit(EMBED_BATCH_SIZE);

  if (target.length === 0) return;

  const texts = target.map((c) => c.content);
  const embeddings = await embedTexts(texts);

  for (let i = 0; i < target.length; i++) {
    await db
      .update(comments)
      .set({ embedding: embeddings[i] } as any)
      .where(sql`${comments.id} = ${target[i].id}`);
  }

  console.error(`[embedding] 댓글 임베딩 저장: ${target.length}건`);
}
