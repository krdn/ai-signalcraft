// 개별 기사/댓글 감정 분석 (배치 처리)
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { analyzeStructured } from '@ai-signalcraft/ai-gateway';
import { getDb } from '../db';
import { articles, comments, collectionJobs, articleJobs, commentJobs } from '../db/schema/collections';
import { getModuleModelConfig } from './model-config';
import { MODULE_MODEL_MAP } from './types';
import { getConcurrencyConfig } from './concurrency-config';

// item-analysis 모듈은 Stage 1과 동일하게 gpt-4o-mini 사용 (비용 최적화)
const ITEM_ANALYSIS_MODULE = 'sentiment-framing';

// --- Zod 스키마 ---

const ArticleItemResultSchema = z.object({
  items: z.array(z.object({
    index: z.number(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    sentimentScore: z.number().describe('감정 점수 0~1'),
    summary: z.string(),
  })),
});

const CommentItemResultSchema = z.object({
  items: z.array(z.object({
    index: z.number(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    sentimentScore: z.number().describe('감정 점수 0~1'),
  })),
});

// --- 프롬프트 ---

function buildArticleBatchPrompt(
  keyword: string,
  batch: Array<{ id: number; title: string; content: string | null }>,
): string {
  const itemList = batch.map((a, i) =>
    `[${i}] 제목: ${a.title}\n    본문: ${(a.content ?? '').slice(0, 300)}`
  ).join('\n\n');

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
  const itemList = batch.map((c, i) =>
    `[${i}] ${c.content.slice(0, 200)}`
  ).join('\n');

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
  return msg.includes('Rate limit') || msg.includes('429') || msg.includes('TPM') || msg.includes('RPM');
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
 * Rate limit 재시도 래퍼 — API 호출을 exponential backoff로 보호
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
        console.log(`[item-analyzer] ${label}: rate limit, ${backoffMs}ms 후 재시도 (${attempt + 1}/${maxRetries})`);
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * 동시성 제한 병렬 실행 — API_CONCURRENCY개씩 배치 처리
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
 * 개별 기사/댓글 감정 분석 실행
 * collectionJobs.options.enableItemAnalysis가 true일 때만 호출됨
 */
export async function analyzeItems(jobId: number): Promise<{
  articlesAnalyzed: number;
  commentsAnalyzed: number;
  totalTokens: number;
}> {
  // 병렬처리 설정 로드
  const cc = await getConcurrencyConfig();
  const ARTICLE_BATCH_SIZE = cc.articleBatchSize;
  const COMMENT_BATCH_SIZE = cc.commentBatchSize;
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

  // --- 기사 분석 --- (조인 테이블 경유)
  const articleRows = await db
    .select({
      id: articles.id,
      title: articles.title,
      content: articles.content,
    })
    .from(articles)
    .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
    .where(eq(articleJobs.jobId, jobId));

  let articlesAnalyzed = 0;
  const articleBatches = chunk(articleRows, ARTICLE_BATCH_SIZE);

  console.log(`[item-analyzer] 기사 분석 시작: ${articleRows.length}건, ${articleBatches.length}배치, 동시 ${API_CONCURRENCY}개`);

  const articleResults = await runWithConcurrency(
    articleBatches,
    async (batch, batchIdx) => {
      const result = await withRateLimitRetry(
        () => analyzeStructured(
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
        `기사 배치 ${batchIdx + 1}/${articleBatches.length}`,
      );

      // DB 업데이트 (배치 내 순차 — 가벼운 UPDATE이므로 병목 아님)
      let batchAnalyzed = 0;
      for (const item of result.object.items) {
        const article = batch[item.index];
        if (!article) continue;
        await db.update(articles)
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

  for (const settled of articleResults) {
    if (settled.status === 'fulfilled') {
      totalTokens += settled.value.tokens;
      articlesAnalyzed += settled.value.analyzed;
    } else {
      console.error(`[item-analyzer] 기사 배치 분석 실패:`, settled.reason);
    }
  }

  // --- 댓글 분석 --- (조인 테이블 경유)
  const commentRows = await db
    .select({
      id: comments.id,
      content: comments.content,
    })
    .from(comments)
    .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
    .where(eq(commentJobs.jobId, jobId));

  let commentsAnalyzed = 0;
  const commentBatches = chunk(commentRows, COMMENT_BATCH_SIZE);

  console.log(`[item-analyzer] 댓글 분석 시작: ${commentRows.length}건, ${commentBatches.length}배치, 동시 ${API_CONCURRENCY}개`);

  const commentResults = await runWithConcurrency(
    commentBatches,
    async (batch, batchIdx) => {
      const result = await withRateLimitRetry(
        () => analyzeStructured(
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
        `댓글 배치 ${batchIdx + 1}/${commentBatches.length}`,
      );

      let batchAnalyzed = 0;
      for (const item of result.object.items) {
        const comment = batch[item.index];
        if (!comment) continue;
        await db.update(comments)
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

  for (const settled of commentResults) {
    if (settled.status === 'fulfilled') {
      totalTokens += settled.value.tokens;
      commentsAnalyzed += settled.value.analyzed;
    } else {
      console.error(`[item-analyzer] 댓글 배치 분석 실패:`, settled.reason);
    }
  }

  console.log(`[item-analyzer] 완료: 기사 ${articlesAnalyzed}건, 댓글 ${commentsAnalyzed}건, 토큰 ${totalTokens}`);
  return { articlesAnalyzed, commentsAnalyzed, totalTokens };
}
