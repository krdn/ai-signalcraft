'use client';

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
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
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
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((job) => {
              const badgeInfo = STATUS_BADGE[job.status ?? 'pending'] ?? STATUS_BADGE.pending;
              return (
                <TableRow
                  key={job.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelectJob?.(job.id)}
                >
                  <TableCell className="font-mono text-xs">
                    {format(new Date(job.createdAt), 'yyyy-MM-dd')}
                  </TableCell>
                  <TableCell>{job.keyword}</TableCell>
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
  );
}
