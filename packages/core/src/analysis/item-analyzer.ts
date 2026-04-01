// 개별 기사/댓글 감정 분석 (하이브리드: 경량 모델 1차 + LLM 2차)
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { analyzeStructured } from '@ai-signalcraft/ai-gateway';
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
import { getModuleModelConfig } from './model-config';
import { getConcurrencyConfig } from './concurrency-config';
import { classifySentiment, isAmbiguous, initClassifier } from './sentiment-classifier';

// item-analysis 모듈은 Stage 1과 동일하게 gpt-4o-mini 사용 (비용 최적화)
const ITEM_ANALYSIS_MODULE = 'sentiment-framing';

// --- Zod 스키마 ---

const ArticleItemResultSchema = z.object({
  items: z.array(
    z.object({
      index: z.number(),
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      sentimentScore: z.number().describe('감정 점수 0~1'),
      summary: z.string(),
    }),
  ),
});

const CommentItemResultSchema = z.object({
  items: z.array(
    z.object({
      index: z.number(),
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      sentimentScore: z.number().describe('감정 점수 0~1'),
    }),
  ),
});

// --- 프롬프트 ---

function buildArticleBatchPrompt(
  keyword: string,
  batch: Array<{ id: number; title: string; content: string | null }>,
): string {
  const itemList = batch
    .map((a, i) => `[${i}] 제목: ${a.title}\n    본문: ${(a.content ?? '').slice(0, 300)}`)
    .join('\n\n');

  return `아래 뉴스 기사들을 "${keyword}" 관점에서 개별 감정 분석하세요.

각 기사에 대해:
- sentiment: 이 키워드에 대한 기사의 논조 (positive/negative/neutral)
- sentimentScore: 확신도 (0.0~1.0, 1.0이 가장 확실)
- summary: 핵심 내용 한 줄 요약 (30자 이내)

### 기사 목록 (${batch.length}건)
${itemList}

index 필드는 위의 [번호]와 일치시키세요.`;
}

function buildCommentBatchPrompt(
  keyword: string,
  batch: Array<{ id: number; content: string }>,
): string {
  const itemList = batch.map((c, i) => `[${i}] ${c.content.slice(0, 200)}`).join('\n');

  return `아래 댓글들을 "${keyword}" 관점에서 개별 감정 분석하세요.

각 댓글에 대해:
- sentiment: 이 키워드에 대한 감정 (positive/negative/neutral)
- sentimentScore: 확신도 (0.0~1.0)

### 댓글 목록 (${batch.length}건)
${itemList}

index 필드는 위의 [번호]와 일치시키세요.`;
}

const SYSTEM_PROMPT = `당신은 한국 여론 분석 전문가입니다.
주어진 텍스트의 감정을 정확히 판별합니다.
- positive: 해당 키워드에 호의적, 지지, 긍정적 평가
- negative: 비판, 반대, 부정적 평가
- neutral: 사실 전달, 중립적 보도, 판단 유보
sentimentScore는 판별의 확신도입니다. 명확한 감정이면 0.8 이상, 애매하면 0.5 근처로 설정하세요.`;

// --- 배치 유틸 ---

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/** Rate limit 에러 감지 */
function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('Rate limit') || msg.includes('429') || msg.includes('TPM') || msg.includes('RPM')
  );
}

/** Rate limit 에러에서 대기 시간 추출 (초) */
function parseRetryAfter(error: unknown): number {
  const msg = error instanceof Error ? error.message : String(error);
  const match = msg.match(/try again in ([\d.]+)s/i);
  return match ? Math.ceil(parseFloat(match[1])) : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rate limit 재시도 래퍼
 */
async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error) && attempt < maxRetries) {
        const retryAfterSec = parseRetryAfter(error);
        const backoffMs = Math.max(retryAfterSec * 1000, (attempt + 1) * 5000);
        console.log(
          `[item-analyzer] ${label}: rate limit, ${backoffMs}ms 후 재시도 (${attempt + 1}/${maxRetries})`,
        );
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * 동시성 제한 병렬 실행
 */
async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((item, batchIdx) => fn(item, i + batchIdx)),
    );
    results.push(...batchResults);
  }
  return results;
}

// --- 메인 함수 ---

/**
 * 개별 기사/댓글 감정 분석 실행 (하이브리드)
 * 1차: @xenova/transformers 경량 모델로 전체 빠른 분류
 * 2차: 애매한 건만 LLM으로 재분석
 */
