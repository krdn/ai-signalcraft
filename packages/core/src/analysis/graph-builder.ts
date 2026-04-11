// JSONB 분석 결과에서 네트워크 그래프 데이터 추출
// AGE 없이 기존 AI 분석 결과의 JSONB 필드에서 관계 데이터를 도출
import type { SentimentFramingResult } from './schemas/sentiment-framing.schema';
import type { FrameWarResult } from './schemas/frame-war.schema';
import type { RiskMapResult } from './schemas/risk-map.schema';

// ─── 그래프 데이터 타입 ────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  group: string;
  size: number;
  color?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── 키워드 네트워크 ───────────────────────────────────────────────

/**
 * sentiment-framing 결과에서 키워드 네트워크 그래프 데이터 생성
 * topKeywords: 노드 (크기 = count, 색상 = sentiment)
 * relatedKeywords: 엣지 (keyword ↔ relatedTo, 굵기 = coOccurrenceScore)
 */
export function buildKeywordNetwork(sentimentFraming: SentimentFramingResult): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  // topKeywords → 노드
  for (const kw of sentimentFraming.topKeywords) {
    if (!kw.keyword) continue;
    const id = kw.keyword;
    nodeIds.add(id);
    nodes.push({
      id,
      label: kw.keyword,
      group: kw.sentiment,
      size: Math.max(kw.count, 1),
      color:
        kw.sentiment === 'positive'
          ? '#22c55e'
          : kw.sentiment === 'negative'
            ? '#ef4444'
            : '#a1a1aa',
    });
  }

  // relatedKeywords → 엣지
  for (const rk of sentimentFraming.relatedKeywords) {
    if (!rk.keyword) continue;

    // 소스 노드가 topKeywords에 없으면 추가
    if (!nodeIds.has(rk.keyword)) {
      nodeIds.add(rk.keyword);
      nodes.push({
        id: rk.keyword,
        label: rk.keyword,
        group: 'related',
        size: 1,
        color: '#71717a',
      });
    }

    // 연관 키워드 타겟 노드 및 엣지 추가
    for (const related of rk.relatedTo) {
      if (!nodeIds.has(related)) {
        nodeIds.add(related);
        nodes.push({
          id: related,
          label: related,
          group: 'related',
          size: 1,
          color: '#71717a',
        });
      }

      if (rk.keyword !== related) {
        edges.push({
          source: rk.keyword,
          target: related,
          weight: rk.coOccurrenceScore,
          type: 'co-occurrence',
        });
      }
    }
  }

  return { nodes, edges };
}

// ─── 프레임 전쟁 그래프 ─────────────────────────────────────────────

/**
 * frame-war + sentiment-framing 결과에서 프레임 경쟁 그래프 생성
 * dominantFrames: 파란색 노드
 * threateningFrames: 빨간색 노드
 * reversibleFrames: 노란색 노드
 * frameConflict: dominant ↔ challenging 엣지
 */
