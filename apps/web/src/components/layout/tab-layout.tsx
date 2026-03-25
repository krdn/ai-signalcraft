'use client';

import { type ReactNode } from 'react';

interface TabLayoutProps {
  activeTab: number;
  panels: ReactNode[];
}

export function TabLayout({ activeTab, panels }: TabLayoutProps) {
  return (
    <div className="pt-16 px-8">
      {panels[activeTab]}
    </div>
  );
}
