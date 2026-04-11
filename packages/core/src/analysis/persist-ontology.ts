// 온톨로지 추출 결과를 DB에 영속화
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import { entities, relations } from '../db/schema/ontology';
import type { ExtractedEntity, ExtractedRelation } from './ontology-extractor';

/**
 * 추출된 엔티티/관계를 DB에 저장 (upsert)
 */
export async function persistOntology(
  jobId: number,
  extractedEntities: ExtractedEntity[],
  extractedRelations: ExtractedRelation[],
): Promise<{ entityCount: number; relationCount: number }> {
  const db = getDb();

  // 1. 엔티티 upsert
  const entityIdMap = new Map<string, number>(); // normalizedName:type -> db id

  for (const entity of extractedEntities) {
    const key = `${entity.normalizedName}:${entity.type}`;

    // 기존 엔티티 조회
    const existing = await db
      .select({ id: entities.id, mentionCount: entities.mentionCount })
      .from(entities)
      .where(
        and(
          eq(entities.jobId, jobId),
          eq(entities.normalizedName, entity.normalizedName),
          eq(entities.type, entity.type),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // mentionCount 증가
      await db
        .update(entities)
        .set({
          mentionCount: existing[0].mentionCount + 1,
          metadata: entity.metadata,
        })
        .where(eq(entities.id, existing[0].id));
      entityIdMap.set(key, existing[0].id);
    } else {
      // 새 엔티티 삽입
      const [inserted] = await db
        .insert(entities)
        .values({
          jobId,
          name: entity.name,
          type: entity.type,
          normalizedName: entity.normalizedName,
          metadata: entity.metadata ?? null,
          mentionCount: entity.mentionCount,
          firstSeen: new Date(),
          lastSeen: new Date(),
        })
        .returning({ id: entities.id });
      entityIdMap.set(key, inserted.id);
    }
  }

  // 2. 관계 upsert
  let relationCount = 0;
  for (const rel of extractedRelations) {
    const sourceKey = `${normalizeForMap(rel.sourceName)}:${rel.sourceType}`;
    const targetKey = `${normalizeForMap(rel.targetName)}:${rel.targetType}`;

    const sourceId = entityIdMap.get(sourceKey);
    const targetId = entityIdMap.get(targetKey);

    if (!sourceId || !targetId) continue;

    // 기존 관계 확인
    const existingRel = await db
      .select({ id: relations.id })
      .from(relations)
      .where(
        and(
          eq(relations.sourceId, sourceId),
          eq(relations.targetId, targetId),
          eq(relations.type, rel.type),
        ),
      )
      .limit(1);

    if (existingRel.length === 0) {
      await db.insert(relations).values({
        jobId,
        sourceId,
        targetId,
        type: rel.type,
        weight: rel.weight,
        evidence: rel.evidence ?? null,
      });
      relationCount++;
    }
  }

  return {
    entityCount: entityIdMap.size,
    relationCount,
  };
}

function normalizeForMap(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}
