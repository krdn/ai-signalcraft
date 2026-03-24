'use client';

import { useState, useCallback } from 'react';
import { TopNav } from '@/components/layout/top-nav';
import { TabLayout } from '@/components/layout/tab-layout';
import { TriggerForm } from '@/components/analysis/trigger-form';
import { PipelineMonitor } from '@/components/analysis/pipeline-monitor';
import { RecentJobs } from '@/components/analysis/recent-jobs';
import { HistoryTable } from '@/components/analysis/history-table';
import { ReportView } from '@/components/report/report-view';
import { DashboardView } from '@/components/dashboard/dashboard-view';

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

// 결과 대시보드 탭 -- 6개 시각화 컴포넌트 (감성/트렌드/워드클라우드/플랫폼/리스크/기회)
function DashboardTab({ jobId }: { jobId: number | null }) {
  return <DashboardView jobId={jobId} />;
}

// AI 리포트 탭 -- 마크다운 뷰어 + 섹션 네비 + PDF 내보내기
function ReportTab({ jobId }: { jobId: number | null }) {
  return <ReportView jobId={jobId} />;
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

  // 작업 선택 시 결과 대시보드 탭으로 전환 + jobId 설정
  const handleSelectJob = useCallback((jobId: number) => {
    setActiveJobId(jobId);
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
          <DashboardTab key="dashboard" jobId={activeJobId} />,
          <ReportTab key="report" jobId={activeJobId} />,
          <HistoryTabPanel key="history" onViewResult={handleSelectJob} />,
        ]}
      />
    </main>
  );
}
