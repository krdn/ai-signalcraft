'use client';

import { useState, type ReactNode } from 'react';

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
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 flex h-full">
            {sidebar(true, () => setSidebarOpen(false))}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {header(() => setSidebarOpen(true))}
        <main aria-label="대시보드 콘텐츠" className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
