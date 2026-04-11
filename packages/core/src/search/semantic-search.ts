// 의미 기반 문서 검색 서비스
// pgvector 임베딩을 활용하여 자연어 질의로 관련 기사/댓글 검색
import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { embedTexts } from '../analysis/preprocessing/embeddings';

// ─── 타입 ────────────────────────────────────────────────────────

export interface SemanticSearchOptions {
  query: string;
  jobId?: number;
  source?: 'article' | 'comment' | 'all';
  topK?: number;
  minSimilarity?: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface SearchResult {
  id: number;
  type: 'article' | 'comment';
  content: string;
  title?: string;
  source: string;
  publisher?: string;
  similarity: number;
  sentiment?: string;
  likeCount?: number;
  publishedAt: Date | null;
}

export interface SimilarDocumentOptions {
  documentId: number;
  documentType: 'article' | 'comment';
  jobId?: number;
  topK?: number;
  minSimilarity?: number;
}

// ─── 메인 검색 함수 ───────────────────────────────────────────────

/**
 * 자연어 질의로 의미 기반 문서 검색
 * 질의 텍스트를 임베딩하여 pgvector 코사인 유사도로 정렬
 */
export async function semanticSearch(options: SemanticSearchOptions): Promise<SearchResult[]> {
  const { query, jobId, source = 'all', topK = 20, minSimilarity = 0.4, sentiment } = options;

  // 질의 임베딩 생성
  const [queryEmbedding] = await embedTexts([query]);
  const queryVector = `[${queryEmbedding.join(',')}]`;

  const results: SearchResult[] = [];

  // 기사 검색
  if (source === 'article' || source === 'all') {
    const articleResults = await searchArticles(queryVector, jobId, topK, minSimilarity, sentiment);
    results.push(...articleResults);
  }

  // 댓글 검색
  if (source === 'comment' || source === 'all') {
    const commentResults = await searchComments(queryVector, jobId, topK, minSimilarity, sentiment);
    results.push(...commentResults);
  }

  // 유사도순 정렬 후 topK로 제한
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

/**
 * 특정 문서와 유사한 문서 검색
 */
export async function findSimilarDocuments(
  options: SimilarDocumentOptions,
): Promise<SearchResult[]> {
  const { documentId, documentType, jobId, topK = 10, minSimilarity = 0.5 } = options;
  const db = getDb();

  // 원본 문서의 임베딩 조회
  const tableName = documentType === 'article' ? 'articles' : 'comments';
  const embeddingRow = await db.execute(sql`
    SELECT embedding FROM ${sql.raw(tableName)} WHERE id = ${documentId}
  `);

  if (!embeddingRow.rows[0]?.embedding) {
    return [];
  }

  const embedding = embeddingRow.rows[0].embedding;
  const vectorStr =
    typeof embedding === 'string' ? embedding : `[${(embedding as number[]).join(',')}]`;

  const results: SearchResult[] = [];

  if (documentType === 'article') {
    const articleResults = await searchArticles(vectorStr, jobId, topK, minSimilarity);
    results.push(...articleResults.filter((r) => r.id !== documentId));
  } else {
    const commentResults = await searchComments(vectorStr, jobId, topK, minSimilarity);
    results.push(...commentResults.filter((r) => r.id !== documentId));
  }

  return results.slice(0, topK);
}

// ─── 내부 함수 ────────────────────────────────────────────────────

async function searchArticles(
  queryVector: string,
  jobId: number | undefined,
  topK: number,
  minSimilarity: number,
  sentiment?: string,
): Promise<SearchResult[]> {
  const db = getDb();

  const jobCondition = jobId
    ? sql`INNER JOIN article_jobs aj ON a.id = aj.article_id AND aj.job_id = ${jobId}`
    : sql``;

  const sentimentCondition = sentiment ? sql`AND a.sentiment = ${sentiment}` : sql``;

  const result = await db.execute(sql`
    SELECT a.id, a.title, a.content, a.source, a.publisher,
           a.sentiment, a.published_at,
           1 - (a.embedding <=> ${queryVector}::vector) AS similarity
    FROM articles a
    ${jobCondition}
    WHERE a.embedding IS NOT NULL
      ${sentimentCondition}
    ORDER BY a.embedding <=> ${queryVector}::vector
    LIMIT ${topK}
  `);

  return result.rows
    .filter((row: any) => parseFloat(row.similarity) >= minSimilarity)
    .map((row: any) => ({
      id: Number(row.id),
      type: 'article' as const,
      content: (row.content ?? '').slice(0, 300),
      title: row.title as string,
      source: row.source as string,
      publisher: row.publisher as string | undefined,
      similarity: parseFloat(row.similarity),
      sentiment: row.sentiment as string | undefined,
      publishedAt: row.published_at as Date | null,
    }));
}

async function searchComments(
  queryVector: string,
  jobId: number | undefined,
  topK: number,
  minSimilarity: number,
  sentiment?: string,
): Promise<SearchResult[]> {
  const db = getDb();

  const jobCondition = jobId
    ? sql`INNER JOIN comment_jobs cj ON c.id = cj.comment_id AND cj.job_id = ${jobId}`
    : sql``;

  const sentimentCondition = sentiment ? sql`AND c.sentiment = ${sentiment}` : sql``;

  const result = await db.execute(sql`
    SELECT c.id, c.content, c.source, c.sentiment, c.like_count, c.published_at,
           1 - (c.embedding <=> ${queryVector}::vector) AS similarity
    FROM comments c
    ${jobCondition}
    WHERE c.embedding IS NOT NULL
      ${sentimentCondition}
    ORDER BY c.embedding <=> ${queryVector}::vector
    LIMIT ${topK}
  `);

  return result.rows
    .filter((row: any) => parseFloat(row.similarity) >= minSimilarity)
    .map((row: any) => ({
      id: Number(row.id),
      type: 'comment' as const,
      content: row.content as string,
      source: row.source as string,
      similarity: parseFloat(row.similarity),
      sentiment: row.sentiment as string | undefined,
      likeCount: row.like_count as number | undefined,
      publishedAt: row.published_at as Date | null,
    }));
}

// ─── 유틸리티 ─────────────────────────────────────────────────────

/**
 * Job에 임베딩이 있는 기사/댓글 수 조회 (검색 가능 여부 확인용)
 */
export async function getEmbeddingStats(jobId: number): Promise<{
  articlesWithEmbedding: number;
  commentsWithEmbedding: number;
}> {
  const db = getDb();

  const articleStat = await db.execute(sql`
    SELECT count(*) as cnt FROM articles a
    INNER JOIN article_jobs aj ON a.id = aj.article_id
    WHERE aj.job_id = ${jobId} AND a.embedding IS NOT NULL
  `);

  const commentStat = await db.execute(sql`
    SELECT count(*) as cnt FROM comments c
    INNER JOIN comment_jobs cj ON c.id = cj.comment_id
    WHERE cj.job_id = ${jobId} AND c.embedding IS NOT NULL
  `);

  return {
    articlesWithEmbedding: Number(articleStat.rows[0]?.cnt ?? 0),
    commentsWithEmbedding: Number(commentStat.rows[0]?.cnt ?? 0),
  };
}
