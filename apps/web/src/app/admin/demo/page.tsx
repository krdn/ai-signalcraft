'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface EditTarget {
  userId: string;
  userName: string | null;
  dailyLimit: number;
  expiresAt: string; // ISO string
}

export default function AdminDemoPage() {
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editDailyLimit, setEditDailyLimit] = useState('');
  const [editExtendDays, setEditExtendDays] = useState('');

  const { data: demoUsers, isLoading } = useQuery({
    queryKey: ['admin', 'demo', 'list'],
    queryFn: () => trpcClient.admin.demo.list.query(),
  });

  const { data: conversionStats } = useQuery({
    queryKey: ['admin', 'demo', 'conversion'],
    queryFn: () => trpcClient.admin.demo.conversionRate.query(),
  });

  const updateQuota = useMutation({
    mutationFn: (input: { userId: string; dailyLimit?: number; extendDays?: number }) =>
      trpcClient.admin.demo.updateQuota.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'demo'] });
      toast.success('쿼터가 변경되었습니다');
      setEditTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetQuota = useMutation({
    mutationFn: (userId: string) => trpcClient.admin.demo.resetQuota.mutate({ userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'demo'] });
      toast.success('쿼터가 리셋되었습니다');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEditDialog = (demo: {
    userId: string;
    userName: string | null;
    dailyLimit: number;
    expiresAt: Date | string;
  }) => {
    setEditDailyLimit(String(demo.dailyLimit));
    setEditExtendDays('');
    setEditTarget({
      userId: demo.userId,
      userName: demo.userName,
      dailyLimit: demo.dailyLimit,
      expiresAt: typeof demo.expiresAt === 'string' ? demo.expiresAt : demo.expiresAt.toISOString(),
    });
  };

  const handleEditSubmit = () => {
    if (!editTarget) return;
    const dailyLimit = editDailyLimit ? Number(editDailyLimit) : undefined;
    const extendDays = editExtendDays ? Number(editExtendDays) : undefined;
    if (dailyLimit !== undefined && (dailyLimit < 1 || dailyLimit > 50)) {
      toast.error('일일 한도는 1~50 사이여야 합니다');
      return;
    }
    if (extendDays !== undefined && (extendDays < 1 || extendDays > 90)) {
      toast.error('연장 일수는 1~90 사이여야 합니다');
      return;
    }
    if (dailyLimit === undefined && extendDays === undefined) {
      toast.error('변경할 항목을 입력해 주세요');
      return;
    }
    updateQuota.mutate({ userId: editTarget.userId, dailyLimit, extendDays });
  };

  const cleanupExpired = useMutation({
    mutationFn: () => trpcClient.admin.demo.cleanupExpired.mutate(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'demo'] });
      toast.success(`만료 계정 ${data.cleaned}개 정리됨`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">데모 관리</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => cleanupExpired.mutate()}
          disabled={cleanupExpired.isPending}
        >
          만료 계정 정리
        </Button>
      </div>

      {/* 전환 통계 */}
      {conversionStats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle as="h2" className="text-sm text-muted-foreground">
                총 데모 가입
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionStats.totalDemos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle as="h2" className="text-sm text-muted-foreground">
                체험 사용
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionStats.usedAtLeastOnce}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle as="h2" className="text-sm text-muted-foreground">
                정식 전환
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionStats.converted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle as="h2" className="text-sm text-muted-foreground">
                전환율
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionStats.conversionRate}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 데모 사용자 목록 */}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            데모 사용자 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : demoUsers && demoUsers.length > 0 ? (
            <Table>
              <caption className="sr-only">데모 사용자 목록</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>오늘</TableHead>
                  <TableHead>일일 한도</TableHead>
                  <TableHead>누적</TableHead>
                  <TableHead>만료일</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoUsers.map((demo) => {
                  const isExpired = new Date(demo.expiresAt) < new Date();
                  const today = new Date().toISOString().slice(0, 10);
                  const todayUsed = demo.todayDate === today ? demo.todayUsed : 0;
                  return (
                    <TableRow key={demo.userId}>
                      <TableCell className="font-medium">{demo.userName ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{demo.userEmail}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {todayUsed}/{demo.dailyLimit}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{demo.dailyLimit}회/일</TableCell>
                      <TableCell className="font-mono text-sm">{demo.totalUsed}회</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(demo.expiresAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="destructive">만료</Badge>
                        ) : (
                          <Badge variant="secondary">활성</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => openEditDialog(demo)}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            편집
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => resetQuota.mutate(demo.userId)}
                          >
                            리셋
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">데모 사용자가 없습니다</p>
          )}
        </CardContent>
      </Card>

      {/* 쿼터 편집 다이얼로그 */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>데모 쿼터 편집</DialogTitle>
            <DialogDescription>
              {editTarget?.userName ?? '사용자'}의 일일 한도와 사용 기간을 변경합니다.
              {editTarget && (
                <span className="block mt-1 text-xs">
                  현재 만료일:{' '}
                  {new Date(editTarget.expiresAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-daily-limit">일일 한도 (1~50회)</Label>
              <Input
                id="edit-daily-limit"
                type="number"
                min={1}
                max={50}
                placeholder={String(editTarget?.dailyLimit ?? 5)}
                value={editDailyLimit}
                onChange={(e) => setEditDailyLimit(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-extend-days">기간 연장 (1~90일)</Label>
              <Input
                id="edit-extend-days"
                type="number"
                min={1}
                max={90}
                placeholder="연장할 일수 입력"
                value={editExtendDays}
                onChange={(e) => setEditExtendDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                현재 만료일 또는 오늘 중 더 늦은 날짜 기준으로 연장됩니다.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              취소
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateQuota.isPending}>
              {updateQuota.isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
