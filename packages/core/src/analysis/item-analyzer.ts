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

  // --- 기사 분류 ---
  let articlesAnalyzed = 0;

  if (articlesTotal > 0) {
    console.log(`[item-analyzer] 기사 경량 분류 시작: ${articlesTotal}건`);
    const articleTexts = articleRows.map((a) => `${a.title} ${(a.content ?? '').slice(0, 150)}`);
    const articleResults = await classifySentiment(articleTexts);

    // sentiment별 그룹화하여 배치 UPDATE
    const groups: Record<string, { ids: number[]; scores: Map<number, number> }> = {
      positive: { ids: [], scores: new Map() },
      negative: { ids: [], scores: new Map() },
      neutral: { ids: [], scores: new Map() },
    };

    for (let i = 0; i < articleRows.length; i++) {
      const result = articleResults[i];
      const group = groups[result.label];
      if (group) {
        group.ids.push(articleRows[i].id);
        group.scores.set(articleRows[i].id, result.score);
      }
    }

    // 배치 UPDATE (sentiment별로 한번에, score는 개별 UPDATE 필요)
    for (const [sentiment, group] of Object.entries(groups)) {
      if (group.ids.length === 0) continue;
      // score가 개별적이므로 Promise.all로 병렬 처리
      await Promise.all(
        group.ids.map((id) =>
          db
            .update(articles)
            .set({
              sentiment,
              sentimentScore: group.scores.get(id) ?? 0,
            })
            .where(eq(articles.id, id)),
        ),
      );
      articlesAnalyzed += group.ids.length;
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

  // --- 댓글 분류 ---
  let commentsAnalyzed = 0;

  if (commentsTotal > 0) {
    console.log(`[item-analyzer] 댓글 경량 분류 시작: ${commentsTotal}건`);
    const commentTexts = commentRows.map((c) => c.content);
    const commentResults = await classifySentiment(commentTexts);

    // sentiment별 그룹화
    const groups: Record<string, { ids: number[]; scores: Map<number, number> }> = {
      positive: { ids: [], scores: new Map() },
      negative: { ids: [], scores: new Map() },
      neutral: { ids: [], scores: new Map() },
    };

    for (let i = 0; i < commentRows.length; i++) {
      const result = commentResults[i];
      const group = groups[result.label];
      if (group) {
        group.ids.push(commentRows[i].id);
        group.scores.set(commentRows[i].id, result.score);
      }
    }

    for (const [sentiment, group] of Object.entries(groups)) {
      if (group.ids.length === 0) continue;
      await Promise.all(
        group.ids.map((id) =>
          db
            .update(comments)
            .set({
              sentiment,
              sentimentScore: group.scores.get(id) ?? 0,
            })
            .where(eq(comments.id, id)),
        ),
      );
      commentsAnalyzed += group.ids.length;
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
