'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import {
  Activity,
  BookOpen,
  Brain,
  ChevronDown,
  Database,
  FileText,
  Globe,
  Handshake,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Moon,
  Play,
  Settings,
  Shield,
  Sun,
  Telescope,
  TrendingUp,
  Users,
  Lightbulb,
  Megaphone,
  Layers,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/lib/theme';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TeamSettings } from '@/components/team/team-settings';
import { ModelSettings } from '@/components/settings/model-settings';
import { ProviderKeys } from '@/components/settings/provider-keys';
import { ConcurrencySettings } from '@/components/settings/concurrency-settings';
import { CollectionLimitsSettings } from '@/components/settings/collection-limits-settings';
import { cn } from '@/lib/utils';
import { ReleaseBell } from '@/components/release-bell';

// 탭 인덱스 (dashboard/page.tsx의 panels 배열 순서와 일치)
// 0: 분석 실행, 1: 대시보드, 2: 수집 데이터, 3: AI 리포트, 4: 히스토리, 5: 고급 분석, 6: 탐색

type TabDef = { label: string; icon: LucideIcon; index: number };

// 항상 표시되는 기본 탭 (분석 실행 제외)
const PRIMARY_TABS: TabDef[] = [
  { label: '대시보드', icon: LayoutDashboard, index: 1 },
  { label: 'AI 리포트', icon: FileText, index: 3 },
  { label: '수집 데이터', icon: Database, index: 2 },
  { label: '히스토리', icon: History, index: 4 },
];

// 더보기 드롭다운으로 숨겨지는 탭
const OVERFLOW_TABS: TabDef[] = [
  { label: '고급 분석', icon: Brain, index: 5 },
  { label: '탐색', icon: Telescope, index: 6 },
];

// 전체 탭 목록 (Sheet 모바일 메뉴용)
const ALL_TABS: TabDef[] = [
  { label: '분석 실행', icon: Play, index: 0 },
  ...PRIMARY_TABS,
  ...OVERFLOW_TABS,
];

// jobId가 없을 때 비활성화되는 탭 인덱스
const RESULT_TAB_INDICES = [1, 2, 3, 5, 6];

interface TopNavProps {
  activeTab: number;
  onTabChange: (index: number) => void;
  hasActiveJob?: boolean;
}

