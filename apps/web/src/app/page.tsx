'use client';

import { useState } from 'react';
import { TopNav } from '@/components/layout/top-nav';
import { TabLayout } from '@/components/layout/tab-layout';

// 탭 컨텐츠 placeholder -- Task 3에서 실제 컴포넌트로 교체
function AnalysisTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <p className="text-lg font-semibold">분석 실행</p>
      <p className="text-sm">Task 3에서 구현됩니다</p>
    </div>
  );
}

function DashboardTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <p className="text-lg font-semibold">결과 대시보드</p>
      <p className="text-sm">Plan 03에서 구현됩니다</p>
    </div>
  );
}

function ReportTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <p className="text-lg font-semibold">AI 리포트</p>
      <p className="text-sm">Plan 04에서 구현됩니다</p>
    </div>
  );
}

function HistoryTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <p className="text-lg font-semibold">히스토리</p>
      <p className="text-sm">Task 3에서 구현됩니다</p>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <main className="min-h-screen bg-background">
      <TopNav activeTab={activeTab} onTabChange={setActiveTab} />
      <TabLayout
        activeTab={activeTab}
        panels={[
          <AnalysisTab key="analysis" />,
          <DashboardTab key="dashboard" />,
          <ReportTab key="report" />,
          <HistoryTab key="history" />,
        ]}
      />
    </main>
  );
}
