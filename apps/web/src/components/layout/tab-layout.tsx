'use client';

import { type ReactNode } from 'react';

interface TabLayoutProps {
  activeTab: number;
  panels: ReactNode[];
}

export function TabLayout({ activeTab, panels }: TabLayoutProps) {
  return <div className="h-full">{panels[activeTab]}</div>;
}
