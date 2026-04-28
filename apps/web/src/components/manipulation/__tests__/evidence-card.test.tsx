import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidenceCard } from '../evidence-card';

const baseEvidence = {
  id: 'e1',
  runId: 'r1',
  signal: 'burst',
  severity: 'high' as const,
  title: '댓글 폭주 패턴',
  summary: '평균 대비 4배 폭주 구간 발견',
  rank: 1,
  rawRefs: [],
};

describe('EvidenceCard', () => {
  it('viz.kind=burst-heatmap → BurstHeatmap 렌더', () => {
    render(
      <EvidenceCard
        evidence={{ ...baseEvidence, visualization: { kind: 'burst-heatmap', buckets: [] } }}
      />,
    );
    expect(screen.getByText(/burst-heatmap/)).toBeInTheDocument();
  });

  it('viz.kind=trend-line → TrendLine 렌더', () => {
    render(
      <EvidenceCard
        evidence={{ ...baseEvidence, visualization: { kind: 'trend-line', series: [] } }}
      />,
    );
    expect(screen.getByText(/trend-line/)).toBeInTheDocument();
  });

  it('viz.kind=temporal-bars → TemporalBars 렌더', () => {
    render(
      <EvidenceCard
        evidence={{ ...baseEvidence, visualization: { kind: 'temporal-bars', bars: [] } }}
      />,
    );
    expect(screen.getByText(/temporal-bars/)).toBeInTheDocument();
  });

  it('viz.kind=vote-scatter → VoteScatter 렌더', () => {
    render(
      <EvidenceCard
        evidence={{ ...baseEvidence, visualization: { kind: 'vote-scatter', points: [] } }}
      />,
    );
    expect(screen.getByText(/vote-scatter/)).toBeInTheDocument();
  });

  it('viz.kind=similarity-cluster → SimilarityCluster 렌더', () => {
    render(
      <EvidenceCard
        evidence={{
          ...baseEvidence,
          visualization: { kind: 'similarity-cluster', representative: 'x', matches: [] },
        }}
      />,
    );
    expect(screen.getByText(/similarity-cluster/)).toBeInTheDocument();
  });

  it('viz.kind=media-sync-timeline → MediaSyncTimeline 렌더', () => {
    render(
      <EvidenceCard
        evidence={{
          ...baseEvidence,
          visualization: { kind: 'media-sync-timeline', cluster: 'x', items: [] },
        }}
      />,
    );
    expect(screen.getByText(/media-sync-timeline/)).toBeInTheDocument();
  });

  it('viz.kind=cross-platform-flow → CrossPlatformFlow 렌더', () => {
    render(
      <EvidenceCard
        evidence={{ ...baseEvidence, visualization: { kind: 'cross-platform-flow', hops: [] } }}
      />,
    );
    expect(screen.getByText(/cross-platform-flow/)).toBeInTheDocument();
  });

  it('알 수 없는 kind → 폴백 메시지', () => {
    render(
      <EvidenceCard evidence={{ ...baseEvidence, visualization: { kind: 'unknown' as never } }} />,
    );
    expect(screen.getByText(/시각화 형태가 인식되지 않습니다/)).toBeInTheDocument();
  });

  it('헤더에 severity, signal, title 표시', () => {
    render(
      <EvidenceCard
        evidence={{ ...baseEvidence, visualization: { kind: 'burst-heatmap', buckets: [] } }}
      />,
    );
    expect(screen.getByText(/높음/)).toBeInTheDocument();
    expect(screen.getByText('댓글 폭주 패턴')).toBeInTheDocument();
  });
});
