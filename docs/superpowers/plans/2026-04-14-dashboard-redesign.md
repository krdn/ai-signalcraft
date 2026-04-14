# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI SignalCraft 전체 앱 UI를 사이드바 레이아웃 + 클린 라이트 + Bento Box 대시보드로 전면 리디자인한다.

**Architecture:** `TopNav` + `TabLayout` 구조를 `AppSidebar` + `AppHeader` + `AppShell`로 교체하고, `dashboard-view.tsx`를 CSS grid-cols-12 Bento Box 레이아웃으로 재배치한다. 기존 컴포넌트 로직은 유지하고 스타일 레이어만 교체한다.

**Tech Stack:** Next.js 15 App Router · React 19 · Tailwind CSS 4 · shadcn/ui · TanStack Query 5 · tRPC 11 · lucide-react

---

## 파일 구조 개요

### 신규 생성

- `apps/web/src/components/layout/app-sidebar.tsx` — 좌측 240px 사이드바 (로고 + 잡 선택기 + 네비 + 유저)
- `apps/web/src/components/layout/app-header.tsx` — 슬림 h-12 상단 헤더 (탭 제목 + 우측 액션)
- `apps/web/src/components/layout/app-shell.tsx` — 전체 레이아웃 쉘 (`flex h-screen`)

### 수정

- `apps/web/src/app/dashboard/page.tsx` — TopNav/TabLayout → AppShell로 교체
- `apps/web/src/app/layout.tsx` — body 배경색 `bg-slate-50` 추가
- `apps/web/src/components/layout/tab-layout.tsx` — pt 조정 (pt-18 → 0)
- `apps/web/src/components/dashboard/dashboard-view.tsx` — Bento grid-cols-12 레이아웃
- `apps/web/src/components/dashboard/kpi-cards.tsx` — 카드 스타일 border-t-2 액센트
- `apps/web/src/components/dashboard/insight-summary.tsx` — 카드 스타일
- `apps/web/src/components/dashboard/sentiment-chart.tsx` — 카드 스타일
- `apps/web/src/components/dashboard/trend-chart.tsx` — 카드 스타일
- `apps/web/src/components/dashboard/word-cloud.tsx` — 카드 스타일
- `apps/web/src/components/dashboard/keyword-network-graph.tsx` — 카드 스타일 (inline 수정)
- `apps/web/src/components/dashboard/platform-compare.tsx` — 카드 스타일
- `apps/web/src/components/dashboard/risk-cards.tsx` — 카드 스타일
- `apps/web/src/components/dashboard/opportunity-cards.tsx` — 카드 스타일
- `apps/web/src/components/analysis/pipeline-monitor/pipeline-header.tsx` — 스타일 업데이트
- `apps/web/src/components/analysis/pipeline-monitor/overview-tab.tsx` — 스타일 업데이트

### 삭제

- `apps/web/src/components/layout/top-nav.tsx` — AppSidebar/AppHeader로 대체

---

## Phase 1: 브랜치 생성 + 레이아웃 쉘

---

### Task 1: feature 브랜치 생성

**Files:**

- (없음 — git 명령만)

- [ ] **Step 1: 브랜치 생성**

```bash
git checkout -b feature/dashboard-redesign
```

Expected: `Switched to a new branch 'feature/dashboard-redesign'`

- [ ] **Step 2: 확인**

```bash
git branch
```

Expected: `* feature/dashboard-redesign` 가 현재 브랜치로 표시

---

### Task 2: AppShell 컴포넌트 생성

**Files:**

- Create: `apps/web/src/components/layout/app-shell.tsx`

- [ ] **Step 1: app-shell.tsx 생성**

```tsx
// apps/web/src/components/layout/app-shell.tsx
'use client';

import { type ReactNode } from 'react';

interface AppShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, header, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {sidebar}
      <div className="flex flex-1 flex-col overflow-hidden">
        {header}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm --filter @ai-signalcraft/web exec tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음 또는 기존 에러만

---

### Task 3: AppSidebar 컴포넌트 생성

**Files:**

- Create: `apps/web/src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: app-sidebar.tsx 생성**

