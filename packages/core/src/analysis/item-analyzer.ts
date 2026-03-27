// 개별 기사/댓글 감정 분석 (배치 처리)
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { analyzeStructured } from '@ai-signalcraft/ai-gateway';
import { getDb } from '../db';
import { articles, comments, collectionJobs, articleJobs, commentJobs } from '../db/schema/collections';
import { getModuleModelConfig } from './model-config';
import { MODULE_MODEL_MAP } from './types';

// item-analysis 모듈은 Stage 1과 동일하게 gpt-4o-mini 사용 (비용 최적화)
const ITEM_ANALYSIS_MODULE = 'sentiment-framing';

// 배치 크기
const ARTICLE_BATCH_SIZE = 10;
const COMMENT_BATCH_SIZE = 50;

// --- Zod 스키마 ---

const ArticleItemResultSchema = z.object({
  items: z.array(z.object({
    index: z.number(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    sentimentScore: z.number().min(0).max(1),
    summary: z.string(),
  })),
});

const CommentItemResultSchema = z.object({
  items: z.array(z.object({
    index: z.number(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    sentimentScore: z.number().min(0).max(1),
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

  for (const batch of articleBatches) {
    try {
      const result = await analyzeStructured(
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
      );

      totalTokens += (result.usage as any)?.totalTokens ?? 0;

      // DB 업데이트
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
        articlesAnalyzed++;
      }
    } catch (error) {
      console.error(`[item-analyzer] 기사 배치 분석 실패:`, error);
      // 배치 실패 시 계속 진행 (부분 실패 허용)
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

  for (const batch of commentBatches) {
    try {
      const result = await analyzeStructured(
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
      );

      totalTokens += (result.usage as any)?.totalTokens ?? 0;

      for (const item of result.object.items) {
        const comment = batch[item.index];
        if (!comment) continue;
        await db.update(comments)
          .set({
            sentiment: item.sentiment,
            sentimentScore: item.sentimentScore,
          })
          .where(eq(comments.id, comment.id));
        commentsAnalyzed++;
      }
    } catch (error) {
      console.error(`[item-analyzer] 댓글 배치 분석 실패:`, error);
    }
  }

  console.log(`[item-analyzer] 완료: 기사 ${articlesAnalyzed}건, 댓글 ${commentsAnalyzed}건, 토큰 ${totalTokens}`);
  return { articlesAnalyzed, commentsAnalyzed, totalTokens };
}