export async function analyzeItems(jobId: number): Promise<{
  articlesAnalyzed: number;
  commentsAnalyzed: number;
  totalTokens: number;
}> {
  const cc = await getConcurrencyConfig();
  const COMMENT_BATCH_SIZE = cc.commentBatchSize;
  const ARTICLE_BATCH_SIZE = cc.articleBatchSize;
  const API_CONCURRENCY = cc.apiConcurrency;

  const db = getDb();
  const config = await getModuleModelConfig(ITEM_ANALYSIS_MODULE);
  let totalTokens = 0;

  // 키워드 조회
  const [job] = await db
    .select({ keyword: collectionJobs.keyword })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);

  if (!job) throw new Error(`Job not found: ${jobId}`);

  // 취소 확인
  if (await isPipelineCancelled(jobId)) {
    console.log(`[item-analyzer] 취소 감지, 스킵`);
    return { articlesAnalyzed: 0, commentsAnalyzed: 0, totalTokens: 0 };
  }

  // --- 경량 모델 초기화 ---
  await initClassifier();

  // --- 기사 로드 ---
  const articleRows = await db
    .select({ id: articles.id, title: articles.title, content: articles.content })
    .from(articles)
    .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
    .where(eq(articleJobs.jobId, jobId));

  // --- 댓글 로드 ---
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
      ambiguousCount: 0,
    },
  });

  // =============================================
  // Phase 1: 경량 모델로 기사 1차 분류
  // =============================================
  let articlesAnalyzed = 0;
  const articleAmbiguous: typeof articleRows = [];

  if (articlesTotal > 0) {
    console.log(`[item-analyzer] 기사 1차 경량 분류 시작: ${articlesTotal}건`);
    const articleTexts = articleRows.map((a) => `${a.title} ${(a.content ?? '').slice(0, 150)}`);
    const articleResults = await classifySentiment(articleTexts);

    // 확실한 건 DB 저장, 애매한 건 분리
    for (let i = 0; i < articleRows.length; i++) {
      const result = articleResults[i];
      if (isAmbiguous(result.score)) {
        articleAmbiguous.push(articleRows[i]);
      } else {
        await db
          .update(articles)
          .set({
            sentiment: result.label,
            sentimentScore: result.score,
          })
          .where(eq(articles.id, articleRows[i].id));
        articlesAnalyzed++;
      }
    }

    console.log(
      `[item-analyzer] 기사 1차 완료: ${articlesAnalyzed}건 확정, ${articleAmbiguous.length}건 LLM 재분석 대기`,
    );
  }

  // =============================================
  // Phase 1: 경량 모델로 댓글 1차 분류
  // =============================================
  let commentsAnalyzed = 0;
  const commentAmbiguous: typeof commentRows = [];

  if (commentsTotal > 0) {
    console.log(`[item-analyzer] 댓글 1차 경량 분류 시작: ${commentsTotal}건`);
    const commentTexts = commentRows.map((c) => c.content);
    const commentResults = await classifySentiment(commentTexts);

    for (let i = 0; i < commentRows.length; i++) {
      const result = commentResults[i];
      if (isAmbiguous(result.score)) {
        commentAmbiguous.push(commentRows[i]);
      } else {
        await db
          .update(comments)
          .set({
            sentiment: result.label,
            sentimentScore: result.score,
          })
          .where(eq(comments.id, commentRows[i].id));
        commentsAnalyzed++;
      }
    }

    console.log(
      `[item-analyzer] 댓글 1차 완료: ${commentsAnalyzed}건 확정, ${commentAmbiguous.length}건 LLM 재분석 대기`,
    );
  }

  const totalAmbiguous = articleAmbiguous.length + commentAmbiguous.length;
  await appendJobEvent(
    jobId,
    'info',
    `1차 경량 분류 완료 (${articlesAnalyzed + commentsAnalyzed}건 확정, ${totalAmbiguous}건 LLM 재분석 대기)`,
  );

  await updateJobProgress(jobId, {
    'item-analysis': {
      status: 'running',
      phase: totalAmbiguous > 0 ? 'llm-reanalysis' : 'completed',
      articlesTotal,
      commentsTotal,
      articlesAnalyzed,
      commentsAnalyzed,
      ambiguousCount: totalAmbiguous,
    },
  });

  // 취소 확인 (LLM 재분석 전)
  if (await isPipelineCancelled(jobId)) {
    console.log(`[item-analyzer] 취소 감지 (1차 분류 후), LLM 재분석 스킵`);
    await updateJobProgress(jobId, {
      'item-analysis': {
        status: 'completed',
        phase: 'completed',
        articlesTotal,
        commentsTotal,
        articlesAnalyzed,
        commentsAnalyzed,
        ambiguousCount: totalAmbiguous,
      },
    });
    return { articlesAnalyzed, commentsAnalyzed, totalTokens };
  }

  // =============================================
  // Phase 2: 애매한 기사만 LLM 재분석
  // =============================================
  if (articleAmbiguous.length > 0) {
    const batches = chunk(articleAmbiguous, ARTICLE_BATCH_SIZE);
    console.log(
      `[item-analyzer] 기사 LLM 재분석 시작: ${articleAmbiguous.length}건, ${batches.length}배치`,
    );

    const results = await runWithConcurrency(
      batches,
      async (batch, batchIdx) => {
        if (await isPipelineCancelled(jobId)) throw new Error('사용자에 의해 중지됨');
        const result = await withRateLimitRetry(
          () =>
            analyzeStructured(
              buildArticleBatchPrompt(job.keyword, batch),
              ArticleItemResultSchema,
              {
                provider: config.provider,
                model: config.model,
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                systemPrompt: SYSTEM_PROMPT,
                maxOutputTokens: 4096,
              },
            ),
          `기사 LLM 배치 ${batchIdx + 1}/${batches.length}`,
        );

        let batchAnalyzed = 0;
        for (const item of result.object.items) {
          const article = batch[item.index];
          if (!article) continue;
          await db
            .update(articles)
            .set({
              sentiment: item.sentiment,
              sentimentScore: item.sentimentScore,
              summary: item.summary,
            })
            .where(eq(articles.id, article.id));
          batchAnalyzed++;
        }

        return {
          tokens: (result.usage as any)?.totalTokens ?? 0,
          analyzed: batchAnalyzed,
        };
      },
      API_CONCURRENCY,
    );

    for (const settled of results) {
      if (settled.status === 'fulfilled') {
        totalTokens += settled.value.tokens;
        articlesAnalyzed += settled.value.analyzed;
      } else {
        console.error(`[item-analyzer] 기사 LLM 배치 실패:`, settled.reason);
      }
    }
  }

  // =============================================
  // Phase 2: 애매한 댓글만 LLM 재분석
  // =============================================
  if (commentAmbiguous.length > 0) {
    const batches = chunk(commentAmbiguous, COMMENT_BATCH_SIZE);
    console.log(
      `[item-analyzer] 댓글 LLM 재분석 시작: ${commentAmbiguous.length}건, ${batches.length}배치`,
    );

    const results = await runWithConcurrency(
      batches,
      async (batch, batchIdx) => {
        if (await isPipelineCancelled(jobId)) throw new Error('사용자에 의해 중지됨');
        const result = await withRateLimitRetry(
          () =>
            analyzeStructured(
              buildCommentBatchPrompt(job.keyword, batch),
              CommentItemResultSchema,
              {
                provider: config.provider,
                model: config.model,
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                systemPrompt: SYSTEM_PROMPT,
                maxOutputTokens: 4096,
              },
            ),
          `댓글 LLM 배치 ${batchIdx + 1}/${batches.length}`,
        );

        let batchAnalyzed = 0;
        for (const item of result.object.items) {
          const comment = batch[item.index];
          if (!comment) continue;
          await db
            .update(comments)
            .set({
              sentiment: item.sentiment,
              sentimentScore: item.sentimentScore,
            })
            .where(eq(comments.id, comment.id));
          batchAnalyzed++;
        }

        return {
          tokens: (result.usage as any)?.totalTokens ?? 0,
          analyzed: batchAnalyzed,
        };
      },
      API_CONCURRENCY,
    );

    for (const settled of results) {
      if (settled.status === 'fulfilled') {
        totalTokens += settled.value.tokens;
        commentsAnalyzed += settled.value.analyzed;
      } else {
        console.error(`[item-analyzer] 댓글 LLM 배치 실패:`, settled.reason);
      }
    }
  }

  // --- 완료 ---
  await updateJobProgress(jobId, {
    'item-analysis': {
      status: 'completed',
      phase: 'completed',
      articlesTotal,
      commentsTotal,
      articlesAnalyzed,
      commentsAnalyzed,
      ambiguousCount: totalAmbiguous,
    },
  });

  const llmReanalyzed = totalAmbiguous;
  const lightweightClassified = articlesAnalyzed + commentsAnalyzed - llmReanalyzed;
  await appendJobEvent(
    jobId,
    'info',
    `개별 감정 분석 완료 (경량 ${lightweightClassified}건 + LLM ${llmReanalyzed}건, 토큰 ${totalTokens})`,
  );

  console.log(
    `[item-analyzer] 완료: 기사 ${articlesAnalyzed}건, 댓글 ${commentsAnalyzed}건, LLM 재분석 ${totalAmbiguous}건, 토큰 ${totalTokens}`,
  );
  return { articlesAnalyzed, commentsAnalyzed, totalTokens };
}
