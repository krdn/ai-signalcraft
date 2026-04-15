'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowLeft,
  Brain,
  Database,
  FileText,
  History,
  LayoutDashboard,
  Play,
  Telescope,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TABS: { label: string; icon: LucideIcon; key: string }[] = [
  { label: '분석 실행', icon: Play, key: 'pipeline' },
  { label: '결과 대시보드', icon: LayoutDashboard, key: 'dashboard' },
  { label: '수집 데이터', icon: Database, key: 'collected' },
  { label: 'AI 리포트', icon: FileText, key: 'report' },
  { label: '히스토리', icon: History, key: 'history' },
  { label: '고급 분석', icon: Brain, key: 'advanced' },
  { label: '탐색', icon: Telescope, key: 'explore' },
];

interface ShowcaseSidebarProps {
  keyword: string;
  activeTab: number;
  onTabChange: (index: number) => void;
}

export function ShowcaseSidebar({ keyword, activeTab, onTabChange }: ShowcaseSidebarProps) {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
      {/* 로고 */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-100 px-4">
        <Activity className="h-5 w-5 text-blue-600" />
        <span className="text-base font-bold text-slate-900 dark:text-slate-100">SignalCraft</span>
      </div>

      {/* 키워드 + 돌아가기 */}
      <div className="px-3 pt-3 pb-2 space-y-2">
        <Link href="/#showcase">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-1.5 text-slate-500 hover:text-slate-800 px-2"
          >
            <ArrowLeft className="h-4 w-4" />
            돌아가기
          </Button>
        </Link>
        <div className="mx-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[10px] text-slate-400 mb-0.5">분석 키워드</p>
          <p className="text-sm font-semibold text-slate-800 truncate">{keyword}</p>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <nav className="flex-1 overflow-y-auto px-1 py-2">
        <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          분석 결과
        </p>
        {TABS.map(({ label, icon: Icon, key }, idx) => (
          <button
            key={key}
            onClick={() => onTabChange(idx)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              activeTab === idx
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
          </button>
        ))}
      </nav>

      {/* 하단 CTA */}
      <div className="shrink-0 border-t border-slate-100 p-3">
        <p className="text-xs text-slate-400 mb-2 text-center">
          AI SignalCraft로 직접 분석해 보세요
        </p>
        <Link href="/demo">
          <Button className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
            무료 체험 시작
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </Button>
        </Link>
      </div>
    </aside>
  );
}
