'use client';

import { cn } from '@/lib/utils';

export interface Section {
  id: string;
  title: string;
}

interface SectionNavProps {
  sections: Section[];
  activeSection: string;
}

/**
 * 리포트 섹션 네비게이션
 * - 데스크톱: 왼쪽 200px 고정 사이드바 (sticky)
 * - 모바일(< 768px): 수평 스크롤 탭
 */
export function SectionNav({ sections, activeSection }: SectionNavProps) {
  const handleClick = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      {/* 데스크톱: 좌측 고정 사이드바 */}
      <nav className="hidden md:block w-[200px] shrink-0 sticky top-[48px] h-[calc(100vh-48px)] overflow-y-auto bg-secondary/50 p-4 border-r">
        <p className="text-sm font-semibold mb-3 text-muted-foreground">목차</p>
        <ul className="space-y-1">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                onClick={() => handleClick(section.id)}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-sm rounded-sm transition-colors',
                  'hover:bg-accent/10',
                  activeSection === section.id
                    ? 'border-l-2 border-accent text-accent-foreground font-semibold'
                    : 'text-muted-foreground border-l-2 border-transparent',
                )}
              >
                {section.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* 모바일: 수평 스크롤 탭 */}
      <nav className="md:hidden sticky top-[48px] z-10 bg-secondary/80 backdrop-blur border-b overflow-x-auto">
        <div className="flex px-2 py-1 gap-1 min-w-max">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => handleClick(section.id)}
              className={cn(
                'px-3 py-1.5 text-xs whitespace-nowrap rounded-sm transition-colors',
                activeSection === section.id
                  ? 'bg-accent/20 text-accent-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-accent/10',
              )}
            >
              {section.title}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
