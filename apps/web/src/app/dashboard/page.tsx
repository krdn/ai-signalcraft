'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { TopNav } from '@/components/layout/top-nav';
import { TabLayout } from '@/components/layout/tab-layout';
import { TriggerForm } from '@/components/analysis/trigger-form';
import { PipelineMonitor } from '@/components/analysis/pipeline-monitor';
import { RecentJobs } from '@/components/analysis/recent-jobs';
import { HistoryTable } from '@/components/analysis/history-table';
import { ReportView } from '@/components/report/report-view';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { CollectedDataView } from '@/components/dashboard/collected-data-view';
import { AdvancedView } from '@/components/advanced/advanced-view';
import { Button } from '@/components/ui/button';

// 분석 실행 탭 -- 트리거 폼 + 파이프라인 모니터 + 최근 작업
function AnalysisTab({
  activeJobId,
  onJobStarted,
  onComplete,
  onSelectJob,
  onNewAnalysis,
}: {
  activeJobId: number | null;
  onJobStarted: (jobId: number) => void;
  onComplete: () => void;
  onSelectJob: (jobId: number) => void;
  onNewAnalysis: () => void;
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
        <TriggerForm onJobStarted={onJobStarted} />
      )}
      <PipelineMonitor
        jobId={activeJobId}
        onComplete={onComplete}
        onRetry={() => {
          // 재시도 시 현재 jobId로 모니터링 유지
        }}
      />
      <RecentJobs onSelectJob={onSelectJob} />
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
}: {
  jobId: number | null;
  onGoToAnalysis: () => void;
}) {
  return (
    <ResultTabWrapper jobId={jobId} onGoToAnalysis={onGoToAnalysis}>
      <DashboardView jobId={jobId} />
    </ResultTabWrapper>
  );
}

// AI 리포트 탭
function ReportTab({
  jobId,
  onGoToAnalysis,
}: {
  jobId: number | null;
  onGoToAnalysis: () => void;
}) {
  return (
    <ResultTabWrapper jobId={jobId} onGoToAnalysis={onGoToAnalysis}>
      <ReportView jobId={jobId} />
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

// 고급 분석 탭
function AdvancedTab({
  jobId,
  onGoToAnalysis,
}: {
  jobId: number | null;
  onGoToAnalysis: () => void;
}) {
  return (
    <ResultTabWrapper jobId={jobId} onGoToAnalysis={onGoToAnalysis}>
      <AdvancedView jobId={jobId} />
    </ResultTabWrapper>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  // 분석 완료 시 -- 탭 전환 없이 파이프라인 상태 화면 유지 (사용자가 직접 탭 이동)
  const handleComplete = useCallback(() => {
    // 파이프라인 모니터에서 "결과 보기" 버튼으로 이동 가능
  }, []);

  // 작업 선택 시 결과 대시보드 탭으로 전환 + jobId 설정
  const handleSelectJob = useCallback((jobId: number) => {
    setActiveJobId(jobId);
    setActiveTab(0);
  }, []);

  // 분석 실행 탭으로 돌아가기 (jobId 리셋하여 PipelineMonitor 비활성화)
  const handleGoToAnalysis = useCallback(() => {
    setActiveJobId(null);
    setActiveTab(0);
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <TopNav activeTab={activeTab} onTabChange={setActiveTab} />
      <TabLayout
        activeTab={activeTab}
        panels={[
          <AnalysisTab
            key="analysis"
            activeJobId={activeJobId}
            onJobStarted={setActiveJobId}
            onComplete={handleComplete}
            onSelectJob={handleSelectJob}
            onNewAnalysis={handleGoToAnalysis}
          />,
          <DashboardTab key="dashboard" jobId={activeJobId} onGoToAnalysis={handleGoToAnalysis} />,
          <CollectedDataTab
            key="collected"
            jobId={activeJobId}
            onGoToAnalysis={handleGoToAnalysis}
          />,
          <ReportTab key="report" jobId={activeJobId} onGoToAnalysis={handleGoToAnalysis} />,
          <HistoryTabPanel key="history" onViewResult={handleSelectJob} />,
          <AdvancedTab key="advanced" jobId={activeJobId} onGoToAnalysis={handleGoToAnalysis} />,
        ]}
      />
    </main>
  );
}
