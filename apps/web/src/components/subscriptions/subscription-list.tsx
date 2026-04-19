'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pause, Play, Trash2, Zap, Loader2, RefreshCw, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SubscriptionListProps {
  onAnalyze?: (keyword: string, subscriptionId: number) => void;
}

const SOURCE_LABEL_MAP: Record<string, string> = {
  'naver-news': '네이버',
  youtube: '유튜브',
  dcinside: 'DC',
  fmkorea: '에펨',
  clien: '클리앙',
};

function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return '-';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ko });
  } catch {
    return '-';
  }
}

export function SubscriptionList({ onAnalyze }: SubscriptionListProps) {
  const [statusFilter, setStatusFilter] = useState<'active' | 'paused' | 'error' | 'all'>('all');
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['subscriptions', statusFilter],
    queryFn: () =>
      trpcClient.subscriptions.list.query(
        statusFilter === 'all' ? undefined : { status: statusFilter },
      ),
    refetchInterval: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['subscriptions'] });

  const pauseMut = useMutation({
    mutationFn: (id: number) => trpcClient.subscriptions.pause.mutate({ id }),
    onSuccess: () => {
      toast.success('일시 정지되었습니다');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '실패'),
  });

  const resumeMut = useMutation({
    mutationFn: (id: number) => trpcClient.subscriptions.resume.mutate({ id }),
    onSuccess: () => {
      toast.success('재개되었습니다');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '실패'),
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => trpcClient.subscriptions.remove.mutate({ id }),
    onSuccess: () => {
      toast.success('삭제되었습니다');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '실패'),
  });

  const triggerMut = useMutation({
    mutationFn: (id: number) => trpcClient.subscriptions.triggerNow.mutate({ id }),
    onSuccess: (res) => {
      const sources = Array.isArray(res?.enqueuedSources) ? res.enqueuedSources.join(', ') : '';
      toast.success(`수집이 큐에 등록되었습니다${sources ? ` (${sources})` : ''}`);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '실패'),
  });

  const rows = query.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">키워드 구독</CardTitle>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border bg-card px-2 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">전체</option>
            <option value="active">활성</option>
            <option value="paused">정지</option>
            <option value="error">오류</option>
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            title="새로고침"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            불러오는 중...
          </div>
        ) : query.isError ? (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {query.error instanceof Error ? query.error.message : '조회 실패'}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            등록된 구독이 없습니다. 상단의 "새 구독 등록" 버튼으로 추가하세요.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-lg border p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate">{row.keyword}</span>
                    <Badge
                      variant={
                        row.status === 'active'
                          ? 'default'
                          : row.status === 'paused'
                            ? 'secondary'
                            : 'destructive'
                      }
                      className="text-[10px]"
                    >
                      {row.status === 'active' ? '활성' : row.status === 'paused' ? '정지' : '오류'}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {row.intervalHours}시간 주기
                    </span>
                    {Array.isArray(row.sources) && row.sources.length > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {(row.sources as string[]).map((s) => SOURCE_LABEL_MAP[s] ?? s).join(' · ')}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                    <span>마지막 실행: {formatRelative(row.lastRunAt)}</span>
                    <span>다음 예정: {formatRelative(row.nextRunAt)}</span>
                    {row.lastError && (
                      <span className="text-destructive truncate max-w-[240px]">
                        오류: {row.lastError}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {onAnalyze && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAnalyze(row.keyword, row.id)}
                      title="이 키워드로 분석 실행"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => triggerMut.mutate(row.id)}
                    disabled={triggerMut.isPending || row.status === 'paused'}
                    title="지금 수집"
                  >
                    <Zap className="h-3.5 w-3.5" />
                  </Button>
                  {row.status === 'active' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => pauseMut.mutate(row.id)}
                      disabled={pauseMut.isPending}
                      title="일시 정지"
                    >
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resumeMut.mutate(row.id)}
                      disabled={resumeMut.isPending}
                      title="재개"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`"${row.keyword}" 구독을 삭제하시겠습니까?`)) {
                        removeMut.mutate(row.id);
                      }
                    }}
                    disabled={removeMut.isPending}
                    title="삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
