import { sql, isNull } from 'drizzle-orm';
import { getDb } from '../../db';
import { articles, comments } from '../../db/schema/collections';
import { embedTexts } from './embeddings';

/**
 * 기사에 임베딩을 생성하여 DB에 저장.
 * 이미 임베딩이 있는 기사는 스킵.
 */
export async function persistArticleEmbeddings(articleIds: number[]): Promise<void> {
  if (articleIds.length === 0) return;

  const db = getDb();

  // 임베딩이 없는 기사만 조회
  const target = await db
    .select({ id: articles.id, title: articles.title, content: articles.content })
    .from(articles)
    .where(isNull(articles.embedding))
    .limit(500);

  // 요청된 ID와 교집합
  const idSet = new Set(articleIds);
  const toEmbed = target.filter((a) => idSet.has(a.id));

  if (toEmbed.length === 0) return;

  // 텍스트 준비: title + content 앞부분 (deduplicator와 동일 패턴)
  const texts = toEmbed.map((a) => `${a.title} ${(a.content ?? '').slice(0, 300)}`);

  // 임베딩 생성
  const embeddings = await embedTexts(texts);

  // DB에 저장
  for (let i = 0; i < toEmbed.length; i++) {
    await db
      .update(articles)
      .set({ embedding: embeddings[i] } as any)
      .where(sql`${articles.id} = ${toEmbed[i].id}`);
  }

  console.error(`[embedding] 기사 임베딩 저장: ${toEmbed.length}건`);
}

/**
 * 댓글에 임베딩을 생성하여 DB에 저장.
 * 이미 임베딩이 있는 댓글은 스킵.
 */
export async function persistCommentEmbeddings(commentIds: number[]): Promise<void> {
  if (commentIds.length === 0) return;

  const db = getDb();

  // 임베딩이 없는 댓글만 조회
  const target = await db
    .select({ id: comments.id, content: comments.content })
    .from(comments)
    .where(isNull(comments.embedding))
    .limit(500);

  // 요청된 ID와 교집합
  const idSet = new Set(commentIds);
  const toEmbed = target.filter((c) => idSet.has(c.id));

  if (toEmbed.length === 0) return;

  const texts = toEmbed.map((c) => c.content);
  const embeddings = await embedTexts(texts);

  for (let i = 0; i < toEmbed.length; i++) {
    await db
      .update(comments)
      .set({ embedding: embeddings[i] } as any)
      .where(sql`${comments.id} = ${toEmbed[i].id}`);
  }

  console.error(`[embedding] 댓글 임베딩 저장: ${toEmbed.length}건`);
}
