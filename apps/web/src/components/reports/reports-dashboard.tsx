'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { ReportsSidebar } from './reports-sidebar';
import { ReportCard, type ShowcaseItem } from './report-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';
import { getDomainLabel } from '@/components/analysis/domain-badge';

export function ReportsDashboard() {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ['showcase', 'list'],
    queryFn: () => trpcClient.showcase.list.query(),
    staleTime: Infinity,
  });

  const allItems = (items ?? []) as ShowcaseItem[];

  const filteredItems = useMemo(
    () =>
      selectedDomain === null
        ? allItems
        : allItems.filter((item) => item.domain === selectedDomain),
    [allItems, selectedDomain],
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 상단 네비바 */}
      <nav className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="h-14 px-6 flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-primary">
            SignalCraft
          </Link>
          <span className="text-sm text-muted-foreground">공개 분석 리포트</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm">
                홈
              </Button>
            </Link>
            <Link href="/reports">
              <Button variant="default" size="sm">
                리포트
              </Button>
            </Link>
            <Link href="/demo">
              <Button variant="ghost" size="sm">
                체험하기
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm">
                로그인
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 바디: 사이드바 + 메인 */}
      <div className="flex flex-1">
        {/* 모바일: 필터 칩 상단 / 데스크톱: 사이드바 */}
        {isLoading ? (
          <div className="w-52 border-r border-border bg-card p-4 hidden md:block">
            <Skeleton className="h-4 w-24 mb-4" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-lg mb-2" />
            ))}
          </div>
        ) : (
          <div className="hidden md:flex">
            <ReportsSidebar
              items={allItems}
              selectedDomain={selectedDomain}
              onSelectDomain={setSelectedDomain}
            />
          </div>
        )}

        {/* 모바일 필터 칩 (md 미만) */}
        {!isLoading && allItems.length > 0 && (
          <div className="md:hidden flex gap-2 overflow-x-auto px-4 pt-4 pb-0 shrink-0">
            <button
              onClick={() => setSelectedDomain(null)}
              aria-pressed={selectedDomain === null}
              className={`shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                selectedDomain === null
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              전체
            </button>
            {[...new Set(allItems.map((i) => i.domain))].map((domain) => (
              <button
                key={domain}
                onClick={() => setSelectedDomain(domain)}
                aria-pressed={selectedDomain === domain}
                className={`shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  selectedDomain === domain
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground'
                }`}
              >
                <span>{getDomainLabel(domain) || domain}</span>
              </button>
            ))}
          </div>
        )}

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold">AI 분석 리포트</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                실제 수행된 여론 분석 결과를 공개합니다
              </p>
            </div>
            {!isLoading && (
              <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full">
                {filteredItems.length}건
              </span>
            )}
          </div>

          {/* 카드 리스트 */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p>해당 도메인의 분석 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item, idx) => (
                <ReportCard key={item.jobId} item={item} featured={idx === 0} />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* 하단 CTA */}
      <div className="border-t bg-muted/30 py-6">
        <div className="flex items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">
            AI SignalCraft로 직접 여론을 분석해 보세요
          </p>
          <Link href="/demo">
            <Button size="sm" className="gap-1.5">
              무료 체험 시작
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
