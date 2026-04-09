'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// 감정 분석 뱃지 설정
export const SENTIMENT_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }
> = {
  positive: {
    label: '긍정',
    variant: 'default',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  negative: {
    label: '부정',
    variant: 'destructive',
    className:
      'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800',
  },
  neutral: {
    label: '중립',
    variant: 'secondary',
    className:
      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  },
};

export function SentimentBadge({
  sentiment,
  score,
}: {
  sentiment: string | null;
  score: number | null;
}) {
  if (!sentiment) return null;
  const config = SENTIMENT_CONFIG[sentiment];
  if (!config) return null;
  return (
    <Badge variant="outline" className={`text-[10px] h-5 ${config.className}`}>
      {config.label}
      {score != null ? ` ${Math.round(score * 100)}%` : ''}
    </Badge>
  );
}

// 소스 한글 라벨
export const SOURCE_LABELS: Record<string, string> = {
  'naver-news': '네이버 뉴스',
  youtube: '유튜브',
  dcinside: 'DC갤러리',
  fmkorea: '에펨코리아',
  clien: '클리앙',
  rss: 'RSS',
  html: '웹',
};

// 페이지네이션 컴포넌트
export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
