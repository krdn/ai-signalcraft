'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowRight, FileText, MessageSquare, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface ShowcaseItem {
  jobId: number;
  keyword: string;
  startDate: string;
  endDate: string;
  featuredAt: string | null;
  createdAt: string;
  reportTitle: string | null;
  oneLiner: string | null;
  totalArticles: number;
  totalComments: number;
  modulesCompleted: number;
  modulesTotal: number;
  metadata: {
    dateRange?: { start: string; end: string };
    modulesCompleted?: string[];
  } | null;
}

export function ShowcaseSection() {
  const { data: items, isLoading } = useQuery({
    queryKey: ['showcase', 'list'],
    queryFn: () => trpcClient.showcase.list.query(),
  });

  // 데이터 없으면 섹션 자체 미표시
  if (!isLoading && (!items || items.length === 0)) return null;

  const showcaseItems = (items ?? []) as ShowcaseItem[];

  return (
    <section id="showcase" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        {/* 섹션 헤더 */}
        <div className="mb-12 text-center">
          <Badge variant="outline" className="mb-4">
            실제 분석 결과
          </Badge>
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            AI가 생성한 분석 리포트를 직접 확인하세요
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            실제 키워드로 수행된 여론 분석 결과입니다. 클릭하여 상세 내용을 미리 확인해 보세요.
          </p>
        </div>

        {/* Bento Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-64 rounded-2xl md:col-span-2" />
            <div className="space-y-4">
              <Skeleton className="h-[7.5rem] rounded-2xl" />
              <Skeleton className="h-[7.5rem] rounded-2xl" />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {showcaseItems.map((item, idx) => (
              <Link
                key={item.jobId}
                href={`/showcase/${item.jobId}`}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border border-border/50 bg-background/60 backdrop-blur-xl',
                  'p-6 text-left shadow-sm',
                  'transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/30',
                  idx === 0 && 'md:col-span-2 md:row-span-2 md:p-8',
                )}
              >
                {/* Gradient accent line */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                {/* 키워드 Badge */}
                <Badge className="mb-3 bg-gradient-to-r from-primary/80 to-primary text-primary-foreground border-0">
                  {item.keyword}
                </Badge>

                {/* 한 줄 요약 */}
                {item.oneLiner && (
                  <p
                    className={cn(
                      'font-semibold leading-relaxed text-foreground',
                      idx === 0
                        ? 'text-lg md:text-xl mb-4 line-clamp-3'
                        : 'text-sm mb-3 line-clamp-2',
                    )}
                  >
                    {item.oneLiner}
                  </p>
                )}

                {/* 리포트 제목 */}
                {item.reportTitle && idx === 0 && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-1">
                    {item.reportTitle}
                  </p>
                )}

                {/* 미니 통계 */}
                <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {item.totalArticles}건
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {item.totalComments}댓글
                  </span>
                  <span className="flex items-center gap-1">
                    <FlaskConical className="h-3 w-3" />
                    {item.modulesCompleted}개 모듈
                  </span>
                </div>

                {/* 하단 정보 */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/30">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(item.startDate), 'MM.dd')}~
                    {format(new Date(item.endDate), 'MM.dd')}
                  </span>
                  <span className="text-xs text-muted-foreground/0 group-hover:text-primary transition-colors">
                    상세 보기
                  </span>
                </div>

                {/* Hover 힌트 */}
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-4 w-4 text-primary" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link href="/demo">
            <Button size="lg" className="gap-1.5">
              무료 체험으로 직접 분석하기
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
