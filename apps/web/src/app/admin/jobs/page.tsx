'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'outline',
  running: 'default',
  completed: 'secondary',
  partial_failure: 'outline',
  failed: 'destructive',
  cancelled: 'outline',
  paused: 'outline',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '대기 중',
  running: '실행 중',
  completed: '완료',
  partial_failure: '부분 실패',
  failed: '실패',
  cancelled: '취소됨',
  paused: '일시정지',
};

export default function AdminJobsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: summary } = useQuery({
    queryKey: ['admin', 'jobs', 'summary'],
    queryFn: () => trpcClient.admin.jobs.summary.query(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'jobs', page, statusFilter],
    queryFn: () =>
      trpcClient.admin.jobs.listAll.query({
        page,
        pageSize: 20,
        status:
          statusFilter === 'all'
            ? undefined
            : (statusFilter as 'pending' | 'running' | 'completed' | 'failed'),
      }),
    refetchInterval: 10000,
  });

  const forceCancel = useMutation({
    mutationFn: (jobId: number) => trpcClient.admin.jobs.forceCancel.mutate({ jobId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      toast.success('작업이 취소되었습니다');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">작업 모니터링</h1>

      {/* 상태별 요약 카드 */}
      {summary && (
        <div className="flex flex-wrap gap-3">
          {summary.map((s) => (
            <Card key={s.status} className="px-4 py-2">
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANTS[s.status]}>{STATUS_LABELS[s.status]}</Badge>
                <span className="text-lg font-bold">{s.count}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle as="h2" className="text-base">
              전체 작업 {data && `(${data.total}건)`}
            </CardTitle>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v ?? 'all');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="running">실행 중</SelectItem>
                <SelectItem value="completed">완료</SelectItem>
                <SelectItem value="failed">실패</SelectItem>
                <SelectItem value="pending">대기 중</SelectItem>
                <SelectItem value="cancelled">취소됨</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>키워드</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>팀 ID</TableHead>
                    <TableHead>비용 한도</TableHead>
                    <TableHead>생성일</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-sm">{job.id}</TableCell>
                      <TableCell className="font-medium">{job.keyword}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[job.status]}>
                          {STATUS_LABELS[job.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{job.teamId ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.costLimitUsd ? `$${job.costLimitUsd}` : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(job.createdAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        {(job.status === 'running' || job.status === 'pending') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive text-xs"
                            onClick={() => forceCancel.mutate(job.id)}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            취소
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    이전
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
