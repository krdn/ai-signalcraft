'use client';

import { useState, useCallback } from 'react';
import { TopNav } from '@/components/layout/top-nav';
import { TabLayout } from '@/components/layout/tab-layout';
import { TriggerForm } from '@/components/analysis/trigger-form';
import { PipelineMonitor } from '@/components/analysis/pipeline-monitor';
import { RecentJobs } from '@/components/analysis/recent-jobs';
import { HistoryTable } from '@/components/analysis/history-table';

// 분석 실행 탭 -- 트리거 폼 + 파이프라인 모니터 + 최근 작업
function AnalysisTab({
  activeJobId,
  onJobStarted,
  onComplete,
  onSelectJob,
}: {
  activeJobId: number | null;
  onJobStarted: (jobId: number) => void;
  onComplete: () => void;
  onSelectJob: (jobId: number) => void;
}) {
  return (
    <div className="space-y-4">
      <TriggerForm onJobStarted={onJobStarted} />
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

// 결과 대시보드 탭 -- Plan 03에서 구현
function DashboardTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <p className="text-lg font-semibold">결과 대시보드</p>
      <p className="text-sm mt-2">분석 실행 탭에서 새 분석을 시작하거나, 히스토리에서 이전 결과를 선택하세요.</p>
    </div>
  );
}

// AI 리포트 탭 -- Plan 04에서 구현
function ReportTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <p className="text-lg font-semibold">AI 리포트</p>
      <p className="text-sm mt-2">Plan 04에서 구현됩니다</p>
    </div>
  );
}

// 히스토리 탭 -- 과거 분석 목록 (조회만, 비교 기능은 deferred)
function HistoryTabPanel({ onViewResult }: { onViewResult: (jobId: number) => void }) {
  return <HistoryTable onViewResult={onViewResult} />;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  // 분석 완료 시 결과 대시보드 탭으로 전환
  const handleComplete = useCallback(() => {
    setActiveTab(1);
  }, []);

  // 작업 선택 시 결과 대시보드 탭으로 전환
  const handleSelectJob = useCallback((_jobId: number) => {
    setActiveTab(1);
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
          />,
          <DashboardTab key="dashboard" />,
          <ReportTab key="report" />,
          <HistoryTabPanel key="history" onViewResult={handleSelectJob} />,
        ]}
      />
    </main>
  );
}
