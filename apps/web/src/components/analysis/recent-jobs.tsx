'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarRange, Clock, FileText, MessageSquare } from 'lucide-react';
import { SourceBadges, extractSources, summarizeCounts, formatDuration } from './source-icons';
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
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';

const STATUS_BADGE: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
> = {
  completed: { variant: 'default', label: '완료' },
  running: { variant: 'secondary', label: '진행 중' },
  pending: { variant: 'outline', label: '대기' },
  failed: { variant: 'destructive', label: '실패' },
  partial_failure: { variant: 'outline', label: '부분 실패' },
};

interface RecentJobsProps {
  onSelectJob?: (jobId: number) => void;
}

export function RecentJobs({ onSelectJob }: RecentJobsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['history', 'list', { page: 1, perPage: 5 }],
    queryFn: () => trpcClient.history.list.query({ page: 1, perPage: 5 }),
  });

  if (isLoading) {
    return (
      <Card className="mx-auto max-w-xl mt-4">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">최근 분석</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.items.length) {
    return (
      <Card className="mx-auto max-w-xl mt-4">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">최근 분석</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="font-semibold">분석 내역이 없습니다</p>
            <p className="text-sm mt-1">키워드를 입력하고 분석을 실행해 보세요.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="mx-auto max-w-xl mt-4">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">최근 분석</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>키워드</TableHead>
                <TableHead>소스</TableHead>
                <TableHead>수집</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((job) => {
                const badgeInfo = STATUS_BADGE[job.status ?? 'pending'] ?? STATUS_BADGE.pending;
                const sources = extractSources(job.progress);
                const counts = summarizeCounts(job.progress);
                const isCompleted = job.status === 'completed' || job.status === 'partial_failure';
                return (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onSelectJob?.(job.id)}
                  >
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      <div>{format(new Date(job.createdAt), 'MM-dd HH:mm')}</div>
                      {isCompleted && (
                        <div className="flex items-center gap-0.5 text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(job.createdAt, job.updatedAt)}</span>
                        </div>
                      )}
                      {job.startDate && job.endDate && (
                        <div className="flex items-center gap-0.5 text-muted-foreground mt-0.5">
                          <CalendarRange className="h-3 w-3" />
                          <span>
                            {format(new Date(job.startDate), 'MM.dd')}~
                            {format(new Date(job.endDate), 'MM.dd')}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{job.keyword}</TableCell>
                    <TableCell>
                      <SourceBadges sources={sources} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {counts.items > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-0.5">
                            <FileText className="h-3 w-3" />
                            {counts.items}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <MessageSquare className="h-3 w-3" />
                            {counts.comments}
                          </span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
