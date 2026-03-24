'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  completed: { variant: 'default', label: '완료' },
  running: { variant: 'secondary', label: '진행 중' },
  pending: { variant: 'outline', label: '대기' },
  failed: { variant: 'destructive', label: '실패' },
  partial_failure: { variant: 'outline', label: '부분 실패' },
};

const PER_PAGE = 20;

interface HistoryTableProps {
  onViewResult?: (jobId: number) => void;
}

export function HistoryTable({ onViewResult }: HistoryTableProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['history', 'list', { page, perPage: PER_PAGE }],
    queryFn: () => trpcClient.history.list.query({ page, perPage: PER_PAGE }),
  });

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">분석 히스토리</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.items.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">분석 히스토리</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-semibold">분석 기록이 없습니다</p>
            <p className="text-sm mt-2">첫 번째 분석을 실행하면 여기에 기록됩니다.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">분석 히스토리</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead>
              <TableHead>키워드</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>소스</TableHead>
              <TableHead className="text-right">보기</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((job) => {
              const badgeInfo = STATUS_BADGE[job.status ?? 'pending'] ?? STATUS_BADGE.pending;
              // progress JSONB에서 소스 정보 추출
              const sources: string[] = [];
              if (job.progress) {
                const p = job.progress as Record<string, unknown>;
                if (p.naver) sources.push('N');
                if (p.youtube) sources.push('Y');
              }
              return (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-xs">
                    {format(new Date(job.createdAt), 'yyyy-MM-dd')}
                  </TableCell>
                  <TableCell className="font-medium">{job.keyword}</TableCell>
                  <TableCell>
                    <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {sources.length > 0 ? sources.join(', ') : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewResult?.(job.id)}
                    >
                      보기
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground font-mono">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
