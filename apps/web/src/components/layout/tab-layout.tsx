'use client';

import { type ReactNode } from 'react';

interface TabLayoutProps {
  activeTab: number;
  panels: ReactNode[];
}

export function TabLayout({ activeTab, panels }: TabLayoutProps) {
  return (
    <div className="pt-18 px-4 md:px-8">
      {panels[activeTab]}
    </div>
  );
}
