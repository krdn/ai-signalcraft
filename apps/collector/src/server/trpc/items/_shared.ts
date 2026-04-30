// items 라우터 공통 — 타입/상수/헬퍼.
//
// 메인 라우터 분해 시 procedure 파일들이 공유하는 enum, schema, 헬퍼.
// SOURCE_ENUM은 web의 lib/collector-sources.ts와 정합되어야 한다.

import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { rawItems } from '../../../db/schema';

export const SOURCE_ENUM = [
  'naver-news',
  'naver-comments',
  'youtube',
  'dcinside',
  'fmkorea',
  'clien',
] as const;

export const ITEM_TYPE_ENUM = ['article', 'video', 'comment'] as const;

export const dateRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

/**
 * scope:
 *   - all: 기사+영상+댓글 혼재(ORDER BY time DESC, cursor=fetchedAt). 분석 파이프라인 기본값.
 *   - feed: 기사/영상만(ORDER BY COALESCE(published_at, time) DESC). 뷰어 피드 전용.
 *   - comments-for-parent: 특정 parent(source,sourceId)의 댓글만(ORDER BY time ASC). 뷰어 상세 패널.
 *     parent.source='naver-news'일 때 source 조건을 'naver-comments'로 치환한다.
 */
export const queryInput = z.object({
  keyword: z.string().trim().min(1).optional(),
  dateRange: dateRangeSchema,
  sources: z.array(z.enum(SOURCE_ENUM)).optional(),
  itemTypes: z.array(z.enum(ITEM_TYPE_ENUM)).optional(),
  subscriptionId: z.number().int().positive().optional(),
  mode: z.enum(['all', 'rag', 'head']).default('all'),
  scope: z.enum(['all', 'feed', 'comments-for-parent']).default('all'),
  parent: z
    .object({
      source: z.enum(SOURCE_ENUM),
      sourceId: z.string().min(1),
    })
    .optional(),
  ragOptions: z
    .object({
      topK: z.number().int().min(1).max(500).default(50),
      semanticQuery: z.string().min(1),
    })
    .optional(),
  cursor: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(10000).default(500),
  maxContentLength: z.number().int().positive().optional(),
  maxComments: z.number().int().nonnegative().optional(),
  includeEmbeddings: z.boolean().default(false),
});

export const fetchAnalysisPayloadInput = z.object({
  keyword: z.string().trim().min(1),
  dateRange: dateRangeSchema,
  sources: z.array(z.enum(SOURCE_ENUM)).optional(),
  subscriptionId: z.number().int().positive().optional(),
  ragOptions: z
    .object({
      // 각 필드를 독립 optional로 — rag-light처럼 기사는 전체 유지(articleVideoTopK 미지정),
      // 댓글만 RAG 필터(commentTopK 지정)하는 케이스를 지원한다.
      articleVideoTopK: z.number().int().min(1).max(1500).optional(),
      commentTopK: z.number().int().min(1).max(1500).optional(),
    })
    .optional(),
  maxContentLength: z.number().int().positive().optional(),
});

export function selectColumnsFor(t: typeof rawItems) {
  return {
    time: t.time,
    subscriptionId: t.subscriptionId,
    source: t.source,
    sourceId: t.sourceId,
    itemType: t.itemType,
    url: t.url,
    title: t.title,
    content: t.content,
    author: t.author,
    publisher: t.publisher,
    publishedAt: t.publishedAt,
    parentSourceId: t.parentSourceId,
    metrics: t.metrics,
    sentiment: t.sentiment,
    sentimentScore: t.sentimentScore,
    fetchedAt: t.fetchedAt,
    transcript: sql<string | null>`${t.rawPayload}->>'transcript'`.as('transcript'),
    transcriptLang: sql<string | null>`${t.rawPayload}->>'transcriptLang'`.as('transcript_lang'),
    durationSec: sql<number | null>`NULLIF(${t.rawPayload}->>'durationSec', '')::int`.as(
      'duration_sec',
    ),
  };
}
