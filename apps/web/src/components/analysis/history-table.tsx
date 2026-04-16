'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  LinkIcon,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SourceBadges, extractSources, summarizeCounts, formatDuration } from './source-icons';
import { DomainBadge } from './domain-badge';
import { trpcClient } from '@/lib/trpc';
import { FilterScopePicker, type FilterScopeValue } from '@/components/filter-scope-picker';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  cancelled: { variant: 'outline', label: '취소' },
};

const PER_PAGE = 20;

interface HistoryTableProps {
  onViewResult?: (jobId: number) => void;
}

export function HistoryTable({ onViewResult }: HistoryTableProps) {
  const { data: session } = useSession();
  const role = session?.user?.role as string | undefined;
  const canUseAdvancedScope = role === 'admin' || role === 'leader';
  const defaultScope: FilterScopeValue['scope'] = canUseAdvancedScope ? 'team' : 'mine';

  const [page, setPage] = useState(1);
  const [scopeValue, setScopeValue] = useState<FilterScopeValue>({ scope: defaultScope });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<{
    id: number;
    keyword: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [
      'history',
      'list',
      { page, perPage: PER_PAGE, scope: scopeValue.scope, targetUserId: scopeValue.targetUserId },
    ],
    queryFn: () =>
      trpcClient.history.list.query({
        page,
        perPage: PER_PAGE,
        scope: scopeValue.scope,
        targetUserId: scopeValue.targetUserId,
      }),
  });

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  const deleteMutation = useMutation({
    mutationFn: (jobId: number) => trpcClient.history.delete.mutate({ jobId }),
    onSuccess: (result) => {
      if (result.deleted) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ['history'] });
        setSelectedIds(new Set());
      }
    },
    onError: () => toast.error('삭제에 실패했습니다'),
    onSettled: () => setSingleDeleteTarget(null),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (jobIds: number[]) => trpcClient.history.bulkDelete.mutate({ jobIds }),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ['history'] });
      setSelectedIds(new Set());
    },
    onError: () => toast.error('삭제에 실패했습니다'),
    onSettled: () => setBulkDeleteOpen(false),
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data?.items) return;
    const allIds = data.items.map((j) => j.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  // 진행 중인 작업은 삭제 불가
  const canDelete = (status: string | null) => {
    return status !== 'running' && status !== 'pending' && status !== 'paused';
  };

  const deletableSelected =
    data?.items.filter((j) => selectedIds.has(j.id) && canDelete(j.status)).map((j) => j.id) ?? [];

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
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">분석 히스토리</CardTitle>
          <div className="flex items-center gap-2">
            {canUseAdvancedScope ? (
              <FilterScopePicker
                value={scopeValue}
                onChange={(next) => {
                  setScopeValue(next);
                  setPage(1);
                  setSelectedIds(new Set());
                }}
              />
            ) : null}
            {deletableSelected.length > 0 && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={bulkDeleteMutation.isPending}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {deletableSelected.length}개 삭제
                </Button>
                <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>분석 작업 삭제</AlertDialogTitle>
                      <AlertDialogDescription>
                        선택한 {deletableSelected.length}개 작업을 삭제합니다. 관련된 수집 데이터,
                        분석 결과, 리포트가 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => bulkDeleteMutation.mutate(deletableSelected)}
                      >
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      data.items.length > 0 && data.items.every((j) => selectedIds.has(j.id))
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>날짜</TableHead>
                <TableHead>키워드</TableHead>
                <TableHead>소스</TableHead>
                <TableHead>수집</TableHead>
                <TableHead>상태</TableHead>
                {scopeValue.scope !== 'mine' && <TableHead>실행자</TableHead>}
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((job) => {
                const badgeInfo = STATUS_BADGE[job.status ?? 'pending'] ?? STATUS_BADGE.pending;
                const sources = extractSources(job.progress);
                const counts = summarizeCounts(job.progress);
                const isCompleted = job.status === 'completed' || job.status === 'partial_failure';
                const isDeletable = canDelete(job.status);
                return (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(job.id)}
                        onCheckedChange={() => toggleSelect(job.id)}
                        disabled={!isDeletable}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      <div>{format(new Date(job.createdAt), 'yyyy-MM-dd HH:mm')}</div>
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
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{job.keyword}</span>
                        <DomainBadge domain={(job as any).domain} size="xs" />
                        {(job as any).seriesId && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
                            <LinkIcon className="h-2.5 w-2.5" />#
                            {((job as any).seriesOrder ?? 0) + 1}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
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
                    {scopeValue.scope !== 'mine' && (
                      <TableCell className="text-xs text-muted-foreground">
                        {(job as any).userName ?? '-'}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onViewResult?.(job.id)}>
                          보기
                        </Button>
                        {isDeletable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() =>
                              setSingleDeleteTarget({ id: job.id, keyword: job.keyword })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
          {/* 개별 삭제 확인 다이얼로그 */}
          <AlertDialog
            open={singleDeleteTarget !== null}
            onOpenChange={(open) => {
              if (!open) setSingleDeleteTarget(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>작업 삭제</AlertDialogTitle>
                <AlertDialogDescription>
                  &quot;{singleDeleteTarget?.keyword}&quot; 분석 작업을 삭제합니다. 수집 데이터,
                  분석 결과, 리포트가 모두 삭제됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => singleDeleteTarget && deleteMutation.mutate(singleDeleteTarget.id)}
                >
                  삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
