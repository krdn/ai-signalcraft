'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Play } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
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
import { UpgradeModal } from '@/components/demo/upgrade-modal';
import { trpcClient } from '@/lib/trpc';

const showcaseFetchResults = (jobId: number) => trpcClient.showcase.getResults.query({ jobId });
const showcaseFetchReport = (jobId: number) => trpcClient.showcase.getReport.query({ jobId });

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
  if (activeJobId) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={onNewAnalysis}
        >
          <Play className="h-4 w-4 mr-1" />새 분석 실행
        </Button>
        <PipelineMonitor jobId={activeJobId} onComplete={onComplete} onRetry={() => {}} />
        <RecentJobs onSelectJob={onSelectJob} onSelectShowcase={onSelectShowcase} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-slate-900">새 여론 분석 시작</h2>
          <p className="mt-1 text-sm text-slate-500">
            키워드와 수집 소스를 설정하고 AI 분석을 실행하세요
          </p>
        </div>
        <AnalysisLauncher onJobStarted={onJobStarted} isDemo={isDemo} />
        <div className="mt-6">
          <RecentJobs onSelectJob={onSelectJob} onSelectShowcase={onSelectShowcase} />
        </div>
      </div>
    </div>
  );
}

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

function HistoryTabPanel({ onViewResult }: { onViewResult: (jobId: number) => void }) {
  return <HistoryTable onViewResult={onViewResult} />;
}

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
  const [isRunning, setIsRunning] = useState(false);

  const handleComplete = useCallback(() => {
    setIsRunning(false);
  }, []);

  const handleSelectJob = useCallback((jobId: number) => {
    setActiveJobId(jobId);
    setIsShowcase(false);
    setActiveTab(1);
  }, []);

  const handleSelectShowcase = useCallback((jobId: number) => {
    setActiveJobId(jobId);
    setIsShowcase(true);
    setActiveTab(1);
  }, []);

  const handleGoToAnalysis = useCallback(() => {
    setActiveJobId(null);
    setIsShowcase(false);
    setActiveTab(0);
  }, []);

  const handleJobStarted = useCallback((jobId: number) => {
    setActiveJobId(jobId);
    setIsRunning(true);
  }, []);

  return (
    <>
      <AppShell
        sidebar={
          <AppSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            activeJobId={activeJobId}
            isRunning={isRunning}
          />
        }
        header={<AppHeader activeTab={activeTab} activeJobId={activeJobId} />}
      >
        <TabLayout
          activeTab={activeTab}
          panels={[
            <AnalysisTab
              key="analysis"
              activeJobId={activeJobId}
              onJobStarted={handleJobStarted}
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
      </AppShell>
      <UpgradeModal />
    </>
  );
}
