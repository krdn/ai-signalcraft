'use client';

import type { ShowcaseItem } from './report-card';
import { cn } from '@/lib/utils';
import { getDomainLabel } from '@/components/analysis/domain-badge';

interface ReportsSidebarProps {
  items: ShowcaseItem[];
  selectedDomain: string | null;
  onSelectDomain: (domain: string | null) => void;
}

export function ReportsSidebar({ items, selectedDomain, onSelectDomain }: ReportsSidebarProps) {
  // 도메인별 건수 집계
  const domainCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.domain] = (acc[item.domain] ?? 0) + 1;
    return acc;
  }, {});

  const domains = Object.keys(domainCounts).sort();

  // 전체 통계
  const totalArticles = items.reduce((s, i) => s + i.totalArticles, 0);
  const totalModules = items.reduce((s, i) => s + i.modulesCompleted, 0);

  return (
    <aside className="w-52 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* 필터 제목 */}
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          도메인 필터
        </p>

        {/* 필터 칩 */}
        <div className="flex flex-col gap-1.5">
          {/* 전체 */}
          <button
            onClick={() => onSelectDomain(null)}
            aria-pressed={selectedDomain === null}
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors',
              selectedDomain === null
                ? 'border-primary bg-primary/10 text-primary font-semibold'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            <span>전체</span>
            <span className="text-xs opacity-60">{items.length}</span>
          </button>

          {/* 도메인별 */}
          {domains.map((domain) => (
            <button
              key={domain}
              onClick={() => onSelectDomain(domain)}
              aria-pressed={selectedDomain === domain}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors',
                selectedDomain === domain
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              <span>{getDomainLabel(domain)}</span>
              <span className="text-xs opacity-60">{domainCounts[domain]}</span>
            </button>
          ))}
        </div>

        {/* 구분선 + 통계 */}
        <div className="mt-auto pt-4 border-t border-border space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              총 수집 데이터
            </p>
            <p className="text-2xl font-extrabold text-primary">
              {totalArticles.toLocaleString()}
              <span className="text-xs font-normal text-muted-foreground ml-1">건</span>
            </p>
            <p className="text-xs text-muted-foreground">수집 기사 건수</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold">
              {totalModules}
              <span className="text-xs font-normal text-muted-foreground ml-1">개 모듈</span>
            </p>
            <p className="text-xs text-muted-foreground">AI 분석 완료</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
