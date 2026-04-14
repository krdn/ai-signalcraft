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
