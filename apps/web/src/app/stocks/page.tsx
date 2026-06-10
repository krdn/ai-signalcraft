'use client';

import { AppShell } from '@/components/layout/app-shell';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { StocksView } from '@/components/stocks/stocks-view';

export default function StocksPage() {
  return (
    <AppShell
      sidebar={(_open, onClose) => (
        <AppSidebar
          activeTab={-1}
          onTabChange={() => onClose()}
          activeJobId={null}
          isRunning={false}
          onJobSelect={() => {}}
        />
      )}
      header={(onMenuClick) => (
        <AppHeader activeTab={-1} activeJobId={null} onMenuClick={onMenuClick} />
      )}
    >
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-900">주식 분석</h1>
          <p className="mt-1 text-sm text-slate-500">
            미국 주식 티커를 다중 관점으로 분석합니다 (powered by tickerlens)
          </p>
        </div>
        <StocksView />
      </div>
    </AppShell>
  );
}