export function TopNav({ activeTab, onTabChange, hasActiveJob = false }: TopNavProps) {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userInitial = session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? '?';
  const userRole = session?.user?.role;
  const isDark = theme === 'dark';

  const isTabDisabled = (index: number) => !hasActiveJob && RESULT_TAB_INDICES.includes(index);

  const handleTabClick = (index: number) => {
    if (isTabDisabled(index)) {
      onTabChange(0);
      toast.info('분석을 먼저 실행해주세요', {
        description: '분석 실행 탭에서 새 분석을 시작하면 결과를 확인할 수 있습니다.',
        duration: 3000,
      });
      return;
    }
    onTabChange(index);
  };

  const handleMobileTabChange = (index: number) => {
    handleTabClick(index);
    setMobileMenuOpen(false);
  };

  // 더보기 드롭다운의 탭 중 하나가 활성화되어 있는지
  const isOverflowActive = OVERFLOW_TABS.some((t) => t.index === activeTab);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center border-b bg-card/90 backdrop-blur-sm px-4 md:px-6">
      {/* 모바일 햄버거 메뉴 */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger
          render={
            <button className="mr-2 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50 md:hidden">
              <Menu className="h-5 w-5" />
            </button>
          }
        />
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-1.5">
              <Activity className="h-5 w-5 text-primary" />
              <span className="text-primary">SignalCraft</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col py-2">
            {/* 분석 실행 CTA */}
            <div className="px-3 pb-1 pt-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                분석
              </p>
            </div>
            <SheetClose
              render={
                <button
                  onClick={() => handleMobileTabChange(0)}
                  className={cn(
                    'mx-2 mb-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors',
                    activeTab === 0
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-primary/10 text-primary hover:bg-primary/20',
                  )}
                >
                  <Play className="h-4 w-4" />
                  <span>분석 실행</span>
                </button>
              }
            />

            {/* 결과 보기 섹션 */}
            <div className="px-3 pb-1 pt-3">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                결과 보기
              </p>
            </div>
            {PRIMARY_TABS.map(({ label, icon: Icon, index }) => {
              const isActive = activeTab === index;
              const disabled = isTabDisabled(index);
              return (
                <SheetClose
                  key={label}
                  render={
                    <button
                      onClick={() => handleMobileTabChange(index)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'text-primary bg-primary/10 border-r-2 border-primary'
                          : disabled
                            ? 'text-muted-foreground/40 cursor-not-allowed'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{label}</span>
                      {disabled && <Lock className="h-3 w-3 shrink-0" />}
                    </button>
                  }
                />
              );
            })}

            {/* 더보기 섹션 */}
            <div className="px-3 pb-1 pt-3">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                고급
              </p>
            </div>
            {OVERFLOW_TABS.map(({ label, icon: Icon, index }) => {
              const isActive = activeTab === index;
              const disabled = isTabDisabled(index);
              return (
                <SheetClose
                  key={label}
                  render={
                    <button
                      onClick={() => handleMobileTabChange(index)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'text-primary bg-primary/10 border-r-2 border-primary'
                          : disabled
                            ? 'text-muted-foreground/40 cursor-not-allowed'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{label}</span>
                      {disabled && <Lock className="h-3 w-3 shrink-0" />}
                    </button>
                  }
                />
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* 로고 */}
      <Link href="/" className="flex items-center gap-1.5 shrink-0 mr-4">
        <Activity className="h-5 w-5 text-primary" />
        <span className="text-lg font-semibold text-primary hidden sm:inline">SignalCraft</span>
      </Link>

      {/* 데스크톱 탭 네비게이션 */}
      <div className="hidden md:flex items-center flex-1 gap-0.5 min-w-0">
        {/* 분석 실행 CTA 탭 */}
        <button
          onClick={() => onTabChange(0)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 shrink-0',
            activeTab === 0
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20',
          )}
        >
          <Play className="h-3.5 w-3.5" />
          <span>분석 실행</span>
        </button>

        {/* 구분선 */}
        <div className="mx-1.5 h-5 w-px bg-border shrink-0" />

        {/* 기본 탭들 */}
        {PRIMARY_TABS.map(({ label, icon: Icon, index }) => {
          const isActive = activeTab === index;
          const disabled = isTabDisabled(index);
          return (
            <button
              key={label}
              onClick={() => handleTabClick(index)}
              title={disabled ? '분석 실행 후 사용 가능' : label}
              className={cn(
                'relative flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 shrink-0',
                isActive
                  ? 'text-primary bg-primary/10'
                  : disabled
                    ? 'text-muted-foreground/40 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}

        {/* 더보기 드롭다운 — 고급 분석 + 탐색 */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'relative flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 shrink-0 focus:outline-none',
              isOverflowActive
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <span>더보기</span>
            <ChevronDown className="h-3.5 w-3.5" />
            {isOverflowActive && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {OVERFLOW_TABS.map(({ label, icon: Icon, index }) => {
              const isActive = activeTab === index;
              const disabled = isTabDisabled(index);
              return (
                <DropdownMenuItem
                  key={label}
                  onClick={() => handleTabClick(index)}
                  className={cn(
                    'flex items-center gap-2 cursor-pointer',
                    isActive && 'text-primary bg-primary/10',
                    disabled && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                  {disabled && <Lock className="h-3 w-3 shrink-0" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 모바일에서 중앙 현재 탭 표시 */}
      <div className="flex-1 md:hidden text-center">
        <span className="text-sm font-medium text-foreground">
          {ALL_TABS.find((t) => t.index === activeTab)?.label ?? '분석 실행'}
        </span>
      </div>

      {/* 우측 액션 영역 */}
      <div className="flex items-center gap-1 ml-2 shrink-0">
        {/* 제품 소개 */}
        <Link
          href="/whitepaper"
          target="_blank"
          rel="noopener"
          className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground lg:flex"
          title="제품 소개 슬라이드 (새 창)"
        >
          <BookOpen className="h-4 w-4" />
          <span>제품 소개</span>
        </Link>

        {/* AI 모델 설정 — admin만 표시 */}
        {userRole === 'admin' && (
          <Dialog>
            <DialogTrigger
              render={
                <button className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary">
                  <Settings className="h-4 w-4" />
                </button>
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

        {/* 업데이트 벨 */}
        <ReleaseBell className="mr-0" />

        {/* 사용자 메뉴 */}
        <DropdownMenu>
          <DropdownMenuTrigger className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{userInitial.toUpperCase()}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{session?.user?.name ?? '사용자'}</p>
              <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="p-0">
              <Link href="/" className="flex w-full items-center gap-2 px-1.5 py-1">
                <Globe className="h-4 w-4" />
                <span>홈페이지</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-0">
              <Link href="/changelog" className="flex w-full items-center gap-2 px-1.5 py-1">
                <Megaphone className="h-4 w-4" />
                <span>업데이트 히스토리</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-0">
              <Link href="/feedback" className="flex w-full items-center gap-2 px-1.5 py-1">
                <Lightbulb className="h-4 w-4" />
                <span>기능 제안</span>
              </Link>
            </DropdownMenuItem>
            {session?.user?.role === 'admin' && (
              <DropdownMenuItem className="p-0">
                <Link href="/admin" className="flex w-full items-center gap-2 px-1.5 py-1">
                  <Shield className="h-4 w-4" />
                  <span>관리자</span>
                </Link>
              </DropdownMenuItem>
            )}
            {['admin', 'sales'].includes(session?.user?.role ?? '') && (
              <DropdownMenuItem className="p-0">
                <Link href="/sales" className="flex w-full items-center gap-2 px-1.5 py-1">
                  <TrendingUp className="h-4 w-4" />
                  <span>영업관리</span>
                </Link>
              </DropdownMenuItem>
            )}
            {['admin', 'sales', 'partner'].includes(session?.user?.role ?? '') && (
              <DropdownMenuItem className="p-0">
                <Link href="/partner" className="flex w-full items-center gap-2 px-1.5 py-1">
                  <Handshake className="h-4 w-4" />
                  <span>파트너</span>
                </Link>
              </DropdownMenuItem>
            )}
            {['admin', 'sales', 'partner'].includes(session?.user?.role ?? '') && (
              <DropdownMenuItem className="p-0">
                <Link href="/docs" className="flex w-full items-center gap-2 px-1.5 py-1">
                  <Layers className="h-4 w-4" />
                  <span>기술 문서</span>
                </Link>
              </DropdownMenuItem>
            )}
            <Dialog>
              <DialogTrigger
                nativeButton={false}
                render={
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Users className="h-4 w-4" />
                    <span>팀 설정</span>
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
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center justify-between cursor-pointer"
              onSelect={(e) => e.preventDefault()}
            >
              <div className="flex items-center gap-2">
                {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                <span>테마 변경</span>
              </div>
              <Switch
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="p-0">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-1.5 py-1 cursor-pointer text-destructive"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                <LogOut className="h-4 w-4" />
                <span>로그아웃</span>
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
