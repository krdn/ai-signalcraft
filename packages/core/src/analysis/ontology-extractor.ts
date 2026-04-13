// 분석 모듈 결과에서 엔티티와 관계를 추출
// 기존 16개 모듈의 구조화된 JSON 결과를 매핑하여 온톨로지 구성

export interface ExtractedEntity {
  name: string;
  type: 'person' | 'organization' | 'issue' | 'keyword' | 'frame' | 'claim';
  normalizedName: string;
  metadata?: {
    sentiment?: string;
    strength?: number;
    source?: string;
    description?: string;
  };
  mentionCount: number;
}

export interface ExtractedRelation {
  sourceName: string;
  sourceType: string;
  targetName: string;
  targetType: string;
  type: 'supports' | 'opposes' | 'related' | 'causes' | 'cooccurs' | 'threatens';
  weight: number;
  evidence?: {
    excerpt?: string;
    moduleSource?: string;
  };
}

export interface OntologyExtraction {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
}

// 엔티티 이름 정규화
function normalizeEntityName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// 중복 제거된 엔티티 맵
function addEntity(
  map: Map<string, ExtractedEntity>,
  name: string,
  type: ExtractedEntity['type'],
  metadata?: ExtractedEntity['metadata'],
): void {
  const normalizedName = normalizeEntityName(name);
  if (!normalizedName) return;

  const key = `${normalizedName}:${type}`;
  const existing = map.get(key);
  if (existing) {
    existing.mentionCount++;
    if (metadata?.strength && existing.metadata?.strength !== undefined) {
      existing.metadata.strength = Math.max(existing.metadata.strength, metadata.strength);
    }
  } else {
    map.set(key, {
      name,
      type,
      normalizedName,
      metadata,
      mentionCount: 1,
    });
  }
}

/**
 * 모듈 분석 결과에서 엔티티와 관계를 추출
 * 각 모듈의 구조화된 스키마 필드를 온톨로지 엔티티/관계로 매핑
 */
