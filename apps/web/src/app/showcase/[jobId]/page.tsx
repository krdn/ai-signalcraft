'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Play, LayoutDashboard, Database, FileText, History, Brain } from 'lucide-react';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { ReportView } from '@/components/report/report-view';
import { AdvancedView } from '@/components/advanced/advanced-view';
import { PipelineMonitor } from '@/components/analysis/pipeline-monitor';
import { useShowcasePipelineStatus } from '@/hooks/use-showcase-pipeline-status';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';
import { cn } from '@/lib/utils';

// 쇼케이스 공개 페이지 탭 (읽기 전용)
const TABS: { label: string; icon: LucideIcon; key: string }[] = [
  { label: '분석 실행', icon: Play, key: 'pipeline' },
  { label: '결과 대시보드', icon: LayoutDashboard, key: 'dashboard' },
  { label: '수집 데이터', icon: Database, key: 'collected' },
  { label: 'AI 리포트', icon: FileText, key: 'report' },
  { label: '히스토리', icon: History, key: 'history' },
  { label: '고급 분석', icon: Brain, key: 'advanced' },
];

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

  return (
    <main className="min-h-screen bg-background">
      {/* 네비게이션 바 */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center h-14 px-4 md:px-8">
          {/* 뒤로가기 */}
          <Link href="/#showcase" className="mr-4">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              돌아가기
            </Button>
          </Link>

          {/* 키워드 */}
          {isLoading ? (
            <Skeleton className="h-6 w-24 mr-6" />
          ) : (
            detail && <span className="font-semibold mr-6 text-sm">{detail.keyword}</span>
          )}

          {/* 탭 */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map((tab, idx) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(idx)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors',
                    activeTab === idx
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* 탭 콘텐츠 */}
      <div className="px-4 md:px-8 py-6">
        {/* 탭 0: 분석 실행 — 파이프라인 상세 (읽기 전용) */}
        {activeTab === 0 && (
          <PipelineMonitor jobId={null} staticData={pipelineData ?? undefined} readOnly />
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
      </div>

      {/* 하단 CTA */}
      <div className="border-t bg-muted/30 py-8 text-center">
        <p className="text-sm text-muted-foreground mb-3">
          AI SignalCraft로 직접 분석을 실행해 보세요
        </p>
        <Link href="/demo">
          <Button size="lg" className="gap-1.5">
            무료 체험 시작
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </Button>
        </Link>
      </div>
    </main>
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
