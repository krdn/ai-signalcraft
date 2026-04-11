// RAG(Retrieval-Augmented Generation) 기반 프롬프트 최적화
// DB에 이미 저장된 pgvector 임베딩을 활용하여 키워드 관련성 높은 문서만 선별
// 매번 임베딩을 재계산하는 기존 deduplicator/clusterer와 달리 DB 임베딩을 직접 활용
import { sql } from 'drizzle-orm';
import type { AnalysisInput } from '../types';
import { getDb } from '../../db';
import { embedTexts } from './embeddings';

// RAG 모드별 설정
interface RAGConfig {
  articleTopK: number; // 의미 관련 기사 상위 N개 (0 = 전체 유지)
  clusterRepresentatives: number; // 클러스터 대표 기사 N개
  commentTopK: number; // 의미 관련 댓글 상위 N개 (0 = 전체 유지)
  minSimilarity: number; // 최소 유사도 (이하면 제외)
}

export const RAG_CONFIGS: Record<string, RAGConfig> = {
  'rag-light': {
    articleTopK: 0,
    clusterRepresentatives: 0,
    commentTopK: 50,
    minSimilarity: 0.3,
  },
  'rag-standard': {
    articleTopK: 30,
    clusterRepresentatives: 10,
    commentTopK: 30,
    minSimilarity: 0.35,
  },
  'rag-aggressive': {
    articleTopK: 15,
    clusterRepresentatives: 5,
    commentTopK: 15,
    minSimilarity: 0.4,
  },
};

export interface RAGStats {
  originalArticles: number;
  selectedArticles: number;
  originalComments: number;
  selectedComments: number;
  reductionPercent: number;
}

interface RAGResult {
  articles: AnalysisInput['articles'];
  comments: AnalysisInput['comments'];
  stats: RAGStats;
}

/**
 * 키워드 임베딩으로 유사도 기반 문서 검색
 * DB의 embedding 컬럼을 직접 활용하여 재계산 불필요
 */
export async function ragRetrieve(
  input: AnalysisInput,
  mode: 'rag-light' | 'rag-standard' | 'rag-aggressive',
): Promise<RAGResult> {
  const config = RAG_CONFIGS[mode];
  const jobId = input.jobId;
  const db = getDb();

  const originalArticles = input.articles.length;
  const originalComments = input.comments.length;

  // 키워드 임베딩 생성
  const [queryEmbedding] = await embedTexts([input.keyword]);
  const queryVector = `[${queryEmbedding.join(',')}]`;

  // ─── 기사: pgvector 코사인 유사도로 정렬 ──────────────────────
  let selectedArticles = input.articles;

  if (config.articleTopK > 0) {
    // 1차: 유사도 상위 기사 조회
    const rankedResult = await db.execute(sql`
      SELECT a.id, a.title, a.content, a.publisher, a.published_at, a.source,
             1 - (a.embedding <=> ${queryVector}::vector) AS similarity
      FROM articles a
      INNER JOIN article_jobs aj ON a.id = aj.article_id
      WHERE aj.job_id = ${jobId}
        AND a.embedding IS NOT NULL
      ORDER BY a.embedding <=> ${queryVector}::vector
      LIMIT ${config.articleTopK + config.clusterRepresentatives}
    `);

    // 유사도 필터 적용
    const filteredRows = rankedResult.rows.filter(
      (row: any) => parseFloat(row.similarity) >= config.minSimilarity,
    );

    let articleRows = filteredRows.slice(0, config.articleTopK);

    // 2차: 클러스터 대표 기사 추가 (다양성 확보)
    if (config.clusterRepresentatives > 0 && filteredRows.length > 0) {
      const excludeIds = filteredRows.map((r: any) => Number(r.id));
      const idList = excludeIds.length > 0 ? excludeIds.join(',') : '0';

      const additionalResult = await db.execute(sql`
        SELECT a.id, a.title, a.content, a.publisher, a.published_at, a.source,
               1 - (a.embedding <=> ${queryVector}::vector) AS similarity
        FROM articles a
        INNER JOIN article_jobs aj ON a.id = aj.article_id
        WHERE aj.job_id = ${jobId}
          AND a.embedding IS NOT NULL
          AND a.id NOT IN (${sql.raw(idList)})
        ORDER BY a.embedding <=> ${queryVector}::vector
        LIMIT ${config.clusterRepresentatives}
      `);

      articleRows = [...articleRows, ...additionalResult.rows];
    }

    // AnalysisInput 형식으로 변환
    selectedArticles = articleRows.map((row: any) => ({
      title: row.title as string,
      content: row.content ? String(row.content).slice(0, 500) : null,
      publisher: row.publisher as string | null,
      publishedAt: row.published_at as Date | null,
      source: row.source as string,
    }));
  }

  // ─── 댓글: pgvector 코사인 유사도로 정렬 ──────────────────────
  let selectedComments = input.comments;

  if (config.commentTopK > 0) {
    const rankedCommentResult = await db.execute(sql`
      SELECT c.content, c.source, c.author, c.like_count, c.dislike_count, c.published_at,
             1 - (c.embedding <=> ${queryVector}::vector) AS similarity
      FROM comments c
      INNER JOIN comment_jobs cj ON c.id = cj.comment_id
      WHERE cj.job_id = ${jobId}
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${queryVector}::vector
      LIMIT ${config.commentTopK}
    `);

    selectedComments = rankedCommentResult.rows
      .filter((row: any) => parseFloat(row.similarity) >= config.minSimilarity)
      .map((row: any) => ({
        content: row.content as string,
        source: row.source as string,
        author: row.author as string | null,
        likeCount: row.like_count as number | null,
        dislikeCount: row.dislike_count as number | null,
        publishedAt: row.published_at as Date | null,
      }));
  }

  // 통계 계산
  const totalOriginal = originalArticles + originalComments;
  const totalSelected = selectedArticles.length + selectedComments.length;
  const reductionPercent =
    totalOriginal > 0 ? Math.round(((totalOriginal - totalSelected) / totalOriginal) * 100) : 0;

  return {
    articles: selectedArticles,
    comments: selectedComments,
    stats: {
      originalArticles,
      selectedArticles: selectedArticles.length,
      originalComments,
      selectedComments: selectedComments.length,
      reductionPercent,
    },
  };
}

/**
 * 주어진 프리셋이 RAG 모드인지 확인
 */
export function isRAGPreset(
  preset: string,
): preset is 'rag-light' | 'rag-standard' | 'rag-aggressive' {
  return preset in RAG_CONFIGS;
}
