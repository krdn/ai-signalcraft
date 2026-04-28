import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ManipulationView } from '../manipulation-view';

const mockQuery = vi.fn();
vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    manipulation: {
      getRunByJobId: { query: (...args: unknown[]) => mockQuery(...args) },
    },
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ManipulationView', () => {
  it('isLoading 시 Skeleton 표시', () => {
    mockQuery.mockReturnValueOnce(new Promise(() => {})); // never resolve
    renderWithClient(<ManipulationView jobId={273} />);
    expect(screen.getByTestId('manipulation-skeleton')).toBeInTheDocument();
  });

  it('null 응답 시 EmptyState (구독 토글 안내)', async () => {
    mockQuery.mockResolvedValueOnce(null);
    renderWithClient(<ManipulationView jobId={273} />);
    expect(await screen.findByText(/조작 신호 검출을 활성화/)).toBeInTheDocument();
  });

  it('status:running 시 RunningSpinner', async () => {
    mockQuery.mockResolvedValueOnce({ id: 'r1', status: 'running' });
    renderWithClient(<ManipulationView jobId={273} />);
    expect(await screen.findByText(/분석 진행 중/)).toBeInTheDocument();
  });

  it('status:failed 시 errorDetails.message 노출', async () => {
    mockQuery.mockResolvedValueOnce({
      id: 'r1',
      status: 'failed',
      errorDetails: { message: '데이터 부족' },
    });
    renderWithClient(<ManipulationView jobId={273} />);
    expect(await screen.findByText('데이터 부족')).toBeInTheDocument();
  });

  it('status:completed 시 CompletedView 마운트', async () => {
    mockQuery.mockResolvedValueOnce({
      id: 'r1',
      status: 'completed',
      manipulationScore: 57.2,
      confidenceFactor: 0.84,
      signals: [],
      evidence: [],
    });
    renderWithClient(<ManipulationView jobId={273} />);
    expect(await screen.findByTestId('manipulation-completed')).toBeInTheDocument();
  });

  it('error 시 ErrorAlert', async () => {
    mockQuery.mockRejectedValueOnce(new Error('네트워크 오류'));
    renderWithClient(<ManipulationView jobId={273} />);
    expect(await screen.findByText(/네트워크 오류/)).toBeInTheDocument();
  });
});
