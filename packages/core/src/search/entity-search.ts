// 엔티티 기반 검색 — 온톨로지 엔티티를 활용한 문서 검색 및 관련 엔티티 조회
import { sql, eq, and, desc } from 'drizzle-orm';
import { getDb } from '../db';
import { entities, relations } from '../db/schema/ontology';

export interface EntitySearchResult {
  entityId: number;
  entityName: string;
  entityType: string;
  relatedEntities: Array<{
    id: number;
    name: string;
    type: string;
    relationType: string;
    weight: number;
  }>;
}

/**
 * 특정 엔티티와 관련된 엔티티 조회
 */
export async function getRelatedEntities(
  entityId: number,
  topK = 10,
): Promise<EntitySearchResult['relatedEntities']> {
  const db = getDb();

  // source 또는 target으로 연결된 관계 조회
  const outgoing = await db
    .select({
      id: entities.id,
      name: entities.name,
      type: entities.type,
      relationType: relations.type,
      weight: relations.weight,
    })
    .from(relations)
    .innerJoin(entities, eq(relations.targetId, entities.id))
    .where(eq(relations.sourceId, entityId))
    .orderBy(desc(relations.weight))
    .limit(topK);

  const incoming = await db
    .select({
      id: entities.id,
      name: entities.name,
      type: entities.type,
      relationType: relations.type,
      weight: relations.weight,
    })
    .from(relations)
    .innerJoin(entities, eq(relations.sourceId, entities.id))
    .where(eq(relations.targetId, entityId))
    .orderBy(desc(relations.weight))
    .limit(topK);

  // 합치고 중복 제거 (같은 엔티티가 여러 관계로 나타날 수 있음)
  const seen = new Set<number>();
  const result: EntitySearchResult['relatedEntities'] = [];

  for (const item of [...outgoing, ...incoming]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
    if (result.length >= topK) break;
  }

  return result;
}

/**
 * 엔티티 이름으로 검색 (부분 일치)
 */
export async function searchEntities(
  jobId: number,
  query: string,
  limit = 20,
): Promise<
  Array<{
    id: number;
    name: string;
    type: string;
    mentionCount: number;
    metadata: Record<string, unknown> | null;
  }>
> {
  const db = getDb();

  const rows = await db
    .select()
    .from(entities)
    .where(and(eq(entities.jobId, jobId), sql`${entities.name} ILIKE ${'%' + query + '%'}`))
    .orderBy(desc(entities.mentionCount))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    mentionCount: r.mentionCount,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
  }));
}
