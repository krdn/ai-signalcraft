import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimeseriesView } from '../timeseries-view';

const mockQuery = vi.fn();
vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    manipulation: {
      listRunsBySubscription: { query: (...args: unknown[]) => mockQuery(...args) },
    },
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('TimeseriesView', () => {
  it('빈 결과 시 EmptyState', async () => {
    mockQuery.mockResolvedValueOnce([]);
    renderWithClient(<TimeseriesView subscriptionId={37} />);
    expect(await screen.findByText(/manipulation 분석 이력이 없습니다/)).toBeInTheDocument();
  });

  it('runs 배열 렌더 — 표에 jobId 표시', async () => {
    mockQuery.mockResolvedValueOnce([
      {
        id: 'r1',
        jobId: 273,
        manipulationScore: 57.2,
        confidenceFactor: 0.84,
        startedAt: '2026-04-28T07:00:00Z',
        status: 'completed',
      },
      {
        id: 'r2',
        jobId: 280,
        manipulationScore: 60.1,
        confidenceFactor: 0.81,
        startedAt: '2026-04-29T07:00:00Z',
        status: 'completed',
      },
    ]);
    renderWithClient(<TimeseriesView subscriptionId={37} />);
    expect(await screen.findByText('273')).toBeInTheDocument();
    expect(screen.getByText('280')).toBeInTheDocument();
  });

  it('상세 보기 링크가 /showcase/{jobId}를 가리킴', async () => {
    mockQuery.mockResolvedValueOnce([
      {
        id: 'r1',
        jobId: 273,
        manipulationScore: 57.2,
        confidenceFactor: 0.84,
        startedAt: '2026-04-28T07:00:00Z',
        status: 'completed',
      },
    ]);
    renderWithClient(<TimeseriesView subscriptionId={37} />);
    const link = (await screen.findByText(/상세 보기/)).closest('a');
    expect(link).toHaveAttribute('href', '/showcase/273');
  });
});
