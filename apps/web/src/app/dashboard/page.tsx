'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Play } from 'lucide-react';
import { TopNav } from '@/components/layout/top-nav';
import { TabLayout } from '@/components/layout/tab-layout';
import { AnalysisLauncher } from '@/components/analysis/analysis-launcher';
import { PipelineMonitor } from '@/components/analysis/pipeline-monitor';
import { RecentJobs } from '@/components/analysis/recent-jobs';
import { HistoryTable } from '@/components/analysis/history-table';
import { ReportView } from '@/components/report/report-view';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { CollectedDataView } from '@/components/dashboard/collected-data-view';
import { AdvancedView } from '@/components/advanced/advanced-view';
import { ExploreView } from '@/components/explore/explore-view';
import { Button } from '@/components/ui/button';
import { DemoQuotaBanner } from '@/components/demo/demo-quota-banner';
import { UpgradeModal } from '@/components/demo/upgrade-modal';
import { trpcClient } from '@/lib/trpc';

// 쇼케이스용 데이터 페칭 함수
const showcaseFetchResults = (jobId: number) => trpcClient.showcase.getResults.query({ jobId });
const showcaseFetchReport = (jobId: number) => trpcClient.showcase.getReport.query({ jobId });

// 분석 실행 탭 -- 트리거 폼 + 파이프라인 모니터 + 최근 작업
function AnalysisTab({
  activeJobId,
  onJobStarted,
  onComplete,
  onSelectJob,
  onSelectShowcase,
  onNewAnalysis,
  isDemo,
}: {
  activeJobId: number | null;
  onJobStarted: (jobId: number) => void;
  onComplete: () => void;
  onSelectJob: (jobId: number) => void;
  onSelectShowcase: (jobId: number) => void;
  onNewAnalysis: () => void;
  isDemo?: boolean;
}) {
  return (
    <div className="space-y-4">
      {activeJobId ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={onNewAnalysis}
        >
          <Play className="h-4 w-4 mr-1" />새 분석 실행
        </Button>
      ) : (
        <AnalysisLauncher onJobStarted={onJobStarted} isDemo={isDemo} />
      )}
      <PipelineMonitor
        jobId={activeJobId}
        onComplete={onComplete}
        onRetry={() => {
          // 재시도 시 현재 jobId로 모니터링 유지
        }}
      />
      <RecentJobs onSelectJob={onSelectJob} onSelectShowcase={onSelectShowcase} />
    </div>
  );
}

// 결과 탭 공통 래퍼 -- "새 분석 실행" 버튼 포함
function ResultTabWrapper({
  jobId,
  onGoToAnalysis,
  children,
}: {
  jobId: number | null;
  onGoToAnalysis: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {jobId && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={onGoToAnalysis}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />새 분석 실행
        </Button>
      )}
      {children}
    </div>
  );
}

// 결과 대시보드 탭
function DashboardTab({
  jobId,
  onGoToAnalysis,
  isShowcase,
}: {
  jobId: number | null;
  onGoToAnalysis: () => void;
  isShowcase?: boolean;
}) {
  return (
    <ResultTabWrapper jobId={jobId} onGoToAnalysis={onGoToAnalysis}>
      <DashboardView
        jobId={jobId}
        fetchFn={isShowcase ? showcaseFetchResults : undefined}
        readOnly={isShowcase}
      />
    </ResultTabWrapper>
  );
}

// AI 리포트 탭
function ReportTab({
  jobId,
  onGoToAnalysis,
  isShowcase,
}: {
  jobId: number | null;
  onGoToAnalysis: () => void;
  isShowcase?: boolean;
}) {
  return (
    <ResultTabWrapper jobId={jobId} onGoToAnalysis={onGoToAnalysis}>
      <ReportView jobId={jobId} fetchFn={isShowcase ? showcaseFetchReport : undefined} />
    </ResultTabWrapper>
  );
}

// 히스토리 탭
function HistoryTabPanel({ onViewResult }: { onViewResult: (jobId: number) => void }) {
  return <HistoryTable onViewResult={onViewResult} />;
}

