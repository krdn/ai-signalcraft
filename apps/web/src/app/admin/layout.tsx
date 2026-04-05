'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, BarChart3, Briefcase, Home, Monitor, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: '오버뷰', icon: Home },
  { href: '/admin/users', label: '사용자 관리', icon: Users },
  { href: '/admin/jobs', label: '작업 모니터링', icon: Briefcase },
  { href: '/admin/usage', label: '비용/사용량', icon: BarChart3 },
  { href: '/admin/system', label: '시스템', icon: Monitor },
  { href: '/admin/demo', label: '데모 관리', icon: Sparkles },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      {/* 상단 바 */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center border-b bg-card px-4 md:px-8">
        <Link href="/admin" className="flex items-center gap-1.5">
          <Activity className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold text-primary">SignalCraft</span>
          <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
            Admin
          </span>
        </Link>
        <div className="flex-1" />
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          대시보드로 돌아가기
        </Link>
      </header>

      <div className="flex pt-14">
        {/* 사이드바 */}
        <aside className="fixed left-0 top-14 bottom-0 hidden w-56 border-r bg-card md:block">
          <nav className="flex flex-col gap-1 p-3">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 md:ml-56 p-6">{children}</main>
      </div>
    </div>
  );
}
