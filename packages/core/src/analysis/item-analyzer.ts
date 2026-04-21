// 개별 기사/댓글 감정 분석 (경량 BERT 모델 단일 패스, 증분)
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db';
import {
  articles,
  comments,
  collectionJobs,
  articleJobs,
  commentJobs,
} from '../db/schema/collections';
import { updateJobProgress, appendJobEvent } from '../pipeline/persist';
import { isPipelineCancelled } from '../pipeline/control';
import { classifySentiment, initClassifier, type SentimentResult } from './sentiment-classifier';
import { applySarcasmAdjustments } from './sarcasm-postprocess';
import { applyKoreanSentimentRulesAll } from './korean-sentiment-rules';

/**
 * N건의 감정 결과를 단일 UPDATE로 DB에 반영.
 * 256건 기준 ~8초 → ~300ms
 */
async function bulkUpdateSentiment(
  table: 'articles' | 'comments',
  rows: Array<{ id: number; result: SentimentResult }>,
): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb();

  // SQL injection 회피: label은 enum 화이트리스트, score는 숫자, id는 숫자
  const allowedLabels = new Set(['positive', 'negative', 'neutral']);
  const valuesSql = rows
    .map((r) => {
      const label = allowedLabels.has(r.result.label) ? r.result.label : 'neutral';
      const score = Number.isFinite(r.result.score) ? r.result.score : 0;
      const id = Number(r.id);
      if (!Number.isFinite(id)) throw new Error(`invalid id: ${r.id}`);
      return `(${id}, '${label}', ${score})`;
    })
    .join(',');

  await db.execute(
    sql.raw(`
    UPDATE ${table} AS t
    SET sentiment = v.sentiment,
        sentiment_score = v.score
    FROM (VALUES ${valuesSql}) AS v(id, sentiment, score)
    WHERE t.id = v.id
  `),
  );
}

/**
 * 개별 기사/댓글 감정 분석 실행 (경량 BERT 모델 단일 패스)
 * - @xenova/transformers 경량 모델로 전체 분류
 * - LLM 재분석 없이 모든 결과를 바로 DB에 저장
 */
