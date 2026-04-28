'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Database } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { ShowcaseSidebar } from '@/components/layout/showcase-sidebar';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { ReportView } from '@/components/report/report-view';
import { AdvancedView } from '@/components/advanced/advanced-view';
import { ExploreView } from '@/components/explore/explore-view';
import { ManipulationView } from '@/components/manipulation/manipulation-view';
import { PipelineMonitor } from '@/components/analysis/pipeline-monitor';
import { useShowcasePipelineStatus } from '@/hooks/use-showcase-pipeline-status';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';
import { cn } from '@/lib/utils';

// 공개용 데이터 페칭 함수
const showcaseFetchResults = (jobId: number) => trpcClient.showcase.getResults.query({ jobId });
const showcaseFetchReport = (jobId: number) => trpcClient.showcase.getReport.query({ jobId });

export default function ShowcaseDetailPage() {
  const params = useParams();
  const jobId = Number(params.jobId);
  const [activeTab, setActiveTab] = useState(0);

  // 탭 0용 PipelineMonitor 어댑터 데이터
  const { data: pipelineData } = useShowcasePipelineStatus(jobId);

  // 쇼케이스 기본 정보 로드
  const { data: detail, isLoading } = useQuery({
    queryKey: ['showcase', 'getDetail', jobId],
    queryFn: () => trpcClient.showcase.getDetail.query({ jobId }),
    staleTime: Infinity,
    enabled: !isNaN(jobId),
  });

  if (isNaN(jobId)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-muted-foreground">잘못된 접근입니다.</p>
        <Link href="/#showcase">
          <Button variant="link">돌아가기</Button>
        </Link>
      </div>
    );
  }

  const keyword = isLoading ? '로딩 중…' : (detail?.keyword ?? '');

  return (
    <AppShell
      sidebar={(_open, _onClose) => (
        <ShowcaseSidebar keyword={keyword} activeTab={activeTab} onTabChange={setActiveTab} />
      )}
      header={(_onMenuClick) => (
        /* 모바일용 상단 헤더 — 사이드바가 숨겨지는 md 미만에서만 표시 */
        <header className="md:hidden shrink-0 border-b border-slate-200 bg-white">
          <div className="flex h-12 items-center px-4 gap-3">
            <button
              onClick={_onMenuClick}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            {isLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <span className="text-sm font-semibold text-slate-900 truncate">{keyword}</span>
            )}
          </div>
        </header>
      )}
    >
      {/* 탭 0: 분석 실행 — 파이프라인 상세 (읽기 전용) */}
      {activeTab === 0 && (
        <PipelineMonitor
          jobId={null}
          staticData={pipelineData ?? undefined}
          readOnly
          onComplete={() => setActiveTab(1)}
        />
      )}

      {/* 탭 1: 결과 대시보드 */}
      {activeTab === 1 && (
        <DashboardView
          jobId={jobId}
          fetchFn={showcaseFetchResults}
          readOnly
          collectionStats={
            detail?.stats
              ? {
                  totalArticles: detail.stats.totalArticles,
                  totalComments: detail.stats.totalComments,
                }
              : null
          }
        />
      )}

      {/* 탭 2: 수집 데이터 — 공개 요약만 */}
      {activeTab === 2 && (
        <ShowcaseCollectedDataTab jobId={jobId} detail={detail} isLoading={isLoading} />
      )}

      {/* 탭 3: AI 리포트 */}
      {activeTab === 3 && <ReportView jobId={jobId} fetchFn={showcaseFetchReport} />}

      {/* 탭 4: 히스토리 — 쇼케이스 목록으로 대체 */}
      {activeTab === 4 && <ShowcaseHistoryTab currentJobId={jobId} />}

      {/* 탭 5: 고급 분석 */}
      {activeTab === 5 && (
        <AdvancedView jobId={jobId} domain={detail?.domain} fetchFn={showcaseFetchResults} />
      )}

      {/* 탭 6: 탐색 */}
      {activeTab === 6 && <ExploreView jobId={jobId} />}

      {/* 탭 7: 조작 신호 */}
      {activeTab === 7 && <ManipulationView jobId={jobId} />}
    </AppShell>
  );
}

// 수집 데이터 탭 (공개 요약)
function ShowcaseCollectedDataTab({
  detail,
  isLoading,
}: {
  jobId: number;
  detail: Awaited<ReturnType<typeof trpcClient.showcase.getDetail.query>> | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Database className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-semibold">수집 데이터를 불러올 수 없습니다</p>
      </div>
    );
  }

  const maxTotal = Math.max(...detail.sources.map((s) => s.articles + s.comments), 1);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">수집 데이터 요약</h2>
        <p className="text-sm text-muted-foreground">
          총 {detail.stats.totalArticles}건의 본문과 {detail.stats.totalComments}건의 댓글이
          수집되었습니다.
        </p>
      </div>

      <div className="space-y-3">
        {detail.sources.map((src) => {
          const total = src.articles + src.comments;
          const ratio = total / maxTotal;
          return (
            <div key={src.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{src.label}</span>
                <span className="text-muted-foreground">
                  {src.articles > 0 && <>{src.articles}건</>}
                  {src.articles > 0 && src.comments > 0 && ' · '}
                  {src.comments > 0 && <>{src.comments}댓글</>}
                </span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.max(ratio * 100, 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
        개별 기사 및 댓글 데이터는 로그인 후 대시보드에서 확인할 수 있습니다.
        <Link href="/demo" className="ml-1 text-primary hover:underline">
          무료 체험 시작 →
        </Link>
      </div>
    </div>
  );
}

// 히스토리 탭 (다른 쇼케이스 항목 목록)
function ShowcaseHistoryTab({ currentJobId }: { currentJobId: number }) {
  const { data: items, isLoading } = useQuery({
    queryKey: ['showcase', 'list'],
    queryFn: () => trpcClient.showcase.list.query(),
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-lg font-semibold">쇼케이스 분석 목록</h2>
      <div className="space-y-2">
        {(items ?? []).map((item) => (
          <Link
            key={item.jobId}
            href={`/showcase/${item.jobId}`}
            className={cn(
              'block rounded-xl border p-4 transition-colors',
              item.jobId === currentJobId
                ? 'border-primary bg-primary/5'
                : 'border-border/50 hover:border-primary/30 hover:bg-muted/30',
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{item.keyword}</span>
                {item.oneLiner && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                    {item.oneLiner}
                  </p>
                )}
              </div>
              <div className="text-xs text-muted-foreground shrink-0 ml-4">
                {item.totalArticles}건 · {item.totalComments}댓글 · {item.modulesCompleted}개 모듈
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
