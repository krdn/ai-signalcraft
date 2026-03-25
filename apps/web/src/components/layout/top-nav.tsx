'use client';

import { useTheme } from 'next-themes';
import { signOut, useSession } from 'next-auth/react';
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
import { Switch } from '@/components/ui/switch';
import { LogOut, Moon, Sun, Users } from 'lucide-react';
import { TeamSettings } from '@/components/team/team-settings';

const TAB_LABELS = ['분석 실행', '결과 대시보드', '수집 데이터', 'AI 리포트', '히스토리', '고급 분석'] as const;

interface TopNavProps {
  activeTab: number;
  onTabChange: (index: number) => void;
}

export function TopNav({ activeTab, onTabChange }: TopNavProps) {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();

  const userInitial = session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? '?';
  const isDark = theme === 'dark';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex h-12 items-center border-b bg-card px-8">
      {/* 로고 */}
      <span className="text-lg font-semibold text-accent shrink-0">
        SignalCraft
      </span>

      {/* 탭 네비게이션 */}
      <div className="flex items-center justify-center flex-1 gap-1">
        {TAB_LABELS.map((label, index) => (
          <button
            key={label}
            onClick={() => onTabChange(index)}
            className={`h-10 px-4 text-sm font-semibold transition-colors relative ${
              activeTab === index
                ? 'text-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            {activeTab === index && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* 사용자 메뉴 */}
      <DropdownMenu>
        <DropdownMenuTrigger className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-accent">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {userInitial.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{session?.user?.name ?? '사용자'}</p>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <Dialog>
            <DialogTrigger
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
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer text-destructive"
            onSelect={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            <span>로그아웃</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
