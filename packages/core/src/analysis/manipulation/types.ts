import type { SignalType, Severity } from '../../db/schema/manipulation';

export type { SignalType, Severity };

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

export type SignalCalculator = (ctx: SignalContext) => Promise<SignalResult>;
