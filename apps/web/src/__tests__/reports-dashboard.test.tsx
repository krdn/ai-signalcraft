import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportsDashboard } from '@/components/reports/reports-dashboard';

// next-auth mock
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

// trpcClient mock — 3개 항목: political 2개, fandom 1개
vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    showcase: {
      list: {
        query: vi.fn().mockResolvedValue([
          {
            jobId: 1,
            keyword: '이효리',
            domain: 'political',
            startDate: '2026-04-08',
            endDate: '2026-04-15',
            oneLiner: '부친상 과잉 보도 여론',
            reportTitle: '이효리 종합 분석',
            totalArticles: 500,
            totalComments: 2437,
            modulesCompleted: 12,
            featuredAt: '2026-04-15',
            createdAt: '2026-04-15',
            metadata: null,
          },
          {
            jobId: 2,
            keyword: '노란봉투법',
            domain: 'political',
            startDate: '2026-04-07',
            endDate: '2026-04-14',
            oneLiner: '노란봉투법 여론 분석',
            reportTitle: '노란봉투법 리포트',
            totalArticles: 320,
            totalComments: 1025,
            modulesCompleted: 12,
            featuredAt: '2026-04-14',
            createdAt: '2026-04-14',
            metadata: null,
          },
          {
            jobId: 3,
            keyword: '아이돌',
            domain: 'fandom',
            startDate: '2026-04-07',
            endDate: '2026-04-14',
            oneLiner: '팬덤 여론 분석',
            reportTitle: '아이돌 분석',
            totalArticles: 200,
            totalComments: 800,
            modulesCompleted: 10,
            featuredAt: '2026-04-13',
            createdAt: '2026-04-13',
            metadata: null,
          },
        ]),
      },
    },
  },
}));

/** showcase/N href를 가진 링크 수 반환 */
function getShowcaseLinkCount() {
  return screen
    .getAllByRole('link')
    .filter((el) => el.getAttribute('href')?.startsWith('/showcase/')).length;
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReportsDashboard />
    </QueryClientProvider>,
  );
}

describe('ReportsDashboard', () => {
  it('renders without crashing and shows nav brand', () => {
    renderDashboard();
    expect(screen.getAllByText(/SignalCraft/i).length).toBeGreaterThan(0);
  });

  it('shows all 3 items after data loads', async () => {
    renderDashboard();
    // showcase 링크가 3개 나타날 때까지 대기
    await waitFor(() => {
      expect(getShowcaseLinkCount()).toBe(3);
    });
  });

  it('filters to 1 item after clicking fandom domain button', async () => {
    renderDashboard();
    // 데이터 로드 대기
    await waitFor(() => {
      expect(getShowcaseLinkCount()).toBe(3);
    });
    // 팬덤 버튼이 여러 개 있을 수 있으므로(사이드바 + 모바일 칩) 첫 번째 클릭
    const fandomBtns = screen.getAllByRole('button', { name: /팬덤/i });
    expect(fandomBtns.length).toBeGreaterThan(0);
    fireEvent.click(fandomBtns[0]);
    // 팬덤 카드만 남아야 함 (잠깐 state 업데이트 기다림)
    await waitFor(
      () => {
        expect(getShowcaseLinkCount()).toBe(1);
      },
      { timeout: 2000 },
    );
  });

  it('shows filter buttons only for domains that have data', async () => {
    renderDashboard();
    // 데이터 로드 대기
    await waitFor(() => {
      expect(getShowcaseLinkCount()).toBe(3);
    });
    // 데이터에 있는 도메인 버튼 존재 확인
    const politicalBtns = screen.queryAllByRole('button', { name: /^정치/i });
    const fandomBtns = screen.queryAllByRole('button', { name: /^팬덤/i });
    expect(politicalBtns.length).toBeGreaterThan(0);
    expect(fandomBtns.length).toBeGreaterThan(0);
    // 데이터에 없는 도메인(경제)은 버튼으로 존재하지 않음
    const economicBtns = screen.queryAllByRole('button', { name: /경제/i });
    expect(economicBtns.length).toBe(0);
  });
});
