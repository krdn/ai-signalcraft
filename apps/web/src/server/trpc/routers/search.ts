// 의미 검색 tRPC 라우터
import { z } from 'zod';
import {
  semanticSearch,
  findSimilarDocuments,
  getEmbeddingStats,
  getRelatedEntities,
  searchEntities,
} from '@ai-signalcraft/core';
import { protectedProcedure, router } from '../init';
import { verifyJobOwnership } from '../shared/verify-job-ownership';

export const searchRouter = router({
  // 의미 기반 문서 검색
  semantic: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        jobId: z.number().optional(),
        source: z.enum(['article', 'comment', 'all']).default('all'),
        topK: z.number().min(1).max(50).default(20),
        minSimilarity: z.number().min(0).max(1).default(0.4),
        sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.jobId) {
        await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);
      }
      return await semanticSearch(input);
    }),

  // 특정 문서와 유사한 문서 검색
  similarDocuments: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        documentType: z.enum(['article', 'comment']),
        jobId: z.number().optional(),
        topK: z.number().min(1).max(20).default(10),
        minSimilarity: z.number().min(0).max(1).default(0.5),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.jobId) {
        await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);
      }
      return await findSimilarDocuments(input);
    }),

  // Job의 임베딩 보유 현황 (검색 가능 여부)
  embeddingStats: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ ctx, input }) => {
      await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);
      return await getEmbeddingStats(input.jobId);
    }),

  // 엔티티 이름으로 검색
  searchEntities: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);
      return await searchEntities(input.jobId, input.query, input.limit);
    }),

  // 특정 엔티티의 관련 엔티티 조회
  relatedEntities: protectedProcedure
    .input(
      z.object({
        entityId: z.number(),
        topK: z.number().min(1).max(30).default(10),
      }),
    )
    .query(async ({ input }) => {
      return await getRelatedEntities(input.entityId, input.topK);
    }),
});
