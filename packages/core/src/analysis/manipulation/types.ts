import type { SignalType, Severity } from '../../db/schema/manipulation';

export type { SignalType, Severity };
// signals/* 내부 타입(VoteRow/EmbeddedItem/ArticleEmbedded/TrendPoint)은
// 순환 의존 방지를 위해 manipulation/types에서 re-export하지 않는다.
// 사용처는 signals/{vote,similarity,media-sync,trend-shape}에서 직접 import.

export type RawRef = {
  itemId: string;
  source: string;
  time: string;
  excerpt: string;
};

export type VisualizationSpec =
  | { kind: 'burst-heatmap'; buckets: { ts: string; count: number; zScore: number }[] }
  | {
      kind: 'similarity-cluster';
      representative: string;
      matches: { author: string | null; source: string; time: string; text: string }[];
    }
  | {
      kind: 'vote-scatter';
      points: { length: number; likes: number; isOutlier: boolean }[];
    }
  | {
      kind: 'media-sync-timeline';
      cluster: string;
      items: { publisher: string | null; time: string; headline: string }[];
    }
  | {
      kind: 'trend-line';
      series: { ts: string; count: number; isChangePoint: boolean }[];
    }
  | {
      kind: 'cross-platform-flow';
      hops: { from: string; to: string; time: string; message: string; count: number }[];
    }
  | {
      kind: 'temporal-bars';
      bars: { hour: number; current: number; baseline: number }[];
    };

export type EvidenceCard = {
  signal: SignalType;
  severity: Severity;
  title: string;
  summary: string;
  visualization: VisualizationSpec;
  rawRefs: RawRef[];
  rank: number;
};

export type SignalResult = {
  signal: SignalType;
  score: number;
  confidence: number;
  evidence: EvidenceCard[];
  metrics: Record<string, number>;
  computeMs: number;
};

export type DomainWeights = Record<SignalType, number>;
export type DomainThresholds = Record<SignalType, { medium: number; high: number }>;

export type DomainConfig = {
  domain: string;
  weights: DomainWeights;
  thresholds: DomainThresholds;
  baselineDays: number;
  narrativeContext: string;
};

export type SignalContext = {
  jobId: number;
  subscriptionId: number | null;
  domain: string;
  config: DomainConfig;
  dateRange: { start: Date; end: Date };
};

// 댓글 행 — burst, temporal 등 댓글 기반 신호에서 공용
export type CommentRow = {
  itemId: string;
  parentSourceId: string;
  source: string;
  time: Date;
  excerpt: string;
};

// ManipulationDataLoader는 signals/* 내부 타입에 의존하므로 ./loader-types.ts로 분리.
// 사용처는 './loader-types'에서 직접 import (manipulation/types ↔ signals/* 사이클 회피).
