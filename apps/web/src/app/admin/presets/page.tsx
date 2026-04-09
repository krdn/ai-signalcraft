'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Power, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PresetFormDialog } from '@/components/admin/preset-form-dialog';

type PresetRow = Awaited<ReturnType<typeof trpcClient.admin.presets.list.query>>[number];

export default function AdminPresetsPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PresetRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'presets'],
    queryFn: () => trpcClient.admin.presets.list.query(),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; enabled?: boolean }) =>
      trpcClient.admin.presets.update.mutate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'presets'] });
      toast.success('변경되었습니다.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trpcClient.admin.presets.delete.mutate({ id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'presets'] });
      toast.success('비활성화되었습니다.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">분석 프리셋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            키워드 유형별 분석 설정 프리셋을 관리합니다.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditTarget(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          프리셋 추가
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">등록된 프리셋</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              등록된 프리셋이 없습니다.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>순서</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead>최적화</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((preset) => (
                  <TableRow key={preset.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {preset.sortOrder}
                    </TableCell>
                    <TableCell className="font-medium">{preset.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{preset.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{preset.optimization}</TableCell>
                    <TableCell>
                      {preset.enabled ? (
                        <Badge variant="default">활성</Badge>
                      ) : (
                        <Badge variant="secondary">비활성</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditTarget(preset);
                            setDialogOpen(true);
                          }}
                          title="편집"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateMutation.mutate({ id: preset.id, enabled: !preset.enabled })
                          }
                          disabled={updateMutation.isPending}
                          title={preset.enabled ? '비활성화' : '활성화'}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`"${preset.title}"을(를) 비활성화하시겠습니까?`))
                              deleteMutation.mutate(preset.id);
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

      <PresetFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editData={editTarget} />
    </div>
  );
}
