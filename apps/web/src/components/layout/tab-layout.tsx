'use client';

import { type ReactNode } from 'react';

interface TabLayoutProps {
  activeTab: number;
  panels: ReactNode[];
}

export function TabLayout({ activeTab, panels }: TabLayoutProps) {
  return (
    <div className="pt-16 px-8">
      {panels.map((panel, index) => (
        <div
          key={index}
          className={activeTab === index ? 'block' : 'hidden'}
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
