'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Calculator,
  Handshake,
  LayoutDashboard,
  Link2,
  Mail,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/sales', label: '대시보드', icon: LayoutDashboard },
  { href: '/sales/leads', label: '리드 관리', icon: UserPlus },
  { href: '/sales/emails', label: '이메일', icon: Mail },
  { href: '/sales/share-links', label: '리포트 공유', icon: Link2 },
  { href: '/sales/partner-tools', label: '파트너 지원', icon: Handshake },
  { href: '/sales/roi-calculator', label: 'ROI 계산기', icon: Calculator },
];

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      {/* 상단 바 */}
      <header
        aria-label="영업 상단 바"
        className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center border-b bg-card px-4 md:px-8"
      >
        <Link href="/sales" className="flex items-center gap-1.5">
          <Activity className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold text-primary">SignalCraft</span>
          <span className="ml-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-600">
            Sales
          </span>
        </Link>
        <div className="flex-1" />
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          대시보드로 돌아가기
        </Link>
      </header>

      <div className="flex pt-14">
        {/* 사이드바 */}
        <aside
          aria-label="영업 사이드바"
          className="fixed left-0 top-14 bottom-0 hidden w-56 border-r bg-card md:block"
        >
          <nav aria-label="영업 메뉴" className="flex flex-col gap-1 p-3">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === '/sales' ? pathname === '/sales' : pathname.startsWith(href);
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
        <main aria-label="영업 콘텐츠" className="flex-1 md:ml-56 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
