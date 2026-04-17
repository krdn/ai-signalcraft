// 개별 기사/댓글 감정 분석 (경량 BERT 모델 단일 패스)
import { eq } from 'drizzle-orm';
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
import { classifySentiment, initClassifier } from './sentiment-classifier';

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

  // 기사 로드
  const articleRows = await db
    .select({ id: articles.id, title: articles.title, content: articles.content })
    .from(articles)
    .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
    .where(eq(articleJobs.jobId, jobId));

  // 댓글 로드
  const commentRows = await db
    .select({ id: comments.id, content: comments.content })
    .from(comments)
    .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
    .where(eq(commentJobs.jobId, jobId));

  const articlesTotal = articleRows.length;
  const commentsTotal = commentRows.length;

  await appendJobEvent(
    jobId,
    'info',
    `개별 감정 분석 시작 (기사 ${articlesTotal}건, 댓글 ${commentsTotal}건)`,
  );

  await updateJobProgress(jobId, {
    'item-analysis': {
      status: 'running',
      phase: 'lightweight',
      articlesTotal,
      commentsTotal,
      articlesAnalyzed: 0,
      commentsAnalyzed: 0,
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
      const results = await classifySentiment(texts);

      await Promise.all(
        chunk.map((row, i) =>
          db
            .update(articles)
            .set({ sentiment: results[i].label, sentimentScore: results[i].score })
            .where(eq(articles.id, row.id)),
        ),
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
      const results = await classifySentiment(texts);

      await Promise.all(
        chunk.map((row, i) =>
          db
            .update(comments)
            .set({ sentiment: results[i].label, sentimentScore: results[i].score })
            .where(eq(comments.id, row.id)),
        ),
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
