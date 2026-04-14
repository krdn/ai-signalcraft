'use client';

import Link from 'next/link';
import { BookOpen, Menu } from 'lucide-react';
import { ReleaseBell } from '@/components/release-bell';
import { DemoQuotaBanner } from '@/components/demo/demo-quota-banner';

const TAB_TITLES: Record<number, string> = {
  0: '분석 실행',
  1: '대시보드',
  2: '수집 데이터',
  3: 'AI 리포트',
  4: '히스토리',
  5: '고급 분석',
  6: '탐색',
};

interface AppHeaderProps {
  activeTab: number;
  activeJobId: number | null;
  onMenuClick?: () => void;
}

export function AppHeader({ activeTab, activeJobId, onMenuClick }: AppHeaderProps) {
  const title = TAB_TITLES[activeTab] ?? '';

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
      <div className="flex h-12 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <button
            onClick={onMenuClick}
            className="mr-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          {activeJobId && activeTab !== 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">Job #{activeJobId}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/whitepaper"
            target="_blank"
            rel="noopener"
            className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 lg:flex"
          >
            <BookOpen className="h-3.5 w-3.5" />
            제품소개
          </Link>
          <ReleaseBell />
        </div>
      </div>
      <DemoQuotaBanner />
    </header>
  );
}
