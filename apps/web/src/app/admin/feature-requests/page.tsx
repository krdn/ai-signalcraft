'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

type Status = 'pending' | 'reviewing' | 'accepted' | 'rejected' | 'shipped';
type Category = 'feature' | 'improvement' | 'bug' | 'other';

const STATUS_LABEL: Record<Status, string> = {
  pending: '검토 대기',
  reviewing: '검토 중',
  accepted: '반영 예정',
  rejected: '반려',
  shipped: '반영됨',
};

const STATUS_VARIANT: Record<Status, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'outline',
  reviewing: 'secondary',
  accepted: 'default',
  rejected: 'destructive',
  shipped: 'default',
};

const CATEGORY_LABEL: Record<Category, string> = {
  feature: '기능 추가',
  improvement: '개선 제안',
  bug: '버그 신고',
  other: '기타',
};

interface EditTarget {
  id: number;
  status: Status;
  adminNote: string;
}

export default function AdminFeatureRequestsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('pending');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'featureRequests', statusFilter],
    queryFn: () =>
      trpcClient.admin.featureRequests.list.query({
        page: 1,
        pageSize: 50,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (input: { id: number; status: Status; adminNote: string | null }) =>
      trpcClient.admin.featureRequests.updateStatus.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'featureRequests'] });
      toast.success('상태를 변경했습니다');
      setEditTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">기능 제안 관리</h1>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status | 'all')}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pending">검토 대기</TabsTrigger>
          <TabsTrigger value="reviewing">검토 중</TabsTrigger>
          <TabsTrigger value="accepted">반영 예정</TabsTrigger>
          <TabsTrigger value="shipped">반영됨</TabsTrigger>
          <TabsTrigger value="rejected">반려</TabsTrigger>
          <TabsTrigger value="all">전체</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {!isLoading && data && data.items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            제안이 없습니다.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {data?.items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <CardTitle as="h2" className="text-base">
                    {item.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.submitterName ?? item.submitterEmail} ·{' '}
                    {new Date(item.createdAt).toLocaleString('ko-KR')} ·{' '}
                    {CATEGORY_LABEL[item.category as Category]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[item.status as Status]}>
                    {STATUS_LABEL[item.status as Status]}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditTarget({
                        id: item.id,
                        status: item.status as Status,
                        adminNote: item.adminNote ?? '',
                      })
                    }
                  >
                    상태 변경
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {item.description}
              </p>
              {item.adminNote && (
                <div className="mt-3 p-3 bg-muted rounded text-sm">
                  <p className="font-medium text-xs text-muted-foreground mb-1">관리자 답변</p>
                  <p className="whitespace-pre-wrap">{item.adminNote}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상태 변경</DialogTitle>
            <DialogDescription>
              상태와 관리자 답변을 입력하세요. 답변은 제안자에게 공개됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>상태</Label>
              <Select
                value={editTarget?.status}
                onValueChange={(v) =>
                  setEditTarget((prev) => (prev ? { ...prev, status: v as Status } : null))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>관리자 답변 (선택)</Label>
              <Textarea
                value={editTarget?.adminNote ?? ''}
                onChange={(e) =>
                  setEditTarget((prev) => (prev ? { ...prev, adminNote: e.target.value } : null))
                }
                rows={4}
                maxLength={1000}
                placeholder="예: 다음 분기 로드맵에 포함될 예정입니다"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              취소
            </Button>
            <Button
              onClick={() =>
                editTarget &&
                updateStatusMutation.mutate({
                  id: editTarget.id,
                  status: editTarget.status,
                  adminNote: editTarget.adminNote.trim() || null,
                })
              }
              disabled={updateStatusMutation.isPending}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