export async function analyzeItems(jobId: number): Promise<{
  articlesAnalyzed: number;
  commentsAnalyzed: number;
}> {
  const db = getDb();

  // 키워드 조회
  const [job] = await db
    .select({ keyword: collectionJobs.keyword })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);

  if (!job) throw new Error(`Job not found: ${jobId}`);

  if (await isPipelineCancelled(jobId)) {
    console.log(`[item-analyzer] 취소 감지, 스킵`);
    return { articlesAnalyzed: 0, commentsAnalyzed: 0 };
  }

  // 경량 모델 초기화
  await initClassifier();

  // 기사/댓글 병렬 로드 — 증분: sentiment가 아직 NULL인 row만
  const { articleQuery, commentQuery } = buildItemAnalysisQueries(jobId);
  const [articleRows, commentRows, articlesSkipped, commentsSkipped] = await Promise.all([
    articleQuery,
    commentQuery,
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(articles)
      .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
      .where(and(eq(articleJobs.jobId, jobId), sql`${articles.sentiment} IS NOT NULL`))
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
      .where(and(eq(commentJobs.jobId, jobId), sql`${comments.sentiment} IS NOT NULL`))
      .then((rows) => rows[0]?.count ?? 0),
  ]);

  const articlesTotal = articleRows.length + articlesSkipped;
  const commentsTotal = commentRows.length + commentsSkipped;

  await appendJobEvent(
    jobId,
    'info',
    `개별 감정 분석 시작 (신규: 기사 ${articleRows.length}건, 댓글 ${commentRows.length}건 | 이미 분류됨: 기사 ${articlesSkipped}건, 댓글 ${commentsSkipped}건)`,
  );

  await updateJobProgress(jobId, {
    'item-analysis': {
      status: 'running',
      phase: 'lightweight',
      articlesTotal,
      commentsTotal,
      articlesAnalyzed: 0,
      commentsAnalyzed: 0,
      articlesSkipped,
      commentsSkipped,
    },
  });

  const CHUNK_SIZE = 256;

  // --- 기사 분류 (청크 단위: 분류 → 즉시 DB 저장 → progress) ---
  let articlesAnalyzed = 0;

  if (articlesTotal > 0) {
    console.log(`[item-analyzer] 기사 경량 분류 시작: ${articlesTotal}건`);

    for (let c = 0; c < articleRows.length; c += CHUNK_SIZE) {
      const chunk = articleRows.slice(c, c + CHUNK_SIZE);
      const texts = chunk.map((a) => `${a.title} ${(a.content ?? '').slice(0, 150)}`);
      const rawResults = await classifySentiment(texts);
      // 한국어 패턴 보정 → 반어/조롱 마커 보정 순서로 적용
      const koreanAdjusted = applyKoreanSentimentRulesAll(texts, rawResults);
      const results = applySarcasmAdjustments(texts, koreanAdjusted);

      await bulkUpdateSentiment(
        'articles',
        chunk.map((row, i) => ({ id: row.id, result: results[i] })),
      );

      articlesAnalyzed += chunk.length;
      await updateJobProgress(jobId, {
        'item-analysis': {
          status: 'running',
          phase: 'lightweight',
          articlesTotal,
          commentsTotal,
          articlesAnalyzed,
          commentsAnalyzed: 0,
        },
      });
    }

    console.log(`[item-analyzer] 기사 분류 완료: ${articlesAnalyzed}건`);
  }

  // 취소 확인
  if (await isPipelineCancelled(jobId)) {
    console.log(`[item-analyzer] 취소 감지 (기사 분류 후)`);
    await updateJobProgress(jobId, {
      'item-analysis': {
        status: 'completed',
        phase: 'completed',
        articlesTotal,
        commentsTotal,
        articlesAnalyzed,
        commentsAnalyzed: 0,
      },
    });
    return { articlesAnalyzed, commentsAnalyzed: 0 };
  }

  // --- 댓글 분류 (청크 단위: 분류 → 즉시 DB 저장 → progress) ---
  let commentsAnalyzed = 0;

  if (commentsTotal > 0) {
    console.log(`[item-analyzer] 댓글 경량 분류 시작: ${commentsTotal}건`);

    for (let c = 0; c < commentRows.length; c += CHUNK_SIZE) {
      if (await isPipelineCancelled(jobId)) {
        console.log(`[item-analyzer] 취소 감지 (댓글 분류 중, ${commentsAnalyzed}건 완료)`);
        break;
      }

      const chunk = commentRows.slice(c, c + CHUNK_SIZE);
      const texts = chunk.map((r) => r.content);
      const rawResults = await classifySentiment(texts);
      // 한국어 패턴 보정 → 반어/조롱 마커 보정
      const koreanAdjusted = applyKoreanSentimentRulesAll(texts, rawResults);
      const results = applySarcasmAdjustments(texts, koreanAdjusted);

      await bulkUpdateSentiment(
        'comments',
        chunk.map((row, i) => ({ id: row.id, result: results[i] })),
      );

      commentsAnalyzed += chunk.length;
      await updateJobProgress(jobId, {
        'item-analysis': {
          status: 'running',
          phase: 'lightweight',
          articlesTotal,
          commentsTotal,
          articlesAnalyzed,
          commentsAnalyzed,
        },
      });
    }

    console.log(`[item-analyzer] 댓글 분류 완료: ${commentsAnalyzed}건`);
  }

  // 완료
  await updateJobProgress(jobId, {
    'item-analysis': {
      status: 'completed',
      phase: 'completed',
      articlesTotal,
      commentsTotal,
      articlesAnalyzed,
      commentsAnalyzed,
    },
  });

  await appendJobEvent(
    jobId,
    'info',
    `개별 감정 분석 완료 (기사 ${articlesAnalyzed}건, 댓글 ${commentsAnalyzed}건)`,
  );

  console.log(`[item-analyzer] 완료: 기사 ${articlesAnalyzed}건, 댓글 ${commentsAnalyzed}건`);
  return { articlesAnalyzed, commentsAnalyzed };
}

/**
 * analyzeItems의 증분 로드 쿼리를 별도 export — 테스트/재사용 용도.
 * sentiment가 아직 NULL인 row만 대상.
 */
export function buildItemAnalysisQueries(jobId: number) {
  const db = getDb();
  const articleQuery = db
    .select({ id: articles.id, title: articles.title, content: articles.content })
    .from(articles)
    .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
    .where(and(eq(articleJobs.jobId, jobId), isNull(articles.sentiment)));
  const commentQuery = db
    .select({ id: comments.id, content: comments.content })
    .from(comments)
    .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
    .where(and(eq(commentJobs.jobId, jobId), isNull(comments.sentiment)));
  return { articleQuery, commentQuery };
}