```tsx
// apps/web/src/components/layout/app-sidebar.tsx
'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Activity,
  Brain,
  ChevronDown,
  Database,
  FileText,
  Globe,
  Handshake,
  History,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Lock,
  LogOut,
  Megaphone,
  Play,
  Settings,
  Shield,
  Telescope,
  TrendingUp,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { trpcClient } from '@/lib/trpc';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TeamSettings } from '@/components/team/team-settings';
import { ModelSettings } from '@/components/settings/model-settings';
import { ProviderKeys } from '@/components/settings/provider-keys';
import { ConcurrencySettings } from '@/components/settings/concurrency-settings';
import { CollectionLimitsSettings } from '@/components/settings/collection-limits-settings';
import { ReleaseBell } from '@/components/release-bell';
import { useTheme } from '@/lib/theme';

// 탭 인덱스 (dashboard/page.tsx panels 배열 순서와 일치)
// 0: 분석 실행, 1: 대시보드, 2: 수집 데이터, 3: AI 리포트, 4: 히스토리, 5: 고급 분석, 6: 탐색
const RESULT_TAB_INDICES = [1, 2, 3, 5, 6];

type NavItem = { label: string; icon: React.ElementType; index: number };

const ANALYSIS_ITEMS: NavItem[] = [{ label: '분석 실행', icon: Play, index: 0 }];

const RESULT_ITEMS: NavItem[] = [
  { label: '대시보드', icon: LayoutDashboard, index: 1 },
  { label: 'AI 리포트', icon: FileText, index: 3 },
  { label: '수집 데이터', icon: Database, index: 2 },
];

const ADVANCED_ITEMS: NavItem[] = [
  { label: '히스토리', icon: History, index: 4 },
  { label: '고급 분석', icon: Brain, index: 5 },
  { label: '탐색', icon: Telescope, index: 6 },
];

interface AppSidebarProps {
  activeTab: number;
  onTabChange: (index: number) => void;
  activeJobId: number | null;
  isRunning?: boolean;
}

function JobSelector({
  activeJobId,
  isRunning,
  onSelectJob,
}: {
  activeJobId: number | null;
  isRunning?: boolean;
  onSelectJob: (jobId: number) => void;
}) {
  const { data } = useQuery({
    queryKey: ['history', 'list', { page: 1, perPage: 10, scope: 'mine' }],
    queryFn: () => trpcClient.history.list.query({ page: 1, perPage: 10, scope: 'mine' }),
    enabled: !!activeJobId,
  });

  const currentJob = data?.items.find((j) => j.id === activeJobId);

  if (!activeJobId) {
    return (
      <div className="mx-3 mb-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-400">
        분석을 먼저 실행하세요
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="mx-3 mb-3 w-[calc(100%-24px)] rounded-lg border border-slate-200 bg-white px-3 py-2 text-left focus:outline-none hover:border-blue-300 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {isRunning && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                </span>
              )}
              <p className="truncate text-xs font-medium text-slate-800">
                {isRunning ? '실행 중…' : `Job #${activeJobId}`}
              </p>
            </div>
            {currentJob && !isRunning && (
              <p className="truncate text-[10px] text-slate-400">
                {format(new Date(currentJob.createdAt), 'MM/dd HH:mm')} · {currentJob.domain}
              </p>
            )}
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {data?.items.map((job) => (
          <DropdownMenuItem
            key={job.id}
            onClick={() => onSelectJob(job.id)}
            className={cn(
              'flex flex-col items-start gap-0.5 cursor-pointer',
              job.id === activeJobId && 'bg-blue-50 text-blue-700',
            )}
          >
            <span className="text-xs font-medium">Job #{job.id}</span>
            <span className="text-[10px] text-slate-400">
              {format(new Date(job.createdAt), 'MM/dd HH:mm')} · {job.domain}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavSection({
  label,
  items,
  activeTab,
  onTabChange,
  hasActiveJob,
}: {
  label: string;
  items: NavItem[];
  activeTab: number;
  onTabChange: (index: number) => void;
  hasActiveJob: boolean;
}) {
  const handleClick = (index: number) => {
    const isResultTab = RESULT_TAB_INDICES.includes(index);
    if (isResultTab && !hasActiveJob) {
      toast.info('분석을 먼저 실행해주세요', {
        description: '분석 실행 후 결과를 확인할 수 있습니다.',
        duration: 3000,
      });
      return;
    }
    onTabChange(index);
  };

  return (
    <div className="mb-1">
      <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      {items.map(({ label: itemLabel, icon: Icon, index }) => {
        const isActive = activeTab === index;
        const isResultTab = RESULT_TAB_INDICES.includes(index);
        const isDisabled = isResultTab && !hasActiveJob;
        return (
          <button
            key={index}
            onClick={() => handleClick(index)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 mx-1 text-sm font-medium transition-colors w-[calc(100%-8px)]',
              isActive
                ? 'bg-blue-50 text-blue-700'
                : isDisabled
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{itemLabel}</span>
            {isDisabled && <Lock className="h-3 w-3 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

export function AppSidebar({ activeTab, onTabChange, activeJobId, isRunning }: AppSidebarProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const userInitial = session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? '?';
  const userRole = session?.user?.role;

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* 로고 */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-100 px-4">
        <Activity className="h-5 w-5 text-blue-600" />
        <span className="text-base font-bold text-slate-900">SignalCraft</span>
      </div>

      {/* 잡 선택기 */}
      <div className="pt-3">
        <JobSelector
          activeJobId={activeJobId}
          isRunning={isRunning}
          onSelectJob={(jobId) => {
            onTabChange(1);
          }}
        />
      </div>

      {/* 분석 실행 CTA */}
      <div className="px-3 pb-2">
        <Button
          className="w-full justify-start gap-2 bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => onTabChange(0)}
        >
          <Play className="h-4 w-4" />
          분석 실행
        </Button>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto px-1 py-2">
        <NavSection
          label="결과"
          items={RESULT_ITEMS}
          activeTab={activeTab}
          onTabChange={onTabChange}
          hasActiveJob={!!activeJobId}
        />
        <NavSection
          label="고급"
          items={ADVANCED_ITEMS}
          activeTab={activeTab}
          onTabChange={onTabChange}
          hasActiveJob={!!activeJobId}
        />
      </nav>

      {/* 하단: 유저 영역 */}
      <div className="shrink-0 border-t border-slate-100 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-slate-50 transition-colors focus:outline-none">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                {userInitial.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-800">
                {session?.user?.name ?? '사용자'}
              </p>
              <p className="truncate text-[10px] text-slate-400">{session?.user?.email}</p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56 mb-1">
            <DropdownMenuItem className="p-0">
              <Link href="/" className="flex w-full items-center gap-2 px-2 py-1.5 text-sm">
                <Globe className="h-4 w-4" />
                홈페이지
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-0">
              <Link
                href="/changelog"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-sm"
              >
                <Megaphone className="h-4 w-4" />
                업데이트 히스토리
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-0">
              <Link href="/feedback" className="flex w-full items-center gap-2 px-2 py-1.5 text-sm">
                <Lightbulb className="h-4 w-4" />
                기능 제안
              </Link>
            </DropdownMenuItem>
            {userRole === 'admin' && (
              <DropdownMenuItem className="p-0">
                <Link href="/admin" className="flex w-full items-center gap-2 px-2 py-1.5 text-sm">
                  <Shield className="h-4 w-4" />
                  관리자
                </Link>
              </DropdownMenuItem>
            )}
            {['admin', 'sales'].includes(userRole ?? '') && (
              <DropdownMenuItem className="p-0">
                <Link href="/sales" className="flex w-full items-center gap-2 px-2 py-1.5 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  영업관리
                </Link>
              </DropdownMenuItem>
            )}
            {['admin', 'sales', 'partner'].includes(userRole ?? '') && (
              <DropdownMenuItem className="p-0">
                <Link
                  href="/partner"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm"
                >
                  <Handshake className="h-4 w-4" />
                  파트너
                </Link>
              </DropdownMenuItem>
            )}
            {['admin', 'sales', 'partner'].includes(userRole ?? '') && (
              <DropdownMenuItem className="p-0">
                <Link href="/docs" className="flex w-full items-center gap-2 px-2 py-1.5 text-sm">
                  <Layers className="h-4 w-4" />
                  기술 문서
                </Link>
              </DropdownMenuItem>
            )}
            <Dialog>
              <DialogTrigger
                nativeButton={false}
                render={
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer text-sm px-2 py-1.5"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Users className="h-4 w-4" />팀 설정
                  </DropdownMenuItem>
                }
              />
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>팀 설정</DialogTitle>
                </DialogHeader>
                <TeamSettings />
              </DialogContent>
            </Dialog>
            {userRole === 'admin' && (
              <Dialog>
                <DialogTrigger
                  nativeButton={false}
                  render={
                    <DropdownMenuItem
                      className="flex items-center gap-2 cursor-pointer text-sm px-2 py-1.5"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Settings className="h-4 w-4" />
                      AI 설정
                    </DropdownMenuItem>
                  }
                />
                <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>AI 설정</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="provider-keys" className="flex flex-col min-h-0 flex-1">
                    <TabsList className="w-full shrink-0">
                      <TabsTrigger value="provider-keys">API 키 관리</TabsTrigger>
                      <TabsTrigger value="model-settings">모듈별 모델</TabsTrigger>
                      <TabsTrigger value="concurrency">병렬처리</TabsTrigger>
                      <TabsTrigger value="collection-limits">수집 한도</TabsTrigger>
                    </TabsList>
                    <TabsContent value="provider-keys" className="mt-4 overflow-y-auto min-h-0">
                      <ProviderKeys />
                    </TabsContent>
                    <TabsContent value="model-settings" className="mt-4 overflow-y-auto min-h-0">
                      <ModelSettings />
                    </TabsContent>
                    <TabsContent value="concurrency" className="mt-4 overflow-y-auto min-h-0">
                      <ConcurrencySettings />
                    </TabsContent>
                    <TabsContent value="collection-limits" className="mt-4 overflow-y-auto min-h-0">
                      <CollectionLimitsSettings />
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center justify-between cursor-pointer text-sm px-2 py-1.5"
              onSelect={(e) => e.preventDefault()}
            >
              <span>다크 모드</span>
              <Switch
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="p-0">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-destructive cursor-pointer"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                <LogOut className="h-4 w-4" />
                로그아웃
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm --filter @ai-signalcraft/web exec tsc --noEmit 2>&1 | head -30
```

Expected: 새로운 타입 에러 없음

---

### Task 4: AppHeader 컴포넌트 생성

**Files:**

- Create: `apps/web/src/components/layout/app-header.tsx`

- [ ] **Step 1: app-header.tsx 생성**

```tsx
// apps/web/src/components/layout/app-header.tsx
'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { ReleaseBell } from '@/components/release-bell';
import { DemoQuotaBanner } from '@/components/demo/demo-quota-banner';

// 탭 인덱스별 제목 매핑
const TAB_TITLES: Record<number, { title: string; subtitle?: string }> = {
  0: { title: '분석 실행' },
  1: { title: '대시보드' },
  2: { title: '수집 데이터' },
  3: { title: 'AI 리포트' },
  4: { title: '히스토리' },
  5: { title: '고급 분석' },
  6: { title: '탐색' },
};

interface AppHeaderProps {
  activeTab: number;
  activeJobId: number | null;
}

export function AppHeader({ activeTab, activeJobId }: AppHeaderProps) {
  const tabInfo = TAB_TITLES[activeTab] ?? { title: '' };

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white">
      <div className="flex h-12 items-center justify-between px-6">
        {/* 왼쪽: 탭 제목 */}
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-slate-900">{tabInfo.title}</h1>
          {activeJobId && activeTab !== 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">Job #{activeJobId}</span>
            </>
          )}
        </div>

        {/* 오른쪽: 액션 */}
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
```

- [ ] **Step 2: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm --filter @ai-signalcraft/web exec tsc --noEmit 2>&1 | head -30
```

Expected: 새로운 타입 에러 없음

---

### Task 5: dashboard/page.tsx를 AppShell로 교체

**Files:**

- Modify: `apps/web/src/app/dashboard/page.tsx`
- Modify: `apps/web/src/components/layout/tab-layout.tsx`

- [ ] **Step 1: tab-layout.tsx 패딩 제거**

`apps/web/src/components/layout/tab-layout.tsx`의 `pt-18`을 제거한다:

```tsx
'use client';

import { type ReactNode } from 'react';

interface TabLayoutProps {
  activeTab: number;
  panels: ReactNode[];
}

export function TabLayout({ activeTab, panels }: TabLayoutProps) {
  return <div className="h-full">{panels[activeTab]}</div>;
}
```

- [ ] **Step 2: dashboard/page.tsx의 import를 AppShell로 교체**

`apps/web/src/app/dashboard/page.tsx` 상단 import 블록에서 `TopNav` 제거, `AppShell`/`AppSidebar`/`AppHeader` 추가:

```tsx
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
```

- [ ] **Step 3: Home 컴포넌트의 return 블록 교체**

`export default function Home()` 안의 return 블록 전체를 아래로 교체한다:

```tsx
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
```

- [ ] **Step 4: top-nav.tsx 삭제**

```bash
rm apps/web/src/components/layout/top-nav.tsx
```

- [ ] **Step 5: 타입 체크 및 빌드 확인**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm --filter @ai-signalcraft/web exec tsc --noEmit 2>&1 | head -40
```

Expected: 새로운 타입 에러 없음

- [ ] **Step 6: 개발 서버 실행 후 시각 확인**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm dev
```

브라우저에서 `http://localhost:3000/dashboard` 접속 → 사이드바가 왼쪽에 표시되고, 탭 전환이 동작하는지 확인

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/components/layout/app-shell.tsx \
  apps/web/src/components/layout/app-sidebar.tsx \
  apps/web/src/components/layout/app-header.tsx \
  apps/web/src/components/layout/tab-layout.tsx \
  apps/web/src/app/dashboard/page.tsx
git commit -m "feat: TopNav → AppShell(사이드바+헤더) 레이아웃 교체"
```

> **Note:** Task 11에서 AppShell/AppHeader 시그니처가 모바일 대응을 위해 함수형 props로 변경됩니다. Task 5는 기능 동작 확인용 초기 버전이며, Task 11 완료 후 최종 형태로 대체됩니다.

---

## Phase 2: 대시보드 탭 Bento Box

---

### Task 6: dashboard-view.tsx Bento 그리드 레이아웃 적용

**Files:**

- Modify: `apps/web/src/components/dashboard/dashboard-view.tsx`

- [ ] **Step 1: return 블록의 최상위 div 교체**

`dashboard-view.tsx`의 `return (` 내부에서 `<div className="space-y-6">` 부터 시작하는 래퍼를 아래 Bento 그리드로 교체한다:

```tsx
return (
  <div className="space-y-4">
    {/* 비교 분석 셀렉터 */}
    {!readOnly && (
      <>
        <CompareSelector
          currentJobId={jobId}
          compareJobId={compareJobId}
          onSelect={setCompareJobId}
        />
        {compareJobId && <CompareView baseJobId={jobId} compareJobId={compareJobId} />}
      </>
    )}

    {/* KPI 카드 행 — 4균등 */}
    <KpiCards
      totalMentions={totalMentions}
      articleCount={dbArticleCount}
      commentCount={dbCommentCount}
      sentimentRatio={sentimentData ?? null}
      topKeyword={topKeywordText}
      overallDirection={overallDirection}
    />

    {/* AI 인사이트 요약 */}
    <InsightSummary
      oneLiner={insightOneLiner}
      currentState={insightCurrentState}
      criticalActions={insightActions}
    />

    {/* Bento Box 그리드 — grid-cols-12 */}
    <div className="grid grid-cols-12 gap-4">
      {/* 트렌드 차트 — 7칸 */}
      <div className="col-span-12 lg:col-span-7">
        <TrendChart data={trendData} events={trendEvents} />
      </div>
      {/* 감성 도넛 — 5칸 */}
      <div className="col-span-12 lg:col-span-5">
        <SentimentChart data={sentimentData ?? null} />
      </div>

      {/* 워드 클라우드 — 4칸 */}
      <div className="col-span-12 lg:col-span-4">
        <WordCloud words={wordCloudData} />
      </div>
      {/* 키워드 네트워크 — 8칸 */}
      {keywordNetworkData && keywordNetworkData.nodes.length > 0 && (
        <div className="col-span-12 lg:col-span-8">
          <Card className="h-full border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">키워드 네트워크</h3>
                <CardHelp {...DASHBOARD_HELP.keywordNetwork} />
              </div>
              <KeywordNetworkGraph data={keywordNetworkData} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* 플랫폼 비교 — 6칸 */}
      <div className="col-span-12 lg:col-span-6">
        <PlatformCompare articles={platformArticles} comments={platformComments} />
      </div>
      {/* 리스크 카드 — 6칸 */}
      <div className="col-span-12 lg:col-span-6">
        <RiskCards risks={risks} />
      </div>

      {/* 기회 카드 — 전체 너비 */}
      <div className="col-span-12">
        <OpportunityCards opportunities={opportunities} />
      </div>
    </div>

    {/* 지식 그래프 — 전체 너비 */}
    <KnowledgeGraphSection jobId={jobId} />
  </div>
);
```

- [ ] **Step 2: 개발 서버에서 대시보드 탭 시각 확인**

브라우저에서 분석 결과가 있는 잡 선택 후 대시보드 탭 → Bento 그리드 레이아웃 확인

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/dashboard/dashboard-view.tsx
git commit -m "feat: 대시보드 Bento Box grid-cols-12 레이아웃 적용"
```

---

### Task 7: 대시보드 카드 스타일 통일 (border-t-2 액센트)

**Files:**

- Modify: `apps/web/src/components/dashboard/kpi-cards.tsx`
- Modify: `apps/web/src/components/dashboard/insight-summary.tsx`
- Modify: `apps/web/src/components/dashboard/sentiment-chart.tsx`
- Modify: `apps/web/src/components/dashboard/trend-chart.tsx`
- Modify: `apps/web/src/components/dashboard/word-cloud.tsx`
- Modify: `apps/web/src/components/dashboard/platform-compare.tsx`
- Modify: `apps/web/src/components/dashboard/risk-cards.tsx`
- Modify: `apps/web/src/components/dashboard/opportunity-cards.tsx`

공통 카드 스타일: `className="border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"`

- [ ] **Step 1: kpi-cards.tsx — 카드 액센트 색상 추가**

`kpi-cards.tsx`의 `<Card key={card.title}>` 를 아래로 교체:

```tsx
const CARD_ACCENT: Record<string, string> = {
  '총 수집량': 'border-t-2 border-t-blue-500',
  '주요 감성': 'border-t-2 border-t-emerald-500',
  '핵심 키워드': 'border-t-2 border-t-violet-500',
  '여론 방향': 'border-t-2 border-t-amber-400',
};

// cards.map 내부의 Card를:
<Card
  key={card.title}
  className={cn(
    'border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all',
    CARD_ACCENT[card.title],
  )}
>
```

`cn` import 추가: `import { cn } from '@/lib/utils';`

- [ ] **Step 2: insight-summary.tsx 카드 스타일**

`insight-summary.tsx`에서 최상위 `<Card` 에 아래 className 추가:

```tsx
<Card className="border-t-2 border-t-violet-500 border-slate-100 shadow-sm hover:shadow-md transition-all">
```

- [ ] **Step 3: sentiment-chart.tsx 카드 스타일**

`sentiment-chart.tsx`의 최상위 `<Card` className:

```tsx
<Card className="h-full border-t-2 border-t-emerald-500 border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
```

- [ ] **Step 4: trend-chart.tsx 카드 스타일**

`trend-chart.tsx`의 최상위 `<Card` className:

```tsx
<Card className="h-full border-t-2 border-t-blue-500 border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
```

- [ ] **Step 5: word-cloud.tsx 카드 스타일**

`word-cloud.tsx`의 최상위 `<Card` className:

```tsx
<Card className="h-full border-t-2 border-t-violet-500 border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
```

- [ ] **Step 6: platform-compare.tsx 카드 스타일**

`platform-compare.tsx`의 최상위 `<Card` className:

```tsx
<Card className="h-full border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
```

- [ ] **Step 7: risk-cards.tsx 카드 스타일**

`risk-cards.tsx`의 최상위 `<Card` className:

```tsx
<Card className="h-full border-t-2 border-t-red-400 border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
```

- [ ] **Step 8: opportunity-cards.tsx 카드 스타일**

`opportunity-cards.tsx`의 최상위 `<Card` className:

```tsx
<Card className="h-full border-t-2 border-t-amber-400 border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
```

- [ ] **Step 9: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm --filter @ai-signalcraft/web exec tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 10: 시각 확인**

브라우저에서 대시보드 탭 → 각 카드 상단에 컬러 액센트 라인 확인, 호버 시 shadow 증가 확인

- [ ] **Step 11: 커밋**

```bash
git add apps/web/src/components/dashboard/
git commit -m "feat: 대시보드 카드 border-t-2 액센트 스타일 적용"
```

---

## Phase 3: 분석 실행 탭 리디자인

---

### Task 8: 분석 런처 카드형 중앙 정렬로 래핑

**Files:**

- Modify: `apps/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: AnalysisTab 함수 내 jobId 없을 때 래퍼 추가**

`dashboard/page.tsx`의 `AnalysisTab` 함수에서 `AnalysisLauncher` 렌더링 부분을 아래로 교체:

```tsx
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
```

- [ ] **Step 2: 시각 확인**

브라우저에서 분석 실행 탭(jobId 없을 때) → 중앙 정렬된 카드형 런처 확인

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/app/dashboard/page.tsx
git commit -m "feat: 분석 실행 탭 카드형 중앙 정렬 레이아웃 적용"
```

---

## Phase 4: 나머지 탭 스타일 정비

---

### Task 9: 글로벌 배경색 + 공통 카드 스타일 정비

**Files:**

- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: globals.css 또는 layout.tsx body에 배경색 확인**

```bash
grep -n "bg-background\|bg-slate\|background" /home/gon/projects/ai/ai-signalcraft/apps/web/src/app/globals.css | head -20
```

- [ ] **Step 2: body에 bg-slate-50 추가**

`apps/web/src/app/layout.tsx`의 `<body` 태그에 `className="bg-slate-50"` 추가:

```tsx
<body className="bg-slate-50" suppressHydrationWarning>
  <Providers>{children}</Providers>
  <ServiceWorkerRegistrar />
</body>
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "style: body 기본 배경 bg-slate-50 설정"
```

---

### Task 10: 다크 모드 호환성 확인 및 사이드바 다크 스타일

**Files:**

- Modify: `apps/web/src/components/layout/app-sidebar.tsx`
- Modify: `apps/web/src/components/layout/app-shell.tsx`

- [ ] **Step 1: app-shell.tsx에 dark 모드 배경 추가**

```tsx
<div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-background">
```

- [ ] **Step 2: app-sidebar.tsx aside 태그에 dark 모드 클래스 추가**

```tsx
<aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
```

- [ ] **Step 3: 브라우저에서 다크 모드 전환 테스트**

사이드바 하단 유저 메뉴 → 다크 모드 토글 → 사이드바/헤더/배경 색상 정상 전환 확인

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/layout/app-sidebar.tsx \
  apps/web/src/components/layout/app-shell.tsx
git commit -m "style: 다크 모드 사이드바/쉘 배경색 적용"
```

---

### Task 11: 모바일 반응형 — 사이드바 오버레이

**Files:**

- Modify: `apps/web/src/components/layout/app-sidebar.tsx`
- Modify: `apps/web/src/components/layout/app-shell.tsx`
- Modify: `apps/web/src/components/layout/app-header.tsx`

- [ ] **Step 1: AppShell에 모바일 사이드바 상태 추가**

`app-shell.tsx`를 아래로 교체:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';

interface AppShellProps {
  sidebar: (open: boolean, onClose: () => void) => ReactNode;
  header: (onMenuClick: () => void) => ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, header, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-background">
      {/* 데스크톱: 항상 표시 */}
      <div className="hidden md:flex">{sidebar(false, () => {})}</div>

      {/* 모바일: 오버레이 */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 flex h-full">
            {sidebar(true, () => setSidebarOpen(false))}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {header(() => setSidebarOpen(true))}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: AppHeader에 햄버거 버튼 추가**

`app-header.tsx`의 props에 `onMenuClick` 추가:

```tsx
interface AppHeaderProps {
  activeTab: number;
  activeJobId: number | null;
  onMenuClick?: () => void;
}

export function AppHeader({ activeTab, activeJobId, onMenuClick }: AppHeaderProps) {
  // ...기존 코드...
  return (
    <header className="shrink-0 border-b border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
      <div className="flex h-12 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          {/* 모바일 햄버거 */}
          <button
            onClick={onMenuClick}
            className="mr-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {tabInfo.title}
          </h1>
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
```

- [ ] **Step 3: dashboard/page.tsx에서 AppShell 시그니처 변경 반영**

`dashboard/page.tsx`의 AppShell 사용부를 새 함수형 props로 교체:

```tsx
return (
  <>
    <AppShell
      sidebar={(_, onClose) => (
        <AppSidebar
          activeTab={activeTab}
          onTabChange={(index) => {
            setActiveTab(index);
            onClose();
          }}
          activeJobId={activeJobId}
          isRunning={isRunning}
        />
      )}
      header={(onMenuClick) => (
        <AppHeader activeTab={activeTab} activeJobId={activeJobId} onMenuClick={onMenuClick} />
      )}
    >
      <TabLayout
        activeTab={activeTab}
        panels={
          [
            /* 기존과 동일 */
          ]
        }
      />
    </AppShell>
    <UpgradeModal />
  </>
);
```

- [ ] **Step 4: 모바일 브라우저(또는 DevTools 375px)에서 확인**

햄버거 → 사이드바 오버레이 표시 → 배경 클릭 시 닫힘 확인

- [ ] **Step 5: 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm --filter @ai-signalcraft/web exec tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/components/layout/ apps/web/src/app/dashboard/page.tsx
git commit -m "feat: 모바일 사이드바 오버레이 + 햄버거 메뉴 추가"
```

---

## Phase 5: 검토 및 마무리

---

### Task 12: 전체 플로우 E2E 시각 검토

**Files:**

- (없음 — 확인만)

- [ ] **Step 1: 개발 서버 재시작**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm dev
```

- [ ] **Step 2: 전체 플로우 확인 체크리스트**

브라우저에서 아래 항목을 순서대로 확인:

1. `/dashboard` 접속 → 사이드바 표시, 분석 실행 탭 중앙 카드형 런처
2. 분석 실행 → 잡 선택기에 `● 실행 중` 배지 표시
3. 분석 완료 → 대시보드 탭 클릭 → Bento 그리드 레이아웃 확인
4. 카드 호버 → shadow/border 변화 확인
5. 히스토리 탭 → 잡 선택 시 잡 선택기 업데이트 확인
6. 다크 모드 토글 → 사이드바/헤더/배경 정상 전환 확인
7. 브라우저 375px 너비 → 햄버거 표시, 사이드바 오버레이 동작 확인
8. `jobId` 없을 때 결과 탭 클릭 → toast 안내 표시 확인

- [ ] **Step 3: 린트 통과 확인**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm lint 2>&1 | tail -20
```

Expected: 에러 0건

- [ ] **Step 4: 타입 체크 최종 확인**

```bash
cd /home/gon/projects/ai/ai-signalcraft && pnpm --filter @ai-signalcraft/web exec tsc --noEmit 2>&1
```

Expected: 에러 없음

---

### Task 13: PR 생성

**Files:**

- (없음 — git 명령만)

- [ ] **Step 1: 최종 커밋 상태 확인**

```bash
git log --oneline main..feature/dashboard-redesign
```

- [ ] **Step 2: PR 생성**

```bash
gh pr create \
  --title "feat: 대시보드 전면 리디자인 (사이드바 + Bento Box)" \
  --body "$(cat <<'EOF'
## Summary

- TopNav → AppSidebar(240px) + AppHeader(h-12) 레이아웃 교체
- 분석 잡 선택기를 사이드바에 내장, 실행 중 펄스 배지 표시
- 대시보드 탭 grid-cols-12 Bento Box 그리드 레이아웃 적용
- 카드별 border-t-2 컬러 액센트 + hover shadow 효과
- 분석 실행 탭 중앙 카드형 런처 UI 개선
- 모바일 사이드바 오버레이 + 햄버거 메뉴 추가
- 다크 모드 호환성 유지

## Test plan

- [ ] 분석 실행 → 파이프라인 모니터 정상 표시
- [ ] 대시보드 탭 Bento 그리드 레이아웃 시각 확인
- [ ] 다크 모드 전환 정상 동작
- [ ] 모바일(375px) 사이드바 오버레이 동작
- [ ] jobId 없을 때 결과 탭 잠금 동작 확인
- [ ] 타입 체크 및 린트 통과

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --base main \
  --head feature/dashboard-redesign
```
