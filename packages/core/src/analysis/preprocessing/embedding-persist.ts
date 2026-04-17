/**
 * 기사/댓글 임베딩을 DB에 저장.
 *
 * 성능 개선: N+1 개별 UPDATE를 단일 UPDATE ... FROM unnest(VALUES) 로 치환.
 * 500건 기준 ~5초 → ~200ms
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { articles, comments } from '../../db/schema/collections';
import { embedTexts } from './embeddings';

const EMBED_BATCH_SIZE = 500;

function toPgVectorLiteral(vec: number[]): string {
  // pgvector 리터럴 포맷: '[0.1,0.2,...]'
  return `[${vec.join(',')}]`;
}

async function bulkUpdateEmbeddings(
  table: 'articles' | 'comments',
  rows: Array<{ id: number; embedding: number[] }>,
): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb();

  // VALUES (id, embedding), ... 를 평문 SQL로 빌드
  // pgvector '<vec>'::vector 캐스트 필요
  const valuesSql = rows
    .map((r) => `(${r.id}, '${toPgVectorLiteral(r.embedding)}'::vector)`)
    .join(',');

  await db.execute(
    sql.raw(`
    UPDATE ${table} AS t
    SET embedding = v.embedding
    FROM (VALUES ${valuesSql}) AS v(id, embedding)
    WHERE t.id = v.id
  `),
  );
}

/**
 * 기사에 임베딩을 생성하여 DB에 저장.
 * 이미 임베딩이 있는 기사는 스킵.
 */
export async function persistArticleEmbeddings(articleIds: number[]): Promise<void> {
  if (articleIds.length === 0) return;

  const db = getDb();

  // 요청된 ID 중 임베딩이 없는 기사만 조회
  const target = await db
    .select({ id: articles.id, title: articles.title, content: articles.content })
    .from(articles)
    .where(
      sql`${articles.id} = ANY(ARRAY[${sql.raw(articleIds.join(','))}]::int[]) AND ${articles.embedding} IS NULL`,
    )
    .limit(EMBED_BATCH_SIZE);

  if (target.length === 0) return;

  const texts = target.map((a) => `${a.title} ${(a.content ?? '').slice(0, 300)}`);
  const embeddings = await embedTexts(texts);

  const payload = target.map((row, i) => ({ id: row.id, embedding: embeddings[i] }));
  await bulkUpdateEmbeddings('articles', payload);

  console.error(`[embedding] 기사 임베딩 bulk 저장: ${target.length}건`);
}

/**
 * 댓글에 임베딩을 생성하여 DB에 저장.
 * 이미 임베딩이 있는 댓글은 스킵.
 */
export async function persistCommentEmbeddings(commentIds: number[]): Promise<void> {
  if (commentIds.length === 0) return;

  const db = getDb();

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

  const payload = target.map((row, i) => ({ id: row.id, embedding: embeddings[i] }));
  await bulkUpdateEmbeddings('comments', payload);

  console.error(`[embedding] 댓글 임베딩 bulk 저장: ${target.length}건`);
}
