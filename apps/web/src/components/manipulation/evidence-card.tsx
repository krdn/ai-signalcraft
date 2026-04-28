'use client';

import {
  BurstHeatmap,
  TrendLine,
  TemporalBars,
  VoteScatter,
  SimilarityCluster,
  MediaSyncTimeline,
  CrossPlatformFlow,
} from './visualizations';

const SEVERITY_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: '낮음',
  medium: '중간',
  high: '높음',
};

const SEVERITY_BADGE: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

interface EvidenceCardProps {
  evidence: {
    id: string;
    signal: string;
    severity: 'low' | 'medium' | 'high';
    title: string;
    summary: string;
    visualization: Record<string, unknown>;
    rawRefs: { itemId: string; source: string; time: string; excerpt: string }[];
  };
}

function renderViz(viz: Record<string, unknown>) {
  const kind = typeof viz.kind === 'string' ? viz.kind : '';
  switch (kind) {
    case 'burst-heatmap':
      return <BurstHeatmap data={viz} />;
    case 'trend-line':
      return <TrendLine data={viz} />;
    case 'temporal-bars':
      return <TemporalBars data={viz} />;
    case 'vote-scatter':
      return <VoteScatter data={viz} />;
    case 'similarity-cluster':
      return <SimilarityCluster data={viz} />;
    case 'media-sync-timeline':
      return <MediaSyncTimeline data={viz} />;
    case 'cross-platform-flow':
      return <CrossPlatformFlow data={viz} />;
    default:
      return (
        <span className="text-xs text-muted-foreground">
          시각화 형태가 인식되지 않습니다 ({kind})
        </span>
      );
  }
}

export function EvidenceCard({ evidence }: EvidenceCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 font-medium ${SEVERITY_BADGE[evidence.severity]}`}>
          {SEVERITY_LABEL[evidence.severity]}
        </span>
        <span className="text-muted-foreground">{evidence.signal}</span>
      </div>
      <h4 className="font-semibold">{evidence.title}</h4>
      <p className="text-sm text-muted-foreground">{evidence.summary}</p>
      {renderViz(evidence.visualization)}
      {evidence.rawRefs.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            원본 보기 ({evidence.rawRefs.length}건)
          </summary>
          <div className="mt-2 space-y-1">
            {evidence.rawRefs.map((ref) => (
              <div key={ref.itemId} className="rounded border bg-muted p-2">
                <div className="text-[10px] text-muted-foreground">
                  {ref.source} · {ref.time}
                </div>
                <div className="text-xs">{ref.excerpt}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
