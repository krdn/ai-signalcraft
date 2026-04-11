// 온톨로지 tRPC 라우터
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb, entities, relations } from '@ai-signalcraft/core';
import { protectedProcedure, router } from '../init';

export const ontologyRouter = router({
  // jobId별 엔티티 목록 조회
  getEntities: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        type: z.enum(['person', 'organization', 'issue', 'keyword', 'frame', 'claim']).optional(),
        limit: z.number().min(1).max(200).default(50),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [eq(entities.jobId, input.jobId)];
      if (input.type) {
        conditions.push(eq(entities.type, input.type));
      }

      const rows = await db
        .select()
        .from(entities)
        .where(and(...conditions))
        .limit(input.limit);

      return rows;
    }),

  // jobId별 관계 목록 조회
  getRelations: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        type: z
          .enum(['supports', 'opposes', 'related', 'causes', 'cooccurs', 'threatens'])
          .optional(),
        limit: z.number().min(1).max(200).default(100),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [eq(relations.jobId, input.jobId)];
      if (input.type) {
        conditions.push(eq(relations.type, input.type));
      }

      const rows = await db
        .select({
          id: relations.id,
          sourceId: relations.sourceId,
          targetId: relations.targetId,
          type: relations.type,
          weight: relations.weight,
          evidence: relations.evidence,
        })
        .from(relations)
        .where(and(...conditions))
        .limit(input.limit);

      return rows;
    }),

  // 지식 그래프 데이터 (엔티티 + 관계를 GraphData 형식으로)
  getEntityGraph: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        entityType: z
          .enum(['person', 'organization', 'issue', 'keyword', 'frame', 'claim'])
          .optional(),
        minMentions: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();

      // 엔티티 조회
      const entityConditions = [eq(entities.jobId, input.jobId)];
      if (input.entityType) {
        entityConditions.push(eq(entities.type, input.entityType));
      }

      const entityRows = await db
        .select()
        .from(entities)
        .where(and(...entityConditions))
        .limit(input.limit);

      // mentionCount 필터
      const filtered = entityRows.filter((e) => e.mentionCount >= input.minMentions);
      const entityIds = new Set(filtered.map((e) => e.id));

      // 관련 관계 조회
      const relationRows = await db
        .select()
        .from(relations)
        .where(eq(relations.jobId, input.jobId));

      // GraphData 형식으로 변환
      const typeColors: Record<string, string> = {
        person: '#8b5cf6',
        organization: '#3b82f6',
        issue: '#ef4444',
        keyword: '#22c55e',
        frame: '#f59e0b',
        claim: '#06b6d4',
      };

      const nodes = filtered.map((e) => ({
        id: String(e.id),
        label: e.name,
        group: e.type,
        size: Math.max(e.mentionCount * 3, 8),
        color: typeColors[e.type] ?? '#71717a',
        metadata: e.metadata as Record<string, unknown> | null,
      }));

      const edges = relationRows
        .filter((r) => entityIds.has(r.sourceId) && entityIds.has(r.targetId))
        .map((r) => ({
          source: String(r.sourceId),
          target: String(r.targetId),
          weight: r.weight,
          type: r.type,
        }));

      return { nodes, edges };
    }),
});
