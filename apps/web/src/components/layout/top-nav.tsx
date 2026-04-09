'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import {
  Activity,
  BookOpen,
  Brain,
  Database,
  FileText,
  Globe,
  Handshake,
  History,
  LayoutDashboard,
  LogOut,
  Shield,
  Menu,
  Moon,
  Play,
  Settings,
  Sun,
  Telescope,
  TrendingUp,
  Users,
  Lightbulb,
  Megaphone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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

const TABS: { label: string; icon: LucideIcon }[] = [
  { label: '분석 실행', icon: Play },
  { label: '결과 대시보드', icon: LayoutDashboard },
  { label: '수집 데이터', icon: Database },
  { label: 'AI 리포트', icon: FileText },
  { label: '히스토리', icon: History },
  { label: '고급 분석', icon: Brain },
  { label: '탐색', icon: Telescope },
];

interface TopNavProps {
  activeTab: number;
  onTabChange: (index: number) => void;
}

export function TopNav({ activeTab, onTabChange }: TopNavProps) {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userInitial = session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? '?';
  const userRole = session?.user?.role;
  const isDark = theme === 'dark';

  const handleMobileTabChange = (index: number) => {
    onTabChange(index);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center border-b bg-card px-4 md:px-8">
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
            {TABS.map(({ label, icon: Icon }, index) => {
              const isActive = activeTab === index;
              return (
                <SheetClose
                  key={label}
                  render={
                    <button
                      onClick={() => handleMobileTabChange(index)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
                        isActive
                          ? 'text-primary bg-primary/10 border-r-2 border-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </button>
                  }
                />
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* 로고 */}
      <Link href="/" className="flex items-center gap-1.5 shrink-0">
        <Activity className="h-5 w-5 text-primary" />
        <span className="text-lg font-semibold text-primary">SignalCraft</span>
      </Link>

      {/* 탭 네비게이션 -- 데스크톱만 표시 */}
      <div className="hidden md:flex items-center justify-center flex-1 gap-1">
        {TABS.map(({ label, icon: Icon }, index) => {
          const isActive = activeTab === index;
          return (
            <button
              key={label}
              onClick={() => onTabChange(index)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* 모바일에서 중앙 현재 탭 표시 */}
      <div className="flex-1 md:hidden text-center">
        <span className="text-sm font-medium text-foreground">{TABS[activeTab].label}</span>
      </div>

      {/* 제품 소개 (영업용 화이트페이퍼) — 모든 사용자 */}
      <Link
        href="/whitepaper"
        target="_blank"
        rel="noopener"
        className="mr-1 hidden items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:flex"
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
      <ReleaseBell className="mr-1" />

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
    </nav>
  );
}
