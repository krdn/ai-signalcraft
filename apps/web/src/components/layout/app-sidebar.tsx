'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Activity,
  Brain,
  BrainCircuit,
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
import { TeamSettings } from '@/components/team/team-settings';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { useTheme } from '@/lib/theme';

const RESULT_TAB_INDICES = [1, 2, 3, 5, 6, 7];

type NavItem = { label: string; icon: React.ElementType; index: number };

const RESULT_ITEMS: NavItem[] = [
  { label: '대시보드', icon: LayoutDashboard, index: 1 },
  { label: 'AI 리포트', icon: FileText, index: 3 },
  { label: '수집 데이터', icon: Database, index: 2 },
];

const ADVANCED_ITEMS: NavItem[] = [
  { label: '히스토리', icon: History, index: 4 },
  { label: '고급 분석', icon: Brain, index: 5 },
  { label: '탐색', icon: Telescope, index: 6 },
  { label: 'LLM 인사이트', icon: BrainCircuit, index: 7 },
];

interface AppSidebarProps {
  activeTab: number;
  onTabChange: (index: number) => void;
  activeJobId: number | null;
  isRunning?: boolean;
  onJobSelect: (jobId: number) => void;
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
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
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

export function AppSidebar({
  activeTab,
  onTabChange,
  activeJobId,
  isRunning,
  onJobSelect,
}: AppSidebarProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const userInitial = session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? '?';
  const userRole = session?.user?.role;

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
      {/* 로고 */}
      <Link
        href="/"
        className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-100 px-4 hover:opacity-80 transition-opacity"
      >
        <Activity className="h-5 w-5 text-blue-600" />
        <span className="text-base font-bold text-slate-900 dark:text-slate-100">SignalCraft</span>
      </Link>

      {/* 잡 선택기 */}
      <div className="pt-3">
        <JobSelector
          activeJobId={activeJobId}
          isRunning={isRunning}
          onSelectJob={(jobId) => {
            onJobSelect(jobId);
          }}
        />
      </div>

      {/* 분석 실행 CTA */}
      <div className="px-3 pb-2 space-y-1.5">
        <Button
          className="w-full justify-start gap-2 bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => onTabChange(0)}
        >
          <Play className="h-4 w-4" />
          분석 실행
        </Button>
        <Link
          href="/subscriptions"
          className="flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
        >
          <Database className="h-3.5 w-3.5" />
          키워드 구독 관리
        </Link>
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
              <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
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
                  문서 허브
                </Link>
              </DropdownMenuItem>
            )}
            <Dialog>
              <DialogTrigger
                nativeButton={false}
                render={
                  <div className="relative flex cursor-pointer select-none items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden hover:bg-accent hover:text-accent-foreground" />
                }
              >
                <Users className="h-4 w-4" />팀 설정
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>팀 설정</DialogTitle>
                </DialogHeader>
                <TeamSettings />
              </DialogContent>
            </Dialog>
            {userRole === 'admin' && (
              <SettingsDialog
                triggerClassName="relative flex cursor-pointer select-none items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden hover:bg-accent hover:text-accent-foreground"
                triggerContent={
                  <>
                    <Settings className="h-4 w-4" />
                    AI 설정
                  </>
                }
              />
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
