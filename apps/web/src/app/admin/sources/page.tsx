'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Power, Trash2, Rss, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { SourceFormDialog } from '@/components/admin/source-form-dialog';

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminSourcesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'sources'],
    queryFn: () => trpcClient.admin.sources.list.query(),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; enabled?: boolean }) =>
      trpcClient.admin.sources.update.mutate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sources'] });
      toast.success('변경되었습니다.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trpcClient.admin.sources.delete.mutate({ id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sources'] });
      toast.success('비활성화되었습니다.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">데이터 소스</h1>
          <p className="text-sm text-muted-foreground mt-1">
            관리자가 URL을 등록하면 대시보드 트리거 폼에 자동으로 노출됩니다.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          소스 추가
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">등록된 소스</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !data || data.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              등록된 소스가 없습니다. "소스 추가" 버튼을 눌러 시작하세요.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>타입</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>최근 수집</TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {s.adapterType === 'rss' ? (
                          <Rss className="h-3 w-3" />
                        ) : (
                          <Globe className="h-3 w-3" />
                        )}
                        {s.adapterType.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {s.url}
                    </TableCell>
                    <TableCell>
                      {s.enabled ? (
                        <Badge variant="default">활성</Badge>
                      ) : (
                        <Badge variant="secondary">비활성</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(s.lastCollectedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateMutation.mutate({ id: s.id, enabled: !s.enabled })}
                          disabled={updateMutation.isPending}
                          title={s.enabled ? '비활성화' : '활성화'}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`"${s.name}"을(를) 비활성화하시겠습니까?`)) {
                              deleteMutation.mutate(s.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SourceFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
