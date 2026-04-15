'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { FileText, MessageSquare, Brain, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ShowcaseItem {
  jobId: number;
  keyword: string;
  domain: string;
  startDate: string;
  endDate: string;
  oneLiner: string | null;
  reportTitle: string | null;
  totalArticles: number;
  totalComments: number;
  modulesCompleted: number;
}

const DOMAIN_LABEL: Record<string, string> = {
  political: '정치',
  economic: '경제',
  social: '사회',
  cultural: '문화',
  tech: '기술',
};

const DOMAIN_COLOR: Record<string, string> = {
  political: 'bg-red-500/10 text-red-500 border-red-500/20',
  economic: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  social: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  cultural: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  tech: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
};

interface ReportCardProps {
  item: ShowcaseItem;
  featured?: boolean;
}

export function ReportCard({ item, featured = false }: ReportCardProps) {
  const title = item.oneLiner ?? item.reportTitle ?? item.keyword;
  const domainLabel = DOMAIN_LABEL[item.domain] ?? item.domain;
  const domainColor = DOMAIN_COLOR[item.domain] ?? 'bg-muted text-muted-foreground border-border';

  return (
    <Link
      href={`/showcase/${item.jobId}`}
      className={cn(
        'group flex items-start gap-3 rounded-xl border p-4 transition-all duration-200',
        'hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5',
        featured ? 'border-primary/30 bg-primary/5' : 'border-border bg-background',
      )}
      aria-label={`${domainLabel} 분석: ${title}`}
    >
      <div className="flex-1 min-w-0">
        {/* 도메인 뱃지 */}
        <span
          className={cn(
            'inline-block text-xs font-semibold px-2 py-0.5 rounded-full border mb-2',
            domainColor,
          )}
        >
          {domainLabel}
        </span>

        {/* 제목 */}
        <p
          className={cn(
            'font-semibold leading-snug text-foreground',
            featured ? 'text-base' : 'text-sm',
          )}
        >
          {title}
        </p>

        {/* 통계 */}
        <div className="flex items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            {item.totalArticles}건
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            {item.totalComments}댓글
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Brain className="h-3 w-3" />
            {item.modulesCompleted}개 모듈
          </span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(item.startDate), 'MM.dd')}~{format(new Date(item.endDate), 'MM.dd')}
          </span>
        </div>
      </div>

      {/* 우측 화살표 */}
      <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors mt-1 shrink-0" />
    </Link>
  );
}