export function buildFrameWarGraph(
  frameWar: FrameWarResult,
  sentimentFraming: SentimentFramingResult,
): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  // 지배적 프레임 → 노드
  for (const f of frameWar.dominantFrames) {
    if (!f.name) continue;
    nodeIds.add(f.name);
    nodes.push({
      id: f.name,
      label: f.name,
      group: 'dominant',
      size: Math.max(f.strength, 10),
      color: '#3b82f6',
    });
  }

  // 위협 프레임 → 노드
  for (const f of frameWar.threateningFrames) {
    if (!f.name) continue;
    nodeIds.add(f.name);
    nodes.push({
      id: f.name,
      label: f.name,
      group: 'threatening',
      size: f.threatLevel === 'critical' ? 40 : f.threatLevel === 'high' ? 30 : 20,
      color: '#ef4444',
    });

    // 지배 프레임 → 위협 프레임 엣지
    if (frameWar.dominantFrames.length > 0) {
      const dominant = frameWar.dominantFrames[0];
      if (dominant.name && dominant.name !== f.name) {
        edges.push({
          source: dominant.name,
          target: f.name,
          weight: 0.7,
          type: 'threatens',
        });
      }
    }
  }

  // 반전 가능 프레임 → 노드
  for (const f of frameWar.reversibleFrames) {
    if (!f.name) continue;
    nodeIds.add(f.name);
    nodes.push({
      id: f.name,
      label: f.name,
      group: 'reversible',
      size: 15,
      color: '#eab308',
    });
  }

  // sentiment-framing의 긍정/부정 프레임 → 노드 + 엣지
  for (const f of sentimentFraming.positiveFrames) {
    if (!f.frame || nodeIds.has(f.frame)) continue;
    nodeIds.add(f.frame);
    nodes.push({
      id: f.frame,
      label: f.frame,
      group: 'positive-frame',
      size: f.strength * 3,
      color: '#22c55e',
    });
  }

  for (const f of sentimentFraming.negativeFrames) {
    if (!f.frame || nodeIds.has(f.frame)) continue;
    nodeIds.add(f.frame);
    nodes.push({
      id: f.frame,
      label: f.frame,
      group: 'negative-frame',
      size: f.strength * 3,
      color: '#f97316',
    });

    // 부정 프레임 ↔ 지배적 프레임 충돌 엣지
    if (frameWar.dominantFrames.length > 0) {
      const dominant = frameWar.dominantFrames[0];
      if (dominant.name) {
        edges.push({
          source: dominant.name,
          target: f.frame,
          weight: 0.5,
          type: 'conflicts',
        });
      }
    }
  }

  // frameConflict → 엣지
  const { dominantFrame, challengingFrame } = sentimentFraming.frameConflict;
  if (dominantFrame && challengingFrame && dominantFrame !== challengingFrame) {
    // 노드가 없으면 추가
    for (const name of [dominantFrame, challengingFrame]) {
      if (!nodeIds.has(name)) {
        nodeIds.add(name);
        nodes.push({
          id: name,
          label: name,
          group: 'conflict',
          size: 20,
          color: '#a855f7',
        });
      }
    }

    edges.push({
      source: dominantFrame,
      target: challengingFrame,
      weight: 0.8,
      type: 'conflict',
    });
  }

  return { nodes, edges };
}

// ─── 리스크 연쇄 다이어그램 ──────────────────────────────────────────

/**
 * risk-map 결과에서 리스크 관계 그래프 생성
 * 각 리스크를 노드로, triggerConditions에서 공통 키워드 기반 엣지 생성
 */
export function buildRiskChainGraph(riskMap: RiskMapResult): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const colorMap: Record<string, string> = {
    critical: '#dc2626',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  };

  for (const risk of riskMap.topRisks) {
    if (!risk.title) continue;
    nodes.push({
      id: risk.title,
      label: risk.title,
      group: risk.impactLevel,
      size: risk.spreadProbability * 40,
      color: colorMap[risk.impactLevel] ?? '#71717a',
    });
  }

  // 리스크 간 관계: triggerConditions에서 공통 키워드 기반
  for (let i = 0; i < riskMap.topRisks.length; i++) {
    for (let j = i + 1; j < riskMap.topRisks.length; j++) {
      const a = riskMap.topRisks[i];
      const b = riskMap.topRisks[j];
      if (!a.title || !b.title) continue;

      // triggerConditions 간 공통 키워드 탐지
      const aTriggers = a.triggerConditions.map((t: string) => t.toLowerCase());
      const bTriggers = b.triggerConditions.map((t: string) => t.toLowerCase());
      const sharedKeywords = aTriggers.filter((t: string) =>
        bTriggers.some((bt: string) => bt.includes(t.slice(0, 4)) || t.includes(bt.slice(0, 4))),
      );

      if (sharedKeywords.length > 0) {
        edges.push({
          source: a.title,
          target: b.title,
          weight: 0.3 + sharedKeywords.length * 0.2,
          type: 'related',
        });
      } else if (a.impactLevel === 'critical' || b.impactLevel === 'critical') {
        // critical 리스크는 모든 리스크와 약한 연결
        edges.push({
          source: a.title,
          target: b.title,
          weight: 0.2,
          type: 'potential',
        });
      }
    }
  }

  return { nodes, edges };
}