export function extractEntitiesFromResults(
  allResults: Record<string, { status: string; result?: unknown }>,
): OntologyExtraction {
  const entityMap = new Map<string, ExtractedEntity>();
  const relations: ExtractedRelation[] = [];

  // ─── sentiment-framing: 키워드 + 프레임 + 관계 ──────────────
  const sf = allResults['sentiment-framing']?.result as Record<string, unknown> | undefined;
  if (sf) {
    // topKeywords → keyword 엔티티
    const topKeywords = (sf.topKeywords as Array<Record<string, unknown>>) ?? [];
    for (const kw of topKeywords) {
      const keyword = String(kw.keyword ?? '');
      if (!keyword) continue;
      addEntity(entityMap, keyword, 'keyword', {
        sentiment: String(kw.sentiment ?? ''),
        strength: Number(kw.count ?? 1),
        source: 'sentiment-framing',
      });
    }

    // positiveFrames → frame 엔티티
    const posFrames = (sf.positiveFrames as Array<Record<string, unknown>>) ?? [];
    for (const f of posFrames) {
      const frame = String(f.frame ?? '');
      if (!frame) continue;
      addEntity(entityMap, frame, 'frame', {
        sentiment: 'positive',
        strength: Number(f.strength ?? 0),
        source: 'sentiment-framing',
        description: String(f.evidence ?? ''),
      });
    }

    // negativeFrames → frame 엔티티
    const negFrames = (sf.negativeFrames as Array<Record<string, unknown>>) ?? [];
    for (const f of negFrames) {
      const frame = String(f.frame ?? '');
      if (!frame) continue;
      addEntity(entityMap, frame, 'frame', {
        sentiment: 'negative',
        strength: Number(f.strength ?? 0),
        source: 'sentiment-framing',
        description: String(f.evidence ?? ''),
      });
    }

    // relatedKeywords → cooccurs 관계
    const relatedKws = (sf.relatedKeywords as Array<Record<string, unknown>>) ?? [];
    for (const rk of relatedKws) {
      const keyword = String(rk.keyword ?? '');
      if (!keyword) continue;
      const relatedTo = (rk.relatedTo as string[]) ?? [];
      const score = Number(rk.coOccurrenceScore ?? 0);
      for (const target of relatedTo) {
        if (!target || keyword === target) continue;
        relations.push({
          sourceName: keyword,
          sourceType: 'keyword',
          targetName: target,
          targetType: 'keyword',
          type: 'cooccurs',
          weight: score,
          evidence: { moduleSource: 'sentiment-framing' },
        });
      }
    }

    // frameConflict → opposes 관계
    const fc = sf.frameConflict as Record<string, string> | undefined;
    if (fc?.dominantFrame && fc?.challengingFrame) {
      relations.push({
        sourceName: fc.dominantFrame,
        sourceType: 'frame',
        targetName: fc.challengingFrame,
        targetType: 'frame',
        type: 'opposes',
        weight: 0.8,
        evidence: { moduleSource: 'sentiment-framing' },
      });
    }
  }

  // ─── segmentation: 집단 + 플랫폼 ────────────────────────────
  const seg = allResults['segmentation']?.result as Record<string, unknown> | undefined;
  if (seg) {
    const audienceGroups = (seg.audienceGroups as Array<Record<string, unknown>>) ?? [];
    for (const g of audienceGroups) {
      const name = String(g.groupName ?? g.name ?? '');
      if (!name) continue;
      addEntity(entityMap, name, 'organization', {
        source: 'segmentation',
        description: String(g.characteristics ?? ''),
      });
    }
  }

  // ─── frame-war: 프레임 + 위협 관계 ──────────────────────────
  const fw = allResults['frame-war']?.result as Record<string, unknown> | undefined;
  if (fw) {
    const dominant = (fw.dominantFrames as Array<Record<string, unknown>>) ?? [];
    for (const f of dominant) {
      const name = String(f.name ?? '');
      if (!name) continue;
      addEntity(entityMap, name, 'frame', {
        strength: Number(f.strength ?? 0),
        source: 'frame-war',
        description: String(f.description ?? ''),
      });
    }

    const threatening = (fw.threateningFrames as Array<Record<string, unknown>>) ?? [];
    for (const f of threatening) {
      const name = String(f.name ?? '');
      if (!name) continue;
      addEntity(entityMap, name, 'frame', {
        source: 'frame-war',
        description: String(f.description ?? ''),
      });

      // 지배 프레임 → 위협 프레임 threatens 관계
      if (dominant.length > 0 && dominant[0].name) {
        relations.push({
          sourceName: String(dominant[0].name),
          sourceType: 'frame',
          targetName: name,
          targetType: 'frame',
          type: 'threatens',
          weight: f.threatLevel === 'critical' ? 0.9 : f.threatLevel === 'high' ? 0.7 : 0.5,
          evidence: { moduleSource: 'frame-war' },
        });
      }
    }

    const reversible = (fw.reversibleFrames as Array<Record<string, unknown>>) ?? [];
    for (const f of reversible) {
      const name = String(f.name ?? '');
      if (!name) continue;
      addEntity(entityMap, name, 'frame', {
        source: 'frame-war',
        description: String(f.currentPerception ?? ''),
      });
    }
  }

  // ─── risk-map: 리스크 이슈 + 연쇄 관계 ──────────────────────
  const rm = allResults['risk-map']?.result as Record<string, unknown> | undefined;
  if (rm) {
    const topRisks = (rm.topRisks as Array<Record<string, unknown>>) ?? [];
    for (const risk of topRisks) {
      const title = String(risk.title ?? risk.name ?? '');
      if (!title) continue;
      addEntity(entityMap, title, 'issue', {
        strength: Number(risk.spreadProbability ?? risk.impactLevel ?? 0),
        source: 'risk-map',
        description: String(risk.description ?? ''),
      });
    }

    // triggerConditions 공유 → causes 관계
    const riskTriggers = topRisks.map((r) => ({
      title: String(r.title ?? ''),
      triggers: ((r.triggerConditions as string[]) ?? []).map((t) => t.toLowerCase()),
    }));

    for (let i = 0; i < riskTriggers.length; i++) {
      for (let j = i + 1; j < riskTriggers.length; j++) {
        const a = riskTriggers[i];
        const b = riskTriggers[j];
        if (!a.title || !b.title) continue;

        const shared = a.triggers.filter((at) =>
          b.triggers.some((bt) => at.includes(bt.slice(0, 4)) || bt.includes(at.slice(0, 4))),
        );

        if (shared.length > 0) {
          relations.push({
            sourceName: a.title,
            sourceType: 'issue',
            targetName: b.title,
            targetType: 'issue',
            type: 'causes',
            weight: 0.3 + shared.length * 0.15,
            evidence: {
              excerpt: shared.join(', '),
              moduleSource: 'risk-map',
            },
          });
        }
      }
    }
  }

  // ─── message-impact: 성공/실패 메시지 → claim ─────────────
  const mi = allResults['message-impact']?.result as Record<string, unknown> | undefined;
  if (mi) {
    const successMsgs = (mi.successMessages as Array<Record<string, unknown>>) ?? [];
    for (const m of successMsgs) {
      const msg = String(m.message ?? m.content ?? '');
      if (!msg) continue;
      addEntity(entityMap, msg.slice(0, 80), 'claim', {
        sentiment: 'positive',
        source: 'message-impact',
      });
    }

    const failureMsgs = (mi.failureMessages as Array<Record<string, unknown>>) ?? [];
    for (const m of failureMsgs) {
      const msg = String(m.message ?? m.content ?? '');
      if (!msg) continue;
      addEntity(entityMap, msg.slice(0, 80), 'claim', {
        sentiment: 'negative',
        source: 'message-impact',
      });
    }
  }

  // ─── macro-view: 변곡점 → event ────────────────────────────
  const mv = allResults['macro-view']?.result as Record<string, unknown> | undefined;
  if (mv) {
    const inflections = (mv.inflectionPoints as Array<Record<string, unknown>>) ?? [];
    for (const ip of inflections) {
      const event = String(ip.event ?? ip.description ?? ip.date ?? '');
      if (!event) continue;
      addEntity(entityMap, event.slice(0, 80), 'issue', {
        source: 'macro-view',
        description: String(ip.description ?? ''),
      });
    }
  }

  // ─── strategy: 핵심 대상/토픽 ──────────────────────────────
  const st = allResults['strategy']?.result as Record<string, unknown> | undefined;
  if (st) {
    const targetStrategy = st.targetStrategy as Record<string, unknown> | undefined;
    if (targetStrategy) {
      const primaryTarget = String(targetStrategy.primaryTarget ?? '');
      if (primaryTarget) {
        addEntity(entityMap, primaryTarget, 'organization', {
          source: 'strategy',
        });
      }

      const keyTopics = (targetStrategy.keyTopics as string[]) ?? [];
      for (const topic of keyTopics) {
        if (!topic) continue;
        addEntity(entityMap, topic, 'keyword', {
          source: 'strategy',
        });
      }
    }
  }

  // ─── approval-rating: 핵심 인물/조직 감지 ──────────────────
  const ar = allResults['approval-rating']?.result as Record<string, unknown> | undefined;
  if (ar) {
    // methodology가 객체일 수 있으므로 문자열인 경우만 처리
    const methodologyRaw = ar.methodology;
    if (typeof methodologyRaw === 'string' && methodologyRaw) {
      const firstSentence = methodologyRaw.split('.')[0]?.trim();
      if (firstSentence && firstSentence.length < 100) {
        addEntity(entityMap, firstSentence, 'person', {
          source: 'approval-rating',
          description: methodologyRaw.slice(0, 200),
        });
      }
    }
  }

  return {
    entities: Array.from(entityMap.values()),
    relations,
  };
}
