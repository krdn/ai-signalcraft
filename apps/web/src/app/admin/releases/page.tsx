'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
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
import { trpcClient } from '@/lib/trpc';

type Status = 'draft' | 'published' | 'archived';

const STATUS_LABEL: Record<Status, string> = {
  draft: '초안',
  published: '발행됨',
  archived: '보관됨',
};

const STATUS_VARIANT: Record<Status, 'default' | 'secondary' | 'outline'> = {
  draft: 'outline',
  published: 'default',
  archived: 'secondary',
};

export default function AdminReleasesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('draft');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; version: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'releases', 'list', statusFilter],
    queryFn: () =>
      trpcClient.admin.releases.listAll.query({
        page: 1,
        pageSize: 50,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  });

  const publishMutation = useMutation({
    mutationFn: (id: number) => trpcClient.admin.releases.publish.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'releases'] });
      toast.success('릴리스를 발행했습니다');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: number) => trpcClient.admin.releases.unpublish.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'releases'] });
      toast.success('발행을 취소했습니다');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => trpcClient.admin.releases.delete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'releases'] });
      toast.success('릴리스를 삭제했습니다');
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">릴리스 관리</h1>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status | 'all')}>
        <TabsList>
          <TabsTrigger value="draft">초안</TabsTrigger>
          <TabsTrigger value="published">발행됨</TabsTrigger>
          <TabsTrigger value="archived">보관됨</TabsTrigger>
          <TabsTrigger value="all">전체</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!isLoading && data && data.items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            릴리스가 없습니다.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {data?.items.map((release) => (
          <Card key={release.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-lg">{release.version}</CardTitle>
                    <Badge variant={STATUS_VARIANT[release.status as Status]}>
                      {STATUS_LABEL[release.status as Status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(release.deployedAt).toLocaleString('ko-KR')} ·{' '}
                    <code className="bg-muted px-1 rounded">{release.gitShaTo.slice(0, 7)}</code>
                  </p>
                  {release.summary && <p className="text-sm mt-2">{release.summary}</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/admin/releases/${release.id}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      상세
                    </Button>
                  </Link>
                  {release.status === 'draft' && (
                    <Button
                      size="sm"
                      onClick={() => publishMutation.mutate(release.id)}
                      disabled={publishMutation.isPending}
                    >
                      발행
                    </Button>
                  )}
                  {release.status === 'published' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => unpublishMutation.mutate(release.id)}
                      disabled={unpublishMutation.isPending}
                    >
                      발행 취소
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget({ id: release.id, version: release.version })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>릴리스 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.version} 릴리스와 모든 항목이 영구 삭제됩니다. 이 작업은 되돌릴 수
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