// 수집 데이터 탭
function CollectedDataTab({
  jobId,
  onGoToAnalysis,
}: {
  jobId: number | null;
  onGoToAnalysis: () => void;
}) {
  return (
    <ResultTabWrapper jobId={jobId} onGoToAnalysis={onGoToAnalysis}>
      <CollectedDataView jobId={jobId} />
    </ResultTabWrapper>
  );
}

// 탐색 탭 — 사용자 자체 시각화 대시보드
function ExploreTab({
  jobId,
  onGoToAnalysis,
}: {
  jobId: number | null;
  onGoToAnalysis: () => void;
}) {
  return (
    <ResultTabWrapper jobId={jobId} onGoToAnalysis={onGoToAnalysis}>
      <ExploreView jobId={jobId} />
    </ResultTabWrapper>
  );
}

// 고급 분석 탭
function AdvancedTab({
  jobId,
  onGoToAnalysis,
  isShowcase,
}: {
  jobId: number | null;
  onGoToAnalysis: () => void;
  isShowcase?: boolean;
}) {
  return (
    <ResultTabWrapper jobId={jobId} onGoToAnalysis={onGoToAnalysis}>
      <AdvancedView jobId={jobId} fetchFn={isShowcase ? showcaseFetchResults : undefined} />
    </ResultTabWrapper>
  );
}

export default function Home() {
  const { data: session } = useSession();
  const isDemo = session?.user?.role === 'demo';
  const [activeTab, setActiveTab] = useState(0);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [isShowcase, setIsShowcase] = useState(false);

  // 분석 완료 시 -- 탭 전환 없이 파이프라인 상태 화면 유지 (사용자가 직접 탭 이동)
  const handleComplete = useCallback(() => {
    // 파이프라인 모니터에서 "결과 보기" 버튼으로 이동 가능
  }, []);

  // 작업 선택 시 결과 대시보드 탭으로 전환 + jobId 설정
  const handleSelectJob = useCallback((jobId: number) => {
    setActiveJobId(jobId);
    setIsShowcase(false);
    setActiveTab(1);
  }, []);

  // 쇼케이스 항목 선택 시
  const handleSelectShowcase = useCallback((jobId: number) => {
    setActiveJobId(jobId);
    setIsShowcase(true);
    setActiveTab(1);
  }, []);

  // 분석 실행 탭으로 돌아가기 (jobId 리셋하여 PipelineMonitor 비활성화)
  const handleGoToAnalysis = useCallback(() => {
    setActiveJobId(null);
    setIsShowcase(false);
    setActiveTab(0);
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasActiveJob={activeJobId !== null}
      />
      <div className="pt-14 px-4 md:px-8">
        <DemoQuotaBanner />
      </div>
      <UpgradeModal />
      <TabLayout
        activeTab={activeTab}
        panels={[
          <AnalysisTab
            key="analysis"
            activeJobId={activeJobId}
            onJobStarted={setActiveJobId}
            onComplete={handleComplete}
            onSelectJob={handleSelectJob}
            onSelectShowcase={handleSelectShowcase}
            onNewAnalysis={handleGoToAnalysis}
            isDemo={isDemo}
          />,
          <DashboardTab
            key="dashboard"
            jobId={activeJobId}
            onGoToAnalysis={handleGoToAnalysis}
            isShowcase={isShowcase}
          />,
          <CollectedDataTab
            key="collected"
            jobId={activeJobId}
            onGoToAnalysis={handleGoToAnalysis}
          />,
          <ReportTab
            key="report"
            jobId={activeJobId}
            onGoToAnalysis={handleGoToAnalysis}
            isShowcase={isShowcase}
          />,
          <HistoryTabPanel key="history" onViewResult={handleSelectJob} />,
          <AdvancedTab
            key="advanced"
            jobId={activeJobId}
            onGoToAnalysis={handleGoToAnalysis}
            isShowcase={isShowcase}
          />,
          <ExploreTab key="explore" jobId={activeJobId} onGoToAnalysis={handleGoToAnalysis} />,
        ]}
      />
    </main>
  );
}
